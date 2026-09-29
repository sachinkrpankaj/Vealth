import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, TrendingUp, ShieldCheck } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { AmountText } from '../../src/components/ui/AmountText';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { CategoryBreakdownChart, CategoryBreakdownItem } from '../../src/components/charts/CategoryBreakdownChart';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { useTheme } from '../../src/theme';
import { formatRupee } from '../../src/domain/finance/currency';

export default function AnalyticsScreen() {
  const { colors, typography, radii, spacing } = useTheme();
  const { transactions, netWorth, refresh } = useFinancialData();

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Aggregate category spending this month
  const categoryStats = useMemo(() => {
    const expenseMap = new Map<string, number>();
    const incomeMap = new Map<string, number>();

    let totalExpense = 0;
    let totalIncome = 0;

    for (const tx of transactions) {
      if (tx.deletedAt) continue;
      if (!tx.date.startsWith(currentMonth)) continue;

      const amt = Math.abs(tx.amount);
      const catKey = tx.categoryId || 'General';

      if (tx.type === 'EXPENSE') {
        totalExpense += amt;
        expenseMap.set(catKey, (expenseMap.get(catKey) || 0) + amt);
      } else if (tx.type === 'INCOME') {
        totalIncome += amt;
        incomeMap.set(catKey, (incomeMap.get(catKey) || 0) + amt);
      }
    }

    const formatCategoryName = (key: string) => {
      if (key.startsWith('cat-')) {
        return key.replace('cat-', '').replace(/-/g, ' ');
      }
      return key;
    };

    const expenseItems: CategoryBreakdownItem[] = Array.from(expenseMap.entries())
      .map(([cat, amt]) => ({
        id: cat,
        name: formatCategoryName(cat),
        amount: amt,
        percentage: totalExpense > 0 ? (amt / totalExpense) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const incomeItems: CategoryBreakdownItem[] = Array.from(incomeMap.entries())
      .map(([cat, amt]) => ({
        id: cat,
        name: formatCategoryName(cat),
        amount: amt,
        percentage: totalIncome > 0 ? (amt / totalIncome) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      expenseItems,
      incomeItems,
      totalExpense,
      totalIncome,
    };
  }, [transactions, currentMonth]);

  const savingsRate =
    categoryStats.totalIncome > 0
      ? Math.max(
          0,
          Math.round(
            ((categoryStats.totalIncome - categoryStats.totalExpense) /
              categoryStats.totalIncome) *
              100
          )
        )
      : 0;

  return (
    <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.full,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <ArrowLeft size={18} color={colors.textPrimary} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Financial Analytics</Text>

        <View style={{ width: 36 }} />
      </View>

      {/* Cashflow Summary Hero */}
      <Card style={[styles.heroCard, { backgroundColor: colors.surfaceElevated }]}>
        <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
          Cash Flow This Month
        </Text>

        <View style={styles.cashflowRow}>
          <View style={styles.cashflowItem}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <ArrowDownLeft size={16} color={colors.positive} style={{ marginRight: 4 }} />
              <Text style={[styles.flowLabel, { color: colors.textMuted }]}>Income</Text>
            </View>
            <AmountText
              amount={categoryStats.totalIncome}
              size="headingMd"
              variant="positive"
            />
          </View>

          <View style={[styles.dividerVertical, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.cashflowItem}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <ArrowUpRight size={16} color={colors.negative} style={{ marginRight: 4 }} />
              <Text style={[styles.flowLabel, { color: colors.textMuted }]}>Expenses</Text>
            </View>
            <AmountText
              amount={categoryStats.totalExpense}
              size="headingMd"
              variant="negative"
            />
          </View>
        </View>

        <View style={[styles.netSavingsBanner, { backgroundColor: colors.surface, borderRadius: radii.md }]}>
          <Text style={[styles.savingsLabel, { color: colors.textSecondary }]}>
            Net Savings: {formatRupee(categoryStats.totalIncome - categoryStats.totalExpense)}
          </Text>
          <Text style={[styles.savingsRate, { color: colors.accent }]}>
            {savingsRate}% saved
          </Text>
        </View>
      </Card>

      {/* Spending by Category */}
      <SectionHeader title="Top Spending Categories" />
      <Card style={styles.chartCard}>
        <CategoryBreakdownChart
          items={categoryStats.expenseItems}
          emptyMessage="No expenses recorded for this month."
        />
      </Card>

      {/* Income Sources */}
      {categoryStats.incomeItems.length > 0 ? (
        <>
          <SectionHeader title="Income Breakdown" />
          <Card style={styles.chartCard}>
            <CategoryBreakdownChart
              items={categoryStats.incomeItems}
              emptyMessage="No income recorded for this month."
            />
          </Card>
        </>
      ) : null}

      {/* Solvency / Asset vs Liability Health */}
      <SectionHeader title="Financial Solvency" />
      <Card style={styles.solvencyCard}>
        <View style={styles.solvencyRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.solvencyLabel, { color: colors.textSecondary }]}>
              Asset to Debt Ratio
            </Text>
            <Text
              style={[
                styles.solvencyValue,
                { color: colors.textPrimary, fontSize: typography.fontSizes.headingMd },
              ]}
            >
              {netWorth.totalLiabilities > 0
                ? `${(netWorth.totalAssets / netWorth.totalLiabilities).toFixed(1)}x`
                : 'Debt Free'}
            </Text>
          </View>

          <View
            style={[
              styles.healthBadge,
              {
                backgroundColor:
                  netWorth.netWorth >= 0 ? colors.positiveBg : colors.negativeBg,
                borderRadius: radii.full,
              },
            ]}
          >
            <Text
              style={[
                styles.healthText,
                {
                  color:
                    netWorth.netWorth >= 0 ? colors.positive : colors.negative,
                },
              ]}
            >
              {netWorth.netWorth >= 0 ? 'Healthy' : 'Deficit'}
            </Text>
          </View>
        </View>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  heroCard: {
    padding: 20,
    marginBottom: 16,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 14,
  },
  cashflowRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  cashflowItem: {
    flex: 1,
  },
  flowLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  dividerVertical: {
    width: 1,
    marginHorizontal: 16,
  },
  netSavingsBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  savingsLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  savingsRate: {
    fontSize: 13,
    fontWeight: '700',
  },
  chartCard: {
    padding: 16,
    marginBottom: 8,
  },
  solvencyCard: {
    padding: 16,
    marginBottom: 16,
  },
  solvencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  solvencyLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  solvencyValue: {
    fontWeight: '700',
  },
  healthBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  healthText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
