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
  showNotificationDot?: boolean;
  onActionPress?: () => void;
  actionIcon?: React.ReactNode;
  rightComponent?: React.ReactNode;
}

export function AppHeader({
  title,
  onProfilePress,
  onRightPress,
  rightIcon,
  showNotificationDot = true,
  onActionPress,
  actionIcon,
  rightComponent,
}: AppHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {/* Profile Button — LiquidGlass pill */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onProfilePress?.();
        }}
        hitSlop={8}
        style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
      >
        <LiquidGlassCard radius={19} padding={9} style={styles.iconButton}>
          <User size={18} color={colors.textPrimary} strokeWidth={2.2} />
        </LiquidGlassCard>
      </Pressable>

      {/* Modern Lowercase Title */}
      <View style={styles.titleContainer}>
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

      {/* Right Actions */}
      {rightComponent ? (
        rightComponent
      ) : actionIcon ? (
        <View style={styles.rightActionsRow}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onActionPress?.();
            }}
            hitSlop={8}
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
            hitSlop={8}
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
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onRightPress?.();
          }}
          hitSlop={8}
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingTop: 6,
    paddingBottom: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
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
  },
});
