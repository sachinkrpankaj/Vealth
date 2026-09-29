import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Platform } from 'react-native';
import { Lock, Fingerprint, Delete } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSecurityStore } from '../../stores/useSecurityStore';
import { useTheme } from '../../theme';
import { VaelthLogo } from '../ui/VaelthLogo';

export const SecurityLockScreen: React.FC = () => {
  const { colors, typography, radii } = useTheme();
  const {
    isLocked,
    isBiometricEnabled,
    verifyPin,
    authenticateWithBiometrics,
  } = useSecurityStore();

  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isLocked && isBiometricEnabled) {
      authenticateWithBiometrics();
    }
  }, [isLocked, isBiometricEnabled]);

  if (!isLocked) return null;

  const handleKeyPress = async (digit: string) => {
    if (pin.length >= 4) return;
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
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setError(false);
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];

  return (
    <Modal visible={isLocked} animationType="fade" transparent={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <VaelthLogo size={64} variant="transparent" style={{ marginBottom: 12 }} />
          <Text
            style={[
              styles.title,
              { color: colors.textPrimary, fontSize: typography.fontSizes.headingMd },
            ]}
          >
            Vaelth
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: error ? colors.negative : colors.textSecondary },
            ]}
          >
            {error ? 'Incorrect PIN. Try again.' : 'Enter your 4-digit PIN'}
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
                  style={styles.key}
                  disabled={!isBiometricEnabled}
                >
                  {isBiometricEnabled ? (
                    <Fingerprint size={28} color={colors.textPrimary} />
                  ) : null}
                </Pressable>
              );
            }

            if (key === 'del') {
              return (
                <Pressable key={index} onPress={handleDelete} style={styles.key}>
                  <Delete size={24} color={colors.textSecondary} />
                </Pressable>
              );
            }

            return (
              <Pressable
                key={index}
                onPress={() => handleKeyPress(key)}
                style={({ pressed }) => [
                  styles.key,
                  {
                    backgroundColor: pressed
                      ? colors.surfaceElevated
                      : colors.surface,
                    borderRadius: radii.full,
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
});
