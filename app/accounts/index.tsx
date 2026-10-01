import React from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { AccountRow } from '../../src/components/ui/AccountRow';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { AmountText } from '../../src/components/ui/AmountText';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { useTheme } from '../../src/theme';

export default function AccountsListScreen() {
  const { colors, radii, spacing } = useTheme();
  const { accounts, accountBalances, refresh } = useFinancialData();

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  const totalBalance = Array.from(accountBalances.values()).reduce(
    (acc, curr) => acc + curr,
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
          Across {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
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
});
