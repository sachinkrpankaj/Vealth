import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line } from 'react-native-svg';
import { formatRupee } from '../../domain/finance/currency';
import { useTheme } from '../../theme';

export interface ChartDataPoint {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Sep 15"
  value: number; // minor units (paise)
}

interface NetWorthChartProps {
  data: ChartDataPoint[];
  height?: number;
}

export type TimeRange = '7D' | '30D' | '3M' | '6M' | '1Y' | 'ALL';

export const NetWorthChart: React.FC<NetWorthChartProps> = ({
  data,
  height = 180,
}) => {
  const { colors } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  if (!data || data.length === 0) {
    return (
      <View style={[styles.emptyContainer, { height }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No historical data available yet
        </Text>
      </View>
    );
  }

  // Wait for the plot's actual width (inside the card's padding) before building SVG coordinates.
  // Until then, render the tooltip and labels without a path or touch targets.
  const plotReady = chartWidth > 0;

  // Find min and max for scaling
  const values = data.map((d) => d.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const range = rawMax - rawMin || 1;
  const paddingY = 20;
  const availableHeight = height - paddingY * 2;

  // Keep the line and its active marker inside the measured plot, even at narrow widths.
  const insetX = Math.min(10, chartWidth / 2);
  const points = plotReady ? data.map((d, index) => {
    const x = data.length > 1
      ? (index / (data.length - 1)) * (chartWidth - insetX * 2) + insetX
      : chartWidth / 2;
    const y = height - paddingY - ((d.value - rawMin) / range) * availableHeight;
    return { x, y };
  }) : [];

  // Straight segments show the actual snapshots without smoothing away short-term changes.
  const linePath = points.map((point, index) =>
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  ).join(' ');

  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`
    : '';

  const activePoint =
    selectedIndex !== null && points[selectedIndex]
      ? points[selectedIndex]
      : points[points.length - 1];
  const activeData = selectedIndex !== null && data[selectedIndex]
    ? data[selectedIndex]
    : data[data.length - 1];

  return (
    <View style={styles.container}>
      {/* Tooltip / Active Point Indicator */}
      <View style={styles.tooltipRow}>
        <Text style={[styles.tooltipDate, { color: colors.textSecondary }]}>
          {activeData.date}
        </Text>
        <Text style={[styles.tooltipValue, { color: colors.textPrimary }]}>
          {formatRupee(activeData.value)}
        </Text>
      </View>

      {/* Plot and touch targets share the same measured, clipped bounds. */}
      <View
        style={[styles.plot, { height }]}
        onLayout={({ nativeEvent: { layout } }) => {
          setChartWidth((previous) => previous === layout.width ? previous : layout.width);
        }}
      >
        {plotReady && (
          <Svg width={chartWidth} height={height}>
            <Defs>
              <LinearGradient id="gradientArea" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.accent} stopOpacity="0.28" />
                <Stop offset="1" stopColor={colors.accent} stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            {/* Gradient fill underneath */}
            <Path d={areaPath} fill="url(#gradientArea)" />

            {/* Crisp curve line */}
            <Path
              d={linePath}
              fill="none"
              stroke={colors.accent}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Active Point Indicator Line & Dot */}
            {activePoint ? (
              <>
                <Line
                  x1={activePoint.x}
                  y1={10}
                  x2={activePoint.x}
                  y2={height}
                  stroke={colors.border}
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <Circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="5"
                  fill={colors.accent}
                  stroke={colors.surface}
                  strokeWidth="2.5"
                />
              </>
            ) : null}
          </Svg>
        )}

        {/* Interactive touch targets along x-axis */}
        {plotReady && (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {points.map((_, index) => {
              const stepWidth = chartWidth / points.length;
              return (
                <Pressable
                  key={index}
                  onPress={() => setSelectedIndex(index)}
                  style={[
                    styles.touchTarget,
                    {
                      left: index * stepWidth,
                      width: stepWidth,
                      height,
                    },
                  ]}
                />
              );
            })}
          </View>
        )}
      </View>

      {/* Date Labels below */}
      <View style={styles.labelsRow}>
        <Text style={[styles.axisLabel, { color: colors.textMuted }]}>
          {data[0]?.label || ''}
        </Text>
        {data.length > 2 ? (
          <Text style={[styles.axisLabel, { color: colors.textMuted }]}>
            {data[Math.floor(data.length / 2)]?.label || ''}
          </Text>
        ) : null}
        <Text style={[styles.axisLabel, { color: colors.textMuted }]}>
          {data[data.length - 1]?.label || ''}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  tooltipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  tooltipDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  tooltipValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  plot: {
    overflow: 'hidden',
  },
  touchTarget: {
    position: 'absolute',
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 8,
  },
  axisLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
});
