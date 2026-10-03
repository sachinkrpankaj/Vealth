/**
 * Card — Vaelth UI primitive
 *
 * All legacy variants resolve to the shared prismatic glass surface.
 * Existing variant props are preserved for caller compatibility.
 */
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { LiquidGlassCard } from './LiquidGlassCard';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  variant?: 'glass' | 'solid' | 'subtle';
  onPress?: () => void;
  border?: boolean;
  radius?: number;
  padding?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  elevated = false,
  variant = 'glass',
  onPress,
  border = true,
  radius,
  padding,
}) => {
  const { colors, radii, spacing } = useTheme();

  const variantStyle: ViewStyle = {};
  let showPrism = border;

  if (variant === 'solid') {
    variantStyle.backgroundColor = elevated ? colors.surfaceElevated : colors.surface;
    showPrism = false;
  } else if (variant === 'subtle') {
    variantStyle.backgroundColor = colors.surfaceSubtle;
    showPrism = false;
  } else {
    // 'glass'
    if (elevated) {
      variantStyle.backgroundColor = colors.surfaceElevated;
    }
  }

  return (
    <LiquidGlassCard
      style={[variantStyle, style]}
      radius={radius ?? radii.lg}
      padding={padding ?? spacing.md}
      showPrism={showPrism}
      onPress={onPress}
    >
      {children}
    </LiquidGlassCard>
  );
};

