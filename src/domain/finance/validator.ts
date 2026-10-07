import { TransactionType, AccountType } from './types';
import { formatRupee } from './currency';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

import { parseLocalDate, getTodayLocalDateString } from '../../utils/dateUtils';

export function validateIncomeAccountType(accountType?: AccountType | string): ValidationResult {
  if (accountType === 'CREDIT_CARD') {
    return {
      isValid: false,
      error: 'A credit card cannot be used as the receiving account for income.',
    };
  }
  return { isValid: true };
}

export function validateAmount(amountPaise: number): ValidationResult {
  if (!Number.isFinite(amountPaise) || !Number.isSafeInteger(amountPaise) || isNaN(amountPaise)) {
    return { isValid: false, error: 'Enter a valid amount.' };
  }
  if (amountPaise <= 0) {
    return { isValid: false, error: 'Amount must be greater than zero.' };
  }
  return { isValid: true };
}

export function validateRepaymentAmount(
  paramsOrAmount:
    | {
        amountPaise: number;
        outstandingPaise: number;
      }
    | number,
  outstandingPaiseArg?: number
): ValidationResult {
  let amountPaise: number;
  let outstandingPaise: number;

  if (typeof paramsOrAmount === 'object' && paramsOrAmount !== null) {
    amountPaise = paramsOrAmount.amountPaise;
    outstandingPaise = paramsOrAmount.outstandingPaise;
  } else {
    amountPaise = paramsOrAmount;
    outstandingPaise = outstandingPaiseArg ?? 0;
  }

  const baseCheck = validateAmount(amountPaise);
  if (!baseCheck.isValid) return baseCheck;

  if (outstandingPaise <= 0) {
    return { isValid: false, error: 'There is no outstanding balance recorded to repay.' };
  }

  if (amountPaise > outstandingPaise) {
    return {
      isValid: false,
      error: `Repayment amount (${formatRupee(amountPaise)}) exceeds the outstanding balance (${formatRupee(outstandingPaise)}).`,
    };
  }

  return { isValid: true };
}

export function validateTransferAccounts(
  sourceAccountId: string | undefined,
  destAccountId: string | undefined
): ValidationResult {
  if (!sourceAccountId) {
    return { isValid: false, error: 'Select a source account.' };
  }
  if (!destAccountId) {
    return { isValid: false, error: 'Select a destination account.' };
  }
  if (sourceAccountId === destAccountId) {
    return { isValid: false, error: 'Source and destination accounts must be different.' };
  }
  return { isValid: true };
}

export function validateTransactionRequiredFields(params: {
  type: TransactionType;
  amount: number;
  date: string;
  accountId?: string;
  accountType?: AccountType | string;
  destinationAccountId?: string;
  personId?: string;
  assetId?: string;
}): ValidationResult {
  const amountValidation = validateAmount(params.amount);
  if (!amountValidation.isValid) return amountValidation;

  if (
    !params.date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(params.date) ||
    !parseLocalDate(params.date)
  ) {
    return { isValid: false, error: 'Enter a valid calendar date in YYYY-MM-DD format.' };
  }

  switch (params.type) {
    case 'INCOME':
      if (!params.accountId) {
        return { isValid: false, error: 'Select an account.' };
      }
      if (params.accountType === 'CREDIT_CARD') {
        return {
          isValid: false,
          error: 'A credit card cannot be used as the receiving account for income.',
        };
      }
      break;

    case 'EXPENSE':
      if (!params.accountId) {
        return { isValid: false, error: 'Select an account.' };
      }
      break;

    case 'LEND':
      if (!params.personId) {
        return { isValid: false, error: 'Select who you are lending to.' };
      }
      if (!params.accountId) {
        return { isValid: false, error: 'Select the account to lend from.' };
      }
      break;

    case 'BORROW':
      if (!params.personId) {
        return { isValid: false, error: 'Select who you are borrowing from.' };
      }
      if (!params.accountId) {
        return { isValid: false, error: 'Select the account receiving money.' };
      }
      break;

    case 'REPAYMENT_RECEIVED':
      if (!params.personId) {
        return { isValid: false, error: 'Select the person paying back.' };
      }
      if (!params.accountId) {
        return { isValid: false, error: 'Select the account receiving money.' };
      }
      break;

    case 'REPAYMENT_MADE':
      if (!params.personId) {
        return { isValid: false, error: 'Select the person you are paying.' };
      }
      if (!params.accountId) {
        return { isValid: false, error: 'Select the account paying from.' };
      }
      break;

    case 'TRANSFER':
      return validateTransferAccounts(params.accountId, params.destinationAccountId);

    case 'ASSET_PURCHASE':
    case 'ASSET_SALE':
      if (!params.accountId) {
        return { isValid: false, error: 'Select an account.' };
      }
      if (!params.assetId) {
        return {
          isValid: false,
          error: `${params.type === 'ASSET_PURCHASE' ? 'Asset purchase' : 'Asset sale'} requires a valid asset.`,
        };
      }
      break;
  }

  return { isValid: true };
}

export function validateDueDate(
  dueDate?: string | null,
  transactionDate?: string
): ValidationResult {
  if (!dueDate || !dueDate.trim()) {
    return { isValid: true };
  }
  const trimmed = dueDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || !parseLocalDate(trimmed)) {
    return { isValid: false, error: 'Due date must be a valid calendar date in YYYY-MM-DD format.' };
  }
  if (transactionDate && trimmed < transactionDate) {
    return { isValid: false, error: 'Due date cannot be earlier than the transaction date.' };
  }
  return { isValid: true };
}

export function validateTransactionDate(
  dateStr?: string | null,
  allowFutureDates = false,
  referenceDate = getTodayLocalDateString()
): ValidationResult {
  if (!dateStr || !dateStr.trim()) {
    return { isValid: false, error: 'Transaction date is required.' };
  }
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || !parseLocalDate(trimmed)) {
    return { isValid: false, error: 'Enter a valid calendar date in YYYY-MM-DD format.' };
  }
  if (!allowFutureDates && trimmed > referenceDate) {
    return { isValid: false, error: 'Future-dated transactions are not supported.' };
  }
  return { isValid: true };
}
