import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Switch, Alert } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Lock, Fingerprint, ShieldCheck } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { useSecurityStore } from '../../src/stores/useSecurityStore';
import { useTheme } from '../../src/theme';

export default function SecuritySettingsScreen() {
  const { colors, typography, radii, spacing } = useTheme();
  const {
    isPinEnabled,
    isBiometricEnabled,
    setPin,
    setBiometricEnabled,
  } = useSecurityStore();

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSavePin = async () => {
    if (newPin.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    await setPin(newPin);
    setShowSetup(false);
    setNewPin('');
    setConfirmPin('');
    setError(null);
    Alert.alert('Success', 'Security PIN has been set.');
  };

  const handleDisablePin = () => {
    Alert.alert(
      'Disable PIN',
      'Are you sure you want to disable PIN lock?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            await setPin(null);
            await setBiometricEnabled(false);
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        <LiquidGlassCard onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back"
          radius={radii.full} padding={0} style={styles.iconBtn}>
          <ArrowLeft size={18} color={colors.textPrimary} />
        </LiquidGlassCard>

        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Security & Privacy</Text>

        <View style={{ width: 36 }} />
      </View>

      {/* PIN Lock Card */}
      <Card style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
        <View style={styles.cardHeader}>
          <View style={styles.iconTitleRow}>
            <Lock size={20} color={colors.accent} style={{ marginRight: 10 }} />
            <View>
              <Text
                style={[
                  styles.cardTitle,
                  { color: colors.textPrimary, fontSize: typography.fontSizes.body },
                ]}
              >
                PIN Lock
              </Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                {isPinEnabled ? 'PIN lock is enabled' : 'Protect your data with a 4-digit PIN'}
              </Text>
            </View>
          </View>
        </View>

        {isPinEnabled ? (
          <View style={styles.pinActionsRow}>
            <LiquidGlassCard onPress={() => setShowSetup(true)} accessibilityLabel="Change PIN"
              radius={radii.sm} padding={0} style={styles.actionPill}>
              <Text style={[styles.actionPillText, { color: colors.textPrimary }]}>Change PIN</Text>
            </LiquidGlassCard>

            <LiquidGlassCard onPress={handleDisablePin} accessibilityLabel="Disable PIN"
              tone="negative" radius={radii.sm} padding={0} style={styles.actionPill}>
              <Text style={[styles.actionPillText, { color: '#FFFFFF' }]}>Disable PIN</Text>
            </LiquidGlassCard>
          </View>
        ) : (
          <PrimaryButton
            title="Set 4-Digit PIN"
            onPress={() => setShowSetup(true)}
            style={{ marginTop: 12 }}
          />
        )}
      </Card>

      {/* Setup Form */}
      {showSetup ? (
        <Card style={[styles.card, { marginTop: 12 }]}>
          <Text style={[styles.setupTitle, { color: colors.textPrimary }]}>
            {isPinEnabled ? 'Change PIN' : 'Create PIN'}
          </Text>

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>New 4-Digit PIN</Text>
          <TextInput
            value={newPin}
            onChangeText={(val) => {
              setNewPin(val.replace(/[^0-9]/g, '').slice(0, 4));
              setError(null);
            }}
            placeholder="••••"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.md,
                color: colors.textPrimary,
              },
            ]}
          />

          <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 12 }]}>
            Confirm PIN
          </Text>
          <TextInput
            value={confirmPin}
            onChangeText={(val) => {
              setConfirmPin(val.replace(/[^0-9]/g, '').slice(0, 4));
              setError(null);
            }}
            placeholder="••••"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.md,
                color: colors.textPrimary,
              },
            ]}
          />

          {error ? (
            <Text style={[styles.errorBanner, { color: colors.negative }]}>{error}</Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <PrimaryButton
              title="Save PIN"
              onPress={handleSavePin}
              disabled={newPin.length !== 4 || confirmPin.length !== 4}
              style={{ flex: 1 }}
            />
            <LiquidGlassCard
              onPress={() => {
                setShowSetup(false);
                setNewPin('');
                setConfirmPin('');
                setError(null);
              }}
              accessibilityLabel="Cancel PIN setup" radius={radii.md} padding={0} style={styles.cancelBtn}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </LiquidGlassCard>
          </View>
        </Card>
      ) : null}

      {/* Biometric Toggle Card */}
      <Card style={[styles.card, { marginTop: 12 }]}>
        <View style={styles.toggleRow}>
          <View style={styles.iconTitleRow}>
            <Fingerprint size={20} color={colors.accent} style={{ marginRight: 10 }} />
            <View>
              <Text
                style={[
                  styles.cardTitle,
                  { color: colors.textPrimary, fontSize: typography.fontSizes.body },
                ]}
              >
                Biometric Unlock
              </Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                Unlock with Fingerprint or Face ID
              </Text>
            </View>
          </View>

          <Switch
            value={isBiometricEnabled}
            onValueChange={setBiometricEnabled}
            disabled={!isPinEnabled}
            trackColor={{ false: colors.surfaceSubtle, true: colors.accent }}
          />
        </View>
        {!isPinEnabled ? (
          <Text style={[styles.bioWarning, { color: colors.textMuted }]}>
            * You must configure a PIN before enabling biometric unlock.
          </Text>
        ) : null}
      </Card>
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
  card: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardTitle: {
    fontWeight: '600',
  },
  cardSub: {
    fontSize: 12,
    marginTop: 2,
  },
  pinActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  setupTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 18,
    letterSpacing: 4,
  },
  errorBanner: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bioWarning: {
    fontSize: 11,
    marginTop: 8,
  },
});
