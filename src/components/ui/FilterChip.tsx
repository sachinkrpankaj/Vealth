import React from 'react';
import {
  Text,
  StyleSheet,
  Pressable,
  StyleProp,
  ViewStyle,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';

export interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  variant?: 'default' | 'destructive';
  size?: 'sm' | 'md';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  selected = false,
  onPress,
  icon,
  variant = 'default',
  size = 'md',
  disabled = false,
  style,
  testID,
}) => {
  const { colors, typography, radii, isDark } = useTheme();

  const isDestructive = variant === 'destructive';
  const isSm = size === 'sm';

  const handlePress = () => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  let backgroundColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
  let borderColor = isDark ? colors.border : 'rgba(0, 0, 0, 0.08)';
  let textColor = colors.textSecondary;

  if (isDestructive) {
    backgroundColor = colors.negativeBg;
    borderColor = isDark ? 'rgba(244, 63, 94, 0.28)' : 'rgba(225, 29, 72, 0.22)';
    textColor = colors.negative;
  } else if (selected) {
    backgroundColor = colors.accent;
    borderColor = colors.accent;
    textColor = '#FFFFFF';
  }

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.base,
        isSm ? styles.sizeSm : styles.sizeMd,
        {
          backgroundColor,
          borderColor,
          borderRadius: radii.full,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed && !disabled ? 0.96 : 1 }],
        },
        style,
      ]}
    >
      {icon ? <View style={[styles.iconWrap, { marginRight: isSm ? 4 : 6 }]}>{icon}</View> : null}
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize: isSm ? 12 : 13,
            fontFamily: selected
              ? typography.fontFamilies.bold
              : typography.fontFamilies.medium,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sizeSm: {
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  sizeMd: {
    minHeight: 38,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    letterSpacing: -0.1,
  },
});
