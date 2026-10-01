import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
let DocumentPicker: typeof import('expo-document-picker') | null = null;
try {
  DocumentPicker = require('expo-document-picker');
} catch {}
import { getDatabase, executeInTransaction } from '../database/db';
import { getAllAccounts } from '../database/repositories/accountRepository';
import { getAllPeople } from '../database/repositories/personRepository';
import { getAllCategories } from '../database/repositories/categoryRepository';
import { getAllTransactions } from '../database/repositories/transactionRepository';
import { getAllAssets } from '../database/repositories/assetRepository';
import { getAllLiabilities } from '../database/repositories/liabilityRepository';
import { getSettingsMap } from '../database/repositories/settingsRepository';
import { getAllSnapshots, NetWorthSnapshotRecord } from '../database/repositories/snapshotRepository';
import { getAllShoppingLists, getAllShoppingItems } from '../database/repositories/shoppingRepository';
import { Account, Person, Category, Transaction, Asset, Liability, ShoppingList, ShoppingItem } from '../domain/finance/types';
import { formatDateIso } from './dateUtils';

export interface VaelthBackupData {
  appName: 'Vaelth';
  schemaVersion: number;
  exportedAt: string;
  data: {
    accounts: Account[];
    people: Person[];
    categories: Category[];
    transactions: Transaction[];
    assets: Asset[];
    liabilities: Liability[];
    snapshots?: NetWorthSnapshotRecord[];
    settings: Record<string, string>;
    shoppingLists?: ShoppingList[];
    shoppingItems?: ShoppingItem[];
  };
}

export function isSecurityKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.startsWith('security_') ||
    lower.includes('pin') ||
    lower.includes('password') ||
    lower.includes('secret') ||
    lower.includes('biometric') ||
    lower.includes('token')
  );
}

export async function createBackupData(): Promise<VaelthBackupData> {
  const [
    accounts,
    people,
    categories,
    transactions,
    assets,
    liabilities,
    snapshots,
    allSettings,
    shoppingLists,
    shoppingItems,
  ] = await Promise.all([
    getAllAccounts(true),
    getAllPeople(true),
    getAllCategories(true),
    getAllTransactions({ includeDeleted: true }),
    getAllAssets(true),
    getAllLiabilities(true),
    getAllSnapshots(),
    getSettingsMap(),
    getAllShoppingLists(true),
    getAllShoppingItems(),
  ]);

  // Strip all sensitive security / PIN / auth keys from exported settings
  const sanitizedSettings: Record<string, string> = {};
  for (const [k, v] of Object.entries(allSettings)) {
    if (!isSecurityKey(k)) {
      sanitizedSettings[k] = v;
    }
  }

  return {
    appName: 'Vaelth',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: {
      accounts,
      people,
      categories,
      transactions,
      assets,
      liabilities,
      snapshots,
      settings: sanitizedSettings,
      shoppingLists,
      shoppingItems,
    },
  };
}

export async function exportBackupToFile(): Promise<string> {
  const backup = await createBackupData();
  const jsonStr = JSON.stringify(backup, null, 2);
  const dateStr = formatDateIso(new Date());
  const fileName = `vaelth_backup_${dateStr}.json`;
  const baseDir = FileSystem.documentDirectory || '';
  const cleanDir = baseDir.endsWith('/') ? baseDir : `${baseDir}/`;
  const fileUri = `${cleanDir}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, jsonStr, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Export Vaelth Backup',
      UTI: 'public.json',
    });
  }

  return fileUri;
}

const VALID_ACCOUNT_TYPES = new Set(['CASH', 'BANK', 'INVESTMENT', 'CREDIT_CARD', 'SAVINGS', 'WALLET', 'OTHER']);
const VALID_TRANSACTION_TYPES = new Set([
  'INCOME',
  'EXPENSE',
  'TRANSFER',
  'LEND',
  'BORROW',
  'REPAYMENT_RECEIVED',
  'REPAYMENT_MADE',
  'ASSET_PURCHASE',
  'ASSET_SALE',
  'OTHER',
]);
const VALID_LIABILITY_TYPES = new Set(['LOAN', 'CREDIT_CARD', 'MORTGAGE', 'OTHER']);
const VALID_CATEGORY_TYPES = new Set(['EXPENSE', 'INCOME']);
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validateBackupData(parsed: any): { isValid: boolean; error?: string } {
  if (!parsed || typeof parsed !== 'object') {
    return { isValid: false, error: 'Invalid backup file format.' };
  }
  if (parsed.appName !== 'Vaelth') {
    return { isValid: false, error: 'File is not a valid Vaelth backup.' };
  }
  if (!parsed.schemaVersion || parsed.schemaVersion > 1) {
    return { isValid: false, error: 'Unsupported backup schema version.' };
  }
  const data = parsed.data;
  if (
    !data ||
    typeof data !== 'object' ||
    !['accounts', 'people', 'categories', 'transactions', 'assets', 'liabilities'].every(
      (key) => Array.isArray(data[key])
    ) ||
    !data.settings ||
    typeof data.settings !== 'object' ||
    Array.isArray(data.settings)
  ) {
    return { isValid: false, error: 'Backup is missing core financial records.' };
  }

  const validId = (value: any) => typeof value === 'string' && value.length > 0;
  const validMoney = (value: any) => Number.isSafeInteger(value);
  const validRecord = (record: any) =>
    record &&
    typeof record === 'object' &&
    !Array.isArray(record) &&
    validId(record.id) &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string';
  const hasUniqueIds = (rows: any[]) => new Set(rows.map((row) => row.id)).size === rows.length;

  if (
    !data.accounts.every(
      (a: any) =>
        validRecord(a) &&
        validMoney(a.openingBalance) &&
        (a.creditLimit == null || validMoney(a.creditLimit)) &&
        validId(a.name) &&
        VALID_ACCOUNT_TYPES.has(a.type)
    ) ||
    !data.people.every(
      (p: any) => validRecord(p) && validId(p.name) && validId(p.avatarColor)
    ) ||
    !data.categories.every(
      (c: any) =>
        c &&
        typeof c === 'object' &&
        validId(c.id) &&
        validId(c.name) &&
        VALID_CATEGORY_TYPES.has(c.type) &&
        validId(c.icon) &&
        typeof c.createdAt === 'string'
    ) ||
    !data.assets.every(
      (a: any) =>
        validRecord(a) &&
        validId(a.name) &&
        validId(a.category) &&
        validMoney(a.currentValue) &&
        validMoney(a.purchaseValue) &&
        typeof a.purchaseDate === 'string' &&
        DATE_REGEX.test(a.purchaseDate.slice(0, 10))
    ) ||
    !data.liabilities.every(
      (l: any) =>
        validRecord(l) &&
        validId(l.name) &&
        VALID_LIABILITY_TYPES.has(l.type) &&
        validMoney(l.amount) &&
        (!l.dueDate || DATE_REGEX.test(l.dueDate.slice(0, 10)))
    ) ||
    !data.transactions.every(
      (t: any) =>
        validRecord(t) &&
        VALID_TRANSACTION_TYPES.has(t.type) &&
        validId(t.date) &&
        DATE_REGEX.test(t.date) &&
        validMoney(t.amount) &&
        t.amount > 0
    ) ||
    ![data.accounts, data.people, data.categories, data.assets, data.liabilities, data.transactions].every(
      hasUniqueIds
    ) ||
    !Object.values(data.settings).every((v) => typeof v === 'string')
  ) {
    return { isValid: false, error: 'Backup contains invalid financial records or unsupported enum types.' };
  }

  // Validate snapshots if present
  if (data.snapshots) {
    if (
      !Array.isArray(data.snapshots) ||
      !data.snapshots.every(
        (s: any) =>
          s &&
          typeof s === 'object' &&
          validId(s.id) &&
          DATE_REGEX.test(s.date) &&
          validMoney(s.netWorth) &&
          validMoney(s.totalAssets) &&
          validMoney(s.totalLiabilities)
      )
    ) {
      return { isValid: false, error: 'Backup contains corrupted net-worth snapshot records.' };
    }
  }

  // Validate transaction-specific field integrity
  for (const t of data.transactions) {
    if (t.type === 'TRANSFER') {
      if (!validId(t.accountId) || !validId(t.destinationAccountId) || t.accountId === t.destinationAccountId) {
        return { isValid: false, error: 'Transfer transaction requires distinct source and destination accounts.' };
      }
    } else if (t.type === 'EXPENSE' || t.type === 'INCOME') {
      if (!validId(t.accountId)) {
        return { isValid: false, error: `${t.type} transaction requires an account ID.` };
      }
    } else if (
      t.type === 'LEND' ||
      t.type === 'BORROW' ||
      t.type === 'REPAYMENT_RECEIVED' ||
      t.type === 'REPAYMENT_MADE'
    ) {
      if (!validId(t.personId)) {
        return { isValid: false, error: `${t.type} transaction requires a person ID.` };
      }
    } else if (t.type === 'ASSET_PURCHASE' || t.type === 'ASSET_SALE') {
      if (!validId(t.assetId)) {
        return { isValid: false, error: `${t.type} transaction requires an asset ID.` };
      }
    }
  }

  const ids = (rows: any[]) => new Set(rows.map((row) => row.id));
  const accountIds = ids(data.accounts);
  const personIds = ids(data.people);
  const categoryIds = ids(data.categories);
  const assetIds = ids(data.assets);
  const liabilityIds = ids(data.liabilities);
  const exists = (id: any, known: Set<string>) => id == null || known.has(id);
  if (
    !data.liabilities.every((l: any) => exists(l.personId, personIds)) ||
    !data.transactions.every(
      (t: any) =>
        exists(t.accountId, accountIds) &&
        exists(t.destinationAccountId, accountIds) &&
        exists(t.personId, personIds) &&
        exists(t.categoryId, categoryIds) &&
        exists(t.assetId, assetIds) &&
        exists(t.liabilityId, liabilityIds)
    )
  ) {
    return { isValid: false, error: 'Backup contains missing financial references.' };
  }
  const VALID_SHOPPING_STATUSES = new Set(['PENDING', 'PURCHASED', 'DISCARDED']);
  if (data.shoppingLists) {
    if (
      !Array.isArray(data.shoppingLists) ||
      !data.shoppingLists.every(
        (l: any) =>
          validRecord(l) &&
          validId(l.name) &&
          typeof l.isArchived === 'boolean'
      ) ||
      !hasUniqueIds(data.shoppingLists)
    ) {
      return { isValid: false, error: 'Backup contains invalid shopping list records.' };
    }
  }

  if (data.shoppingItems) {
    const listIds = data.shoppingLists ? ids(data.shoppingLists) : new Set<string>();
    if (
      !Array.isArray(data.shoppingItems) ||
      !data.shoppingItems.every(
        (i: any) =>
          validRecord(i) &&
          validId(i.listId) &&
          validId(i.name) &&
          VALID_SHOPPING_STATUSES.has(i.status) &&
          (i.estimatedPrice == null || validMoney(i.estimatedPrice)) &&
          (i.purchasePrice == null || validMoney(i.purchasePrice)) &&
          (!data.shoppingLists || listIds.has(i.listId))
      ) ||
      !hasUniqueIds(data.shoppingItems)
    ) {
      return { isValid: false, error: 'Backup contains invalid shopping item records.' };
    }
  }

  return { isValid: true };
}

export async function restoreBackup(backup: VaelthBackupData): Promise<void> {
  const validation = validateBackupData(backup);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  await executeInTransaction(async (db) => {
    // Clear existing data safely inside transaction respecting foreign keys
    await db.execAsync(`
      DELETE FROM shopping_items;
      DELETE FROM shopping_lists;
      DELETE FROM transactions;
      DELETE FROM liabilities;
      DELETE FROM assets;
      DELETE FROM people;
      DELETE FROM accounts;
      DELETE FROM categories;
      DELETE FROM net_worth_snapshots;
      DELETE FROM app_settings
      WHERE key NOT LIKE 'security_%'
        AND key NOT LIKE '%pin%'
        AND key NOT LIKE '%biometric%'
        AND key NOT LIKE '%password%'
        AND key NOT LIKE '%secret%'
        AND key NOT LIKE '%token%';
    `);

    const { accounts, people, categories, transactions, assets, liabilities, snapshots, settings } =
      backup.data;

    // 1. Restore accounts (including creditLimit, billingDay, dueDay)
    for (const a of accounts) {
      await db.runAsync(
        `INSERT INTO accounts (id, name, type, openingBalance, creditLimit, billingDay, dueDay, currency, color, icon, isArchived, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          a.id,
          a.name,
          a.type,
          Math.round(a.openingBalance ?? 0),
          a.creditLimit ? Math.round(a.creditLimit) : 0,
          a.billingDay ?? null,
          a.dueDay ?? null,
          a.currency || 'INR',
          a.color ?? null,
          a.icon ?? null,
          a.isArchived ? 1 : 0,
          a.createdAt,
          a.updatedAt,
        ]
      );
    }

    // 2. Restore people
    for (const p of people) {
      await db.runAsync(
        `INSERT INTO people (id, name, phone, email, note, avatarColor, isArchived, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          p.id,
          p.name,
          p.phone ?? null,
          p.email ?? null,
          p.note ?? null,
          p.avatarColor,
          p.isArchived ? 1 : 0,
          p.createdAt,
          p.updatedAt,
        ]
      );
    }

    // 3. Restore categories
    for (const c of categories) {
      await db.runAsync(
        `INSERT INTO categories (id, name, type, icon, color, isDefault, isArchived, monthYear, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          c.id,
          c.name,
          c.type,
          c.icon,
          c.color ?? null,
          c.isDefault ? 1 : 0,
          c.isArchived ? 1 : 0,
          c.monthYear ?? null,
          c.createdAt,
        ]
      );
    }

    // 4. Restore assets
    for (const ast of assets) {
      await db.runAsync(
        `INSERT INTO assets (id, name, category, currentValue, purchaseValue, purchaseDate, note, isArchived, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          ast.id,
          ast.name,
          ast.category,
          Math.round(ast.currentValue),
          Math.round(ast.purchaseValue),
          ast.purchaseDate,
          ast.note ?? null,
          ast.isArchived ? 1 : 0,
          ast.createdAt,
          ast.updatedAt,
        ]
      );
    }

    // 5. Restore liabilities
    for (const l of liabilities) {
      await db.runAsync(
        `INSERT INTO liabilities (id, name, amount, type, personId, dueDate, note, isArchived, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          l.id,
          l.name,
          Math.round(l.amount),
          l.type,
          l.personId ?? null,
          l.dueDate ?? null,
          l.note ?? null,
          l.isArchived ? 1 : 0,
          l.createdAt,
          l.updatedAt,
        ]
      );
    }

    // 6. Restore transactions
    for (const t of transactions) {
      await db.runAsync(
        `INSERT INTO transactions (id, type, amount, date, accountId, destinationAccountId, personId, categoryId, assetId, liabilityId, note, dueDate, metadata, createdAt, updatedAt, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          t.id,
          t.type,
          Math.round(Math.abs(t.amount)),
          t.date,
          t.accountId ?? null,
          t.destinationAccountId ?? null,
          t.personId ?? null,
          t.categoryId ?? null,
          t.assetId ?? null,
          t.liabilityId ?? null,
          t.note ?? null,
          t.dueDate ?? null,
          t.metadata ?? null,
          t.createdAt,
          t.updatedAt,
          t.deletedAt ?? null,
        ]
      );
    }

    // 7. Restore snapshots
    if (snapshots && Array.isArray(snapshots)) {
      for (const s of snapshots) {
        await db.runAsync(
          `INSERT INTO net_worth_snapshots (id, date, netWorth, totalAssets, totalLiabilities, totalReceivables, totalPayables, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            s.id,
            s.date,
            Math.round(s.netWorth),
            Math.round(s.totalAssets),
            Math.round(s.totalLiabilities),
            Math.round(s.totalReceivables ?? 0),
            Math.round(s.totalPayables ?? 0),
            s.createdAt,
          ]
        );
      }
    }

    // 8. Restore safe settings (never write security credentials into SQLite)
    if (settings) {
      for (const [k, v] of Object.entries(settings)) {
        if (!isSecurityKey(k)) {
          await db.runAsync(
            `INSERT INTO app_settings (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
            [k, v]
          );
        }
      }
    }

    // 9. Restore shopping lists
    if (backup.data.shoppingLists && Array.isArray(backup.data.shoppingLists)) {
      for (const list of backup.data.shoppingLists) {
        await db.runAsync(
          `INSERT INTO shopping_lists (id, name, isArchived, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?);`,
          [list.id, list.name, list.isArchived ? 1 : 0, list.createdAt, list.updatedAt]
        );
      }
    }

    // 10. Restore shopping items
    if (backup.data.shoppingItems && Array.isArray(backup.data.shoppingItems)) {
      for (const item of backup.data.shoppingItems) {
        await db.runAsync(
          `INSERT INTO shopping_items (
             id, listId, name, note, productUrl, estimatedPrice, status,
             createdAt, updatedAt, purchasedAt, purchasePrice, purchaseAccountId,
             transactionId, categoryId
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            item.id,
            item.listId,
            item.name,
            item.note ?? null,
            item.productUrl ?? null,
            item.estimatedPrice != null ? Math.round(item.estimatedPrice) : null,
            item.status,
            item.createdAt,
            item.updatedAt,
            item.purchasedAt ?? null,
            item.purchasePrice != null ? Math.round(item.purchasePrice) : null,
            item.purchaseAccountId ?? null,
            item.transactionId ?? null,
            item.categoryId ?? null,
          ]
        );
      }
    }
  });
}

export async function pickAndRestoreBackupFile(): Promise<{ success: boolean; message: string }> {
  try {
    if (!DocumentPicker) {
      throw new Error('Document picker module is not available in this build.');
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', '*/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false, message: 'Restore cancelled.' };
    }

    const fileAsset = result.assets[0];
    const fileContent = await FileSystem.readAsStringAsync(fileAsset.uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const parsed = JSON.parse(fileContent);
    await restoreBackup(parsed);

    return {
      success: true,
      message: `Successfully restored ${parsed.data?.transactions?.length ?? 0} transactions and ${parsed.data?.accounts?.length ?? 0} accounts.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to read or restore backup file.',
    };
  }
}
