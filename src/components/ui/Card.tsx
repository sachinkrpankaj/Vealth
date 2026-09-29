/**
 * Card — Vaelth UI primitive
 *
 * variant="glass"  → Authentic liquid glass (BlurView + prismatic SVG border)
 * variant="solid"  → Opaque elevated surface
 * variant="subtle" → Flat subtle surface
 */
import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Pressable } from 'react-native';
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

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.87,
    transform: [{ scale: 0.985 }],
  },
});
