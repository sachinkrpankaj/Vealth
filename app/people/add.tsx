import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { X, CheckCircle2, ArrowRight } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { Avatar } from '../../src/components/ui/Avatar';
import { ColorWheelPicker } from '../../src/components/ui/ColorWheelPicker';
import { useTheme } from '../../src/theme';
import { createPerson } from '../../src/database/repositories/personRepository';
import { generateEntityId } from '../../src/utils/idGenerator';

const COLOR_OPTIONS = [
  '#6366F1', // Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#14B8A6', // Teal
];

export default function AddPersonScreen() {
  const { colors, radii, spacing } = useTheme();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdName, setCreatedName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    if (isSuccess) {
      timer = setTimeout(() => {
        navigateBack();
      }, 1200);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isSuccess]);

  const navigateBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/money');
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone && trimmedPhone.length !== 10) {
      setError('Phone number must be exactly 10 digits (numbers only)');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const trimmedName = name.trim();

      await createPerson({
        id: generateEntityId('person'),
        name: trimmedName,
        phone: trimmedPhone || undefined,
        email: email.trim() || undefined,
        note: note.trim() || undefined,
        avatarColor: selectedColor,
        isArchived: false,
      });

      setCreatedName(trimmedName);
      setIsSuccess(true);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save person');
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <ScreenContainer>
        <View style={styles.successContainer}>
          <View
            style={[
              styles.successIconBubble,
              {
                backgroundColor: colors.positiveBg,
                borderColor: colors.positive,
              },
            ]}
          >
            <CheckCircle2 size={56} color={colors.positive} />
          </View>
          <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
            Added Successfully!
          </Text>
          <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{createdName}</Text> has been added to your Credit directory.
          </Text>

          <View style={{ width: '100%', marginTop: 32, gap: 12 }}>
            <PrimaryButton
              title="Done"
              onPress={navigateBack}
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Add Person</Text>
        <LiquidGlassCard onPress={navigateBack} hitSlop={10} accessibilityLabel="Close"
          radius={radii.full} padding={0} style={styles.closeBtn}>
          <X size={18} color={colors.textPrimary} />
        </LiquidGlassCard>
      </View>

      {/* Avatar Preview */}
      <View style={styles.avatarPreviewContainer}>
        <Avatar name={name || 'New'} color={selectedColor} size="lg" />
      </View>

      {/* Color Selection & Wheel */}
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Avatar Accent</Text>
      <View style={{ marginBottom: 16 }}>
        <ColorWheelPicker
          selectedColor={selectedColor}
          onSelectColor={setSelectedColor}
          presets={COLOR_OPTIONS}
        />
      </View>

      {/* Name Input */}
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Full Name *</Text>
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
          placeholder="e.g. Rahul Sharma"
          placeholderTextColor={colors.textMuted}
          style={[styles.textInput, { color: colors.textPrimary }]}
          autoFocus
        />
      </View>

      {/* Phone Input */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          Phone Number (optional)
        </Text>
        {phone.length > 0 ? (
          <Text style={[styles.fieldHint, { color: phone.length === 10 ? colors.positive : colors.textMuted }]}>
            {phone.length}/10 digits
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.inputBox,
          {
            backgroundColor: colors.surface,
            borderColor: phone.length > 0 && phone.length < 10 ? colors.warning : colors.border,
            borderRadius: radii.md,
            marginBottom: 16,
          },
        ]}
      >
        <TextInput
          value={phone}
          onChangeText={(val) => {
            const digits = val.replace(/[^0-9]/g, '').slice(0, 10);
            setPhone(digits);
            if (error) setError(null);
          }}
          placeholder="10-digit mobile number (numbers only)"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={10}
          style={[styles.textInput, { color: colors.textPrimary }]}
        />
      </View>

      {/* Email Input */}
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email (optional)</Text>
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
          value={email}
          onChangeText={setEmail}
          placeholder="rahul@example.com"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          style={[styles.textInput, { color: colors.textPrimary }]}
        />
      </View>

      {/* Note Input */}
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
          placeholder="e.g. College friend, Roommate"
          placeholderTextColor={colors.textMuted}
          style={[styles.textInput, { color: colors.textPrimary }]}
        />
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: colors.negative }]}>{error}</Text>
      ) : null}

      <PrimaryButton
        title="Add Person"
        onPress={handleSubmit}
        loading={isSubmitting}
        disabled={!name.trim() || isSubmitting}
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
  avatarPreviewContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  colorDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  successIconBubble: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
});
