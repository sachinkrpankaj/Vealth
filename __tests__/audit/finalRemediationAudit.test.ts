import {
  encryptCardNumber,
  decryptCardNumber,
  createCardKeyEnvelope,
  restoreCardKeyFromEnvelope,
  copySensitiveTextToClipboard,
  getMasterEncryptionKeyHex,
} from '../../src/domain/cards/cardSecurity';
import {
  calculatePersonDebt,
  calculateTotalStandaloneLiabilities,
  calculateNetWorth,
} from '../../src/domain/finance/financialEngine';
import { Account, Liability, Person, Transaction } from '../../src/domain/finance/types';
import { useSecurityStore } from '../../src/stores/useSecurityStore';
import {
  createBackupData,
  validateBackupData,
  restoreBackup,
  validateCardKeyEnvelope,
  VealthBackupData,
} from '../../src/utils/backup';
import { serializeDatabase, DatabaseOperationQueue } from '../../src/database/serializedDatabase';
import { Platform } from 'react-native';

describe('Final Security, Accounting & Data Integrity Remediation Regression Suite', () => {
  describe('1. Card Wallet Encryption & Format Validation', () => {
    it('rejects malformed IV lengths, truncated auth tags, and non-hex characters in aes-gcm:v1', async () => {
      // Valid IV is 24 hex characters (12 bytes), valid tag/ciphertext has >= 32 hex characters (16 bytes tag)
      // 1. Truncated IV (only 22 hex chars)
      await expect(
        decryptCardNumber('aes-gcm:v1:0123456789abcdef012345:0123456789abcdef0123456789abcdef01234567')
      ).rejects.toThrow(/invalid or corrupted encrypted card payload format/i);

      // 2. Overlong IV (26 hex chars)
      await expect(
        decryptCardNumber('aes-gcm:v1:0123456789abcdef0123456789:0123456789abcdef0123456789abcdef01234567')
      ).rejects.toThrow(/invalid or corrupted encrypted card payload format/i);

      // 3. Truncated tag / ciphertext (< 32 hex chars)
      await expect(
        decryptCardNumber('aes-gcm:v1:0123456789abcdef01234567:0123456789abcdef')
      ).rejects.toThrow(/invalid or corrupted encrypted card payload format/i);

      // 4. Non-hex characters in IV or ciphertext
      await expect(
        decryptCardNumber('aes-gcm:v1:0123456789abcdef012345zz:0123456789abcdef0123456789abcdef01234567')
      ).rejects.toThrow(/invalid or corrupted encrypted card payload format/i);

      // 5. Payload without scheme delimiter
      await expect(decryptCardNumber('completelycorruptedplaintext')).rejects.toThrow(
        /invalid encrypted card format/i
      );
    });

    it('successfully decrypts legacy fallback:v1 records for compatibility', async () => {
      // Known fallback:v1 payload structure with 24-char IV (12 bytes)
      const legacyPayload = 'fallback:v1:0123456789abcdef01234567:0123456789abcdef0123456789abcdef';
      const res = await decryptCardNumber(legacyPayload);
      expect(typeof res).toBe('string');
    });

    it('safely disables card encryption and reveal on Web platform', async () => {
      const originalOS = Platform.OS;
      try {
        (Platform as any).OS = 'web';
        await expect(encryptCardNumber('4532015098211234')).rejects.toThrow(
          /Card number storage and decryption are disabled on web/i
        );
        await expect(
          decryptCardNumber('aes-gcm:v1:0123456789abcdef01234567:0123456789abcdef0123456789abcdef01234567')
        ).rejects.toThrow(/Card number storage and decryption are disabled on web/i);
      } finally {
        (Platform as any).OS = originalOS;
      }
    });
  });

  describe('2. Backup Key Defaults & Envelope Security', () => {
    it('strictly requires user-provided passphrase and rejects default password fallbacks', async () => {
      await expect(createCardKeyEnvelope('')).rejects.toThrow(/passphrase is required/i);
      await expect(createCardKeyEnvelope('   ')).rejects.toThrow(/passphrase is required/i);
    });

    it('rejects tampered envelopes, dangerous iteration counts, and invalid parameters', () => {
      // 1. Missing fields
      expect(validateCardKeyEnvelope(null).isValid).toBe(false);
      expect(validateCardKeyEnvelope({} as any).isValid).toBe(false);

      // 2. Iterations too low (< 10,000)
      expect(
        validateCardKeyEnvelope({
          algorithm: 'AES-GCM-256',
          kdf: 'PBKDF2-SHA256',
          iterations: 500,
          saltHex: '0123456789abcdef0123456789abcdef',
          ivHex: '0123456789abcdef01234567',
          ciphertextHex: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        }).isValid
      ).toBe(false);

      // 3. Iterations too high (> 1,000,000)
      expect(
        validateCardKeyEnvelope({
          algorithm: 'AES-GCM-256',
          kdf: 'PBKDF2-SHA256',
          iterations: 2000000,
          saltHex: '0123456789abcdef0123456789abcdef',
          ivHex: '0123456789abcdef01234567',
          ciphertextHex: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        }).isValid
      ).toBe(false);

      // 4. Invalid KDF
      expect(
        validateCardKeyEnvelope({
          algorithm: 'AES-GCM-256',
          kdf: 'MD5',
          iterations: 100000,
          saltHex: '0123456789abcdef0123456789abcdef',
          ivHex: '0123456789abcdef01234567',
          ciphertextHex: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        }).isValid
      ).toBe(false);

      // 5. Valid envelope
      expect(
        validateCardKeyEnvelope({
          algorithm: 'AES-GCM-256',
          kdf: 'PBKDF2-SHA256',
          iterations: 100000,
          saltHex: '0123456789abcdef0123456789abcdef',
          ivHex: '0123456789abcdef01234567',
          ciphertextHex: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        }).isValid
      ).toBe(true);
    });

    it('unwrapping envelope does not mutate device master key', async () => {
      const originalKey = await getMasterEncryptionKeyHex();
      const envelope = await createCardKeyEnvelope('UserSecretPass!123');

      const unwrappedKey = await restoreCardKeyFromEnvelope(envelope, 'UserSecretPass!123');
      expect(unwrappedKey).toBe(originalKey);

      // Master key on current device must remain intact
      const afterKey = await getMasterEncryptionKeyHex();
      expect(afterKey).toBe(originalKey);
    });

    it('decrypts incoming cards with envelope key and re-encrypts with destination master key', async () => {
      const sourceMasterKey = await getMasterEncryptionKeyHex();
      const rawCardNumber = '5200821234567890';
      const sourceCiphertext = await encryptCardNumber(rawCardNumber, sourceMasterKey);

      // Create envelope using user passphrase
      const envelope = await createCardKeyEnvelope('CardWalletBackup123!');

      // Unwrap incoming key from envelope
      const restoredKey = await restoreCardKeyFromEnvelope(envelope, 'CardWalletBackup123!');
      expect(restoredKey).toBe(sourceMasterKey);

      // Decrypt incoming card with restored key
      const decryptedPlain = await decryptCardNumber(sourceCiphertext, restoredKey);
      expect(decryptedPlain).toBe(rawCardNumber);

      // Destination device key
      const destinationKey = await getMasterEncryptionKeyHex();
      const reEncrypted = await encryptCardNumber(decryptedPlain, destinationKey);

      // Card is decryptable with destination device's local master key
      const finalPlain = await decryptCardNumber(reEncrypted, destinationKey);
      expect(finalPlain).toBe(rawCardNumber);

      // Destination device's key remains completely unchanged
      const currentDestKey = await getMasterEncryptionKeyHex();
      expect(currentDestKey).toBe(destinationKey);
    }, 30000);

    it('rejects backup with cards when key envelope is missing or corrupted', () => {
      const backupMissingEnvelope: any = {
        appName: 'vealth',
        schemaVersion: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        data: {
          accounts: [],
          people: [],
          categories: [],
          transactions: [],
          assets: [],
          liabilities: [],
          settings: {},
          cards: [
            {
              id: 'c1',
              cardholderName: 'User',
              cardType: 'CREDIT',
              network: 'VISA',
              encryptedCardNumber: 'aes-gcm:v1:0123456789abcdef01234567:0123456789abcdef0123456789abcdef',
              lastFour: '1234',
              expiryMonth: 12,
              expiryYear: 2028,
              issuer: 'Bank',
              isArchived: false,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      };

      const result = validateBackupData(backupMissingEnvelope);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('missing the required card key envelope');
    });
  });

  describe('3. Liability Deduplication & Financial Accounting', () => {
    const ccAccount: Account = {
      id: 'acc-credit-hdfc',
      name: 'HDFC Regalia',
      type: 'CREDIT_CARD',
      openingBalance: 0,
      currency: 'INR',
      isArchived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    it('deduplicates credit-card liability ONLY via explicit accountId, keeping same name/notes in total', () => {
      // 1. Explicitly linked liability (accountId === acc-credit-hdfc)
      const linkedLiability: Liability = {
        id: 'lib-linked',
        name: 'HDFC Regalia Debt',
        type: 'CREDIT_CARD',
        amount: 2500000,
        accountId: ccAccount.id,
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      // 2. Unlinked liability with identical name
      const sameNameLiability: Liability = {
        id: 'lib-unlinked-name',
        name: 'HDFC Regalia',
        type: 'CREDIT_CARD',
        amount: 1500000,
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      // 3. Unlinked liability with account ID mentioned in note
      const noteLiability: Liability = {
        id: 'lib-unlinked-note',
        name: 'Other Card',
        type: 'CREDIT_CARD',
        amount: 1000000,
        note: ccAccount.id,
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const total = calculateTotalStandaloneLiabilities(
        [linkedLiability, sameNameLiability, noteLiability],
        [ccAccount]
      );

      // Only linkedLiability is excluded. sameNameLiability (1500000) and noteLiability (1000000) MUST be included!
      expect(total).toBe(2500000);
    });

    it('opposing debts with zero net balance are NOT marked settled when gross amounts remain', () => {
      const person: Person = {
        id: 'p-1',
        name: 'Suresh Kumar',
        avatarColor: '#10B981',
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const lendTx: Transaction = {
        id: 'tx-lend',
        type: 'LEND',
        amount: 1000000, // ₹10,000 receivable
        date: '2026-01-01',
        personId: person.id,
        createdAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.000Z',
      };

      const borrowTx: Transaction = {
        id: 'tx-borrow',
        type: 'BORROW',
        amount: 1000000, // ₹10,000 payable
        date: '2026-01-01',
        personId: person.id,
        createdAt: '2026-01-01T11:00:00.000Z',
        updatedAt: '2026-01-01T11:00:00.000Z',
      };

      const debtSummary = calculatePersonDebt(person, [lendTx, borrowTx], '2026-01-10');
      expect(debtSummary.netBalance).toBe(0);
      expect(debtSummary.owedToYou).toBe(1000000);
      expect(debtSummary.youOwe).toBe(1000000);
      expect(debtSummary.dueStatus).not.toBe('SETTLED');
    });
  });

  describe('4. PIN Lockout & Storage Fail-Closed Behavior', () => {
    it('storage read failures in loadPersistedLockout fail closed', async () => {
      const SecureStore = require('expo-secure-store');
      const originalEnv = process.env.NODE_ENV;
      const originalGetItem = SecureStore.getItemAsync;

      try {
        (process.env as any).NODE_ENV = 'production';

        // 1. When reading lockout fails, loadPersistedLockout defaults to locked out (5 attempts, 60s lockout)
        SecureStore.getItemAsync = jest.fn(async (key: string) => {
          if (key === 'vaelth_security_pin_hash') {
            return 'pbkdf2:v1:0123456789abcdef:10000:abcdef';
          }
          if (key === 'vaelth_security_pin_lockout') {
            throw new Error('SecureStore disk corruption');
          }
          return null;
        });

        useSecurityStore.setState({ isPinEnabled: true, failedAttempts: 0, lockoutUntil: null });
        const store = useSecurityStore.getState();
        await store.checkSecurityConfig();

        // Must fail closed with 5 failed attempts and active lockout
        const updatedState = useSecurityStore.getState();
        expect(updatedState.failedAttempts).toBeGreaterThanOrEqual(5);
        expect(updatedState.lockoutUntil).not.toBeNull();
        expect(updatedState.isLocked).toBe(true);

        // 2. When reading pin hash itself fails on secure store, fails closed with securityConfigError
        SecureStore.getItemAsync = jest.fn().mockRejectedValue(new Error('Total SecureStore failure'));
        useSecurityStore.setState({ isPinEnabled: true });
        await useSecurityStore.getState().checkSecurityConfig();
        expect(useSecurityStore.getState().securityConfigError).toBeTruthy();
        expect(useSecurityStore.getState().isLocked).toBe(true);
      } finally {
        process.env.NODE_ENV = originalEnv;
        SecureStore.getItemAsync = originalGetItem;
      }
    });

    it('serializes rapid concurrent PIN verifications without race conditions', async () => {
      useSecurityStore.setState({ securityConfigError: null, failedAttempts: 0, lockoutUntil: null });
      const store = useSecurityStore.getState();
      await store.setPin('1234');

      // Run multiple concurrent PIN verifications
      const results = await Promise.all([
        store.verifyPin('1234'),
        store.verifyPin('1234'),
        store.verifyPin('1234'),
      ]);

      // First verification processes; concurrent in-flight submissions are rejected to eliminate race conditions
      expect(results[0]).toBe(true);
      expect(results.filter((r) => r === false).length).toBeGreaterThanOrEqual(1);

      // Sequential verification after completion succeeds normally
      const sequentialResult = await store.verifyPin('1234');
      expect(sequentialResult).toBe(true);
    });

    it('clipboard cleanup does not overwrite newer user copies', async () => {
      const Clipboard = require('expo-clipboard');
      await copySensitiveTextToClipboard('4111222233334444', 50);

      // Simulate user copying something else before cleanup runs
      await Clipboard.setStringAsync('my-unrelated-note');

      // Wait past timeout
      await new Promise((resolve) => setTimeout(resolve, 70));

      // Clipboard must still contain user's newer copy!
      const current = await Clipboard.getStringAsync();
      expect(current).toBe('my-unrelated-note');
    });
  });

  describe('5. Database Serialization & Transaction Isolation', () => {
    it('serializes overlapping asynchronous calls FIFO on DatabaseOperationQueue', async () => {
      const queue = new DatabaseOperationQueue();
      const executionOrder: number[] = [];

      const p1 = queue.enqueue(async () => {
        await new Promise((r) => setTimeout(r, 40));
        executionOrder.push(1);
        return 1;
      });

      const p2 = queue.enqueue(async () => {
        await new Promise((r) => setTimeout(r, 10));
        executionOrder.push(2);
        return 2;
      });

      const p3 = queue.enqueue(async () => {
        executionOrder.push(3);
        return 3;
      });

      await Promise.all([p1, p2, p3]);
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it('safely flattens nested transaction callbacks without deadlocks', async () => {
      const rawDb: any = {
        runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
        withTransactionAsync: jest.fn(async (task: any) => task()),
      };

      const db = serializeDatabase(rawDb);
      let executedInner = false;

      await db.withTransactionAsync(async () => {
        await db.runAsync('UPDATE t1 SET val = 1');
        await db.withTransactionAsync(async () => {
          await db.runAsync('UPDATE t2 SET val = 2');
          executedInner = true;
        });
      });

      expect(executedInner).toBe(true);
      expect(rawDb.runAsync).toHaveBeenCalledTimes(2);
    });
  });
});
