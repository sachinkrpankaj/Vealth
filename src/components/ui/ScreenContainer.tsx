import React from 'react';
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { AppBackground } from './AppBackground';
import { KeyboardAwareScrollView } from './KeyboardAwareScrollView';

interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  withTopInset?: boolean;
  withBottomInset?: boolean;
  hasTabBar?: boolean;
  extraScrollHeight?: number;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  scrollable = false,
  style,
  contentContainerStyle,
  withTopInset = true,
  withBottomInset = true,
  hasTabBar = false,
  extraScrollHeight = 100,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Calculate bottom clearance so floating tab bar or system navigation bar never obscures content
  const flattenedContent = StyleSheet.flatten(contentContainerStyle) || {};
  const customPaddingBottom =
    typeof flattenedContent.paddingBottom === 'number' ? flattenedContent.paddingBottom : 0;
  // The floating dock is 62 px high and sits at least 22 px above the system inset.
  // Reserve its full height plus a small gap even when a tab screen supplies custom padding.
  const baseBottomClearance = hasTabBar
    ? Math.max(insets.bottom + 12, 22) + 62 + 20
    : withBottomInset
    ? insets.bottom + 24
    : 20;
  const finalBottomClearance = Math.max(baseBottomClearance, customPaddingBottom);

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: withTopInset ? insets.top : 0,
    paddingBottom: withBottomInset && !scrollable && !hasTabBar ? insets.bottom : 0,
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <AppBackground />
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        {scrollable ? (
          <KeyboardAwareScrollView
            style={[styles.scroll, style]}
            contentContainerStyle={[
              styles.content,
              contentContainerStyle,
              { paddingBottom: finalBottomClearance },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            extraScrollHeight={extraScrollHeight}
          >
            {children}
          </KeyboardAwareScrollView>
        ) : (
          <View
            style={[
              styles.staticContent,
              hasTabBar ? { paddingBottom: insets.bottom + 96 } : undefined,
              style,
            ]}
          >
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  staticContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
});
