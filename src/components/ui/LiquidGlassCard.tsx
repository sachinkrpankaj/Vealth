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
import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Pressable,
  Platform,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import { useTheme } from '../../theme';

// Layout style keys that strictly belong to the outermost container
const OUTER_STYLE_KEYS = new Set([
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
const SURFACE_STYLE_KEYS = new Set([
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
export const LiquidGlassPrismOverlay: React.FC<{
  borderRadius: number;
  isDark: boolean;
}> = React.memo(({ borderRadius: r, isDark }) => {
  // Clamp radius for SVG primitives to prevent extreme aspect-ratio distortion on pills
  const safeRadius = Math.min(r, 36);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}
      >
      <Defs>
        {/* Base frosted glass gradient */}
        <LinearGradient id="lgBaseFillDark" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#1E2235" stopOpacity="0.65" />
          <Stop offset="50%" stopColor="#131622" stopOpacity="0.58" />
          <Stop offset="100%" stopColor="#0B0D15" stopOpacity="0.72" />
        </LinearGradient>
        <LinearGradient id="lgBaseFillLight" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.94" />
          <Stop offset="50%" stopColor="#F8FAFF" stopOpacity="0.86" />
          <Stop offset="100%" stopColor="#EFF3FB" stopOpacity="0.80" />
        </LinearGradient>

        {/* Specular highlight streak across top edge — full card coverage with smooth gradient fade */}
        <LinearGradient id="lgTopSpec" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={isDark ? "0.18" : "0.70"} />
          <Stop offset="20%" stopColor="#FFFFFF" stopOpacity={isDark ? "0.05" : "0.18"} />
          <Stop offset="45%" stopColor="#FFFFFF" stopOpacity="0" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>

        {/* Subtle chromatic prismatic shimmer on sides */}
        <LinearGradient id="lgPrismSheen" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#818CF8" stopOpacity={isDark ? "0.07" : "0.07"} />
          <Stop offset="35%" stopColor="#38BDF8" stopOpacity={isDark ? "0.05" : "0.05"} />
          <Stop offset="70%" stopColor="#34D399" stopOpacity={isDark ? "0.04" : "0.04"} />
          <Stop offset="100%" stopColor="#C084FC" stopOpacity={isDark ? "0.07" : "0.07"} />
        </LinearGradient>

        {/* Crystalline beveled rim stroke gradient (top edge light catch) */}
        <LinearGradient id="lgRimStrokeDark" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.28" />
          <Stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.10" />
          <Stop offset="75%" stopColor="#FFFFFF" stopOpacity="0.04" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.02" />
        </LinearGradient>
        <LinearGradient id="lgRimStrokeLight" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <Stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.65" />
          <Stop offset="100%" stopColor="rgba(203, 213, 225, 0.45)" />
        </LinearGradient>
      </Defs>

      {/* Layer 0: Base glass fill */}
      <Rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        rx={safeRadius}
        ry={safeRadius}
        fill={isDark ? "url(#lgBaseFillDark)" : "url(#lgBaseFillLight)"}
      />

      {/* Layer 1: Subtle chromatic prism sheen */}
      <Rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        rx={safeRadius}
        ry={safeRadius}
        fill="url(#lgPrismSheen)"
      />

      {/* Layer 2: Top specular highlight reflection (fades smoothly without hard geometric seam) */}
      <Rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        rx={safeRadius}
        ry={safeRadius}
        fill="url(#lgTopSpec)"
      />

      {/* Layer 3: Crystalline beveled rim stroke */}
      <Rect
        x="0.5"
        y="0.5"
        width="99.5%"
        height="99.5%"
        rx={safeRadius}
        ry={safeRadius}
        fill="none"
        stroke={isDark ? "url(#lgRimStrokeDark)" : "url(#lgRimStrokeLight)"}
        strokeWidth="1"
      />
    </Svg>
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
  /** Whether to show the prismatic border overlay. Default true. */
  showPrism?: boolean;
  /** Pressable callback */
  onPress?: () => void;
}

export const LiquidGlassCard: React.FC<LiquidGlassCardProps> = ({
  children,
  style,
  contentStyle,
  radius = 18,
  padding = 16,
  showPrism = true,
  onPress,
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

  const cardSurfaceStyle: ViewStyle = {
    borderRadius: radius,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.82)',
    backgroundColor: isDark ? 'rgba(11, 13, 20, 0.42)' : 'rgba(255, 255, 255, 0.74)',
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: isDark ? '#000000' : '#312E81',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.35 : 0.07,
        shadowRadius: 10,
      },
      android: {
        elevation: isDark ? 2 : 1,
      },
    }),
    ...surfaceStyles,
  };

  const surfaceHeight = outerStyles.height;

  const cardContent = (
    <View
      style={[
        styles.surfaceWrapper,
        cardSurfaceStyle,
        surfaceHeight !== undefined ? { height: surfaceHeight as any } : undefined,
        isFlexOuter ? { flex: outerStyles.flex, height: '100%' } : undefined,
      ]}
    >
      {showPrism && (
        <LiquidGlassPrismOverlay borderRadius={radius} isDark={isDark} />
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
        style={({ pressed }) => [
          styles.pressableRoot,
          outerStyles,
          pressed && styles.pressed,
        ]}
      >
        {cardContent}
      </Pressable>
    );
  }

  return (
    <View style={[styles.viewRoot, outerStyles]}>
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
    width: '100%',
  },
  innerContent: {
    position: 'relative',
    zIndex: 1,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});

