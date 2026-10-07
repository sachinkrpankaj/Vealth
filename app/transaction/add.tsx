import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Modal,
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
  ChevronDown,
  Check,
} from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { AmountInput } from '../../src/components/ui/AmountInput';
import { DatePickerField } from '../../src/components/ui/DatePickerField';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { useTheme } from '../../src/theme';
import { createTransaction } from '../../src/database/repositories/transactionRepository';
import { getAssetById, updateAsset } from '../../src/database/repositories/assetRepository';
import { TransactionType } from '../../src/domain/finance/types';
import { validateTransactionRequiredFields, validateRepaymentAmount, validateDueDate, validateTransactionDate } from '../../src/domain/finance/validator';
import { formatRupee } from '../../src/domain/finance/currency';
import { formatDateIso, getTodayLocalDateString } from '../../src/utils/dateUtils';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { CategoryPickerField } from '../../src/components/ui/CategoryPickerField';
import { IconButton } from '../../src/components/ui/IconButton';
import { generateEntityId } from '../../src/utils/idGenerator';


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

  const activeAccounts = React.useMemo(() => accounts.filter((a) => !a.isArchived), [accounts]);
  const activePeople = React.useMemo(() => people.filter((p) => !p.isArchived), [people]);
  const activeAssets = React.useMemo(() => physicalAssets.filter((a) => !a.isArchived), [physicalAssets]);

  // Nested add-person/add-asset routes return to this mounted form; reload their new entries.
  useFocusEffect(React.useCallback(() => {
    refresh();
  }, [refresh]));

  const initialType: TransactionType = (params.defaultType as TransactionType) || 'EXPENSE';
  const [selectedType, setSelectedType] = useState<TransactionType>(initialType);

  const selectableAccounts = React.useMemo(() => {
    if (selectedType === 'INCOME') {
      return activeAccounts.filter((a) => a.type !== 'CREDIT_CARD');
    }
    return activeAccounts;
  }, [activeAccounts, selectedType]);

  const [amount, setAmount] = useState<number>(0);
  const [selectedAccount, setSelectedAccount] = useState<string>(() => {
    if (params.accountId && accounts.some((a) => a.id === params.accountId && !a.isArchived)) {
      return params.accountId;
    }
    const firstActive = accounts.find((a) => !a.isArchived);
    return firstActive?.id ?? '';
  });
  const [destinationAccount, setDestinationAccount] = useState<string>('');
  const [selectedPerson, setSelectedPerson] = useState<string>(() => {
    if (params.personId && people.some((p) => p.id === params.personId && !p.isArchived)) {
      return params.personId;
    }
    return '';
  });
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => formatDateIso(new Date()));
  const [dueDate, setDueDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [typeModalVisible, setTypeModalVisible] = useState(false);

  const selectedTypeConfig = TRANSACTION_TYPES.find((t) => t.type === selectedType) || TRANSACTION_TYPES[0];
  const SelectedTypeIcon = selectedTypeConfig.icon;

  // Set default active accounts, destination account, and assets when loaded
  useEffect(() => {
    if (selectedType === 'INCOME') {
      const currentAcc = activeAccounts.find((a) => a.id === selectedAccount);
      if (currentAcc && currentAcc.type === 'CREDIT_CARD') {
        const firstValid = activeAccounts.find((a) => a.type !== 'CREDIT_CARD');
        setSelectedAccount(firstValid?.id ?? '');
        return;
      }
    }

    const validList = selectedType === 'INCOME'
      ? activeAccounts.filter((a) => a.type !== 'CREDIT_CARD')
      : activeAccounts;

    if ((!selectedAccount || !validList.some((a) => a.id === selectedAccount)) && validList.length > 0) {
      const matchParam = params.accountId && validList.some((a) => a.id === params.accountId);
      setSelectedAccount(matchParam ? params.accountId! : validList[0].id);
    }
    if (
      selectedType === 'TRANSFER' &&
      activeAccounts.length > 1 &&
      (!destinationAccount || destinationAccount === selectedAccount || !activeAccounts.some((a) => a.id === destinationAccount))
    ) {
      const second = activeAccounts.find((a) => a.id !== selectedAccount);
      if (second) setDestinationAccount(second.id);
    }
    if (
      (selectedType === 'ASSET_PURCHASE' || selectedType === 'ASSET_SALE') &&
      activeAssets.length > 0 &&
      (!selectedAsset || !activeAssets.some((a) => a.id === selectedAsset))
    ) {
      setSelectedAsset(activeAssets[0].id);
    }
  }, [accounts, activeAccounts, selectedType, physicalAssets, activeAssets, selectedAccount, destinationAccount, selectedAsset, params.accountId]);

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

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    if (dueDate && dueDate < newDate) {
      setDueDate('');
    }
  };

  const handleSubmit = async () => {
    if (isSaving) return;
    setErrorMessage(null);

    const dateValidation = validateTransactionDate(date, false);
    if (!dateValidation.isValid) {
      setErrorMessage(dateValidation.error || 'Future-dated transactions are not supported.');
      return;
    }

    const chosenAccount = activeAccounts.find((a) => a.id === selectedAccount);
    if (selectedType === 'INCOME' && chosenAccount?.type === 'CREDIT_CARD') {
      setErrorMessage('Credit cards cannot be used as receiving accounts for Income transactions. Please select a bank account, cash wallet, or investment account.');
      return;
    }

    const validation = validateTransactionRequiredFields({
      type: selectedType,
      amount,
      date,
      accountId: selectedAccount,
      accountType: chosenAccount?.type,
      destinationAccountId: destinationAccount,
      personId: selectedPerson,
      assetId: selectedAsset,
    });

    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Please fill in all required fields');
      return;
    }

    const dueValidation = validateDueDate(dueDate, date);
    if (!dueValidation.isValid) {
      setErrorMessage(dueValidation.error || 'Invalid due date.');
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
    if (isSaving) return;
    try {
      setIsSaving(true);
      await createTransaction({
        id: generateEntityId('tx'),
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
        <IconButton
          icon={<X size={18} color={colors.textPrimary} />}
          size={36}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/home');
          }}
          accessibilityLabel="Close transaction form"
        />
      </View>

      {/* Transaction Type Selector Field */}
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>What happened?</Text>
      <Pressable
        onPress={() => setTypeModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`Transaction type: ${selectedTypeConfig.label}. Tap to change.`}
        style={({ pressed }) => [
          styles.typeSelectorCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.lg,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={[styles.typeIconBadge, { backgroundColor: selectedTypeConfig.bg }]}>
          <SelectedTypeIcon size={20} color={selectedTypeConfig.color} />
        </View>
        <View style={styles.typeDetailsCol}>
          <Text style={[styles.typeSelectorTitle, { color: colors.textPrimary }]}>
            {selectedTypeConfig.label}
          </Text>
          <Text style={[styles.typeSelectorDesc, { color: colors.textSecondary }]} numberOfLines={1}>
            {selectedTypeConfig.description}
          </Text>
        </View>
        <ChevronDown size={18} color={colors.textMuted} />
      </Pressable>

      {/* Transaction Type Selection Bottom Sheet */}
      <Modal
        visible={typeModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTypeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setTypeModalVisible(false)}
            accessibilityLabel="Close sheet"
          />
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.surfaceElevated || colors.surface,
                borderTopLeftRadius: radii.xl,
                borderTopRightRadius: radii.xl,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                  Transaction Type
                </Text>
                <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                  Select how this transaction affects your finances
                </Text>
              </View>
              <IconButton
                icon={<X size={16} color={colors.textPrimary} />}
                size={32}
                onPress={() => setTypeModalVisible(false)}
                accessibilityLabel="Close selection sheet"
              />
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40, paddingTop: 4 }}
            >
              {TRANSACTION_TYPES.map((t) => {
                const isSelected = selectedType === t.type;
                const TypeIcon = t.icon;
                return (
                  <Pressable
                    key={t.type}
                    onPress={() => {
                      setSelectedType(t.type);
                      setTypeModalVisible(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${t.label}: ${t.description}`}
                    style={({ pressed }) => [
                      styles.typeOptionRow,
                      {
                        backgroundColor: isSelected
                          ? (colors.accent + '18')
                          : pressed
                          ? colors.borderSubtle
                          : 'transparent',
                        borderColor: isSelected ? colors.accent : colors.borderSubtle || 'transparent',
                        borderRadius: radii.md,
                      },
                    ]}
                  >
                    <View style={[styles.typeOptionIcon, { backgroundColor: t.bg }]}>
                      <TypeIcon size={18} color={t.color} />
                    </View>
                    <View style={styles.typeOptionContent}>
                      <Text
                        style={[
                          styles.typeOptionTitle,
                          {
                            color: isSelected ? colors.accent : colors.textPrimary,
                            fontWeight: isSelected ? '700' : '600',
                          },
                        ]}
                      >
                        {t.label}
                      </Text>
                      <Text style={[styles.typeOptionDesc, { color: colors.textSecondary }]}>
                        {t.description}
                      </Text>
                    </View>
                    {isSelected && <Check size={18} color={colors.accent} style={{ marginLeft: 8 }} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

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

          {activePeople.length === 0 ? (
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
              {activePeople.map((p) => {
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

          {activeAssets.length === 0 ? (
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
              {activeAssets.map((ast) => {
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

        {selectableAccounts.length === 0 ? (
          <View
            style={[
              styles.emptySelector,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.md,
              },
            ]}
          >
            <Text style={{ color: colors.negative || '#EF4444', fontSize: 13, fontWeight: '500' }}>
              {selectedType === 'INCOME'
                ? 'No bank, cash, or investment accounts available to receive income. Credit cards cannot receive income.'
                : 'No active accounts available.'}
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 16 }}
          >
            {selectableAccounts.map((acc) => {
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
        )}
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
            {activeAccounts
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
            onChange={handleDateChange}
            placeholder="YYYY-MM-DD"
            includeFutureShortcuts={false}
            allowFutureDates={false}
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
              minDate={date}
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
  typeSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  typeIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeDetailsCol: {
    flex: 1,
  },
  typeSelectorTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  typeSelectorDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalSheet: {
    maxHeight: '75%',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  typeOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  typeOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeOptionContent: {
    flex: 1,
  },
  typeOptionTitle: {
    fontSize: 14,
  },
  typeOptionDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
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
