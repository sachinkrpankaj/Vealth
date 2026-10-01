import React from 'react';
import { Text, StyleSheet, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { LiquidGlassCard } from './LiquidGlassCard';

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

export const FilterChip: React.FC<FilterChipProps> = ({ label, selected, onPress, style }) => {
  const { colors, typography } = useTheme();
  return (
    <LiquidGlassCard
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      tone={selected ? 'emphasized' : 'default'}
      radius={999}
      padding={0}
      style={[styles.chip, style]}
      contentStyle={styles.content}
    >
      <Text style={[styles.text, {
        color: selected ? '#FFFFFF' : colors.textSecondary,
        fontFamily: selected ? typography.fontFamilies.bold : typography.fontFamilies.medium,
      }]}>{label}</Text>
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  chip: { marginRight: 8 },
  content: { paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 13, letterSpacing: -0.2 },
});
