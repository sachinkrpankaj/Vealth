import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { User, Bell, CreditCard } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { typography } from '../../theme/typography';
import * as Haptics from 'expo-haptics';
import { IconButton } from '../ui/IconButton';

interface AppHeaderProps {
  title: string;
  onProfilePress?: () => void;
  onCardWalletPress?: () => void;
  showCardWallet?: boolean;
  onRightPress?: () => void;
  rightIcon?: React.ReactNode;
  rightAccessibilityLabel?: string;
  showNotificationDot?: boolean;
  onActionPress?: () => void;
  actionIcon?: React.ReactNode;
  actionAccessibilityLabel?: string;
  rightComponent?: React.ReactNode;
}

export function AppHeader({
  title,
  onProfilePress,
  onCardWalletPress,
  showCardWallet = true,
  onRightPress,
  rightIcon,
  rightAccessibilityLabel,
  showNotificationDot = true,
  onActionPress,
  actionIcon,
  actionAccessibilityLabel,
  rightComponent,
}: AppHeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const handleCardWalletPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onCardWalletPress) {
      onCardWalletPress();
    } else {
      router.push('/cards');
    }
  };

  return (
    <View style={styles.container}>
      {/* Absolute Centered Title - guarantees the title is exactly centered in the screen */}
      <View style={styles.titleContainer} pointerEvents="none">
        <Text
          style={[
            styles.title,
            {
              color: colors.textPrimary,
              fontFamily: typography.fontFamilies.bold,
            },
          ]}
          numberOfLines={1}
        >
          {title.toLowerCase()}
        </Text>
      </View>

      {/* Profile & Card Wallet Buttons */}
      <View style={styles.leftActionsRow}>
        <IconButton
          size={38}
          variant="default"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onProfilePress?.();
          }}
          accessibilityLabel="User profile"
          icon={<User size={18} color={colors.textPrimary} strokeWidth={2.2} />}
        />
        {showCardWallet && (
          <IconButton
            size={38}
            variant="default"
            onPress={handleCardWalletPress}
            accessibilityLabel="Card Wallet"
            icon={<CreditCard size={18} color={colors.textPrimary} strokeWidth={2.2} />}
          />
        )}
      </View>

      {/* Right Actions */}
      {rightComponent ? (
        <View style={styles.rightActionsRow}>{rightComponent}</View>
      ) : actionIcon ? (
        <View style={styles.rightActionsRow}>
          <IconButton
            size={38}
            variant="default"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onActionPress?.();
            }}
            accessibilityLabel={actionAccessibilityLabel || 'Action'}
            icon={actionIcon}
          />
          <IconButton
            size={38}
            variant="default"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onRightPress?.();
            }}
            accessibilityLabel={rightAccessibilityLabel || 'Settings and notifications'}
            icon={
              rightIcon ? (
                rightIcon
              ) : (
                <View style={styles.bellWrapper}>
                  <Bell size={18} color={colors.textPrimary} strokeWidth={2.2} />
                  {showNotificationDot && (
                    <View style={[styles.notificationDot, { backgroundColor: colors.positive }]} />
                  )}
                </View>
              )
            }
          />
        </View>
      ) : (
        <View style={styles.rightActionsRow}>
          <IconButton
            size={38}
            variant="default"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onRightPress?.();
            }}
            accessibilityLabel={rightAccessibilityLabel || (rightIcon ? 'Action' : 'Notifications')}
            icon={
              rightIcon ? (
                rightIcon
              ) : (
                <View style={styles.bellWrapper}>
                  <Bell size={18} color={colors.textPrimary} strokeWidth={2.2} />
                  {showNotificationDot && (
                    <View style={[styles.notificationDot, { backgroundColor: colors.positive }]} />
                  )}
                </View>
              )
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingTop: 6,
    paddingBottom: 8,
    minHeight: 48,
  },
  leftActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 96,
    zIndex: 1,
  },
  title: {
    fontSize: 20,
    letterSpacing: -0.5,
  },
  bellWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
  },
});
