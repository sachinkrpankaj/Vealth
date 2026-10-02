import { Transaction, FinancialEffect } from './types';
import { formatRupee } from './currency';
import { getTodayLocalDateString } from '../../utils/dateUtils';

export interface AccountingContext {
  accountName?: string;
  destAccountName?: string;
  personName?: string;
  assetName?: string;
  assetBookValue?: number;
  referenceDate?: string;
}

export function isFutureDatedTransaction(
  tx: Pick<Transaction, 'date'>,
  referenceDate: string = getTodayLocalDateString()
): boolean {
  return tx.date > referenceDate;
}

/**
 * Calculates the exact, deterministic financial effect of any transaction.
 * Follows strict double-entry and balance sheet principles.
 */
function calculateBaseFinancialEffect(
  tx: Transaction,
  context?: AccountingContext
): Omit<FinancialEffect, 'isFuture'> {
  const amount = Math.abs(tx.amount);
  const accountLabel = context?.accountName ?? 'Account';
  const destAccountLabel = context?.destAccountName ?? 'Destination Account';
  const personLabel = context?.personName ?? 'Person';
  const assetLabel = context?.assetName ?? 'Asset';

  switch (tx.type) {
    case 'INCOME':
      return {
        sourceAccountDelta: amount,
        destinationAccountDelta: 0,
        receivableDelta: 0,
        payableDelta: 0,
        assetDelta: 0,
        netWorthDelta: amount,
        descriptionLines: [
          `${accountLabel}: +${formatRupee(amount)}`,
          `Net Worth: +${formatRupee(amount)}`,
        ],
      };

    case 'EXPENSE':
      return {
        sourceAccountDelta: -amount,
        destinationAccountDelta: 0,
        receivableDelta: 0,
        payableDelta: 0,
        assetDelta: 0,
        netWorthDelta: -amount,
        descriptionLines: [
          `${accountLabel}: -${formatRupee(amount)}`,
          `Net Worth: -${formatRupee(amount)}`,
        ],
      };

    case 'LEND':
      // User lends money to Rahul:
      // Cash decreases, Rahul's receivable increases, Net Worth is unchanged.
      return {
        sourceAccountDelta: -amount,
        destinationAccountDelta: 0,
        receivableDelta: amount, // Money owed to user increases
        payableDelta: 0,
        assetDelta: 0,
        netWorthDelta: 0,
        descriptionLines: [
          `${accountLabel}: -${formatRupee(amount)}`,
          `Receivable (${personLabel}): +${formatRupee(amount)}`,
          'Net Worth: ₹0 change (Asset swap)',
        ],
      };

    case 'BORROW':
      // User borrows money from Amit:
      // Cash increases, liability to Amit increases, Net Worth is unchanged.
      return {
        sourceAccountDelta: amount,
        destinationAccountDelta: 0,
        receivableDelta: 0,
        payableDelta: amount, // Money user owes increases
        assetDelta: 0,
        netWorthDelta: 0,
        descriptionLines: [
          `${accountLabel}: +${formatRupee(amount)}`,
          `Debt (${personLabel}): +${formatRupee(amount)}`,
          'Net Worth: ₹0 change',
        ],
      };

    case 'REPAYMENT_RECEIVED':
      // Rahul repays user ₹2,000:
      // Cash increases, Rahul's receivable decreases, Net Worth is unchanged (NOT income!).
      return {
        sourceAccountDelta: amount,
        destinationAccountDelta: 0,
        receivableDelta: -amount, // Rahul owes less
        payableDelta: 0,
        assetDelta: 0,
        netWorthDelta: 0,
        descriptionLines: [
          `${accountLabel}: +${formatRupee(amount)}`,
          `Receivable (${personLabel}): -${formatRupee(amount)}`,
          'Net Worth: ₹0 change (Repayment is not income)',
        ],
      };

    case 'REPAYMENT_MADE':
      // User pays Amit ₹1,000:
      // Cash decreases, debt to Amit decreases, Net Worth is unchanged (NOT expense!).
      return {
        sourceAccountDelta: -amount,
        destinationAccountDelta: 0,
        receivableDelta: 0,
        payableDelta: -amount, // User owes Amit less
        assetDelta: 0,
        netWorthDelta: 0,
        descriptionLines: [
          `${accountLabel}: -${formatRupee(amount)}`,
          `Debt (${personLabel}): -${formatRupee(amount)}`,
          'Net Worth: ₹0 change (Repayment is not expense)',
        ],
      };

    case 'TRANSFER':
      // Transfer from Bank to Cash:
      // Source decreases, Destination increases, Net Worth is unchanged.
      return {
        sourceAccountDelta: -amount,
        destinationAccountDelta: amount,
        receivableDelta: 0,
        payableDelta: 0,
        assetDelta: 0,
        netWorthDelta: 0,
        descriptionLines: [
          `${accountLabel}: -${formatRupee(amount)}`,
          `${destAccountLabel}: +${formatRupee(amount)}`,
          'Net Worth: ₹0 change',
        ],
      };

    case 'ASSET_PURCHASE':
      // Buy asset for ₹10,000:
      // Cash decreases, Asset increases, Net Worth is unchanged.
      return {
        sourceAccountDelta: -amount,
        destinationAccountDelta: 0,
        receivableDelta: 0,
        payableDelta: 0,
        assetDelta: amount,
        netWorthDelta: 0,
        descriptionLines: [
          `${accountLabel}: -${formatRupee(amount)}`,
          `${assetLabel}: +${formatRupee(amount)}`,
          'Net Worth: ₹0 change',
        ],
      };

    case 'ASSET_SALE': {
      // Sell asset:
      // Cash increases by sale amount.
      // Asset decreases by book value (or sale amount if book value not provided).
      // Net worth delta is capital gain/loss (sale amount - book value).
      let bookValue = amount;
      if (tx.metadata) {
        try {
          const meta = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : tx.metadata;
          if (typeof meta.bookValueSold === 'number') {
            bookValue = meta.bookValueSold;
          } else if (typeof meta.assetValueDeducted === 'number') {
            bookValue = meta.assetValueDeducted;
          }
        } catch {}
      } else if (context?.assetBookValue !== undefined) {
        bookValue = context.assetBookValue;
      }

      const gainOrLoss = amount - bookValue;
      return {
        sourceAccountDelta: amount,
        destinationAccountDelta: 0,
        receivableDelta: 0,
        payableDelta: 0,
        assetDelta: -bookValue,
        netWorthDelta: gainOrLoss,
        descriptionLines: [
          `${accountLabel}: +${formatRupee(amount)}`,
          `${assetLabel}: -${formatRupee(bookValue)}`,
          `Net Worth: ${gainOrLoss >= 0 ? '+' : ''}${formatRupee(gainOrLoss)}`,
        ],
      };
    }

    case 'OTHER':
    default:
      return {
        sourceAccountDelta: 0,
        destinationAccountDelta: 0,
        receivableDelta: 0,
        payableDelta: 0,
        assetDelta: 0,
        netWorthDelta: 0,
        descriptionLines: ['Informational only'],
      };
  }
}

/** Calculates transaction deltas and marks future-dated deltas as scheduled. */
export function calculateFinancialEffect(
  tx: Transaction,
  context?: AccountingContext
): FinancialEffect {
  const effect = calculateBaseFinancialEffect(tx, context);
  const isFuture = isFutureDatedTransaction(tx, context?.referenceDate);
  return {
    ...effect,
    isFuture,
    descriptionLines: isFuture
      ? [
          `Scheduled effect for ${tx.date}; not included in current balances or net worth yet.`,
          ...effect.descriptionLines,
        ]
      : effect.descriptionLines,
  };
}
