import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Check, X } from 'lucide-react-native';
import { ScreenContainer } from '../../../src/components/ui/ScreenContainer';
import { AmountInput } from '../../../src/components/ui/AmountInput';
import { PrimaryButton } from '../../../src/components/ui/PrimaryButton';
import { LiquidGlassCard } from '../../../src/components/ui/LiquidGlassCard';
import { ColorWheelPicker } from '../../../src/components/ui/ColorWheelPicker';
import { useTheme } from '../../../src/theme';
import { getAccountById, updateAccount } from '../../../src/database/repositories/accountRepository';
import { Account, AccountType } from '../../../src/domain/finance/types';

const ACCOUNT_TYPES: { type: AccountType; label: string }[] = [
  { type: 'BANK', label: 'Bank Account' },
  { type: 'CASH', label: 'Cash Wallet' },
  { type: 'CREDIT_CARD', label: 'Credit Card' },
  { type: 'INVESTMENT', label: 'Investment' },
  { type: 'OTHER', label: 'Other' },
];

const COLOR_OPTIONS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#64748B', // Slate
];

export default function EditAccountScreen() {
  const { colors, radii, spacing } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('BANK');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [creditLimit, setCreditLimit] = useState<number>(5000000);
  const [billingDay, setBillingDay] = useState<number>(15);
  const [dueDay, setDueDay] = useState<number>(5);
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAccount() {
      if (!id) return;
      try {
        setIsLoading(true);
        const acc = await getAccountById(id);
        if (acc) {
          setName(acc.name);
          setType(acc.type);
          setOpeningBalance(acc.openingBalance ?? 0);
          setCreditLimit(acc.creditLimit ?? 5000000);
          setBillingDay(acc.billingDay ?? 15);
          setDueDay(acc.dueDay ?? 5);
          if (acc.color) setSelectedColor(acc.color);
        }
      } catch (e) {
        console.error('Failed to load account:', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadAccount();
  }, [id]);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!id) return;
    if (!name.trim()) {
      setError('Please enter an account name');
      return;
    }

    if (type === 'CREDIT_CARD') {
      if (creditLimit <= 0) {
        setError('Please enter a valid credit card limit');
        return;
      }
      if (!billingDay || billingDay < 1 || billingDay > 31) {
        setError('Please enter a valid billing day (1 to 31)');
        return;
      }
      if (!dueDay || dueDay < 1 || dueDay > 31) {
        setError('Please enter a valid due day (1 to 31)');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await updateAccount(id, {
        name: name.trim(),
        type,
        openingBalance: type === 'CREDIT_CARD' ? 0 : openingBalance,
        creditLimit: type === 'CREDIT_CARD' ? Math.round(creditLimit) : undefined,
        billingDay: type === 'CREDIT_CARD' ? Math.round(billingDay) : undefined,
        dueDay: type === 'CREDIT_CARD' ? Math.round(dueDay) : undefined,
        color: selectedColor,
      });

      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to update account');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>Loading account details...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        <LiquidGlassCard
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel="Go back"
          radius={radii.full}
          padding={0}
          style={styles.closeBtn}
        >
          <ArrowLeft size={18} color={colors.textPrimary} />
        </LiquidGlassCard>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Edit Account</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Account Type Selector */}
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Account Type</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, marginBottom: 16 }}
      >
        {ACCOUNT_TYPES.map((t) => (
          <LiquidGlassCard
            key={t.type}
            onPress={() => setType(t.type)}
            accessibilityLabel={t.label}
            accessibilityState={{ selected: type === t.type }}
            tone={type === t.type ? 'emphasized' : 'default'}
            radius={radii.md}
            padding={0}
            style={styles.typePill}
          >
            <Text
              style={[
                styles.typePillText,
                { color: type === t.type ? '#FFFFFF' : colors.textPrimary },
              ]}
            >
              {t.label}
            </Text>
          </LiquidGlassCard>
        ))}
      </ScrollView>

      {/* Account Name */}
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Account Name *</Text>
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
          placeholder="e.g. HDFC Millennia Credit Card"
          placeholderTextColor={colors.textMuted}
          style={[styles.textInput, { color: colors.textPrimary }]}
        />
      </View>

      {/* Credit Card Fields or Opening Balance */}
      {type === 'CREDIT_CARD' ? (
        <View style={{ marginBottom: 16 }}>
          <AmountInput
            label="Credit Card Limit *"
            value={creditLimit}
            onChangeAmount={setCreditLimit}
            placeholder="50,000"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            This limit will not be added to your net worth.
          </Text>

          {/* Billing Date */}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 14 }]}>
            Billing Date (Every Month) *
          </Text>
          <View style={styles.daySelectorRow}>
            {[1, 5, 10, 15, 20, 25].map((d) => (
              <LiquidGlassCard
                key={`bill-${d}`}
                onPress={() => setBillingDay(d)}
                tone={billingDay === d ? 'emphasized' : 'default'}
                radius={radii.sm}
                padding={0}
                style={styles.dayPill}
              >
                <Text
                  style={[
                    styles.dayPillText,
                    {
                      color: billingDay === d ? '#FFFFFF' : colors.textPrimary,
                      fontWeight: billingDay === d ? '700' : '500',
                    },
                  ]}
                >
                  {d}th
                </Text>
              </LiquidGlassCard>
            ))}
          </View>
          <View
            style={[
              styles.inputBox,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.md,
                marginTop: 8,
              },
            ]}
          >
            <TextInput
              value={String(billingDay || '')}
              onChangeText={(val) => {
                const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(num)) {
                  setBillingDay(Math.min(31, Math.max(1, num)));
                } else {
                  setBillingDay(0);
                }
              }}
              placeholder="Custom Day (1 - 31)"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={2}
              style={[styles.textInput, { color: colors.textPrimary }]}
            />
          </View>

          {/* Due Date */}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 14 }]}>
            Payment Due Date (Every Month) *
          </Text>
          <View style={styles.daySelectorRow}>
            {[5, 10, 15, 20, 25, 28].map((d) => (
              <LiquidGlassCard
                key={`due-${d}`}
                onPress={() => setDueDay(d)}
                tone={dueDay === d ? 'emphasized' : 'default'}
                radius={radii.sm}
                padding={0}
                style={styles.dayPill}
              >
                <Text
                  style={[
                    styles.dayPillText,
                    {
                      color: dueDay === d ? '#FFFFFF' : colors.textPrimary,
                      fontWeight: dueDay === d ? '700' : '500',
                    },
                  ]}
                >
                  {d}th
                </Text>
              </LiquidGlassCard>
            ))}
          </View>
          <View
            style={[
              styles.inputBox,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.md,
                marginTop: 8,
              },
            ]}
          >
            <TextInput
              value={String(dueDay || '')}
              onChangeText={(val) => {
                const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(num)) {
                  setDueDay(Math.min(31, Math.max(1, num)));
                } else {
                  setDueDay(0);
                }
              }}
              placeholder="Custom Day (1 - 31)"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={2}
              style={[styles.textInput, { color: colors.textPrimary }]}
            />
          </View>
        </View>
      ) : (
        <AmountInput
          label="Opening Balance (optional)"
          value={openingBalance}
          onChangeAmount={setOpeningBalance}
          placeholder="0.00"
        />
      )}

      {/* Color Accent */}
      <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>
        Accent Color
      </Text>
      <View style={{ marginBottom: 20 }}>
        <ColorWheelPicker
          selectedColor={selectedColor}
          onSelectColor={setSelectedColor}
          presets={COLOR_OPTIONS}
        />
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: colors.negative }]}>{error}</Text>
      ) : null}

      <PrimaryButton
        title="Save Changes"
        onPress={handleSubmit}
        loading={isSubmitting}
        disabled={!name.trim() || isSubmitting}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 14,
  },
  fieldHint: {
    fontSize: 12,
    marginTop: 4,
  },
  daySelectorRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  dayPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  dayPillText: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
});
