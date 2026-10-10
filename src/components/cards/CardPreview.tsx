import React from 'react';
import { View, Text, StyleSheet, Pressable, StyleProp, ViewStyle } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Path,
} from 'react-native-svg';
import { PaymentNetworkLogo, PaymentNetwork } from './PaymentNetworkLogo';
import { CardType, CardColorTheme, CARD_COLOR_THEMES } from '../../domain/cards/types';
import {
  formatMaskedCardNumber,
  formatCardNumberInput,
  formatExpiryString,
  isCardExpired,
} from '../../domain/cards/cardValidation';
import { useTheme } from '../../theme';

export interface CardPreviewProps {
  cardholderName?: string;
  cardNumber?: string; // If provided unmasked
  lastFour?: string; // If provided masked
  isRevealed?: boolean;
  network?: PaymentNetwork;
  cardType?: CardType;
  issuer?: string; // Bank or Card Issuer (e.g. HDFC Bank, SBI Card)
  expiryMonth?: number;
  expiryYear?: number;
  cardNickname?: string;
  linkedAccountName?: string;
  colorTheme?: CardColorTheme;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Authentic EMV Smart Chip SVG
 * Precision-scaled brushed metallic finish with standard contact pad geometries.
 */
const RealisticEmvChip: React.FC<{ size?: number; isGold?: boolean }> = ({
  size = 38,
  isGold = false,
}) => {
  const width = size;
  const height = Math.round(size * 0.76); // 38x29 standard chip ratio

  const gradId = isGold ? 'chipMetalGold' : 'chipMetalSilver';

  return (
    <Svg width={width} height={height} viewBox="0 0 45 34" fill="none">
      <Defs>
        <LinearGradient id="chipMetalGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FDE68A" />
          <Stop offset="35%" stopColor="#F59E0B" />
          <Stop offset="70%" stopColor="#D97706" />
          <Stop offset="100%" stopColor="#B45309" />
        </LinearGradient>
        <LinearGradient id="chipMetalSilver" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#F1F5F9" />
          <Stop offset="30%" stopColor="#E2E8F0" />
          <Stop offset="70%" stopColor="#94A3B8" />
          <Stop offset="100%" stopColor="#64748B" />
        </LinearGradient>
      </Defs>
      {/* Outer rounded chip body */}
      <Rect
        width="45"
        height="34"
        rx="5.5"
        fill={`url(#${gradId})`}
        stroke={isGold ? '#92400E' : '#475569'}
        strokeWidth="0.8"
      />
      {/* Etched contact divider lines */}
      <Path
        d="M0 12.5H18M18 12.5V0M18 12.5V34M18 21.5H0M27 0V12.5M27 12.5H45M27 12.5V34M27 21.5H45"
        stroke={isGold ? 'rgba(120,53,15,0.7)' : 'rgba(51,65,85,0.75)'}
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* Center contact core */}
      <Rect
        x="18"
        y="12.5"
        width="9"
        height="9"
        rx="2"
        fill={isGold ? '#F59E0B' : '#94A3B8'}
        stroke={isGold ? 'rgba(120,53,15,0.7)' : 'rgba(51,65,85,0.75)'}
        strokeWidth="0.8"
      />
    </Svg>
  );
};

/**
 * Subtle Contactless NFC Symbol
 */
const SubtleContactless: React.FC<{ size?: number; color?: string }> = ({
  size = 17,
  color = 'rgba(255, 255, 255, 0.45)',
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 17C8.2 15.5 9 13.8 9 12C9 10.2 8.2 8.5 7 7"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <Path
        d="M11 19.5C13 17.3 14.2 14.8 14.2 12C14.2 9.2 13 6.7 11 4.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <Path
        d="M15.5 22C18.2 19.1 19.5 15.8 19.5 12C19.5 8.2 18.2 4.9 15.5 2"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
};

export const CardPreview: React.FC<CardPreviewProps> = ({
  cardholderName = 'CARDHOLDER NAME',
  cardNumber,
  lastFour = '••••',
  isRevealed = false,
  network = 'VISA',
  cardType = 'CREDIT',
  issuer,
  expiryMonth = 12,
  expiryYear = 2029,
  cardNickname,
  linkedAccountName,
  colorTheme = 'midnight',
  onPress,
  style,
}) => {
  const { typography } = useTheme();
  const theme = CARD_COLOR_THEMES[colorTheme] || CARD_COLOR_THEMES.midnight;

  // Number formatting with appropriate spacing
  const displayNumber =
    isRevealed && cardNumber
      ? formatCardNumberInput(cardNumber, network)
      : formatMaskedCardNumber(lastFour || cardNumber?.slice(-4) || '••••', network);

  const formattedExpiry = formatExpiryString(expiryMonth, expiryYear);
  const expired = isCardExpired(expiryMonth, expiryYear);
  const isGoldTheme = colorTheme === 'gold';

  const content = (
    <View
      pointerEvents={onPress ? 'none' : 'auto'}
      style={[styles.cardContainer, { backgroundColor: theme.gradient[0] }, style]}
    >
      {/* Background Gradient & Soft Natural Radial Specular Sheen */}
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox="0 0 340 214"
        preserveAspectRatio="none"
        pointerEvents="none"
      >
        <Defs>
          {/* Rich Card Diagonal Gradient */}
          <LinearGradient id={`cardBaseGrad_${colorTheme}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={theme.gradient[0]} stopOpacity="1" />
            <Stop offset="60%" stopColor={theme.gradient[0]} stopOpacity="0.95" />
            <Stop offset="100%" stopColor={theme.gradient[1]} stopOpacity="1" />
          </LinearGradient>

          {/* Soft Physical Radial Highlight: Naturally illuminates the top-left quadrant and dissipates seamlessly with zero rectangular edges */}
          <RadialGradient
            id={`radialGlow_${colorTheme}`}
            cx="22%"
            cy="18%"
            r="75%"
            fx="18%"
            fy="14%"
          >
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.14" />
            <Stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.05" />
            <Stop offset="65%" stopColor="#FFFFFF" stopOpacity="0.008" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>

          {/* Subtle bottom depth vignette */}
          <LinearGradient id={`cardDepth_${colorTheme}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="65%" stopColor="#000000" stopOpacity="0" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0.16" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width="340" height="214" fill={`url(#cardBaseGrad_${colorTheme})`} />
        <Rect x="0" y="0" width="340" height="214" fill={`url(#radialGlow_${colorTheme})`} />
        <Rect x="0" y="0" width="340" height="214" fill={`url(#cardDepth_${colorTheme})`} />
      </Svg>

      {/* Top Row: Issuer / Nickname & Card Type Pill */}
      <View style={styles.topRow}>
        <View style={styles.issuerWrap}>
          <Text
            style={[styles.bankNameText, { color: 'rgba(255, 255, 255, 0.92)' }]}
            numberOfLines={1}
          >
            {(issuer || 'VEALTH').toUpperCase()}
          </Text>
          {cardNickname ? (
            <Text
              style={[styles.nicknameText, { color: theme.textColor }]}
              numberOfLines={1}
            >
              {cardNickname}
            </Text>
          ) : null}
        </View>

        <View style={styles.typePill}>
          <Text style={styles.typePillText}>{cardType}</Text>
        </View>
      </View>

      {/* Middle-Left Row: EMV Chip & Contactless Symbol */}
      <View style={styles.chipRow}>
        <RealisticEmvChip size={38} isGold={isGoldTheme} />
        <View style={styles.contactlessWrap}>
          <SubtleContactless size={18} color="rgba(255, 255, 255, 0.45)" />
        </View>
      </View>

      {/* Card Number Section: Generous vertical spacing & crisp foil emboss */}
      <View style={styles.numberRow}>
        <Text
          style={[
            styles.cardNumberText,
            {
              color: theme.textColor,
              fontFamily: typography.fontFamilies.bold,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {displayNumber}
        </Text>
      </View>

      {/* Bottom Row: Cardholder, Expiry & Payment Network Logo (aligned bottom-right) */}
      <View style={styles.bottomRow}>
        {/* Cardholder Column */}
        <View style={styles.holderCol}>
          <Text style={styles.metaLabel}>CARDHOLDER</Text>
          <Text
            style={[
              styles.holderNameText,
              {
                color: theme.textColor,
                fontFamily: typography.fontFamilies.semibold,
              },
            ]}
            numberOfLines={1}
          >
            {(cardholderName || 'CARDHOLDER NAME').toUpperCase()}
          </Text>
        </View>

        {/* Expiry Date Column */}
        <View style={styles.expiryCol}>
          <Text style={styles.metaLabel}>VALID THRU</Text>
          <View style={styles.expiryBadgeRow}>
            <Text
              style={[
                styles.expiryValueText,
                {
                  color: expired ? '#FCA5A5' : theme.textColor,
                  fontFamily: typography.fontFamilies.semibold,
                },
              ]}
            >
              {formattedExpiry}
            </Text>
            {expired && (
              <View style={styles.expiredTag}>
                <Text style={styles.expiredTagText}>EXP</Text>
              </View>
            )}
          </View>
        </View>

        {/* Payment Network Logo: Bottom Right */}
        <View style={styles.networkLogoCol}>
          <PaymentNetworkLogo network={network} size={24} variant="card" />
        </View>
      </View>

      {/* Optional Linked Account Subtle Indicator */}
      {linkedAccountName ? (
        <View style={styles.linkedBar}>
          <Text style={styles.linkedBarText} numberOfLines={1}>
            Linked Account: {linkedAccountName}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${cardType} card ${displayNumber}, ${cardholderName}`}
        style={({ pressed }) => [
          styles.pressableWrap,
          pressed && styles.pressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  pressableWrap: {
    width: '100%',
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.94,
  },
  cardContainer: {
    width: '100%',
    aspectRatio: 1.586, // Standard ISO ID-1 Credit Card Aspect Ratio
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  issuerWrap: {
    flex: 1,
    marginRight: 10,
  },
  bankNameText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  nicknameText: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  typePill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  typePillText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  contactlessWrap: {
    marginLeft: 12,
  },
  numberRow: {
    marginVertical: 4,
  },
  cardNumberText: {
    fontSize: 18.5,
    letterSpacing: 2.4,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 2.5,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  holderCol: {
    flex: 2.2,
    marginRight: 10,
  },
  metaLabel: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  holderNameText: {
    fontSize: 12.5,
    letterSpacing: 0.6,
  },
  expiryCol: {
    flex: 1.2,
    marginRight: 12,
  },
  expiryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expiryValueText: {
    fontSize: 12.5,
    letterSpacing: 1,
  },
  expiredTag: {
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  expiredTagText: {
    color: '#FCA5A5',
    fontSize: 7.5,
    fontWeight: 'bold',
  },
  networkLogoCol: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  linkedBar: {
    marginTop: 3,
    paddingTop: 3,
    borderTopWidth: 0.8,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  linkedBarText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 9.5,
    fontWeight: '500',
  },
});
