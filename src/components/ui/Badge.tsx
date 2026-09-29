import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { DueDateStatus, TransactionType } from '../../domain/finance/types';

interface BadgeProps {
  label?: string;
  dueStatus?: DueDateStatus;
  txType?: TransactionType;
  variant?: 'positive' | 'negative' | 'warning' | 'accent' | 'muted';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  dueStatus,
  txType,
  variant,
  style,
}) => {
  const { colors, radii } = useTheme();

  let resolvedLabel = label ?? '';
  let bgColor = colors.surfaceSubtle;
  let textColor = colors.textSecondary;

  if (dueStatus) {
    switch (dueStatus) {
      case 'OVERDUE':
        resolvedLabel = 'Overdue';
        bgColor = colors.negativeBg;
        textColor = colors.negative;
        break;
      case 'DUE_TODAY':
        resolvedLabel = 'Due today';
        bgColor = colors.warningBg;
        textColor = colors.warning;
        break;
      case 'DUE_SOON':
        resolvedLabel = 'Due soon';
        bgColor = colors.warningBg;
        textColor = colors.warning;
        break;
      case 'SETTLED':
        resolvedLabel = 'Settled';
        bgColor = colors.positiveBg;
        textColor = colors.positive;
        break;
      case 'NO_DUE_DATE':
      default:
        resolvedLabel = 'No due date';
        bgColor = colors.surfaceSubtle;
        textColor = colors.textMuted;
        break;
    }
  } else if (txType) {
    switch (txType) {
      case 'INCOME':
        resolvedLabel = 'Income';
        bgColor = colors.positiveBg;
        textColor = colors.positive;
        break;
      case 'EXPENSE':
        resolvedLabel = 'Expense';
        bgColor = colors.negativeBg;
        textColor = colors.negative;
        break;
      case 'LEND':
        resolvedLabel = 'Lent';
        bgColor = colors.accentBg;
        textColor = colors.accent;
        break;
      case 'BORROW':
        resolvedLabel = 'Borrowed';
        bgColor = colors.warningBg;
        textColor = colors.warning;
        break;
      case 'REPAYMENT_RECEIVED':
        resolvedLabel = 'Repayment Recv';
        bgColor = colors.positiveBg;
        textColor = colors.positive;
        break;
      case 'REPAYMENT_MADE':
        resolvedLabel = 'Repayment Made';
        bgColor = colors.surfaceSubtle;
        textColor = colors.textPrimary;
        break;
      case 'TRANSFER':
        resolvedLabel = 'Transfer';
        bgColor = colors.surfaceSubtle;
        textColor = colors.textSecondary;
        break;
      case 'ASSET_PURCHASE':
        resolvedLabel = 'Asset Buy';
        bgColor = colors.accentBg;
        textColor = colors.accent;
        break;
      case 'ASSET_SALE':
        resolvedLabel = 'Asset Sale';
        bgColor = colors.positiveBg;
        textColor = colors.positive;
        break;
      default:
        resolvedLabel = 'Other';
    }
  } else if (variant) {
    switch (variant) {
      case 'positive':
        bgColor = colors.positiveBg;
        textColor = colors.positive;
        break;
      case 'negative':
        bgColor = colors.negativeBg;
        textColor = colors.negative;
        break;
      case 'warning':
        bgColor = colors.warningBg;
        textColor = colors.warning;
        break;
      case 'accent':
        bgColor = colors.accentBg;
        textColor = colors.accent;
        break;
      case 'muted':
        bgColor = colors.surfaceSubtle;
        textColor = colors.textMuted;
        break;
    }
  }

  return (
    <View style={[styles.badge, { backgroundColor: bgColor, borderRadius: radii.full }, style]}>
      <Text style={[styles.label, { color: textColor }]}>{resolvedLabel}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
