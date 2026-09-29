import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { parseRupeeToMinor } from '../../domain/finance/currency';

interface AmountInputProps {
  value: number; // minor units (paise)
  onChangeAmount: (paise: number) => void;
  label?: string;
  error?: string;
  style?: ViewStyle;
  placeholder?: string;
  autoFocus?: boolean;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChangeAmount,
  label = 'Amount',
  error,
  style,
  placeholder = '0',
  autoFocus = false,
}) => {
  const { colors, radii, typography, spacing } = useTheme();

  // Local text input state (in rupees, e.g. "500" or "1000.50")
  const [text, setText] = useState<string>(() => {
    if (!value || value === 0) return '';
    return (value / 100).toString();
  });

  useEffect(() => {
    if (value === 0 && text === '') return;
    const currentPaise = parseRupeeToMinor(text);
    if (currentPaise !== value) {
      setText(value > 0 ? (value / 100).toString() : '');
    }
  }, [value]);

  const handleChangeText = (newText: string) => {
    // Only allow numbers and at most one dot with up to 2 decimal places
    const cleaned = newText.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return; // ignore multiple dots
    if (parts[1] && parts[1].length > 2) return; // max 2 decimal places (paise)

    setText(cleaned);
    const paise = parseRupeeToMinor(cleaned);
    onChangeAmount(paise);
  };

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.negative : colors.border,
            borderRadius: radii.lg,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <Text
          style={[
            styles.currencySymbol,
            {
              color: text ? colors.textPrimary : colors.textMuted,
              fontSize: typography.fontSizes.headingLg,
            },
          ]}
        >
          ₹
        </Text>
        <TextInput
          value={text}
          onChangeText={handleChangeText}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoFocus={autoFocus}
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              fontSize: typography.fontSizes.headingLg,
            },
          ]}
        />
      </View>

      {error ? (
        <Text style={[styles.error, { color: colors.negative }]}>{error}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  currencySymbol: {
    fontWeight: '700',
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontWeight: '700',
    paddingVertical: 4,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
});
