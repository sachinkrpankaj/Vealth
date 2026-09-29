import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Card } from './Card';
import { AmountText, AmountVariant } from './AmountText';
import { useTheme } from '../../theme';

interface StatCardProps {
  title: string;
  amount: number; // minor units
  subtitle?: string;
  variant?: AmountVariant;
  icon?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  amount,
  subtitle,
  variant = 'default',
  icon,
  onPress,
  style,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <Card onPress={onPress} style={style}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
      </View>

      <AmountText amount={amount} size="headingMd" variant={variant} style={styles.amount} />

      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  icon: {
    marginLeft: 6,
  },
  amount: {
    marginVertical: 2,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    marginTop: 4,
  },
});
