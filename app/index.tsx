import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { getSetting } from '../src/database/repositories/settingsRepository';
import { useTheme } from '../src/theme';
import { VealthLogo } from '../src/components/ui/VealthLogo';

export default function Index() {
  const { colors, typography, spacing } = useTheme();
  const [targetRoute, setTargetRoute] = useState<string | null>(null);

  useEffect(() => {
    async function determineRoute() {
      try {
        const completed = await getSetting('onboarding_completed');
        if (completed === 'true') {
          setTargetRoute('/(tabs)/home');
        } else {
          setTargetRoute('/onboarding');
        }
      } catch {
        setTargetRoute('/onboarding');
      }
    }
    determineRoute();
  }, []);

  if (!targetRoute) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <VealthLogo size={72} />
        <Text style={[styles.brandTitle, { color: colors.textPrimary, marginTop: spacing.md }]}>
          Vaelth
        </Text>
        <Text style={[styles.brandSubtitle, { color: colors.textSecondary, marginBottom: spacing.xl }]}>
          Private Personal Finance & Net Worth
        </Text>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  return <Redirect href={targetRoute as any} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    marginTop: 4,
  },
});
