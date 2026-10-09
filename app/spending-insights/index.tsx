import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { KeyboardAwareScrollView } from '../../src/components/ui/KeyboardAwareScrollView';
import { router, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  Layers,
  TrendingDown,
  TrendingUp,
  Tag,
  Folder,
  HelpCircle,
  Plus,
  Edit2,
  Archive,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  ArrowUpRight,
  Utensils,
  Car,
  ShoppingBag,
  Receipt,
  Film,
  GraduationCap,
  HeartPulse,
  Plane,
  Tv,
  Smile,
  BarChart3,
  Sliders,
} from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { showThemedAlert } from '../../src/components/ui/ThemedDialog';
import { AmountText } from '../../src/components/ui/AmountText';
import { TransactionRow } from '../../src/components/ui/TransactionRow';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { useTheme } from '../../src/theme';
import { formatRupee } from '../../src/domain/finance/currency';
import { Transaction, Category } from '../../src/domain/finance/types';
import {
  getAvailableExpenseYears,
  calculateYearOverview,
  calculateMonthInsights,
  calculateCategoryInsights,
  CategorySpendSummary,
  MonthlySpendTrend,
} from '../../src/domain/finance/spendingInsights';
import {
  getAllCategories,
  createCategory,
  updateCategory,
  archiveCategory,
  isMonthlyGeneralCategory,
  ensureMonthlyGeneralCategory,
} from '../../src/database/repositories/categoryRepository';
import { updateTransaction } from '../../src/database/repositories/transactionRepository';
import * as Haptics from 'expo-haptics';

const ICON_MAP: Record<string, any> = {
  Folder,
  HelpCircle,
  Utensils,
  Car,
  ShoppingBag,
  Receipt,
  Film,
  GraduationCap,
  HeartPulse,
  Plane,
  Tv,
  Smile,
  Tag,
};

const COLOR_PALETTE = [
  '#6366F1',
  '#F43F5E',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#06B6D4',
  '#EC4899',
  '#D4A373',
];

export default function SpendingInsightsScreen() {
  const { colors, typography, radii, spacing, isDark } = useTheme();
  const { transactions, categories, accounts, people, refresh } = useFinancialData();

  const [currentDate, setCurrentDate] = useState(() => new Date());

  useFocusEffect(
    React.useCallback(() => {
      refresh();
      setCurrentDate(new Date());
    }, [refresh])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (
        now.getDate() !== currentDate.getDate() ||
        now.getMonth() !== currentDate.getMonth() ||
        now.getFullYear() !== currentDate.getFullYear()
      ) {
        setCurrentDate(now);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [currentDate]);

  const availableYears = useMemo(
    () => getAvailableExpenseYears(transactions, currentDate),
    [transactions, currentDate]
  );

  // Active view states
  const [selectedYear, setSelectedYear] = useState<number>(() => currentDate.getFullYear());
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null); // null = Year Overview, 'YYYY-MM' = Month View
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null); // null = Normal, string = Category View

  // Category Manager modal state
  const [managerVisible, setManagerVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(COLOR_PALETTE[0]);
  const [newCatIcon, setNewCatIcon] = useState('Tag');
  const [allCategoriesList, setAllCategoriesList] = useState<Category[]>([]);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const loadAllCategories = async () => {
    try {
      const cats = await getAllCategories(true);
      setAllCategoriesList(cats.filter((c) => c.type === 'EXPENSE'));
    } catch {}
  };

  useEffect(() => {
    loadAllCategories();
  }, [managerVisible]);

  // Account & Person lookup maps for transaction rows
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const personMap = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  // Insights calculations
  const yearInsights = useMemo(() => {
    return calculateYearOverview(selectedYear, transactions, categories, currentDate);
  }, [selectedYear, transactions, categories, currentDate]);

  const monthInsights = useMemo(() => {
    if (!selectedMonthKey) return null;
    return calculateMonthInsights(selectedMonthKey, transactions, categories, currentDate);
  }, [selectedMonthKey, transactions, categories, currentDate]);

  const categoryInsights = useMemo(() => {
    if (!selectedCategoryId) return null;
    return calculateCategoryInsights(selectedCategoryId, selectedYear, transactions, categories, currentDate);
  }, [selectedCategoryId, selectedYear, transactions, categories, currentDate]);

  // Ensure current month category exists in background
  useEffect(() => {
    ensureMonthlyGeneralCategory(currentDate).catch(() => {});
  }, [currentDate]);

  // Handlers
  const handleSelectYear = (yr: number) => {
    Haptics.selectionAsync();
    setSelectedYear(yr);
    setSelectedMonthKey(null);
    setSelectedCategoryId(null);
  };

  const handleSelectMonth = (mKey: string | null) => {
    Haptics.selectionAsync();
    setSelectedMonthKey(mKey);
    setSelectedCategoryId(null);
  };

  const handleSelectCategory = (catId: string) => {
    Haptics.selectionAsync();
    setSelectedCategoryId(catId);
  };

  const handleResetToYear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMonthKey(null);
    setSelectedCategoryId(null);
  };

  // Category CRUD in Manager
  const handleSaveCategoryInManager = async () => {
    if (isSavingCategory) return;
    if (!newCatName.trim()) {
      showThemedAlert('Required', 'Please enter a category name');
      return;
    }
    try {
      setIsSavingCategory(true);
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: newCatName.trim(),
          color: newCatColor,
          icon: newCatIcon,
        });
      } else {
        await createCategory({
          name: newCatName.trim(),
          type: 'EXPENSE',
          color: newCatColor,
          icon: newCatIcon,
        });
      }
      setEditingCategory(null);
      setNewCatName('');
      await loadAllCategories();
      await refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      showThemedAlert('Error', err?.message || 'Failed to save category');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleToggleArchiveInManager = async (cat: Category) => {
    try {
      const willArchive = !cat.isArchived;
      await archiveCategory(cat.id, willArchive);
      await loadAllCategories();
      await refresh();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err: any) {
      showThemedAlert('Error', err?.message || 'Failed to update category');
    }
  };

  // Quick assign expense to historical month General
  const handleAssignToMonthGeneral = async (tx: Transaction, monthKey: string) => {
    try {
      const parts = monthKey.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const targetDate = new Date(y, m, 15);
      const generalCat = await ensureMonthlyGeneralCategory(targetDate);

      await updateTransaction(tx.id, {
        categoryId: generalCat.id,
      });
      await refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      showThemedAlert('Assignment Error', e?.message || 'Failed to assign category');
    }
  };

  return (
    <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Top Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.sm }]}>
        <LiquidGlassCard
          onPress={() => {
            if (selectedCategoryId) {
              setSelectedCategoryId(null);
            } else if (selectedMonthKey) {
              setSelectedMonthKey(null);
            } else {
              router.back();
            }
          }}
          hitSlop={10}
          accessibilityLabel="Go back"
          radius={radii.full}
          padding={0}
          style={styles.backBtn}
        >
          <ArrowLeft size={18} color={colors.textPrimary} />
        </LiquidGlassCard>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Spending Insights
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {selectedCategoryId
              ? `${categoryInsights?.categoryName} · ${selectedYear}`
              : selectedMonthKey
              ? `${monthInsights?.shortLabel} · Breakdown`
              : `${selectedYear} · Overview`}
          </Text>
        </View>

        <LiquidGlassCard
          onPress={() => setManagerVisible(true)}
          hitSlop={10}
          accessibilityLabel="Manage Categories"
          radius={radii.full}
          padding={0}
          style={styles.actionBtn}
        >
          <Tag size={16} color={colors.textPrimary} />
        </LiquidGlassCard>
      </View>

      {/* Year Selector Pills */}
      <View style={styles.yearSelectorRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {availableYears.map((yr) => {
            const isSelected = yr === selectedYear;
            return (
              <Pressable
                key={yr}
                onPress={() => handleSelectYear(yr)}
                style={[
                  styles.yearPill,
                  {
                    backgroundColor: isSelected ? colors.textPrimary : colors.surface,
                    borderColor: isSelected ? colors.textPrimary : colors.border,
                    borderRadius: radii.full,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.yearPillText,
                    { color: isSelected ? colors.background : colors.textSecondary },
                  ]}
                >
                  {yr}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Months Bar */}
      <View style={styles.monthScrollContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
        >
          <Pressable
            onPress={() => handleSelectMonth(null)}
            style={[
              styles.monthPill,
              {
                backgroundColor:
                  selectedMonthKey === null && selectedCategoryId === null
                    ? colors.accent
                    : isDark
                    ? colors.surfaceSubtle
                    : 'rgba(0,0,0,0.04)',
                borderColor:
                  selectedMonthKey === null && selectedCategoryId === null
                    ? colors.accent
                    : colors.borderSubtle,
                borderRadius: radii.md,
              },
            ]}
          >
            <Text
              style={[
                styles.monthPillText,
                {
                  color:
                    selectedMonthKey === null && selectedCategoryId === null
                      ? '#FFFFFF'
                      : colors.textPrimary,
                  fontWeight: selectedMonthKey === null ? '700' : '500',
                },
              ]}
            >
              Full Year
            </Text>
          </Pressable>

          {yearInsights.monthlyTrends.map((m) => {
            const isSelected = selectedMonthKey === m.monthKey && selectedCategoryId === null;
            return (
              <Pressable
                key={m.monthKey}
                onPress={() => handleSelectMonth(m.monthKey)}
                style={[
                  styles.monthPill,
                  {
                    backgroundColor: isSelected
                      ? colors.accent
                      : m.isCurrentMonth
                      ? `${colors.accent}15`
                      : isDark
                      ? colors.surfaceSubtle
                      : 'rgba(0,0,0,0.03)',
                    borderColor: isSelected
                      ? colors.accent
                      : m.isCurrentMonth
                      ? colors.accent
                      : colors.borderSubtle,
                    borderRadius: radii.md,
                    opacity: m.isFuture ? 0.45 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.monthPillText,
                    {
                      color: isSelected
                        ? '#FFFFFF'
                        : m.isCurrentMonth
                        ? colors.accent
                        : colors.textPrimary,
                      fontWeight: isSelected || m.isCurrentMonth ? '700' : '500',
                    },
                  ]}
                >
                  {m.shortLabel}
                </Text>
                {m.amount > 0 && !isSelected && (
                  <View
                    style={[
                      styles.monthSpendDot,
                      { backgroundColor: m.isCurrentMonth ? colors.accent : colors.textMuted },
                    ]}
                  />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* VIEW 1: CATEGORY DRILL-DOWN VIEW */}
      {selectedCategoryId && categoryInsights ? (
        <View style={{ marginTop: spacing.md }}>
          {/* Breadcrumb Back */}
          <Pressable
            onPress={() => setSelectedCategoryId(null)}
            style={styles.breadcrumbBar}
          >
            <ChevronLeft size={16} color={colors.accent} />
            <Text style={[styles.breadcrumbText, { color: colors.accent }]}>
              Back to {selectedMonthKey ? `${monthInsights?.monthName} Insights` : `${selectedYear} Overview`}
            </Text>
          </Pressable>

          {/* Category Header Card */}
          <Card style={[styles.mainCard, { backgroundColor: colors.surfaceElevated, marginTop: 8 }]}>
            <View style={styles.cardHeaderRow}>
              <View
                style={[
                  styles.categoryHeroBadge,
                  { backgroundColor: `${categoryInsights.category?.color || colors.accent}20` },
                ]}
              >
                {React.createElement(ICON_MAP[categoryInsights.category?.icon || 'Tag'] || Tag, {
                  size: 24,
                  color: categoryInsights.category?.color || colors.accent,
                })}
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.cardHeroTitle, { color: colors.textPrimary }]}>
                  {categoryInsights.categoryName}
                </Text>
                <Text style={[styles.cardHeroSubtitle, { color: colors.textSecondary }]}>
                  {categoryInsights.isGeneral
                    ? 'Monthly General Fallback Category'
                    : categoryInsights.isUncategorized
                    ? 'Default / Unclassified Expenses'
                    : 'Custom Global Expense Category'}
                </Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricCell}>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                  YEARLY TOTAL
                </Text>
                <AmountText
                  amount={categoryInsights.yearlyTotal}
                  size="headingLg"
                  variant="negative"
                />
              </View>
              <View style={styles.metricCell}>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                  SHARE OF {selectedYear}
                </Text>
                <Text style={[styles.metricLargeText, { color: colors.textPrimary }]}>
                  {categoryInsights.percentageOfYear.toFixed(1)}%
                </Text>
              </View>
              <View style={styles.metricCell}>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                  TRANSACTIONS
                </Text>
                <Text style={[styles.metricLargeText, { color: colors.textPrimary }]}>
                  {categoryInsights.transactionCount}
                </Text>
              </View>
              <View style={styles.metricCell}>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                  LARGEST EXPENSE
                </Text>
                <Text style={[styles.metricLargeText, { color: colors.textPrimary }]}>
                  {categoryInsights.largestExpense
                    ? formatRupee(categoryInsights.largestExpense.amount)
                    : '—'}
                </Text>
              </View>
            </View>
          </Card>

          {/* Monthly Trend for this Category */}
          <Card style={[styles.sectionCard, { marginTop: spacing.md }]}>
            <Text style={[styles.cardSectionTitle, { color: colors.textPrimary }]}>
              Monthly Trend ({selectedYear})
            </Text>
            <View style={styles.chartBarsContainer}>
              {categoryInsights.monthlyTrend.map((m) => (
                <View key={m.monthKey} style={styles.chartCol}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max(m.amount > 0 ? 8 : 0, m.percentageOfPeak)}%`,
                          backgroundColor: m.isCurrentMonth
                            ? colors.accent
                            : colors.textPrimary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barLabel, { color: colors.textMuted }]}>
                    {m.shortLabel.split(' ')[0]}
                  </Text>
                </View>
              ))}
            </View>
          </Card>

          {/* Transaction Drill-down */}
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary, marginBottom: 8 }]}>
              TRANSACTIONS IN {categoryInsights.categoryName.toUpperCase()} ({categoryInsights.transactions.length})
            </Text>
            {categoryInsights.transactions.length === 0 ? (
              <EmptyState title="No transactions" description="No expenses recorded for this category." />
            ) : (
              categoryInsights.transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  accountName={tx.accountId ? accountMap.get(tx.accountId) : undefined}
                  personName={tx.personId ? personMap.get(tx.personId) : undefined}
                  categoryName={categoryInsights.categoryName}
                  onPress={() => router.push(`/transaction/${tx.id}` as any)}
                />
              ))
            )}
          </View>
        </View>
      ) : selectedMonthKey && monthInsights ? (
        /* VIEW 2: MONTH VIEW */
        <View style={{ marginTop: spacing.md }}>
          {/* Breadcrumb Back */}
          <Pressable onPress={handleResetToYear} style={styles.breadcrumbBar}>
            <ChevronLeft size={16} color={colors.accent} />
            <Text style={[styles.breadcrumbText, { color: colors.accent }]}>
              Back to {selectedYear} Year Overview
            </Text>
          </Pressable>

          {/* Month Summary Card */}
          <Card style={[styles.mainCard, { backgroundColor: colors.surfaceElevated, marginTop: 8 }]}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              TOTAL SPENT IN {monthInsights.shortLabel.toUpperCase()}
            </Text>
            <AmountText amount={monthInsights.totalSpent} size="hero" variant="negative" />

            <View style={[styles.metricsGrid, { marginTop: 14 }]}>
              <View style={styles.metricCell}>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                  TRANSACTIONS
                </Text>
                <Text style={[styles.metricLargeText, { color: colors.textPrimary }]}>
                  {monthInsights.transactionCount}
                </Text>
              </View>
              <View style={styles.metricCell}>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                  LARGEST EXPENSE
                </Text>
                <Text style={[styles.metricLargeText, { color: colors.textPrimary }]}>
                  {monthInsights.largestExpense
                    ? formatRupee(monthInsights.largestExpense.amount)
                    : '—'}
                </Text>
              </View>
            </View>

            {monthInsights.isFuture ? (
              <View style={[styles.futureNotice, { backgroundColor: `${colors.accent}15` }]}>
                <Text style={[styles.futureNoticeText, { color: colors.accent }]}>
                  Upcoming month · Totals will update as expenses occur
                </Text>
              </View>
            ) : null}
          </Card>

          {/* Month Category Breakdown */}
          <Card style={[styles.sectionCard, { marginTop: spacing.md }]}>
            <Text style={[styles.cardSectionTitle, { color: colors.textPrimary, marginBottom: 12 }]}>
              Category Breakdown
            </Text>

            {monthInsights.categoryBreakdown.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
                No category data recorded for this month
              </Text>
            ) : (
              monthInsights.categoryBreakdown.map((cat) => {
                const CatIcon = ICON_MAP[cat.icon] || Tag;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => handleSelectCategory(cat.id)}
                    style={styles.categoryBreakdownRow}
                  >
                    <View style={styles.categoryRowTop}>
                      <View style={styles.categoryRowLeft}>
                        <View style={[styles.catIconMini, { backgroundColor: `${cat.color || colors.accent}20` }]}>
                          <CatIcon size={14} color={cat.color || colors.accent} />
                        </View>
                        <Text style={[styles.categoryRowName, { color: colors.textPrimary }]}>
                          {cat.name}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.categoryRowAmount, { color: colors.textPrimary }]}>
                          {formatRupee(cat.amount)}
                        </Text>
                        <Text style={[styles.categoryRowPercent, { color: colors.textSecondary }]}>
                          {cat.percentage.toFixed(1)}% · {cat.transactionCount} tx
                        </Text>
                      </View>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(100, Math.max(3, cat.percentage))}%`,
                            backgroundColor: cat.color || colors.accent,
                          },
                        ]}
                      />
                    </View>
                  </Pressable>
                );
              })
            )}
          </Card>

          {/* Month Transaction Drill-down */}
          <View style={{ marginTop: spacing.lg }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                EXPENSES IN {monthInsights.monthName.toUpperCase()} ({monthInsights.transactions.length})
              </Text>
            </View>

            {monthInsights.transactions.length === 0 ? (
              <EmptyState
                title="No expenses"
                description={`No expenses recorded for ${monthInsights.shortLabel}.`}
              />
            ) : (
              monthInsights.transactions.map((tx) => (
                <View key={tx.id} style={{ marginBottom: 4 }}>
                  <TransactionRow
                    transaction={tx}
                    accountName={tx.accountId ? accountMap.get(tx.accountId) : undefined}
                    personName={tx.personId ? personMap.get(tx.personId) : undefined}
                    categoryName={tx.categoryId ? categoryMap.get(tx.categoryId) : 'Uncategorized'}
                    onPress={() => router.push(`/transaction/${tx.id}` as any)}
                  />

                  {/* If transaction is unassigned, offer quick-assign to this month's General */}
                  {!tx.categoryId ? (
                    <Pressable
                      onPress={() => handleAssignToMonthGeneral(tx, monthInsights.monthKey)}
                      style={[styles.quickAssignBadge, { borderColor: colors.borderSubtle }]}
                    >
                      <Folder size={12} color={colors.accent} />
                      <Text style={[styles.quickAssignText, { color: colors.accent }]}>
                        Assign to {monthInsights.shortLabel} · General
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </View>
      ) : (
        /* VIEW 3: FULL YEAR OVERVIEW */
        <View style={{ marginTop: spacing.md }}>
          {/* Main Year Card */}
          <Card style={[styles.mainCard, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              TOTAL SPENT IN {selectedYear}
            </Text>
            <AmountText amount={yearInsights.totalSpent} size="hero" variant="negative" />

            <View style={[styles.metricsGrid, { marginTop: 14 }]}>
              <View style={styles.metricCell}>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                  MONTHLY AVERAGE
                </Text>
                <AmountText
                  amount={yearInsights.averageMonthlySpend}
                  size="headingLg"
                  variant="default"
                />
                <Text style={[styles.metricMicro, { color: colors.textMuted }]}>
                  Over {yearInsights.elapsedMonthsCount} elapsed months
                </Text>
              </View>

              <View style={styles.metricCell}>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                  PEAK MONTH
                </Text>
                <Text style={[styles.metricLargeText, { color: colors.textPrimary }]}>
                  {yearInsights.highestSpendMonth
                    ? yearInsights.highestSpendMonth.shortLabel
                    : '—'}
                </Text>
                <Text style={[styles.metricMicro, { color: colors.textMuted }]}>
                  {yearInsights.highestSpendMonth
                    ? formatRupee(yearInsights.highestSpendMonth.amount)
                    : 'No spend'}
                </Text>
              </View>

              <View style={[styles.metricCell, { minWidth: '100%' }]}>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                  TOP CATEGORY
                </Text>
                <Text style={[styles.metricLargeText, { color: colors.textPrimary }]}>
                  {yearInsights.topCategory
                    ? `${yearInsights.topCategory.name} (${yearInsights.topCategory.percentage.toFixed(0)}%)`
                    : '—'}
                </Text>
                <Text style={[styles.metricMicro, { color: colors.textMuted }]}>
                  {yearInsights.topCategory
                    ? formatRupee(yearInsights.topCategory.amount)
                    : 'No spend'}
                </Text>
              </View>
            </View>
          </Card>

          {/* Monthly Spending Trend Bar Chart */}
          <Card style={[styles.sectionCard, { marginTop: spacing.md }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.cardSectionTitle, { color: colors.textPrimary }]}>
                Monthly Spending Trend
              </Text>
              <Text style={[styles.metricMicro, { color: colors.textSecondary }]}>
                Tap month to inspect
              </Text>
            </View>

            <View style={styles.chartBarsContainer}>
              {yearInsights.monthlyTrends.map((m) => (
                <Pressable
                  key={m.monthKey}
                  onPress={() => handleSelectMonth(m.monthKey)}
                  style={styles.chartCol}
                >
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max(m.amount > 0 ? 8 : 0, m.percentageOfPeak)}%`,
                          backgroundColor: m.isCurrentMonth
                            ? colors.accent
                            : m.isFuture
                            ? 'rgba(148,163,184,0.15)'
                            : colors.textPrimary,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.barLabel,
                      {
                        color: m.isCurrentMonth
                          ? colors.accent
                          : m.isFuture
                          ? colors.textMuted
                          : colors.textSecondary,
                        fontWeight: m.isCurrentMonth ? '700' : '400',
                      },
                    ]}
                  >
                    {m.shortLabel.split(' ')[0]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>

          {/* Full Year Category Breakdown */}
          <Card style={[styles.sectionCard, { marginTop: spacing.md }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.cardSectionTitle, { color: colors.textPrimary }]}>
                Category Breakdown ({yearInsights.categoryBreakdown.length})
              </Text>
              <Text style={[styles.metricMicro, { color: colors.textSecondary }]}>
                Sorted by amount
              </Text>
            </View>

            {yearInsights.categoryBreakdown.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 14 }}>
                No expense data recorded in {selectedYear}
              </Text>
            ) : (
              yearInsights.categoryBreakdown.map((cat) => {
                const CatIcon = ICON_MAP[cat.icon] || Tag;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => handleSelectCategory(cat.id)}
                    style={styles.categoryBreakdownRow}
                  >
                    <View style={styles.categoryRowTop}>
                      <View style={styles.categoryRowLeft}>
                        <View style={[styles.catIconMini, { backgroundColor: `${cat.color || colors.accent}20` }]}>
                          <CatIcon size={14} color={cat.color || colors.accent} />
                        </View>
                        <Text style={[styles.categoryRowName, { color: colors.textPrimary }]}>
                          {cat.name}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.categoryRowAmount, { color: colors.textPrimary }]}>
                          {formatRupee(cat.amount)}
                        </Text>
                        <Text style={[styles.categoryRowPercent, { color: colors.textSecondary }]}>
                          {cat.percentage.toFixed(1)}% · {cat.transactionCount} tx
                        </Text>
                      </View>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(100, Math.max(3, cat.percentage))}%`,
                            backgroundColor: cat.color || colors.accent,
                          },
                        ]}
                      />
                    </View>
                  </Pressable>
                );
              })
            )}
          </Card>
        </View>
      )}

      {/* Category Manager Modal */}
      <Modal visible={managerVisible} animationType="slide" transparent onRequestClose={() => setManagerVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setManagerVisible(false)} />
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surfaceElevated || colors.surface,
                borderTopLeftRadius: radii.xl,
                borderTopRightRadius: radii.xl,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Manage Categories
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Create, rename, archive custom categories
                </Text>
              </View>
              <Pressable
                onPress={() => setManagerVisible(false)}
                hitSlop={10}
                style={[styles.closeBtn, { backgroundColor: colors.borderSubtle }]}
              >
                <X size={18} color={colors.textPrimary} />
              </Pressable>
            </View>

            <KeyboardAwareScrollView style={{ flex: 0, flexShrink: 1 }} showsVerticalScrollIndicator={false}>
              {/* Quick Add Form */}
              <View style={[styles.quickAddCard, { backgroundColor: isDark ? colors.surfaceSubtle : 'rgba(0,0,0,0.02)' }]}>
                <Text style={[styles.quickAddTitle, { color: colors.textPrimary }]}>
                  {editingCategory ? 'Rename / Edit Category' : 'Create New Category'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TextInput
                    value={newCatName}
                    onChangeText={setNewCatName}
                    placeholder="Category Name"
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.quickAddInput,
                      {
                        color: colors.textPrimary,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                        borderRadius: radii.sm,
                      },
                    ]}
                  />
                  <Pressable
                    onPress={handleSaveCategoryInManager}
                    disabled={isSavingCategory}
                    style={[
                      styles.quickAddSaveBtn,
                      {
                        backgroundColor: colors.accent,
                        borderRadius: radii.sm,
                        opacity: isSavingCategory ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                      {isSavingCategory ? 'Saving...' : editingCategory ? 'Update' : 'Add'}
                    </Text>
                  </Pressable>
                  {editingCategory ? (
                    <Pressable
                      onPress={() => {
                        setEditingCategory(null);
                        setNewCatName('');
                      }}
                      style={[styles.quickAddCancelBtn, { borderColor: colors.border, borderRadius: radii.sm }]}
                    >
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Cancel</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {/* Category List */}
              <View style={{ marginTop: 14 }}>
                <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                  CUSTOM & GENERAL CATEGORIES
                </Text>

                {allCategoriesList.map((cat) => {
                  const CatIcon = ICON_MAP[cat.icon] || Tag;
                  const isGeneral = isMonthlyGeneralCategory(cat);

                  return (
                    <View
                      key={cat.id}
                      style={[
                        styles.managerRow,
                        {
                          borderColor: colors.borderSubtle,
                          opacity: cat.isArchived ? 0.45 : 1,
                        },
                      ]}
                    >
                      <View style={styles.managerRowLeft}>
                        <View style={[styles.catIconMini, { backgroundColor: `${cat.color || colors.accent}20` }]}>
                          <CatIcon size={14} color={cat.color || colors.accent} />
                        </View>
                        <View>
                          <Text style={[styles.managerCatName, { color: colors.textPrimary }]}>
                            {cat.name}
                          </Text>
                          <Text style={[styles.managerCatMeta, { color: colors.textMuted }]}>
                            {isGeneral
                              ? 'Monthly general fallback'
                              : cat.isArchived
                              ? 'Archived (hidden from new expenses)'
                              : 'Active custom category'}
                          </Text>
                        </View>
                      </View>

                      {!isGeneral && !cat.isDefault ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Pressable
                            onPress={() => {
                              setEditingCategory(cat);
                              setNewCatName(cat.name);
                              setNewCatColor(cat.color || COLOR_PALETTE[0]);
                            }}
                            hitSlop={8}
                            style={styles.actionIconBtn}
                          >
                            <Edit2 size={15} color={colors.textSecondary} />
                          </Pressable>
                          <Pressable
                            onPress={() => handleToggleArchiveInManager(cat)}
                            hitSlop={8}
                            style={styles.actionIconBtn}
                          >
                            <Archive
                              size={15}
                              color={cat.isArchived ? colors.accent : '#EF4444'}
                            />
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </KeyboardAwareScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  yearSelectorRow: {
    marginTop: 6,
    marginBottom: 4,
  },
  yearPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderWidth: 1,
  },
  yearPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  monthScrollContainer: {
    marginVertical: 6,
  },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  monthPillText: {
    fontSize: 12,
  },
  monthSpendDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  mainCard: {
    padding: 18,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryHeroBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeroTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  cardHeroSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  metricCell: {
    flex: 1,
    minWidth: '45%',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metricLargeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  metricMicro: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionCard: {
    padding: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  chartBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 130,
    marginTop: 12,
    paddingTop: 10,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: 14,
    height: 90,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(148,163,184,0.08)',
    borderRadius: 7,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barLabel: {
    fontSize: 10,
    marginTop: 6,
  },
  categoryBreakdownRow: {
    marginBottom: 12,
  },
  categoryRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  categoryRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catIconMini: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryRowName: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoryRowAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  categoryRowPercent: {
    fontSize: 11,
  },
  progressBarTrack: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(148,163,184,0.15)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  breadcrumbBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  breadcrumbText: {
    fontSize: 13,
    fontWeight: '600',
  },
  futureNotice: {
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  futureNoticeText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  quickAssignBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginLeft: 12,
    marginBottom: 6,
  },
  quickAssignText: {
    fontSize: 11,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.2)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddCard: {
    padding: 14,
    borderRadius: 10,
    marginTop: 14,
  },
  quickAddTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  quickAddInput: {
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
  },
  quickAddSaveBtn: {
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddCancelBtn: {
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  managerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  managerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  managerCatName: {
    fontSize: 14,
    fontWeight: '600',
  },
  managerCatMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  actionIconBtn: {
    padding: 6,
  },
});
