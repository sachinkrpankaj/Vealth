import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Platform, BackHandler, ActivityIndicator } from 'react-native';
import { Lock, Fingerprint, Delete } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSecurityStore } from '../../stores/useSecurityStore';
import { useTheme } from '../../theme';
import { VealthLogo } from '../ui/VealthLogo';

export const SecurityLockScreen: React.FC = () => {
  const { colors, typography, radii } = useTheme();
  const {
    isLocked,
    isBiometricEnabled,
    securityConfigError,
    lockoutUntil,
    getRemainingLockoutSeconds,
    verifyPin,
    authenticateWithBiometrics,
    checkSecurityConfig,
  } = useSecurityStore();

  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [remainingLockout, setRemainingLockout] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Prevent hardware back button from closing or bypassing the lock screen on Android
  useEffect(() => {
    if (!isLocked) return;
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      return true; // Consume event, block bypass
    });
    return () => backSub.remove();
  }, [isLocked]);

  // Lockout countdown timer
  useEffect(() => {
    if (!isLocked) return;
    const checkRemaining = () => {
      const remaining = getRemainingLockoutSeconds();
      setRemainingLockout(remaining);
    };
    checkRemaining();
    const interval = setInterval(checkRemaining, 1000);
    return () => clearInterval(interval);
  }, [isLocked, lockoutUntil]);

  useEffect(() => {
    if (isLocked && isBiometricEnabled && !securityConfigError && remainingLockout === 0) {
      authenticateWithBiometrics();
    }
  }, [isLocked, isBiometricEnabled, securityConfigError, remainingLockout]);

  if (!isLocked) return null;

  if (securityConfigError) {
    return (
      <Modal visible animationType="fade" transparent={false} onRequestClose={() => {}}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <VealthLogo size={64} style={{ marginBottom: 12 }} />
            <Text style={[styles.title, { color: colors.textPrimary, fontSize: typography.fontSizes.headingMd }]}>
              Vealth is locked
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, textAlign: 'center' }]}>
              {securityConfigError}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              if (isRetrying) return;
              setIsRetrying(true);
              try {
                await checkSecurityConfig();
              } finally {
                setIsRetrying(false);
              }
            }}
            disabled={isRetrying}
            style={[styles.retryButton, { backgroundColor: colors.accent, borderRadius: radii.full }]}
          >
            {isRetrying ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={[styles.retryButtonText, { color: colors.background }]}>Try Again</Text>
            )}
          </Pressable>
        </View>
      </Modal>
    );
  }

  const isLockedOut = remainingLockout > 0;

  const handleKeyPress = async (digit: string) => {
    if (isLockedOut || pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError(false);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (newPin.length === 4) {
      const isValid = await verifyPin(newPin);
      if (isValid) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setPin('');
      } else {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        setError(true);
        setTimeout(() => setPin(''), 500);
      }
    }
  };

  const handleDelete = () => {
    if (isLockedOut) return;
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setError(false);
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];

  return (
    <Modal
      visible={isLocked}
      animationType="fade"
      transparent={false}
      onRequestClose={() => {
        // Prevent dismissal on Android back button
      }}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <VealthLogo size={64} style={{ marginBottom: 12 }} />
          <Text
            style={[
              styles.title,
              { color: colors.textPrimary, fontSize: typography.fontSizes.headingMd },
            ]}
          >
            Vealth
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: isLockedOut || error ? colors.negative : colors.textSecondary },
            ]}
          >
            {isLockedOut
              ? `Too many failed attempts. Try again in ${remainingLockout}s`
              : error
              ? 'Incorrect PIN. Try again.'
              : 'Enter your 4-digit PIN'}
          </Text>

          {/* PIN Dots */}
          <View style={styles.dotsContainer}>
            {[0, 1, 2, 3].map((index) => {
              const isFilled = pin.length > index;
              return (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: isFilled
                        ? colors.textPrimary
                        : colors.surfaceSubtle,
                      borderColor: colors.border,
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>

        {/* Keypad */}
        <View style={styles.keypad}>
          {keys.map((key, index) => {
            if (key === 'bio') {
              return (
                <Pressable
                  key={index}
                  onPress={authenticateWithBiometrics}
                  style={[styles.key, { opacity: isLockedOut || !isBiometricEnabled ? 0.3 : 1 }]}
                  disabled={isLockedOut || !isBiometricEnabled}
                  accessibilityLabel="Unlock with biometric"
                >
                  {isBiometricEnabled ? (
                    <Fingerprint size={28} color={colors.textPrimary} />
                  ) : null}
                </Pressable>
              );
            }

            if (key === 'del') {
              return (
                <Pressable
                  key={index}
                  onPress={handleDelete}
                  style={[styles.key, { opacity: isLockedOut ? 0.3 : 1 }]}
                  disabled={isLockedOut}
                  accessibilityLabel="Delete last digit"
                >
                  <Delete size={24} color={colors.textSecondary} />
                </Pressable>
              );
            }

            return (
              <Pressable
                key={index}
                onPress={() => handleKeyPress(key)}
                disabled={isLockedOut}
                accessibilityLabel={`Digit ${key}`}
                style={({ pressed }) => [
                  styles.key,
                  {
                    backgroundColor: pressed
                      ? colors.surfaceElevated
                      : colors.surface,
                    borderRadius: radii.full,
                    opacity: isLockedOut ? 0.4 : 1,
                  },
                ]}
              >
                <Text style={[styles.keyText, { color: colors.textPrimary }]}>
                  {key}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
  },
  iconWrapper: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    maxWidth: 320,
    alignSelf: 'center',
  },
  key: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 26,
    fontWeight: '600',
  },
  retryButton: {
    minHeight: 48,
    minWidth: 144,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
