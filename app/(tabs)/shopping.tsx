import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Plus, ShoppingBag } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { AppHeader } from '../../src/components/navigation/AppHeader';
import { ShoppingListCard } from '../../src/components/shopping/ShoppingListCard';
import { ListFormModal } from '../../src/components/shopping/ListFormModal';
import { ListActionModal } from '../../src/components/shopping/ListActionModal';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LiquidGlassCard, LiquidGlassPrismOverlay } from '../../src/components/ui/LiquidGlassCard';
import { useShoppingData } from '../../src/hooks/useShoppingData';
import { ShoppingList, ShoppingListSummary } from '../../src/domain/finance/types';
import { formatRupee } from '../../src/domain/finance/currency';
import { useTheme } from '../../src/theme';
import * as Haptics from 'expo-haptics';

export default function ShoppingScreen() {
  const { colors, typography, isDark } = useTheme();
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

  const [actionListSummary, setActionListSummary] = useState<ShoppingListSummary | null>(null);

  const handleOpenListMenu = (summary: ShoppingListSummary) => {
    setActionListSummary(summary);
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
            <ShoppingBag
              size={18}
              color={isDark ? '#818CF8' : '#6366F1'}
              style={{ marginRight: 8 }}
            />
            <Text
              style={[
                styles.overviewTitle,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fontFamilies.bold,
                },
              ]}
            >
              Planned Purchases
            </Text>
          </View>
          <Text
            style={[
              styles.overviewCountBadge,
              {
                color: isDark ? '#818CF8' : '#6366F1',
                backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)',
                fontFamily: typography.fontFamilies.bold,
              },
            ]}
          >
            {totalPendingItems} {totalPendingItems === 1 ? 'item' : 'items'} planned
          </Text>
        </View>

        <View
          style={[
            styles.overviewStatsGrid,
            {
              borderTopColor: colors.borderSubtle,
              borderTopWidth: 1,
              marginTop: 12,
              paddingTop: 12,
            },
          ]}
        >
          <View style={styles.overviewStatCol}>
            <Text
              style={[
                styles.overviewStatLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamilies.semibold,
                },
              ]}
            >
              ESTIMATED BUDGET
            </Text>
            <Text
              style={[
                styles.overviewStatVal,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fontFamilies.bold,
                },
              ]}
            >
              {totalEstimated > 0 ? formatRupee(totalEstimated) : '—'}
            </Text>
          </View>

          <View style={[styles.overviewDivider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.overviewStatCol}>
            <Text
              style={[
                styles.overviewStatLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamilies.semibold,
                },
              ]}
            >
              LIFETIME PURCHASED
            </Text>
            <Text
              style={[
                styles.overviewStatVal,
                {
                  color: totalPurchased > 0 ? colors.positive : colors.textMuted,
                  fontFamily: typography.fontFamilies.bold,
                },
              ]}
            >
              {totalPurchased > 0 ? formatRupee(totalPurchased) : '₹0'}
            </Text>
          </View>
        </View>
      </LiquidGlassCard>

      {/* 3. Segment Switch: Active vs Archived */}
      <LiquidGlassCard radius={24} padding={4} contentStyle={styles.segmentedContainer}>
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
            <LiquidGlassPrismOverlay
              borderRadius={16}
              isDark={isDark}
              tone={activeTab === 'ACTIVE' ? 'emphasized' : 'default'}
            />
            <Text
              style={[
                styles.segmentText,
                {
                  color: activeTab === 'ACTIVE' ? '#FFFFFF' : colors.textSecondary,
                  fontFamily:
                    activeTab === 'ACTIVE'
                      ? typography.fontFamilies.bold
                      : typography.fontFamilies.medium,
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
            <LiquidGlassPrismOverlay
              borderRadius={16}
              isDark={isDark}
              tone={activeTab === 'ARCHIVED' ? 'emphasized' : 'default'}
            />
            <Text
              style={[
                styles.segmentText,
                {
                  color: activeTab === 'ARCHIVED' ? '#FFFFFF' : colors.textSecondary,
                  fontFamily:
                    activeTab === 'ARCHIVED'
                      ? typography.fontFamilies.bold
                      : typography.fontFamilies.medium,
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
        {isLoading && summaries.length === 0 ? (
          <View style={{ paddingVertical: 48, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="small" color={isDark ? '#818CF8' : '#6366F1'} />
          </View>
        ) : currentSummaries.length === 0 ? (
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

      {/* List Action Modal */}
      <ListActionModal
        visible={actionListSummary !== null}
        list={actionListSummary?.list ?? null}
        summary={actionListSummary ?? undefined}
        onClose={() => setActionListSummary(null)}
        onRename={() => {
          if (actionListSummary) {
            setEditingList(actionListSummary.list);
          }
        }}
        onToggleArchive={async () => {
          if (!actionListSummary) return;
          try {
            await archiveList(actionListSummary.list.id, !actionListSummary.list.isArchived);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          } catch (e: any) {
            Alert.alert('Archive Error', e?.message || 'Failed to update archive status.');
          }
        }}
        onDelete={() => {
          if (!actionListSummary) return;
          const target = actionListSummary.list;
          Alert.alert(
            'Delete Shopping List',
            `Are you sure you want to delete "${target.name}"? If it contains purchased items with financial history, it will be safely archived instead of deleted.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  try {
                    const res = await deleteList(target.id);
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
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 110,
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
  },
  overviewCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    fontSize: 12,
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
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  overviewStatVal: {
    fontSize: 17,
  },
  overviewDivider: {
    width: 1,
    height: 32,
    marginHorizontal: 12,
  },
  segmentedContainer: {
    height: 48,
    marginBottom: 16,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  segmentButton: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
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
