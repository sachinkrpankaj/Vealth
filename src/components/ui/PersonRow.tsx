import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { PersonDebtSummary } from '../../domain/finance/types';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { AmountText } from './AmountText';
import { useTheme } from '../../theme';

interface PersonRowProps {
  debtSummary: PersonDebtSummary;
  onPress?: () => void;
  style?: ViewStyle;
}

export const PersonRow: React.FC<PersonRowProps> = ({
  debtSummary,
  onPress,
  style,
}) => {
  const { colors, typography } = useTheme();
  const { person, netBalance, owedToYou, youOwe, dueStatus, dueDate } = debtSummary;

  let relationshipLabel = 'Settled';
  let amountToShow = 0;
  let variant: 'positive' | 'negative' | 'muted' = 'muted';

  if (owedToYou > 0 && youOwe > 0) {
    if (netBalance > 0) {
      relationshipLabel = `Net: owes you`;
      amountToShow = netBalance;
      variant = 'positive';
    } else if (netBalance < 0) {
      relationshipLabel = `Net: you owe`;
      amountToShow = Math.abs(netBalance);
      variant = 'negative';
    } else {
      relationshipLabel = 'Balances offset (₹0)';
      amountToShow = 0;
      variant = 'muted';
    }
  } else if (owedToYou > 0) {
    relationshipLabel = 'Owes you';
    amountToShow = owedToYou;
    variant = 'positive';
  } else if (youOwe > 0) {
    relationshipLabel = 'You owe';
    amountToShow = youOwe;
    variant = 'negative';
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Avatar
        name={person.name}
        color={person.avatarColor}
        size="md"
        style={{ marginRight: 14 }}
      />

      <View style={styles.details}>
        <View style={styles.nameRow}>
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
            {person.name}
          </Text>
          {dueStatus !== 'NO_DUE_DATE' && dueStatus !== 'SETTLED' ? (
            <Badge dueStatus={dueStatus} style={styles.badge} />
          ) : null}
        </View>

        <Text
          style={[
            styles.subtitle,
            {
              color: colors.textSecondary,
              fontSize: typography.fontSizes.caption,
            },
          ]}
        >
          {relationshipLabel}
          {dueDate ? ` • Due ${dueDate}` : ''}
        </Text>
      </View>

      <View style={styles.rightSection}>
        <View style={styles.amountContainer}>
          {amountToShow > 0 ? (
            <AmountText
              amount={amountToShow}
              size="bodyLg"
              variant={variant}
              showSign={false}
            />
          ) : (
            <Text style={[styles.settledText, { color: colors.textMuted }]}>₹0</Text>
          )}
        </View>
        <ChevronRight size={16} color={colors.textMuted} style={styles.chevron} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  details: {
    flex: 1,
    marginRight: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  name: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginRight: 6,
  },
  badge: {
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  chevron: {
    marginLeft: 6,
  },
  settledText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});
