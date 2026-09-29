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
import { Account, Person, Category, Transaction, Asset, Liability } from '../domain/finance/types';

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
    settings: Record<string, string>;
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
  const [accounts, people, categories, transactions, assets, liabilities, allSettings] =
    await Promise.all([
      getAllAccounts(true),
      getAllPeople(true),
      getAllCategories(),
      getAllTransactions({ includeDeleted: true }),
      getAllAssets(true),
      getAllLiabilities(true),
      getSettingsMap(),
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
      settings: sanitizedSettings,
    },
  };
}

export async function exportBackupToFile(): Promise<string> {
  const backup = await createBackupData();
  const jsonStr = JSON.stringify(backup, null, 2);
  const fileName = `vaelth_backup_${new Date().toISOString().split('T')[0]}.json`;
  const fileUri = `${FileSystem.documentDirectory || ''}${fileName}`;

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
  if (!parsed.data || !Array.isArray(parsed.data.accounts) || !Array.isArray(parsed.data.transactions)) {
    return { isValid: false, error: 'Backup is missing core financial records.' };
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
      DELETE FROM transactions;
      DELETE FROM liabilities;
      DELETE FROM assets;
      DELETE FROM people;
      DELETE FROM accounts;
      DELETE FROM categories;
      DELETE FROM net_worth_snapshots;
    `);

    const { accounts, people, categories, transactions, assets, liabilities, settings } =
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
        `INSERT INTO categories (id, name, type, icon, isDefault, createdAt)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [c.id, c.name, c.type, c.icon, c.isDefault ? 1 : 0, c.createdAt]
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
        `INSERT INTO transactions (id, type, amount, date, accountId, destinationAccountId, personId, categoryId, assetId, liabilityId, note, dueDate, createdAt, updatedAt, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
          t.createdAt,
          t.updatedAt,
          t.deletedAt ?? null,
        ]
      );
    }

    // 7. Restore safe settings (never write security credentials into SQLite)
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
