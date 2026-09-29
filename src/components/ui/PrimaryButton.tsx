import React from 'react';
import {
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  variant?: 'primary' | 'positive' | 'negative';
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
  variant = 'primary',
}) => {
  const { colors, radii, spacing, typography } = useTheme();

  let bgColor = colors.textPrimary;
  let textColor = colors.background;

  if (variant === 'positive') {
    bgColor = colors.positive;
    textColor = '#FFFFFF';
  } else if (variant === 'negative') {
    bgColor = colors.negative;
    textColor = '#FFFFFF';
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bgColor,
          borderRadius: radii.md,
          paddingVertical: spacing.md - 2,
          paddingHorizontal: spacing.lg,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon ? <Text style={styles.iconContainer}>{icon}</Text> : null}
          <Text
            style={[
              styles.text,
              {
                color: textColor,
                fontSize: typography.fontSizes.body,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  iconContainer: {
    marginRight: 8,
  },
  text: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textAlign: 'center',
  },
});
