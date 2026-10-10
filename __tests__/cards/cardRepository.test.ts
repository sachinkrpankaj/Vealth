import { openDatabaseAsync } from 'expo-sqlite';
import {
  createCard,
  getCardById,
  getAllCards,
  updateCard,
  deleteCard,
  archiveCard,
  unarchiveCard,
  revealCardNumber,
} from '../../src/database/repositories/cardRepository';
import { CREATE_TABLES_SQL } from '../../src/database/schema';
import { encryptCardNumber } from '../../src/domain/cards/cardSecurity';

const open = openDatabaseAsync as jest.Mock;

describe('Card Wallet — Database Repository & Data Isolation Tests', () => {
  let db: any;
  let cardsTable: Map<string, any>;
  let accountsTable: Map<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();
    cardsTable = new Map();
    accountsTable = new Map([
      [
        'acc-bank-1',
        {
          id: 'acc-bank-1',
          name: 'HDFC Bank',
          type: 'BANK',
          openingBalance: 1000000,
          currency: 'INR',
          isArchived: 0,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
      [
        'acc-cc-1',
        {
          id: 'acc-cc-1',
          name: 'HDFC Regalia CC',
          type: 'CREDIT_CARD',
          openingBalance: 0,
          creditLimit: 5000000,
          currency: 'INR',
          isArchived: 0,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
    ]);

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
        if (sql.includes('foreign_key_list')) {
          return [{ table: 'assets' }, { table: 'liabilities' }];
        }
        if (sql.includes('count FROM categories')) {
          return [{ count: 1 }];
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
        return [];
      }),
      runAsync: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('INSERT INTO cards')) {
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
            issuer,
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
            issuer,
            isArchived: 0,
            createdAt,
            updatedAt,
          });
          return { changes: 1 };
        }

        if (sql.includes('UPDATE cards SET')) {
          if (sql.includes('isArchived = 1')) {
            const id = params[1];
            const c = cardsTable.get(id);
            if (c) c.isArchived = 1;
          } else if (sql.includes('isArchived = 0')) {
            const id = params[1];
            const c = cardsTable.get(id);
            if (c) c.isArchived = 0;
          } else {
            // Full update
            const id = params[12];
            const c = cardsTable.get(id);
            if (c) {
              c.cardholderName = params[0];
              c.cardType = params[1];
              c.network = params[2];
              c.encryptedCardNumber = params[3];
              c.lastFour = params[4];
              c.expiryMonth = params[5];
              c.expiryYear = params[6];
              c.cardNickname = params[7];
              c.issuer = params[8];
              c.linkedAccountId = params[9];
              c.colorTheme = params[10];
              c.updatedAt = params[11];
            }
          }
          return { changes: 1 };
        }

        if (sql.includes('DELETE FROM cards WHERE id = ?')) {
          cardsTable.delete(params[0]);
          return { changes: 1 };
        }

        return { changes: 1 };
      }),
      execAsync: jest.fn(),
      withTransactionAsync: jest.fn(async (fn: any) => fn(db)),
    };

    open.mockResolvedValue(db);
  });

  it('guarantees that CVV column DOES NOT EXIST in CREATE_TABLES_SQL', () => {
    // Inspect CREATE_TABLES_SQL schema definition for cards
    const cardsSection = CREATE_TABLES_SQL.slice(CREATE_TABLES_SQL.indexOf('CREATE TABLE IF NOT EXISTS cards'));
    const cardsDefinition = cardsSection.slice(0, cardsSection.indexOf(');') + 2);

    expect(cardsDefinition).toContain('encryptedCardNumber TEXT NOT NULL');
    expect(cardsDefinition).toContain('lastFour TEXT NOT NULL');
    expect(cardsDefinition).toContain('cardholderName TEXT NOT NULL');

    // CRITICAL SECURITY ASSERTION: No CVV column
    expect(cardsDefinition.toLowerCase()).not.toContain('cvv');
    expect(cardsDefinition.toLowerCase()).not.toContain('cvc');
    expect(cardsDefinition.toLowerCase()).not.toContain('securitycode');
  });

  it('never stores full card numbers in plaintext in the database table', async () => {
    const rawNumber = '4532015012345671'; // Valid Luhn
    const card = await createCard({
      cardholderName: 'Aarav Sharma',
      cardNumber: rawNumber,
      cardType: 'CREDIT',
      network: 'VISA',
      expiryMonth: 8,
      expiryYear: 2029,
    });

    const stored = cardsTable.get(card.id);
    expect(stored).toBeDefined();
    expect(stored.lastFour).toBe('5671');
    expect(stored.encryptedCardNumber).not.toBe(rawNumber);
    expect(stored.encryptedCardNumber).not.toContain(rawNumber);
  });

  it('supports creating Debit Cards linked to Bank accounts and multiple cards per account', async () => {
    // First debit card
    const debit1 = await createCard({
      cardholderName: 'Aarav Sharma',
      cardNumber: '6080123456789015', // Valid Luhn RuPay
      cardType: 'DEBIT',
      network: 'RUPAY',
      expiryMonth: 10,
      expiryYear: 2028,
      linkedAccountId: 'acc-bank-1',
    });

    // Second debit card linked to SAME bank account
    const debit2 = await createCard({
      cardholderName: 'Aarav Sharma',
      cardNumber: '4532015012345671', // Valid Luhn Visa
      cardType: 'DEBIT',
      network: 'VISA',
      expiryMonth: 12,
      expiryYear: 2029,
      linkedAccountId: 'acc-bank-1',
    });

    expect(debit1.linkedAccountId).toBe('acc-bank-1');
    expect(debit2.linkedAccountId).toBe('acc-bank-1');

    const bankCards = await getAllCards({ linkedAccountId: 'acc-bank-1' });
    expect(bankCards.length).toBe(2);
  });

  it('allows editing all fields without creating duplicate cards', async () => {
    const card = await createCard({
      cardholderName: 'Initial Name',
      cardNumber: '4532015012345671',
      cardType: 'CREDIT',
      network: 'VISA',
      expiryMonth: 6,
      expiryYear: 2027,
    });

    expect(cardsTable.size).toBe(1);

    const updated = await updateCard(card.id, {
      cardholderName: 'Updated Name',
      network: 'MASTERCARD',
      expiryMonth: 9,
      expiryYear: 2031,
      cardNickname: 'Renamed Card',
      colorTheme: 'sapphire',
      issuer: 'HDFC Bank',
    });

    expect(updated.id).toBe(card.id);
    expect(updated.cardholderName).toBe('Updated Name');
    expect(updated.network).toBe('MASTERCARD');
    expect(updated.expiryMonth).toBe(9);
    expect(updated.colorTheme).toBe('sapphire');
    expect(updated.issuer).toBe('HDFC Bank');

    // VERIFY NO DUPLICATES
    expect(cardsTable.size).toBe(1);
  });

  it('correctly creates and updates bank / card issuer', async () => {
    const card = await createCard({
      cardholderName: 'Aditi Verma',
      cardNumber: '4532015012345671',
      cardType: 'CREDIT',
      network: 'VISA',
      expiryMonth: 10,
      expiryYear: 2028,
      issuer: 'ICICI Bank',
    });

    expect(card.issuer).toBe('ICICI Bank');
    const stored = await getCardById(card.id);
    expect(stored?.issuer).toBe('ICICI Bank');

    const edited = await updateCard(card.id, {
      issuer: 'Axis Bank',
    });
    expect(edited.issuer).toBe('Axis Bank');
    const refetched = await getCardById(card.id);
    expect(refetched?.issuer).toBe('Axis Bank');
  });

  it('decrypts and reveals card number only via revealCardNumber', async () => {
    const rawNumber = '4532015012345671';
    const card = await createCard({
      cardholderName: 'Aarav Sharma',
      cardNumber: rawNumber,
      cardType: 'CREDIT',
      network: 'VISA',
      expiryMonth: 8,
      expiryYear: 2029,
    });

    const revealed = await revealCardNumber(card);
    expect(revealed).toBe(rawNumber);
  });

  it('archives, unarchives, and permanently deletes cards', async () => {
    const card = await createCard({
      cardholderName: 'Aarav Sharma',
      cardNumber: '4532015012345671',
      cardType: 'CREDIT',
      network: 'VISA',
      expiryMonth: 8,
      expiryYear: 2029,
    });

    await archiveCard(card.id);
    expect(cardsTable.get(card.id)?.isArchived).toBe(1);

    await unarchiveCard(card.id);
    expect(cardsTable.get(card.id)?.isArchived).toBe(0);

    await deleteCard(card.id);
    expect(cardsTable.has(card.id)).toBe(false);
  });
});
