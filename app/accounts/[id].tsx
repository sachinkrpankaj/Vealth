import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Trash2, Plus, CreditCard, AlertTriangle, Pencil } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { IconButton } from '../../src/components/ui/IconButton';
import { AmountText } from '../../src/components/ui/AmountText';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { TransactionRow } from '../../src/components/ui/TransactionRow';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { PayCreditCardBillModal } from '../../src/components/ui/PayCreditCardBillModal';
import { showThemedAlert } from '../../src/components/ui/ThemedDialog';
import { useTheme } from '../../src/theme';
import { getAccountById, getAllAccounts, archiveAccount } from '../../src/database/repositories/accountRepository';
import { getAllTransactions } from '../../src/database/repositories/transactionRepository';
import { getAllPeople } from '../../src/database/repositories/personRepository';
import { getAllCards } from '../../src/database/repositories/cardRepository';
import { calculateAccountBalance, calculateAllAccountBalances } from '../../src/domain/finance/financialEngine';
import { getCreditCardBillingInfo, formatDayOrdinal } from '../../src/domain/finance/creditCardBilling';
import { formatRupee } from '../../src/domain/finance/currency';
import { Account, Transaction, Person } from '../../src/domain/finance/types';
import { SavedCard } from '../../src/domain/cards/types';
import { CardPreview } from '../../src/components/cards/CardPreview';
import { CardDetailModal } from '../../src/components/cards/CardDetailModal';
import { CardFormModal } from '../../src/components/cards/CardFormModal';
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
  const [linkedCards, setLinkedCards] = useState<SavedCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<SavedCard | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingCard, setEditingCard] = useState<SavedCard | null>(null);
  const [isPayModalVisible, setIsPayModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async (silent = false) => {
    if (!id) return;
    try {
      if (!silent) setIsLoading(true);
      const acc = await getAccountById(id);
      const allTx = await getAllTransactions({ accountId: id });
      const ppl = await getAllPeople();
      // Archived accounts still identify the source/destination of historical transfers.
      const accs = await getAllAccounts(true);
      const rawAllTx = await getAllTransactions();
      let cCards: SavedCard[] = [];
      try {
        cCards = await getAllCards({ linkedAccountId: id });
      } catch {
        cCards = [];
      }

      if (acc) {
        setAccount(acc);
        setBalance(calculateAccountBalance(acc, rawAllTx));
      }
      setTransactions(allTx);
      setPeople(ppl);
      setAllAccounts(accs);
      setAllAccountBalances(calculateAllAccountBalances(accs, rawAllTx));
      setLinkedCards(cCards);
    } catch (e) {
      console.error('Failed to load account details:', e);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [id])
  );

  const handleArchive = () => {
    if (balance !== 0) {
      showThemedAlert(
        'Non-zero Balance',
        `This account has an active balance of ${formatRupee(balance)}. Please transfer or settle the balance before archiving to keep your records accurate.`,
        [{ text: 'OK' }]
      );
      return;
    }

    showThemedAlert(
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
  const accountMap = new Map(allAccounts.map((a) => [a.id, a.name]));

  return (
    <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        <IconButton
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          icon={<ArrowLeft size={18} color={colors.textPrimary} />}
        />

        <View style={styles.headerActions}>
          <IconButton
            onPress={() => router.push({ pathname: '/transaction/add', params: { accountId: account.id } })}
            accessibilityLabel="Add transaction for this account"
            variant="accent"
            icon={<Plus size={18} color="#FFFFFF" />}
          />

          <IconButton
            onPress={() => router.push(`/accounts/${account.id}/edit`)}
            accessibilityLabel="Edit account details"
            icon={<Pencil size={16} color={colors.textPrimary} />}
          />

          <IconButton
            onPress={handleArchive}
            accessibilityLabel="Delete or archive account"
            variant="destructive"
            icon={<Trash2 size={16} color={colors.negative} />}
          />
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
                      backgroundColor: colors.negativeBg,
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

                  <LiquidGlassCard
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                      setIsPayModalVisible(true);
                    }}
                    accessibilityLabel="Pay credit card bill" tone="emphasized"
                    radius={radii.full} padding={0} style={styles.ccPayBtn}>
                    <Text
                      style={[
                        styles.ccPayBtnText,
                        { color: '#FFFFFF', fontFamily: typography.fontFamilies.bold },
                      ]}
                    >
                      Pay Bill
                    </Text>
                  </LiquidGlassCard>
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

      {/* Linked Cards Section */}
      {(account.type === 'BANK' || account.type === 'CREDIT_CARD') && (
        <View style={{ marginBottom: 16 }}>
          <View style={[styles.cardSectionHeaderRow, { marginBottom: 10 }]}>
            <SectionHeader
              title={account.type === 'BANK' ? 'Linked Debit Cards' : 'Linked Card Details'}
            />
            <LiquidGlassCard
              onPress={() => {
                setEditingCard(null);
                setFormModalVisible(true);
              }}
              accessibilityLabel={account.type === 'BANK' ? 'Add Debit Card' : 'Link Card'}
              radius={radii.full}
              padding={0}
              style={styles.addCardMiniBtn}
            >
              <View style={styles.addCardMiniContent}>
                <Plus size={14} color={colors.accent} />
                <Text
                  style={[
                    styles.addCardMiniText,
                    { color: colors.accent, fontFamily: typography.fontFamilies.semibold },
                  ]}
                >
                  {account.type === 'BANK' ? 'Add Debit Card' : 'Link Card'}
                </Text>
              </View>
            </LiquidGlassCard>
          </View>

          {linkedCards.length === 0 ? (
            <LiquidGlassCard
              radius={radii.md}
              padding={14}
              style={styles.noCardBanner}
              onPress={() => {
                setEditingCard(null);
                setFormModalVisible(true);
              }}
              accessibilityLabel="Add card for this account"
            >
              <CreditCard size={18} color={colors.textMuted} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.noCardTitle,
                    { color: colors.textPrimary, fontFamily: typography.fontFamilies.semibold },
                  ]}
                >
                  {account.type === 'BANK' ? 'No debit cards linked' : 'No card details saved'}
                </Text>
                <Text style={[styles.noCardSub, { color: colors.textSecondary }]}>
                  {account.type === 'BANK'
                    ? 'Optionally save ATM / debit cards for fast copying of numbers.'
                    : 'Save card details for easy copying of number, holder, and expiry.'}
                </Text>
              </View>
              <Plus size={16} color={colors.accent} />
            </LiquidGlassCard>
          ) : (
            <View>
              {linkedCards.map((c) => (
                <View key={c.id} style={{ marginBottom: 12 }}>
                  <CardPreview
                    cardholderName={c.cardholderName}
                    lastFour={c.lastFour}
                    network={c.network}
                    cardType={c.cardType}
                    issuer={c.issuer}
                    expiryMonth={c.expiryMonth}
                    expiryYear={c.expiryYear}
                    cardNickname={c.cardNickname}
                    linkedAccountName={account.name}
                    colorTheme={c.colorTheme}
                    onPress={() => {
                      setSelectedCard(c);
                      setDetailModalVisible(true);
                    }}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
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
                accountName={tx.accountId ? accountMap.get(tx.accountId) : account.name}
                destAccountName={
                  tx.destinationAccountId
                    ? accountMap.get(tx.destinationAccountId)
                    : undefined
                }
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
            // Preserve the modal instance until its guarded close animation completes.
            void loadData(true);
          }}
        />
      )}

      {/* Card Detail Modal */}
      <CardDetailModal
        visible={detailModalVisible}
        card={selectedCard}
        linkedAccount={account}
        onClose={() => {
          setDetailModalVisible(false);
          setSelectedCard(null);
        }}
        onEdit={(c) => {
          setDetailModalVisible(false);
          setSelectedCard(null);
          setEditingCard(c);
          setTimeout(() => {
            setFormModalVisible(true);
          }, 120);
        }}
        onCardDeleted={() => {
          loadData(true);
        }}
      />

      {/* Card Form Modal */}
      <CardFormModal
        visible={formModalVisible}
        initialCard={editingCard}
        preselectedAccountId={account.id}
        accounts={allAccounts}
        onClose={() => {
          setFormModalVisible(false);
          setEditingCard(null);
        }}
        onSuccess={() => {
          loadData(true);
        }}
      />
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
  cardSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addCardMiniBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCardMiniContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addCardMiniText: {
    fontSize: 12,
  },
  noCardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 8,
  },
  noCardTitle: {
    fontSize: 13,
  },
  noCardSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
});
