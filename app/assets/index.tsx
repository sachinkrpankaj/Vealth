import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, Building2, Car, Gem, Laptop, CircleDot } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { AmountText } from '../../src/components/ui/AmountText';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { useTheme } from '../../src/theme';
import { Asset, AssetCategory } from '../../src/domain/finance/types';
import { calculateTotalPhysicalAssets } from '../../src/domain/finance/financialEngine';
import { showThemedAlert } from '../../src/components/ui/ThemedDialog';

function getAssetIcon(cat: AssetCategory) {
  switch (cat) {
    case 'GOLD':
      return Gem;
    case 'PROPERTY':
      return Building2;
    case 'VEHICLE':
      return Car;
    case 'ELECTRONICS':
      return Laptop;
    default:
      return CircleDot;
  }
}

import { updateAsset, deleteAsset, archiveAsset } from '../../src/database/repositories/assetRepository';
import { AmountInput } from '../../src/components/ui/AmountInput';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { SecondaryButton } from '../../src/components/ui/SecondaryButton';
import { IconButton } from '../../src/components/ui/IconButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from '../../src/components/ui/KeyboardAwareScrollView';
import { Modal, TextInput, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { Trash2, Edit2, X, Archive } from 'lucide-react-native';

export default function AssetsListScreen() {
  const { colors, radii, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { physicalAssets, transactions, refresh } = useFinancialData();

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editValue, setEditValue] = useState(0);
  const [editNote, setEditNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const dismissEditor = () => {
    if (isSaving) return;
    Keyboard.dismiss();
    setEditModalVisible(false);
    setSelectedAsset(null);
  };

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleOpenAsset = (item: Asset) => {
    setSelectedAsset(item);
    setEditName(item.name);
    setEditValue(item.currentValue);
    setEditNote(item.note || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (isSaving || !selectedAsset) return;
    if (!editName.trim()) {
      showThemedAlert('Required', 'Please enter an asset name');
      return;
    }
    if (editValue <= 0) {
      showThemedAlert('Required', 'Please enter a valuation greater than zero');
      return;
    }
    try {
      setIsSaving(true);
      await updateAsset(selectedAsset.id, {
        name: editName.trim(),
        currentValue: editValue,
        note: editNote.trim() || undefined,
      });
      await refresh();
      setEditModalVisible(false);
      setSelectedAsset(null);
    } catch (e: any) {
      showThemedAlert('Error', e?.message || 'Failed to update asset');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!selectedAsset) return;
    showThemedAlert(
      'Delete Asset',
      `Are you sure you want to delete ${selectedAsset.name}? If it is referenced by past transactions, it will be safely archived to preserve transaction history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAsset(selectedAsset.id);
              await refresh();
              setEditModalVisible(false);
              setSelectedAsset(null);
            } catch (e: any) {
              showThemedAlert('Delete Error', e?.message || 'Failed to delete asset');
            }
          },
        },
      ]
    );
  };

  const totalValuation = calculateTotalPhysicalAssets(physicalAssets, undefined, transactions);
  const activeAssets = physicalAssets.filter((a) => !a.isArchived);
  const archivedAssets = physicalAssets.filter((a) => a.isArchived);

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        <LiquidGlassCard onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back"
          radius={radii.full} padding={0} style={styles.iconBtn}>
          <ArrowLeft size={18} color={colors.textPrimary} />
        </LiquidGlassCard>

        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Valuable Assets</Text>

        <LiquidGlassCard onPress={() => router.push('/assets/add')} hitSlop={10}
          accessibilityLabel="Add new asset" tone="emphasized" radius={radii.full} padding={0} style={styles.iconBtn}>
          <Plus size={18} color="#FFFFFF" />
        </LiquidGlassCard>
      </View>

      {/* Hero Card */}
      <Card style={[styles.heroCard, { backgroundColor: colors.surfaceElevated }]}>
        <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
          Total Physical & Investment Assets
        </Text>
        <AmountText
          amount={totalValuation}
          size="hero"
          style={{ marginVertical: 4 }}
        />
        <Text style={[styles.heroSub, { color: colors.textMuted }]}>
          {activeAssets.length === physicalAssets.length
            ? `${activeAssets.length} recorded items`
            : `${activeAssets.length} active • ${archivedAssets.length} archived`}
        </Text>
      </Card>

      {physicalAssets.length === 0 ? (
        <EmptyState
          title="No assets recorded"
          description="Keep track of gold, properties, vehicles, electronics or other valuables in your net worth."
          actionTitle="Add Asset"
          onAction={() => router.push('/assets/add')}
          style={styles.emptyState}
        />
      ) : (
        <FlatList
          data={physicalAssets}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
          renderItem={({ item }) => {
            const Icon = getAssetIcon(item.category);
            return (
              <LiquidGlassCard
                onPress={() => handleOpenAsset(item)}
                radius={radii.md}
                padding={0}
                style={[styles.card, { backgroundColor: colors.surfaceElevated }]}
                accessibilityLabel={`Manage asset ${item.name}`}
              >
                <View style={styles.assetRow}>
                  <View
                    style={[
                      styles.iconWrapper,
                      { backgroundColor: colors.surfaceSubtle, borderRadius: radii.sm },
                    ]}
                  >
                    <Icon size={20} color={colors.accent} />
                  </View>

                  <View style={styles.assetDetails}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text
                        style={[
                          styles.assetName,
                          { color: colors.textPrimary, fontSize: typography.fontSizes.body },
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      {item.isArchived && (
                        <View
                          style={{
                            backgroundColor: colors.surfaceSubtle,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: radii.xs,
                          }}
                        >
                          <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700' }}>
                            ARCHIVED
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.assetCategory,
                        { color: colors.textMuted, fontSize: typography.fontSizes.caption },
                      ]}
                    >
                      {item.category} • Acquired {item.purchaseDate}
                    </Text>
                  </View>

                  <View style={styles.amountCol}>
                    <AmountText amount={item.currentValue} size="bodyLg" />
                  </View>
                </View>
              </LiquidGlassCard>
            );
          }}
        />
      )}

      {/* Asset Manage / Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={dismissEditor}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismissEditor}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Dismiss asset editor"
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents="box-none"
            style={[styles.modalPositioner, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
          >
          <View style={[styles.modalCard, { backgroundColor: colors.surfaceElevated, borderRadius: radii.lg, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Manage Asset</Text>
              <IconButton
                onPress={dismissEditor}
                disabled={isSaving}
                accessibilityLabel="Close asset editor"
                icon={<X size={20} color={colors.textSecondary} />}
              />
            </View>

            <KeyboardAwareScrollView
              style={{ flex: 0, flexShrink: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Asset Name</Text>
              <View
                style={[
                  styles.inputBox,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radii.md,
                    marginBottom: 14,
                  },
                ]}
              >
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  style={[styles.textInput, { color: colors.textPrimary }]}
                  placeholder="Asset name"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <AmountInput
                label="Current Valuation"
                value={editValue}
                onChangeAmount={setEditValue}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>Note</Text>
              <View
                style={[
                  styles.inputBox,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radii.md,
                    marginBottom: 20,
                  },
                ]}
              >
                <TextInput
                  value={editNote}
                  onChangeText={setEditNote}
                  style={[styles.textInput, { color: colors.textPrimary }]}
                  placeholder="Optional note"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={{ gap: 10, marginTop: 8 }}>
                <PrimaryButton
                  title="Save Changes"
                  onPress={handleSaveEdit}
                  loading={isSaving}
                />
                <SecondaryButton
                  title="Delete Asset"
                  onPress={handleDelete}
                />
              </View>
            </KeyboardAwareScrollView>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  heroCard: {
    padding: 20,
    marginBottom: 16,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  heroSub: {
    fontSize: 12,
  },
  card: {
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  assetDetails: {
    flex: 1,
    marginRight: 12,
  },
  assetName: {
    fontWeight: '600',
    marginBottom: 2,
  },
  assetCategory: {
    textTransform: 'capitalize',
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalPositioner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    maxHeight: '100%',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    flex: 1,
    paddingRight: 12,
    fontSize: 18,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputBox: {
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 14,
  },
});
