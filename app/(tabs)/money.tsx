import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Plus, UserPlus, HandCoins, ShieldAlert } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { AppHeader } from '../../src/components/navigation/AppHeader';
import { PersonRow } from '../../src/components/ui/PersonRow';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { SegmentedControl } from '../../src/components/ui/SegmentedControl';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { useTheme } from '../../src/theme';
import { formatRupee } from '../../src/domain/finance/currency';
import { useCountingAnimation } from '../../src/hooks/useCountingAnimation';
import * as Haptics from 'expo-haptics';

export default function MoneyScreen() {
  const { colors, typography, isDark } = useTheme();
  const { personDebts, netWorth, refresh } = useFinancialData();
  const [activeTab, setActiveTab] = useState<'OWED_TO_ME' | 'I_OWE'>('OWED_TO_ME');

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  const owedToMeList = personDebts.filter((p) => p.owedToYou > 0);
  const iOweList = personDebts.filter((p) => p.youOwe > 0);

  const currentList = activeTab === 'OWED_TO_ME' ? owedToMeList : iOweList;
  const currentTotal =
    activeTab === 'OWED_TO_ME' ? netWorth.totalReceivables : netWorth.totalPayables;

  const animatedTotal = useCountingAnimation(currentTotal, {
    duration: 800,
  });

  return (
    <ScreenContainer scrollable hasTabBar contentContainerStyle={styles.scrollContent}>
      {/* 1. Header (matching Reference Image 1) */}
      <AppHeader
        title="credit & debt"
        onProfilePress={() => router.push('/profile')}
        onRightPress={() => router.push('/people/add')}
        rightAccessibilityLabel="Add person"
        rightIcon={<UserPlus size={18} color={colors.textPrimary} />}
      />

      {/* 2. Modern Segmented Switch */}
      <SegmentedControl
        options={[
          { key: 'OWED_TO_ME', label: 'Credit to Collect' },
          { key: 'I_OWE', label: 'Debt' },
        ]}
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginBottom: 16 }}
      />

      {/* 3. Hero Total Summary Card with Giant Number */}
      <LiquidGlassCard style={styles.heroSummaryCard} radius={22} padding={18}>
        <View style={styles.heroSummaryHeader}>
          <Text
            style={[
              styles.heroSummaryLabel,
              {
                color: colors.textSecondary,
                fontFamily: typography.fontFamilies.medium,
              },
            ]}
          >
            {activeTab === 'OWED_TO_ME' ? 'Total Credit to Collect' : 'Total Outstanding Debt'}
          </Text>
          {activeTab === 'OWED_TO_ME' ? (
            <HandCoins size={18} color={colors.positive} strokeWidth={2.2} />
          ) : (
            <ShieldAlert size={18} color={colors.warning} strokeWidth={2.2} />
          )}
        </View>

        <Text
          style={[
            styles.giantTotalText,
            {
              color:
                activeTab === 'OWED_TO_ME'
                  ? colors.positive
                  : currentTotal > 0
                  ? colors.warning
                  : colors.textPrimary,
              fontFamily: typography.fontFamilies.extrabold,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {animatedTotal.formattedText}
        </Text>

        <View style={styles.heroSummaryFooter}>
          <Text
            style={[
              styles.peopleCountText,
              {
                color: colors.textMuted,
                fontFamily: typography.fontFamilies.regular,
              },
            ]}
          >
            {currentList.length} {currentList.length === 1 ? 'person' : 'people'} with active{' '}
            {activeTab === 'OWED_TO_ME' ? 'receivables' : 'debt'}
          </Text>

          <Pressable
            onPress={() =>
              router.push({
                pathname: '/transaction/add',
                params: {
                  defaultType: activeTab === 'OWED_TO_ME' ? 'LEND' : 'BORROW',
                },
              })
            }
            style={({ pressed }) => [
              styles.recordBtn,
              {
                backgroundColor: activeTab === 'OWED_TO_ME' ? colors.positiveBg : colors.warningBg,
                borderColor:
                  activeTab === 'OWED_TO_ME'
                    ? 'rgba(16, 185, 129, 0.25)'
                    : 'rgba(245, 158, 11, 0.25)',
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Plus
              size={14}
              color={activeTab === 'OWED_TO_ME' ? colors.positive : colors.warning}
              strokeWidth={2.5}
            />
            <Text
              style={[
                styles.recordBtnText,
                {
                  color: activeTab === 'OWED_TO_ME' ? colors.positive : colors.warning,
                  fontFamily: typography.fontFamilies.bold,
                },
              ]}
            >
              Record
            </Text>
          </Pressable>
        </View>
      </LiquidGlassCard>

      {/* 4. People Directory Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.textPrimary,
                fontFamily: typography.fontFamilies.bold,
              },
            ]}
          >
            People Directory
          </Text>
          {currentList.length > 0 && (
            <View
              style={[
                styles.countBadge,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.05)',
                },
              ]}
            >
              <Text
                style={[
                  styles.countBadgeText,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamilies.semibold,
                  },
                ]}
              >
                {currentList.length} {currentList.length === 1 ? 'person' : 'people'}
              </Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={() => router.push('/people')}
          accessibilityRole="button"
          accessibilityLabel="Manage People Directory"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}
        >
          <Text
            style={[
              styles.seeAllText,
              {
                color: colors.accent,
                fontFamily: typography.fontFamilies.semibold,
              },
            ]}
          >
            Manage
          </Text>
        </Pressable>
      </View>

      {/* 5. Itemized Person Debt List */}
      {currentList.length === 0 ? (
        <LiquidGlassCard radius={20} padding={16} style={styles.emptyCard}>
          {activeTab === 'OWED_TO_ME' ? (
            <EmptyState
              title="No active credit to collect"
              description="Keep track of credit extended to friends, family, or colleagues with due dates."
              actionTitle="Record Credit Given"
              onAction={() =>
                router.push({
                  pathname: '/transaction/add',
                  params: { defaultType: 'LEND' },
                })
              }
            />
          ) : (
            <EmptyState
              title="No outstanding debt"
              description="You do not owe money to anyone right now. Great job keeping your liabilities clean!"
              actionTitle="Record Borrowed Money"
              onAction={() =>
                router.push({
                  pathname: '/transaction/add',
                  params: { defaultType: 'BORROW' },
                })
              }
            />
          )}
        </LiquidGlassCard>
      ) : (
        <>
          <LiquidGlassCard style={styles.peopleListCard} radius={20} padding={0}>
            {currentList.map((item, idx) => (
              <React.Fragment key={item.person.id}>
                <PersonRow
                  debtSummary={item}
                  onPress={() => router.push(`/people/${item.person.id}`)}
                />
                {idx < currentList.length - 1 && (
                  <View style={[styles.rowDivider, { backgroundColor: colors.borderSubtle }]} />
                )}
              </React.Fragment>
            ))}
          </LiquidGlassCard>

          {/* Prompt card to add another contact or track loan */}
          <LiquidGlassCard
            style={styles.addPersonPromptCard}
            radius={18}
            padding={14}
            onPress={() => router.push('/people/add')}
          >
            <View style={styles.addPromptContent}>
              <View style={[styles.addPromptIconCircle, { backgroundColor: colors.accentBg }]}>
                <UserPlus size={18} color={colors.accent} strokeWidth={2.2} />
              </View>
              <View style={styles.addPromptTextCol}>
                <Text
                  style={[
                    styles.addPromptTitle,
                    {
                      color: colors.textPrimary,
                      fontFamily: typography.fontFamilies.bold,
                    },
                  ]}
                >
                  Add Someone New
                </Text>
                <Text
                  style={[
                    styles.addPromptSub,
                    {
                      color: colors.textSecondary,
                      fontFamily: typography.fontFamilies.regular,
                    },
                  ]}
                >
                  Track loans, credit, or shared bills with another person
                </Text>
              </View>
              <View
                style={[
                  styles.addPromptActionBtn,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(0, 0, 0, 0.04)',
                    borderColor: colors.border,
                  },
                ]}
              >
                <Plus size={14} color={colors.textPrimary} strokeWidth={2.5} />
              </View>
            </View>
          </LiquidGlassCard>

          {/* Quick Helpful Insight */}
          <LiquidGlassCard style={styles.insightCard} radius={18} padding={14}>
            <View style={styles.insightContent}>
              <View
                style={[
                  styles.insightIconBox,
                  {
                    backgroundColor:
                      activeTab === 'OWED_TO_ME' ? colors.positiveBg : colors.warningBg,
                  },
                ]}
              >
                <HandCoins
                  size={16}
                  color={activeTab === 'OWED_TO_ME' ? colors.positive : colors.warning}
                  strokeWidth={2.2}
                />
              </View>
              <Text
                style={[
                  styles.insightText,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamilies.regular,
                  },
                ]}
              >
                {activeTab === 'OWED_TO_ME'
                  ? 'Tip: Tap on any contact to record repayments, view complete ledger, or adjust loan details.'
                  : 'Tip: Tap on any contact to record repayments and keep your outstanding liabilities updated.'}
              </Text>
            </View>
          </LiquidGlassCard>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  emptyCard: {
    marginTop: 4,
    marginBottom: 16,
  },
  heroSummaryCard: {
    marginBottom: 20,
  },
  heroSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  heroSummaryLabel: {
    fontSize: 13,
  },
  giantTotalText: {
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -1.2,
    marginVertical: 4,
  },
  heroSummaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  peopleCountText: {
    fontSize: 12,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  recordBtnText: {
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    letterSpacing: -0.3,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countBadgeText: {
    fontSize: 11,
  },
  seeAllText: {
    fontSize: 13,
  },
  peopleListCard: {
    overflow: 'hidden',
    marginBottom: 14,
  },
  rowDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  addPersonPromptCard: {
    marginBottom: 12,
  },
  addPromptContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addPromptIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addPromptTextCol: {
    flex: 1,
    marginRight: 10,
  },
  addPromptTitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  addPromptSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  addPromptActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightCard: {
    marginBottom: 16,
  },
  insightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  insightIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
});
