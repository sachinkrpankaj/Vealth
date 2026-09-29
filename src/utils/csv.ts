import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Transaction } from '../domain/finance/types';

export function generateTransactionsCSV(transactions: Transaction[]): string {
  const headers = ['ID', 'Date', 'Type', 'Amount (Paise)', 'Amount (INR)', 'Account ID', 'Destination Account ID', 'Person ID', 'Category ID', 'Note', 'Due Date'];
  const rows = transactions.map((t) => [
    t.id,
    t.date,
    t.type,
    t.amount,
    (t.amount / 100).toFixed(2),
    t.accountId ?? '',
    t.destinationAccountId ?? '',
    t.personId ?? '',
    t.categoryId ?? '',
    `"${(t.note || '').replace(/"/g, '""')}"`,
    t.dueDate ?? '',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export async function exportTransactionsToCSV(transactions: Transaction[]): Promise<void> {
  const csvData = generateTransactionsCSV(transactions);
  const fileName = `vaelth_transactions_${new Date().toISOString().split('T')[0]}.csv`;
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
