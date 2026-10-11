import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Lock, KeyRound, ShieldAlert, X } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { PrimaryButton } from '../ui/PrimaryButton';
import { SecondaryButton } from '../ui/SecondaryButton';

export interface BackupPassphraseModalProps {
  visible: boolean;
  mode: 'export' | 'restore';
  cardCount?: number;
  onClose: () => void;
  onSubmit: (passphrase: string) => Promise<void>;
  isSubmitting?: boolean;
}

export const BackupPassphraseModal: React.FC<BackupPassphraseModalProps> = ({
  visible,
  mode,
  cardCount,
  onClose,
  onSubmit,
  isSubmitting = false,
}) => {
  const { colors, typography, radii, spacing, isDark } = useTheme();

  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setPassphrase('');
      setConfirmPassphrase('');
      setError(null);
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const trimmed = passphrase.trim();
    if (!trimmed) {
      setError('A passphrase is required.');
      return;
    }

    if (mode === 'export') {
      if (!confirmPassphrase.trim()) {
        setError('Please confirm your passphrase.');
        return;
      }
      if (trimmed !== confirmPassphrase.trim()) {
        setError('Passphrases do not match.');
        return;
      }
    }

    try {
      setError(null);
      await onSubmit(trimmed);
    } catch (err: any) {
      setError(err?.message || 'Operation failed. Please check the passphrase and try again.');
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setPassphrase('');
    setConfirmPassphrase('');
    setError(null);
    onClose();
  };

  if (!visible) return null;

  const isExport = mode === 'export';
  const title = isExport ? 'Card Wallet Backup Passphrase' : 'Decrypt Card Wallet Backup';
  const subtitle = isExport
    ? 'Your Card Wallet has saved cards. Enter a passphrase to securely encrypt and protect card credentials in this backup.'
    : `This backup contains ${cardCount ? `${cardCount} ` : ''}encrypted card records. Enter the passphrase used when the backup was created.`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      testID="backup-passphrase-modal"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View
          style={[
            styles.modalBox,
            {
              backgroundColor: colors.surfaceElevated || colors.surface,
              borderColor: colors.border,
              borderRadius: radii.xl,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor: isDark
                    ? 'rgba(99, 102, 241, 0.16)'
                    : 'rgba(99, 102, 241, 0.10)',
                  borderColor: isDark
                    ? 'rgba(99, 102, 241, 0.30)'
                    : 'rgba(99, 102, 241, 0.20)',
                },
              ]}
            >
              {isExport ? (
                <KeyRound size={20} color={colors.accent} />
              ) : (
                <Lock size={20} color={colors.accent} />
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.titleText,
                  {
                    color: colors.textPrimary,
                    fontFamily: typography.fontFamilies.bold,
                  },
                ]}
              >
                {title}
              </Text>
              <Text
                style={[
                  styles.subText,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamilies.regular,
                  },
                ]}
              >
                {subtitle}
              </Text>
            </View>

            <Pressable
              onPress={handleClose}
              disabled={isSubmitting}
              hitSlop={8}
              accessibilityLabel="Close dialog"
              style={({ pressed }) => [
                styles.closeBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <X size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Inputs */}
          <View style={styles.inputsContainer}>
            <View style={styles.inputFieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {isExport ? 'Passphrase' : 'Backup Passphrase'}
              </Text>
              <TextInput
                value={passphrase}
                onChangeText={(val) => {
                  setPassphrase(val);
                  setError(null);
                }}
                placeholder="Enter passphrase"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoFocus
                editable={!isSubmitting}
                testID="backup-passphrase-input"
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: error ? colors.negative : colors.border,
                    color: colors.textPrimary,
                    borderRadius: radii.md,
                  },
                ]}
              />
            </View>

            {isExport && (
              <View style={styles.inputFieldBlock}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  Confirm Passphrase
                </Text>
                <TextInput
                  value={confirmPassphrase}
                  onChangeText={(val) => {
                    setConfirmPassphrase(val);
                    setError(null);
                  }}
                  placeholder="Re-enter passphrase"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  editable={!isSubmitting}
                  testID="backup-passphrase-confirm-input"
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: error ? colors.negative : colors.border,
                      color: colors.textPrimary,
                      borderRadius: radii.md,
                    },
                  ]}
                />
              </View>
            )}
          </View>

          {/* Error Row */}
          {error ? (
            <View style={styles.errorRow} testID="backup-passphrase-error-row">
              <ShieldAlert size={14} color={colors.negative} style={{ marginRight: 6 }} />
              <Text
                style={[styles.errorText, { color: colors.negative }]}
                testID="backup-passphrase-error-text"
              >
                {error}
              </Text>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.buttonsRow}>
            <SecondaryButton
              title="Cancel"
              onPress={handleClose}
              disabled={isSubmitting}
              style={styles.actionBtnHalf}
            />

            <PrimaryButton
              title={isExport ? 'Create Backup' : 'Decrypt & Restore'}
              onPress={handleSubmit}
              disabled={isSubmitting || !passphrase.trim() || (isExport && !confirmPassphrase.trim())}
              loading={isSubmitting}
              style={styles.actionBtnHalf}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 380,
    padding: 22,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  subText: {
    fontSize: 12,
    lineHeight: 17,
  },
  closeBtn: {
    padding: 4,
  },
  inputsContainer: {
    gap: 12,
    marginBottom: 12,
  },
  inputFieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  actionBtnHalf: {
    flex: 1,
  },
});
