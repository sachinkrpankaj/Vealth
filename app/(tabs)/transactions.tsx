import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ScrollView, Modal } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Plus, ArrowUpDown, Search, Check, X, Calendar, Clock, TrendingUp, TrendingDown } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { AppHeader } from '../../src/components/navigation/AppHeader';
import { SearchBar } from '../../src/components/ui/SearchBar';
import { FilterChip } from '../../src/components/ui/FilterChip';
import { TransactionRow } from '../../src/components/ui/TransactionRow';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { IconButton } from '../../src/components/ui/IconButton';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { useTheme } from '../../src/theme';
import { Transaction } from '../../src/domain/finance/types';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const SORT_OPTIONS: { key: SortOption; label: string; description: string; icon: any }[] = [
  {
    key: 'NEWEST',
    label: 'Newest First',
    description: 'Most recent transactions first',
    icon: Calendar,
  },
  {
    key: 'OLDEST',
    label: 'Oldest First',
    description: 'Earliest recorded transactions first',
    icon: Clock,
  },
  {
    key: 'HIGHEST',
    label: 'Highest Amount',
    description: 'Largest monetary values first',
    icon: TrendingUp,
  },
  {
    key: 'LOWEST',
    label: 'Lowest Amount',
    description: 'Smallest monetary values first',
    icon: TrendingDown,
  },
];

export default function TransactionsScreen() {
  const { colors, typography, isDark } = useTheme();
  const insets = useSafeAreaInsets();
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
  const [showSortSheet, setShowSortSheet] = useState(false);

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

  const activeSortLabel = SORT_OPTIONS.find((s) => s.key === sortBy)?.label || sortBy;

  return (
    <ScreenContainer scrollable hasTabBar contentContainerStyle={styles.listContent}>
      {/* 1. Header matching Reference Image 1 */}
      <AppHeader
        title="activity"
        onProfilePress={() => router.push('/profile')}
        onCardWalletPress={() => router.push('/cards')}
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
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setShowSortSheet(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Sort transactions. Currently sorted by ${activeSortLabel}`}
          hitSlop={6}
          style={({ pressed }) => [
            styles.sortButton,
            {
              backgroundColor: sortBy !== 'NEWEST' ? colors.accent + '22' : colors.surface,
              borderColor: sortBy !== 'NEWEST' ? colors.accent : colors.border,
              borderRadius: 14,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <ArrowUpDown
            size={18}
            color={sortBy !== 'NEWEST' ? colors.accent : colors.textPrimary}
            strokeWidth={2.2}
          />
          {sortBy !== 'NEWEST' && (
            <View style={[styles.sortBadgeDot, { backgroundColor: colors.accent }]} />
          )}
        </Pressable>
      </View>

      {/* Sort Bottom Sheet Modal */}
      <Modal
        visible={showSortSheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSortSheet(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowSortSheet(false)}
            accessibilityLabel="Close sort menu"
          />
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.surfaceElevated || colors.surface,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderColor: colors.border,
                paddingBottom: insets.bottom,
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderText}>
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                  Sort Activity
                </Text>
                <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                  Order transactions by date or amount
                </Text>
              </View>
              <IconButton
                icon={<X size={16} color={colors.textPrimary} />}
                size={32}
                onPress={() => setShowSortSheet(false)}
                accessibilityLabel="Close sort sheet"
              />
            </View>
            <ScrollView
              style={styles.sortOptionsScroll}
              contentContainerStyle={styles.sortOptionsContainer}
              showsVerticalScrollIndicator={false}
            >
              {SORT_OPTIONS.map((opt) => {
                const isSelected = sortBy === opt.key;
                const OptionIcon = opt.icon;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setSortBy(opt.key);
                      setShowSortSheet(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${opt.label}: ${opt.description}`}
                    style={({ pressed }) => [
                      styles.sortOptionRow,
                      {
                        backgroundColor: isSelected
                          ? (colors.accent + '18')
                          : pressed
                          ? colors.borderSubtle
                          : 'transparent',
                        borderColor: isSelected ? colors.accent : colors.borderSubtle || 'transparent',
                        borderRadius: 14,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.sortOptionIconBadge,
                        {
                          backgroundColor: isSelected
                            ? (colors.accent + '22')
                            : colors.surface,
                        },
                      ]}
                    >
                      <OptionIcon
                        size={18}
                        color={isSelected ? colors.accent : colors.textPrimary}
                      />
                    </View>
                    <View style={styles.sortOptionContent}>
                      <Text
                        style={[
                          styles.sortOptionTitle,
                          {
                            color: isSelected ? colors.accent : colors.textPrimary,
                            fontWeight: isSelected ? '700' : '600',
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={[styles.sortOptionDesc, { color: colors.textSecondary }]}>
                        {opt.description}
                      </Text>
                    </View>
                    {isSelected && (
                      <Check size={18} color={colors.accent} style={{ marginLeft: 8 }} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 3. Filter Category Chips in Horizontal Scroll */}
      <View style={styles.filterScrollContainer}>
        <ScrollView
          horizontal
          style={styles.filterScroller}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTER_ITEMS.map((item) => (
            <FilterChip
              key={item.key}
              label={item.label}
              selected={activeFilter === item.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveFilter(item.key);
              }}
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
    borderWidth: 1,
    position: 'relative',
  },
  sortBadgeDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalSheet: {
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetHeaderText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  sortOptionsContainer: {
    gap: 8,
    paddingBottom: 20,
  },
  sortOptionsScroll: {
    flexShrink: 1,
  },
  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    gap: 12,
  },
  sortOptionIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortOptionContent: {
    flex: 1,
    minWidth: 0,
  },
  sortOptionTitle: {
    fontSize: 14,
  },
  sortOptionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  filterScrollContainer: {
    flexShrink: 0,
    marginBottom: 12,
    marginHorizontal: -16,
  },
  filterScroller: {
    flexGrow: 0,
  },
  filterScroll: {
    paddingLeft: 16,
    paddingRight: 24,
    gap: 8,
    alignItems: 'center',
    paddingVertical: 4,
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
