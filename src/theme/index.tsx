import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { useColorScheme, Platform } from 'react-native';
let NavigationBar: typeof import('expo-navigation-bar') | null = null;
try {
  NavigationBar = require('expo-navigation-bar');
} catch {}
import { ColorTokens, darkColors, lightColors } from './colors';
import { typography } from './typography';
import { spacing, radii } from './spacing';
import { useThemeStore } from '../stores/useThemeStore';

export interface Theme {
  isDark: boolean;
  colors: ColorTokens;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
}

const ThemeContext = createContext<Theme>({
  isDark: true,
  colors: darkColors,
  typography,
  spacing,
  radii,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const themeMode = useThemeStore((state) => state.themeMode);

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemScheme]);

  const theme = useMemo<Theme>(() => ({
    isDark,
    colors: isDark ? darkColors : lightColors,
    typography,
    spacing,
    radii,
  }), [isDark]);

  useEffect(() => {
    if (Platform.OS === 'android' && NavigationBar) {
      try {
        NavigationBar.setStyle?.(isDark ? 'dark' : 'light');
        if (typeof (NavigationBar as any).setBackgroundColorAsync === 'function') {
          (NavigationBar as any).setBackgroundColorAsync(isDark ? '#090A0E' : '#F4F6FB').catch(() => {});
        }
      } catch {}
    }
  }, [isDark]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): Theme => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export * from './colors';
export * from './typography';
export * from './spacing';
