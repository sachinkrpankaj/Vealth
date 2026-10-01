import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Check, Wallet, AlertCircle, ShoppingBag } from 'lucide-react-native';
import { ShoppingItem, Account } from '../../domain/finance/types';
import { AmountInput } from '../ui/AmountInput';
import { DatePickerField } from '../ui/DatePickerField';
import { CategoryPickerField } from '../ui/CategoryPickerField';
import { PrimaryButton } from '../ui/PrimaryButton';
import { SecondaryButton } from '../ui/SecondaryButton';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import { formatRupee } from '../../domain/finance/currency';
import { formatDateIso } from '../../utils/dateUtils';
import { useTheme } from '../../theme';
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
    categoryId: string;
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
  const { accounts, accountBalances, categories } = useFinancialData();

  const [actualPrice, setActualPrice] = useState<number>(0);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState<string>(() => formatDateIso(new Date()));
  const [customNote, setCustomNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Spendable accounts: exclude archived, CREDIT_CARD, and INVESTMENT
  const spendableAccounts = accounts.filter(
    (a) => !a.isArchived && a.type !== 'CREDIT_CARD' && a.type !== 'INVESTMENT'
  );

  useEffect(() => {
    if (visible && item) {
      setActualPrice(0); // Require manual price entry as per requirement
      setPurchaseDate(formatDateIso(new Date()));
      setCustomNote(`Shopping: ${item.name}`);
      setErrorMessage(null);
      setIsSubmitting(false);

      if (spendableAccounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(spendableAccounts[0].id);
      }

      // Default category if none selected
      if (!selectedCategoryId) {
        const defaultCat = categories.find((c) => c.type === 'EXPENSE' && !c.isArchived);
        if (defaultCat) {
          setSelectedCategoryId(defaultCat.id);
        }
      }
    }
  }, [visible, item]);

  if (!item) return null;

  const selectedAccount = spendableAccounts.find((a) => a.id === selectedAccountId);
  const currentAccountBalance = selectedAccount ? accountBalances.get(selectedAccount.id) ?? 0 : 0;
  const isInsufficient = actualPrice > 0 && currentAccountBalance < actualPrice;

  const handleConfirm = async () => {
    if (isSubmitting) return;

    if (actualPrice <= 0) {
      setErrorMessage('Please enter an actual purchase price greater than zero.');
      return;
    }

    if (!selectedAccountId) {
      setErrorMessage('Please select a payment account.');
      return;
    }

    if (isInsufficient) {
      setErrorMessage(
        `Insufficient balance in ${selectedAccount?.name || 'account'}. Available: ${formatRupee(
          currentAccountBalance
        )}, Required: ${formatRupee(actualPrice)}.`
      );
      return;
    }

    if (!selectedCategoryId) {
      setErrorMessage('Please select an expense category.');
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
            },
          ]}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Record Purchase</Text>
              <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={[styles.closeBtn, { backgroundColor: colors.borderSubtle }]}
            >
              <X size={18} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Item hint card */}
            <View
              style={[
                styles.itemSummaryBox,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderRadius: radii.md },
              ]}
            >
              <ShoppingBag size={18} color={colors.accent} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.summaryItemName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.estimatedPrice ? (
                  <Text style={[styles.summaryEstPrice, { color: colors.textSecondary }]}>
                    Estimated: {formatRupee(item.estimatedPrice)}
                  </Text>
                ) : (
                  <Text style={[styles.summaryEstPrice, { color: colors.textMuted }]}>
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

            {/* Account Selector */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16, marginBottom: 8 }]}>
              Paid From Account *
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountsScroll}>
              {spendableAccounts.map((acc) => {
                const isSelected = acc.id === selectedAccountId;
                const bal = accountBalances.get(acc.id) ?? 0;
                return (
                  <Pressable
                    key={acc.id}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setSelectedAccountId(acc.id);
                    }}
                    style={[
                      styles.accountChip,
                      {
                        backgroundColor: isSelected
                          ? colors.accent
                          : isDark
                          ? 'rgba(255,255,255,0.05)'
                          : 'rgba(0,0,0,0.04)',
                        borderColor: isSelected ? colors.accent : colors.borderSubtle,
                        borderRadius: radii.md,
                      },
                    ]}
                  >
                    <Wallet size={14} color={isSelected ? '#FFFFFF' : colors.textSecondary} style={{ marginRight: 6 }} />
                    <View>
                      <Text
                        style={[
                          styles.accountChipName,
                          { color: isSelected ? '#FFFFFF' : colors.textPrimary, fontWeight: isSelected ? '700' : '600' },
                        ]}
                      >
                        {acc.name}
                      </Text>
                      <Text
                        style={[
                          styles.accountChipBalance,
                          { color: isSelected ? 'rgba(255,255,255,0.85)' : colors.textMuted },
                        ]}
                      >
                        {formatRupee(bal)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Insufficient Funds Warning */}
            {isInsufficient ? (
              <View style={[styles.warningBox, { backgroundColor: colors.negativeBg, borderRadius: radii.sm }]}>
                <AlertCircle size={15} color={colors.negative} style={{ marginRight: 6 }} />
                <Text style={[styles.warningText, { color: colors.negative }]}>
                  Insufficient funds in {selectedAccount?.name} ({formatRupee(currentAccountBalance)})
                </Text>
              </View>
            ) : null}

            {/* Category Field */}
            <CategoryPickerField
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={setSelectedCategoryId}
              label="Expense Category *"
            />

            {/* Date Field */}
            <DatePickerField
              label="Purchase Date"
              value={purchaseDate}
              onChange={setPurchaseDate}
              placeholder="YYYY-MM-DD"
              style={{ marginTop: 12 }}
            />

            {/* Transaction Note */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 14, marginBottom: 6 }]}>
              Transaction Note
            </Text>
            <TextInput
              value={customNote}
              onChangeText={setCustomNote}
              placeholder="e.g. Shopping: Product Name"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.textInput,
                {
                  color: colors.textPrimary,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radii.md,
                },
              ]}
            />

            {/* Error Message */}
            {errorMessage ? (
              <View style={[styles.errorBox, { backgroundColor: colors.negativeBg, borderRadius: radii.sm }]}>
                <AlertCircle size={15} color={colors.negative} style={{ marginRight: 6 }} />
                <Text style={[styles.errorText, { color: colors.negative }]}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <PrimaryButton
                title="Confirm Purchase"
                onPress={handleConfirm}
                loading={isSubmitting}
                disabled={isSubmitting || actualPrice <= 0 || isInsufficient}
                style={{ width: '100%' }}
              />
            </View>
          </ScrollView>
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
    maxHeight: '90%',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
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
    fontWeight: '700',
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
  },
  itemSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  summaryItemName: {
    fontSize: 14,
    fontWeight: '700',
  },
  summaryEstPrice: {
    fontSize: 12,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accountsScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    borderWidth: 1,
  },
  accountChipName: {
    fontSize: 13,
  },
  accountChipBalance: {
    fontSize: 11,
    marginTop: 1,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginVertical: 8,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '600',
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
    fontWeight: '600',
    flex: 1,
  },
  actionsContainer: {
    width: '100%',
    marginTop: 20,
    marginBottom: 16,
  },
});
