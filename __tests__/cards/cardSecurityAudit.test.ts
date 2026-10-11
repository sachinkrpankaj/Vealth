import {
  encryptCardNumber,
  decryptCardNumber,
  getMasterEncryptionKeyHex,
  copySensitiveTextToClipboard,
  createCardKeyEnvelope,
  restoreCardKeyFromEnvelope,
  _resetCardSecurityForTesting,
} from '../../src/domain/cards/cardSecurity';
import {
  revealCardNumber,
  createCard,
  getCardById,
} from '../../src/database/repositories/cardRepository';
import {
  deleteAccount,
  updateAccount,
  createAccount,
} from '../../src/database/repositories/accountRepository';
import { useSecurityStore } from '../../src/stores/useSecurityStore';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import { openDatabaseAsync } from 'expo-sqlite';

const openMock = openDatabaseAsync as jest.Mock;

describe('Card Wallet Security & Authentication Audit Regression Tests', () => {
  let cardsTable: Map<string, any>;
  let accountsTable: Map<string, any>;
  let mockDb: any;

  beforeEach(() => {
    _resetCardSecurityForTesting();
    jest.clearAllMocks();
    cardsTable = new Map();
    accountsTable = new Map();

    mockDb = {
      getAllAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM cards WHERE linkedAccountId = ?')) {
          const list = Array.from(cardsTable.values()).filter(
            (c) => c.linkedAccountId === params[0]
          );
          return list;
        }
        if (sql.includes('FROM cards')) {
          return Array.from(cardsTable.values());
        }
        if (sql.includes('FROM accounts')) {
          return Array.from(accountsTable.values());
        }
        return [];
      }),
      getFirstAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('SELECT COUNT(*) as count FROM cards WHERE linkedAccountId = ?')) {
          const count = Array.from(cardsTable.values()).filter(
            (c) => c.linkedAccountId === params[0]
          ).length;
          return { count };
        }
        if (sql.includes('SELECT COUNT(*) as count FROM transactions')) {
          return { count: 0 };
        }
        if (sql.includes('FROM cards WHERE id = ?')) {
          return cardsTable.get(params[0]) || null;
        }
        if (sql.includes('FROM accounts WHERE id = ?')) {
          return accountsTable.get(params[0]) || null;
        }
        return null;
      }),
      runAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('INSERT INTO cards')) {
          const [
            id, cardholderName, cardType, network, encryptedCardNumber,
            lastFour, expiryMonth, expiryYear, cardNickname, linkedAccountId,
            colorTheme, issuer, createdAt, updatedAt
          ] = params;
          cardsTable.set(id, {
            id, cardholderName, cardType, network, encryptedCardNumber,
            lastFour, expiryMonth, expiryYear, cardNickname, linkedAccountId,
            colorTheme, issuer, isArchived: 0, createdAt, updatedAt
          });
          return { changes: 1 };
        }
        if (sql.includes('UPDATE cards SET encryptedCardNumber = ?, updatedAt = ? WHERE id = ?')) {
          const [enc, updated, id] = params;
          const card = cardsTable.get(id);
          if (card) {
            card.encryptedCardNumber = enc;
            card.updatedAt = updated;
          }
          return { changes: 1 };
        }
        if (sql.includes('INSERT INTO accounts')) {
          const [id, name, type, openingBalance, creditLimit, billingDay, dueDay, currency] = params;
          accountsTable.set(id, {
            id, name, type, openingBalance, creditLimit, billingDay, dueDay, currency,
            isArchived: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
          });
          return { changes: 1 };
        }
        if (sql.includes('UPDATE accounts SET')) {
          const id = params[params.length - 1];
          const acc = accountsTable.get(id);
          if (acc) {
            acc.type = params[1];
          }
          return { changes: 1 };
        }
        if (sql.includes('DELETE FROM accounts WHERE id = ?')) {
          accountsTable.delete(params[0]);
          return { changes: 1 };
        }
        return { changes: 1 };
      }),
      execAsync: jest.fn().mockResolvedValue(undefined),
      withTransactionAsync: jest.fn(async (cb: any) => cb()),
      withExclusiveTransactionAsync: jest.fn(async (cb: any) => cb(mockDb)),
    };

    openMock.mockResolvedValue(mockDb);
  });

  describe('1. Cryptographic Security & Insecure Fallback Removal', () => {
    it('always generates authenticated aes-gcm:v1 ciphertext in production', async () => {
      const rawCard = '4532015012345671';
      const cipher = await encryptCardNumber(rawCard);
      expect(cipher.startsWith('aes-gcm:v1:')).toBe(true);
      expect(cipher).not.toContain('fallback:v1:');
      expect(cipher).not.toContain(rawCard);

      const decrypted = await decryptCardNumber(cipher);
      expect(decrypted).toBe(rawCard);
    });

    it('fails closed when crypto operation fails and never generates XOR fallback', async () => {
      const spy = jest
        .spyOn(globalThis.crypto.subtle, 'importKey')
        .mockRejectedValueOnce(new Error('Hardware security module failure'));
      await expect(encryptCardNumber('4532015012345671')).rejects.toThrow(
        /Hardware security module failure|Encryption failed/
      );
      spy.mockRestore();
    });

    it('decrypts existing legacy fallback:v1 card records without data loss', async () => {
      const masterKey = await getMasterEncryptionKeyHex();
      const rawNumber = '4532015098765432';

      // Generate a synthetic fallback:v1 payload matching the legacy XOR format (scheme:version:ivHex:cipherHex)
      const keyBytes = new Uint8Array(
        masterKey.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
      );
      const iv = new Uint8Array(12).fill(0x5a);
      const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, '0')).join('');
      const plainBytes = new TextEncoder().encode(rawNumber);

      const pad = new Uint8Array(keyBytes.length);
      for (let i = 0; i < keyBytes.length; i++) pad[i] = keyBytes[i] ^ iv[i % iv.length];
      const cipherBytes = new Uint8Array(plainBytes.length);
      for (let i = 0; i < plainBytes.length; i++) cipherBytes[i] = plainBytes[i] ^ pad[i % pad.length];
      const cipherHex = Array.from(cipherBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      const legacyCiphertext = `fallback:v1:${ivHex}:${cipherHex}`;

      const decrypted = await decryptCardNumber(legacyCiphertext);
      expect(decrypted).toBe(rawNumber);
    });

    it('transparently migrates fallback:v1 records to aes-gcm:v1 on card reveal in database', async () => {
      const masterKey = await getMasterEncryptionKeyHex();
      const rawNumber = '4532015098765432';
      const keyBytes = new Uint8Array(
        masterKey.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
      );
      const iv = new Uint8Array(12).fill(0x3c);
      const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, '0')).join('');
      const plainBytes = new TextEncoder().encode(rawNumber);

      const pad = new Uint8Array(keyBytes.length);
      for (let i = 0; i < keyBytes.length; i++) pad[i] = keyBytes[i] ^ iv[i % iv.length];
      const cipherBytes = new Uint8Array(plainBytes.length);
      for (let i = 0; i < plainBytes.length; i++) cipherBytes[i] = plainBytes[i] ^ pad[i % pad.length];
      const cipherHex = Array.from(cipherBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      const legacyCiphertext = `fallback:v1:${ivHex}:${cipherHex}`;

      // Insert legacy card into mock database
      const legacyCardId = 'card-legacy-1';
      cardsTable.set(legacyCardId, {
        id: legacyCardId,
        cardholderName: 'Legacy Cardholder',
        cardType: 'CREDIT',
        network: 'VISA',
        encryptedCardNumber: legacyCiphertext,
        lastFour: '5432',
        expiryMonth: 12,
        expiryYear: 2029,
        issuer: 'HDFC Bank',
        isArchived: 0,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      });

      const card = cardsTable.get(legacyCardId);
      const revealed = await revealCardNumber(card);
      expect(revealed).toBe(rawNumber);

      // Verify that the card record in database was upgraded to aes-gcm:v1
      const updatedInDb = cardsTable.get(legacyCardId);
      expect(updatedInDb.encryptedCardNumber.startsWith('aes-gcm:v1:')).toBe(true);
    });
  });

  describe('2. Hardened Clipboard Handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns false when clipboard write fails and does not claim false success', async () => {
      (Clipboard.setStringAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Clipboard access denied by OS')
      );
      const result = await copySensitiveTextToClipboard('4532015012345671');
      expect(result).toBe(false);
    });

    it('safely clears clipboard only if text still matches and does not overwrite user newer copies', async () => {
      let currentClipboard = '';
      (Clipboard.setStringAsync as jest.Mock).mockImplementation(async (text: string) => {
        currentClipboard = text;
        return true;
      });
      (Clipboard.getStringAsync as jest.Mock).mockImplementation(async () => currentClipboard);

      const secret = '4532015012345671';
      const success = await copySensitiveTextToClipboard(secret, 5000);
      expect(success).toBe(true);
      expect(currentClipboard).toBe(secret);

      // User copies something else in the meantime
      currentClipboard = 'User OTP 123456';

      // Fast-forward timeout
      jest.advanceTimersByTime(6000);
      await Promise.resolve();

      // Secret cleanup should NOT have cleared user's newer clipboard content!
      expect(currentClipboard).toBe('User OTP 123456');
    });
  });

  describe('3. PIN Lockout State Persistence Across Restarts', () => {
    it('persists failed attempts and lockout expiration to SecureStore', async () => {
      const store = useSecurityStore.getState();
      const mockStorage = new Map<string, string>();

      (SecureStore.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => {
        return mockStorage.get(key) || null;
      });
      (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key: string, val: string) => {
        mockStorage.set(key, val);
      });
      (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key: string) => {
        mockStorage.delete(key);
      });

      // Set up PIN '1234'
      await store.setPin('1234');

      // Fail 5 times (threshold for lockout)
      await store.verifyPin('0000');
      await store.verifyPin('0000');
      await store.verifyPin('0000');
      await store.verifyPin('0000');
      const lockRes = await store.verifyPin('0000');

      expect(lockRes).toBe(false);
      const lockedState = useSecurityStore.getState();
      expect(lockedState.getRemainingLockoutSeconds()).toBeGreaterThan(0);
      expect(lockedState.lockoutUntil).not.toBeNull();
      expect(lockedState.failedAttempts).toBe(5);

      // Verify persisted lockout payload in SecureStore
      const persistedLockout = mockStorage.get('vaelth_security_pin_lockout');
      expect(persistedLockout).toBeDefined();
      const [attemptsStr, untilStr] = (persistedLockout || '').split(':');
      expect(parseInt(attemptsStr, 10)).toBe(5);
      expect(parseInt(untilStr, 10)).toBeGreaterThan(Date.now());

      // Simulate app restart / force-close by re-checking security config
      const freshStore = useSecurityStore.getState();
      await freshStore.checkSecurityConfig();

      // Fresh state must retain lockout!
      expect(freshStore.getRemainingLockoutSeconds()).toBeGreaterThan(0);
      expect(freshStore.failedAttempts).toBe(5);
    });
  });

  describe('4. Card-Account Link Integrity Protection', () => {
    it('prevents account deletion when cards in Card Wallet are linked to it', async () => {
      const bank = await createAccount({
        id: 'acc-bank-locked',
        name: 'HDFC Savings',
        type: 'BANK',
        openingBalance: 50000,
        currency: 'INR',
        isArchived: false,
      });

      await createCard({
        cardholderName: 'Aarav Sharma',
        cardNumber: '6080123456789015',
        cardType: 'DEBIT',
        network: 'RUPAY',
        expiryMonth: 8,
        expiryYear: 2029,
        linkedAccountId: bank.id,
      });

      await expect(deleteAccount(bank.id)).rejects.toThrow(
        /Cannot delete account because it is linked to one or more cards/
      );
    });

    it('prevents account type change when linked to an incompatible card type', async () => {
      const bank = await createAccount({
        id: 'acc-bank-switch',
        name: 'SBI Bank',
        type: 'BANK',
        openingBalance: 10000,
        currency: 'INR',
        isArchived: false,
      });

      await createCard({
        cardholderName: 'Aarav Sharma',
        cardNumber: '6080123456789015',
        cardType: 'DEBIT',
        network: 'RUPAY',
        expiryMonth: 8,
        expiryYear: 2029,
        linkedAccountId: bank.id,
      });

      // Try switching BANK to CREDIT_CARD
      await expect(
        updateAccount(bank.id, { type: 'CREDIT_CARD' })
      ).rejects.toThrow(/linked debit card requires a BANK account/);
    });
  });

  describe('5. Secure Card Key Envelope Export / Restore', () => {
    it('creates encrypted envelope with PBKDF2 without exporting plaintext key and restores successfully', async () => {
      const originalKey = await getMasterEncryptionKeyHex();
      const password = 'StrongUserPassword123!';

      const envelope = await createCardKeyEnvelope(password);
      expect(envelope).toBeDefined();
      expect(envelope.algorithm).toBe('AES-GCM-256');
      expect(envelope.kdf).toBe('PBKDF2-SHA256');
      expect(envelope.iterations).toBe(100000);
      expect(envelope.saltHex).toBeDefined();
      expect(envelope.ivHex).toBeDefined();
      expect(envelope.ciphertextHex).toBeDefined();

      // Plaintext key MUST NOT appear anywhere in the envelope
      const envJson = JSON.stringify(envelope);
      expect(envJson).not.toContain(originalKey);

      // Restore key from envelope using password
      const restored = await restoreCardKeyFromEnvelope(envelope, password);
      expect(restored).toBe(originalKey);

      // Restored key matches original master key
      const currentKey = await getMasterEncryptionKeyHex();
      expect(currentKey).toBe(originalKey);

      // Wrong password fails closed
      await expect(
        restoreCardKeyFromEnvelope(envelope, 'WrongPassword!')
      ).rejects.toThrow(/Failed to decrypt card key envelope/);
    });
  });
});
