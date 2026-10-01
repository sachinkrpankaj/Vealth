import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  Users,
  ArrowRightLeft,
  ShoppingBag,
  TrendingUp,
  X,
  Calendar,
  UserPlus,
} from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { AmountInput } from '../../src/components/ui/AmountInput';
import { DatePickerField } from '../../src/components/ui/DatePickerField';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { useTheme } from '../../src/theme';
import { createTransaction } from '../../src/database/repositories/transactionRepository';
import { getAssetById, updateAsset } from '../../src/database/repositories/assetRepository';
import { TransactionType } from '../../src/domain/finance/types';
import { validateTransactionRequiredFields, validateRepaymentAmount } from '../../src/domain/finance/validator';
import { formatRupee } from '../../src/domain/finance/currency';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { CategoryPickerField } from '../../src/components/ui/CategoryPickerField';


interface TypeOption {
  type: TransactionType;
  label: string;
  icon: any;
  color: string;
  bg: string;
  description: string;
}

const TRANSACTION_TYPES: TypeOption[] = [
  {
    type: 'EXPENSE',
    label: 'Expense',
    icon: ArrowUpRight,
    color: '#F43F5E',
    bg: 'rgba(244, 63, 94, 0.12)',
    description: 'Spending money that decreases your net worth',
  },
  {
    type: 'INCOME',
    label: 'Income',
    icon: ArrowDownLeft,
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.12)',
    description: 'Earnings that increase your net worth',
  },
  {
    type: 'LEND',
    label: 'Lent Money',
    icon: HandCoins,
    color: '#6366F1',
    bg: 'rgba(99, 102, 241, 0.12)',
    description: 'Lending money to someone (Receivable, Net worth unchanged)',
  },
  {
    type: 'BORROW',
    label: 'Borrowed Money',
    icon: Users,
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.12)',
    description: 'Borrowing money from someone (Liability, Net worth unchanged)',
  },
  {
    type: 'REPAYMENT_RECEIVED',
    label: 'Repayment Received',
    icon: ArrowDownLeft,
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.12)',
    description: 'Someone repays you money they owed (NOT new income)',
  },
  {
    type: 'REPAYMENT_MADE',
    label: 'Repayment Made',
    icon: ArrowUpRight,
    color: '#F43F5E',
    bg: 'rgba(244, 63, 94, 0.12)',
    description: 'You pay back someone you borrowed from (NOT an expense)',
  },
  {
    type: 'TRANSFER',
    label: 'Transfer',
    icon: ArrowRightLeft,
    color: '#94A3B8',
    bg: 'rgba(148, 163, 184, 0.12)',
    description: 'Move money between your own accounts',
  },
  {
    type: 'ASSET_PURCHASE',
    label: 'Asset Purchase',
    icon: ShoppingBag,
    color: '#EC4899',
    bg: 'rgba(236, 72, 153, 0.12)',
    description: 'Buy an asset like gold or property (Cash -> Asset swap)',
  },
  {
    type: 'ASSET_SALE',
    label: 'Asset Sale',
    icon: TrendingUp,
    color: '#8B5CF6',
    bg: 'rgba(139, 92, 246, 0.12)',
    description: 'Liquidate an asset into cash',
  },
];

export default function AddTransactionScreen() {
  const { colors, typography, radii, spacing } = useTheme();
  const params = useLocalSearchParams<{
    defaultType?: string;
    personId?: string;
    accountId?: string;
  }>();

  const { accounts, people, personDebts, physicalAssets, refresh } = useFinancialData();

  // Nested add-person/add-asset routes return to this mounted form; reload their new entries.
  useFocusEffect(React.useCallback(() => {
    refresh();
  }, [refresh]));

  const initialType: TransactionType = (params.defaultType as TransactionType) || 'EXPENSE';
  const [selectedType, setSelectedType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState<number>(0);
  const [selectedAccount, setSelectedAccount] = useState<string>(
    params.accountId || (accounts[0]?.id ?? '')
  );
  const [destinationAccount, setDestinationAccount] = useState<string>('');
  const [selectedPerson, setSelectedPerson] = useState<string>(params.personId || '');
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set default accounts when loaded
  useEffect(() => {
    if (!selectedAccount && accounts.length > 0) {
      setSelectedAccount(accounts[0].id);
    }
    if (selectedType === 'TRANSFER' && accounts.length > 1 &&
        (!destinationAccount || destinationAccount === selectedAccount)) {
      const second = accounts.find((a) => a.id !== selectedAccount);
      if (second) setDestinationAccount(second.id);
    }
    if ((selectedType === 'ASSET_PURCHASE' || selectedType === 'ASSET_SALE') && physicalAssets.length > 0 && !selectedAsset) {
      setSelectedAsset(physicalAssets[0].id);
    }
  }, [accounts, selectedType, physicalAssets, selectedAccount, destinationAccount, selectedAsset]);

  // Outstanding amount lookup for repayments
  const outstandingInfo = React.useMemo(() => {
    if (!selectedPerson) return null;
    const debt = personDebts.find((p) => p.person.id === selectedPerson);
    if (!debt) return null;

    if (selectedType === 'REPAYMENT_RECEIVED') {
      return { label: 'Outstanding they owe', amount: debt.owedToYou };
    }
    if (selectedType === 'REPAYMENT_MADE') {
      return { label: 'Outstanding you owe', amount: debt.youOwe };
    }
    return null;
  }, [selectedPerson, selectedType, personDebts]);

  const handleSubmit = async () => {
    setErrorMessage(null);

    const validation = validateTransactionRequiredFields({
      type: selectedType,
      amount,
      date,
      accountId: selectedAccount,
      destinationAccountId: destinationAccount,
      personId: selectedPerson,
      assetId: selectedAsset,
    });

    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Please fill in all required fields');
      return;
    }

    // Strict check for repayments: prevent over-repayment and zero-balance repayment
    if (selectedType === 'REPAYMENT_RECEIVED' || selectedType === 'REPAYMENT_MADE') {
      const currentOutstanding = outstandingInfo?.amount ?? 0;
      if (currentOutstanding <= 0) {
        setErrorMessage('There is no outstanding balance recorded to repay.');
        return;
      }
      if (amount > currentOutstanding) {
        setErrorMessage(
          `Repayment amount (${formatRupee(amount)}) exceeds the outstanding balance (${formatRupee(currentOutstanding)}).`
        );
        return;
      }
    }

    await executeSave();
  };

  const executeSave = async () => {
    try {
      setIsSaving(true);
      await createTransaction({
        id: `tx-${Date.now()}`,
        type: selectedType,
        amount,
        date,
        accountId: selectedAccount || undefined,
        destinationAccountId:
          selectedType === 'TRANSFER' ? destinationAccount || undefined : undefined,
        categoryId: selectedType === 'EXPENSE' ? (selectedCategory || undefined) : undefined,
        personId:
          selectedType === 'LEND' ||
          selectedType === 'BORROW' ||
          selectedType === 'REPAYMENT_RECEIVED' ||
          selectedType === 'REPAYMENT_MADE'
            ? selectedPerson || undefined
            : undefined,
        assetId:
          selectedType === 'ASSET_PURCHASE' || selectedType === 'ASSET_SALE'
            ? selectedAsset || undefined
            : undefined,
        note: note.trim() || undefined,
        dueDate: dueDate.trim() || undefined,
      });

      // Update target asset state so net worth doesn't double-count sold assets alongside received cash
      if (selectedType === 'ASSET_SALE' && selectedAsset) {
        const asset = await getAssetById(selectedAsset);
        if (asset) {
          if (amount >= asset.currentValue) {
            // Full liquidation: archive the asset so it is excluded from physical assets
            await updateAsset(selectedAsset, { isArchived: true, currentValue: 0 });
          } else {
            // Partial liquidation: decrease remaining value
            await updateAsset(selectedAsset, {
              currentValue: Math.max(0, asset.currentValue - amount),
            });
          }
        }
      } else if (selectedType === 'ASSET_PURCHASE' && selectedAsset) {
        const asset = await getAssetById(selectedAsset);
        if (asset && asset.isArchived) {
          await updateAsset(selectedAsset, { isArchived: false });
        }
      }

      await refresh();
      router.back();
    } catch (e: any) {
      setErrorMessage(e?.message ?? 'Something went wrong while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Modal Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Record Transaction</Text>
        <LiquidGlassCard
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/home');
          }}
          hitSlop={10} accessibilityLabel="Close transaction form"
          radius={radii.full} padding={0} style={styles.closeBtn}>
          <X size={18} color={colors.textPrimary} />
        </LiquidGlassCard>
      </View>

      {/* Transaction Type Selector Pills */}
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>What happened?</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 16, marginBottom: 16 }}
      >
        {TRANSACTION_TYPES.map((t) => {
          const isSelected = selectedType === t.type;
          return (
            <LiquidGlassCard
              key={t.type} onPress={() => setSelectedType(t.type)}
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${t.label} transaction type`}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              tone={isSelected ? 'emphasized' : 'default'}
              radius={radii.md} padding={0} style={styles.typePill}>
              <Text
                style={[
                  styles.typePillText,
                  { color: isSelected ? '#FFFFFF' : colors.textPrimary },
                ]}
              >
                {t.label}
              </Text>
            </LiquidGlassCard>
          );
        })}
      </ScrollView>

      {/* Type explanation tip */}
      <View
        style={[
          styles.tipBox,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.md,
          },
        ]}
      >
        <Text style={[styles.tipText, { color: colors.textSecondary }]}>
          {TRANSACTION_TYPES.find((t) => t.type === selectedType)?.description}
        </Text>
      </View>

      {/* Amount Input */}
      <AmountInput
        value={amount}
        onChangeAmount={setAmount}
        label="Amount"
        placeholder="0.00"
        autoFocus
      />

      {/* People Selector (For LEND, BORROW, REPAYMENTS) */}
      {selectedType === 'LEND' ||
      selectedType === 'BORROW' ||
      selectedType === 'REPAYMENT_RECEIVED' ||
      selectedType === 'REPAYMENT_MADE' ? (
        <View style={styles.formSection}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              {selectedType === 'LEND'
                ? 'Lent to whom?'
                : selectedType === 'BORROW'
                ? 'Borrowed from whom?'
                : 'Person'}
            </Text>
            <Pressable
              onPress={() => router.push('/people/add')}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <UserPlus size={14} color={colors.accent} style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '600' }}>
                Add Person
              </Text>
            </Pressable>
          </View>

          {people.length === 0 ? (
            <Pressable
              onPress={() => router.push('/people/add')}
              style={[
                styles.emptySelector,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radii.md,
                },
              ]}
            >
              <Text style={{ color: colors.accent, fontWeight: '600' }}>
                + Add a contact first
              </Text>
            </Pressable>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 16 }}
            >
              {people.map((p) => {
                const isSelected = selectedPerson === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setSelectedPerson(p.id)}
                    style={[
                      styles.personPill,
                      {
                        backgroundColor: isSelected ? colors.textPrimary : colors.surface,
                        borderColor: isSelected ? colors.textPrimary : colors.border,
                        borderRadius: radii.full,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.personPillText,
                        { color: isSelected ? colors.background : colors.textPrimary },
                      ]}
                    >
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {outstandingInfo ? (
            <View
              style={[
                styles.outstandingBanner,
                { backgroundColor: colors.surfaceElevated, borderRadius: radii.sm },
              ]}
            >
              <Text style={[styles.outstandingLabel, { color: colors.textSecondary }]}>
                {outstandingInfo.label}:
              </Text>
              <Text style={[styles.outstandingAmount, { color: colors.textPrimary }]}>
                {formatRupee(outstandingInfo.amount)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Asset Selector (For ASSET_PURCHASE and ASSET_SALE) */}
      {selectedType === 'ASSET_PURCHASE' || selectedType === 'ASSET_SALE' ? (
        <View style={styles.formSection}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              {selectedType === 'ASSET_PURCHASE' ? 'Target Asset' : 'Asset to Sell'}
            </Text>
            <Pressable
              onPress={() => router.push('/assets/add')}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <ShoppingBag size={14} color={colors.accent} style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '600' }}>
                Add Asset
              </Text>
            </Pressable>
          </View>

          {physicalAssets.length === 0 ? (
            <Pressable
              onPress={() => router.push('/assets/add')}
              style={[
                styles.emptySelector,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radii.md,
                },
              ]}
            >
              <Text style={{ color: colors.accent, fontWeight: '600' }}>
                + Record an asset first
              </Text>
            </Pressable>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 16 }}
            >
              {physicalAssets.map((ast) => {
                const isSelected = selectedAsset === ast.id;
                return (
                  <Pressable
                    key={ast.id}
                    onPress={() => setSelectedAsset(ast.id)}
                    style={[
                      styles.personPill,
                      {
                        backgroundColor: isSelected ? colors.textPrimary : colors.surface,
                        borderColor: isSelected ? colors.textPrimary : colors.border,
                        borderRadius: radii.full,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.personPillText,
                        { color: isSelected ? colors.background : colors.textPrimary },
                      ]}
                    >
                      {ast.name} ({formatRupee(ast.currentValue)})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : null}

      {/* Account Selector */}
      <View style={styles.formSection}>
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          {selectedType === 'TRANSFER'
            ? 'From Account'
            : selectedType === 'INCOME' ||
              selectedType === 'BORROW' ||
              selectedType === 'REPAYMENT_RECEIVED'
            ? 'Receiving Account'
            : 'Account'}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 16 }}
        >
          {accounts.map((acc) => {
            const isSelected = selectedAccount === acc.id;
            return (
              <Pressable
                key={acc.id}
                onPress={() => setSelectedAccount(acc.id)}
                style={[
                  styles.accountPill,
                  {
                    backgroundColor: isSelected ? colors.textPrimary : colors.surface,
                    borderColor: isSelected ? colors.textPrimary : colors.border,
                    borderRadius: radii.md,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.accountPillText,
                    { color: isSelected ? colors.background : colors.textPrimary },
                  ]}
                >
                  {acc.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Destination Account (For TRANSFERS only) */}
      {selectedType === 'TRANSFER' ? (
        <View style={styles.formSection}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>To Account</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 16 }}
          >
            {accounts
              .filter((a) => a.id !== selectedAccount)
              .map((acc) => {
                const isSelected = destinationAccount === acc.id;
                return (
                  <Pressable
                    key={acc.id}
                    onPress={() => setDestinationAccount(acc.id)}
                    style={[
                      styles.accountPill,
                      {
                        backgroundColor: isSelected ? colors.textPrimary : colors.surface,
                        borderColor: isSelected ? colors.textPrimary : colors.border,
                        borderRadius: radii.md,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.accountPillText,
                        { color: isSelected ? colors.background : colors.textPrimary },
                      ]}
                    >
                      {acc.name}
                    </Text>
                  </Pressable>
                );
              })}
          </ScrollView>
        </View>
      ) : null}

      {/* Category Selector (Optional for Expense) */}
      {selectedType === 'EXPENSE' ? (
        <View style={styles.formSection}>
          <CategoryPickerField
            selectedCategoryId={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </View>
      ) : null}

      {/* Date and Optional Due Date */}
      <View style={styles.dateRow}>
        <View style={{ flex: 1 }}>
          <DatePickerField
            label="Date"
            value={date}
            onChange={setDate}
            placeholder="YYYY-MM-DD"
            includeFutureShortcuts={false}
            style={{ marginBottom: 0 }}
          />
        </View>

        {selectedType === 'LEND' || selectedType === 'BORROW' ? (
          <View style={{ flex: 1, marginLeft: 12 }}>
            <DatePickerField
              label="Due Date (optional)"
              value={dueDate}
              onChange={setDueDate}
              placeholder="YYYY-MM-DD"
              isClearable
              includeFutureShortcuts={true}
              style={{ marginBottom: 0 }}
            />
          </View>
        ) : null}
      </View>

      {/* Note / Description */}
      <View style={styles.formSection}>
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Note (optional)</Text>
        <View
          style={[
            styles.inputBox,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.md,
            },
          ]}
        >
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Dinner with team, Phone loan"
            placeholderTextColor={colors.textMuted}
            style={[styles.textInput, { color: colors.textPrimary }]}
          />
        </View>
      </View>

      {errorMessage ? (
        <Text style={[styles.errorBanner, { color: colors.negative }]}>{errorMessage}</Text>
      ) : null}

      <View style={{ height: 24 }} />

      <PrimaryButton
        title="Save Transaction"
        onPress={handleSubmit}
        loading={isSaving}
        disabled={amount <= 0 || isSaving}
      />
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
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  typePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
  },
  typePillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tipBox: {
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  tipText: {
    fontSize: 12,
    lineHeight: 18,
  },
  formSection: {
    marginTop: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptySelector: {
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  personPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
  },
  personPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  outstandingBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    marginTop: 8,
  },
  outstandingLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  outstandingAmount: {
    fontSize: 12,
    fontWeight: '700',
  },
  accountPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  accountPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
  },
  errorBanner: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
});
