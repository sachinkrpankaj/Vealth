import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Plus, ShoppingBag, Clock, CheckCircle2, Archive, ListPlus } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { AppHeader } from '../../src/components/navigation/AppHeader';
import { ShoppingListCard } from '../../src/components/shopping/ShoppingListCard';
import { ListFormModal } from '../../src/components/shopping/ListFormModal';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LiquidGlassCard, LiquidGlassPrismOverlay } from '../../src/components/ui/LiquidGlassCard';
import { useShoppingData } from '../../src/hooks/useShoppingData';
import { ShoppingList, ShoppingListSummary } from '../../src/domain/finance/types';
import { formatRupee } from '../../src/domain/finance/currency';
import { useTheme } from '../../src/theme';
import * as Haptics from 'expo-haptics';

export default function ShoppingScreen() {
  const { colors, typography, radii, spacing, isDark } = useTheme();
  const { lists, summaries, isLoading, refresh, createList, renameList, archiveList, deleteList } =
    useShoppingData();

  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<ShoppingList | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  const activeSummaries = summaries.filter((s) => !s.list.isArchived);
  const archivedSummaries = summaries.filter((s) => s.list.isArchived);
  const currentSummaries = activeTab === 'ACTIVE' ? activeSummaries : archivedSummaries;

  // Aggregate totals
  const totalPendingItems = activeSummaries.reduce((acc, curr) => acc + curr.pendingCount, 0);
  const totalEstimated = activeSummaries.reduce((acc, curr) => acc + curr.estimatedPendingTotal, 0);
  const totalPurchased = summaries.reduce((acc, curr) => acc + curr.purchasedTotal, 0);

  const handleOpenListMenu = (summary: ShoppingListSummary) => {
    const { list } = summary;
    Alert.alert(
      list.name,
      `Choose an action for this shopping list (${summary.pendingCount} pending, ${summary.purchasedCount} purchased)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rename List',
          onPress: () => {
            setEditingList(list);
          },
        },
        {
          text: list.isArchived ? 'Unarchive List' : 'Archive List',
          onPress: async () => {
            try {
              await archiveList(list.id, !list.isArchived);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            } catch (e: any) {
              Alert.alert('Archive Error', e?.message || 'Failed to update archive status.');
            }
          },
        },
        {
          text: 'Delete List',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Shopping List',
              `Are you sure you want to delete "${list.name}"? If it contains purchased items with financial history, it will be safely archived instead of deleted.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const res = await deleteList(list.id);
                      if (res.archivedInstead) {
                        Alert.alert('List Safely Archived', res.message);
                      } else {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                      }
                    } catch (e: any) {
                      Alert.alert('Delete Error', e?.message || 'Failed to delete list.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer scrollable hasTabBar contentContainerStyle={styles.scrollContent}>
      {/* 1. App Header */}
      <AppHeader
        title="shopping"
        onProfilePress={() => router.push('/profile')}
        onRightPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setIsCreateModalOpen(true);
        }}
        rightAccessibilityLabel="Create shopping list"
        rightIcon={<Plus size={18} color={colors.textPrimary} />}
      />

      {/* 2. Overview Banner Card */}
      <LiquidGlassCard radius={22} padding={16} style={styles.overviewCard}>
        <View style={styles.overviewTop}>
          <View style={styles.overviewTitleRow}>
            <ShoppingBag size={18} color={colors.accent} style={{ marginRight: 8 }} />
            <Text style={[styles.overviewTitle, { color: colors.textPrimary }]}>
              Planned Purchases
            </Text>
          </View>
          <Text style={[styles.overviewCountBadge, { color: colors.accent, backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)' }]}>
            {totalPendingItems} {totalPendingItems === 1 ? 'item' : 'items'} planned
          </Text>
        </View>

        <View style={[styles.overviewStatsGrid, { borderTopColor: colors.borderSubtle, borderTopWidth: 1, marginTop: 12, paddingTop: 12 }]}>
          <View style={styles.overviewStatCol}>
            <Text style={[styles.overviewStatLabel, { color: colors.textSecondary }]}>
              ESTIMATED BUDGET
            </Text>
            <Text style={[styles.overviewStatVal, { color: colors.textPrimary }]}>
              {totalEstimated > 0 ? formatRupee(totalEstimated) : '—'}
            </Text>
          </View>

          <View style={[styles.overviewDivider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.overviewStatCol}>
            <Text style={[styles.overviewStatLabel, { color: colors.textSecondary }]}>
              LIFETIME PURCHASED
            </Text>
            <Text style={[styles.overviewStatVal, { color: totalPurchased > 0 ? colors.positive : colors.textMuted }]}>
              {totalPurchased > 0 ? formatRupee(totalPurchased) : '₹0'}
            </Text>
          </View>
        </View>
      </LiquidGlassCard>

      {/* 3. Segment Switch: Active vs Archived */}
      <LiquidGlassCard radius={20} padding={4} contentStyle={styles.segmentedContainer}>
        <View style={styles.segmentRow}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('ACTIVE');
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'ACTIVE' }}
            accessibilityLabel="Active shopping lists"
            style={[
              styles.segmentButton,
              activeTab === 'ACTIVE' && [
                styles.activeSegment,
                { backgroundColor: isDark ? '#171929' : '#EDF1FA' },
              ],
            ]}
          >
            <LiquidGlassPrismOverlay borderRadius={14} isDark={isDark} tone={activeTab === 'ACTIVE' ? 'emphasized' : 'default'} />
            <Text
              style={[
                styles.segmentText,
                {
                  color: activeTab === 'ACTIVE' ? '#FFFFFF' : colors.textSecondary,
                  fontWeight: activeTab === 'ACTIVE' ? '700' : '500',
                },
              ]}
            >
              Active Lists ({activeSummaries.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('ARCHIVED');
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'ARCHIVED' }}
            accessibilityLabel="Archived shopping lists"
            style={[
              styles.segmentButton,
              activeTab === 'ARCHIVED' && [
                styles.activeSegment,
                { backgroundColor: isDark ? '#171929' : '#EDF1FA' },
              ],
            ]}
          >
            <LiquidGlassPrismOverlay borderRadius={14} isDark={isDark} tone={activeTab === 'ARCHIVED' ? 'emphasized' : 'default'} />
            <Text
              style={[
                styles.segmentText,
                {
                  color: activeTab === 'ARCHIVED' ? '#FFFFFF' : colors.textSecondary,
                  fontWeight: activeTab === 'ARCHIVED' ? '700' : '500',
                },
              ]}
            >
              Archived ({archivedSummaries.length})
            </Text>
          </Pressable>
        </View>
      </LiquidGlassCard>

      {/* 4. Lists Grid / Container */}
      <View style={styles.listsContainer}>
        {currentSummaries.length === 0 ? (
          <EmptyState
            title={activeTab === 'ACTIVE' ? 'No Shopping Lists' : 'No Archived Lists'}
            description={
              activeTab === 'ACTIVE'
                ? 'Create lists like "Groceries", "Needs", or "Electronics" to organize upcoming purchases and track estimated spend.'
                : 'Archived lists will appear here to preserve past records.'
            }
            actionTitle={activeTab === 'ACTIVE' ? 'Create New List' : undefined}
            onAction={activeTab === 'ACTIVE' ? () => setIsCreateModalOpen(true) : undefined}
          />
        ) : (
          currentSummaries.map((summary) => (
            <ShoppingListCard
              key={summary.list.id}
              summary={summary}
              onPress={() => router.push(`/shopping/${summary.list.id}` as any)}
              onMenuPress={() => handleOpenListMenu(summary)}
            />
          ))
        )}
      </View>

      {/* Create List Modal */}
      <ListFormModal
        visible={isCreateModalOpen}
        existingLists={lists}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={async (name) => {
          const created = await createList(name);
          router.push(`/shopping/${created.id}` as any);
        }}
      />

      {/* Rename List Modal */}
      <ListFormModal
        visible={editingList !== null}
        initialList={editingList}
        existingLists={lists}
        onClose={() => setEditingList(null)}
        onSubmit={async (name) => {
          if (editingList) {
            await renameList(editingList.id, name);
          }
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 100,
  },
  overviewCard: {
    marginBottom: 16,
  },
  overviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  overviewCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  overviewStatsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overviewStatCol: {
    flex: 1,
  },
  overviewStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  overviewStatVal: {
    fontSize: 17,
    fontWeight: '800',
  },
  overviewDivider: {
    width: 1,
    height: 32,
    marginHorizontal: 12,
  },
  segmentedContainer: {
    marginBottom: 16,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    overflow: 'hidden',
  },
  activeSegment: {
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  segmentText: {
    fontSize: 13,
  },
  listsContainer: {
    marginTop: 4,
  },
});
