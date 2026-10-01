import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Wallet, ShieldAlert, HandCoins, Building2 } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { AmountText } from '../../src/components/ui/AmountText';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { NetWorthChart, ChartDataPoint, TimeRange } from '../../src/components/charts/NetWorthChart';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { useTheme } from '../../src/theme';
import { getAllSnapshots, getSnapshotsForRange } from '../../src/database/repositories/snapshotRepository';
import { formatRupee } from '../../src/domain/finance/currency';

const RANGES: { label: string; range: TimeRange; days: number }[] = [
  { label: '7D', range: '7D', days: 7 },
  { label: '30D', range: '30D', days: 30 },
  { label: '3M', range: '3M', days: 90 },
  { label: '6M', range: '6M', days: 180 },
  { label: '1Y', range: '1Y', days: 365 },
  { label: 'ALL', range: 'ALL', days: 9999 },
];

export default function NetWorthScreen() {
  const { colors, typography, radii, spacing } = useTheme();
  const { netWorth, refresh } = useFinancialData();

  const [selectedRange, setSelectedRange] = useState<TimeRange>('30D');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  const loadChartData = async () => {
    const rangeConfig = RANGES.find((r) => r.range === selectedRange);
    const days = rangeConfig ? rangeConfig.days : 30;

    const snapshots =
      days > 1000 ? await getAllSnapshots() : await getSnapshotsForRange(days);

    const todayStr = new Date().toISOString().split('T')[0];

    if (snapshots.length === 0) {
      // Just current net worth point
      setChartData([
        {
          date: todayStr,
          label: 'Today',
          value: netWorth.netWorth,
        },
      ]);
      return;
    }

    const points: ChartDataPoint[] = snapshots.map((s) => {
      const parts = s.date.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIndex = parseInt(parts[1], 10) - 1;
      const label = `${monthNames[monthIndex] || ''} ${parseInt(parts[2], 10)}`;
      return {
        date: s.date,
        label,
        value: s.netWorth,
      };
    });

    // If today is not in snapshots, append current live net worth
    if (!snapshots.some((s) => s.date === todayStr)) {
      points.push({
        date: todayStr,
        label: 'Today',
        value: netWorth.netWorth,
      });
    }

    setChartData(points);
  };

  useFocusEffect(
    React.useCallback(() => {
      refresh();
      loadChartData();
    }, [refresh, selectedRange])
  );

  return (
    <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        <LiquidGlassCard onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back"
          radius={radii.full} padding={0} style={styles.iconBtn}>
          <ArrowLeft size={18} color={colors.textPrimary} />
        </LiquidGlassCard>

        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Net Worth</Text>

        <View style={{ width: 36 }} />
      </View>

      {/* Main Net Worth Value Card */}
      <Card style={[styles.heroCard, { backgroundColor: colors.surfaceElevated }]}>
        <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
          Current Net Worth
        </Text>
        <AmountText
          amount={netWorth.netWorth}
          size="hero"
          style={{ marginVertical: 4 }}
        />

        <View style={styles.changeRow}>
          <Text
            style={[
              styles.changeText,
              {
                color:
                  netWorth.netWorthChangeMonth >= 0 ? colors.positive : colors.negative,
              },
            ]}
          >
            {netWorth.netWorthChangeMonth >= 0 ? '+' : ''}
            {formatRupee(netWorth.netWorthChangeMonth)} this month
          </Text>
        </View>

        {/* Chart Range Pills */}
        <View style={styles.rangeRow}>
          {RANGES.map((r) => {
            const isSelected = selectedRange === r.range;
            return (
              <LiquidGlassCard key={r.range} onPress={() => setSelectedRange(r.range)}
                accessibilityLabel={`${r.label} range`} accessibilityState={{ selected: isSelected }}
                tone={isSelected ? 'emphasized' : 'default'}
                radius={radii.sm} padding={0} style={styles.rangePill}>
                <Text
                  style={[
                    styles.rangePillText,
                    {
                      color: isSelected ? '#FFFFFF' : colors.textSecondary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {r.label}
                </Text>
              </LiquidGlassCard>
            );
          })}
        </View>

        {/* Net Worth Chart */}
        <NetWorthChart data={chartData} height={180} />
      </Card>

      {/* Assets vs Liabilities Breakdown */}
      <SectionHeader title="Balance Sheet Breakdown" />

      {/* Assets Card */}
      <Card style={styles.breakdownCard}>
        <View style={styles.breakdownHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Wallet size={18} color={colors.positive} style={{ marginRight: 8 }} />
            <Text style={[styles.breakdownTitle, { color: colors.textPrimary }]}>
              Total Assets
            </Text>
          </View>
          <AmountText
            amount={netWorth.totalAssets}
            size="headingSm"
            variant="positive"
          />
        </View>

        <View style={[styles.subItem, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
          <Text style={[styles.subItemLabel, { color: colors.textSecondary }]}>
            Cash & Bank Accounts
          </Text>
          <AmountText
            amount={netWorth.totalAccountBalances}
            size="body"
          />
        </View>

        <View style={[styles.subItem, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
          <Text style={[styles.subItemLabel, { color: colors.textSecondary }]}>
            Physical & Investment Assets
          </Text>
          <AmountText
            amount={netWorth.totalPhysicalAssets}
            size="body"
          />
        </View>
      </Card>

      {/* Liabilities Card */}
      <Card style={[styles.breakdownCard, { marginTop: 12 }]}>
        <View style={styles.breakdownHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ShieldAlert size={18} color={colors.negative} style={{ marginRight: 8 }} />
            <Text style={[styles.breakdownTitle, { color: colors.textPrimary }]}>
              Total Liabilities
            </Text>
          </View>
          <AmountText
            amount={netWorth.totalLiabilities}
            size="headingSm"
            variant={netWorth.totalLiabilities > 0 ? 'negative' : 'default'}
          />
        </View>

        <View style={[styles.subItem, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
          <Text style={[styles.subItemLabel, { color: colors.textSecondary }]}>
            Standalone Loans & Overdrafts
          </Text>
          <AmountText
            amount={netWorth.totalStandaloneLiabilities}
            size="body"
            variant={netWorth.totalStandaloneLiabilities > 0 ? 'negative' : 'default'}
          />
        </View>
      </Card>

      {/* Personal Credit & Debt Card */}
      <Card style={[styles.breakdownCard, { marginTop: 12 }]}>
        <View style={styles.breakdownHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <HandCoins size={18} color={colors.accent} style={{ marginRight: 8 }} />
            <Text style={[styles.breakdownTitle, { color: colors.textPrimary }]}>
              Personal Credit & Debt
            </Text>
          </View>
          <AmountText
            amount={netWorth.totalReceivables - netWorth.totalPayables}
            size="headingSm"
            variant={
              netWorth.totalReceivables >= netWorth.totalPayables ? 'positive' : 'negative'
            }
          />
        </View>

        <View style={[styles.subItem, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
          <Text style={[styles.subItemLabel, { color: colors.textSecondary }]}>
            Credit to Collect (Owed to You)
          </Text>
          <AmountText
            amount={netWorth.totalReceivables}
            size="body"
            variant="positive"
          />
        </View>

        <View style={[styles.subItem, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
          <Text style={[styles.subItemLabel, { color: colors.textSecondary }]}>
            Debt (Owed to Others)
          </Text>
          <AmountText
            amount={netWorth.totalPayables}
            size="body"
            variant={netWorth.totalPayables > 0 ? 'negative' : 'default'}
          />
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
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  changeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  rangePill: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
  },
  rangePillText: {
    fontSize: 11,
  },
  breakdownCard: {
    paddingVertical: 0,
    paddingHorizontal: 16,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  breakdownTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  subItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  subItemLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
});
