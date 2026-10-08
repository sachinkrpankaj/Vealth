import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Wallet, AlertCircle, ShoppingBag, CreditCard } from 'lucide-react-native';
import { ShoppingItem } from '../../domain/finance/types';
import { AmountInput } from '../ui/AmountInput';
import { DatePickerField } from '../ui/DatePickerField';
import { CategoryPickerField } from '../ui/CategoryPickerField';
import { PrimaryButton } from '../ui/PrimaryButton';
import { IconButton } from '../ui/IconButton';
import { KeyboardAwareScrollView } from '../ui/KeyboardAwareScrollView';
import { formatRupee } from '../../domain/finance/currency';
import { getAvailableCredit } from '../../domain/finance/creditCardBilling';
import { calculateAccountBalance } from '../../domain/finance/financialEngine';
import { SelectSheetField } from '../ui/SelectSheetField';
import { formatDateIso, getTodayLocalDateString } from '../../utils/dateUtils';
import { useTheme } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinancialData } from '../../hooks/useFinancialData';
import * as Haptics from 'expo-haptics';

interface PurchaseItemModalProps {
  visible: boolean;
  item: ShoppingItem | null;
  onClose: () => void;
  onConfirmPurchase: (params: {
    itemId: string;
    purchasePrice: number;
    purchaseAccountId: string;
    categoryId?: string | null;
    purchaseDate: string;
    customNote: string;
  }) => Promise<void>;
}

export const PurchaseItemModal: React.FC<PurchaseItemModalProps> = ({
  visible,
  item,
  onClose,
  onConfirmPurchase,
}) => {
  const { colors, radii, spacing, typography, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { accounts, transactions, categories } = useFinancialData();

  const [actualPrice, setActualPrice] = useState<number>(0);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState<string>(() => formatDateIso(new Date()));
  const [customNote, setCustomNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Spendable accounts: exclude archived and INVESTMENT (allow CREDIT_CARD)
  const spendableAccounts = React.useMemo(() => accounts.filter(
    (a) => !a.isArchived && a.type !== 'INVESTMENT'
  ), [accounts]);

  const getAccountAvailableFunds = (acc: typeof accounts[0]) => {
    // Match repository validation for backdated purchases, not today's balance.
    const balance = calculateAccountBalance(acc, transactions, purchaseDate);
    return acc.type === 'CREDIT_CARD' ? getAvailableCredit(acc.creditLimit, balance) : balance;
  };

  useEffect(() => {
    if (visible && item) {
      setActualPrice(item.estimatedPrice && item.estimatedPrice > 0 ? item.estimatedPrice : 0);
      setPurchaseDate(formatDateIso(new Date()));
      setCustomNote(`Shopping: ${item.name}`);
      setErrorMessage(null);
      setIsSubmitting(false);

      setSelectedAccountId(spendableAccounts[0]?.id ?? '');

      // Preselect Shopping or first expense category
      const shoppingCat = categories.find(
        (c) => c.type === 'EXPENSE' && !c.isArchived && c.name.toLowerCase() === 'shopping'
      );
      const defaultExpenseCat = categories.find((c) => c.type === 'EXPENSE' && !c.isArchived);
      setSelectedCategoryId(shoppingCat?.id || defaultExpenseCat?.id || null);
    }
  }, [visible, item]);

  useEffect(() => {
    if (visible && !spendableAccounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(spendableAccounts[0]?.id ?? '');
    }
  }, [visible, spendableAccounts, selectedAccountId]);

  if (!item) return null;

  const selectedAccount = spendableAccounts.find((a) => a.id === selectedAccountId);
  const selectedAccountAvailableFunds = selectedAccount ? getAccountAvailableFunds(selectedAccount) : 0;
  const isInsufficient = !!selectedAccount && actualPrice > 0 && selectedAccountAvailableFunds < actualPrice;

  const handleConfirm = async () => {
    if (isSubmitting) return;

    if (actualPrice <= 0) {
      setErrorMessage('Please enter an actual purchase price greater than zero.');
      return;
    }

    if (!selectedAccount) {
      setErrorMessage('Please select a payment account.');
      return;
    }

    if (isInsufficient) {
      const isCC = selectedAccount?.type === 'CREDIT_CARD';
      setErrorMessage(
        isCC
          ? `Insufficient credit limit on ${selectedAccount?.name || 'card'}. Available: ${formatRupee(
              selectedAccountAvailableFunds
            )}, Required: ${formatRupee(actualPrice)}.`
          : `Insufficient balance in ${selectedAccount?.name || 'account'}. Available: ${formatRupee(
              selectedAccountAvailableFunds
            )}, Required: ${formatRupee(actualPrice)}.`
      );
      return;
    }

    if (purchaseDate > getTodayLocalDateString()) {
      setErrorMessage('Purchase date cannot be in the future.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onConfirmPurchase({
        itemId: item.id,
        purchasePrice: actualPrice,
        purchaseAccountId: selectedAccountId,
        categoryId: selectedCategoryId,
        purchaseDate,
        customNote,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to record purchase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />

        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor: colors.surfaceElevated || colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.sheetTitle,
                  {
                    color: colors.textPrimary,
                    fontFamily: typography.fontFamilies.bold,
                  },
                ]}
              >
                Record Purchase
              </Text>
              <Text
                style={[
                  styles.sheetSubtitle,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamilies.medium,
                  },
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </View>
            <IconButton
              icon={<X size={18} color={colors.textPrimary} />}
              size={34}
              onPress={onClose}
              accessibilityLabel="Close"
            />
          </View>

          {/* Form Content */}
          <KeyboardAwareScrollView
            style={[styles.scrollArea, { flex: 0, flexShrink: 1 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Item hint card */}
            <View
              style={[
                styles.itemSummaryBox,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  borderRadius: radii.md,
                },
              ]}
            >
              <ShoppingBag size={18} color={isDark ? '#818CF8' : '#6366F1'} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.summaryItemName,
                    {
                      color: colors.textPrimary,
                      fontFamily: typography.fontFamilies.semibold,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                {item.estimatedPrice ? (
                  <Text
                    style={[
                      styles.summaryEstPrice,
                      {
                        color: colors.textSecondary,
                        fontFamily: typography.fontFamilies.regular,
                      },
                    ]}
                  >
                    Estimated budget: {formatRupee(item.estimatedPrice)}
                  </Text>
                ) : (
                  <Text
                    style={[
                      styles.summaryEstPrice,
                      {
                        color: colors.textMuted,
                        fontFamily: typography.fontFamilies.regular,
                      },
                    ]}
                  >
                    No estimated price set
                  </Text>
                )}
              </View>
            </View>

            {/* Actual Purchase Price */}
            <AmountInput
              label="Actual Purchase Price *"
              value={actualPrice}
              onChangeAmount={setActualPrice}
              style={{ marginTop: 14 }}
              autoFocus
            />

            <SelectSheetField
              label="Paid From Account"
              required
              value={selectedAccountId}
              onSelect={setSelectedAccountId}
              options={spendableAccounts.map((account) => ({
                value: account.id,
                label: account.name,
                icon: account.type === 'CREDIT_CARD' ? CreditCard : Wallet,
                description: `${account.type === 'CREDIT_CARD' ? 'Available credit' : 'Balance'}: ${formatRupee(getAccountAvailableFunds(account))}`,
              }))}
              placeholder="Select a payment account"
              disabled={spendableAccounts.length === 0}
              containerStyle={{ marginTop: 16 }}
            />
            {spendableAccounts.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>Add an active bank, cash, credit card, or other payment account first.</Text>
            ) : null}

            {/* Insufficient Funds / Credit Warning */}
            {isInsufficient ? (
              <View
                style={[
                  styles.warningBox,
                  { backgroundColor: colors.negativeBg, borderRadius: radii.sm },
                ]}
              >
                <AlertCircle size={15} color={colors.negative} style={{ marginRight: 6 }} />
                <Text
                  style={[
                    styles.warningText,
                    {
                      color: colors.negative,
                      fontFamily: typography.fontFamilies.medium,
                    },
                  ]}
                >
                  {selectedAccount?.type === 'CREDIT_CARD'
                    ? `Available credit on ${selectedAccount.name} (${formatRupee(selectedAccountAvailableFunds)}) is less than purchase price (${formatRupee(actualPrice)}).`
                    : `Account balance in ${selectedAccount?.name || 'account'} (${formatRupee(selectedAccountAvailableFunds)}) is less than purchase price (${formatRupee(actualPrice)}).`}
                </Text>
              </View>
            ) : null}

            {/* Category Field */}
            <CategoryPickerField
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={setSelectedCategoryId}
              label="Expense Category"
            />

            {/* Date Field */}
            <DatePickerField
              label="Purchase Date"
              value={purchaseDate}
              onChange={setPurchaseDate}
              placeholder="YYYY-MM-DD"
              allowFutureDates={false}
              style={{ marginTop: 12 }}
            />

            {/* Transaction Note */}
            <Text
              style={[
                styles.fieldLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamilies.semibold,
                  marginTop: 14,
                  marginBottom: 6,
                },
              ]}
            >
              Transaction Note
            </Text>
            <TextInput
              value={customNote}
              onChangeText={setCustomNote}
              placeholder="e.g. Shopping: Product Name"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
              style={[
                styles.textInput,
                {
                  color: colors.textPrimary,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radii.md,
                  fontFamily: typography.fontFamilies.regular,
                },
              ]}
            />

            {/* Error Message */}
            {errorMessage ? (
              <View
                style={[
                  styles.errorBox,
                  { backgroundColor: colors.negativeBg, borderRadius: radii.sm },
                ]}
              >
                <AlertCircle size={15} color={colors.negative} style={{ marginRight: 6 }} />
                <Text
                  style={[
                    styles.errorText,
                    {
                      color: colors.negative,
                      fontFamily: typography.fontFamilies.medium,
                    },
                  ]}
                >
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            {/* Spacer for bottom pinned button */}
            <View style={{ height: 16 }} />
          </KeyboardAwareScrollView>

          {/* Bottom Pinned Action CTA */}
          <View style={styles.actionsContainer}>
            <PrimaryButton
              title="Confirm Purchase"
              onPress={handleConfirm}
              loading={isSubmitting}
              disabled={isSubmitting || actualPrice <= 0 || isInsufficient}
              style={{ width: '100%' }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalSheet: {
    maxHeight: '88%',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    elevation: 20,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
  },
  sheetSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    marginTop: 6,
    flexShrink: 1,
  },
  itemSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  summaryItemName: {
    fontSize: 14,
  },
  summaryEstPrice: {
    fontSize: 12,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginVertical: 8,
  },
  warningText: {
    fontSize: 12,
    flex: 1,
  },
  textInput: {
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    fontSize: 15,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginTop: 12,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  actionsContainer: {
    width: '100%',
    paddingTop: 12,
  },
});
