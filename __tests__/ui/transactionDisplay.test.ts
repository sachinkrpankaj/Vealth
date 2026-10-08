import React from 'react';
import { AmountText } from '../../src/components/ui/AmountText';
import { TransactionRow } from '../../src/components/ui/TransactionRow';
import { getAllAccounts } from '../../src/database/repositories/accountRepository';
import { Transaction } from '../../src/domain/finance/types';

jest.mock('react-native', () => ({
  Text: 'Text', View: 'View', Pressable: 'Pressable', StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('lucide-react-native', () => Object.fromEntries([
  'ArrowDownLeft', 'ArrowUpRight', 'ArrowRightLeft', 'HandCoins', 'Receipt', 'ShoppingBag',
  'TrendingUp', 'CircleDollarSign', 'Briefcase',
].map((name) => [name, name])));
jest.mock('../../src/theme', () => ({ useTheme: () => ({
  colors: {}, radii: {}, spacing: {},
  typography: { fontSizes: {}, lineHeights: {}, fontFamilies: {} },
}) }));
jest.mock('../../src/hooks/useCountingAnimation', () => ({
  useCountingAnimation: (amount: number, options: any) => ({
    formattedText: options.isMasked
      ? require('../../src/domain/finance/currency').formatRupeeMasked(amount, options.formatOptions)
      : require('../../src/domain/finance/currency').formatRupee(amount, options.formatOptions),
  }),
}));

const transfer: Transaction = {
  id: 'transfer', type: 'TRANSFER', amount: 1943300, date: '2026-10-05', accountId: 'source',
  destinationAccountId: 'destination', createdAt: '', updatedAt: '',
};

describe('transaction and monetary presentation', () => {
  it('keeps source → destination order including archived account names', async () => {
    const rows = [
      { id: 'source', name: 'Closed Bank', type: 'BANK', isArchived: 1, openingBalance: 0 },
      { id: 'destination', name: 'Current Bank', type: 'BANK', isArchived: 0, openingBalance: 1943300 },
    ];
    const executor = { getAllAsync: jest.fn(async (query: string) => query.includes('WHERE isArchived = 0') ? rows.slice(1) : rows) };
    const accounts = await getAllAccounts(true, executor as any);
    const names = new Map(accounts.map((account) => [account.id, account.name]));
    const row = TransactionRow({ transaction: transfer, accountName: names.get(transfer.accountId!), destAccountName: names.get(transfer.destinationAccountId!) }) as React.ReactElement<any>;
    expect(row.props.accessibilityLabel).toContain('Closed Bank → Current Bank');
    expect(row.props.accessibilityLabel).not.toContain('Current Bank → Closed Bank');
  });

  it.each([false, true])('renders one monetary sign in %s animation mode', (animated) => {
    for (const [variant, expected] of [['positive', '+₹19,433'], ['negative', '-₹19,433']] as const) {
      const amount = AmountText({ amount: 1943300, variant, showSign: true, animated }) as React.ReactElement<any>;
      expect(amount.props.children).toBe(expected);
      const masked = AmountText({ amount: 1943300, variant, showSign: true, animated, isMasked: true }) as React.ReactElement<any>;
      expect(masked.props.children).toBe(`${variant === 'positive' ? '+' : '-'}₹ •••••`);
    }
  });
});
