import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ShoppingBag, ChevronRight, CheckCircle2, Clock, MoreVertical } from 'lucide-react-native';
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

  return (
    <LiquidGlassCard
      radius={radii.lg}
      padding={16}
      style={styles.cardContainer}
      accessibilityLabel={`Shopping list ${list.name}, ${pendingCount} pending items`}
    >
      <View style={styles.cardContent}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Open ${list.name}`}
            style={({ pressed }) => [
              styles.titleRowTouchable,
              { opacity: pressed ? 0.78 : 1 },
            ]}
          >
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.12)',
                  borderRadius: radii.sm,
                },
              ]}
            >
              <ShoppingBag size={18} color={isDark ? '#818CF8' : '#6366F1'} />
            </View>
            <View style={styles.titleTextContainer}>
              <View style={styles.nameWithBadge}>
                <Text
                  style={[
                    styles.listName,
                    {
                      color: colors.textPrimary,
                      fontFamily: typography.fontFamilies.bold,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {list.name}
                </Text>
                {list.isArchived ? (
                  <View style={[styles.archivedBadge, { backgroundColor: colors.borderSubtle }]}>
                    <Text
                      style={[
                        styles.archivedBadgeText,
                        {
                          color: colors.textMuted,
                          fontFamily: typography.fontFamilies.semibold,
                        },
                      ]}
                    >
                      Archived
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  styles.itemSubtitle,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamilies.medium,
                  },
                ]}
              >
                {pendingCount === 0 && purchasedCount === 0
                  ? 'Empty list'
                  : `${pendingCount} to buy · ${purchasedCount} purchased`}
              </Text>
            </View>
          </Pressable>

          {/* Menu button separated cleanly */}
          {onMenuPress ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onMenuPress();
              }}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="List options"
              style={({ pressed }) => [
                styles.menuButton,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                  opacity: pressed ? 0.65 : 1,
                },
              ]}
            >
              <MoreVertical size={16} color={colors.textSecondary} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onPress();
              }}
              accessibilityRole="button"
            >
              <ChevronRight size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Financial Estimates & Purchased Row */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Estimates for ${list.name}`}
          style={({ pressed }) => [
            styles.statsRow,
            {
              borderTopColor: colors.borderSubtle,
              borderTopWidth: 1,
              marginTop: spacing.sm,
              paddingTop: spacing.sm,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <View style={styles.statColumn}>
            <View style={styles.statHeader}>
              <Clock size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
              <Text
                style={[
                  styles.statLabel,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamilies.semibold,
                  },
                ]}
              >
                ESTIMATED REMAINING
              </Text>
            </View>
            <Text
              style={[
                styles.statValue,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fontFamilies.bold,
                },
              ]}
            >
              {estimatedPendingTotal > 0 ? formatRupee(estimatedPendingTotal) : '—'}
            </Text>
          </View>

          <View style={[styles.statDivider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.statColumn}>
            <View style={styles.statHeader}>
              <CheckCircle2 size={12} color={colors.positive} style={{ marginRight: 4 }} />
              <Text
                style={[
                  styles.statLabel,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamilies.semibold,
                  },
                ]}
              >
                PURCHASED SPEND
              </Text>
            </View>
            <Text
              style={[
                styles.statValue,
                {
                  color: purchasedTotal > 0 ? colors.positive : colors.textMuted,
                  fontFamily: typography.fontFamilies.bold,
                },
              ]}
            >
              {purchasedTotal > 0 ? formatRupee(purchasedTotal) : '₹0'}
            </Text>
          </View>
        </Pressable>
      </View>
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 12,
  },
  cardContent: {
    width: '100%',
  },
  titleRowTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  archivedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  archivedBadgeText: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  itemSubtitle: {
    fontSize: 13,
    marginTop: 2,
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
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 15,
  },
  statDivider: {
    width: 1,
    height: 28,
    marginHorizontal: 12,
  },
});
