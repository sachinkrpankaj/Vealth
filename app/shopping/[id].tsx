import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
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
import { ShoppingItemCard } from '../../src/components/shopping/ShoppingItemCard';
import { ItemFormModal } from '../../src/components/shopping/ItemFormModal';
import { PurchaseItemModal } from '../../src/components/shopping/PurchaseItemModal';
import { ListFormModal } from '../../src/components/shopping/ListFormModal';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { useShoppingData } from '../../src/hooks/useShoppingData';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { ShoppingItem } from '../../src/domain/finance/types';
import { formatRupee } from '../../src/domain/finance/currency';
import { useTheme } from '../../src/theme';
import * as Haptics from 'expo-haptics';

export default function ShoppingListDetailScreen() {
  const { colors, radii, spacing, typography, isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

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

  const estimatedPendingTotal = pendingItems.reduce((acc, curr) => acc + (curr.estimatedPrice || 0), 0);
  const purchasedTotal = purchasedItems.reduce((acc, curr) => acc + (curr.purchasePrice || 0), 0);

  const handleDeleteList = () => {
    if (!currentList) return;

    Alert.alert(
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
                Alert.alert('List Safely Archived', res.message, [
                  { text: 'OK', onPress: () => router.back() },
                ]);
              } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                router.back();
              }
            } catch (e: any) {
              Alert.alert('Delete Error', e?.message || 'Failed to delete list.');
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
      Alert.alert('Archive Error', e?.message || 'Failed to update archive status.');
    }
  };

  return (
    <ScreenContainer scrollable contentContainerStyle={styles.scrollContent}>
      {/* 1. Header Bar */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.sm }]}>
        <LiquidGlassCard
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel="Go back"
          radius={radii.full}
          padding={0}
          style={styles.iconBtn}
        >
          <ArrowLeft size={18} color={colors.textPrimary} />
        </LiquidGlassCard>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {currentList?.name || 'Shopping List'}
          </Text>
          {currentList?.isArchived ? (
            <View style={[styles.archivedPill, { backgroundColor: colors.borderSubtle }]}>
              <Text style={[styles.archivedPillText, { color: colors.textMuted }]}>Archived</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.headerRightActions}>
          <LiquidGlassCard
            onPress={() => setIsRenameModalOpen(true)}
            hitSlop={8}
            accessibilityLabel="Rename list"
            radius={radii.full}
            padding={0}
            style={styles.iconBtn}
          >
            <Edit2 size={16} color={colors.textPrimary} />
          </LiquidGlassCard>

          <LiquidGlassCard
            onPress={handleToggleArchive}
            hitSlop={8}
            accessibilityLabel={currentList?.isArchived ? 'Unarchive list' : 'Archive list'}
            radius={radii.full}
            padding={0}
            style={styles.iconBtn}
          >
            <Archive size={16} color={currentList?.isArchived ? colors.accent : colors.textPrimary} />
          </LiquidGlassCard>

          <LiquidGlassCard
            onPress={handleDeleteList}
            hitSlop={8}
            accessibilityLabel="Delete list"
            tone="negative"
            radius={radii.full}
            padding={0}
            style={styles.iconBtn}
          >
            <Trash2 size={16} color={colors.textPrimary} />
          </LiquidGlassCard>
        </View>
      </View>

      {/* 2. List Financial Summary Hero */}
      <LiquidGlassCard radius={20} padding={16} style={styles.summaryCard}>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCol}>
            <View style={styles.statHeader}>
              <Clock size={13} color={colors.accent} style={{ marginRight: 5 }} />
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                TO BUY ({pendingItems.length})
              </Text>
            </View>
            <Text style={[styles.summaryVal, { color: colors.textPrimary }]}>
              {estimatedPendingTotal > 0 ? formatRupee(estimatedPendingTotal) : '—'}
            </Text>
            <Text style={[styles.summarySub, { color: colors.textMuted }]}>
              {estimatedPendingTotal > 0 ? 'Estimated total' : 'No estimates'}
            </Text>
          </View>

          <View style={[styles.summaryDivider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.summaryCol}>
            <View style={styles.statHeader}>
              <CheckCircle2 size={13} color={colors.positive} style={{ marginRight: 5 }} />
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                PURCHASED ({purchasedItems.length})
              </Text>
            </View>
            <Text style={[styles.summaryVal, { color: purchasedTotal > 0 ? colors.positive : colors.textMuted }]}>
              {purchasedTotal > 0 ? formatRupee(purchasedTotal) : '₹0'}
            </Text>
            <Text style={[styles.summarySub, { color: colors.textMuted }]}>Actual spending</Text>
          </View>
        </View>
      </LiquidGlassCard>

      {/* 3. Section: TO BUY */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          TO BUY ({pendingItems.length})
        </Text>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setIsAddItemModalOpen(true);
          }}
          hitSlop={8}
          style={[styles.quickAddPill, { backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)' }]}
        >
          <Plus size={13} color={colors.accent} style={{ marginRight: 4 }} />
          <Text style={[styles.quickAddText, { color: colors.accent }]}>Add Item</Text>
        </Pressable>
      </View>

      <View style={styles.itemsList}>
        {pendingItems.length === 0 ? (
          <View style={[styles.emptyBox, { borderColor: colors.borderSubtle, borderRadius: radii.md }]}>
            <ShoppingBag size={24} color={colors.textMuted} style={{ marginBottom: 6 }} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Pending Items</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Tap "+ Add Item" below to plan new purchases.
            </Text>
          </View>
        ) : (
          pendingItems.map((item) => (
            <ShoppingItemCard
              key={item.id}
              item={item}
              onPurchasePress={() => setPurchasingItem(item)}
              onEditPress={() => setEditingItem(item)}
              onDiscardPress={async () => {
                try {
                  await discardItem(item.id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                } catch (e: any) {
                  Alert.alert('Error', e?.message || 'Failed to discard item.');
                }
              }}
            />
          ))
        )}
      </View>

      {/* 4. Section: HISTORY (Purchased Items) */}
      {purchasedItems.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 10 }]}>
            PURCHASE HISTORY ({purchasedItems.length})
          </Text>
          <View style={styles.itemsList}>
            {purchasedItems.map((item) => (
              <ShoppingItemCard
                key={item.id}
                item={item}
                accountName={item.purchaseAccountId ? accountMap.get(item.purchaseAccountId) : undefined}
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
            style={styles.discardedHeaderRow}
          >
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
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
                  onRestorePress={async () => {
                    try {
                      await restoreItem(item.id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    } catch (e: any) {
                      Alert.alert('Error', e?.message || 'Failed to restore item.');
                    }
                  }}
                  onDeletePress={async () => {
                    try {
                      await deleteItem(item.id);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                    } catch (e: any) {
                      Alert.alert('Error', e?.message || 'Failed to delete discarded item.');
                    }
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 6. Floating / Bottom Add Item CTA */}
      <View style={styles.bottomCtaContainer}>
        <PrimaryButton
          title="+ Add Item to List"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setIsAddItemModalOpen(true);
          }}
        />
      </View>

      {/* Modals */}
      {/* Add Item Modal */}
      <ItemFormModal
        visible={isAddItemModalOpen}
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
        visible={editingItem !== null}
        initialItem={editingItem}
        onClose={() => setEditingItem(null)}
        onSubmit={async (data) => {
          if (!editingItem) return;
          await editItem(editingItem.id, data);
        }}
      />

      {/* Purchase Item Modal */}
      <PurchaseItemModal
        visible={purchasingItem !== null}
        item={purchasingItem}
        onClose={() => setPurchasingItem(null)}
        onConfirmPurchase={async (params) => {
          await purchaseItem(params);
          await refreshFinance();
        }}
      />

      {/* Rename List Modal */}
      <ListFormModal
        visible={isRenameModalOpen}
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
    paddingBottom: 60,
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
    fontWeight: '800',
  },
  archivedPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  archivedPillText: {
    fontSize: 10,
    fontWeight: '600',
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
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  summaryVal: {
    fontSize: 18,
    fontWeight: '800',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
