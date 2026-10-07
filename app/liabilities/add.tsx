import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { X, Calendar, Landmark, Users, CircleDot } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { AmountInput } from '../../src/components/ui/AmountInput';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { DatePickerField } from '../../src/components/ui/DatePickerField';
import { SelectSheetField, SelectSheetOption } from '../../src/components/ui/SelectSheetField';
import { useTheme } from '../../src/theme';
import { createLiability } from '../../src/database/repositories/liabilityRepository';
import { LiabilityType } from '../../src/domain/finance/types';
import { generateEntityId } from '../../src/utils/idGenerator';

const LIABILITY_TYPE_OPTIONS: SelectSheetOption<LiabilityType>[] = [
  {
    value: 'PERSONAL_LOAN',
    label: 'Personal Loan',
    description: 'Bank loan, EMI, or personal financing facility',
    icon: Landmark,
    color: '#3B82F6',
  },
  {
    value: 'BORROWED_MONEY',
    label: 'Borrowed Debt',
    description: 'Money borrowed from individuals, friends, or family',
    icon: Users,
    color: '#F59E0B',
  },
  {
    value: 'OTHER',
    label: 'Other Debt',
    description: 'Any other outstanding liability or debt commitment',
    icon: CircleDot,
    color: '#64748B',
  },
];

export default function AddLiabilityScreen() {
  const { colors, radii, spacing } = useTheme();

  const [name, setName] = useState('');
  const [type, setType] = useState<LiabilityType>('PERSONAL_LOAN');
  const [amount, setAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!name.trim()) {
      setError('Please enter a liability name');
      return;
    }
    if (amount <= 0) {
      setError('Please enter an amount greater than zero');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await createLiability({
        id: generateEntityId('liability'),
        name: name.trim(),
        type,
        amount,
        dueDate: dueDate.trim() || undefined,
        note: note.trim() || undefined,
        isArchived: false,
      });

      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save liability');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Record Liability</Text>
        <LiquidGlassCard onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close"
          radius={radii.full} padding={0} style={styles.closeBtn}>
          <X size={18} color={colors.textPrimary} />
        </LiquidGlassCard>
      </View>

      {/* Type Selector */}
      <SelectSheetField<LiabilityType>
        label="Liability Type"
        value={type}
        options={LIABILITY_TYPE_OPTIONS}
        onSelect={(newType) => setType(newType)}
        title="Liability Type"
        subtitle="Select the classification for this liability"
      />

      {/* Name */}
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name / Description *</Text>
      <View
        style={[
          styles.inputBox,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.md,
            marginBottom: 16,
          },
        ]}
      >
        <TextInput
          value={name}
          onChangeText={(val) => {
            setName(val);
            if (error) setError(null);
          }}
          placeholder="e.g. HDFC Personal Loan, Axis Card Due"
          placeholderTextColor={colors.textMuted}
          style={[styles.textInput, { color: colors.textPrimary }]}
          autoFocus
        />
      </View>

      {/* Amount Input */}
      <AmountInput
        label="Amount Owed *"
        value={amount}
        onChangeAmount={setAmount}
        placeholder="0.00"
      />

      {/* Due Date */}
      <DatePickerField
        label="Due Date (optional)"
        value={dueDate}
        onChange={setDueDate}
        placeholder="YYYY-MM-DD"
        isClearable
        includeFutureShortcuts={true}
        style={{ marginTop: 12, marginBottom: 16 }}
      />

      {/* Note */}
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Note (optional)</Text>
      <View
        style={[
          styles.inputBox,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.md,
            marginBottom: 24,
          },
        ]}
      >
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Rate 11.5%, 12 months tenure"
          placeholderTextColor={colors.textMuted}
          style={[styles.textInput, { color: colors.textPrimary }]}
        />
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: colors.negative }]}>{error}</Text>
      ) : null}

      <PrimaryButton
        title="Save Liability"
        onPress={handleSubmit}
        loading={isSubmitting}
        disabled={!name.trim() || amount <= 0 || isSubmitting}
      />
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
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  typePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  typePillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
});
