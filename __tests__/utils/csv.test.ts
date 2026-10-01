import { generateTransactionsCSV, escapeCSVField } from '../../src/utils/csv';
import { Transaction } from '../../src/domain/finance/types';

describe('CSV Export Engine', () => {
  it('correctly escapes fields with commas, quotes, and newlines', () => {
    expect(escapeCSVField('Simple text')).toBe('Simple text');
    expect(escapeCSVField('Text with, comma')).toBe('"Text with, comma"');
    expect(escapeCSVField('Text with "quotes"')).toBe('"Text with ""quotes"""');
    expect(escapeCSVField('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
    expect(escapeCSVField(null)).toBe('');
    expect(escapeCSVField(undefined)).toBe('');
    expect(escapeCSVField(1250)).toBe('1250');
  });

  it('includes Asset ID and Liability ID in headers and data rows', () => {
    const mockTx: Transaction[] = [
      {
        id: 'tx-1',
        type: 'ASSET_PURCHASE',
        amount: 5000000,
        date: '2026-10-01',
        accountId: 'acc-1',
        assetId: 'ast-gold',
        note: 'Purchased 10g Gold, invoice #45',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
      {
        id: 'tx-2',
        type: 'EXPENSE',
        amount: 25000,
        date: '2026-10-02',
        accountId: 'acc-2',
        liabilityId: 'lib-loan',
        note: 'Interest payment',
        dueDate: '2026-10-15',
        createdAt: '2026-10-02',
        updatedAt: '2026-10-02',
      },
    ];

    const csv = generateTransactionsCSV(mockTx);
    const lines = csv.split('\n');

    expect(lines[0]).toBe(
      'ID,Date,Type,Amount (Paise),Amount (INR),Account ID,Destination Account ID,Person ID,Category ID,Asset ID,Liability ID,Note,Due Date'
    );

    // Row 1 checks
    expect(lines[1]).toContain('ast-gold');
    expect(lines[1]).toContain('"Purchased 10g Gold, invoice #45"');
    expect(lines[1]).toContain('50000.00');

    // Row 2 checks
    expect(lines[2]).toContain('lib-loan');
    expect(lines[2]).toContain('2026-10-15');
    expect(lines[2]).toContain('250.00');
  });
});
