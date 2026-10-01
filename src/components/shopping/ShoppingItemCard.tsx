import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Alert } from 'react-native';
import {
  Circle,
  CheckCircle,
  ExternalLink,
  Edit2,
  Trash2,
  RotateCcw,
  Check,
  ArrowUpRight,
} from 'lucide-react-native';
import { ShoppingItem } from '../../domain/finance/types';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import { formatRupee } from '../../domain/finance/currency';
import { useTheme } from '../../theme';
import * as Haptics from 'expo-haptics';

interface ShoppingItemCardProps {
  item: ShoppingItem;
  accountName?: string;
  categoryName?: string;
  onPurchasePress?: () => void;
  onEditPress?: () => void;
  onDiscardPress?: () => void;
  onRestorePress?: () => void;
  onDeletePress?: () => void;
  onViewTransaction?: () => void;
}

export const ShoppingItemCard: React.FC<ShoppingItemCardProps> = ({
  item,
  accountName,
  categoryName,
  onPurchasePress,
  onEditPress,
  onDiscardPress,
  onRestorePress,
  onDeletePress,
  onViewTransaction,
}) => {
  const { colors, radii, spacing, typography, isDark } = useTheme();

  const handleOpenLink = async (url: string) => {
    try {
      Haptics.selectionAsync().catch(() => {});
      let cleanUrl = url.trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = `https://${cleanUrl}`;
      }
      await Linking.openURL(cleanUrl);
    } catch {
      Alert.alert('Link Error', 'Unable to open link in browser.');
    }
  };

  // 1. PURCHASED state
  if (item.status === 'PURCHASED') {
    return (
      <LiquidGlassCard
        radius={radii.md}
        padding={spacing.sm + 4}
        style={styles.cardContainer}
        contentStyle={styles.purchasedCardContent}
      >
        <View style={styles.leftRow}>
          <View
            style={[
              styles.statusIconBox,
              {
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)',
              },
            ]}
          >
            <CheckCircle size={18} color={colors.positive} />
          </View>
          <View style={styles.itemInfo}>
            <Text
              style={[
                styles.purchasedName,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fontFamilies.semibold,
                },
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <View style={styles.metaRow}>
              {accountName ? (
                <Text
                  style={[
                    styles.metaText,
                    {
                      color: colors.textSecondary,
                      fontFamily: typography.fontFamilies.medium,
                    },
                  ]}
                >
                  {accountName}
                </Text>
              ) : null}
              {categoryName ? (
                <Text
                  style={[
                    styles.metaText,
                    {
                      color: colors.textSecondary,
                      fontFamily: typography.fontFamilies.medium,
                    },
                  ]}
                >
                  {accountName ? ' • ' : ''}{categoryName}
                </Text>
              ) : null}
              {item.purchasedAt ? (
                <Text
                  style={[
                    styles.metaText,
                    {
                      color: colors.textMuted,
                      fontFamily: typography.fontFamilies.regular,
                    },
                  ]}
                >
                  {' • '}{item.purchasedAt}
                </Text>
              ) : null}
            </View>

            {item.productUrl ? (
              <Pressable
                onPress={() => handleOpenLink(item.productUrl!)}
                hitSlop={8}
                style={styles.linkButton}
              >
                <ExternalLink size={12} color={isDark ? '#818CF8' : '#6366F1'} style={{ marginRight: 4 }} />
                <Text
                  style={[
                    styles.linkText,
                    {
                      color: isDark ? '#818CF8' : '#6366F1',
                      fontFamily: typography.fontFamilies.medium,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.productUrl.replace(/^https?:\/\//, '')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.purchasedRight}>
          <Text
            style={[
              styles.purchasePriceText,
              {
                color: colors.positive,
                fontFamily: typography.fontFamilies.bold,
              },
            ]}
          >
            {formatRupee(item.purchasePrice || 0)}
          </Text>

          {item.transactionId && onViewTransaction ? (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onViewTransaction();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="View transaction details"
              style={({ pressed }) => [
                styles.viewTxButton,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: colors.borderSubtle,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.viewTxText,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamilies.semibold,
                  },
                ]}
              >
                Tx Details
              </Text>
              <ArrowUpRight size={12} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </LiquidGlassCard>
    );
  }

  // 2. DISCARDED state
  if (item.status === 'DISCARDED') {
    return (
      <View
        style={[
          styles.discardedContainer,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : colors.surfaceSubtle,
            borderColor: colors.borderSubtle,
            borderRadius: radii.md,
          },
        ]}
      >
        <View style={styles.discardedLeft}>
          <Text
            style={[
              styles.discardedName,
              {
                color: colors.textMuted,
                fontFamily: typography.fontFamilies.medium,
              },
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          {item.estimatedPrice ? (
            <Text
              style={[
                styles.discardedPrice,
                {
                  color: colors.textMuted,
                  fontFamily: typography.fontFamilies.regular,
                },
              ]}
            >
              Est. {formatRupee(item.estimatedPrice)}
            </Text>
          ) : null}
        </View>

        <View style={styles.discardedActions}>
          {onRestorePress ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onRestorePress();
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Restore item"
              style={({ pressed }) => [
                styles.smallActionButton,
                {
                  backgroundColor: isDark ? 'rgba(99, 102, 241, 0.18)' : 'rgba(99, 102, 241, 0.10)',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <RotateCcw size={13} color={isDark ? '#818CF8' : '#6366F1'} style={{ marginRight: 4 }} />
              <Text
                style={[
                  styles.smallActionText,
                  {
                    color: isDark ? '#818CF8' : '#6366F1',
                    fontFamily: typography.fontFamilies.semibold,
                  },
                ]}
              >
                Restore
              </Text>
            </Pressable>
          ) : null}

          {onDeletePress ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                onDeletePress();
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Delete item"
              style={({ pressed }) => [
                styles.iconOnlyBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Trash2 size={15} color={colors.negative} />
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  // 3. PENDING state
  return (
    <LiquidGlassCard
      radius={radii.md}
      padding={spacing.sm + 4}
      style={styles.cardContainer}
      contentStyle={styles.pendingCardContent}
    >
      <View style={styles.pendingHeaderRow}>
        <View style={styles.leftRow}>
          {/* Interactive Checkbox Circle: tapping marks as purchased! */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              if (onPurchasePress) onPurchasePress();
            }}
            hitSlop={10}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: false }}
            accessibilityLabel={`Mark ${item.name} as purchased`}
            style={({ pressed }) => [
              styles.statusIconBox,
              {
                backgroundColor: pressed
                  ? isDark
                    ? 'rgba(16, 185, 129, 0.25)'
                    : 'rgba(16, 185, 129, 0.18)'
                  : isDark
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(0, 0, 0, 0.04)',
                borderColor: pressed ? colors.positive : colors.borderSubtle,
                borderWidth: 1,
              },
            ]}
          >
            <Circle size={16} color={colors.textSecondary} />
          </Pressable>

          {/* Item details: tapping name/body opens edit modal, link opens browser without conflict */}
          <View style={styles.itemInfo}>
            <Pressable
              onPress={() => {
                if (onEditPress) {
                  Haptics.selectionAsync().catch(() => {});
                  onEditPress();
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.name}`}
            >
              <Text
                style={[
                  styles.pendingName,
                  {
                    color: colors.textPrimary,
                    fontFamily: typography.fontFamilies.semibold,
                  },
                ]}
                numberOfLines={2}
              >
                {item.name}
              </Text>

              {item.estimatedPrice ? (
                <Text
                  style={[
                    styles.estimatedPriceText,
                    {
                      color: isDark ? '#818CF8' : '#6366F1',
                      fontFamily: typography.fontFamilies.bold,
                    },
                  ]}
                >
                  Est. {formatRupee(item.estimatedPrice)}
                </Text>
              ) : null}

              {item.note ? (
                <Text
                  style={[
                    styles.noteText,
                    {
                      color: colors.textSecondary,
                      fontFamily: typography.fontFamilies.regular,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {item.note}
                </Text>
              ) : null}
            </Pressable>

            {item.productUrl ? (
              <Pressable
                onPress={() => handleOpenLink(item.productUrl!)}
                hitSlop={8}
                style={styles.linkButton}
              >
                <ExternalLink size={12} color={isDark ? '#818CF8' : '#6366F1'} style={{ marginRight: 4 }} />
                <Text
                  style={[
                    styles.linkText,
                    {
                      color: isDark ? '#818CF8' : '#6366F1',
                      fontFamily: typography.fontFamilies.medium,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.productUrl.replace(/^https?:\/\//, '')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Edit Button */}
        {onEditPress ? (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onEditPress();
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
            style={({ pressed }) => [
              styles.iconOnlyBtn,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                borderRadius: radii.sm,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Edit2 size={15} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {/* Action Buttons for Pending Item */}
      <View
        style={[
          styles.pendingActionsRow,
          {
            borderTopColor: colors.borderSubtle,
            borderTopWidth: 1,
            marginTop: spacing.sm,
            paddingTop: spacing.xs,
          },
        ]}
      >
        {onDiscardPress ? (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onDiscardPress();
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Discard item"
            style={({ pressed }) => [
              styles.discardBtn,
              {
                borderColor: colors.borderSubtle,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.discardBtnText,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamilies.medium,
                },
              ]}
            >
              Discard
            </Text>
          </Pressable>
        ) : null}

        {onPurchasePress ? (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onPurchasePress();
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Mark ${item.name} as purchased`}
            style={({ pressed }) => [
              styles.purchaseBtn,
              {
                backgroundColor: colors.positive,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Check size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
            <Text
              style={[
                styles.purchaseBtnText,
                {
                  fontFamily: typography.fontFamilies.bold,
                },
              ]}
            >
              Purchased
            </Text>
          </Pressable>
        ) : null}
      </View>
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 8,
  },
  pendingCardContent: {
    flexDirection: 'column',
  },
  pendingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  purchasedCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 8,
  },
  statusIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  itemInfo: {
    flex: 1,
  },
  pendingName: {
    fontSize: 15,
    lineHeight: 20,
  },
  estimatedPriceText: {
    fontSize: 13,
    marginTop: 2,
  },
  noteText: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  linkText: {
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  pendingActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  discardBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  discardBtnText: {
    fontSize: 12,
  },
  purchaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  purchaseBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  purchasedName: {
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  metaText: {
    fontSize: 11,
  },
  purchasedRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  purchasePriceText: {
    fontSize: 15,
  },
  viewTxButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 5,
    gap: 3,
  },
  viewTxText: {
    fontSize: 10,
  },
  discardedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    opacity: 0.82,
  },
  discardedLeft: {
    flex: 1,
    marginRight: 8,
  },
  discardedName: {
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  discardedPrice: {
    fontSize: 11,
    marginTop: 1,
  },
  discardedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smallActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  smallActionText: {
    fontSize: 11,
  },
  iconOnlyBtn: {
    padding: 6,
  },
});
