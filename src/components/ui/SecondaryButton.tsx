import React from 'react';
import {
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { useTheme } from '../../theme';
import { LiquidGlassPrismOverlay } from './LiquidGlassCard';

interface SecondaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}) => {
  const { colors, radii, spacing, typography, isDark } = useTheme();
  const borderRadius = radii.md;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.wrapper,
        {
          borderRadius,
          shadowColor: isDark ? '#000000' : '#312E81',
          shadowOpacity: isDark ? 0.25 : 0.08,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      <View
        style={[
          styles.inner,
          {
            borderRadius,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.85)',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.65)',
            paddingVertical: spacing.md - 2,
            paddingHorizontal: spacing.lg,
          },
        ]}
      >
        <LiquidGlassPrismOverlay borderRadius={borderRadius} isDark={isDark} />
        {loading ? (
          <ActivityIndicator size="small" color={colors.textPrimary} />
        ) : (
          <>
            {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
            <Text
              style={[
                styles.text,
                {
                  color: colors.textPrimary,
                  fontSize: typography.fontSizes.body,
                },
                textStyle,
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    backgroundColor: 'transparent',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    position: 'relative',
    overflow: 'hidden',
  },
  iconContainer: {
    marginRight: 8,
  },
  text: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textAlign: 'center',
  },
});
