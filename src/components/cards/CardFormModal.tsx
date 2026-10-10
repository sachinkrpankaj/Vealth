import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { X, Check, Building, CreditCard, ShieldAlert, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import {
  CardType,
  CardColorTheme,
  CARD_COLOR_THEMES,
  SavedCard,
  CreateCardInput,
  UpdateCardInput,
} from '../../domain/cards/types';
import { PaymentNetwork } from './PaymentNetworkLogo';
import { Account } from '../../domain/finance/types';
import { CardPreview } from './CardPreview';
import { PaymentNetworkPicker } from './PaymentNetworkPicker';
import { CardIssuerPicker } from './CardIssuerPicker';
import { SelectSheetField, SelectSheetOption } from '../ui/SelectSheetField';
import { SegmentedControl } from '../ui/SegmentedControl';
import { IconButton } from '../ui/IconButton';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import { KeyboardAwareScrollView } from '../ui/KeyboardAwareScrollView';
import {
  cleanCardNumber,
  formatCardNumberInput,
  detectPaymentNetwork,
  parseExpiryString,
  formatExpiryString,
  validateCardDetails,
} from '../../domain/cards/cardValidation';
import { createCard, updateCard } from '../../database/repositories/cardRepository';

export interface CardFormModalProps {
  visible: boolean;
  initialCard?: SavedCard | null;
  preselectedAccountId?: string;
  accounts: Account[];
  onClose: () => void;
  onSuccess: (card: SavedCard) => void;
}

const THEME_OPTIONS: CardColorTheme[] = [
  'midnight',
  'obsidian',
  'emerald',
  'sapphire',
  'amethyst',
  'ruby',
  'gold',
];

export const CardFormModal: React.FC<CardFormModalProps> = ({
  visible,
  initialCard,
  preselectedAccountId,
  accounts,
  onClose,
  onSuccess,
}) => {
  const { colors, radii, spacing, typography, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isEditing = Boolean(initialCard);

  const [cardType, setCardType] = useState<CardType>(initialCard?.cardType || 'CREDIT');
  const [issuer, setIssuer] = useState<string>(initialCard?.issuer || '');
  const [cardholderName, setCardholderName] = useState(initialCard?.cardholderName || '');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryInput, setExpiryInput] = useState(
    initialCard
      ? formatExpiryString(initialCard.expiryMonth, initialCard.expiryYear)
      : ''
  );
  const [network, setNetwork] = useState<PaymentNetwork>(initialCard?.network || 'VISA');
  const [cardNickname, setCardNickname] = useState(initialCard?.cardNickname || '');
  const [linkedAccountId, setLinkedAccountId] = useState<string | undefined>(
    initialCard?.linkedAccountId || preselectedAccountId || undefined
  );
  const [colorTheme, setColorTheme] = useState<CardColorTheme>(
    initialCard?.colorTheme || 'midnight'
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Synchronize state when modal opens or initialCard changes
  useEffect(() => {
    if (visible) {
      if (initialCard) {
        setCardType(initialCard.cardType);
        setIssuer(initialCard.issuer || '');
        setCardholderName(initialCard.cardholderName);
        setCardNumber('');
        setExpiryInput(formatExpiryString(initialCard.expiryMonth, initialCard.expiryYear));
        setNetwork(initialCard.network);
        setCardNickname(initialCard.cardNickname || '');
        setLinkedAccountId(initialCard.linkedAccountId);
        setColorTheme(initialCard.colorTheme || 'midnight');
      } else {
        // Defaults for new card
        setCardType('CREDIT');
        setIssuer('');
        setCardholderName('');
        setCardNumber('');
        setExpiryInput('');
        setNetwork('VISA');
        setCardNickname('');
        setColorTheme('midnight');

        if (preselectedAccountId) {
          const acc = accounts.find((a) => a.id === preselectedAccountId);
          if (acc) {
            setLinkedAccountId(acc.id);
            setCardType(acc.type === 'BANK' ? 'DEBIT' : 'CREDIT');
          } else {
            setLinkedAccountId(undefined);
          }
        } else {
          setLinkedAccountId(undefined);
        }
      }
      setErrors({});
    }
  }, [visible, initialCard?.id, preselectedAccountId]);

  // Auto-detect network when card number changes
  const handleCardNumberChange = (raw: string) => {
    const clean = cleanCardNumber(raw);
    const formatted = formatCardNumberInput(clean);
    setCardNumber(formatted);

    // Auto-detect network if input is at least 2 digits
    if (clean.length >= 2) {
      const detected = detectPaymentNetwork(clean);
      if (detected !== 'OTHER') {
        setNetwork(detected);
      }
    }

    if (errors.cardNumber) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.cardNumber;
        return next;
      });
    }
  };

  const handleExpiryChange = (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, 4);
    if (clean.length >= 3) {
      setExpiryInput(`${clean.slice(0, 2)}/${clean.slice(2)}`);
    } else {
      setExpiryInput(clean);
    }

    if (errors.expiry) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.expiry;
        return next;
      });
    }
  };

  // Filter linked accounts by card type
  const availableLinkedAccounts = accounts.filter((acc) => {
    if (acc.isArchived) return false;
    if (cardType === 'DEBIT') {
      return acc.type === 'BANK';
    }
    if (cardType === 'CREDIT') {
      return acc.type === 'CREDIT_CARD';
    }
    return false;
  });

  const linkedAccountOptions: SelectSheetOption<string>[] = [
    ...(cardType === 'CREDIT'
      ? [
          {
            value: '',
            label: 'None (Standalone Credit Card)',
            description: 'Do not link to any financial account balance',
          },
        ]
      : []),
    ...availableLinkedAccounts.map((acc) => ({
      value: acc.id,
      label: acc.name,
      description: `${acc.type.replace('_', ' ')} • Current balance tracked separately`,
      color: acc.color,
    })),
  ];

  const parsedExpiry = parseExpiryString(expiryInput);
  const selectedLinkedAccount = accounts.find((a) => a.id === linkedAccountId);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      const cleanNum = cleanCardNumber(cardNumber);

      const exp = parseExpiryString(expiryInput);
      const expiryMonth = exp ? exp.month : 0;
      const expiryYear = exp ? exp.year : 0;

      const validation = validateCardDetails({
        cardholderName,
        cardNumber: isEditing ? (cleanNum ? cleanNum : undefined) : cleanNum,
        expiryMonth,
        expiryYear,
        cardType,
        issuer,
        requireIssuer: cardType === 'CREDIT',
        linkedAccount: selectedLinkedAccount,
        isEditing,
      });

      if (!validation.isValid) {
        setErrors(validation.errors);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setIsSubmitting(false);
        return;
      }

      if (isEditing && initialCard) {
        const updates: UpdateCardInput = {
          cardholderName: cardholderName.trim(),
          cardType,
          network,
          issuer: issuer.trim() || undefined,
          expiryMonth,
          expiryYear,
          cardNickname: cardNickname.trim() || undefined,
          linkedAccountId: linkedAccountId || null,
          colorTheme,
          cardNumber: cleanNum ? cleanNum : undefined,
        };

        const updated = await updateCard(initialCard.id, updates);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onSuccess(updated);
        onClose();
      } else {
        const createInput: CreateCardInput = {
          cardholderName: cardholderName.trim(),
          cardNumber: cleanNum,
          cardType,
          network,
          issuer: issuer.trim() || undefined,
          expiryMonth,
          expiryYear,
          cardNickname: cardNickname.trim() || undefined,
          linkedAccountId: linkedAccountId || undefined,
          colorTheme,
        };

        const created = await createCard(createInput);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onSuccess(created);
        onClose();
      }
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'Could not save card details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor: colors.surfaceElevated || colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom + 12, 24),
            },
          ]}
        >
          {/* Sheet Handle */}
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text
                style={[
                  styles.sheetTitle,
                  {
                    color: colors.textPrimary,
                    fontFamily: typography.fontFamilies.bold,
                    fontSize: typography.fontSizes.headingSm,
                  },
                ]}
              >
                {isEditing ? 'Edit Card Details' : 'Add Card to Wallet'}
              </Text>
              <Text
                style={[
                  styles.sheetSubtitle,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamilies.regular,
                    fontSize: typography.fontSizes.caption,
                  },
                ]}
              >
                {isEditing
                  ? 'Update fields without duplicating records'
                  : 'Encrypted storage with hardware-backed security'}
              </Text>
            </View>

            <IconButton
              onPress={onClose}
              accessibilityLabel="Cancel"
              size={34}
              icon={<X size={18} color={colors.textSecondary} />}
            />
          </View>

          <KeyboardAwareScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* Live Interactive Preview */}
            <View style={styles.previewBox}>
              <CardPreview
                cardholderName={cardholderName || 'CARDHOLDER NAME'}
                cardNumber={cardNumber ? cardNumber : undefined}
                lastFour={
                  cardNumber
                    ? cleanCardNumber(cardNumber).slice(-4)
                    : initialCard?.lastFour || '••••'
                }
                isRevealed={Boolean(cardNumber)}
                network={network}
                cardType={cardType}
                issuer={issuer}
                expiryMonth={parsedExpiry ? parsedExpiry.month : initialCard?.expiryMonth || 12}
                expiryYear={parsedExpiry ? parsedExpiry.year : initialCard?.expiryYear || 2028}
                cardNickname={cardNickname}
                linkedAccountName={selectedLinkedAccount?.name}
                colorTheme={colorTheme}
              />
            </View>

            {/* Card Type Selector (Credit vs Debit) */}
            <View style={styles.fieldSection}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Card Type *
              </Text>
              <SegmentedControl
                options={[
                  { key: 'CREDIT', label: 'Credit Card' },
                  { key: 'DEBIT', label: 'Debit Card' },
                ]}
                activeKey={cardType}
                onChange={(newType) => {
                  setCardType(newType as CardType);
                  // Reset linked account if conflicting
                  if (newType === 'DEBIT' && selectedLinkedAccount?.type !== 'BANK') {
                    const firstBank = accounts.find((a) => a.type === 'BANK' && !a.isArchived);
                    setLinkedAccountId(firstBank?.id);
                  }
                  if (newType === 'CREDIT' && selectedLinkedAccount?.type !== 'CREDIT_CARD') {
                    setLinkedAccountId(undefined);
                  }
                }}
              />
            </View>

            {/* Bank / Card Issuer Selector (Required for Credit Card) */}
            <CardIssuerPicker
              value={issuer}
              onSelect={(selectedIssuer) => {
                setIssuer(selectedIssuer);
                if (errors.issuer) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.issuer;
                    return next;
                  });
                }
              }}
              required={cardType === 'CREDIT'}
              error={errors.issuer}
            />

            {/* Cardholder Name */}
            <View style={styles.fieldSection}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Cardholder Name *
              </Text>
              <TextInput
                value={cardholderName}
                onChangeText={(t) => {
                  setCardholderName(t);
                  if (errors.cardholderName) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.cardholderName;
                      return next;
                    });
                  }
                }}
                placeholder="Full name on card"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: errors.cardholderName ? colors.negative : colors.border,
                    color: colors.textPrimary,
                    borderRadius: radii.md,
                    fontFamily: typography.fontFamilies.medium,
                  },
                ]}
              />
              {errors.cardholderName && (
                <Text style={[styles.errorText, { color: colors.negative }]}>
                  {errors.cardholderName}
                </Text>
              )}
            </View>

            {/* Card Number Input */}
            <View style={styles.fieldSection}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {isEditing ? 'Card Number (Leave blank to keep existing)' : 'Card Number *'}
              </Text>
              <TextInput
                value={cardNumber}
                onChangeText={handleCardNumberChange}
                placeholder={
                  isEditing
                    ? `•••• •••• •••• ${initialCard?.lastFour || '••••'}`
                    : '16-digit card number'
                }
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={23}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: errors.cardNumber ? colors.negative : colors.border,
                    color: colors.textPrimary,
                    borderRadius: radii.md,
                    fontFamily: typography.fontFamilies.bold,
                    letterSpacing: 1.2,
                  },
                ]}
              />
              {errors.cardNumber && (
                <Text style={[styles.errorText, { color: colors.negative }]}>
                  {errors.cardNumber}
                </Text>
              )}
            </View>

            {/* Expiry Date */}
            <View style={styles.fieldSection}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Expiry Date *
              </Text>
              <TextInput
                value={expiryInput}
                onChangeText={handleExpiryChange}
                placeholder="MM/YY"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={5}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: errors.expiry ? colors.negative : colors.border,
                    color: colors.textPrimary,
                    borderRadius: radii.md,
                    fontFamily: typography.fontFamilies.semibold,
                  },
                ]}
              />
              {errors.expiry && (
                <Text style={[styles.errorText, { color: colors.negative }]}>
                  {errors.expiry}
                </Text>
              )}
            </View>

            {/* Searchable Payment Network Dropdown */}
            <PaymentNetworkPicker
              value={network}
              onSelect={(net) => setNetwork(net)}
              label="Payment Network Provider *"
            />

            {/* Linked Financial Account Selector */}
            <SelectSheetField
              label={
                cardType === 'DEBIT'
                  ? 'Linked Bank Account *'
                  : 'Linked Credit Card Account (Optional)'
              }
              value={linkedAccountId || ''}
              options={linkedAccountOptions}
              onSelect={(val) => {
                setLinkedAccountId(val || undefined);
                if (errors.linkedAccountId) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.linkedAccountId;
                    return next;
                  });
                }
              }}
              placeholder={
                cardType === 'DEBIT'
                  ? 'Select Bank Account (Required)'
                  : 'None (Standalone Card)'
              }
              error={errors.linkedAccountId}
              containerStyle={{ marginBottom: 16 }}
            />

            {/* Optional Nickname */}
            <View style={styles.fieldSection}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Card Nickname (Optional)
              </Text>
              <TextInput
                value={cardNickname}
                onChangeText={setCardNickname}
                placeholder="e.g. HDFC Regalia, Salary Debit Card"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    borderRadius: radii.md,
                    fontFamily: typography.fontFamilies.regular,
                  },
                ]}
              />
            </View>

            {/* Card Appearance / Color Theme Selector */}
            <View style={styles.fieldSection}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Card Theme Visual
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.themesRow}>
                {THEME_OPTIONS.map((themeKey) => {
                  const cfg = CARD_COLOR_THEMES[themeKey];
                  const isSelected = colorTheme === themeKey;
                  return (
                    <Pressable
                      key={themeKey}
                      onPress={() => setColorTheme(themeKey)}
                      accessibilityRole="button"
                      accessibilityLabel={`${cfg.name} card theme`}
                      style={[
                        styles.themeChip,
                        {
                          backgroundColor: cfg.gradient[0],
                          borderColor: isSelected ? colors.accent : 'rgba(255,255,255,0.15)',
                          borderRadius: radii.md,
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                    >
                      <View style={[styles.themeChipInner, { backgroundColor: cfg.gradient[1] }]} />
                      <Text
                        style={[
                          styles.themeChipText,
                          {
                            color: '#FFFFFF',
                            fontFamily: isSelected
                              ? typography.fontFamilies.bold
                              : typography.fontFamilies.regular,
                          },
                        ]}
                      >
                        {cfg.name}
                      </Text>
                      {isSelected && (
                        <Check size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Save Button */}
            <View style={styles.submitSection}>
              <LiquidGlassCard
                onPress={handleSubmit}
                disabled={isSubmitting}
                tone="emphasized"
                radius={radii.md}
                padding={14}
                style={styles.submitBtn}
                accessibilityLabel={isEditing ? 'Save Changes' : 'Save Card to Wallet'}
              >
                <View style={styles.submitBtnContent}>
                  <Check size={18} color="#FFFFFF" />
                  <Text
                    style={[
                      styles.submitBtnText,
                      {
                        color: '#FFFFFF',
                        fontFamily: typography.fontFamilies.bold,
                      },
                    ]}
                  >
                    {isSubmitting
                      ? 'Securing Card...'
                      : isEditing
                      ? 'Save Changes'
                      : 'Save Card to Wallet'}
                  </Text>
                </View>
              </LiquidGlassCard>
            </View>
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalSheet: {
    height: '92%',
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
  },
  sheetSubtitle: {
    marginTop: 2,
  },
  previewBox: {
    marginBottom: 14,
  },
  fieldSection: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },

  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  themesRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    overflow: 'hidden',
  },
  themeChipInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  themeChipText: {
    fontSize: 12,
  },
  submitSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  submitBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    fontSize: 15,
  },
});
