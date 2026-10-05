import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { PrimaryButton } from './PrimaryButton';
import { useTheme } from '../../theme';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionTitle?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionTitle,
  onAction,
  style,
}) => {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={[styles.container, { paddingVertical: spacing.xxl }, style]}>
      {icon ? <View style={[styles.iconContainer, { marginBottom: spacing.md }]}>{icon}</View> : null}
      <Text
        style={[
          styles.title,
          {
            color: colors.textPrimary,
            fontSize: typography.fontSizes.headingSm,
            marginBottom: spacing.xs,
          },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.description,
          {
            color: colors.textSecondary,
            fontSize: typography.fontSizes.body,
            marginBottom: actionTitle ? spacing.lg : 0,
          },
        ]}
      >
        {description}
      </Text>

      {actionTitle && onAction ? (
        <View style={styles.buttonWrapper}>
          <PrimaryButton title={actionTitle} onPress={onAction} style={styles.button} />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    opacity: 0.8,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    textAlign: 'center',
  },
  description: {
    fontFamily: 'PlusJakartaSans_500Medium',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  buttonWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    minWidth: 160,
    alignSelf: 'center',
  },
});
