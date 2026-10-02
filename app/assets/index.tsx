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
import { Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Trash2, Edit2, X, Archive } from 'lucide-react-native';

export default function AssetsListScreen() {
  const { colors, radii, spacing, typography } = useTheme();
  const { physicalAssets, refresh } = useFinancialData();

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editValue, setEditValue] = useState(0);
  const [editNote, setEditNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
      Alert.alert('Required', 'Please enter an asset name');
      return;
    }
    if (editValue <= 0) {
      Alert.alert('Required', 'Please enter a valuation greater than zero');
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
      Alert.alert('Error', e?.message || 'Failed to update asset');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!selectedAsset) return;
    Alert.alert(
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
              Alert.alert('Delete Error', e?.message || 'Failed to delete asset');
            }
          },
        },
      ]
    );
  };

  const totalValuation = physicalAssets.reduce(
    (acc, curr) => acc + curr.currentValue,
    0
  );

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
          {physicalAssets.length} recorded items
        </Text>
      </Card>

      {physicalAssets.length === 0 ? (
        <EmptyState
          title="No assets recorded"
          description="Keep track of gold, properties, vehicles, electronics or other valuables in your net worth."
          actionTitle="Add Asset"
          onAction={() => router.push('/assets/add')}
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
                    <Text
                      style={[
                        styles.assetName,
                        { color: colors.textPrimary, fontSize: typography.fontSizes.body },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
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
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surfaceElevated, borderRadius: radii.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Manage Asset</Text>
              <Pressable
                onPress={() => setEditModalVisible(false)}
                hitSlop={10}
                accessibilityLabel="Close"
              >
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

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

            <View style={{ gap: 10 }}>
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
          </View>
        </KeyboardAvoidingView>
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
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
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
