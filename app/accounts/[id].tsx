import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Trash2, Plus, CreditCard, AlertTriangle } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { AmountText } from '../../src/components/ui/AmountText';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { TransactionRow } from '../../src/components/ui/TransactionRow';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { PayCreditCardBillModal } from '../../src/components/ui/PayCreditCardBillModal';
import { useTheme } from '../../src/theme';
import { getAccountById, getAllAccounts, archiveAccount } from '../../src/database/repositories/accountRepository';
import { getAllTransactions } from '../../src/database/repositories/transactionRepository';
import { getAllPeople } from '../../src/database/repositories/personRepository';
import { calculateAccountBalance, calculateAllAccountBalances } from '../../src/domain/finance/financialEngine';
import { getCreditCardBillingInfo, formatDayOrdinal } from '../../src/domain/finance/creditCardBilling';
import { formatRupee } from '../../src/domain/finance/currency';
import { Account, Transaction, Person } from '../../src/domain/finance/types';
import * as Haptics from 'expo-haptics';

export default function AccountDetailScreen() {
  const { colors, typography, radii, spacing, isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [account, setAccount] = useState<Account | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [allAccountBalances, setAllAccountBalances] = useState<Map<string, number>>(new Map());
  const [isPayModalVisible, setIsPayModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const [acc, allTx, ppl, accs, rawAllTx] = await Promise.all([
        getAccountById(id),
        getAllTransactions({ accountId: id }),
        getAllPeople(),
        getAllAccounts(),
        getAllTransactions(),
      ]);

      if (acc) {
        setAccount(acc);
        setBalance(calculateAccountBalance(acc, rawAllTx));
      }
      setTransactions(allTx);
      setPeople(ppl);
      setAllAccounts(accs);
      setAllAccountBalances(calculateAllAccountBalances(accs, rawAllTx));
    } catch (e) {
      console.error('Failed to load account details:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [id])
  );

  const handleArchive = () => {
    Alert.alert(
      'Archive Account',
      `Are you sure you want to archive ${account?.name}? Transaction history will remain intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            await archiveAccount(id);
            router.back();
          },
        },
      ]
    );
  };

  if (isLoading || !account) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>Loading account...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const personMap = new Map(people.map((p) => [p.id, p.name]));

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

        <View style={styles.headerActions}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/transaction/add',
                params: { accountId: account.id },
              })
            }
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: colors.textPrimary,
                borderRadius: radii.full,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Plus size={18} color={colors.background} />
          </Pressable>

          <Pressable
            onPress={handleArchive}
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
            <Trash2 size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Account Hero Card */}
      {account.type === 'CREDIT_CARD' ? (
        (() => {
          const ccInfo = getCreditCardBillingInfo(account, transactions);
          return (
            <Card style={[styles.heroCard, { backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.typeBadge}>
                <Text style={[styles.typeText, { color: colors.gold }]}>
                  Credit Card
                </Text>
              </View>
              <Text
                style={[
                  styles.accountName,
                  { color: colors.textPrimary, fontSize: typography.fontSizes.headingLg },
                ]}
              >
                {account.name}
              </Text>

              <Text style={[styles.ccLimitSub, { color: colors.textSecondary, marginTop: 10 }]}>
                Remaining Limit
              </Text>
              <AmountText
                amount={ccInfo.remainingLimit}
                size="hero"
                variant="default"
                style={{ marginVertical: 4 }}
              />

              <View style={styles.ccMetricsRow}>
                <Text style={[styles.ccMetricText, { color: colors.textMuted }]}>
                  Limit: {formatRupee(ccInfo.creditLimit)}
                </Text>
                <Text style={[styles.ccMetricText, { color: colors.textMuted }]}>•</Text>
                <Text
                  style={[
                    styles.ccMetricText,
                    { color: ccInfo.usedAmount > 0 ? colors.warning : colors.textMuted },
                  ]}
                >
                  Used: {formatRupee(ccInfo.usedAmount)}
                </Text>
              </View>

              <Text style={[styles.ccCycleText, { color: colors.textSecondary }]}>
                Bill Date: {formatDayOrdinal(ccInfo.billingDay)} of month • Due Date: {formatDayOrdinal(ccInfo.dueDay)} of month
              </Text>

              {ccInfo.unpaidBillAmount > 0 ? (
                <View
                  style={[
                    styles.ccUnpaidBanner,
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={13} color={colors.negative} />
                      <Text
                        style={[
                          styles.ccUnpaidTitle,
                          { color: colors.negative, fontFamily: typography.fontFamilies.bold },
                        ]}
                      >
                        Unpaid Bill: {formatRupee(ccInfo.unpaidBillAmount)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.ccUnpaidDue,
                        { color: colors.textSecondary, fontFamily: typography.fontFamilies.medium },
                      ]}
                    >
                      Due by {ccInfo.dueDate}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                      setIsPayModalVisible(true);
                    }}
                    style={({ pressed }) => [
                      styles.ccPayBtn,
                      {
                        backgroundColor: colors.textPrimary,
                        borderRadius: radii.full,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.ccPayBtnText,
                        { color: colors.background, fontFamily: typography.fontFamilies.bold },
                      ]}
                    >
                      Pay Bill
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </Card>
          );
        })()
      ) : (
        <Card style={[styles.heroCard, { backgroundColor: colors.surfaceElevated }]}>
          <View style={styles.typeBadge}>
            <Text style={[styles.typeText, { color: colors.textSecondary }]}>
              {account.type.replace('_', ' ')}
            </Text>
          </View>
          <Text
            style={[
              styles.accountName,
              { color: colors.textPrimary, fontSize: typography.fontSizes.headingLg },
            ]}
          >
            {account.name}
          </Text>
          <AmountText
            amount={balance}
            size="hero"
            variant={balance < 0 ? 'negative' : 'default'}
            style={{ marginVertical: 6 }}
          />
          <Text style={[styles.openingText, { color: colors.textMuted }]}>
            Opening Balance: ₹{(account.openingBalance / 100).toLocaleString('en-IN')}
          </Text>
        </Card>
      )}

      {/* Transactions in this Account */}
      <SectionHeader title="Account Activity" />
      {transactions.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Transactions involving this account will appear here."
          actionTitle="Record Transaction"
          onAction={() =>
            router.push({
              pathname: '/transaction/add',
              params: { accountId: account.id },
            })
          }
        />
      ) : (
        <Card style={styles.txCard}>
          {transactions.map((tx, idx) => (
            <React.Fragment key={tx.id}>
              <TransactionRow
                transaction={tx}
                accountName={account.name}
                personName={tx.personId ? personMap.get(tx.personId) : undefined}
                onPress={() => router.push(`/transaction/${tx.id}`)}
              />
              {idx < transactions.length - 1 ? (
                <View
                  style={[styles.rowDivider, { backgroundColor: colors.borderSubtle }]}
                />
              ) : null}
            </React.Fragment>
          ))}
        </Card>
      )}

      {account.type === 'CREDIT_CARD' && (
        <PayCreditCardBillModal
          visible={isPayModalVisible}
          onClose={() => setIsPayModalVisible(false)}
          creditCard={account}
          unpaidBillAmount={getCreditCardBillingInfo(account, transactions).unpaidBillAmount}
          accounts={allAccounts}
          accountBalances={allAccountBalances}
          onPaymentSuccess={() => {
            loadData();
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
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
  typeBadge: {
    marginBottom: 6,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  accountName: {
    fontWeight: '700',
  },
  openingText: {
    fontSize: 13,
  },
  txCard: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  rowDivider: {
    height: 1,
  },
  ccLimitSub: {
    fontSize: 12,
  },
  ccMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  ccMetricText: {
    fontSize: 13,
  },
  ccCycleText: {
    fontSize: 12,
    marginTop: 8,
  },
  ccUnpaidBanner: {
    marginTop: 14,
    padding: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ccUnpaidTitle: {
    fontSize: 13,
  },
  ccUnpaidDue: {
    fontSize: 11,
    marginTop: 2,
  },
  ccPayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ccPayBtnText: {
    fontSize: 12,
  },
});
