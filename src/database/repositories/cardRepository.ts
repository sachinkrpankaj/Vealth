import { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../db';
import {
  SavedCard,
  CreateCardInput,
  UpdateCardInput,
  CardType,
  CardColorTheme,
} from '../../domain/cards/types';
import { PaymentNetwork } from '../../components/cards/PaymentNetworkLogo';
import { cleanCardNumber, validateCardDetails } from '../../domain/cards/cardValidation';
import { encryptCardNumber, decryptCardNumber } from '../../domain/cards/cardSecurity';
import { generateEntityId } from '../../utils/idGenerator';
import { getAccountById } from './accountRepository';

interface CardRow {
  id: string;
  cardholderName: string;
  cardType: string;
  network: string;
  encryptedCardNumber: string;
  lastFour: string;
  expiryMonth: number;
  expiryYear: number;
  cardNickname: string | null;
  linkedAccountId: string | null;
  colorTheme: string | null;
  issuer: string | null;
  isArchived: number;
  createdAt: string;
  updatedAt: string;
}

function mapRowToSavedCard(row: CardRow): SavedCard {
  return {
    id: row.id,
    cardholderName: row.cardholderName,
    cardType: row.cardType as CardType,
    network: row.network as PaymentNetwork,
    encryptedCardNumber: row.encryptedCardNumber,
    lastFour: row.lastFour,
    expiryMonth: Number(row.expiryMonth),
    expiryYear: Number(row.expiryYear),
    cardNickname: row.cardNickname ?? undefined,
    linkedAccountId: row.linkedAccountId ?? undefined,
    colorTheme: (row.colorTheme as CardColorTheme) ?? 'midnight',
    issuer: row.issuer ?? undefined,
    isArchived: row.isArchived === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getAllCards(
  options: {
    includeArchived?: boolean;
    cardType?: CardType;
    linkedAccountId?: string;
  } = {},
  executor?: SQLiteDatabase
): Promise<SavedCard[]> {
  const db = executor ?? (await getDatabase());
  const conditions: string[] = [];
  const params: any[] = [];

  if (!options.includeArchived) {
    conditions.push('isArchived = 0');
  }

  if (options.cardType) {
    conditions.push('cardType = ?');
    params.push(options.cardType);
  }

  if (options.linkedAccountId) {
    conditions.push('linkedAccountId = ?');
    params.push(options.linkedAccountId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM cards ${whereClause} ORDER BY createdAt DESC;`;
  const rows = await db.getAllAsync<CardRow>(sql, params);
  return rows.map(mapRowToSavedCard);
}

export async function getCardById(
  id: string,
  executor?: SQLiteDatabase
): Promise<SavedCard | null> {
  const db = executor ?? (await getDatabase());
  const row = await db.getFirstAsync<CardRow>('SELECT * FROM cards WHERE id = ?;', [id]);
  return row ? mapRowToSavedCard(row) : null;
}

export async function createCard(
  input: CreateCardInput,
  executor?: SQLiteDatabase
): Promise<SavedCard> {
  const db = executor ?? (await getDatabase());
  const now = new Date().toISOString();

  // Validate linked account if supplied or required
  let linkedAccount = null;
  if (input.linkedAccountId) {
    linkedAccount = await getAccountById(input.linkedAccountId, db);
    if (!linkedAccount) {
      throw new Error(`Linked account with ID ${input.linkedAccountId} does not exist.`);
    }
  }

  const validation = validateCardDetails({
    cardholderName: input.cardholderName,
    cardNumber: input.cardNumber,
    expiryMonth: input.expiryMonth,
    expiryYear: input.expiryYear,
    cardType: input.cardType,
    linkedAccount,
  });

  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0];
    throw new Error(firstErr || 'Invalid card information.');
  }

  const cleanNum = cleanCardNumber(input.cardNumber);
  const lastFour = cleanNum.slice(-4);
  const encryptedCardNumber = await encryptCardNumber(cleanNum);
  const id = generateEntityId('card');

  await db.runAsync(
    `INSERT INTO cards (
      id, cardholderName, cardType, network, encryptedCardNumber, lastFour,
      expiryMonth, expiryYear, cardNickname, linkedAccountId, colorTheme,
      issuer, isArchived, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?);`,
    [
      id,
      input.cardholderName.trim(),
      input.cardType,
      input.network,
      encryptedCardNumber,
      lastFour,
      input.expiryMonth,
      input.expiryYear,
      input.cardNickname ? input.cardNickname.trim() : null,
      input.linkedAccountId ?? null,
      input.colorTheme ?? 'midnight',
      input.issuer ? input.issuer.trim() : null,
      now,
      now,
    ]
  );

  return {
    id,
    cardholderName: input.cardholderName.trim(),
    cardType: input.cardType,
    network: input.network,
    encryptedCardNumber,
    lastFour,
    expiryMonth: input.expiryMonth,
    expiryYear: input.expiryYear,
    cardNickname: input.cardNickname ? input.cardNickname.trim() : undefined,
    issuer: input.issuer ? input.issuer.trim() : undefined,
    linkedAccountId: input.linkedAccountId ?? undefined,
    colorTheme: input.colorTheme ?? 'midnight',
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateCard(
  id: string,
  updates: UpdateCardInput,
  executor?: SQLiteDatabase
): Promise<SavedCard> {
  const db = executor ?? (await getDatabase());
  const current = await getCardById(id, db);
  if (!current) {
    throw new Error(`Card with ID ${id} not found.`);
  }

  const now = new Date().toISOString();
  const nextType = updates.cardType ?? current.cardType;
  const nextLinkedId =
    updates.linkedAccountId !== undefined ? updates.linkedAccountId : current.linkedAccountId;

  let linkedAccount = null;
  if (nextLinkedId) {
    linkedAccount = await getAccountById(nextLinkedId, db);
    if (!linkedAccount) {
      throw new Error(`Linked account with ID ${nextLinkedId} does not exist.`);
    }
  }

  const validation = validateCardDetails({
    cardholderName: updates.cardholderName ?? current.cardholderName,
    cardNumber: updates.cardNumber,
    expiryMonth: updates.expiryMonth ?? current.expiryMonth,
    expiryYear: updates.expiryYear ?? current.expiryYear,
    cardType: nextType,
    linkedAccount,
    isEditing: true,
  });

  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0];
    throw new Error(firstErr || 'Invalid card update.');
  }

  let encryptedCardNumber = current.encryptedCardNumber;
  let lastFour = current.lastFour;

  if (updates.cardNumber !== undefined && updates.cardNumber.trim().length > 0) {
    const cleanNum = cleanCardNumber(updates.cardNumber);
    lastFour = cleanNum.slice(-4);
    encryptedCardNumber = await encryptCardNumber(cleanNum);
  }

  const updated: SavedCard = {
    ...current,
    cardholderName:
      updates.cardholderName !== undefined
        ? updates.cardholderName.trim()
        : current.cardholderName,
    cardType: nextType,
    network: updates.network ?? current.network,
    encryptedCardNumber,
    lastFour,
    expiryMonth: updates.expiryMonth ?? current.expiryMonth,
    expiryYear: updates.expiryYear ?? current.expiryYear,
    cardNickname:
      updates.cardNickname !== undefined
        ? updates.cardNickname ? updates.cardNickname.trim() : undefined
        : current.cardNickname,
    issuer:
      updates.issuer !== undefined
        ? updates.issuer ? updates.issuer.trim() : undefined
        : current.issuer,
    linkedAccountId: nextLinkedId ?? undefined,
    colorTheme: updates.colorTheme ?? current.colorTheme,
    updatedAt: now,
  };

  await db.runAsync(
    `UPDATE cards SET
      cardholderName = ?,
      cardType = ?,
      network = ?,
      encryptedCardNumber = ?,
      lastFour = ?,
      expiryMonth = ?,
      expiryYear = ?,
      cardNickname = ?,
      issuer = ?,
      linkedAccountId = ?,
      colorTheme = ?,
      updatedAt = ?
    WHERE id = ?;`,
    [
      updated.cardholderName,
      updated.cardType,
      updated.network,
      updated.encryptedCardNumber,
      updated.lastFour,
      updated.expiryMonth,
      updated.expiryYear,
      updated.cardNickname ?? null,
      updated.issuer ?? null,
      updated.linkedAccountId ?? null,
      updated.colorTheme ?? 'midnight',
      now,
      id,
    ]
  );

  return updated;
}

export async function archiveCard(id: string, executor?: SQLiteDatabase): Promise<void> {
  const db = executor ?? (await getDatabase());
  const now = new Date().toISOString();
  await db.runAsync('UPDATE cards SET isArchived = 1, updatedAt = ? WHERE id = ?;', [now, id]);
}

export async function unarchiveCard(id: string, executor?: SQLiteDatabase): Promise<void> {
  const db = executor ?? (await getDatabase());
  const now = new Date().toISOString();
  await db.runAsync('UPDATE cards SET isArchived = 0, updatedAt = ? WHERE id = ?;', [now, id]);
}

export async function deleteCard(id: string, executor?: SQLiteDatabase): Promise<void> {
  const db = executor ?? (await getDatabase());
  await db.runAsync('DELETE FROM cards WHERE id = ?;', [id]);
}

/**
 * Decrypts and reveals the full card number using the hardware master key.
 */
export async function revealCardNumber(cardOrId: SavedCard | string): Promise<string> {
  let card: SavedCard | null = null;
  if (typeof cardOrId === 'string') {
    card = await getCardById(cardOrId);
    if (!card) throw new Error('Card not found.');
  } else {
    card = cardOrId;
  }

  return await decryptCardNumber(card.encryptedCardNumber);
}
