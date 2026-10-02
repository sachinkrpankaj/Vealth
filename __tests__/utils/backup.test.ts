import { isSecurityKey, validateBackupData, VaelthBackupData } from '../../src/utils/backup';

describe('Backup & Restore Integrity Engine', () => {
  describe('isSecurityKey Security Filter', () => {
    it('detects all sensitive authentication and PIN keys', () => {
      expect(isSecurityKey('security_pin')).toBe(true);
      expect(isSecurityKey('security_pin_salt')).toBe(true);
      expect(isSecurityKey('app_pin')).toBe(true);
      expect(isSecurityKey('user_pin_hash')).toBe(true);
      expect(isSecurityKey('password_hash')).toBe(true);
      expect(isSecurityKey('keystore_secret')).toBe(true);
      expect(isSecurityKey('biometric_key')).toBe(true);
      expect(isSecurityKey('auth_token')).toBe(true);
    });

    it('permits non-sensitive configuration and preference keys', () => {
      expect(isSecurityKey('theme')).toBe(false);
      expect(isSecurityKey('currency')).toBe(false);
      expect(isSecurityKey('user_display_name')).toBe(false);
      expect(isSecurityKey('first_run_completed')).toBe(false);
      expect(isSecurityKey('preferred_account_id')).toBe(false);
      expect(isSecurityKey('reminder_time')).toBe(false);
    });
  });

  describe('validateBackupData', () => {
    const validSampleBackup: VaelthBackupData = {
      appName: 'Vaelth',
      schemaVersion: 1,
      exportedAt: '2026-09-30T00:00:00.000Z',
      data: {
        accounts: [
          {
            id: 'acc-1',
            name: 'SBI Bank',
            type: 'BANK',
            openingBalance: 10000000,
            currency: 'INR',
            isArchived: false,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
          {
            id: 'cc-1',
            name: 'Credit Card',
            type: 'CREDIT_CARD',
            openingBalance: 0,
            creditLimit: 5000000,
            billingDay: 20,
            dueDay: 5,
            currency: 'INR',
            isArchived: false,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        ],
        people: [],
        categories: [],
        transactions: [
          {
            id: 'tx-1',
            type: 'INCOME',
            amount: 5000000,
            date: '2026-09-01',
            accountId: 'acc-1',
            createdAt: '2026-09-01',
            updatedAt: '2026-09-01',
          },
        ],
        assets: [],
        liabilities: [],
        settings: {
          theme: 'dark',
          currency: 'INR',
        },
      },
    };

    it('approves a valid Vaelth backup file structure', () => {
      const res = validateBackupData(validSampleBackup);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects null or non-object backup data', () => {
      expect(validateBackupData(null).isValid).toBe(false);
      expect(validateBackupData('not-an-object').isValid).toBe(false);
      expect(validateBackupData([]).isValid).toBe(false);
    });

    it('rejects files from other apps', () => {
      const res = validateBackupData({ ...validSampleBackup, appName: 'OtherApp' });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('not a valid Vaelth backup');
    });

    it('rejects unsupported future schema versions', () => {
      const res = validateBackupData({ ...validSampleBackup, schemaVersion: 99 });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Unsupported backup schema version');
    });

    it('rejects backups missing essential arrays', () => {
      const bad1 = { ...validSampleBackup, data: { ...validSampleBackup.data, accounts: null } };
      expect(validateBackupData(bad1).isValid).toBe(false);

      const bad2 = { ...validSampleBackup, data: { ...validSampleBackup.data, transactions: 'invalid' } };
      expect(validateBackupData(bad2).isValid).toBe(false);
    });

    it('rejects malformed optional tables and corrupt monetary records before destructive restore', () => {
      expect(validateBackupData({ ...validSampleBackup, data: { ...validSampleBackup.data, assets: undefined } }).isValid).toBe(false);
      expect(validateBackupData({ ...validSampleBackup, data: { ...validSampleBackup.data, settings: [] } }).isValid).toBe(false);
      expect(validateBackupData({ ...validSampleBackup, data: { ...validSampleBackup.data,
        transactions: [{ ...validSampleBackup.data.transactions[0], amount: '5000000' }] } }).isValid).toBe(false);
      expect(validateBackupData({ ...validSampleBackup, data: { ...validSampleBackup.data,
        accounts: [...validSampleBackup.data.accounts, validSampleBackup.data.accounts[0]] } }).isValid).toBe(false);
      expect(validateBackupData({ ...validSampleBackup, data: { ...validSampleBackup.data,
        transactions: [{ ...validSampleBackup.data.transactions[0], accountId: 'missing' }] } }).isValid).toBe(false);
    });

    it('verifies roundtrip serialization without precision loss or sensitive keys', () => {
      // JSON serialization & parsing simulation
      const serialized = JSON.stringify(validSampleBackup);
      const parsed: VaelthBackupData = JSON.parse(serialized);

      const validation = validateBackupData(parsed);
      expect(validation.isValid).toBe(true);

      // Verify credit card metadata is preserved
      const creditCard = parsed.data.accounts.find((a) => a.type === 'CREDIT_CARD');
      expect(creditCard?.creditLimit).toBe(5000000);
      expect(creditCard?.billingDay).toBe(20);
      expect(creditCard?.dueDay).toBe(5);

      // Verify monetary precision in integer paise is retained exactly
      expect(parsed.data.transactions[0].amount).toBe(5000000);

      // Verify no security keys leak into exported settings
      for (const key of Object.keys(parsed.data.settings)) {
        expect(isSecurityKey(key)).toBe(false);
      }
    });

    it('approves backups with shopping lists and shopping items', () => {
      const backupWithShopping: VaelthBackupData = {
        ...validSampleBackup,
        data: {
          ...validSampleBackup.data,
          shoppingLists: [
            {
              id: 'list-1',
              name: 'Groceries',
              isArchived: false,
              createdAt: '2026-10-01',
              updatedAt: '2026-10-01',
            },
          ],
          shoppingItems: [
            {
              id: 'item-1',
              listId: 'list-1',
              name: 'Organic Milk',
              status: 'PURCHASED',
              estimatedPrice: 7500,
              purchasePrice: 7000,
              purchaseAccountId: 'acc-1',
              transactionId: 'tx-1',
              productUrl: 'https://example.com/milk',
              note: '2 packets',
              createdAt: '2026-10-01',
              updatedAt: '2026-10-01',
              purchasedAt: '2026-10-01',
            },
          ],
        },
      };

      const res = validateBackupData(backupWithShopping);
      expect(res.isValid).toBe(true);
    });

    it('rejects backups with invalid shopping item status or missing list reference', () => {
      const invalidStatusBackup = {
        ...validSampleBackup,
        data: {
          ...validSampleBackup.data,
          shoppingLists: [
            { id: 'list-1', name: 'Needs', isArchived: false, createdAt: '2026-10-01', updatedAt: '2026-10-01' },
          ],
          shoppingItems: [
            {
              id: 'item-1',
              listId: 'list-1',
              name: 'Mouse',
              status: 'INVALID_STATUS',
              createdAt: '2026-10-01',
              updatedAt: '2026-10-01',
            },
          ],
        },
      };
      expect(validateBackupData(invalidStatusBackup).isValid).toBe(false);

      const danglingListBackup = {
        ...validSampleBackup,
        data: {
          ...validSampleBackup.data,
          shoppingLists: [
            { id: 'list-1', name: 'Needs', isArchived: false, createdAt: '2026-10-01', updatedAt: '2026-10-01' },
          ],
          shoppingItems: [
            {
              id: 'item-1',
              listId: 'non-existent-list',
              name: 'Mouse',
              status: 'PENDING',
              createdAt: '2026-10-01',
              updatedAt: '2026-10-01',
            },
          ],
        },
      };
      expect(validateBackupData(danglingListBackup).isValid).toBe(false);
    });

    it('strictly rejects unsupported account type enums like SAVINGS, WALLET, LOAN, MORTGAGE', () => {
      const unsupportedAccountBackup = {
        ...validSampleBackup,
        data: {
          ...validSampleBackup.data,
          accounts: [
            {
              id: 'acc-unsupported',
              name: 'My Savings',
              type: 'SAVINGS' as any,
              openingBalance: 100000,
              currency: 'INR',
              isArchived: false,
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
            },
          ],
        },
      };
      const res = validateBackupData(unsupportedAccountBackup);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Backup contains invalid financial records or unsupported enum types.');

      const unsupportedWalletBackup = {
        ...validSampleBackup,
        data: {
          ...validSampleBackup.data,
          accounts: [
            {
              id: 'acc-unsupported-2',
              name: 'My Wallet',
              type: 'WALLET' as any,
              openingBalance: 100000,
              currency: 'INR',
              isArchived: false,
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
            },
          ],
        },
      };
      expect(validateBackupData(unsupportedWalletBackup).isValid).toBe(false);
    });

    it('strictly rejects unsupported liability type enums like MORTGAGE and LOAN', () => {
      const unsupportedLiabilityBackup = {
        ...validSampleBackup,
        data: {
          ...validSampleBackup.data,
          liabilities: [
            {
              id: 'lib-unsupported',
              name: 'Home Loan',
              amount: 500000000,
              type: 'MORTGAGE' as any,
              isArchived: false,
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
            },
          ],
        },
      };
      const res = validateBackupData(unsupportedLiabilityBackup);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Backup contains invalid financial records or unsupported enum types.');
    });

    it('strictly rejects non-existent calendar dates like 2026-02-31', () => {
      const invalidDateBackup = {
        ...validSampleBackup,
        data: {
          ...validSampleBackup.data,
          transactions: [
            {
              id: 'tx-bad-date',
              type: 'EXPENSE',
              amount: 100000,
              date: '2026-02-31', // February 31 does not exist!
              accountId: 'acc-1',
              createdAt: '2026-02-01',
              updatedAt: '2026-02-01',
            },
          ],
        },
      };
      const res = validateBackupData(invalidDateBackup);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Backup contains invalid financial records or unsupported enum types.');
    });
  });
});
