import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Transaction } from '../domain/finance/types';
import { formatDateIso } from './dateUtils';

export function escapeCSVField(val: string | number | null | undefined): string {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateTransactionsCSV(transactions: Transaction[]): string {
  const headers = [
    'ID',
    'Date',
    'Type',
    'Amount (Paise)',
    'Amount (INR)',
    'Account ID',
    'Destination Account ID',
    'Person ID',
    'Category ID',
    'Asset ID',
    'Liability ID',
    'Note',
    'Due Date',
  ];

  const rows = transactions.map((t) => [
    escapeCSVField(t.id),
    escapeCSVField(t.date),
    escapeCSVField(t.type),
    escapeCSVField(t.amount),
    escapeCSVField((t.amount / 100).toFixed(2)),
    escapeCSVField(t.accountId),
    escapeCSVField(t.destinationAccountId),
    escapeCSVField(t.personId),
    escapeCSVField(t.categoryId),
    escapeCSVField(t.assetId),
    escapeCSVField(t.liabilityId),
    escapeCSVField(t.note),
    escapeCSVField(t.dueDate),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export async function exportTransactionsToCSV(transactions: Transaction[]): Promise<void> {
  const csvData = generateTransactionsCSV(transactions);
  const fileName = `vaelth_transactions_${formatDateIso(new Date())}.csv`;
  const fileUri = `${FileSystem.documentDirectory || ''}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, csvData, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export Vaelth Transactions',
      UTI: 'public.comma-separated-values-text',
    });
  }
}
