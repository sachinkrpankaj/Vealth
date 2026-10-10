import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import {
  Eye,
  EyeOff,
  Copy,
  Pencil,
  Trash2,
  X,
  ShieldCheck,
  CreditCard,
  Building2,
  Check,
  Lock,
  User,
  Calendar,
  Landmark,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { SavedCard } from '../../domain/cards/types';
import { Account } from '../../domain/finance/types';
import { CardPreview } from './CardPreview';
import { PaymentNetworkLogo, PAYMENT_NETWORK_CONFIG } from './PaymentNetworkLogo';
import { IconButton } from '../ui/IconButton';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import { showThemedAlert } from '../ui/ThemedDialog';
import {
  formatExpiryString,
  formatCardNumberInput,
  formatMaskedCardNumber,
} from '../../domain/cards/cardValidation';
import {
  revealCardNumber,
  deleteCard,
} from '../../database/repositories/cardRepository';
import { copySensitiveTextToClipboard } from '../../domain/cards/cardSecurity';
import { useSecurityStore } from '../../stores/useSecurityStore';

export interface CardDetailModalProps {
  visible: boolean;
  card: SavedCard | null;
  linkedAccount?: Account | null;
  onClose: () => void;
  onEdit: (card: SavedCard) => void;
  onCardDeleted?: (cardId: string) => void;
}

export const CardDetailModal: React.FC<CardDetailModalProps> = ({
  visible,
  card,
  linkedAccount,
  onClose,
  onEdit,
  onCardDeleted,
}) => {
  const { colors, radii, spacing, typography, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const {
    isPinEnabled,
    isBiometricEnabled,
    authenticateWithBiometrics,
    verifyPin,
  } = useSecurityStore();

  const [isRevealed, setIsRevealed] = useState(false);
  const [decryptedNumber, setDecryptedNumber] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [pinPromptVisible, setPinPromptVisible] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear memory whenever modal closes or active card changes
  useEffect(() => {
    if (!visible) {
      setIsRevealed(false);
      setDecryptedNumber(null);
      setEnteredPin('');
      setPinError(null);
      setPinPromptVisible(false);
      setCopiedField(null);
      setFeedbackMessage(null);
    }
  }, [visible, card?.id]);

  const showSafeFeedback = (label: string, message: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopiedField(label);
    setFeedbackMessage(message);

    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = setTimeout(() => {
      setCopiedField(null);
      setFeedbackMessage(null);
    }, 2800);
  };

  const handleRevealToggle = async () => {
    if (isRevealed) {
      // Re-mask and purge decrypted number from memory
      setIsRevealed(false);
      setDecryptedNumber(null);
      return;
    }

    if (!card) return;

    // Check if authentication is required
    if (isBiometricEnabled) {
      setIsAuthenticating(true);
      const success = await authenticateWithBiometrics();
      setIsAuthenticating(false);
      if (success) {
        await decryptAndShowNumber();
        return;
      }
    }

    if (isPinEnabled) {
      setEnteredPin('');
      setPinError(null);
      setPinPromptVisible(true);
      return;
    }

    // If app security PIN/biometric is not configured, reveal with gentle confirmation
    await decryptAndShowNumber();
  };

  const decryptAndShowNumber = async () => {
    if (!card) return;
    try {
      const fullNumber = await revealCardNumber(card);
      setDecryptedNumber(fullNumber);
      setIsRevealed(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (e: any) {
      Alert.alert('Decryption Error', e.message || 'Could not decrypt card number.');
    }
  };

  const handlePinSubmit = async () => {
    if (!enteredPin) return;
    const isValid = await verifyPin(enteredPin);
    if (isValid) {
      setPinPromptVisible(false);
      setEnteredPin('');
      setPinError(null);
      await decryptAndShowNumber();
    } else {
      setPinError('Incorrect PIN. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const handleCopyCardNumber = async () => {
    if (!card) return;
    let numberToCopy = decryptedNumber;
    if (!numberToCopy) {
      try {
        numberToCopy = await revealCardNumber(card);
      } catch {
        Alert.alert('Copy Error', 'Failed to retrieve card number.');
        return;
      }
    }

    await copySensitiveTextToClipboard(numberToCopy);
    showSafeFeedback('number', 'Card number copied to clipboard');
  };

  const handleCopyHolderName = async () => {
    if (!card) return;
    await copySensitiveTextToClipboard(card.cardholderName);
    showSafeFeedback('name', 'Cardholder name copied to clipboard');
  };

  const handleCopyExpiry = async () => {
    if (!card) return;
    const expiry = formatExpiryString(card.expiryMonth, card.expiryYear);
    await copySensitiveTextToClipboard(expiry);
    showSafeFeedback('expiry', `Expiry date (${expiry}) copied`);
  };


  const handleDelete = () => {
    if (!card) return;
    showThemedAlert(
      'Delete Card',
      `Are you sure you want to remove this ${card.network} card (${card.lastFour})? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCard(card.id);
              onCardDeleted?.(card.id);
              onClose();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not delete card.');
            }
          },
        },
      ]
    );
  };

  if (!card) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={onClose}
          accessibilityLabel="Close card details"
        />

        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor: colors.surfaceElevated || colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom + 16, 28),
            },
          ]}
        >
          {/* Handle */}
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

          {/* Top Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerTitleWrap}>
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
                {card.cardNickname || `${card.network} ${card.cardType}`}
              </Text>
              <Text
                style={[
                  styles.sheetSub,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamilies.regular,
                    fontSize: typography.fontSizes.caption,
                  },
                ]}
              >
                Hardware Encrypted Card
              </Text>
            </View>

            <View style={styles.headerActions}>
              <IconButton
                onPress={() => {
                  onEdit(card);
                }}
                accessibilityLabel="Edit card"
                size={34}
                icon={<Pencil size={16} color={colors.textPrimary} />}
              />
              <IconButton
                onPress={handleDelete}
                accessibilityLabel="Delete card"
                variant="destructive"
                size={34}
                icon={<Trash2 size={16} color={colors.negative} />}
              />
              <IconButton
                onPress={onClose}
                accessibilityLabel="Close"
                size={34}
                icon={<X size={18} color={colors.textSecondary} />}
              />
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* Live Professional Card Preview */}
            <View style={styles.previewContainer}>
              <CardPreview
                cardholderName={card.cardholderName}
                cardNumber={decryptedNumber ?? undefined}
                lastFour={card.lastFour}
                isRevealed={isRevealed}
                network={card.network}
                cardType={card.cardType}
                issuer={card.issuer}
                expiryMonth={card.expiryMonth}
                expiryYear={card.expiryYear}
                cardNickname={card.cardNickname}
                linkedAccountName={linkedAccount?.name}
                colorTheme={card.colorTheme}
              />
            </View>

            {/* Safe Feedback Banner */}
            {feedbackMessage && (
              <View
                style={[
                  styles.feedbackBanner,
                  {
                    backgroundColor: colors.positiveBg || 'rgba(16, 185, 129, 0.15)',
                    borderColor: colors.positive || '#10B981',
                    borderRadius: radii.md,
                  },
                ]}
              >
                <Check size={16} color={colors.positive || '#10B981'} />
                <Text
                  style={[
                    styles.feedbackText,
                    {
                      color: colors.positive || '#10B981',
                      fontFamily: typography.fontFamilies.semibold,
                    },
                  ]}
                >
                  {feedbackMessage}
                </Text>
              </View>
            )}

            {/* Section 1: Sculpted Card Credentials Card (Clean, elegant, non-nested composition) */}
            <View
              style={[
                styles.credentialsCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                },
              ]}
            >
              {/* Header: Title and Integrated Reveal/Mask Action */}
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionHeaderLeft}>
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: `${colors.accent}14`,
                      },
                    ]}
                  >
                    <ShieldCheck size={16} color={colors.accent} />
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.sectionTitle,
                        {
                          color: colors.textPrimary,
                          fontFamily: typography.fontFamilies.bold,
                        },
                      ]}
                    >
                      Card Credentials
                    </Text>
                    <Text
                      style={[
                        styles.sectionSubtitle,
                        {
                          color: colors.textMuted,
                          fontFamily: typography.fontFamilies.regular,
                        },
                      ]}
                    >
                      Hardware-encrypted security vault
                    </Text>
                  </View>
                </View>

                {/* Integrated Reveal / Mask Action Button */}
                <Pressable
                  onPress={handleRevealToggle}
                  accessibilityRole="button"
                  accessibilityLabel={isRevealed ? 'Mask card number' : 'Reveal full card number'}
                  style={({ pressed }) => [
                    styles.pillActionBtn,
                    {
                      backgroundColor: isRevealed
                        ? colors.surfaceSubtle
                        : `${colors.accent}14`,
                      borderColor: isRevealed
                        ? colors.border
                        : `${colors.accent}30`,
                      borderRadius: radii.full,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  {isRevealed ? (
                    <>
                      <EyeOff size={13} color={colors.textSecondary} />
                      <Text
                        style={[
                          styles.pillActionText,
                          {
                            color: colors.textSecondary,
                            fontFamily: typography.fontFamilies.semibold,
                          },
                        ]}
                      >
                        Mask
                      </Text>
                    </>
                  ) : (
                    <>
                      <Eye size={13} color={colors.accent} />
                      <Text
                        style={[
                          styles.pillActionText,
                          {
                            color: colors.accent,
                            fontFamily: typography.fontFamilies.bold,
                          },
                        ]}
                      >
                        Reveal
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>

              {/* 1. Hero Card Number Section */}
              <View style={styles.heroNumberBox}>
                <View style={styles.heroNumberTopRow}>
                  <Text style={[styles.microLabel, { color: colors.textMuted }]}>
                    CARD NUMBER
                  </Text>
                  <View
                    style={[
                      styles.stateTag,
                      {
                        backgroundColor: isRevealed
                          ? `${colors.accent}14`
                          : isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(0, 0, 0, 0.04)',
                        borderColor: isRevealed
                          ? `${colors.accent}28`
                          : colors.borderSubtle,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.stateTagText,
                        { color: isRevealed ? colors.accent : colors.textMuted },
                      ]}
                    >
                      {isRevealed ? 'UNMASKED' : 'PROTECTED'}
                    </Text>
                  </View>
                </View>

                <View style={styles.heroNumberValueRow}>
                  <Text
                    style={[
                      styles.heroNumberText,
                      {
                        color: colors.textPrimary,
                        fontFamily: typography.fontFamilies.bold,
                      },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {isRevealed && decryptedNumber
                      ? formatCardNumberInput(decryptedNumber, card.network)
                      : formatMaskedCardNumber(card.lastFour, card.network)}
                  </Text>

                  <Pressable
                    onPress={handleCopyCardNumber}
                    accessibilityRole="button"
                    accessibilityLabel="Copy card number"
                    style={({ pressed }) => [
                      styles.copyPillBtn,
                      copiedField === 'number'
                        ? {
                            backgroundColor: colors.positive || '#10B981',
                            borderColor: colors.positive || '#10B981',
                          }
                        : {
                            backgroundColor: colors.surfaceSubtle,
                            borderColor: colors.border,
                          },
                      {
                        borderRadius: radii.full,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    {copiedField === 'number' ? (
                      <>
                        <Check size={12} color="#FFFFFF" />
                        <Text style={[styles.copyBtnText, { color: '#FFFFFF' }]}>Copied</Text>
                      </>
                    ) : (
                      <>
                        <Copy size={12} color={colors.textSecondary} />
                        <Text style={[styles.copyBtnText, { color: colors.textSecondary }]}>Copy</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>

              <View style={[styles.hairlineDivider, { backgroundColor: colors.borderSubtle }]} />

              {/* 2. Cardholder Name Row */}
              <View style={styles.credentialRow}>
                <View
                  style={[
                    styles.rowIconBadge,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(0, 0, 0, 0.04)',
                    },
                  ]}
                >
                  <User size={15} color={colors.textSecondary} />
                </View>
                <View style={styles.rowContentCol}>
                  <Text style={[styles.microLabel, { color: colors.textMuted }]}>
                    CARDHOLDER
                  </Text>
                  <Text
                    style={[
                      styles.rowValueText,
                      {
                        color: colors.textPrimary,
                        fontFamily: typography.fontFamilies.semibold,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {card.cardholderName}
                  </Text>
                </View>

                <Pressable
                  onPress={handleCopyHolderName}
                  accessibilityRole="button"
                  accessibilityLabel="Copy cardholder name"
                  style={({ pressed }) => [
                    styles.copyPillBtn,
                    copiedField === 'name'
                      ? {
                          backgroundColor: colors.positive || '#10B981',
                          borderColor: colors.positive || '#10B981',
                        }
                      : {
                          backgroundColor: colors.surfaceSubtle,
                          borderColor: colors.border,
                        },
                    {
                      borderRadius: radii.full,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  {copiedField === 'name' ? (
                    <>
                      <Check size={12} color="#FFFFFF" />
                      <Text style={[styles.copyBtnText, { color: '#FFFFFF' }]}>Copied</Text>
                    </>
                  ) : (
                    <>
                      <Copy size={12} color={colors.textSecondary} />
                      <Text style={[styles.copyBtnText, { color: colors.textSecondary }]}>Copy</Text>
                    </>
                  )}
                </Pressable>
              </View>

              <View style={[styles.hairlineDivider, { backgroundColor: colors.borderSubtle }]} />

              {/* 3. Expiry Date Row */}
              <View style={styles.credentialRow}>
                <View
                  style={[
                    styles.rowIconBadge,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(0, 0, 0, 0.04)',
                    },
                  ]}
                >
                  <Calendar size={15} color={colors.textSecondary} />
                </View>
                <View style={styles.rowContentCol}>
                  <Text style={[styles.microLabel, { color: colors.textMuted }]}>
                    VALID THRU / EXPIRY
                  </Text>
                  <Text
                    style={[
                      styles.rowValueText,
                      {
                        color: colors.textPrimary,
                        fontFamily: typography.fontFamilies.semibold,
                      },
                    ]}
                  >
                    {formatExpiryString(card.expiryMonth, card.expiryYear)}
                  </Text>
                </View>

                <Pressable
                  onPress={handleCopyExpiry}
                  accessibilityRole="button"
                  accessibilityLabel="Copy expiry date"
                  style={({ pressed }) => [
                    styles.copyPillBtn,
                    copiedField === 'expiry'
                      ? {
                          backgroundColor: colors.positive || '#10B981',
                          borderColor: colors.positive || '#10B981',
                        }
                      : {
                          backgroundColor: colors.surfaceSubtle,
                          borderColor: colors.border,
                        },
                    {
                      borderRadius: radii.full,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  {copiedField === 'expiry' ? (
                    <>
                      <Check size={12} color="#FFFFFF" />
                      <Text style={[styles.copyBtnText, { color: '#FFFFFF' }]}>Copied</Text>
                    </>
                  ) : (
                    <>
                      <Copy size={12} color={colors.textSecondary} />
                      <Text style={[styles.copyBtnText, { color: colors.textSecondary }]}>Copy</Text>
                    </>
                  )}
                </Pressable>
              </View>

              <View style={[styles.hairlineDivider, { backgroundColor: colors.borderSubtle }]} />

              {/* 4. Bank / Card Issuer Row */}
              <View style={styles.credentialRow}>
                <View
                  style={[
                    styles.rowIconBadge,
                    {
                      backgroundColor: `${colors.accent}12`,
                    },
                  ]}
                >
                  <Building2 size={15} color={colors.accent} />
                </View>
                <View style={styles.rowContentCol}>
                  <Text style={[styles.microLabel, { color: colors.textMuted }]}>
                    BANK / CARD ISSUER
                  </Text>
                  <View style={styles.inlineTagRow}>
                    <Text
                      style={[
                        styles.rowValueText,
                        {
                          color: colors.textPrimary,
                          fontFamily: typography.fontFamilies.semibold,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {card.issuer || (card.cardType === 'CREDIT' ? 'Standard Credit Card' : 'Bank Issued')}
                    </Text>
                    <View
                      style={[
                        styles.typeBadge,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(0, 0, 0, 0.05)',
                        },
                      ]}
                    >
                      <Text style={[styles.typeBadgeText, { color: colors.textSecondary }]}>
                        {card.cardType}
                      </Text>
                    </View>
                  </View>
                </View>

                <Pressable
                  onPress={() => {
                    onEdit(card);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Edit issuer and card details"
                  style={({ pressed }) => [
                    styles.editPillBtn,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                      borderRadius: radii.full,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Pencil size={11} color={colors.textSecondary} />
                  <Text style={[styles.editBtnText, { color: colors.textSecondary }]}>Edit</Text>
                </Pressable>
              </View>

              <View style={[styles.hairlineDivider, { backgroundColor: colors.borderSubtle }]} />

              {/* 5. Payment Network Row (Zero Overlap Guaranteed!) */}
              <View style={styles.networkRow}>
                <View
                  style={[
                    styles.networkLogoSlot,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(0, 0, 0, 0.04)',
                      borderRadius: radii.sm,
                    },
                  ]}
                >
                  <PaymentNetworkLogo network={card.network} size={20} />
                </View>

                <View style={styles.networkInfoCol}>
                  <Text style={[styles.microLabel, { color: colors.textMuted }]}>
                    PAYMENT NETWORK
                  </Text>
                  <Text
                    style={[
                      styles.rowValueText,
                      {
                        color: colors.textPrimary,
                        fontFamily: typography.fontFamilies.semibold,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {PAYMENT_NETWORK_CONFIG[card.network]?.name || card.network}
                  </Text>
                  <Text
                    style={[
                      styles.networkDescText,
                      {
                        color: colors.textMuted,
                        fontFamily: typography.fontFamilies.regular,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {PAYMENT_NETWORK_CONFIG[card.network]?.description || 'Payment Network Provider'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.networkVerifiedBadge,
                    {
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      borderColor: 'rgba(16, 185, 129, 0.25)',
                    },
                  ]}
                >
                  <ShieldCheck size={11} color="#10B981" style={{ marginRight: 3 }} />
                  <Text style={styles.networkVerifiedText}>Official</Text>
                </View>
              </View>
            </View>

            {/* Section 2: Linked Financial Account (Sculpted, non-nested Card) */}
            <View
              style={[
                styles.linkedAccountCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                },
              ]}
            >
              <View style={styles.linkedHeaderRow}>
                <View style={styles.sectionHeaderLeft}>
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: linkedAccount
                          ? `${colors.accent}14`
                          : isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(0, 0, 0, 0.04)',
                      },
                    ]}
                  >
                    <Landmark
                      size={16}
                      color={linkedAccount ? colors.accent : colors.textSecondary}
                    />
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.sectionTitle,
                        {
                          color: colors.textPrimary,
                          fontFamily: typography.fontFamilies.bold,
                        },
                      ]}
                    >
                      Linked Financial Account
                    </Text>
                    <Text
                      style={[
                        styles.sectionSubtitle,
                        {
                          color: colors.textMuted,
                          fontFamily: typography.fontFamilies.regular,
                        },
                      ]}
                    >
                      Vealth balance synchronization
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.stateTag,
                    {
                      backgroundColor: linkedAccount
                        ? `${colors.accent}14`
                        : 'rgba(100, 116, 139, 0.12)',
                      borderColor: linkedAccount
                        ? `${colors.accent}30`
                        : 'rgba(100, 116, 139, 0.2)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.stateTagText,
                      { color: linkedAccount ? colors.accent : colors.textMuted },
                    ]}
                  >
                    {linkedAccount ? 'LINKED' : 'STANDALONE'}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.linkedAccountBody,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderRadius: radii.md,
                    borderColor: colors.borderSubtle,
                  },
                ]}
              >
                <View style={styles.linkedAccountMainRow}>
                  <Text
                    style={[
                      styles.linkedAccountName,
                      {
                        color: colors.textPrimary,
                        fontFamily: typography.fontFamilies.semibold,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {linkedAccount
                      ? linkedAccount.name
                      : card.cardType === 'DEBIT'
                      ? 'No Bank Account Linked'
                      : 'Standalone Credit Card'}
                  </Text>

                  {linkedAccount && (
                    <View
                      style={[
                        styles.accountTypeChip,
                        {
                          backgroundColor: `${colors.accent}18`,
                        },
                      ]}
                    >
                      <Text style={[styles.accountTypeChipText, { color: colors.accent }]}>
                        {linkedAccount.type.replace('_', ' ')}
                      </Text>
                    </View>
                  )}
                </View>

                <Text
                  style={[
                    styles.linkedAccountExplanation,
                    {
                      color: colors.textMuted,
                      fontFamily: typography.fontFamilies.regular,
                    },
                  ]}
                >
                  {linkedAccount
                    ? 'Card transactions can automatically link to and reflect against this account balance.'
                    : card.cardType === 'DEBIT'
                    ? 'Debit cards are typically linked to a bank balance. You can edit this card anytime to link an account.'
                    : 'This card is securely retained for instant credential lookup, reference, and quick copy.'}
                </Text>
              </View>
            </View>

            {/* Security Guarantee Note */}
            <View style={styles.securityGuaranteeBox}>
              <ShieldCheck size={16} color={colors.accent} style={{ marginRight: 6 }} />
              <Text style={[styles.securityGuaranteeText, { color: colors.textSecondary }]}>
                Encrypted with hardware-backed keystore. Sensitive numbers masked by default. Zero financial balance impact.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* PIN Authentication Prompt Modal */}
      <Modal
        visible={pinPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPinPromptVisible(false)}
      >
        <View style={styles.pinModalOverlay}>
          <View
            style={[
              styles.pinModalBox,
              {
                backgroundColor: colors.surfaceElevated || colors.surface,
                borderRadius: radii.lg,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.pinModalHeader}>
              <Lock size={20} color={colors.accent} />
              <Text
                style={[
                  styles.pinModalTitle,
                  {
                    color: colors.textPrimary,
                    fontFamily: typography.fontFamilies.bold,
                  },
                ]}
              >
                Security Verification
              </Text>
            </View>
            <Text style={[styles.pinModalSub, { color: colors.textSecondary }]}>
              Enter your vealth security PIN to reveal the full card number.
            </Text>

            <TextInput
              value={enteredPin}
              onChangeText={(t) => {
                setEnteredPin(t);
                setPinError(null);
              }}
              placeholder="••••"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              autoFocus
              style={[
                styles.pinInput,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: pinError ? colors.negative : colors.border,
                  color: colors.textPrimary,
                  borderRadius: radii.md,
                },
              ]}
            />

            {pinError && (
              <Text style={[styles.pinErrorText, { color: colors.negative }]}>
                {pinError}
              </Text>
            )}

            <View style={styles.pinActionsRow}>
              <Pressable
                onPress={() => setPinPromptVisible(false)}
                style={[styles.pinActionBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handlePinSubmit}
                style={[styles.pinActionBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Verify & Reveal</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
    height: '90%',
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitleWrap: {
    flex: 1,
    marginRight: 8,
  },
  sheetTitle: {
    fontSize: 17,
  },
  sheetSub: {
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewContainer: {
    marginBottom: 14,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  feedbackText: {
    fontSize: 13,
  },
  credentialsCard: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
  },
  sectionSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  pillActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  pillActionText: {
    fontSize: 12,
  },
  heroNumberBox: {
    paddingBottom: 8,
  },
  heroNumberTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  microLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  stateTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.8,
  },
  stateTagText: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroNumberValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroNumberText: {
    fontSize: 16.5,
    letterSpacing: 1.6,
    flex: 1,
    marginRight: 8,
  },
  copyPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  hairlineDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
  credentialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  rowIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rowContentCol: {
    flex: 1,
    marginRight: 8,
  },
  rowValueText: {
    fontSize: 13.5,
    marginTop: 1,
  },
  inlineTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  typeBadgeText: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  editPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderWidth: 1,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  networkLogoSlot: {
    width: 78,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  networkInfoCol: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  networkDescText: {
    fontSize: 10.5,
    marginTop: 1,
  },
  networkVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 0.8,
  },
  networkVerifiedText: {
    color: '#10B981',
    fontSize: 9.5,
    fontWeight: '700',
  },
  linkedAccountCard: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  linkedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  linkedAccountBody: {
    padding: 12,
    borderWidth: 1,
  },
  linkedAccountMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  linkedAccountName: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  accountTypeChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  accountTypeChipText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  linkedAccountExplanation: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  securityGuaranteeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 2,
  },
  securityGuaranteeText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  pinModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pinModalBox: {
    width: '100%',
    maxWidth: 340,
    padding: 20,
    borderWidth: 1,
  },
  pinModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pinModalTitle: {
    fontSize: 16,
  },
  pinModalSub: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  pinInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 8,
  },
  pinErrorText: {
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  pinActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  pinActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
