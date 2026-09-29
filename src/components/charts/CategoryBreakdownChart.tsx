import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatRupee } from '../../domain/finance/currency';
import { useTheme } from '../../theme';

export interface CategoryBreakdownItem {
  id: string;
  name: string;
  amount: number; // minor units (paise)
  percentage: number; // 0 to 100
  color?: string;
}

interface CategoryBreakdownChartProps {
  items: CategoryBreakdownItem[];
  emptyMessage?: string;
}

const CATEGORY_COLORS = [
  '#6366F1', // Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F43F5E', // Rose
  '#3B82F6', // Blue
];

export const CategoryBreakdownChart: React.FC<CategoryBreakdownChartProps> = ({
  items,
  emptyMessage = 'No category spending recorded yet',
}) => {
  const { colors, radii, spacing, typography } = useTheme();

  if (!items || items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Composite progress bar */}
      <View
        style={[
          styles.compositeBar,
          {
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radii.full,
          },
        ]}
      >
        {items.map((item, index) => {
          const barColor = item.color || CATEGORY_COLORS[index % CATEGORY_COLORS.length];
          return (
            <View
              key={item.id}
              style={[
                styles.segment,
                {
                  width: `${Math.max(item.percentage, 2)}%`,
                  backgroundColor: barColor,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Category breakdown item list */}
      <View style={styles.list}>
        {items.map((item, index) => {
          const itemColor = item.color || CATEGORY_COLORS[index % CATEGORY_COLORS.length];
          return (
            <View key={item.id} style={[styles.row, { paddingVertical: spacing.xs }]}>
              <View style={[styles.dot, { backgroundColor: itemColor, borderRadius: radii.full }]} />
              <Text
                style={[
                  styles.name,
                  { color: colors.textPrimary, fontSize: typography.fontSizes.body },
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text style={[styles.percentage, { color: colors.textSecondary }]}>
                {item.percentage.toFixed(1)}%
              </Text>
              <Text style={[styles.amount, { color: colors.textPrimary }]}>
                {formatRupee(item.amount)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  compositeBar: {
    height: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 16,
  },
  segment: {
    height: '100%',
  },
  list: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    marginRight: 10,
  },
  name: {
    flex: 1,
    fontWeight: '500',
  },
  percentage: {
    fontSize: 13,
    marginRight: 12,
    fontWeight: '500',
  },
  amount: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
});
