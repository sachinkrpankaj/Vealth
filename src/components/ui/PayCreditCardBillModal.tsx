import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Landmark, PiggyBank, CircleDot, Check, CreditCard as CreditCardIcon } from 'lucide-react-native';
import { Account, AccountType } from '../../domain/finance/types';
import { useTheme } from '../../theme';
import { AmountInput } from './AmountInput';
import { DatePickerField } from './DatePickerField';
import { PrimaryButton } from './PrimaryButton';
import { LiquidGlassCard } from './LiquidGlassCard';
import { createTransaction } from '../../database/repositories/transactionRepository';
import { formatRupee } from '../../domain/finance/currency';
import { formatDateIso } from '../../utils/dateUtils';
import * as Haptics from 'expo-haptics';

interface PayCreditCardBillModalProps {
  visible: boolean;
  onClose: () => void;
  creditCard: Account | null;
  unpaidBillAmount: number; // in paise
  accounts: Account[];
  accountBalances: Map<string, number>;
  onPaymentSuccess: () => void;
}

function getAccountIcon(type: AccountType) {
  switch (type) {
    case 'BANK':
      return Landmark;
    case 'INVESTMENT':
      return PiggyBank;
    default:
      return CircleDot;
  }
}

export const PayCreditCardBillModal: React.FC<PayCreditCardBillModalProps> = ({
  visible,
  onClose,
  creditCard,
  unpaidBillAmount,
  accounts,
  accountBalances,
  onPaymentSuccess,
}) => {
  const { colors, typography, radii, spacing, isDark } = useTheme();

  // STRICT REQUIREMENT: Only spendable non-credit funding accounts allowed (BANK, OTHER).
  // Strictly exclude CASH, CREDIT_CARD, INVESTMENT, the card itself, and archived accounts.
  const eligibleAccounts = accounts.filter(
    (a) =>
      a.type !== 'CASH' &&
      a.type !== 'CREDIT_CARD' &&
      a.type !== 'INVESTMENT' &&
      a.id !== creditCard?.id &&
      !a.isArchived
  );

  const [paymentAmount, setPaymentAmount] = useState<number>(unpaidBillAmount);
  const [paymentDate, setPaymentDate] = useState<string>(formatDateIso(new Date()));
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    eligibleAccounts[0]?.id || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setPaymentAmount(unpaidBillAmount);
      setPaymentDate(formatDateIso(new Date()));
      if (eligibleAccounts.length > 0 && !eligibleAccounts.some((a) => a.id === selectedAccountId)) {
        setSelectedAccountId(eligibleAccounts[0].id);
      }
      setError(null);
    }
  }, [visible, unpaidBillAmount, creditCard?.id]);

  // Hooks must run even while there is no selected card (the modal is mounted on Home).
  // Smooth slide-up and fade animation
  const slideAnim = useRef(new Animated.Value(280)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(280);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 24,
          mass: 0.9,
          stiffness: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!creditCard) return null;

  const handleSmoothClose = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 280,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (callback) callback();
      onClose();
    });
  };

  const handleConfirm = async () => {
    if (!creditCard) return;
    if (isSubmittingRef.current || isSubmitting) return;

    if (paymentAmount <= 0) {
      setError('Please enter a payment amount greater than zero.');
      return;
    }

    if (paymentAmount > unpaidBillAmount) {
      setError(`Payment amount cannot exceed the unpaid statement bill of ${formatRupee(unpaidBillAmount)}.`);
      return;
    }

    const fundingAccount = eligibleAccounts.find((account) => account.id === selectedAccountId);
    if (!fundingAccount) {
      setError('Please select a valid funding account to pay from.');
      return;
    }

    if (fundingAccount.id === creditCard.id || fundingAccount.type === 'CREDIT_CARD') {
      setError('Cannot pay a credit card bill from a credit card account.');
      return;
    }

    if (fundingAccount.type === 'INVESTMENT' || fundingAccount.type === 'CASH') {
      setError('Selected account type is not eligible for credit card bill payments.');
      return;
    }

    const sourceBalance = accountBalances.get(fundingAccount.id) ?? fundingAccount.openingBalance;
    if (paymentAmount > sourceBalance) {
      setError(
        `Insufficient funds in ${fundingAccount.name}. Available: ${formatRupee(sourceBalance)}, required: ${formatRupee(paymentAmount)}.`
      );
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setError(null);

      // Record TRANSFER from Bank to Credit Card
      await createTransaction({
        id: `tx-bill-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'TRANSFER',
        amount: Math.round(paymentAmount),
        date: paymentDate,
        accountId: fundingAccount.id, // Balance cut from this funding account
        destinationAccountId: creditCard.id, // Balance credited to credit card (restores limit)
        note: `Credit card bill payment for ${creditCard.name}`,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      handleSmoothClose(() => {
        onPaymentSuccess();
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to record bill payment');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => handleSmoothClose()}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => handleSmoothClose()} />
        </Animated.View>

        <Animated.View
          style={[
            styles.modalCardWrapper,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <LiquidGlassCard
            radius={28}
            padding={20}
            style={[styles.modalCard, { backgroundColor: colors.surfaceElevated }]}
          >
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.title,
                    { color: colors.textPrimary, fontFamily: typography.fontFamilies.bold },
                  ]}
                >
                  Mark Bill as Paid
                </Text>
                <Text
                  style={[
                    styles.subtitle,
                    { color: colors.textMuted, fontFamily: typography.fontFamilies.medium },
                  ]}
                >
                  {creditCard.name}
                </Text>
              </View>

              <LiquidGlassCard onPress={() => handleSmoothClose()} accessibilityLabel="Close bill payment"
                radius={radii.full} padding={0} style={styles.closeBtn}>
                <X size={18} color={colors.textPrimary} />
              </LiquidGlassCard>
            </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {/* Unpaid Bill summary pill */}
            <View
              style={[
                styles.summaryBox,
                {
                  backgroundColor: isDark ? 'rgba(212, 163, 115, 0.12)' : 'rgba(212, 163, 115, 0.08)',
                  borderColor: colors.gold + '40',
                  borderRadius: radii.lg,
                },
              ]}
            >
              <View style={styles.summaryRow}>
                <CreditCardIcon size={20} color={colors.gold} />
                <Text
                  style={[
                    styles.summaryLabel,
                    { color: colors.textSecondary, fontFamily: typography.fontFamilies.medium },
                  ]}
                >
                  Unpaid Statement Bill:
                </Text>
              </View>
              <Text
                style={[
                  styles.summaryAmount,
                  { color: colors.gold, fontFamily: typography.fontFamilies.extrabold },
                ]}
              >
                {formatRupee(unpaidBillAmount)}
              </Text>
            </View>

            {/* 1. Payment Amount */}
            <View style={{ marginTop: 14 }}>
              <AmountInput
                label="Amount to Pay"
                value={paymentAmount}
                onChangeAmount={(amt) => {
                  setPaymentAmount(amt);
                  if (amt > unpaidBillAmount) {
                    setError(`Payment cannot exceed unpaid bill of ${formatRupee(unpaidBillAmount)}`);
                  } else if (error) {
                    setError(null);
                  }
                }}
                placeholder="0.00"
              />
            </View>

            {/* 2. When (Payment Date) - Opens Calendar Date Picker */}
            <View style={{ marginTop: 14 }}>
              <DatePickerField
                label="Payment Date *"
                value={paymentDate}
                onChange={setPaymentDate}
              />
            </View>

            {/* 3. By using which account he paid the bill (Strictly NO Cash accounts!) */}
            <View style={{ marginTop: 16 }}>
              <Text
                style={[
                  styles.fieldLabel,
                  { color: colors.textSecondary, fontFamily: typography.fontFamilies.semibold },
                ]}
              >
                Paid Using Account *
              </Text>
              <Text
                style={[
                  styles.fieldHelper,
                  { color: colors.textMuted, fontFamily: typography.fontFamilies.regular },
                ]}
              >
                Balance will be cut from this account (cash accounts excluded)
              </Text>

              {eligibleAccounts.length === 0 ? (
                <View
                  style={[
                    styles.noBankWarning,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.negative + '40',
                      borderRadius: radii.md,
                    },
                  ]}
                >
                  <Text style={[styles.warningText, { color: colors.negative }]}>
                    No bank accounts available. Please add a bank account first to pay credit card bills.
                  </Text>
                </View>
              ) : (
                <View style={styles.accountsList}>
                  {eligibleAccounts.map((acc) => {
                    const isSelected = selectedAccountId === acc.id;
                    const bal = accountBalances.get(acc.id) ?? acc.openingBalance;
                    const Icon = getAccountIcon(acc.type);

                    return (
                      <LiquidGlassCard
                        key={acc.id}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setSelectedAccountId(acc.id);
                          if (error) setError(null);
                        }}
                        accessibilityLabel={`Pay using ${acc.name}`}
                        accessibilityState={{ selected: isSelected }}
                        radius={radii.md} padding={0}
                        style={[styles.accountOption, isSelected && { borderColor: colors.gold, borderWidth: 2 }]}
                      >
                        <View
                          style={[
                            styles.accIconWrap,
                            {
                              backgroundColor: acc.color ? `${acc.color}20` : colors.surfaceSubtle,
                              borderRadius: radii.sm,
                            },
                          ]}
                        >
                          <Icon size={18} color={acc.color || colors.textPrimary} />
                        </View>

                        <View style={{ flex: 1, marginHorizontal: 10 }}>
                          <Text
                            style={[
                              styles.accName,
                              {
                                color: colors.textPrimary,
                                fontFamily: typography.fontFamilies.semibold,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {acc.name}
                          </Text>
                          <Text
                            style={[
                              styles.accBalance,
                              {
                                color: bal < 0 ? colors.negative : colors.textMuted,
                                fontFamily: typography.fontFamilies.medium,
                              },
                            ]}
                          >
                            Available: {formatRupee(bal)}
                          </Text>
                        </View>

                        {isSelected && (
                          <View
                            style={[
                              styles.checkCircle,
                              { backgroundColor: colors.gold, borderRadius: radii.full },
                            ]}
                          >
                            <Check size={12} color="#000" strokeWidth={3} />
                          </View>
                        )}
                      </LiquidGlassCard>
                    );
                  })}
                </View>
              )}
            </View>

            {error ? (
              <Text style={[styles.errorText, { color: colors.negative }]}>{error}</Text>
            ) : null}
          </ScrollView>

          {/* Confirm Button */}
          <PrimaryButton
            title="Confirm & Deduct Bill"
            onPress={handleConfirm}
            loading={isSubmitting}
            disabled={
              !eligibleAccounts.some((account) => account.id === selectedAccountId) ||
              paymentAmount <= 0 ||
              paymentAmount > unpaidBillAmount ||
              isSubmitting
            }
            style={{ marginTop: 12 }}
          />
        </LiquidGlassCard>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalCardWrapper: {
    width: '100%',
    maxHeight: '90%',
  },
  modalCard: {
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  summaryBox: {
    padding: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryLabel: {
    fontSize: 13,
  },
  summaryAmount: {
    fontSize: 17,
  },
  fieldLabel: {
    fontSize: 13,
    marginBottom: 2,
  },
  fieldHelper: {
    fontSize: 11,
    marginBottom: 10,
  },
  accountsList: {
    gap: 8,
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1.5,
  },
  accIconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accName: {
    fontSize: 14,
  },
  accBalance: {
    fontSize: 12,
    marginTop: 2,
  },
  checkCircle: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noBankWarning: {
    padding: 14,
    borderWidth: 1,
  },
  warningText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
});
