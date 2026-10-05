import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Switch,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Lock,
  Fingerprint,
  ShieldCheck,
  KeyRound,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { SecondaryButton } from '../../src/components/ui/SecondaryButton';
import { IconButton } from '../../src/components/ui/IconButton';
import { showThemedAlert } from '../../src/components/ui/ThemedDialog';
import { useSecurityStore } from '../../src/stores/useSecurityStore';
import { useTheme } from '../../src/theme';
import * as Haptics from 'expo-haptics';

export default function SecuritySettingsScreen() {
  const { colors, typography, radii, spacing, isDark } = useTheme();
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSavePin = async () => {
    if (newPin.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    try {
      setIsSubmitting(true);
      await setPin(newPin);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setShowSetup(false);
      setNewPin('');
      setConfirmPin('');
      setError(null);
      showThemedAlert('Success', 'Security PIN has been set.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the PIN securely.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisablePin = () => {
    showThemedAlert(
      'Disable PIN Lock',
      'Are you sure you want to disable PIN lock? Anyone with physical access to your device will be able to open vealth.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            try {
              await setPin(null);
              await setBiometricEnabled(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            } catch (err) {
              showThemedAlert(
                'Security Error',
                err instanceof Error ? err.message : 'Failed to disable the PIN securely.'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer scrollable contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>
        <IconButton
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          icon={<ArrowLeft size={18} color={colors.textPrimary} />}
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Security & Privacy</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* 1. PIN Lock Section Card */}
      <Card style={[styles.sectionCard, { backgroundColor: colors.surfaceElevated }]}>
        <View style={styles.cardHeaderRow}>
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: isPinEnabled
                  ? isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.10)'
                  : isDark ? 'rgba(99, 102, 241, 0.16)' : 'rgba(99, 102, 241, 0.10)',
                borderColor: isPinEnabled
                  ? isDark ? 'rgba(16, 185, 129, 0.30)' : 'rgba(16, 185, 129, 0.20)'
                  : isDark ? 'rgba(99, 102, 241, 0.30)' : 'rgba(99, 102, 241, 0.20)',
              },
            ]}
          >
            <Lock size={20} color={isPinEnabled ? colors.positive : colors.accent} />
          </View>

          <View style={styles.cardHeaderContent}>
            <View style={styles.titleBadgeRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                PIN Protection
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isPinEnabled
                      ? isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.10)'
                      : isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                    borderColor: isPinEnabled
                      ? isDark ? 'rgba(16, 185, 129, 0.30)' : 'rgba(16, 185, 129, 0.20)'
                      : isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: isPinEnabled ? colors.positive : colors.textMuted },
                  ]}
                >
                  {isPinEnabled ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              {isPinEnabled
                ? 'Your financial portfolio is secured with a 4-digit PIN.'
                : 'Protect your financial accounts and assets from unauthorized access.'}
            </Text>
          </View>
        </View>

        {isPinEnabled ? (
          <View style={styles.pinActionsGrid}>
            <SecondaryButton
              title="Change PIN"
              icon={<KeyRound size={16} color={colors.textPrimary} />}
              onPress={() => {
                setShowSetup(true);
                setNewPin('');
                setConfirmPin('');
                setError(null);
              }}
              style={styles.actionBtnHalf}
            />

            <SecondaryButton
              title="Disable PIN"
              icon={<Trash2 size={16} color={colors.negative} />}
              textStyle={{ color: colors.negative }}
              onPress={handleDisablePin}
              style={[
                styles.actionBtnHalf,
                {
                  borderColor: isDark ? 'rgba(244, 63, 94, 0.25)' : 'rgba(244, 63, 94, 0.20)',
                },
              ]}
            />
          </View>
        ) : (
          <PrimaryButton
            title="Set 4-Digit PIN"
            icon={<Lock size={16} color="#FFFFFF" />}
            onPress={() => {
              setShowSetup(true);
              setNewPin('');
              setConfirmPin('');
              setError(null);
            }}
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* 2. PIN Setup / Change Form */}
      {showSetup && (
        <Card style={[styles.setupCard, { backgroundColor: colors.surfaceElevated }]}>
          <View style={styles.setupHeader}>
            <Text style={[styles.setupTitle, { color: colors.textPrimary }]}>
              {isPinEnabled ? 'Change Security PIN' : 'Create 4-Digit PIN'}
            </Text>
            <Text style={[styles.setupDescription, { color: colors.textSecondary }]}>
              Choose a 4-digit PIN you will easily remember. It will be required to open vealth.
            </Text>
          </View>

          <View style={styles.fieldsContainer}>
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {isPinEnabled ? 'New 4-Digit PIN' : 'Enter 4-Digit PIN'}
              </Text>
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
                maxLength={4}
                autoFocus
                style={[
                  styles.pinInput,
                  {
                    backgroundColor: isDark ? colors.surfaceSubtle : '#FFFFFF',
                    borderColor: error ? colors.negative : colors.border,
                    color: colors.textPrimary,
                  },
                ]}
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Confirm 4-Digit PIN
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
                maxLength={4}
                style={[
                  styles.pinInput,
                  {
                    backgroundColor: isDark ? colors.surfaceSubtle : '#FFFFFF',
                    borderColor: error ? colors.negative : colors.border,
                    color: colors.textPrimary,
                  },
                ]}
              />
            </View>
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <AlertCircle size={14} color={colors.negative} style={{ marginRight: 6 }} />
              <Text style={[styles.errorText, { color: colors.negative }]}>{error}</Text>
            </View>
          ) : null}

          {/* Grouped Actions: Save PIN alongside symmetrical Cancel */}
          <View style={styles.formButtonRow}>
            <SecondaryButton
              title="Cancel"
              onPress={() => {
                setShowSetup(false);
                setNewPin('');
                setConfirmPin('');
                setError(null);
              }}
              style={styles.formBtnHalf}
            />

            <PrimaryButton
              title="Save PIN"
              onPress={handleSavePin}
              disabled={newPin.length !== 4 || confirmPin.length !== 4 || isSubmitting}
              loading={isSubmitting}
              style={styles.formBtnHalf}
            />
          </View>
        </Card>
      )}

      {/* 3. Biometric Authentication Section */}
      <Card style={[styles.sectionCard, { backgroundColor: colors.surfaceElevated }]}>
        <View style={styles.toggleRow}>
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: isBiometricEnabled
                  ? isDark ? 'rgba(99, 102, 241, 0.16)' : 'rgba(99, 102, 241, 0.10)'
                  : isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                borderColor: isBiometricEnabled
                  ? isDark ? 'rgba(99, 102, 241, 0.30)' : 'rgba(99, 102, 241, 0.20)'
                  : isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
              },
            ]}
          >
            <Fingerprint size={20} color={isBiometricEnabled ? colors.accent : colors.textMuted} />
          </View>

          <View style={styles.cardHeaderContent}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Biometric Unlock
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Use Fingerprint or Face ID for quick access to your vault.
            </Text>
          </View>

          <Switch
            value={isBiometricEnabled}
            onValueChange={async (enabled) => {
              try {
                await setBiometricEnabled(enabled);
                Haptics.selectionAsync().catch(() => {});
              } catch (err) {
                showThemedAlert(
                  'Security Error',
                  err instanceof Error ? err.message : 'Failed to update biometric settings.'
                );
              }
            }}
            disabled={!isPinEnabled}
            trackColor={{
              false: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
              true: colors.accent,
            }}
            thumbColor="#FFFFFF"
          />
        </View>

        {!isPinEnabled && (
          <View
            style={[
              styles.infoCallout,
              {
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.10)' : 'rgba(245, 158, 11, 0.08)',
                borderColor: isDark ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.18)',
              },
            ]}
          >
            <AlertCircle size={14} color={colors.warning} style={{ marginRight: 6 }} />
            <Text style={[styles.infoCalloutText, { color: colors.warning }]}>
              Configure a 4-digit PIN above to enable biometric authentication.
            </Text>
          </View>
        )}
      </Card>

      {/* 4. On-Device Privacy Architecture Note */}
      <View
        style={[
          styles.privacyNoteCard,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
          },
        ]}
      >
        <ShieldCheck size={18} color={colors.accent} style={{ marginTop: 2, marginRight: 10 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.privacyNoteTitle, { color: colors.textPrimary }]}>
            On-Device Hardware Encryption
          </Text>
          <Text style={[styles.privacyNoteText, { color: colors.textMuted }]}>
            vealth operates completely offline. Your security PIN and authentication states are hashed
            and stored exclusively in your device's hardware-backed SecureStore.
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
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
  sectionCard: {
    padding: 18,
    marginBottom: 14,
    borderRadius: 18,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardHeaderContent: {
    flex: 1,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  pinActionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionBtnHalf: {
    flex: 1,
    minHeight: 46,
  },
  setupCard: {
    padding: 20,
    marginBottom: 14,
    borderRadius: 18,
  },
  setupHeader: {
    marginBottom: 16,
  },
  setupTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  setupDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  fieldsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldBlock: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  pinInput: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: 8,
    fontWeight: '700',
    paddingHorizontal: 8,
    includeFontPadding: false,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  formButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  formBtnHalf: {
    flex: 1,
    minHeight: 48,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 14,
  },
  infoCalloutText: {
    fontSize: 12,
    flex: 1,
    fontWeight: '500',
  },
  privacyNoteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  privacyNoteTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },
  privacyNoteText: {
    fontSize: 12,
    lineHeight: 17,
  },
});
