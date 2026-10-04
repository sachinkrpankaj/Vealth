import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { Landmark, Wallet, CreditCard, PiggyBank, CircleDot } from 'lucide-react-native';
import { Account, AccountType } from '../../domain/finance/types';
import { AmountText } from './AmountText';
import { useTheme } from '../../theme';

interface AccountRowProps {
  account: Account;
  balance: number; // minor units (paise)
  onPress?: () => void;
  style?: ViewStyle;
}

function getAccountIcon(type: AccountType) {
  switch (type) {
    case 'BANK':
      return Landmark;
    case 'CASH':
      return Wallet;
    case 'CREDIT_CARD':
      return CreditCard;
    case 'INVESTMENT':
      return PiggyBank;
    case 'OTHER':
    default:
      return CircleDot;
  }
}

export const AccountRow: React.FC<AccountRowProps> = ({
  account,
  balance,
  onPress,
  style,
}) => {
  const { colors, radii, spacing, typography } = useTheme();
  const Icon = getAccountIcon(account.type);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          paddingVertical: spacing.sm,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: account.color ? `${account.color}20` : colors.surfaceSubtle,
            borderRadius: radii.sm,
            marginRight: spacing.md,
          },
        ]}
      >
        <Icon size={20} color={account.color || colors.textPrimary} />
      </View>

      <View style={styles.details}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            style={[
              styles.name,
              {
                color: colors.textPrimary,
                fontSize: typography.fontSizes.body,
              },
            ]}
            numberOfLines={1}
          >
            {account.name}
          </Text>
          {account.isArchived && (
            <View
              style={{
                backgroundColor: colors.surfaceSubtle,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: radii.xs,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700' }}>
                ARCHIVED
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[
            styles.type,
            {
              color: colors.textMuted,
              fontSize: typography.fontSizes.caption,
            },
          ]}
        >
          {account.type === 'CREDIT_CARD'
            ? `Credit Card • ₹${((account.creditLimit ?? 0) / 100).toLocaleString('en-IN')} limit`
            : account.type.replace('_', ' ')}
        </Text>
      </View>

      <View style={styles.balanceContainer}>
        {account.type === 'CREDIT_CARD' ? (
          <View style={{ alignItems: 'flex-end' }}>
            <AmountText
              amount={Math.max(0, (account.creditLimit ?? 0) - Math.max(0, -balance))}
              size="bodyLg"
              variant="default"
            />
            <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 1 }}>
              Remaining
            </Text>
          </View>
        ) : (
          <AmountText
            amount={balance}
            size="bodyLg"
            variant={balance < 0 ? 'negative' : 'default'}
          />
        )}
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
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginBottom: 2,
  },
  type: {
    fontFamily: 'PlusJakartaSans_500Medium',
    textTransform: 'capitalize',
  },
  balanceContainer: {
    alignItems: 'flex-end',
  },
});
