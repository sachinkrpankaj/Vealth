import React, { useEffect } from 'react';
import { AppState, ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// Strip debug verbose logs in production while preserving error observability
if (!__DEV__) {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../src/theme';
import { SecurityLockScreen } from '../src/components/security/SecurityLockScreen';
import { GlobalThemedDialog } from '../src/components/ui/ThemedDialog';
import { useSecurityStore } from '../src/stores/useSecurityStore';
import { useThemeStore, ThemeMode } from '../src/stores/useThemeStore';
import { getDatabase } from '../src/database/db';
import { getSetting, setSetting } from '../src/database/repositories/settingsRepository';

import { useFonts } from 'expo-font';

function RootStack() {
  const { colors, isDark } = useTheme();
  const checkSecurityConfig = useSecurityStore((state) => state.checkSecurityConfig);
  const hasCheckedAuth = useSecurityStore((state) => state.hasCheckedAuth);
  const setThemeMode = useThemeStore((state) => state.setThemeMode);

  useEffect(() => {
    // Re-lock Vaelth whenever the app transitions to background or inactive state
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        useSecurityStore.getState().lock();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    getDatabase().then(async () => {
      try {
        const savedTheme = await getSetting('theme_mode');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setThemeMode(savedTheme);
        } else {
          setThemeMode('dark');
        }
      } catch (err) {
        console.warn('Failed to load theme preference:', err);
      }
    }).catch((e) => console.error('Failed to init DB:', e));

    checkSecurityConfig().catch((e) => console.error('Failed to check security:', e));
  }, []);

  // Do not mount financial screens until the secure PIN state has been checked.
  if (!hasCheckedAuth) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const modalScreenOptions = {
    presentation: 'modal' as const,
    animation: 'slide_from_bottom' as const,
    animationDuration: 300,
    gestureEnabled: true,
  };

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
          animationDuration: 300,
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade', animationDuration: 280 }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="transaction/add" options={modalScreenOptions} />
        <Stack.Screen name="transaction/[id]" />
        <Stack.Screen name="people/index" />
        <Stack.Screen name="people/add" options={modalScreenOptions} />
        <Stack.Screen name="people/[id]" />
        <Stack.Screen name="accounts/index" />
        <Stack.Screen name="accounts/add" options={modalScreenOptions} />
        <Stack.Screen name="accounts/[id]" />
        <Stack.Screen name="assets/index" />
        <Stack.Screen name="assets/add" options={modalScreenOptions} />
        <Stack.Screen name="liabilities/index" />
        <Stack.Screen name="liabilities/add" options={modalScreenOptions} />
        <Stack.Screen name="net-worth/index" />
        <Stack.Screen name="analytics/index" />
        <Stack.Screen name="spending-insights/index" />
        <Stack.Screen name="shopping/[id]" />
        <Stack.Screen name="profile/index" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/security" />
        <Stack.Screen name="settings/backup" />
        <Stack.Screen name="settings/demo" />
      </Stack>
      <SecurityLockScreen />
      <GlobalThemedDialog />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular: require('@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf'),
    PlusJakartaSans_500Medium: require('@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf'),
    PlusJakartaSans_600SemiBold: require('@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf'),
    PlusJakartaSans_700Bold: require('@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf'),
    PlusJakartaSans_800ExtraBold: require('@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf'),
  });

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootStack />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
