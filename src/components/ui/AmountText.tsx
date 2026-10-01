import React from 'react';
import { Text, TextStyle, StyleSheet } from 'react-native';
import { formatRupee, formatRupeeMasked, FormatRupeeOptions } from '../../domain/finance/currency';
import { useCountingAnimation } from '../../hooks/useCountingAnimation';
import { useTheme } from '../../theme';

export type AmountSize = 'hero' | 'headingLg' | 'headingMd' | 'headingSm' | 'bodyLg' | 'body';
export type AmountVariant = 'default' | 'positive' | 'negative' | 'warning' | 'muted' | 'accent';

interface AmountTextProps {
  amount: number; // minor units (paise)
  size?: AmountSize;
  variant?: AmountVariant;
  showSign?: boolean;
  showPaise?: boolean;
  style?: TextStyle;
  animated?: boolean;
  duration?: number;
  isMasked?: boolean;
  triggerOnFocus?: boolean;
}

export const AmountText: React.FC<AmountTextProps> = ({
  amount,
  size = 'headingMd',
  variant = 'default',
  showSign = false,
  showPaise,
  style,
  animated = true,
  duration = 750,
  isMasked = false,
  triggerOnFocus = true,
}) => {
  const { colors, typography } = useTheme();

  let textColor = colors.textPrimary;
  if (variant === 'positive') {
    textColor = colors.positive;
  } else if (variant === 'negative') {
    textColor = colors.negative;
  } else if (variant === 'warning') {
    textColor = colors.warning;
  } else if (variant === 'muted') {
    textColor = colors.textMuted;
  } else if (variant === 'accent') {
    textColor = colors.accent;
  }

  const fontSize = typography.fontSizes[size];
  const lineHeight = typography.lineHeights[size];

  // If variant is explicitly negative with showSign and amount is positive, treat as negative for display
  const signedAmount =
    variant === 'negative' && showSign && amount > 0
      ? -amount
      : variant === 'positive' && showSign && amount < 0
      ? Math.abs(amount)
      : amount;

  // Prevent fractional paise flicker during counting animation for whole-rupee amounts
  const resolvedShowPaise =
    showPaise !== undefined
      ? showPaise
      : Math.abs(amount) % 100 !== 0;

  const { formattedText } = useCountingAnimation(signedAmount, {
    enabled: animated,
    duration,
    triggerOnFocus,
    isMasked,
    formatOptions: {
      showSign,
      showPaise: resolvedShowPaise,
    },
  });

  const displayText = animated
    ? formattedText
    : isMasked
    ? formatRupeeMasked(signedAmount, { showSign })
    : formatRupee(signedAmount, { showSign, showPaise: resolvedShowPaise });

  return (
    <Text
      style={[
        styles.base,
        {
          color: textColor,
          fontSize,
          lineHeight,
          fontFamily:
            size === 'hero'
              ? typography.fontFamilies.extrabold
              : typography.fontFamilies.bold,
        },
        style,
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit={size === 'hero'}
    >
      {displayText}
    </Text>
  );
};

const styles = StyleSheet.create({
  base: {
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
});
