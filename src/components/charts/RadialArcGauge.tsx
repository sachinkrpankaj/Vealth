import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme';

interface RadialArcGaugeProps {
  percentage: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  subtitle?: string;
}

export function RadialArcGauge({
  percentage = 100,
  size = 110,
  strokeWidth = 8,
  color = '#10B981',
  trackColor = 'rgba(16, 185, 129, 0.14)',
  label,
  subtitle,
}: RadialArcGaugeProps) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const r = (size - strokeWidth * 2 - 4) / 2;
  const cx = size / 2;
  const cy = size / 2 - 3;

  // Symmetrical bottom-opening arc: 240 deg sweep
  // Opens at the bottom (6 o'clock) between 4 o'clock and 8 o'clock (120 deg opening)
  // Clockwise from 8 o'clock (240 deg) -> top (0 deg) -> 4 o'clock (120 deg)
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

  const { colors } = useTheme();
  const arcHeight = Math.ceil(cy + r * 0.5 + strokeWidth / 2 + 3);

  return (
    <View style={[styles.container, { width: size, height: arcHeight }]}>
      <Svg width={size} height={arcHeight} viewBox={`0 0 ${size} ${arcHeight}`}>
        {/* Track */}
        <Path
          d={trackPath}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Active Progress */}
        {clamped > 0 && (
          <Path
            d={activePath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
      </Svg>

      <View style={[styles.innerContent, { top: cy - 18, height: 38 }]}>
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
    gap: 2,
  },
  percentageValue: {
    fontSize: 27,
    letterSpacing: -0.6,
  },
  percentSign: {
    fontSize: 14,
  },
  subtitleText: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 1,
    paddingHorizontal: 8,
  },
});
