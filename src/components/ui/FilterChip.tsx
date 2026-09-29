import React from 'react';
import { Text, StyleSheet, ViewStyle, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  selected,
  onPress,
  style,
}) => {
  const { colors, typography, isDark } = useTheme();

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? [
              styles.selectedChip,
              {
                backgroundColor: isDark ? '#FFFFFF' : '#13131B',
                borderColor: isDark ? '#FFFFFF' : '#13131B',
              },
            ]
          : [
              styles.unselectedChip,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.07)'
                  : 'rgba(255, 255, 255, 0.75)',
                borderColor: isDark
                  ? 'rgba(255, 255, 255, 0.12)'
                  : 'rgba(255, 255, 255, 0.85)',
              },
            ],
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: selected
              ? isDark
                ? '#090A0E'
                : '#FFFFFF'
              : colors.textSecondary,
            fontFamily: selected
              ? typography.fontFamilies.bold
              : typography.fontFamilies.medium,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    marginRight: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedChip: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 2,
  },
  unselectedChip: {
    // Subtle frosted glass pill
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  text: {
    fontSize: 13,
    letterSpacing: -0.2,
  },
});
