import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, RadialGradient, Stop, Circle } from 'react-native-svg';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme';

export interface RadialArcGaugeProps {
  percentage: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  color?: string;
  gradientColors?: [string, string];
  trackColor?: string;
  label?: string;
  subtitle?: string;
}

export function RadialArcGauge({
  percentage = 100,
  size = 100,
  strokeWidth = 7.5,
  color,
  gradientColors,
  trackColor,
  label,
  subtitle,
}: RadialArcGaugeProps) {
  const { colors, isDark } = useTheme();
  const safePercentage = (typeof percentage === 'number' && isFinite(percentage) && !isNaN(percentage)) ? percentage : 0;
  const clamped = Math.max(0, Math.min(100, safePercentage));
  const r = (size - strokeWidth * 2 - 2) / 2;
  const cx = size / 2;
  const cy = size / 2 - 2;

  // Symmetrical bottom-opening arc: 240 deg sweep
  // Opens at 6 o'clock (120 deg opening between 8 o'clock and 4 o'clock)
  const startAngle = 240;
  const sweepAngle = 240;

  const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: +(cx + r * Math.cos(angleInRadians)).toFixed(2),
      y: +(cy + r * Math.sin(angleInRadians)).toFixed(2),
    };
  };

  const describeArc = (cx: number, cy: number, r: number, startA: number, sweep: number) => {
    if (sweep <= 0) return '';
    const clampedSweep = Math.min(359.9, sweep);
    const start = polarToCartesian(cx, cy, r, startA);
    const end = polarToCartesian(cx, cy, r, startA + clampedSweep);
    const largeArcFlag = clampedSweep > 180 ? 1 : 0;
    return ['M', start.x, start.y, 'A', r, r, 0, largeArcFlag, 1, end.x, end.y].join(' ');
  };

  const trackPath = describeArc(cx, cy, r, startAngle, sweepAngle);
  const activeSweep = (clamped / 100) * sweepAngle;
  const activePath = clamped > 0 ? describeArc(cx, cy, r, startAngle, activeSweep) : '';

  // Default gradients based on score if not explicitly supplied
  const defaultGradient: [string, string] =
    clamped >= 80
      ? ['#10B981', '#059669']
      : clamped >= 50
      ? ['#F59E0B', '#D97706']
      : ['#EF4444', '#DC2626'];

  const [gradStart, gradEnd] = gradientColors || defaultGradient;
  const fallbackColor = color || gradStart;

  const safeTrackColor =
    trackColor || (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.06)');

  const arcHeight = Math.ceil(cy + r * 0.5 + strokeWidth / 2 + 2);

  return (
    <View style={[styles.container, { width: size, height: arcHeight }]}>
      <Svg width={size} height={arcHeight} viewBox={`0 0 ${size} ${arcHeight}`}>
        <Defs>
          <LinearGradient id="radialArcGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={gradStart} />
            <Stop offset="100%" stopColor={gradEnd} />
          </LinearGradient>
          <RadialGradient id="gaugeInnerGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={gradStart} stopOpacity={isDark ? 0.07 : 0.10} />
            <Stop offset="90%" stopColor={gradStart} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Soft Ambient Inner Glow Disc */}
        <Circle cx={cx} cy={cy} r={Math.max(0, r - strokeWidth * 0.8)} fill="url(#gaugeInnerGlow)" />

        {/* Inactive Track */}
        <Path
          d={trackPath}
          fill="none"
          stroke={safeTrackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Active Progress Gradient Arc */}
        {clamped > 0 && (
          <Path
            d={activePath}
            fill="none"
            stroke="url(#radialArcGradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
      </Svg>

      {/* Center Value */}
      <View style={[styles.innerContent, { top: cy - 16, height: 34 }]}>
        <View style={styles.valueRow}>
          <Text
            style={[
              styles.percentageValue,
              {
                color: colors.textPrimary,
                fontFamily: typography.fontFamilies.bold,
              },
            ]}
          >
            {clamped}
          </Text>
          <Text
            style={[
              styles.percentSign,
              {
                color: colors.textSecondary,
                fontFamily: typography.fontFamilies.semibold,
              },
            ]}
          >
            %
          </Text>
        </View>
        {subtitle ? (
          <Text style={[styles.subtitleText, { color: colors.textMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  innerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    left: 0,
    right: 0,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 1,
  },
  percentageValue: {
    fontSize: 25,
    letterSpacing: -0.5,
  },
  percentSign: {
    fontSize: 13,
  },
  subtitleText: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 1,
    paddingHorizontal: 8,
  },
});
