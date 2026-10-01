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
  const { radii, spacing } = useTheme();

  return (
    <LiquidGlassCard
      style={style}
      radius={radius ?? radii.lg}
      padding={padding ?? spacing.md}
      showPrism={border}
      onPress={onPress}
    >
      {children}
    </LiquidGlassCard>
  );
};

