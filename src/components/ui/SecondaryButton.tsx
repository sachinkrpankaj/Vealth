import React from 'react';
import { Text, StyleSheet, ActivityIndicator, View, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { useTheme } from '../../theme';
import { LiquidGlassCard } from './LiquidGlassCard';

interface SecondaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  title, onPress, disabled = false, loading = false, style, textStyle, icon,
}) => {
  const { colors, radii, spacing, typography } = useTheme();
  return (
    <LiquidGlassCard
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      radius={radii.md}
      padding={0}
      style={style}
      contentStyle={[styles.button, { paddingVertical: spacing.md - 2, paddingHorizontal: spacing.lg }]}
    >
      {loading ? <ActivityIndicator size="small" color={colors.textPrimary} /> : (
        <>
          {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
          <Text style={[styles.text, { color: colors.textPrimary, fontSize: typography.fontSizes.body }, textStyle]}>{title}</Text>
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
