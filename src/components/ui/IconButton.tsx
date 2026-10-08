import React from 'react';
import {
  Pressable,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Insets,
} from 'react-native';
import { useTheme } from '../../theme';

export type IconButtonVariant = 'default' | 'destructive' | 'accent' | 'success';

export interface IconButtonProps {
  onPress: () => void;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  variant?: IconButtonVariant;
  size?: number;
  disabled?: boolean;
  hitSlop?: Insets | number;
  accessibilityLabel: string;
  accessibilityRole?: 'button';
  accessibilityState?: any;
  style?: StyleProp<ViewStyle>;
}

export const IconButton: React.FC<IconButtonProps> = ({
  onPress,
  icon,
  children,
  variant = 'default',
  size = 36,
  disabled = false,
  hitSlop = 8,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  style,
}) => {
  const { isDark } = useTheme();

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'destructive':
        return {
          backgroundColor: isDark ? 'rgba(244, 63, 94, 0.12)' : 'rgba(244, 63, 94, 0.08)',
          borderColor: isDark ? 'rgba(244, 63, 94, 0.25)' : 'rgba(244, 63, 94, 0.22)',
        };
      case 'accent':
        return {
          backgroundColor: isDark ? 'rgba(99, 102, 241, 0.16)' : 'rgba(99, 102, 241, 0.10)',
          borderColor: isDark ? 'rgba(99, 102, 241, 0.32)' : 'rgba(99, 102, 241, 0.25)',
        };
      case 'success':
        return {
          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.10)',
          borderColor: isDark ? 'rgba(16, 185, 129, 0.32)' : 'rgba(16, 185, 129, 0.25)',
        };
      case 'default':
      default:
        return {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)',
        };
    }
  };

  const halfSize = size / 2;
  const variantStyle = getVariantStyles();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState ?? { disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: halfSize,
        },
        variantStyle,
        style,
        styles.cleanSurface,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon ?? children}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.94 }],
  },
  cleanSurface: {
    elevation: 0,
    shadowOpacity: 0,
    boxShadow: undefined,
    filter: undefined,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.4,
  },
});
