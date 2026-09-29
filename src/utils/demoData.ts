import { executeInTransaction } from '../database/db';
import { rupeeToMinor } from '../domain/finance/currency';

export async function seedDemoData(): Promise<void> {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const d1 = new Date(now);
  d1.setDate(d1.getDate() - 10);
  const d1Str = d1.toISOString().split('T')[0];

  const d2 = new Date(now);
  d2.setDate(d2.getDate() - 5);
  const d2Str = d2.toISOString().split('T')[0];

  const d3 = new Date(now);
  d3.setDate(d3.getDate() - 2);
  const d3Str = d3.toISOString().split('T')[0];

  const dueRahul = new Date(now);
  dueRahul.setDate(dueRahul.getDate() + 4);
  const dueRahulStr = dueRahul.toISOString().split('T')[0];

  const dueAmit = new Date(now);
  dueAmit.setDate(dueAmit.getDate() + 10);
  const dueAmitStr = dueAmit.toISOString().split('T')[0];

  await executeInTransaction(async (db) => {
    // 1. Accounts: Cash (₹5,000), Bank (₹40,000), Investment (₹15,000)
    await db.runAsync(
      `INSERT OR REPLACE INTO accounts (id, name, type, openingBalance, currency, color, isArchived, createdAt, updatedAt)
       VALUES
       ('acc-demo-cash', 'Cash in Hand', 'CASH', ?, 'INR', '#10B981', 0, ?, ?),
       ('acc-demo-bank', 'HDFC Bank', 'BANK', ?, 'INR', '#3B82F6', 0, ?, ?),
       ('acc-demo-invest', 'Groww Mutual Funds', 'INVESTMENT', ?, 'INR', '#8B5CF6', 0, ?, ?);`,
      [
        rupeeToMinor(5000),
        d1.toISOString(),
        d1.toISOString(),
        rupeeToMinor(40000),
        d1.toISOString(),
        d1.toISOString(),
        rupeeToMinor(15000),
        d1.toISOString(),
        d1.toISOString(),
      ]
    );

    // 2. People: Rahul (owes ₹3,000), Amit (user owes ₹2,000)
    await db.runAsync(
      `INSERT OR REPLACE INTO people (id, name, phone, email, avatarColor, isArchived, createdAt, updatedAt)
       VALUES
       ('person-demo-rahul', 'Rahul Sharma', '+91 9876543210', 'rahul@example.com', '#10B981', 0, ?, ?),
       ('person-demo-amit', 'Amit Verma', '+91 9123456780', 'amit@example.com', '#6366F1', 0, ?, ?);`,
      [d1.toISOString(), d1.toISOString(), d1.toISOString(), d1.toISOString()]
    );

    // 3. Transactions:
    // - Lend Rahul ₹5,000 on d1
    // - Rahul repays ₹2,000 on d2 -> Remaining: Rahul owes ₹3,000
    // - Borrow ₹3,000 from Amit on d1
    // - Repay Amit ₹1,000 on d3 -> Remaining: user owes Amit ₹2,000
    // - Expenses: ₹500 (Food), ₹1,200 (Shopping), ₹300 (Transport)
    await db.runAsync(
      `INSERT OR REPLACE INTO transactions (id, type, amount, date, accountId, personId, categoryId, note, dueDate, createdAt, updatedAt)
       VALUES
       ('tx-demo-lend-rahul', 'LEND', ?, ?, 'acc-demo-bank', 'person-demo-rahul', NULL, 'Emergency loan for phone repair', ?, ?, ?),
       ('tx-demo-repay-rahul', 'REPAYMENT_RECEIVED', ?, ?, 'acc-demo-bank', 'person-demo-rahul', NULL, 'Partial repayment via UPI', NULL, ?, ?),
       ('tx-demo-borrow-amit', 'BORROW', ?, ?, 'acc-demo-cash', 'person-demo-amit', NULL, 'Advance for project purchase', ?, ?, ?),
       ('tx-demo-repay-amit', 'REPAYMENT_MADE', ?, ?, 'acc-demo-cash', 'person-demo-amit', NULL, 'Repaid part of cash', NULL, ?, ?),
       ('tx-demo-exp-1', 'EXPENSE', ?, ?, 'acc-demo-cash', NULL, 'cat-food', 'Dinner with team', NULL, ?, ?),
       ('tx-demo-exp-2', 'EXPENSE', ?, ?, 'acc-demo-bank', NULL, 'cat-shopping', 'Weekend groceries', NULL, ?, ?),
       ('tx-demo-exp-3', 'EXPENSE', ?, ?, 'acc-demo-cash', NULL, 'cat-transport', 'Cab ride', NULL, ?, ?);`,
      [
        rupeeToMinor(5000), d1Str, dueRahulStr, d1.toISOString(), d1.toISOString(),
        rupeeToMinor(2000), d2Str, d2.toISOString(), d2.toISOString(),
        rupeeToMinor(3000), d1Str, dueAmitStr, d1.toISOString(), d1.toISOString(),
        rupeeToMinor(1000), d3Str, d3.toISOString(), d3.toISOString(),
        rupeeToMinor(500), d2Str, d2.toISOString(), d2.toISOString(),
        rupeeToMinor(1200), d3Str, d3.toISOString(), d3.toISOString(),
        rupeeToMinor(300), todayStr, now.toISOString(), now.toISOString(),
      ]
    );

    // 4. Physical Asset: Gold (₹25,000)
    await db.runAsync(
      `INSERT OR REPLACE INTO assets (id, name, category, currentValue, purchaseValue, purchaseDate, note, isArchived, createdAt, updatedAt)
       VALUES ('asset-demo-gold', 'Gold Sovereign Coin', 'GOLD', ?, ?, ?, 'Family heirloom 8g', 0, ?, ?);`,
      [rupeeToMinor(25000), rupeeToMinor(22000), d1Str, d1.toISOString(), d1.toISOString()]
    );

    // 5. Mark onboarding completed
    await db.runAsync(
      `INSERT OR REPLACE INTO app_settings (key, value) VALUES ('onboarding_completed', 'true');`
    );
  });
}

export async function resetAllData(): Promise<void> {
  await executeInTransaction(async (db) => {
    await db.execAsync(`
      DELETE FROM transactions;
      DELETE FROM liabilities;
      DELETE FROM assets;
      DELETE FROM people;
      DELETE FROM accounts;
      DELETE FROM net_worth_snapshots;
    `);
  });
}
