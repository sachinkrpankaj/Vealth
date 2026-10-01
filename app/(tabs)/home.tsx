import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  ChevronRight,
  HandCoins,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  ArrowRightLeft,
  Eye,
  EyeOff,
  ArrowRight,
  Wallet,
  Building2,
  Gem,
  Plus,
  Landmark,
  CreditCard,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Activity,
} from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { AppHeader } from '../../src/components/navigation/AppHeader';
import { RadialArcGauge } from '../../src/components/charts/RadialArcGauge';
import { TransactionRow } from '../../src/components/ui/TransactionRow';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { PayCreditCardBillModal } from '../../src/components/ui/PayCreditCardBillModal';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { useTheme } from '../../src/theme';
import { formatRupee, formatRupeeMasked } from '../../src/domain/finance/currency';
import { getCreditCardBillingInfo, formatDayOrdinal } from '../../src/domain/finance/creditCardBilling';
import { Account } from '../../src/domain/finance/types';
import { useCountingAnimation } from '../../src/hooks/useCountingAnimation';
import { AmountText } from '../../src/components/ui/AmountText';
import * as Haptics from 'expo-haptics';

export default function HomeScreen() {
  const { colors, typography, radii, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isNarrow = screenWidth < 360;
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [selectedCardForPayment, setSelectedCardForPayment] = useState<Account | null>(null);
  const [isPayBillModalVisible, setIsPayBillModalVisible] = useState(false);
  const [activeBillAmount, setActiveBillAmount] = useState<number>(0);
  const {
    isLoading,
    userName,
    netWorth,
    personDebts,
    transactions,
    accounts,
    accountBalances,
    people,
    refresh,
  } = useFinancialData();

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  // People counts
  const owedToYouPeopleCount = personDebts.filter((p) => p.owedToYou > 0).length;
  const youOwePeopleCount = personDebts.filter((p) => p.youOwe > 0).length;

  // Account maps for quick name lookup in rows
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const personMap = new Map(people.map((p) => [p.id, p.name]));

  // Recent 5 transactions
  const recentTransactions = transactions.slice(0, 5);

  // Solvency score calculation
  const totalAssetsVal = Math.max(0, netWorth.totalAssets);
  const totalDebtObligations = Math.max(0, netWorth.totalLiabilities + netWorth.totalPayables);
  const totalBase = totalAssetsVal + totalDebtObligations;
  const rawScore = totalBase === 0 ? 100 : Math.round((totalAssetsVal / totalBase) * 100);
  const solvencyScore = Math.max(10, Math.min(100, isNaN(rawScore) ? 100 : rawScore));

  const animatedNetWorth = useCountingAnimation(netWorth.netWorth, {
    isMasked: isBalanceHidden,
    formatOptions: { spaceAfterSymbol: true },
    duration: 850,
  });

  const animatedMonthChange = useCountingAnimation(netWorth.netWorthChangeMonth, {
    isMasked: isBalanceHidden,
    formatOptions: { showSign: true, spaceAfterSymbol: false },
    duration: 750,
  });

  const animatedSolvency = useCountingAnimation(solvencyScore, {
    isMinorUnits: false,
    duration: 850,
  });

  const solvencyStatus = React.useMemo(() => {
    const val = animatedSolvency.displayValue;
    if (val >= 80) {
      return {
        label: 'Optimal',
        color: colors.positive,
        gradient: ['#10B981', '#059669'] as [string, string],
        bg: isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.10)',
        border: isDark ? 'rgba(16, 185, 129, 0.28)' : 'rgba(16, 185, 129, 0.18)',
      };
    }
    if (val >= 65) {
      return {
        label: 'Good',
        color: '#10B981',
        gradient: ['#34D399', '#059669'] as [string, string],
        bg: isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.10)',
        border: isDark ? 'rgba(16, 185, 129, 0.28)' : 'rgba(16, 185, 129, 0.18)',
      };
    }
    if (val >= 50) {
      return {
        label: 'Moderate',
        color: colors.warning,
        gradient: ['#F59E0B', '#D97706'] as [string, string],
        bg: isDark ? 'rgba(245, 158, 11, 0.14)' : 'rgba(245, 158, 11, 0.10)',
        border: isDark ? 'rgba(245, 158, 11, 0.28)' : 'rgba(245, 158, 11, 0.18)',
      };
    }
    return {
      label: 'At Risk',
      color: colors.negative,
      gradient: ['#EF4444', '#DC2626'] as [string, string],
      bg: isDark ? 'rgba(239, 68, 68, 0.14)' : 'rgba(239, 68, 68, 0.10)',
      border: isDark ? 'rgba(239, 68, 68, 0.28)' : 'rgba(239, 68, 68, 0.18)',
    };
  }, [animatedSolvency.displayValue, colors, isDark]);

  // Breakdown figures for Financial Flow
  const cashBalance = accounts
    .filter((a) => a.type === 'CASH')
    .reduce((sum, a) => sum + (accountBalances.get(a.id) ?? 0), 0);
  const bankBalance = accounts
    .filter((a) => a.type === 'BANK')
    .reduce((sum, a) => sum + (accountBalances.get(a.id) ?? 0), 0);

  return (
    <ScreenContainer scrollable hasTabBar contentContainerStyle={styles.scrollContent}>
      {/* 1. Header (matching Reference Image 1) */}
      <AppHeader
        title="vaelth"
        onProfilePress={() => router.push('/profile')}
        actionIcon={<Plus size={18} color={colors.textPrimary} strokeWidth={2.4} />}
        actionAccessibilityLabel="Add transaction"
        onActionPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push('/transaction/add');
        }}
        onRightPress={() => setIsBalanceHidden(!isBalanceHidden)}
        rightAccessibilityLabel={isBalanceHidden ? 'Show balance' : 'Hide balance'}
        rightIcon={
          isBalanceHidden ? (
            <EyeOff size={18} color={colors.textSecondary} />
          ) : (
            <Eye size={18} color={colors.textSecondary} />
          )
        }
      />

      {/* 2. Top Context & GIANT Display Numbers */}
      <View style={styles.heroSection}>
        <Pressable
          onPress={() => router.push('/net-worth')}
          accessibilityRole="button"
          accessibilityLabel="Total Net Worth, See more"
          style={styles.contextSubLabelRow}
          hitSlop={12}
        >
          <Text
            style={[
              styles.contextSubLabel,
              {
                color: colors.textSecondary,
                fontFamily: typography.fontFamilies.medium,
              },
            ]}
          >
            Total Net Worth
          </Text>
          <Text
            style={[
              styles.seeMoreLink,
              {
                color: colors.gold,
                fontFamily: typography.fontFamilies.semibold,
              },
            ]}
          >
            See more
          </Text>
          <ChevronRight size={13} color={colors.gold} />
        </Pressable>

        {/* GIANT Amount Typography */}
        <Text
          style={[
            styles.giantAmountText,
            {
              color: colors.textPrimary,
              fontFamily: typography.fontFamilies.extrabold,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {animatedNetWorth.formattedText}
        </Text>

        {/* Delta Change Pill */}
        <View
          style={[
            styles.deltaPill,
            {
              backgroundColor:
                netWorth.netWorthChangeMonth >= 0 ? colors.positiveBg : colors.negativeBg,
              borderColor:
                netWorth.netWorthChangeMonth >= 0
                  ? 'rgba(16, 185, 129, 0.25)'
                  : 'rgba(244, 63, 94, 0.25)',
            },
          ]}
        >
          <Text
            style={[
              styles.deltaText,
              {
                color: netWorth.netWorthChangeMonth >= 0 ? colors.positive : colors.negative,
                fontFamily: typography.fontFamilies.bold,
              },
            ]}
          >
            {isBalanceHidden
              ? `${animatedMonthChange.formattedText} this month`
              : `${animatedMonthChange.displayValue >= 0 ? '+' : ''}${animatedMonthChange.formattedText} this month`}
          </Text>
        </View>
      </View>

      {/* 3. Modular Bento Grid (Health Score & Debts with matching heights) */}
      <View style={styles.bentoGrid}>
        {/* Left Column: Radial Arc Solvency Gauge Tile */}
        <LiquidGlassCard
          style={styles.gaugeTile}
          contentStyle={styles.gaugeTileContent}
          radius={20}
          padding={12}
          onPress={() => router.push('/analytics')}
        >
          {/* Header matching Right Column cards */}
          <View style={styles.gaugeTileHeader}>
            <Text
              style={[
                styles.statTileLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamilies.medium,
                },
              ]}
            >
              Solvency
            </Text>
            <View style={[styles.gaugeHeaderIconWrap, { backgroundColor: solvencyStatus.bg }]}>
              <Activity size={13} color={solvencyStatus.color} strokeWidth={2.4} />
            </View>
          </View>

          {/* Center Arc Gauge */}
          <View style={styles.gaugeCenterWrap}>
            <RadialArcGauge
              percentage={animatedSolvency.displayValue}
              size={isNarrow ? 88 : 98}
              strokeWidth={isNarrow ? 6.5 : 7.5}
              color={solvencyStatus.color}
              gradientColors={solvencyStatus.gradient}
              trackColor={
                isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)'
              }
            />
          </View>

          {/* Footer Status Pill */}
          <View style={styles.gaugeFooterRow}>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: solvencyStatus.bg,
                  borderColor: solvencyStatus.border,
                },
              ]}
            >
              <View style={[styles.statusDot, { backgroundColor: solvencyStatus.color }]} />
              <Text
                style={[
                  styles.statusPillText,
                  {
                    color: solvencyStatus.color,
                    fontFamily: typography.fontFamilies.semibold,
                  },
                ]}
              >
                {solvencyStatus.label}
              </Text>
            </View>
            <Text
              style={[
                styles.gaugeFooterHint,
                {
                  color: colors.textMuted,
                  fontFamily: typography.fontFamilies.medium,
                },
              ]}
            >
              Health Score
            </Text>
          </View>
        </LiquidGlassCard>

        {/* Right Column: 2 Stacked Cards (Credit to Collect & Debt) */}
        <View style={styles.rightStackCol}>
          {/* Credit to Collect Tile */}
          <LiquidGlassCard
            style={styles.statTile}
            contentStyle={styles.statTileContent}
            radius={20}
            padding={12}
            onPress={() => router.push('/(tabs)/money')}
          >
            <View style={styles.statTileHeader}>
              <Text
                style={[
                  styles.statTileLabel,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamilies.medium,
                  },
                ]}
              >
                Credit to Collect
              </Text>
              <HandCoins size={16} color={colors.positive} strokeWidth={2.2} />
            </View>
            <AmountText
              amount={netWorth.totalReceivables}
              variant="positive"
              isMasked={isBalanceHidden}
              style={styles.statTileAmount}
            />
            <Text
              style={[
                styles.statTilePeople,
                {
                  color: colors.textMuted,
                  fontFamily: typography.fontFamilies.medium,
                },
              ]}
            >
              {owedToYouPeopleCount} {owedToYouPeopleCount === 1 ? 'person' : 'people'}
            </Text>
          </LiquidGlassCard>

          {/* Debt Tile */}
          <LiquidGlassCard
            style={styles.statTile}
            contentStyle={styles.statTileContent}
            radius={20}
            padding={12}
            onPress={() => router.push('/(tabs)/money')}
          >
            <View style={styles.statTileHeader}>
              <Text
                style={[
                  styles.statTileLabel,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamilies.medium,
                  },
                ]}
              >
                Debt
              </Text>
              <ShieldAlert size={16} color={colors.warning} strokeWidth={2.2} />
            </View>
            <AmountText
              amount={netWorth.totalPayables}
              variant={netWorth.totalPayables > 0 ? 'warning' : 'default'}
              isMasked={isBalanceHidden}
              style={styles.statTileAmount}
            />
            <Text
              style={[
                styles.statTilePeople,
                {
                  color: colors.textMuted,
                  fontFamily: typography.fontFamilies.medium,
                },
              ]}
            >
              {youOwePeopleCount} {youOwePeopleCount === 1 ? 'person' : 'people'}
            </Text>
          </LiquidGlassCard>
        </View>
      </View>

      {/* 4. Bank Accounts & Wallets Section (NEW) */}
      <View style={styles.sectionHeaderRow}>
        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.textPrimary,
              fontFamily: typography.fontFamilies.bold,
            },
          ]}
        >
          Accounts & Wallets
        </Text>
        <Pressable
          onPress={() => router.push('/accounts')}
          accessibilityRole="button"
          accessibilityLabel="Manage all accounts"
          style={styles.manageTouchTarget}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text
            style={[
              styles.seeAllText,
              {
                color: colors.gold,
                fontFamily: typography.fontFamilies.semibold,
              },
            ]}
          >
            Manage All
          </Text>
        </Pressable>
      </View>

      {accounts.length === 0 ? (
        <LiquidGlassCard radius={20} padding={14} style={styles.emptyAccountsCard}>
          <View style={styles.emptyAccountsInner}>
            <View
              style={[
                styles.emptyAccountIconWrap,
                { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)' },
              ]}
            >
              <Wallet size={20} color="#6366F1" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                style={[
                  styles.emptyAccountTitle,
                  { color: colors.textPrimary, fontFamily: typography.fontFamilies.bold },
                ]}
              >
                No accounts connected
              </Text>
              <Text
                style={[
                  styles.emptyAccountSub,
                  { color: colors.textMuted, fontFamily: typography.fontFamilies.medium },
                ]}
              >
                Track your bank, cash & investments
              </Text>
            </View>
            <LiquidGlassCard
              onPress={() => router.push('/accounts/add')}
              accessibilityLabel="Add account"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              radius={18}
              tone="emphasized"
              padding={0}
              contentStyle={styles.emptyAddBtn}
            >
              <Plus size={14} color="#FFFFFF" strokeWidth={3} />
              <Text style={[styles.emptyAddBtnText, { color: '#FFFFFF', fontFamily: typography.fontFamilies.bold }]}>Add</Text>
            </LiquidGlassCard>
          </View>
        </LiquidGlassCard>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.accountsScrollView}
          contentContainerStyle={styles.accountsScrollContent}
        >
          {accounts.map((acc) => {
            const isBank = acc.type === 'BANK';
            const isCash = acc.type === 'CASH';
            const isInvest = acc.type === 'INVESTMENT';
            const isCC = acc.type === 'CREDIT_CARD';
            const IconComp = isBank ? Landmark : isCash ? Wallet : isInvest ? TrendingUp : CreditCard;
            const accColor = acc.color || (isBank ? '#6366F1' : isCash ? '#10B981' : isInvest ? '#F59E0B' : '#EC4899');

            const ccInfo = isCC ? getCreditCardBillingInfo(acc, transactions) : null;
            const balance = isCC && ccInfo ? ccInfo.remainingLimit : (accountBalances.get(acc.id) ?? acc.openingBalance);

            return (
              <LiquidGlassCard
                key={acc.id}
                radius={20}
                padding={14}
                style={styles.accountCard}
                onPress={() => router.push(`/accounts/${acc.id}`)}
              >
                <View style={styles.accountCardTop}>
                  <View
                    style={[
                      styles.accountCardIconWrap,
                      { backgroundColor: accColor + '1E' },
                    ]}
                  >
                    <IconComp size={16} color={accColor} strokeWidth={2.2} />
                  </View>
                  <View
                    style={[
                      styles.accountTypePill,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.accountTypePillText,
                        { color: colors.textMuted, fontFamily: typography.fontFamilies.medium },
                      ]}
                    >
                      {isBank ? 'Bank' : isCash ? 'Cash' : isCC ? 'Credit' : 'Invest'}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.accountCardName,
                    { color: colors.textPrimary, fontFamily: typography.fontFamilies.bold },
                  ]}
                  numberOfLines={1}
                >
                  {acc.name}
                </Text>

                <AmountText
                  amount={balance}
                  isMasked={isBalanceHidden}
                  variant={!isCC && balance < 0 ? 'negative' : 'default'}
                  style={styles.accountCardBalance}
                />
                <Text
                  style={[
                    styles.accountCardSubLabel,
                    {
                      color: colors.textMuted,
                      fontFamily: typography.fontFamilies.medium,
                      opacity: isCC && ccInfo ? 1 : 0,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {isCC && ccInfo ? 'Remaining Limit' : ' '}
                </Text>

                <View style={[styles.accountColorStripe, { backgroundColor: accColor }]} />
              </LiquidGlassCard>
            );
          })}

          {/* Quick Add Account Card */}
          <LiquidGlassCard
            radius={20}
            padding={14}
            style={styles.addAccountCard}
            onPress={() => router.push('/accounts/add')}
          >
            <View
              style={[
                styles.addAccountIconCircle,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.08)' },
              ]}
            >
              <Plus size={18} color={isDark ? '#E0E7FF' : '#4F46E5'} strokeWidth={2.5} />
            </View>
            <Text
              style={[
                styles.addAccountCardText,
                { color: colors.textSecondary, fontFamily: typography.fontFamilies.semibold },
              ]}
            >
              Add New
            </Text>
          </LiquidGlassCard>
        </ScrollView>
      )}

      {/* 4b. Dedicated Credit Cards & Limits Showcase */}
      {accounts.some((a) => a.type === 'CREDIT_CARD') && (
        <View style={{ marginTop: 22 }}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CreditCard size={18} color={colors.gold} />
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: colors.textPrimary,
                    fontFamily: typography.fontFamilies.bold,
                  },
                ]}
              >
                Credit Cards & Limits
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/accounts')}
              accessibilityRole="button"
              accessibilityLabel="Manage credit cards"
              style={styles.manageTouchTarget}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={[
                  styles.seeAllText,
                  {
                    color: colors.gold,
                    fontFamily: typography.fontFamilies.semibold,
                  },
                ]}
              >
                Manage
              </Text>
            </Pressable>
          </View>

          {accounts
            .filter((a) => a.type === 'CREDIT_CARD')
            .map((card) => {
              const info = getCreditCardBillingInfo(card, transactions);
              const cardColor = card.color || '#D4A373';
              const usedAmount = Math.max(0, info.usedAmount);
              const creditLimit = Math.max(0, info.creditLimit);
              const utilPercent =
                creditLimit > 0
                  ? Math.max(0, Math.min(100, Math.round((usedAmount / creditLimit) * 100)))
                  : usedAmount > 0
                  ? 100
                  : 0;

              return (
                <LiquidGlassCard
                  key={card.id}
                  radius={22}
                  padding={16}
                  style={[styles.ccHighlightCard, { marginBottom: 12 }]}
                  onPress={() => router.push(`/accounts/${card.id}`)}
                >
                  {/* Top Bar: Card Name & Billing Cycle Pill */}
                  <View style={styles.ccCardTopRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <View
                        style={[
                          styles.ccIconBox,
                          { backgroundColor: `${cardColor}25` },
                        ]}
                      >
                        <CreditCard size={16} color={cardColor} />
                      </View>
                      <Text
                        style={[
                          styles.ccCardName,
                          { color: colors.textPrimary, fontFamily: typography.fontFamilies.bold },
                        ]}
                        numberOfLines={1}
                      >
                        {card.name}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.ccCyclePill,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.06)'
                            : 'rgba(0, 0, 0, 0.05)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.ccCycleText,
                          { color: colors.textMuted, fontFamily: typography.fontFamilies.medium },
                        ]}
                      >
                        Bill {formatDayOrdinal(info.billingDay)} • Due {formatDayOrdinal(info.dueDay)}
                      </Text>
                    </View>
                  </View>

                  {/* Limit Metrics */}
                  <View style={{ marginTop: 12 }}>
                    <Text
                      style={[
                        styles.ccLimitSub,
                        { color: colors.textSecondary, fontFamily: typography.fontFamilies.medium },
                      ]}
                    >
                      Remaining Limit
                    </Text>
                    <View style={styles.ccLimitRow}>
                      <AmountText
                        amount={info.remainingLimit}
                        isMasked={isBalanceHidden}
                        style={styles.ccRemainingAmount}
                      />
                      <Text
                        style={[
                          styles.ccTotalLimitText,
                          { color: colors.textMuted, fontFamily: typography.fontFamilies.medium },
                        ]}
                      >
                        of {formatRupee(info.creditLimit)} limit ({utilPercent}% used)
                      </Text>
                    </View>

                    {/* Utilization Progress Bar */}
                    <View
                      style={[
                        styles.ccProgressBarTrack,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(0, 0, 0, 0.06)',
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.ccProgressBarFill,
                          {
                            width: `${utilPercent}%`,
                            minWidth: utilPercent > 0 ? 4 : 0,
                            backgroundColor:
                              utilPercent >= 80
                                ? colors.negative
                                : utilPercent >= 40
                                ? colors.warning
                                : colors.positive,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Billed Unpaid Bill Status & Mark as Paid Action */}
                  {info.unpaidBillAmount > 0 ? (
                    <View
                      style={[
                        styles.unpaidBillBanner,
                        {
                          backgroundColor: isDark
                            ? 'rgba(244, 63, 94, 0.12)'
                            : 'rgba(244, 63, 94, 0.08)',
                          borderColor: colors.negative + '40',
                          borderRadius: radii.md,
                        },
                      ]}
                    >
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <AlertTriangle size={13} color={colors.negative} />
                          <Text
                            style={[
                              styles.unpaidBillTitle,
                              {
                                color: colors.negative,
                                fontFamily: typography.fontFamilies.bold,
                              },
                            ]}
                          >
                            Unpaid Bill: {formatRupee(info.unpaidBillAmount)}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.unpaidBillDueDate,
                            {
                              color: colors.textSecondary,
                              fontFamily: typography.fontFamilies.medium,
                            },
                          ]}
                        >
                          Due by {info.dueDate}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                          setSelectedCardForPayment(card);
                          setActiveBillAmount(info.unpaidBillAmount);
                          setIsPayBillModalVisible(true);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Mark bill of ${formatRupee(info.unpaidBillAmount)} as paid`}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={({ pressed }) => [
                          styles.markPaidBtn,
                          {
                            backgroundColor: colors.textPrimary,
                            borderRadius: radii.full,
                            minHeight: 44,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.markPaidBtnText,
                            {
                              color: colors.background,
                              fontFamily: typography.fontFamilies.bold,
                            },
                          ]}
                        >
                          Mark as Paid
                        </Text>
                      </Pressable>
                    </View>
                  ) : info.unbilledAmount > 0 ? (
                    <View style={styles.unbilledNoticeRow}>
                      <Text
                        style={[
                          styles.unbilledNoticeText,
                          {
                            color: colors.textMuted,
                            fontFamily: typography.fontFamilies.medium,
                          },
                        ]}
                      >
                        Unbilled spend: {formatRupee(info.unbilledAmount)} • Next statement on {info.nextBillingDate}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.clearedNoticeRow}>
                      <CheckCircle2 size={13} color={colors.positive} />
                      <Text
                        style={[
                          styles.clearedNoticeText,
                          {
                            color: colors.positive,
                            fontFamily: typography.fontFamilies.medium,
                          },
                        ]}
                      >
                        All bills cleared • Next statement on {info.nextBillingDate}
                      </Text>
                    </View>
                  )}
                </LiquidGlassCard>
              );
            })}
        </View>
      )}

      {/* 4. Record Transaction Hub */}
      <View style={[styles.sectionHeaderRow, { marginTop: 22, marginBottom: 10 }]}>
        <View style={styles.sectionHeaderTitleGroup}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.textPrimary,
                fontFamily: typography.fontFamilies.bold,
              },
            ]}
          >
            Record Transaction
          </Text>
          <Text
            style={[
              styles.sectionSubtitle,
              {
                color: colors.textMuted,
                fontFamily: typography.fontFamilies.medium,
              },
            ]}
          >
            Quick Entry
          </Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            router.push('/transaction/add');
          }}
          accessibilityRole="button"
          accessibilityLabel="Record new transaction entry"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={({ pressed }) => [
            styles.recordHeaderPill,
            {
              backgroundColor: isDark ? 'rgba(217, 119, 6, 0.14)' : 'rgba(217, 119, 6, 0.10)',
              borderColor: isDark ? 'rgba(217, 119, 6, 0.28)' : 'rgba(217, 119, 6, 0.20)',
              minHeight: 36,
              opacity: pressed ? 0.75 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
        >
          <Plus size={13} color={colors.gold} strokeWidth={2.5} />
          <Text
            style={[
              styles.recordHeaderPillText,
              {
                color: colors.gold,
                fontFamily: typography.fontFamilies.semibold,
              },
            ]}
          >
            New Entry
          </Text>
        </Pressable>
      </View>

      <LiquidGlassCard style={styles.recordHubCard} radius={22} padding={12}>
        <View style={styles.recordTilesGrid}>
          {/* Row 1: Expense & Income */}
          <View style={styles.recordTilesRow}>
            {/* Expense Tile */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                router.push({
                  pathname: '/transaction/add',
                  params: { defaultType: 'EXPENSE' },
                });
              }}
              style={({ pressed }) => [
                styles.recordTile,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.65)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.85)',
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <View style={[styles.recordTileIconWrap, { backgroundColor: colors.negativeBg }]}>
                <ArrowUpRight size={17} color={colors.negative} strokeWidth={2.4} />
              </View>
              <View style={styles.recordTileTextGroup}>
                <Text
                  style={[
                    styles.recordTileTitle,
                    { color: colors.textPrimary, fontFamily: typography.fontFamilies.bold },
                  ]}
                >
                  Expense
                </Text>
                <Text
                  style={[
                    styles.recordTileSubtitle,
                    { color: colors.textMuted, fontFamily: typography.fontFamilies.regular },
                  ]}
                >
                  Spend / Bills
                </Text>
              </View>
            </Pressable>

            {/* Income Tile */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                router.push({
                  pathname: '/transaction/add',
                  params: { defaultType: 'INCOME' },
                });
              }}
              style={({ pressed }) => [
                styles.recordTile,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.65)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.85)',
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <View style={[styles.recordTileIconWrap, { backgroundColor: colors.positiveBg }]}>
                <ArrowDownLeft size={17} color={colors.positive} strokeWidth={2.4} />
              </View>
              <View style={styles.recordTileTextGroup}>
                <Text
                  style={[
                    styles.recordTileTitle,
                    { color: colors.textPrimary, fontFamily: typography.fontFamilies.bold },
                  ]}
                >
                  Income
                </Text>
                <Text
                  style={[
                    styles.recordTileSubtitle,
                    { color: colors.textMuted, fontFamily: typography.fontFamilies.regular },
                  ]}
                >
                  Salary / Credit
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Row 2: Transfer & Lend / Borrow */}
          <View style={[styles.recordTilesRow, { marginTop: 10 }]}>
            {/* Transfer Tile */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                router.push({
                  pathname: '/transaction/add',
                  params: { defaultType: 'TRANSFER' },
                });
              }}
              style={({ pressed }) => [
                styles.recordTile,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.65)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.85)',
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <View
                style={[
                  styles.recordTileIconWrap,
                  {
                    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.16)' : 'rgba(99, 102, 241, 0.10)',
                  },
                ]}
              >
                <ArrowRightLeft
                  size={17}
                  color={isDark ? '#A5B4FC' : '#4F46E5'}
                  strokeWidth={2.4}
                />
              </View>
              <View style={styles.recordTileTextGroup}>
                <Text
                  style={[
                    styles.recordTileTitle,
                    { color: colors.textPrimary, fontFamily: typography.fontFamilies.bold },
                  ]}
                >
                  Transfer
                </Text>
                <Text
                  style={[
                    styles.recordTileSubtitle,
                    { color: colors.textMuted, fontFamily: typography.fontFamilies.regular },
                  ]}
                >
                  Between accounts
                </Text>
              </View>
            </Pressable>

            {/* Lend / Borrow Tile */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                router.push({
                  pathname: '/transaction/add',
                  params: { defaultType: 'LEND' },
                });
              }}
              style={({ pressed }) => [
                styles.recordTile,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.65)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.85)',
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <View
                style={[
                  styles.recordTileIconWrap,
                  {
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.10)',
                  },
                ]}
              >
                <HandCoins
                  size={17}
                  color={isDark ? '#FCD34D' : '#D97706'}
                  strokeWidth={2.4}
                />
              </View>
              <View style={styles.recordTileTextGroup}>
                <Text
                  style={[
                    styles.recordTileTitle,
                    { color: colors.textPrimary, fontFamily: typography.fontFamilies.bold },
                  ]}
                >
                  Lend / Borrow
                </Text>
                <Text
                  style={[
                    styles.recordTileSubtitle,
                    { color: colors.textMuted, fontFamily: typography.fontFamilies.regular },
                  ]}
                >
                  Friends & debts
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </LiquidGlassCard>

      {/* 5. Financial Flow (Live Monthly Cashflow) */}
      <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.textPrimary,
              fontFamily: typography.fontFamilies.bold,
            },
          ]}
        >
          Financial Flow
        </Text>
        <Text
          style={[
            styles.flowHeaderSub,
            {
              color: colors.textMuted,
              fontFamily: typography.fontFamilies.medium,
            },
          ]}
        >
          Monthly Movement
        </Text>
      </View>

      <LiquidGlassCard style={styles.flowCard} radius={22} padding={16}>
        {/* Monthly Flow Stats Row: Inflow vs Outflow vs Net */}
        <View style={styles.flowStatsRow}>
          {/* Inflow */}
          <View style={styles.flowStatCol}>
            <View style={styles.flowBadgeRow}>
              <View style={[styles.flowBadgeIcon, { backgroundColor: colors.positiveBg }]}>
                <ArrowDownLeft size={13} color={colors.positive} strokeWidth={2.5} />
              </View>
              <Text style={[styles.flowStatLabel, { color: colors.textSecondary }]}>Inflow</Text>
            </View>
            <Text
              style={[
                styles.flowStatAmount,
                { color: colors.positive, fontFamily: typography.fontFamilies.bold },
              ]}
              numberOfLines={1}
            >
              {isBalanceHidden ? formatRupeeMasked(netWorth.incomeMonth, { spaceAfterSymbol: true }) : formatRupee(netWorth.incomeMonth)}
            </Text>
          </View>

          <View style={[styles.flowDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />

          {/* Outflow */}
          <View style={styles.flowStatCol}>
            <View style={styles.flowBadgeRow}>
              <View style={[styles.flowBadgeIcon, { backgroundColor: colors.negativeBg }]}>
                <ArrowUpRight size={13} color={colors.negative} strokeWidth={2.5} />
              </View>
              <Text style={[styles.flowStatLabel, { color: colors.textSecondary }]}>Outflow</Text>
            </View>
            <Text
              style={[
                styles.flowStatAmount,
                { color: colors.negative, fontFamily: typography.fontFamilies.bold },
              ]}
              numberOfLines={1}
            >
              {isBalanceHidden ? formatRupeeMasked(netWorth.expenseMonth, { spaceAfterSymbol: true }) : formatRupee(netWorth.expenseMonth)}
            </Text>
          </View>

          <View style={[styles.flowDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />

          {/* Net Flow */}
          <View style={styles.flowStatCol}>
            <View style={styles.flowBadgeRow}>
              <View
                style={[
                  styles.flowBadgeIcon,
                  {
                    backgroundColor:
                      netWorth.incomeMonth >= netWorth.expenseMonth
                        ? colors.positiveBg
                        : colors.negativeBg,
                  },
                ]}
              >
                {netWorth.incomeMonth >= netWorth.expenseMonth ? (
                  <TrendingUp size={13} color={colors.positive} strokeWidth={2.5} />
                ) : (
                  <TrendingDown size={13} color={colors.negative} strokeWidth={2.5} />
                )}
              </View>
              <Text style={[styles.flowStatLabel, { color: colors.textSecondary }]}>Net</Text>
            </View>
            <Text
              style={[
                styles.flowStatAmount,
                {
                  color:
                    netWorth.incomeMonth >= netWorth.expenseMonth
                      ? colors.positive
                      : colors.negative,
                  fontFamily: typography.fontFamilies.bold,
                },
              ]}
              numberOfLines={1}
            >
              {isBalanceHidden
                ? formatRupeeMasked(netWorth.incomeMonth - netWorth.expenseMonth, {
                    showSign: true,
                    spaceAfterSymbol: true,
                  })
                : (netWorth.incomeMonth >= netWorth.expenseMonth ? '+' : '') +
                  formatRupee(netWorth.incomeMonth - netWorth.expenseMonth)}
            </Text>
          </View>
        </View>
      </LiquidGlassCard>

      {/* 6. Recent Activity Section */}
      <View style={[styles.sectionHeaderRow, { marginTop: 20, marginBottom: 10 }]}>
        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.textPrimary,
              fontFamily: typography.fontFamilies.bold,
            },
          ]}
        >
          Recent Activity
        </Text>
        <View style={styles.recentActivityHeaderActions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push('/transaction/add');
            }}
            accessibilityRole="button"
            accessibilityLabel="Record transaction"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.recordSmallBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                minHeight: 36,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Plus size={12} color={colors.textPrimary} strokeWidth={2.5} />
            <Text
              style={[
                styles.recordSmallText,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fontFamilies.semibold,
                },
              ]}
            >
              Record
            </Text>
          </Pressable>
          {recentTransactions.length > 0 && (
            <Pressable
              onPress={() => router.push('/(tabs)/transactions')}
              accessibilityRole="button"
              accessibilityLabel="See all recent transactions"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.seeAllRow, { minHeight: 44, justifyContent: 'center' }]}
            >
              <Text
                style={[
                  styles.seeAllText,
                  {
                    color: colors.gold,
                    fontFamily: typography.fontFamilies.semibold,
                  },
                ]}
              >
                See all
              </Text>
              <ChevronRight size={14} color={colors.gold} />
            </Pressable>
          )}
        </View>
      </View>

      {recentTransactions.length === 0 ? (
        <LiquidGlassCard radius={20} padding={16} style={styles.emptyCard}>
          <EmptyState
            title="Nothing here yet"
            description="Your financial activity will appear here once you record your first transaction."
            actionTitle="Add Transaction"
            onAction={() => router.push('/transaction/add')}
          />
        </LiquidGlassCard>
      ) : (
        <LiquidGlassCard style={styles.recentActivityCard} radius={22} padding={0}>
          {recentTransactions.map((tx, idx) => (
            <React.Fragment key={tx.id}>
              <TransactionRow
                transaction={tx}
                accountName={tx.accountId ? accountMap.get(tx.accountId) : undefined}
                destAccountName={
                  tx.destinationAccountId ? accountMap.get(tx.destinationAccountId) : undefined
                }
                personName={tx.personId ? personMap.get(tx.personId) : undefined}
                onPress={() => router.push(`/transaction/${tx.id}`)}
              />
              {idx < recentTransactions.length - 1 && (
                <View style={[styles.rowDivider, { backgroundColor: colors.borderSubtle }]} />
              )}
            </React.Fragment>
          ))}
        </LiquidGlassCard>
      )}

      {/* Credit Card Bill Payment Dialog */}
      <PayCreditCardBillModal
        visible={isPayBillModalVisible}
        onClose={() => setIsPayBillModalVisible(false)}
        creditCard={selectedCardForPayment}
        unpaidBillAmount={activeBillAmount}
        accounts={accounts}
        accountBalances={accountBalances}
        onPaymentSuccess={() => {
          refresh();
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  contextSubLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  contextSubLabel: {
    fontSize: 13,
    letterSpacing: -0.1,
  },
  seeMoreLink: {
    fontSize: 13,
  },
  giantAmountText: {
    fontSize: 44,
    lineHeight: 52,
    letterSpacing: -1.4,
    marginVertical: 4,
    textAlign: 'center',
  },
  deltaPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 4,
  },
  deltaText: {
    fontSize: 12,
    letterSpacing: -0.2,
  },
  bentoGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    alignItems: 'stretch',
  },
  gaugeTile: {
    flex: 1,
  },
  gaugeTileContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  gaugeTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  gaugeHeaderIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeCenterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  gaugeFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusPillText: {
    fontSize: 10.5,
    letterSpacing: -0.2,
  },
  gaugeFooterHint: {
    fontSize: 10.5,
    letterSpacing: -0.1,
  },
  rightStackCol: {
    flex: 1,
    gap: 10,
  },
  statTile: {
    flex: 1,
  },
  statTileContent: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  statTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statTileLabel: {
    fontSize: 12,
  },
  statTileAmount: {
    fontSize: 18,
    letterSpacing: -0.4,
    marginVertical: 2,
  },
  statTilePeople: {
    fontSize: 11,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    letterSpacing: -0.3,
  },
  seeAllText: {
    fontSize: 13,
  },
  manageTouchTarget: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  emptyAccountsCard: {
    marginBottom: 6,
  },
  emptyAccountsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  emptyAccountIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAccountTitle: {
    fontSize: 14,
  },
  emptyAccountSub: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  emptyAddBtnText: {
    fontSize: 12,
  },
  accountsScrollView: {
    marginHorizontal: -16,
  },
  accountsScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 4,
  },
  accountCard: {
    width: 155,
    height: 134,
    justifyContent: 'space-between',
  },
  accountCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  accountCardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTypePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  accountTypePillText: {
    fontSize: 10,
  },
  accountCardName: {
    fontSize: 14,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  accountCardBalance: {
    fontSize: 16,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  accountColorStripe: {
    height: 3,
    borderRadius: 1.5,
    width: 28,
  },
  addAccountCard: {
    width: 105,
    height: 134,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addAccountIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAccountCardText: {
    fontSize: 12,
  },
  accountCardSubLabel: {
    fontSize: 10,
    marginTop: -4,
    marginBottom: 6,
  },
  ccHighlightCard: {
    borderWidth: 1,
    borderColor: 'rgba(212, 163, 115, 0.25)',
  },
  ccCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ccIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ccCardName: {
    fontSize: 15,
  },
  ccCyclePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  ccCycleText: {
    fontSize: 11,
  },
  ccLimitSub: {
    fontSize: 12,
  },
  ccLimitRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginVertical: 4,
  },
  ccRemainingAmount: {
    fontSize: 24,
    letterSpacing: -0.5,
  },
  ccTotalLimitText: {
    fontSize: 12,
  },
  ccProgressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  ccProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  unpaidBillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
  },
  unpaidBillTitle: {
    fontSize: 13,
  },
  unpaidBillDueDate: {
    fontSize: 11,
    marginTop: 2,
  },
  markPaidBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markPaidBtnText: {
    fontSize: 12,
  },
  unbilledNoticeRow: {
    marginTop: 12,
    paddingVertical: 4,
  },
  unbilledNoticeText: {
    fontSize: 11,
  },
  clearedNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 4,
  },
  clearedNoticeText: {
    fontSize: 11,
  },
  flowHeaderSub: {
    fontSize: 12,
  },
  flowCard: {
    marginBottom: 6,
  },
  flowStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  flowStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  flowBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  flowBadgeIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowStatLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  flowStatAmount: {
    fontSize: 15,
    letterSpacing: -0.3,
  },
  flowDivider: {
    width: 1,
    height: 32,
  },
  sectionHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
  },
  recordHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  recordHeaderPillText: {
    fontSize: 11,
  },
  recordHubCard: {
    marginBottom: 6,
  },
  recordTilesGrid: {
    width: '100%',
  },
  recordTilesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  recordTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  recordTileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordTileTextGroup: {
    flex: 1,
  },
  recordTileTitle: {
    fontSize: 13,
    letterSpacing: -0.2,
  },
  recordTileSubtitle: {
    fontSize: 10,
    marginTop: 1,
  },
  recentActivityHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  recordSmallText: {
    fontSize: 11,
  },
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  emptyCard: {
    marginTop: 4,
    marginBottom: 16,
  },
  recentActivityCard: {
    overflow: 'hidden',
  },
  rowDivider: {
    height: 1,
    marginHorizontal: 16,
  },
});
