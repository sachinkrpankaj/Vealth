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
import {
  ACCOUNT_TYPES,
  ASSET_CATEGORIES,
  ASSET_VALUATION_SOURCES,
  CATEGORY_TYPES,
  LIABILITY_TYPES,
  LIABILITY_VALUATION_SOURCES,
  SHOPPING_ITEM_STATUSES,
  TRANSACTION_TYPES,
  Account,
  Person,
  Category,
  Transaction,
  Asset,
  Liability,
  ShoppingList,
  ShoppingItem,
} from '../domain/finance/types';
import { SavedCard } from '../domain/cards/types';
import {
  createCardKeyEnvelope,
  restoreCardKeyFromEnvelope,
  CardKeyEnvelope,
  encryptCardNumber,
  decryptCardNumber,
  getMasterEncryptionKeyHex,
} from '../domain/cards/cardSecurity';
import { getAllCards } from '../database/repositories/cardRepository';
import { formatDateIso, parseLocalDate } from './dateUtils';
import { generateEntityId } from './idGenerator';

export interface VealthBackupData {
  appName: 'vealth' | 'Vealth' | 'Vaelth';
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
    cards?: SavedCard[];
    cardKeyEnvelope?: CardKeyEnvelope;
  };
}

export type VaelthBackupData = VealthBackupData;

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

export async function createBackupData(
  options?: string | {
    cardBackupPassphrase?: string;
  }
): Promise<VealthBackupData> {
  const passphrase = typeof options === 'string' ? options : options?.cardBackupPassphrase;
  const accounts = await getAllAccounts(true);
  const people = await getAllPeople(true);
  const categories = await getAllCategories(true);
  const transactions = await getAllTransactions({ includeDeleted: true });
  const assets = await getAllAssets(true);
  const liabilities = await getAllLiabilities(true);
  const snapshots = await getAllSnapshots();
  const allSettings = await getSettingsMap();
  const shoppingLists = await getAllShoppingLists(true);
  const shoppingItems = await getAllShoppingItems();
  const cards = await getAllCards({ includeArchived: true });

  // Strip all sensitive security / PIN / auth keys from exported settings
  const sanitizedSettings: Record<string, string> = {};
  for (const [k, v] of Object.entries(allSettings)) {
    if (!isSecurityKey(k)) {
      sanitizedSettings[k] = v;
    }
  }

  let cardKeyEnvelope: CardKeyEnvelope | undefined = undefined;
  if (cards.length > 0) {
    if (!passphrase || !passphrase.trim()) {
      throw new Error(
        'A backup passphrase is required to export encrypted Card Wallet records.'
      );
    }
    try {
      cardKeyEnvelope = await createCardKeyEnvelope(passphrase.trim());
    } catch (err: any) {
      throw new Error(
        `Failed to create secure Card Wallet backup envelope: ${err?.message || 'crypto error'}`
      );
    }
  }

  return {
    appName: 'vealth',
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
      cards,
      cardKeyEnvelope,
    },
  };
}

export async function exportBackupToFile(options?: {
  cardBackupPassphrase?: string;
}): Promise<string> {
  const backup = await createBackupData(options);
  const jsonStr = JSON.stringify(backup, null, 2);
  const dateStr = formatDateIso(new Date());
  const fileName = `vealth_backup_${dateStr}.json`;
  const baseDir = FileSystem.documentDirectory || '';
  const cleanDir = baseDir.endsWith('/') ? baseDir : `${baseDir}/`;
  const fileUri = `${cleanDir}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, jsonStr, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Export vealth Backup',
      UTI: 'public.json',
    });
  }

  return fileUri;
}

const VALID_ACCOUNT_TYPES = new Set(ACCOUNT_TYPES);
const VALID_TRANSACTION_TYPES = new Set(TRANSACTION_TYPES);
const VALID_LIABILITY_TYPES = new Set(LIABILITY_TYPES);
const VALID_ASSET_CATEGORIES = new Set(ASSET_CATEGORIES);
const VALID_CATEGORY_TYPES = new Set(CATEGORY_TYPES);

function isValidCalendarDate(dateStr: any, allowDateTime = false): boolean {
  if (typeof dateStr !== 'string') return false;
  const dateOnly = allowDateTime ? dateStr.slice(0, 10) : dateStr;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return false;
  if (
    allowDateTime &&
    dateStr !== dateOnly &&
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/i.test(dateStr)
  ) {
    return false;
  }
  const parsed = parseLocalDate(dateOnly);
  if (!parsed) return false;
  return formatDateIso(parsed) === dateOnly && (dateStr === dateOnly || Number.isFinite(Date.parse(dateStr)));
}

function shoppingItemIdFromMetadata(metadata: unknown): string | null {
  if (typeof metadata !== 'string') return null;
  try {
    const parsed = JSON.parse(metadata);
    return typeof parsed?.shoppingItemId === 'string' ? parsed.shoppingItemId : null;
  } catch {
    return null;
  }
}

export function validateBackupData(parsed: any): { isValid: boolean; error?: string } {
  if (!parsed || typeof parsed !== 'object') {
    return { isValid: false, error: 'Invalid backup file format.' };
  }
  if (parsed.appName !== 'vealth' && parsed.appName !== 'Vealth' && parsed.appName !== 'Vaelth') {
    return { isValid: false, error: 'File is not a valid vealth backup.' };
  }
  if (parsed.schemaVersion !== 1) {
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
  const validMoney = (value: any) => typeof value === 'number' && Number.isSafeInteger(value) && !isNaN(value);
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
        (a.creditLimit == null || (validMoney(a.creditLimit) && a.creditLimit >= 0)) &&
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
        VALID_ASSET_CATEGORIES.has(a.category) &&
        validMoney(a.currentValue) &&
        a.currentValue >= 0 &&
        validMoney(a.purchaseValue) &&
        a.purchaseValue >= 0 &&
        isValidCalendarDate(a.purchaseDate) &&
        (a.valuationHistory == null ||
          (Array.isArray(a.valuationHistory) &&
            a.valuationHistory.every((v: any) =>
              v && isValidCalendarDate(v.effectiveDate) && validMoney(v.value) && v.value >= 0 &&
              (ASSET_VALUATION_SOURCES as readonly string[]).includes(v.source) &&
              (v.createdAt == null || typeof v.createdAt === 'string')
            ))) &&
        (a.archiveHistory == null ||
          (Array.isArray(a.archiveHistory) &&
            a.archiveHistory.every((v: any) =>
              v && isValidCalendarDate(v.effectiveDate) && typeof v.isArchived === 'boolean' &&
              (v.createdAt == null || typeof v.createdAt === 'string')
            )))
    ) ||
    !data.liabilities.every(
      (l: any) =>
        validRecord(l) &&
        validId(l.name) &&
        VALID_LIABILITY_TYPES.has(l.type) &&
        (l.accountId == null || (typeof l.accountId === 'string' && l.accountId.length > 0)) &&
        validMoney(l.amount) &&
        l.amount >= 0 &&
        (!l.dueDate || isValidCalendarDate(l.dueDate)) &&
        (l.amountHistory == null ||
          (Array.isArray(l.amountHistory) &&
            l.amountHistory.every((v: any) =>
              v && isValidCalendarDate(v.effectiveDate) && validMoney(v.amount) && v.amount >= 0 &&
              (LIABILITY_VALUATION_SOURCES as readonly string[]).includes(v.source) &&
              (v.createdAt == null || typeof v.createdAt === 'string')
            ))) &&
        (l.archiveHistory == null ||
          (Array.isArray(l.archiveHistory) &&
            l.archiveHistory.every((v: any) =>
              v && isValidCalendarDate(v.effectiveDate) && typeof v.isArchived === 'boolean' &&
              (v.createdAt == null || typeof v.createdAt === 'string')
            )))
    ) ||
    !data.transactions.every(
      (t: any) =>
        validRecord(t) &&
        VALID_TRANSACTION_TYPES.has(t.type) &&
        validId(t.date) &&
        isValidCalendarDate(t.date) &&
        validMoney(t.amount) &&
        t.amount > 0 &&
        (!t.dueDate || isValidCalendarDate(t.dueDate))
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
          isValidCalendarDate(s.date) &&
          validMoney(s.netWorth) &&
          validMoney(s.totalAssets) &&
          validMoney(s.totalLiabilities)
      ) ||
      !hasUniqueIds(data.snapshots)
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
      const source = data.accounts.find((account: any) => account.id === t.accountId);
      const destination = data.accounts.find((account: any) => account.id === t.destinationAccountId);
      if (source?.type === 'CREDIT_CARD' ||
          (destination?.type === 'CREDIT_CARD' && ['CASH', 'INVESTMENT'].includes(source?.type))) {
        return { isValid: false, error: 'Backup contains an invalid credit-card transfer.' };
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
      if (!validId(t.accountId) || !validId(t.personId)) {
        return { isValid: false, error: `${t.type} transaction requires a person ID.` };
      }
    } else if (t.type === 'ASSET_PURCHASE' || t.type === 'ASSET_SALE') {
      if (!validId(t.accountId) || !validId(t.assetId)) {
        return { isValid: false, error: `${t.type} transaction requires an asset ID.` };
      }
    }
    if (
      (t.type !== 'TRANSFER' && t.destinationAccountId) ||
      (!['LEND', 'BORROW', 'REPAYMENT_RECEIVED', 'REPAYMENT_MADE'].includes(t.type) && t.personId) ||
      (!['ASSET_PURCHASE', 'ASSET_SALE'].includes(t.type) && t.assetId) ||
      (!['INCOME', 'EXPENSE'].includes(t.type) && t.categoryId)
    ) {
      return { isValid: false, error: 'Transaction contains fields that do not match its type.' };
    }
  }

  const ids = (rows: any[]) => new Set(rows.map((row) => row.id));
  const accountIds = ids(data.accounts);
  const personIds = ids(data.people);
  const categoryIds = ids(data.categories);
  const assetIds = ids(data.assets);
  const liabilityIds = ids(data.liabilities);
  const transactionIds = ids(data.transactions);
  const exists = (id: any, known: Set<string>) => id == null || known.has(id);

  if (
    !data.liabilities.every((l: any) => exists(l.personId, personIds) && exists(l.accountId, accountIds)) ||
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

  const categoriesById = new Map<string, any>(data.categories.map((category: any) => [category.id, category]));
  for (const tx of data.transactions) {
    if (!tx.categoryId) continue;
    const expectedType = tx.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    if (categoriesById.get(tx.categoryId)?.type !== expectedType) {
      return { isValid: false, error: 'Backup contains a category whose type does not match its transaction.' };
    }
  }

  const VALID_SHOPPING_STATUSES = new Set(SHOPPING_ITEM_STATUSES);
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
          (i.estimatedPrice == null || (validMoney(i.estimatedPrice) && i.estimatedPrice > 0)) &&
          (!data.shoppingLists ? !data.shoppingItems?.length : listIds.has(i.listId)) &&
          (i.status !== 'PURCHASED' ||
            (validMoney(i.purchasePrice) &&
              i.purchasePrice > 0 &&
              isValidCalendarDate(i.purchasedAt, true) &&
              validId(i.transactionId) &&
              transactionIds.has(i.transactionId) &&
              validId(i.purchaseAccountId) && accountIds.has(i.purchaseAccountId) &&
              exists(i.categoryId, categoryIds)))
          && (i.status === 'PURCHASED' || (
            i.transactionId == null && i.purchasedAt == null && i.purchasePrice == null &&
            i.purchaseAccountId == null && i.categoryId == null
          ))
      ) ||
      !hasUniqueIds(data.shoppingItems)
    ) {
      return { isValid: false, error: 'Backup contains invalid shopping item records or broken references.' };
    }
  }

  const shoppingItemsById = new Map<string, any>(
    (data.shoppingItems || []).map((item: any) => [item.id, item])
  );
  const transactionsById = new Map<string, any>(data.transactions.map((tx: any) => [tx.id, tx]));
  const activeShoppingReferences = new Map<string, number>();
  for (const item of data.shoppingItems || []) {
    if (item.status !== 'PURCHASED') continue;
    const tx = transactionsById.get(item.transactionId);
    const purchasedDate = typeof item.purchasedAt === 'string' ? item.purchasedAt.slice(0, 10) : '';
    if (
      !tx || tx.deletedAt || tx.type !== 'EXPENSE' ||
      shoppingItemIdFromMetadata(tx.metadata) !== item.id ||
      tx.amount !== item.purchasePrice || tx.date !== purchasedDate ||
      tx.accountId !== item.purchaseAccountId || tx.categoryId != (item.categoryId ?? null) ||
      (item.categoryId && categoriesById.get(item.categoryId)?.type !== 'EXPENSE')
    ) {
      return { isValid: false, error: 'Backup contains mismatched shopping purchases and transactions.' };
    }
  }

  for (const tx of data.transactions) {
    if (tx.deletedAt) continue;
    const shoppingItemId = shoppingItemIdFromMetadata(tx.metadata);
    if (!shoppingItemId) continue;
    activeShoppingReferences.set(
      shoppingItemId,
      (activeShoppingReferences.get(shoppingItemId) || 0) + 1
    );
    const item = shoppingItemsById.get(shoppingItemId);
    if (
      !item || item.status !== 'PURCHASED' || item.transactionId !== tx.id ||
      tx.type !== 'EXPENSE' || tx.amount !== item.purchasePrice ||
      tx.date !== String(item.purchasedAt || '').slice(0, 10) ||
      tx.accountId !== item.purchaseAccountId || tx.categoryId != (item.categoryId ?? null)
    ) {
      return { isValid: false, error: 'Backup contains a dangling or mismatched shopping transaction.' };
    }
  }
  if (Array.from(activeShoppingReferences.values()).some((count) => count !== 1)) {
    return { isValid: false, error: 'Backup contains shopping items with multiple active transactions.' };
  }

  const VALID_PAYMENT_NETWORKS = new Set([
    'VISA',
    'MASTERCARD',
    'RUPAY',
    'AMEX',
    'DISCOVER',
    'DINERS',
    'JCB',
    'OTHER',
  ]);

  // Validate cards if present
  if (data.cards) {
    const accountsById = new Map<string, any>(data.accounts.map((a: any) => [a.id, a]));
    if (
      !Array.isArray(data.cards) ||
      !data.cards.every((c: any) => {
        if (
          !validRecord(c) ||
          !validId(c.cardholderName) ||
          (c.cardType !== 'CREDIT' && c.cardType !== 'DEBIT') ||
          !VALID_PAYMENT_NETWORKS.has(c.network) ||
          typeof c.encryptedCardNumber !== 'string' ||
          !(
            c.encryptedCardNumber.startsWith('aes-gcm:v1:') ||
            c.encryptedCardNumber.startsWith('fallback:v1:')
          ) ||
          typeof c.lastFour !== 'string' ||
          !/^\d{4}$/.test(c.lastFour) ||
          typeof c.expiryMonth !== 'number' ||
          c.expiryMonth < 1 ||
          c.expiryMonth > 12 ||
          typeof c.expiryYear !== 'number' ||
          c.expiryYear < 2000 ||
          c.expiryYear > 2100
        ) {
          return false;
        }

        // Validate linked account compatibility
        if (c.linkedAccountId != null) {
          const linkedAcc = accountsById.get(c.linkedAccountId);
          if (!linkedAcc) return false;
          if (c.cardType === 'DEBIT' && linkedAcc.type !== 'BANK') return false;
          if (c.cardType === 'CREDIT' && linkedAcc.type !== 'CREDIT_CARD') return false;
        } else if (c.cardType === 'DEBIT') {
          // Debit card must be linked to a Bank account
          return false;
        }

        // Validate credit card issuer
        if (c.cardType === 'CREDIT') {
          const hasIssuer = typeof c.issuer === 'string' && c.issuer.trim().length > 0;
          const hasLinkedAccName =
            c.linkedAccountId != null && Boolean(accountsById.get(c.linkedAccountId)?.name);
          if (!hasIssuer && !hasLinkedAccName) return false;
        }

        return true;
      }) ||
      !hasUniqueIds(data.cards)
    ) {
      return { isValid: false, error: 'Backup contains invalid or corrupted card wallet records.' };
    }

    if (data.cards.length > 0) {
      if (!data.cardKeyEnvelope || typeof data.cardKeyEnvelope !== 'object') {
        return {
          isValid: false,
          error: 'Backup contains encrypted cards but is missing the required card key envelope in card wallet records.',
        };
      }
      const envelopeValidation = validateCardKeyEnvelope(data.cardKeyEnvelope);
      if (!envelopeValidation.isValid) {
        return envelopeValidation;
      }
    }
  }

  return { isValid: true };
}

export function validateCardKeyEnvelope(env: any): { isValid: boolean; error?: string } {
  if (!env || typeof env !== 'object') {
    return {
      isValid: false,
      error: 'Card key envelope is missing or invalid in card wallet records.',
    };
  }
  if (
    env.algorithm !== 'AES-GCM-256' ||
    env.kdf !== 'PBKDF2-SHA256' ||
    typeof env.iterations !== 'number' ||
    env.iterations < 10000 ||
    env.iterations > 1000000 ||
    typeof env.saltHex !== 'string' ||
    env.saltHex.length !== 32 ||
    !/^[0-9a-f]{32}$/i.test(env.saltHex) ||
    typeof env.ivHex !== 'string' ||
    env.ivHex.length !== 24 ||
    !/^[0-9a-f]{24}$/i.test(env.ivHex) ||
    typeof env.ciphertextHex !== 'string' ||
    env.ciphertextHex.length < 32 ||
    !/^[0-9a-f]+$/i.test(env.ciphertextHex)
  ) {
    return {
      isValid: false,
      error: 'Backup contains an invalid, tampered, or unsupported card key envelope in card wallet records.',
    };
  }
  return { isValid: true };
}

export async function restoreBackup(
  backup: VaelthBackupData,
  options?: { cardBackupPassphrase?: string }
): Promise<void> {
  const validation = validateBackupData(backup);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  let preparedCards: SavedCard[] | undefined = undefined;

  // If backup contains cards, unwrap incoming key, decrypt incoming cards, and re-encrypt with local device master key
  if (backup.data.cards && backup.data.cards.length > 0) {
    if (!backup.data.cardKeyEnvelope) {
      throw new Error('Backup contains cards but lacks required key envelope.');
    }
    if (!options?.cardBackupPassphrase || !options.cardBackupPassphrase.trim()) {
      throw new Error('A backup passphrase is required to restore encrypted Card Wallet records.');
    }

    // 1. Unwrap incoming backup master key
    const incomingMasterKeyHex = await restoreCardKeyFromEnvelope(
      backup.data.cardKeyEnvelope,
      options.cardBackupPassphrase.trim()
    );

    // 2. Retrieve destination device's existing master key (never overwrite destination master key!)
    const localMasterKeyHex = await getMasterEncryptionKeyHex();

    // 3. Staging: Decrypt with incoming backup key, re-encrypt with local destination key
    preparedCards = [];
    for (const card of backup.data.cards) {
      const plainCardNum = await decryptCardNumber(card.encryptedCardNumber, incomingMasterKeyHex);
      const localCiphertext = await encryptCardNumber(plainCardNum, localMasterKeyHex);
      preparedCards.push({
        ...card,
        encryptedCardNumber: localCiphertext,
      });
    }
  }

  await executeInTransaction(async (db) => {
    // Only delete feature records if the backup explicitly contains them!
    // Restoring a legacy backup without cards or shopping must NOT delete current data.
    const hasShopping =
      backup.data.shoppingLists !== undefined || backup.data.shoppingItems !== undefined;
    const hasCards = backup.data.cards !== undefined;

    if (hasShopping) {
      await db.execAsync('DELETE FROM shopping_items; DELETE FROM shopping_lists;');
    }
    if (hasCards) {
      await db.execAsync('DELETE FROM cards;');
    }

    // Clear core data safely inside transaction respecting foreign keys
    await db.execAsync(`
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
      const valuations = ast.valuationHistory?.length
        ? ast.valuationHistory
        : [
            { effectiveDate: ast.purchaseDate, value: ast.purchaseValue, source: 'PURCHASE' as const, createdAt: ast.createdAt },
            { effectiveDate: ast.updatedAt.slice(0, 10), value: ast.currentValue, source: 'LEGACY_BASELINE' as const, createdAt: ast.updatedAt },
          ];
      for (const valuation of valuations) {
        await db.runAsync(
          `INSERT INTO asset_valuations (id, assetId, effectiveDate, value, source, createdAt) VALUES (?, ?, ?, ?, ?, ?);`,
          [generateEntityId('assetval'), ast.id, valuation.effectiveDate, Math.round(valuation.value), valuation.source, valuation.createdAt || ast.updatedAt]
        );
      }
      const archiveHistory = ast.archiveHistory?.length
        ? ast.archiveHistory
        : [{ effectiveDate: ast.updatedAt.slice(0, 10), isArchived: ast.isArchived, createdAt: ast.updatedAt }];
      for (const state of archiveHistory) {
        await db.runAsync(
          `INSERT INTO asset_archive_history (id, assetId, effectiveDate, isArchived, createdAt) VALUES (?, ?, ?, ?, ?);`,
          [generateEntityId('assetstate'), ast.id, state.effectiveDate, state.isArchived ? 1 : 0, state.createdAt || ast.updatedAt]
        );
      }
    }

    // 5. Restore liabilities
    for (const l of liabilities) {
      await db.runAsync(
        `INSERT INTO liabilities (id, name, amount, type, accountId, personId, dueDate, note, isArchived, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          l.id,
          l.name,
          Math.round(l.amount),
          l.type,
          l.accountId ?? null,
          l.personId ?? null,
          l.dueDate ?? null,
          l.note ?? null,
          l.isArchived ? 1 : 0,
          l.createdAt,
          l.updatedAt,
        ]
      );
      const amountHistory = l.amountHistory?.length
        ? l.amountHistory
        : [{ effectiveDate: l.updatedAt.slice(0, 10), amount: l.amount, source: 'LEGACY_BASELINE' as const, createdAt: l.updatedAt }];
      for (const valuation of amountHistory) {
        await db.runAsync(
          `INSERT INTO liability_valuations (id, liabilityId, effectiveDate, amount, source, createdAt) VALUES (?, ?, ?, ?, ?, ?);`,
          [generateEntityId('liabval'), l.id, valuation.effectiveDate, Math.round(valuation.amount), valuation.source, valuation.createdAt || l.updatedAt]
        );
      }
      const archiveHistory = l.archiveHistory?.length
        ? l.archiveHistory
        : [{ effectiveDate: l.updatedAt.slice(0, 10), isArchived: l.isArchived, createdAt: l.updatedAt }];
      for (const state of archiveHistory) {
        await db.runAsync(
          `INSERT INTO liability_archive_history (id, liabilityId, effectiveDate, isArchived, createdAt) VALUES (?, ?, ?, ?, ?);`,
          [generateEntityId('liabstate'), l.id, state.effectiveDate, state.isArchived ? 1 : 0, state.createdAt || l.updatedAt]
        );
      }
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

    // 11. Restore cards (strictly encrypted; no plain numbers or CVV)
    if (hasCards && preparedCards && Array.isArray(preparedCards)) {
      for (const card of preparedCards) {
        if (!card.encryptedCardNumber || !card.lastFour) continue;
        await db.runAsync(
          `INSERT INTO cards (
             id, cardholderName, cardType, network, encryptedCardNumber, lastFour,
             expiryMonth, expiryYear, cardNickname, linkedAccountId, colorTheme,
             issuer, isArchived, createdAt, updatedAt
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            card.id,
            card.cardholderName,
            card.cardType,
            card.network,
            card.encryptedCardNumber,
            card.lastFour,
            card.expiryMonth,
            card.expiryYear,
            card.cardNickname ?? null,
            card.linkedAccountId ?? null,
            card.colorTheme ?? 'midnight',
            card.issuer ?? null,
            card.isArchived ? 1 : 0,
            card.createdAt,
            card.updatedAt,
          ]
        );
      }
    } else if (!hasCards) {
      // Legacy backup missing cards: protect retained local cards' foreign keys
      const incomingAccountIds = new Set(backup.data.accounts.map((a) => a.id));
      const accountsById = new Map(backup.data.accounts.map((a) => [a.id, a]));
      const retainedCards = await db.getAllAsync<{ id: string; cardType: string; linkedAccountId: string | null }>(
        'SELECT id, cardType, linkedAccountId FROM cards WHERE linkedAccountId IS NOT NULL;'
      );
      for (const c of retainedCards) {
        if (c.linkedAccountId) {
          const acc = accountsById.get(c.linkedAccountId);
          const isValidLink = acc && ((c.cardType === 'DEBIT' && acc.type === 'BANK') || (c.cardType === 'CREDIT' && acc.type === 'CREDIT_CARD'));
          if (!isValidLink) {
            await db.runAsync('UPDATE cards SET linkedAccountId = NULL WHERE id = ?;', [c.id]);
          }
        }
      }
    }

    // If legacy backup missing shopping, protect retained local shopping items' foreign keys
    if (!hasShopping) {
      const incomingAccountIds = new Set(backup.data.accounts.map((a) => a.id));
      const incomingCategoryIds = new Set(backup.data.categories.map((c) => c.id));
      const retainedShopping = await db.getAllAsync<{
        id: string;
        purchaseAccountId: string | null;
        categoryId: string | null;
      }>('SELECT id, purchaseAccountId, categoryId FROM shopping_items;');
      for (const item of retainedShopping) {
        if (item.purchaseAccountId && !incomingAccountIds.has(item.purchaseAccountId)) {
          await db.runAsync('UPDATE shopping_items SET purchaseAccountId = NULL WHERE id = ?;', [item.id]);
        }
        if (item.categoryId && !incomingCategoryIds.has(item.categoryId)) {
          await db.runAsync('UPDATE shopping_items SET categoryId = NULL WHERE id = ?;', [item.id]);
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
