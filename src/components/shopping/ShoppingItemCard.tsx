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
  ShoppingBag,
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
      const canOpen = await Linking.canOpenURL(cleanUrl);
      if (canOpen) {
        await Linking.openURL(cleanUrl);
      } else {
        Alert.alert('Invalid Link', 'Could not open the provided product link.');
      }
    } catch {
      Alert.alert('Link Error', 'Unable to open link in browser.');
    }
  };

  if (item.status === 'PURCHASED') {
    return (
      <LiquidGlassCard
        radius={radii.md}
        padding={spacing.sm + 4}
        style={styles.cardContainer}
        contentStyle={styles.purchasedCardContent}
      >
        <View style={styles.leftRow}>
          <View style={[styles.statusIconBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)' }]}>
            <CheckCircle size={18} color={colors.positive} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={[styles.purchasedName, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.metaRow}>
              {accountName ? (
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {accountName}
                </Text>
              ) : null}
              {categoryName ? (
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {accountName ? ' • ' : ''}{categoryName}
                </Text>
              ) : null}
              {item.purchasedAt ? (
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  {' • '}{item.purchasedAt}
                </Text>
              ) : null}
            </View>

            {item.productUrl ? (
              <Pressable
                onPress={() => handleOpenLink(item.productUrl!)}
                hitSlop={6}
                style={styles.linkButton}
              >
                <ExternalLink size={12} color={colors.accent} style={{ marginRight: 4 }} />
                <Text style={[styles.linkText, { color: colors.accent }]} numberOfLines={1}>
                  {item.productUrl.replace(/^https?:\/\//, '')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.purchasedRight}>
          <Text style={[styles.purchasePriceText, { color: colors.positive }]}>
            {formatRupee(item.purchasePrice || 0)}
          </Text>

          {item.transactionId && onViewTransaction ? (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onViewTransaction();
              }}
              hitSlop={6}
              style={[styles.viewTxButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: colors.borderSubtle }]}
            >
              <Text style={[styles.viewTxText, { color: colors.textSecondary }]}>Tx Details</Text>
              <ArrowUpRight size={12} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </LiquidGlassCard>
    );
  }

  if (item.status === 'DISCARDED') {
    return (
      <View style={[styles.discardedContainer, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderSubtle, borderRadius: radii.md }]}>
        <View style={styles.discardedLeft}>
          <Text style={[styles.discardedName, { color: colors.textMuted }]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.estimatedPrice ? (
            <Text style={[styles.discardedPrice, { color: colors.textMuted }]}>
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
              style={[styles.smallActionButton, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.12)' }]}
            >
              <RotateCcw size={13} color={colors.accent} style={{ marginRight: 4 }} />
              <Text style={[styles.smallActionText, { color: colors.accent }]}>Restore</Text>
            </Pressable>
          ) : null}

          {onDeletePress ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                onDeletePress();
              }}
              hitSlop={8}
              style={styles.iconOnlyBtn}
            >
              <Trash2 size={15} color="#EF4444" />
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  // PENDING state
  return (
    <LiquidGlassCard
      radius={radii.md}
      padding={spacing.sm + 4}
      style={styles.cardContainer}
      contentStyle={styles.pendingCardContent}
    >
      <View style={styles.pendingHeaderRow}>
        <View style={styles.leftRow}>
          <View style={[styles.statusIconBox, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)' }]}>
            <Circle size={16} color={colors.textSecondary} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={[styles.pendingName, { color: colors.textPrimary }]} numberOfLines={2}>
              {item.name}
            </Text>

            {item.estimatedPrice ? (
              <Text style={[styles.estimatedPriceText, { color: colors.accent }]}>
                Est. {formatRupee(item.estimatedPrice)}
              </Text>
            ) : null}

            {item.note ? (
              <Text style={[styles.noteText, { color: colors.textSecondary }]} numberOfLines={2}>
                {item.note}
              </Text>
            ) : null}

            {item.productUrl ? (
              <Pressable
                onPress={() => handleOpenLink(item.productUrl!)}
                hitSlop={6}
                style={styles.linkButton}
              >
                <ExternalLink size={12} color={colors.accent} style={{ marginRight: 4 }} />
                <Text style={[styles.linkText, { color: colors.accent }]} numberOfLines={1}>
                  {item.productUrl.replace(/^https?:\/\//, '')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {onEditPress ? (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onEditPress();
            }}
            hitSlop={8}
            style={styles.iconOnlyBtn}
          >
            <Edit2 size={15} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {/* Action Buttons for Pending Item */}
      <View style={[styles.pendingActionsRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1, marginTop: spacing.sm, paddingTop: spacing.xs }]}>
        {onDiscardPress ? (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onDiscardPress();
            }}
            style={[styles.discardBtn, { borderColor: colors.borderSubtle }]}
          >
            <Text style={[styles.discardBtnText, { color: colors.textSecondary }]}>Discard</Text>
          </Pressable>
        ) : null}

        {onPurchasePress ? (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onPurchasePress();
            }}
            style={[styles.purchaseBtn, { backgroundColor: colors.accent }]}
          >
            <Check size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.purchaseBtnText}>Purchased</Text>
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
    fontWeight: '600',
    lineHeight: 20,
  },
  estimatedPriceText: {
    fontSize: 13,
    fontWeight: '700',
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
    fontWeight: '600',
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
    fontWeight: '600',
  },
  purchaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  purchaseBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  purchasedName: {
    fontSize: 14,
    fontWeight: '600',
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
    fontWeight: '700',
  },
  viewTxButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 4,
    gap: 2,
  },
  viewTxText: {
    fontSize: 10,
    fontWeight: '600',
  },
  discardedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    opacity: 0.75,
  },
  discardedLeft: {
    flex: 1,
    marginRight: 8,
  },
  discardedName: {
    fontSize: 13,
    fontWeight: '500',
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
    fontWeight: '600',
  },
  iconOnlyBtn: {
    padding: 6,
  },
});
