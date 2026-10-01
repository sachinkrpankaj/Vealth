import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ShoppingBag, ChevronRight, CheckCircle2, Clock, MoreVertical, Archive } from 'lucide-react-native';
import { ShoppingListSummary } from '../../domain/finance/types';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import { formatRupee } from '../../domain/finance/currency';
import { useTheme } from '../../theme';
import * as Haptics from 'expo-haptics';

interface ShoppingListCardProps {
  summary: ShoppingListSummary;
  onPress: () => void;
  onMenuPress?: () => void;
}

export const ShoppingListCard: React.FC<ShoppingListCardProps> = ({
  summary,
  onPress,
  onMenuPress,
}) => {
  const { colors, typography, radii, spacing, isDark } = useTheme();
  const { list, pendingCount, purchasedCount, estimatedPendingTotal, purchasedTotal } = summary;

  const totalItems = pendingCount + purchasedCount;

  return (
    <LiquidGlassCard
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      radius={radii.lg}
      padding={spacing.md}
      style={styles.cardContainer}
      accessibilityLabel={`Shopping list ${list.name}, ${pendingCount} pending items`}
    >
      <View style={styles.topRow}>
        <View style={styles.titleRow}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.12)',
                borderRadius: radii.sm,
              },
            ]}
          >
            <ShoppingBag size={18} color={colors.accent} />
          </View>
          <View style={styles.titleTextContainer}>
            <View style={styles.nameWithBadge}>
              <Text style={[styles.listName, { color: colors.textPrimary }]} numberOfLines={1}>
                {list.name}
              </Text>
              {list.isArchived ? (
                <View style={[styles.archivedBadge, { backgroundColor: colors.borderSubtle }]}>
                  <Text style={[styles.archivedBadgeText, { color: colors.textMuted }]}>Archived</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
              {pendingCount === 0 && purchasedCount === 0
                ? 'Empty list'
                : `${pendingCount} to buy · ${purchasedCount} purchased`}
            </Text>
          </View>
        </View>

        <View style={styles.rightActions}>
          {onMenuPress ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onMenuPress();
              }}
              hitSlop={10}
              accessibilityLabel="List options"
              style={[styles.menuButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
            >
              <MoreVertical size={16} color={colors.textSecondary} />
            </Pressable>
          ) : (
            <ChevronRight size={18} color={colors.textMuted} />
          )}
        </View>
      </View>

      {/* Financial Estimates & Purchased Row */}
      <View style={[styles.statsRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1, marginTop: spacing.sm, paddingTop: spacing.sm }]}>
        <View style={styles.statColumn}>
          <View style={styles.statHeader}>
            <Clock size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>ESTIMATED REMAINING</Text>
          </View>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {estimatedPendingTotal > 0 ? formatRupee(estimatedPendingTotal) : '—'}
          </Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: colors.borderSubtle }]} />

        <View style={styles.statColumn}>
          <View style={styles.statHeader}>
            <CheckCircle2 size={12} color={colors.positive} style={{ marginRight: 4 }} />
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>PURCHASED SPEND</Text>
          </View>
          <Text style={[styles.statValue, { color: purchasedTotal > 0 ? colors.positive : colors.textMuted }]}>
            {purchasedTotal > 0 ? formatRupee(purchasedTotal) : '₹0'}
          </Text>
        </View>
      </View>
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  iconBox: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleTextContainer: {
    flex: 1,
  },
  nameWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listName: {
    fontSize: 16,
    fontWeight: '700',
  },
  archivedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  archivedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  itemSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statColumn: {
    flex: 1,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  statDivider: {
    width: 1,
    height: 28,
    marginHorizontal: 12,
  },
});
