import React from 'react';
import { View, TextInput, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { LiquidGlassCard } from './LiquidGlassCard';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  style?: ViewStyle;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search...',
  onClear,
  style,
}) => {
  const { colors, radii, isDark } = useTheme();
  const borderRadius = radii.md;

  return (
    <LiquidGlassCard
      style={style}
      contentStyle={styles.inner}
      radius={borderRadius}
      padding={0}
      showPrism
    >
      <Search size={18} color={colors.textMuted} style={styles.icon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.textPrimary }]}
      />
      {value ? (
        <Pressable
          onPress={() => {
            onChangeText('');
            onClear?.();
          }}
          hitSlop={8}
        >
          <X size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  shadow: {
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    paddingVertical: 8,
  },
});
