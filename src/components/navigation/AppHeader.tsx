import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { User, Bell } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { typography } from '../../theme/typography';
import * as Haptics from 'expo-haptics';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';

interface AppHeaderProps {
  title: string;
  onProfilePress?: () => void;
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

      {/* Profile Button — LiquidGlass pill on the left */}
      <View style={styles.leftActionsRow}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onProfilePress?.();
          }}
          accessibilityRole="button"
          accessibilityLabel="User profile"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
        >
          <LiquidGlassCard radius={19} padding={9} style={styles.iconButton}>
            <User size={18} color={colors.textPrimary} strokeWidth={2.2} />
          </LiquidGlassCard>
        </Pressable>
      </View>

      {/* Right Actions */}
      {rightComponent ? (
        <View style={styles.rightActionsRow}>{rightComponent}</View>
      ) : actionIcon ? (
        <View style={styles.rightActionsRow}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onActionPress?.();
            }}
            accessibilityRole="button"
            accessibilityLabel={actionAccessibilityLabel || 'Action'}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
          >
            <LiquidGlassCard radius={19} padding={9} style={styles.iconButton}>
              {actionIcon}
            </LiquidGlassCard>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onRightPress?.();
            }}
            accessibilityRole="button"
            accessibilityLabel={rightAccessibilityLabel || 'Settings and notifications'}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
          >
            <LiquidGlassCard radius={19} padding={9} style={styles.iconButton}>
              {rightIcon ? (
                rightIcon
              ) : (
                <View style={styles.bellWrapper}>
                  <Bell size={18} color={colors.textPrimary} strokeWidth={2.2} />
                  {showNotificationDot && (
                    <View style={[styles.notificationDot, { backgroundColor: colors.positive }]} />
                  )}
                </View>
              )}
            </LiquidGlassCard>
          </Pressable>
        </View>
      ) : (
        <View style={styles.rightActionsRow}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onRightPress?.();
            }}
            accessibilityRole="button"
            accessibilityLabel={rightAccessibilityLabel || (rightIcon ? 'Action' : 'Notifications')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
          >
            <LiquidGlassCard radius={19} padding={9} style={styles.iconButton}>
              {rightIcon ? (
                rightIcon
              ) : (
                <View style={styles.bellWrapper}>
                  <Bell size={18} color={colors.textPrimary} strokeWidth={2.2} />
                  {showNotificationDot && (
                    <View style={[styles.notificationDot, { backgroundColor: colors.positive }]} />
                  )}
                </View>
              )}
            </LiquidGlassCard>
          </Pressable>
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
