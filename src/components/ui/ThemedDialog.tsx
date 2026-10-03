import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  Archive,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { LiquidGlassCard } from './LiquidGlassCard';
import {
  DialogButton,
  DialogConfig,
  DialogType,
  useDialogStore,
  showThemedAlert,
  ThemedAlert,
} from '../../stores/useDialogStore';

export { showThemedAlert, ThemedAlert };
export type { DialogButton, DialogConfig, DialogType };

export interface ThemedDialogProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  buttons?: DialogButton[];
  type?: DialogType;
  dismissable?: boolean;
}

function getDialogIcon(type?: DialogType, title?: string, buttons?: DialogButton[]) {
  const lowerTitle = (title || '').toLowerCase();
  const hasDestructive = buttons?.some((b) => b.style === 'destructive');

  if (type === 'danger' || hasDestructive) {
    if (lowerTitle.includes('delete') || lowerTitle.includes('item') || lowerTitle.includes('list')) {
      return { Icon: Trash2, key: 'danger-trash' };
    }
    return { Icon: AlertTriangle, key: 'danger-warn' };
  }

  if (lowerTitle.includes('archive')) {
    return { Icon: Archive, key: 'archive' };
  }

  if (type === 'warning' || lowerTitle.includes('required') || lowerTitle.includes('limit') || lowerTitle.includes('balance')) {
    return { Icon: AlertCircle, key: 'warning' };
  }

  if (type === 'success' || lowerTitle.includes('success') || lowerTitle.includes('complete')) {
    return { Icon: CheckCircle2, key: 'success' };
  }

  return { Icon: Info, key: 'info' };
}

export const ThemedDialog: React.FC<ThemedDialogProps> = ({
  visible,
  onClose,
  title,
  message,
  buttons,
  type,
  dismissable = true,
}) => {
  const { colors, typography, radii, spacing, isDark } = useTheme();

  // Internal state for smooth exit transition
  const [modalRendered, setModalRendered] = useState(visible);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  // Active props preserved during exit
  const [displayProps, setDisplayProps] = useState({
    title,
    message,
    buttons,
    type,
    dismissable,
  });

  useEffect(() => {
    if (visible) {
      setDisplayProps({ title, message, buttons, type, dismissable });
      setModalRendered(true);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (modalRendered) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.94,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setModalRendered(false);
          onClose();
        }
      });
    }
  }, [visible, title, message, buttons, type, dismissable]);

  if (!modalRendered) return null;

  // Prepare buttons (default to single "OK" if none provided)
  const effectiveButtons: DialogButton[] =
    displayProps.buttons && displayProps.buttons.length > 0
      ? displayProps.buttons
      : [{ text: 'OK', style: 'default' }];

  const handleDismiss = () => {
    if (!displayProps.dismissable) return;

    // Look for cancel button callback
    const cancelBtn = effectiveButtons.find((b) => b.style === 'cancel');
    if (cancelBtn) {
      handleButtonPress(cancelBtn);
      return;
    }

    // If single button, trigger it
    if (effectiveButtons.length === 1) {
      handleButtonPress(effectiveButtons[0]);
      return;
    }

    // Default close
    onClose();
  };

  const handleButtonPress = async (btn: DialogButton) => {
    if (btn.style === 'destructive') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    onClose();

    if (btn.onPress) {
      try {
        await btn.onPress();
      } catch (err) {
        console.error('ThemedDialog button callback error:', err);
      }
    }
  };

  const { Icon } = getDialogIcon(displayProps.type, displayProps.title, effectiveButtons);

  // Determine badge colors based on dialog nature
  const isDestructive =
    displayProps.type === 'danger' ||
    effectiveButtons.some((b) => b.style === 'destructive') ||
    displayProps.title.toLowerCase().includes('delete') ||
    displayProps.title.toLowerCase().includes('error');

  const isWarning =
    displayProps.type === 'warning' ||
    displayProps.title.toLowerCase().includes('required') ||
    displayProps.title.toLowerCase().includes('limit');

  const isSuccess =
    displayProps.type === 'success' ||
    displayProps.title.toLowerCase().includes('success') ||
    displayProps.title.toLowerCase().includes('complete');

  const isArchive = displayProps.title.toLowerCase().includes('archive');

  let badgeBg = colors.accentBg;
  let iconColor = colors.accent;

  if (isDestructive) {
    badgeBg = colors.negativeBg;
    iconColor = colors.negative;
  } else if (isWarning) {
    badgeBg = colors.warningBg;
    iconColor = colors.warning;
  } else if (isSuccess) {
    badgeBg = colors.positiveBg;
    iconColor = colors.positive;
  } else if (isArchive) {
    badgeBg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
    iconColor = colors.textPrimary;
  }

  const isTwoButtons = effectiveButtons.length === 2;

  return (
    <Modal
      transparent
      visible={modalRendered}
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        {/* Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: fadeAnim,
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.48)',
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        </Animated.View>

        {/* Dialog Card */}
        <Animated.View
          style={[
            styles.dialogContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <LiquidGlassCard
            radius={radii.xl}
            padding={24}
            style={[
              styles.dialogCard,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Top Icon Badge */}
            <View style={styles.iconCenterRow}>
              <View style={[styles.iconBadge, { backgroundColor: badgeBg }]}>
                <Icon size={24} color={iconColor} strokeWidth={2.2} />
              </View>
            </View>

            {/* Title */}
            <Text
              style={[
                styles.title,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fontFamilies.bold,
                  fontSize: typography.fontSizes.headingSm,
                },
              ]}
            >
              {displayProps.title}
            </Text>

            {/* Message Body */}
            {displayProps.message ? (
              <Text
                style={[
                  styles.message,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamilies.regular,
                    fontSize: typography.fontSizes.body,
                    marginTop: spacing.xs,
                  },
                ]}
              >
                {displayProps.message}
              </Text>
            ) : null}

            {/* Buttons Layout */}
            <View
              style={[
                isTwoButtons ? styles.twoButtonsRow : styles.buttonStack,
                { marginTop: spacing.xl },
              ]}
            >
              {effectiveButtons.map((btn, index) => {
                const isCancel = btn.style === 'cancel';
                const isDestruct = btn.style === 'destructive';

                let btnBg = colors.accent;
                let btnTextColor = '#FFFFFF';
                let btnBorderColor = 'transparent';

                if (isCancel) {
                  btnBg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
                  btnTextColor = colors.textPrimary;
                  btnBorderColor = colors.border;
                } else if (isDestruct) {
                  btnBg = colors.negative;
                  btnTextColor = '#FFFFFF';
                }

                return (
                  <Pressable
                    key={`${btn.text}-${index}`}
                    onPress={() => handleButtonPress(btn)}
                    accessibilityRole="button"
                    accessibilityLabel={btn.text}
                    style={({ pressed }) => [
                      styles.buttonBase,
                      isTwoButtons && styles.twoButtonsFlex,
                      {
                        backgroundColor: btnBg,
                        borderColor: btnBorderColor,
                        borderWidth: isCancel ? 1 : 0,
                        borderRadius: radii.md,
                        opacity: pressed ? 0.85 : 1,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        {
                          color: btnTextColor,
                          fontFamily: typography.fontFamilies.semibold,
                          fontSize: typography.fontSizes.body,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {btn.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </LiquidGlassCard>
        </Animated.View>
      </View>
    </Modal>
  );
};

/**
 * Global component connected to useDialogStore.
 * Mount this once in RootLayout/RootStack.
 */
export const GlobalThemedDialog: React.FC = () => {
  const currentDialog = useDialogStore((state) => state.currentDialog);
  const isOpen = useDialogStore((state) => state.isOpen);
  const hideDialog = useDialogStore((state) => state.hideDialog);
  const clearDialog = useDialogStore((state) => state.clearDialog);

  return (
    <ThemedDialog
      visible={isOpen && !!currentDialog}
      onClose={() => {
        hideDialog();
        clearDialog();
      }}
      title={currentDialog?.title || ''}
      message={currentDialog?.message}
      buttons={currentDialog?.buttons}
      type={currentDialog?.type}
      dismissable={currentDialog?.dismissable}
    />
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...(StyleSheet.absoluteFill as any),
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 360,
  },
  dialogCard: {
    width: '100%',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 24,
  },
  iconCenterRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    lineHeight: 24,
  },
  message: {
    textAlign: 'center',
    lineHeight: 20,
  },
  twoButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  twoButtonsFlex: {
    flex: 1,
  },
  buttonStack: {
    flexDirection: 'column',
    gap: 10,
  },
  buttonBase: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonText: {
    textAlign: 'center',
  },
});
