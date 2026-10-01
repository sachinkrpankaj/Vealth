import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { X, Calendar } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { AmountInput } from '../../src/components/ui/AmountInput';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { DatePickerField } from '../../src/components/ui/DatePickerField';
import { useTheme } from '../../src/theme';
import { createAsset } from '../../src/database/repositories/assetRepository';
import { AssetCategory } from '../../src/domain/finance/types';
import { formatDateIso } from '../../src/utils/dateUtils';

const ASSET_CATEGORIES: { cat: AssetCategory; label: string }[] = [
  { cat: 'GOLD', label: 'Gold & Jewelry' },
  { cat: 'PROPERTY', label: 'Real Estate' },
  { cat: 'VEHICLE', label: 'Vehicle' },
  { cat: 'ELECTRONICS', label: 'Electronics' },
  { cat: 'INVESTMENT', label: 'Investment' },
  { cat: 'OTHER', label: 'Other Asset' },
];

export default function AddAssetScreen() {
  const { colors, radii, spacing } = useTheme();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetCategory>('GOLD');
  const [currentValue, setCurrentValue] = useState<number>(0);
  const [purchaseValue, setPurchaseValue] = useState<number>(0);
  const [purchaseDate, setPurchaseDate] = useState(() =>
    formatDateIso(new Date())
  );
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter an asset name');
      return;
    }
    if (currentValue <= 0) {
      setError('Please enter a current valuation greater than zero');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await createAsset({
        id: `asset-${Date.now()}`,
        name: name.trim(),
        category,
        currentValue,
        purchaseValue: purchaseValue > 0 ? purchaseValue : currentValue,
        purchaseDate,
        note: note.trim() || undefined,
        isArchived: false,
      });

      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Record Asset</Text>
        <LiquidGlassCard onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close"
          radius={radii.full} padding={0} style={styles.closeBtn}>
          <X size={18} color={colors.textPrimary} />
        </LiquidGlassCard>
      </View>

      {/* Category Selection */}
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Asset Category</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, marginBottom: 16 }}
      >
        {ASSET_CATEGORIES.map((c) => (
          <LiquidGlassCard key={c.cat} onPress={() => setCategory(c.cat)}
            accessibilityLabel={c.label} accessibilityState={{ selected: category === c.cat }}
            tone={category === c.cat ? 'emphasized' : 'default'}
            radius={radii.md} padding={0} style={styles.catPill}>
            <Text
              style={[
                styles.catPillText,
                { color: category === c.cat ? '#FFFFFF' : colors.textPrimary },
              ]}
            >
              {c.label}
            </Text>
          </LiquidGlassCard>
        ))}
      </ScrollView>

      {/* Name */}
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Asset Name *</Text>
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
          placeholder="e.g. 24K Gold Coin 10g, Honda City"
          placeholderTextColor={colors.textMuted}
          style={[styles.textInput, { color: colors.textPrimary }]}
          autoFocus
        />
      </View>

      {/* Current Valuation */}
      <AmountInput
        label="Current Market Value *"
        value={currentValue}
        onChangeAmount={setCurrentValue}
        placeholder="0.00"
      />

      {/* Purchase Value */}
      <AmountInput
        label="Original Purchase Value (optional)"
        value={purchaseValue}
        onChangeAmount={setPurchaseValue}
        placeholder="0.00"
      />

      {/* Purchase Date */}
      <DatePickerField
        label="Purchase Date"
        value={purchaseDate}
        onChange={setPurchaseDate}
        placeholder="YYYY-MM-DD"
        includeFutureShortcuts={false}
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
          placeholder="e.g. Purchased from Tanishq, Invoice #123"
          placeholderTextColor={colors.textMuted}
          style={[styles.textInput, { color: colors.textPrimary }]}
        />
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: colors.negative }]}>{error}</Text>
      ) : null}

      <PrimaryButton
        title="Save Asset"
        onPress={handleSubmit}
        loading={isSubmitting}
        disabled={!name.trim() || currentValue <= 0 || isSubmitting}
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
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  catPillText: {
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
