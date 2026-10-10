import React from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, CreditCard, ChevronRight } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { AccountRow } from '../../src/components/ui/AccountRow';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { AmountText } from '../../src/components/ui/AmountText';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { useTheme } from '../../src/theme';
import { getAllCards } from '../../src/database/repositories/cardRepository';

export default function AccountsListScreen() {
  const { colors, radii, spacing, typography } = useTheme();
  const { accounts, accountBalances, refresh } = useFinancialData();
  const [savedCardCount, setSavedCardCount] = React.useState<number>(0);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
      getAllCards().then((cards) => setSavedCardCount(cards.length)).catch(() => {});
    }, [refresh])
  );

  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const archivedAccounts = accounts.filter((a) => a.isArchived);

  const totalBalance = activeAccounts.reduce(
    (acc, curr) => acc + (accountBalances.get(curr.id) ?? curr.openingBalance),
    0
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        <LiquidGlassCard onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back"
          radius={radii.full} padding={0} style={styles.iconBtn}>
          <ArrowLeft size={18} color={colors.textPrimary} />
        </LiquidGlassCard>

        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Accounts & Wallets</Text>

        <LiquidGlassCard onPress={() => router.push('/accounts/add')} hitSlop={10}
          accessibilityLabel="Add account" tone="emphasized" radius={radii.full} padding={0} style={styles.iconBtn}>
          <Plus size={18} color="#FFFFFF" />
        </LiquidGlassCard>
      </View>

      {/* Card Wallet Quick Access Banner */}
      <LiquidGlassCard
        onPress={() => router.push('/cards')}
        radius={radii.lg}
        padding={14}
        style={styles.cardWalletCard}
        accessibilityLabel="Open Card Wallet"
      >
        <View style={styles.cardWalletContent}>
          <View
            style={[
              styles.cardWalletIconBox,
              { backgroundColor: `${colors.accent}18` },
            ]}
          >
            <CreditCard size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.cardWalletTitle,
                { color: colors.textPrimary, fontFamily: typography.fontFamilies.bold },
              ]}
            >
              Card Wallet
            </Text>
            <Text style={[styles.cardWalletSub, { color: colors.textSecondary }]}>
              {savedCardCount === 0
                ? 'Store & copy Credit / Debit cards securely'
                : `${savedCardCount} saved ${savedCardCount === 1 ? 'card' : 'cards'} • Tap to view`}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </View>
      </LiquidGlassCard>

      {/* Total Balance Card */}
      <Card style={[styles.totalCard, { backgroundColor: colors.surfaceElevated }]}>
        <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
          Total Liquid Balance
        </Text>
        <AmountText
          amount={totalBalance}
          size="hero"
          style={{ marginVertical: 4 }}
        />
        <Text style={[styles.totalSub, { color: colors.textMuted }]}>
          {archivedAccounts.length === 0
            ? `Across ${activeAccounts.length} ${activeAccounts.length === 1 ? 'account' : 'accounts'}`
            : `${activeAccounts.length} active • ${archivedAccounts.length} archived`}
        </Text>
      </Card>

      {accounts.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          description="Add your bank accounts, cash wallets, or investments to start tracking."
          actionTitle="Add Account"
          onAction={() => router.push('/accounts/add')}
        />
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
          renderItem={({ item }) => {
            const balance = accountBalances.get(item.id) ?? item.openingBalance;
            return (
              <Card style={styles.card}>
                <AccountRow
                  account={item}
                  balance={balance}
                  onPress={() => router.push(`/accounts/${item.id}`)}
                />
              </Card>
            );
          }}
        />
      )}
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
  totalCard: {
    padding: 20,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  totalSub: {
    fontSize: 12,
  },
  card: {
    marginBottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  cardWalletCard: {
    marginBottom: 16,
  },
  cardWalletContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardWalletIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWalletTitle: {
    fontSize: 15,
    marginBottom: 2,
  },
  cardWalletSub: {
    fontSize: 12,
  },
});
