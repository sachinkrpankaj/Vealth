import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  HandCoins,
  Receipt,
  ShoppingBag,
  TrendingUp,
  CircleDollarSign,
  Briefcase,
} from 'lucide-react-native';
import { Transaction, TransactionType } from '../../domain/finance/types';
import { AmountText, AmountVariant } from './AmountText';
import { useTheme } from '../../theme';

interface TransactionRowProps {
  transaction: Transaction;
  accountName?: string;
  destAccountName?: string;
  personName?: string;
  categoryName?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

function getTxDisplayMeta(tx: Transaction, personName?: string, categoryName?: string) {
  let title = tx.note || '';
  let iconComponent = CircleDollarSign;
  let variant: AmountVariant = 'default';
  let showSign = false;

  switch (tx.type) {
    case 'INCOME':
      title = title || categoryName || 'Income';
      iconComponent = ArrowDownLeft;
      variant = 'positive';
      showSign = true;
      break;

    case 'EXPENSE':
      title = title || categoryName || 'Expense';
      iconComponent = ArrowUpRight;
      variant = 'negative';
      showSign = true;
      break;

    case 'LEND':
      title = personName ? `Lent to ${personName}` : 'Lent Money';
      iconComponent = HandCoins;
      variant = 'negative';
      showSign = true;
      break;

    case 'BORROW':
      title = personName ? `Borrowed from ${personName}` : 'Borrowed Money';
      iconComponent = HandCoins;
      variant = 'positive';
      showSign = true;
      break;

    case 'REPAYMENT_RECEIVED':
      title = personName ? `${personName} repaid you` : 'Repayment Received';
      iconComponent = ArrowDownLeft;
      variant = 'positive';
      showSign = true;
      break;

    case 'REPAYMENT_MADE':
      title = personName ? `Paid ${personName}` : 'Repayment Made';
      iconComponent = ArrowUpRight;
      variant = 'negative';
      showSign = true;
      break;

    case 'TRANSFER':
      title = title || 'Account Transfer';
      iconComponent = ArrowRightLeft;
      variant = 'muted';
      showSign = false;
      break;

    case 'ASSET_PURCHASE':
      title = title || 'Asset Purchase';
      iconComponent = ShoppingBag;
      variant = 'negative';
      showSign = true;
      break;

    case 'ASSET_SALE':
      title = title || 'Asset Sale';
      iconComponent = TrendingUp;
      variant = 'positive';
      showSign = true;
      break;

    default:
      title = title || 'Transaction';
      iconComponent = Receipt;
      variant = 'default';
  }

  return { title, iconComponent, variant, showSign };
}

export const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  accountName,
  destAccountName,
  personName,
  categoryName,
  onPress,
  style,
}) => {
  const { colors, radii, spacing, typography } = useTheme();
  const { title, iconComponent: Icon, variant, showSign } = getTxDisplayMeta(
    transaction,
    personName,
    categoryName
  );

  let subtitle = '';
  if (transaction.type === 'TRANSFER' && accountName && destAccountName) {
    subtitle = `${accountName} → ${destAccountName}`;
  } else if (accountName) {
    subtitle = accountName;
    if (personName && !title.includes(personName)) {
      subtitle += ` • ${personName}`;
    }
  } else if (personName) {
    subtitle = personName;
  }

  let iconBg = colors.surfaceSubtle;
  let iconColor = colors.textSecondary;
  if (variant === 'positive') {
    iconBg = colors.positiveBg;
    iconColor = colors.positive;
  } else if (variant === 'negative') {
    iconBg = colors.negativeBg;
    iconColor = colors.negative;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          paddingVertical: 12,
          paddingHorizontal: 16,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: iconBg,
            borderRadius: 12,
            marginRight: 12,
          },
        ]}
      >
        <Icon size={18} color={iconColor} strokeWidth={2.2} />
      </View>

      <View style={styles.details}>
        <Text
          style={[
            styles.title,
            {
              color: colors.textPrimary,
              fontSize: typography.fontSizes.body,
            },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.subtitle,
            {
              color: colors.textSecondary,
              fontSize: typography.fontSizes.caption,
            },
          ]}
          numberOfLines={1}
        >
          {subtitle || transaction.date}
        </Text>
      </View>

      <View style={styles.amountContainer}>
        <AmountText
          amount={transaction.amount}
          size="bodyLg"
          variant={variant}
          showSign={showSign}
        />
        <Text style={[styles.date, { color: colors.textMuted }]}>{transaction.date}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  date: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    marginTop: 2,
  },
});
