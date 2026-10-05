import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Archive,
  ShoppingBag,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { IconButton } from '../../src/components/ui/IconButton';
import { ShoppingItemCard } from '../../src/components/shopping/ShoppingItemCard';
import { ItemFormModal } from '../../src/components/shopping/ItemFormModal';
import { PurchaseItemModal } from '../../src/components/shopping/PurchaseItemModal';
import { ListFormModal } from '../../src/components/shopping/ListFormModal';
import { useShoppingData } from '../../src/hooks/useShoppingData';
import { showThemedAlert } from '../../src/components/ui/ThemedDialog';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { ShoppingItem } from '../../src/domain/finance/types';
import { formatRupee } from '../../src/domain/finance/currency';
import { useTheme } from '../../src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

export default function ShoppingListDetailScreen() {
  const { colors, radii, spacing, typography, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const rawParams = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof rawParams.id === 'string' ? rawParams.id : Array.isArray(rawParams.id) ? rawParams.id[0] : '';

  const {
    lists,
    items,
    isLoading,
    refresh,
    renameList,
    archiveList,
    deleteList,
    addItem,
    editItem,
    discardItem,
    restoreItem,
    deleteItem,
    purchaseItem,
  } = useShoppingData(id);

  const { accounts, categories, refresh: refreshFinance } = useFinancialData();

  const currentList = lists.find((l) => l.id === id);
  const isReadOnly = !currentList || currentList.isArchived;

  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [purchasingItem, setPurchasingItem] = useState<ShoppingItem | null>(null);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [showDiscarded, setShowDiscarded] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
      refreshFinance();
    }, [refresh, refreshFinance])
  );

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  // Split items by status
  const pendingItems = items.filter((i) => i.status === 'PENDING');
  const purchasedItems = items.filter((i) => i.status === 'PURCHASED');
  const discardedItems = items.filter((i) => i.status === 'DISCARDED');

  const estimatedPendingTotal = pendingItems.reduce(
    (acc, curr) => acc + (curr.estimatedPrice || 0),
    0
  );
  const purchasedTotal = purchasedItems.reduce(
    (acc, curr) => acc + (curr.purchasePrice || 0),
    0
  );

  const handleDeleteList = () => {
    if (!currentList) return;

    showThemedAlert(
      'Delete Shopping List',
      `Are you sure you want to delete "${currentList.name}"? If it has historical purchased items, it will be safely archived to preserve financial records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteList(currentList.id);
              if (res.archivedInstead) {
                showThemedAlert('List Safely Archived', res.message, [
                  { text: 'OK', onPress: () => router.back() },
                ]);
              } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                router.back();
              }
            } catch (e: any) {
              showThemedAlert('Delete Error', e?.message || 'Failed to delete list.');
            }
          },
        },
      ]
    );
  };

  const handleToggleArchive = async () => {
    if (!currentList) return;
    try {
      await archiveList(currentList.id, !currentList.isArchived);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      showThemedAlert('Archive Error', e?.message || 'Failed to update archive status.');
    }
  };

  const handleDeleteDiscardedItem = (item: ShoppingItem) => {
    showThemedAlert(
      'Delete Item Permanently',
      `Are you sure you want to permanently delete "${item.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItem(item.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            } catch (e: any) {
              showThemedAlert('Error', e?.message || 'Failed to delete discarded item.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer
      scrollable
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: Math.max(insets.bottom + 80, 100) },
      ]}
    >
      {/* 1. Header Bar */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.sm }]}>
        <IconButton
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/shopping');
            }
          }}
          accessibilityLabel="Go back"
          icon={<ArrowLeft size={18} color={colors.textPrimary} />}
        />

        <View style={styles.headerTitleContainer}>
          <Text
            style={[
              styles.headerTitle,
              {
                color: colors.textPrimary,
                fontFamily: typography.fontFamilies.bold,
              },
            ]}
            numberOfLines={1}
          >
            {currentList?.name || 'Shopping List'}
          </Text>
          {currentList?.isArchived ? (
            <View style={[styles.archivedPill, { backgroundColor: colors.borderSubtle }]}>
              <Text
                style={[
                  styles.archivedPillText,
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

        <View style={styles.headerRightActions}>
          {!isReadOnly ? (
            <IconButton
              onPress={() => setIsRenameModalOpen(true)}
              accessibilityLabel="Rename list"
              icon={<Edit2 size={16} color={colors.textPrimary} />}
            />
          ) : null}

          <IconButton
            onPress={handleToggleArchive}
            accessibilityLabel={currentList?.isArchived ? 'Unarchive list' : 'Archive list'}
            variant={currentList?.isArchived ? 'accent' : 'default'}
            icon={
              <Archive
                size={16}
                color={currentList?.isArchived ? colors.accent : colors.textPrimary}
              />
            }
          />

          {!isReadOnly ? (
            <IconButton
              onPress={handleDeleteList}
              accessibilityLabel="Delete list"
              variant="destructive"
              icon={<Trash2 size={16} color={colors.negative} />}
            />
          ) : null}
        </View>
      </View>

      {/* 2. List Financial Summary Hero */}
      <LiquidGlassCard radius={20} padding={16} style={styles.summaryCard}>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCol}>
            <View style={styles.statHeader}>
              <Clock
                size={13}
                color={colors.accent}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.summaryLabel,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamilies.semibold,
                  },
                ]}
              >
                TO BUY ({pendingItems.length})
              </Text>
            </View>
            <Text
              style={[
                styles.summaryVal,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fontFamilies.bold,
                },
              ]}
            >
              {estimatedPendingTotal > 0 ? formatRupee(estimatedPendingTotal) : '—'}
            </Text>
            <Text
              style={[
                styles.summarySub,
                {
                  color: colors.textMuted,
                  fontFamily: typography.fontFamilies.regular,
                },
              ]}
            >
              {estimatedPendingTotal > 0 ? 'Estimated budget' : 'No estimates'}
            </Text>
          </View>

          <View style={[styles.summaryDivider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.summaryCol}>
            <View style={styles.statHeader}>
              <CheckCircle2 size={13} color={colors.positive} style={{ marginRight: 5 }} />
              <Text
                style={[
                  styles.summaryLabel,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamilies.semibold,
                  },
                ]}
              >
                PURCHASED ({purchasedItems.length})
              </Text>
            </View>
            <Text
              style={[
                styles.summaryVal,
                {
                  color: purchasedTotal > 0 ? colors.positive : colors.textMuted,
                  fontFamily: typography.fontFamilies.bold,
                },
              ]}
            >
              {purchasedTotal > 0 ? formatRupee(purchasedTotal) : '₹0'}
            </Text>
            <Text
              style={[
                styles.summarySub,
                {
                  color: colors.textMuted,
                  fontFamily: typography.fontFamilies.regular,
                },
              ]}
            >
              Actual spending
            </Text>
          </View>
        </View>
      </LiquidGlassCard>

      {/* 3. Section: TO BUY */}
      <View style={styles.sectionHeaderRow}>
        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.textPrimary,
              fontFamily: typography.fontFamilies.bold,
            },
          ]}
        >
          TO BUY ({pendingItems.length})
        </Text>
        {!isReadOnly ? <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setIsAddItemModalOpen(true);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add item to list"
          style={({ pressed }) => [
            styles.quickAddPill,
            {
              backgroundColor: colors.accentBg,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Plus size={13} color={colors.accent} style={{ marginRight: 4 }} />
          <Text
            style={[
              styles.quickAddText,
              {
                color: colors.accent,
                fontFamily: typography.fontFamilies.bold,
              },
            ]}
          >
            Add Item
          </Text>
        </Pressable> : null}
      </View>

      <View style={styles.itemsList}>
        {isLoading && items.length === 0 ? (
          <View style={{ paddingVertical: 32, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : pendingItems.length === 0 ? (
          isReadOnly ? <View
            style={[
              styles.emptyBox,
              {
                borderColor: colors.borderSubtle,
                borderRadius: radii.md,
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              },
            ]}
          >
            <ShoppingBag size={24} color={colors.textMuted} style={{ marginBottom: 6 }} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary, fontFamily: typography.fontFamilies.bold }]}>No Pending Items</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary, fontFamily: typography.fontFamilies.regular }]}>This archived list is read-only.</Text>
          </View> : <Pressable
            onPress={() => setIsAddItemModalOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="No pending items, tap to add an item"
            style={[
              styles.emptyBox,
              {
                borderColor: colors.borderSubtle,
                borderRadius: radii.md,
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              },
            ]}
          >
            <ShoppingBag size={24} color={colors.textMuted} style={{ marginBottom: 6 }} />
            <Text
              style={[
                styles.emptyTitle,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fontFamilies.bold,
                },
              ]}
            >
              No Pending Items
            </Text>
            <Text
              style={[
                styles.emptySub,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamilies.regular,
                },
              ]}
            >
              Tap here to add products you plan to buy.
            </Text>
          </Pressable>
        ) : (
          pendingItems.map((item) => (
            <ShoppingItemCard
              key={item.id}
              item={item}
              readOnly={isReadOnly}
              onPurchasePress={!isReadOnly ? () => setPurchasingItem(item) : undefined}
              onEditPress={!isReadOnly ? () => setEditingItem(item) : undefined}
              onDiscardPress={!isReadOnly ? async () => {
                try {
                  await discardItem(item.id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                } catch (e: any) {
                  showThemedAlert('Error', e?.message || 'Failed to discard item.');
                }
              } : undefined}
            />
          ))
        )}
      </View>

      {/* 4. Section: HISTORY (Purchased Items) */}
      {purchasedItems.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.textPrimary,
                fontFamily: typography.fontFamilies.bold,
                marginBottom: 10,
              },
            ]}
          >
            PURCHASE HISTORY ({purchasedItems.length})
          </Text>
          <View style={styles.itemsList}>
            {purchasedItems.map((item) => (
              <ShoppingItemCard
                key={item.id}
                item={item}
                accountName={
                  item.purchaseAccountId ? accountMap.get(item.purchaseAccountId) : undefined
                }
                categoryName={item.categoryId ? categoryMap.get(item.categoryId) : undefined}
                onViewTransaction={() => {
                  if (item.transactionId) {
                    router.push(`/transaction/${item.transactionId}` as any);
                  }
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* 5. Section: DISCARDED ITEMS */}
      {discardedItems.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <Pressable
            onPress={() => setShowDiscarded(!showDiscarded)}
            accessibilityRole="button"
            accessibilityLabel={`Toggle discarded items, ${discardedItems.length} items`}
            style={styles.discardedHeaderRow}
          >
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: colors.textMuted,
                  fontFamily: typography.fontFamilies.bold,
                },
              ]}
            >
              DISCARDED ({discardedItems.length})
            </Text>
            {showDiscarded ? (
              <ChevronUp size={16} color={colors.textMuted} />
            ) : (
              <ChevronDown size={16} color={colors.textMuted} />
            )}
          </Pressable>

          {showDiscarded ? (
            <View style={[styles.itemsList, { marginTop: 8 }]}>
              {discardedItems.map((item) => (
                <ShoppingItemCard
                  key={item.id}
                  item={item}
                  readOnly={isReadOnly}
                  onRestorePress={!isReadOnly ? async () => {
                    try {
                      await restoreItem(item.id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    } catch (e: any) {
                      showThemedAlert('Error', e?.message || 'Failed to restore item.');
                    }
                  } : undefined}
                  onDeletePress={!isReadOnly ? () => handleDeleteDiscardedItem(item) : undefined}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 6. Bottom Add Item CTA */}
      {!isReadOnly ? <View style={styles.bottomCtaContainer}>
        <PrimaryButton
          title="+ Add Item to List"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setIsAddItemModalOpen(true);
          }}
        />
      </View> : null}

      {/* Modals */}
      {/* Add Item Modal */}
      <ItemFormModal
        visible={isAddItemModalOpen && !isReadOnly}
        onClose={() => setIsAddItemModalOpen(false)}
        onSubmit={async (data) => {
          if (!id) return;
          await addItem({
            listId: id,
            name: data.name,
            estimatedPrice: data.estimatedPrice,
            productUrl: data.productUrl,
            note: data.note,
          });
        }}
      />

      {/* Edit Item Modal */}
      <ItemFormModal
        visible={editingItem !== null && !isReadOnly}
        initialItem={editingItem}
        onClose={() => setEditingItem(null)}
        onSubmit={async (data) => {
          if (!editingItem) return;
          await editItem(editingItem.id, data);
        }}
      />

      {/* Purchase Item Modal */}
      <PurchaseItemModal
        visible={purchasingItem !== null && !isReadOnly}
        item={purchasingItem}
        onClose={() => setPurchasingItem(null)}
        onConfirmPurchase={async (params) => {
          await purchaseItem(params);
          await refreshFinance();
        }}
      />

      {/* Rename List Modal */}
      <ListFormModal
        visible={isRenameModalOpen && !isReadOnly}
        initialList={currentList}
        existingLists={lists}
        onClose={() => setIsRenameModalOpen(false)}
        onSubmit={async (name) => {
          if (currentList) {
            await renameList(currentList.id, name);
          }
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
  },
  archivedPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  archivedPillText: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    marginBottom: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryCol: {
    flex: 1,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  summaryVal: {
    fontSize: 18,
  },
  summarySub: {
    fontSize: 11,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 38,
    marginHorizontal: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    letterSpacing: 0.5,
  },
  quickAddPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  quickAddText: {
    fontSize: 12,
  },
  itemsList: {
    gap: 8,
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 15,
    marginBottom: 2,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
  },
  discardedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  bottomCtaContainer: {
    marginTop: 24,
    marginBottom: 16,
  },
});
