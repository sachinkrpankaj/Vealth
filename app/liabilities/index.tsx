import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, ShieldAlert, CreditCard, Landmark, CircleDot } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { AmountText } from '../../src/components/ui/AmountText';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { useTheme } from '../../src/theme';
import { Liability, LiabilityType } from '../../src/domain/finance/types';

function getLiabilityIcon(type: LiabilityType) {
  switch (type) {
    case 'CREDIT_CARD':
      return CreditCard;
    case 'PERSONAL_LOAN':
      return Landmark;
    default:
      return ShieldAlert;
  }
}

import { updateLiability, deleteLiability, archiveLiability } from '../../src/database/repositories/liabilityRepository';
import { showThemedAlert } from '../../src/components/ui/ThemedDialog';
import { AmountInput } from '../../src/components/ui/AmountInput';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { SecondaryButton } from '../../src/components/ui/SecondaryButton';
import { KeyboardAwareScrollView } from '../../src/components/ui/KeyboardAwareScrollView';
import { Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Trash2, Edit2, X } from 'lucide-react-native';

export default function LiabilitiesListScreen() {
  const { colors, radii, spacing, typography } = useTheme();
  const { standaloneLiabilities, refresh } = useFinancialData();

  const [selectedLiability, setSelectedLiability] = useState<Liability | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState(0);
  const [editNote, setEditNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleOpenLiability = (item: Liability) => {
    setSelectedLiability(item);
    setEditName(item.name);
    setEditAmount(item.amount);
    setEditNote(item.note || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (isSaving || !selectedLiability) return;
    if (!editName.trim()) {
      showThemedAlert('Required', 'Please enter a liability name');
      return;
    }
    if (editAmount <= 0) {
      showThemedAlert('Required', 'Please enter an obligation amount greater than zero');
      return;
    }
    try {
      setIsSaving(true);
      await updateLiability(selectedLiability.id, {
        name: editName.trim(),
        amount: editAmount,
        note: editNote.trim() || undefined,
      });
      await refresh();
      setEditModalVisible(false);
      setSelectedLiability(null);
    } catch (e: any) {
      showThemedAlert('Error', e?.message || 'Failed to update liability');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!selectedLiability) return;
    showThemedAlert(
      'Delete Liability',
      `Are you sure you want to delete ${selectedLiability.name}? If it is referenced by past transactions, it will be safely archived to preserve records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLiability(selectedLiability.id);
              await refresh();
              setEditModalVisible(false);
              setSelectedLiability(null);
            } catch (e: any) {
              showThemedAlert('Delete Error', e?.message || 'Failed to delete liability');
            }
          },
        },
      ]
    );
  };

  const totalObligations = standaloneLiabilities.reduce(
    (acc, curr) => acc + curr.amount,
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

        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Liabilities & Debt</Text>

        <LiquidGlassCard onPress={() => router.push('/liabilities/add')} hitSlop={10}
          accessibilityLabel="Add new liability" tone="emphasized" radius={radii.full} padding={0} style={styles.iconBtn}>
          <Plus size={18} color="#FFFFFF" />
        </LiquidGlassCard>
      </View>

      {/* Hero Card */}
      <Card style={[styles.heroCard, { backgroundColor: colors.surfaceElevated }]}>
        <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
          Total Standalone Liabilities
        </Text>
        <AmountText
          amount={totalObligations}
          size="hero"
          variant={totalObligations > 0 ? 'negative' : 'default'}
          style={{ marginVertical: 4 }}
        />
        <Text style={[styles.heroSub, { color: colors.textMuted }]}>
          {standaloneLiabilities.length} recorded obligations
        </Text>
      </Card>

      {standaloneLiabilities.length === 0 ? (
        <EmptyState
          title="You're clear"
          description="No standalone loans, credit card balances or personal liabilities recorded."
          actionTitle="Record Liability"
          onAction={() => router.push('/liabilities/add')}
        />
      ) : (
        <FlatList
          data={standaloneLiabilities}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
          renderItem={({ item }) => {
            const Icon = getLiabilityIcon(item.type);
            return (
              <LiquidGlassCard
                onPress={() => handleOpenLiability(item)}
                radius={radii.md}
                padding={0}
                style={[styles.card, { backgroundColor: colors.surfaceElevated }]}
                accessibilityLabel={`Manage liability ${item.name}`}
              >
                <View style={styles.row}>
                  <View
                    style={[
                      styles.iconWrapper,
                      { backgroundColor: colors.negativeBg, borderRadius: radii.sm },
                    ]}
                  >
                    <Icon size={20} color={colors.negative} />
                  </View>

                  <View style={styles.details}>
                    <Text
                      style={[
                        styles.name,
                        { color: colors.textPrimary, fontSize: typography.fontSizes.body },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.type,
                        { color: colors.textMuted, fontSize: typography.fontSizes.caption },
                      ]}
                    >
                      {item.type.replace('_', ' ')}
                      {item.dueDate ? ` • Due ${item.dueDate}` : ''}
                    </Text>
                  </View>

                  <View style={styles.amountCol}>
                    <AmountText amount={item.amount} size="bodyLg" variant="negative" />
                  </View>
                </View>
              </LiquidGlassCard>
            );
          }}
        />
      )}

      {/* Liability Manage / Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surfaceElevated, borderRadius: radii.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Manage Liability</Text>
              <Pressable
                onPress={() => setEditModalVisible(false)}
                hitSlop={10}
                accessibilityLabel="Close"
              >
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <KeyboardAwareScrollView
              style={{ maxHeight: 420, flex: 0, flexShrink: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              extraScrollHeight={100}
            >
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Liability Name</Text>
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
                  placeholder="Liability name"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <AmountInput
                label="Remaining Obligation"
                value={editAmount}
                onChangeAmount={setEditAmount}
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
                  title="Delete Liability"
                  onPress={handleDelete}
                />
              </View>
            </KeyboardAwareScrollView>
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
  row: {
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
  details: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontWeight: '600',
    marginBottom: 2,
  },
  type: {
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
