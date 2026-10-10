import { openDatabaseAsync } from 'expo-sqlite';
import { createCard, getAllCards } from '../../src/database/repositories/cardRepository';
import { createBackupData, validateBackupData, restoreBackup, VealthBackupData } from '../../src/utils/backup';
import { createAccount } from '../../src/database/repositories/accountRepository';

const open = openDatabaseAsync as jest.Mock;

describe('Card Wallet — Backup, Privacy & Security Tests', () => {
  let db: any;
  let cardsTable: Map<string, any>;
  let accountsTable: Map<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();
    cardsTable = new Map();
    accountsTable = new Map();

    db = {
      getFirstAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM accounts WHERE id = ?')) {
          return accountsTable.get(params[0]) || null;
        }
        if (sql.includes('FROM cards WHERE id = ?')) {
          return cardsTable.get(params[0]) || null;
        }
        return null;
      }),
      getAllAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM accounts')) {
          return Array.from(accountsTable.values());
        }
        if (sql.includes('FROM cards')) {
          let list = Array.from(cardsTable.values());
          if (sql.includes('isArchived = 0')) {
            list = list.filter((c) => c.isArchived === 0);
          }
          if (sql.includes('cardType = ?')) {
            list = list.filter((c) => c.cardType === params[0]);
          }
          if (sql.includes('linkedAccountId = ?')) {
            const idx = sql.includes('cardType = ?') ? 1 : 0;
            list = list.filter((c) => c.linkedAccountId === params[idx]);
          }
          return list;
        }
        if (sql.includes('FROM settings')) {
          return [];
        }
        return [];
      }),
      runAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('INSERT INTO accounts') || sql.includes('INSERT OR REPLACE INTO accounts')) {
          const [id, name, type, openingBalance, currency] = params;
          accountsTable.set(id, {
            id,
            name,
            type,
            openingBalance,
            currency,
            isArchived: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          return { changes: 1 };
        }
        if (sql.includes('INSERT INTO cards') || sql.includes('INSERT OR REPLACE INTO cards')) {
          const [
            id,
            cardholderName,
            cardType,
            network,
            encryptedCardNumber,
            lastFour,
            expiryMonth,
            expiryYear,
            cardNickname,
            linkedAccountId,
            colorTheme,
            createdAt,
            updatedAt,
          ] = params;

          cardsTable.set(id, {
            id,
            cardholderName,
            cardType,
            network,
            encryptedCardNumber,
            lastFour,
            expiryMonth,
            expiryYear,
            cardNickname,
            linkedAccountId,
            colorTheme,
            isArchived: 0,
            createdAt,
            updatedAt,
          });
          return { changes: 1 };
        }
        if (sql.includes('DELETE FROM cards WHERE id = ?')) {
          cardsTable.delete(params[0]);
          return { changes: 1 };
        }
        if (sql.includes('DELETE FROM cards')) {
          cardsTable.clear();
          return { changes: 1 };
        }
        if (sql.includes('DELETE FROM accounts')) {
          accountsTable.clear();
          return { changes: 1 };
        }
        return { changes: 1 };
      }),
      execAsync: jest.fn(async (sql: string) => {
        if (sql.includes('DELETE FROM cards')) cardsTable.clear();
        if (sql.includes('DELETE FROM accounts')) accountsTable.clear();
      }),
      withTransactionAsync: jest.fn(async (fn: any) => fn(db)),
    };

    open.mockResolvedValue(db);
  });

  it('guarantees backup export contains encrypted cards without plaintext numbers or CVVs', async () => {
    const rawNumber = '4532015012345671'; // Valid Luhn Visa
    await createCard({
      cardholderName: 'Aarav Sharma',
      cardNumber: rawNumber,
      cardType: 'CREDIT',
      network: 'VISA',
      expiryMonth: 8,
      expiryYear: 2029,
      cardNickname: 'Personal Visa Card',
    });

    const backup = await createBackupData();
    expect(backup.data.cards).toBeDefined();
    expect(backup.data.cards?.length).toBe(1);

    const jsonBackup = JSON.stringify(backup);

    // CRITICAL: Plaintext card number MUST NOT appear anywhere in the backup JSON
    expect(jsonBackup).not.toContain(rawNumber);

    // CRITICAL: CVV/CVC must NEVER appear in backup
    expect(jsonBackup).not.toMatch(/"cvv"/i);
    expect(jsonBackup).not.toMatch(/"cvc"/i);

    // Verify backup contains encrypted representation and last 4 digits
    expect(backup.data.cards![0].lastFour).toBe('5671');
    expect(backup.data.cards![0].encryptedCardNumber).toBeDefined();
  });

  it('validates and restores cards successfully from backup', async () => {
    const bankAccount = await createAccount({
      id: 'acc-backup-bank',
      name: 'Axis Bank',
      type: 'BANK',
      openingBalance: 1000000,
      currency: 'INR',
      isArchived: false,
    });

    const card = await createCard({
      cardholderName: 'Pooja Verma',
      cardNumber: '6080123456789015', // Valid Luhn RuPay
      cardType: 'DEBIT',
      network: 'RUPAY',
      expiryMonth: 11,
      expiryYear: 2030,
      linkedAccountId: bankAccount.id,
    });

    const backup = await createBackupData();
    const validation = validateBackupData(backup);
    expect(validation.isValid).toBe(true);

    // Wipe in-memory tables
    cardsTable.clear();
    accountsTable.clear();
    expect((await getAllCards()).length).toBe(0);

    // Restore backup
    await restoreBackup(backup);

    const restoredCards = await getAllCards();
    expect(restoredCards.length).toBe(1);
    expect(restoredCards[0].id).toBe(card.id);
    expect(restoredCards[0].cardholderName).toBe('Pooja Verma');
    expect(restoredCards[0].network).toBe('RUPAY');
    expect(restoredCards[0].lastFour).toBe('9015');
    expect(restoredCards[0].linkedAccountId).toBe(bankAccount.id);
  });

  it('restores legacy backups without cards seamlessly', async () => {
    const legacyBackup: VealthBackupData = {
      appName: 'vealth',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: {
        accounts: [],
        people: [],
        categories: [],
        transactions: [],
        assets: [],
        liabilities: [],
        settings: {},
      },
    };

    const validation = validateBackupData(legacyBackup);
    expect(validation.isValid).toBe(true);

    await expect(restoreBackup(legacyBackup)).resolves.not.toThrow();
  });
});
