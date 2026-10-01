import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Plus, ArrowUpDown, Search } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { AppHeader } from '../../src/components/navigation/AppHeader';
import { SearchBar } from '../../src/components/ui/SearchBar';
import { FilterChip } from '../../src/components/ui/FilterChip';
import { TransactionRow } from '../../src/components/ui/TransactionRow';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { useTheme } from '../../src/theme';
import { Transaction } from '../../src/domain/finance/types';
import * as Haptics from 'expo-haptics';

type FilterCategory =
  | 'ALL'
  | 'INCOME'
  | 'EXPENSE'
  | 'LEND'
  | 'BORROW'
  | 'REPAYMENTS'
  | 'TRANSFERS'
  | 'ASSETS';

type SortOption = 'NEWEST' | 'OLDEST' | 'HIGHEST' | 'LOWEST';

const FILTER_ITEMS: { label: string; key: FilterCategory }[] = [
  { label: 'All', key: 'ALL' },
  { label: 'Income', key: 'INCOME' },
  { label: 'Expense', key: 'EXPENSE' },
  { label: 'Lending', key: 'LEND' },
  { label: 'Borrowing', key: 'BORROW' },
  { label: 'Repayments', key: 'REPAYMENTS' },
  { label: 'Transfers', key: 'TRANSFERS' },
  { label: 'Assets', key: 'ASSETS' },
];

export default function TransactionsScreen() {
  const { colors, typography, isDark } = useTheme();
  const {
    transactions,
    accounts,
    people,
    categories,
    physicalAssets,
    standaloneLiabilities,
    refresh,
  } = useFinancialData();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('NEWEST');
  const [showSortMenu, setShowSortMenu] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const personMap = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const assetMap = useMemo(() => new Map(physicalAssets.map((ast) => [ast.id, ast.name])), [physicalAssets]);
  const liabilityMap = useMemo(() => new Map(standaloneLiabilities.map((l) => [l.id, l.name])), [standaloneLiabilities]);

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    if (activeFilter === 'INCOME') {
      result = result.filter((t) => t.type === 'INCOME');
    } else if (activeFilter === 'EXPENSE') {
      result = result.filter((t) => t.type === 'EXPENSE');
    } else if (activeFilter === 'LEND') {
      result = result.filter((t) => t.type === 'LEND');
    } else if (activeFilter === 'BORROW') {
      result = result.filter((t) => t.type === 'BORROW');
    } else if (activeFilter === 'REPAYMENTS') {
      result = result.filter(
        (t) => t.type === 'REPAYMENT_RECEIVED' || t.type === 'REPAYMENT_MADE'
      );
    } else if (activeFilter === 'TRANSFERS') {
      result = result.filter((t) => t.type === 'TRANSFER');
    } else if (activeFilter === 'ASSETS') {
      result = result.filter((t) => t.type === 'ASSET_PURCHASE' || t.type === 'ASSET_SALE');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((t) => {
        const noteMatch = t.note?.toLowerCase().includes(q);
        const idMatch = t.id.toLowerCase().includes(q);
        const accMatch = t.accountId && accountMap.get(t.accountId)?.toLowerCase().includes(q);
        const destAccMatch =
          t.destinationAccountId && accountMap.get(t.destinationAccountId)?.toLowerCase().includes(q);
        const personMatch = t.personId && personMap.get(t.personId)?.toLowerCase().includes(q);
        const categoryMatch = t.categoryId && categoryMap.get(t.categoryId)?.toLowerCase().includes(q);
        const assetMatch = t.assetId && assetMap.get(t.assetId)?.toLowerCase().includes(q);
        const liabilityMatch = t.liabilityId && liabilityMap.get(t.liabilityId)?.toLowerCase().includes(q);
        return (
          noteMatch ||
          idMatch ||
          accMatch ||
          destAccMatch ||
          personMatch ||
          categoryMatch ||
          assetMatch ||
          liabilityMatch
        );
      });
    }

    result.sort((a, b) => {
      if (sortBy === 'NEWEST') {
        return b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '');
      }
      if (sortBy === 'OLDEST') {
        return a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || '');
      }
      if (sortBy === 'HIGHEST') return b.amount - a.amount;
      if (sortBy === 'LOWEST') return a.amount - b.amount;
      return 0;
    });

    return result;
  }, [transactions, activeFilter, searchQuery, sortBy, accountMap, personMap, categoryMap, assetMap, liabilityMap]);

  return (
    <ScreenContainer scrollable hasTabBar contentContainerStyle={styles.listContent}>
      {/* 1. Header matching Reference Image 1 */}
      <AppHeader
        title="activity"
        onProfilePress={() => router.push('/profile')}
        onRightPress={() => router.push('/transaction/add')}
        rightAccessibilityLabel="Add transaction"
        rightIcon={<Plus size={18} color={colors.textPrimary} />}
      />

      {/* 2. Search & Sort Controls */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrapper}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search notes, accounts, people..."
          />
        </View>
        <LiquidGlassCard
          radius={14}
          padding={10}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setShowSortMenu(!showSortMenu);
          }}
          accessibilityRole="button"
          accessibilityLabel="Sort transactions"
          style={styles.sortButton}
        >
          <ArrowUpDown
            size={17}
            color={showSortMenu ? colors.gold : colors.textPrimary}
            strokeWidth={2.2}
          />
        </LiquidGlassCard>
      </View>

      {/* Sort Dropdown */}
      {showSortMenu && (
        <LiquidGlassCard style={styles.sortDropdown} radius={18} padding={14}>
          <Text
            style={[
              styles.sortDropdownTitle,
              {
                color: colors.textSecondary,
                fontFamily: typography.fontFamilies.medium,
              },
            ]}
          >
            Sort by
          </Text>
          <View style={styles.sortPillsRow}>
            {[
              { label: 'Newest', key: 'NEWEST' as SortOption },
              { label: 'Oldest', key: 'OLDEST' as SortOption },
              { label: 'Highest', key: 'HIGHEST' as SortOption },
              { label: 'Lowest', key: 'LOWEST' as SortOption },
            ].map((opt) => (
              <FilterChip
                key={opt.key}
                label={opt.label}
                selected={sortBy === opt.key}
                onPress={() => {
                  setSortBy(opt.key);
                  setShowSortMenu(false);
                }}
              />
            ))}
          </View>
        </LiquidGlassCard>
      )}

      {/* 3. Filter Category Chips in Horizontal Scroll */}
      <View style={styles.filterScrollContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTER_ITEMS.map((item) => (
            <FilterChip
              key={item.key}
              label={item.label}
              selected={activeFilter === item.key}
              onPress={() => setActiveFilter(item.key)}
            />
          ))}
        </ScrollView>
      </View>

      {/* 4. Filtered Transactions Ledger */}
      {filteredTransactions.length === 0 ? (
        <LiquidGlassCard radius={20} padding={16} style={styles.emptyCard}>
          <EmptyState
            title="No transactions found"
            description={
              searchQuery
                ? `No activity matching "${searchQuery}"`
                : 'Record your financial transactions to view history.'
            }
            actionTitle="Add Transaction"
            onAction={() => router.push('/transaction/add')}
          />
        </LiquidGlassCard>
      ) : (
        <LiquidGlassCard style={styles.txListCard} radius={20} padding={0}>
          {filteredTransactions.map((item, index) => (
            <View key={item.id}>
              <TransactionRow
                transaction={item}
                accountName={item.accountId ? accountMap.get(item.accountId) : undefined}
                destAccountName={
                  item.destinationAccountId
                    ? accountMap.get(item.destinationAccountId)
                    : undefined
                }
                personName={item.personId ? personMap.get(item.personId) : undefined}
                onPress={() => router.push(`/transaction/${item.id}`)}
              />
              {index < filteredTransactions.length - 1 && (
                <View
                  style={[styles.rowDivider, { backgroundColor: colors.borderSubtle }]}
                />
              )}
            </View>
          ))}
        </LiquidGlassCard>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  searchWrapper: {
    flex: 1,
  },
  sortButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortDropdown: {
    marginBottom: 12,
  },
  sortDropdownTitle: {
    fontSize: 12,
    marginBottom: 8,
  },
  sortPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  sortPillText: {
    fontSize: 12,
  },
  filterScrollContainer: {
    height: 44,
    marginBottom: 12,
    marginHorizontal: -16,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  txListCard: {
    overflow: 'hidden',
    marginBottom: 20,
  },
  emptyCard: {
    marginTop: 8,
    marginBottom: 20,
  },
  rowDivider: {
    height: 1,
    marginHorizontal: 16,
  },
});
