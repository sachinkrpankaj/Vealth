import React from 'react';
import { Text, StyleSheet, ActivityIndicator, View, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../theme';
import { LiquidGlassCard } from './LiquidGlassCard';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  variant?: 'primary' | 'positive' | 'negative';
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title, onPress, disabled = false, loading = false, style, textStyle, icon,
  variant = 'primary',
}) => {
  const { radii, spacing, typography } = useTheme();
  const textColor = '#FFFFFF';
  return (
    <LiquidGlassCard
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      tone={variant === 'primary' ? 'emphasized' : variant}
      radius={radii.md}
      padding={0}
      style={style}
      contentStyle={[styles.button, { paddingVertical: spacing.md - 2, paddingHorizontal: spacing.lg }]}
    >
      {loading ? <ActivityIndicator size="small" color={textColor} /> : (
        <>
          {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
          <Text style={[styles.text, { color: textColor, fontSize: typography.fontSizes.body }, textStyle]}>{title}</Text>
        </>
      )}
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  iconContainer: { marginRight: 8 },
  text: { fontFamily: 'PlusJakartaSans_600SemiBold', textAlign: 'center' },
});
