import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  LayoutAnimation,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Home, HandCoins, ArrowLeftRight, SlidersHorizontal, ShoppingBag } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';

export interface FloatingTabBarProps {
  state: {
    index: number;
    routes: Array<{
      key: string;
      name: string;
      params?: any;
    }>;
  };
  descriptors: Record<string, any>;
  navigation: {
    emit: (event: any) => any;
    navigate: (name: string, params?: any) => void;
  };
  insets?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

const TAB_ICONS: Record<
  string,
  React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
> = {
  home: Home,
  transactions: ArrowLeftRight,
  money: HandCoins,
  shopping: ShoppingBag,
  more: SlidersHorizontal,
};

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  state,
  navigation,
  insets,
}) => {
  const { colors, isDark } = useTheme();
  const bottomInset = insets?.bottom ?? (Platform.OS === 'ios' ? 24 : 16);

  const handleTabPress = (routeName: string, routeKey: string, isFocused: boolean) => {
    LayoutAnimation.configureNext({
      duration: 200,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.spring,
        springDamping: 0.85,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const event = navigation.emit({
      type: 'tabPress',
      target: routeKey,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.outerContainer,
        {
          bottom: Platform.OS === 'ios' ? Math.max(bottomInset, 18) : Math.max(bottomInset + 12, 22),
        },
      ]}
    >
      <LiquidGlassCard
        contentStyle={styles.dockCapsule}
        radius={28}
        padding={6}
        showPrism
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const IconComponent = TAB_ICONS[route.name] || Home;

          const tabLabel = route.name.charAt(0).toUpperCase() + route.name.slice(1);

          return (
            <Pressable
              key={route.key}
              onPress={() => handleTabPress(route.name, route.key, isFocused)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={`${tabLabel} tab`}
              style={({ pressed }) => [
                styles.squircleButton,
                isFocused
                  ? [
                      styles.activeSquircle,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : colors.accent,
                        borderColor: isDark ? colors.border : 'transparent',
                      },
                    ]
                  : styles.inactiveSquircle,
                {
                  transform: [{ scale: pressed ? 0.92 : 1 }],
                },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <IconComponent
                size={21}
                color={
                  isFocused
                    ? isDark
                      ? colors.accent
                      : '#FFFFFF'
                    : isDark
                    ? colors.textMuted
                    : colors.textSecondary
                }
                strokeWidth={isFocused ? 2.5 : 2.0}
              />
            </Pressable>
          );
        })}
      </LiquidGlassCard>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  dockCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  squircleButton: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  activeSquircle: {
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  inactiveSquircle: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    elevation: 0,
  },
});

