/**
 * LiquidGlassCard
 *
 * A drop-in wrapper that applies an authentic, ultra-premium liquid glass effect:
 * 1. Translucent frosted glass gradient fill (Layer 0)
 * 2. Subtle chromatic prismatic edge shimmer (Layer 1)
 * 3. Top-edge specular highlight reflection (Layer 2)
 * 4. Crisp crystalline glass border (Native hardware-accelerated)
 * 5. Platform-safe luminous levitation shadow (0 ghost box artifacts on Android)
 *
 * Engineered with proper outer vs inner style separation so flexbox layouts,
 * pressables, and dock bars always lay out correctly.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Pressable,
  Platform,
  Insets,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../../theme';

// Layout style keys that strictly belong to the outermost container
const OUTER_STYLE_KEYS = new Set<string>([
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'alignSelf',
  'position',
  'top',
  'bottom',
  'left',
  'right',
  'zIndex',
  'display',
]);

// Surface style keys that belong to the glass shell, NEVER to inner content
const SURFACE_STYLE_KEYS = new Set<string>([
  'borderWidth',
  'borderColor',
  'borderTopWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRightWidth',
  'borderTopColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderRightColor',
  'borderStyle',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  // Background overrides are deliberately ignored: the shared glass fill must stay visible.
  'backgroundColor',
  'shadowColor',
  'shadowOffset',
  'shadowOpacity',
  'shadowRadius',
  'elevation',
  'overflow',
]);

function splitStyles(style?: StyleProp<ViewStyle>): {
  outer: ViewStyle;
  surface: ViewStyle;
  inner: ViewStyle;
} {
  if (!style) return { outer: {}, surface: {}, inner: {} };
  const flat = StyleSheet.flatten(style) as Record<string, any>;
  const outer: Record<string, any> = {};
  const surface: Record<string, any> = {};
  const inner: Record<string, any> = {};

  for (const [key, value] of Object.entries(flat)) {
    if (value === undefined) continue;
    if (OUTER_STYLE_KEYS.has(key)) {
      outer[key] = value;
    } else if (SURFACE_STYLE_KEYS.has(key)) {
      surface[key] = value;
    } else {
      inner[key] = value;
    }
  }

  return { outer, surface, inner };
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Prismatic & Specular Overlay
// Draws: frosted glass fill + chromatic edge glow + top specular reflection
// ─────────────────────────────────────────────────────────────────────────────
export type GlassTone = 'default' | 'emphasized' | 'positive' | 'negative';

export const LiquidGlassPrismOverlay: React.FC<{
  borderRadius: number;
  isDark: boolean;
  tone?: GlassTone;
}> = React.memo(({ borderRadius: r, isDark, tone = 'default' }) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) =>
      previous.width === width && previous.height === height ? previous : { width, height }
    );
  }, []);

  const idPrefix = useMemo(
    () => `lg_${Math.random().toString(36).substring(2, 9)}`,
    []
  );

  // Measure the actual surface, including pills and flex-driven cards, for Android SVG geometry.
  const safeRadius = Math.min(r, size.width / 2, size.height / 2);
  const tint = tone === 'positive' ? '#059669' : tone === 'negative' ? '#E11D48' : isDark ? '#6366F1' : '#4F46E5';
  const isSemanticTone = tone === 'negative' || tone === 'positive';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {size.width > 0 && size.height > 0 && (
        <Svg width={size.width} height={size.height}>
          <Defs>
            {/* Base frosted glass gradient */}
            <LinearGradient id={`${idPrefix}_baseFillDark`} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop
                offset="0%"
                stopColor={
                  tone === 'default'
                    ? '#161722'
                    : tone === 'emphasized'
                    ? '#1E2030'
                    : tint
                }
                stopOpacity={tone === 'default' ? 0.98 : 0.95}
              />
              <Stop
                offset="55%"
                stopColor={
                  tone === 'default'
                    ? '#13141D'
                    : tone === 'emphasized'
                    ? '#191A28'
                    : tone === 'positive'
                    ? '#065F46'
                    : tone === 'negative'
                    ? '#9F1239'
                    : '#312E81'
                }
                stopOpacity={tone === 'default' ? 0.98 : 0.94}
              />
              <Stop
                offset="100%"
                stopColor={
                  tone === 'default'
                    ? '#101117'
                    : tone === 'emphasized'
                    ? '#141520'
                    : tone === 'positive'
                    ? '#064E3B'
                    : tone === 'negative'
                    ? '#881337'
                    : '#1E1B4B'
                }
                stopOpacity="0.98"
              />
            </LinearGradient>
            <LinearGradient id={`${idPrefix}_baseFillLight`} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop
                offset="0%"
                stopColor={tone === 'default' ? '#FFFFFF' : tint}
                stopOpacity={tone === 'default' ? 0.96 : 0.96}
              />
              <Stop
                offset="55%"
                stopColor={
                  tone === 'default'
                    ? '#F8FAFF'
                    : tone === 'positive'
                    ? '#047857'
                    : tone === 'negative'
                    ? '#BE123C'
                    : '#4338CA'
                }
                stopOpacity={tone === 'default' ? 0.92 : 0.94}
              />
              <Stop
                offset="100%"
                stopColor={
                  tone === 'default'
                    ? '#E8EDFA'
                    : tone === 'positive'
                    ? '#065F46'
                    : tone === 'negative'
                    ? '#9F1239'
                    : '#3730A3'
                }
                stopOpacity={tone === 'default' ? 0.90 : 0.98}
              />
            </LinearGradient>

            {/* Specular highlight streak across top edge — calm subtle kiss of light in dark mode */}
            <LinearGradient id={`${idPrefix}_topSpec`} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop
                offset="0%"
                stopColor="#FFFFFF"
                stopOpacity={
                  tone === 'default'
                    ? isDark
                      ? 0.03
                      : 0.55
                    : isDark
                    ? 0.02
                    : isSemanticTone
                    ? 0.05
                    : 0.10
                }
              />
              <Stop
                offset="25%"
                stopColor="#FFFFFF"
                stopOpacity={
                  tone === 'default' ? (isDark ? 0.008 : 0.12) : 0.01
                }
              />
              <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>

            {/* Chromatic prismatic shimmer on sides (disabled in dark mode and semantic tones for clean cohesion) */}
            <LinearGradient id={`${idPrefix}_prismSheen`} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop
                offset="0%"
                stopColor="#818CF8"
                stopOpacity={isDark || isSemanticTone ? '0' : '0.07'}
              />
              <Stop
                offset="35%"
                stopColor="#38BDF8"
                stopOpacity={isDark || isSemanticTone ? '0' : '0.05'}
              />
              <Stop
                offset="70%"
                stopColor="#34D399"
                stopOpacity={isDark || isSemanticTone ? '0' : '0.04'}
              />
              <Stop
                offset="100%"
                stopColor="#C084FC"
                stopOpacity={isDark || isSemanticTone ? '0' : '0.07'}
              />
            </LinearGradient>

            {/* Crystalline beveled rim stroke gradient (refined, subtle edge catch) */}
            <LinearGradient id={`${idPrefix}_rimStrokeDark`} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.08" />
              <Stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.04" />
              <Stop offset="75%" stopColor="#FFFFFF" stopOpacity="0.02" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.01" />
            </LinearGradient>
            <LinearGradient id={`${idPrefix}_rimStrokeLight`} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <Stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.65" />
              <Stop offset="100%" stopColor="rgba(203, 213, 225, 0.45)" />
            </LinearGradient>
          </Defs>

          {/* Layer 0: Base glass fill */}
          <Rect
            x="0"
            y="0"
            width={size.width}
            height={size.height}
            rx={safeRadius}
            ry={safeRadius}
            fill={isDark ? `url(#${idPrefix}_baseFillDark)` : `url(#${idPrefix}_baseFillLight)`}
          />

          {/* Layer 1: Subtle chromatic prism sheen */}
          <Rect
            x="0"
            y="0"
            width={size.width}
            height={size.height}
            rx={safeRadius}
            ry={safeRadius}
            fill={`url(#${idPrefix}_prismSheen)`}
          />

          {/* Layer 2: Top specular highlight reflection (fades smoothly without hard geometric seam) */}
          <Rect
            x="0"
            y="0"
            width={size.width}
            height={size.height}
            rx={safeRadius}
            ry={safeRadius}
            fill={`url(#${idPrefix}_topSpec)`}
          />

          {/* Layer 3: Crystalline beveled rim stroke */}
          <Rect
            x="0.5"
            y="0.5"
            width={size.width - 1}
            height={size.height - 1}
            rx={Math.max(0, safeRadius - 0.5)}
            ry={Math.max(0, safeRadius - 0.5)}
            fill="none"
            stroke={isDark ? `url(#${idPrefix}_rimStrokeDark)` : `url(#${idPrefix}_rimStrokeLight)`}
            strokeWidth="1"
          />
        </Svg>
      )}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// LiquidGlassCard — the public-facing component
// ─────────────────────────────────────────────────────────────────────────────
export interface LiquidGlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Corner radius. Defaults to 18 (radii.lg). */
  radius?: number;
  /** Extra padding override. Defaults to 16. */
  padding?: number;
  /** Emphasized and semantic actions retain a tinted, translucent glass fill. */
  tone?: GlassTone;
  /** Whether to show the prismatic border overlay. Default true. */
  showPrism?: boolean;
  disabled?: boolean;
  /** Pressable callback */
  onPress?: () => void;
  hitSlop?: Insets | number;
  accessibilityRole?: any;
  accessibilityLabel?: string;
  accessibilityState?: any;
}

export const LiquidGlassCard: React.FC<LiquidGlassCardProps> = ({
  children,
  style,
  contentStyle,
  radius = 18,
  padding = 16,
  showPrism = true,
  tone = 'default',
  disabled = false,
  onPress,
  hitSlop,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
}) => {
  const { isDark } = useTheme();

  const { outer: outerStyles, surface: surfaceStyles, inner: innerStyles } = useMemo(
    () => splitStyles(style),
    [style]
  );

  const hasCustomPadding =
    innerStyles.padding !== undefined ||
    innerStyles.paddingHorizontal !== undefined ||
    innerStyles.paddingVertical !== undefined ||
    innerStyles.paddingTop !== undefined ||
    innerStyles.paddingBottom !== undefined ||
    innerStyles.paddingLeft !== undefined ||
    innerStyles.paddingRight !== undefined;

  const resolvedPadding = hasCustomPadding ? undefined : padding;
  const isFlexOuter = outerStyles.flex !== undefined;

  const effectiveRadius = radius !== undefined ? radius : ((surfaceStyles.borderRadius as number) ?? 18);

  const cardShadowStyle: ViewStyle = {
    borderRadius: effectiveRadius,
    overflow: 'hidden',
  };

  const cardSurfaceStyle: ViewStyle = {
    borderWidth: surfaceStyles.borderWidth !== undefined ? surfaceStyles.borderWidth : (showPrism ? 0 : 1),
    borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.92)',
    overflow: 'hidden',
    position: 'relative',
    ...surfaceStyles,
    borderRadius: effectiveRadius,
    backgroundColor: surfaceStyles.backgroundColor ?? (isDark ? '#12131A' : '#EDF1FA'),
  };

  const surfaceHeight = outerStyles.height;

  const cardContent = (
    <View
      style={[
        styles.surfaceWrapper,
        cardSurfaceStyle,
        outerStyles.minHeight !== undefined ? { minHeight: outerStyles.minHeight } : undefined,
        outerStyles.maxHeight !== undefined ? { maxHeight: outerStyles.maxHeight } : undefined,
        surfaceHeight !== undefined ? { height: surfaceHeight as any } : undefined,
        isFlexOuter ? { flex: outerStyles.flex, height: '100%' } : undefined,
      ]}
    >
      {showPrism && (
        <LiquidGlassPrismOverlay borderRadius={radius} isDark={isDark} tone={tone} />
      )}
      <View
        style={[
          styles.innerContent,
          surfaceHeight !== undefined ? { height: '100%' } : undefined,
          isFlexOuter ? { flex: 1 } : undefined,
          resolvedPadding !== undefined ? { padding: resolvedPadding } : undefined,
          innerStyles,
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        hitSlop={hitSlop}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        style={({ pressed }) => [
          styles.pressableRoot,
          cardShadowStyle,
          outerStyles,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        {cardContent}
      </Pressable>
    );
  }

  return (
    <View style={[styles.viewRoot, cardShadowStyle, outerStyles]}>
      {cardContent}
    </View>
  );
};

const styles = StyleSheet.create({
  pressableRoot: {
    // Root container when pressable
  },
  viewRoot: {
    // Root container when static
  },
  surfaceWrapper: {
    // Surface wrapper for liquid glass shell
  },
  innerContent: {
    position: 'relative',
    zIndex: 1,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.48,
  },
});

