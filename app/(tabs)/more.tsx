import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import {
  Wallet,
  Building2,
  ShieldAlert,
  Users,
  LineChart,
  PieChart,
  Settings,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  User,
  Layers,
} from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { AppHeader } from '../../src/components/navigation/AppHeader';
import { VealthLogo } from '../../src/components/ui/VealthLogo';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { useTheme } from '../../src/theme';
import * as Haptics from 'expo-haptics';

export default function MoreScreen() {
  const { colors, typography, isDark } = useTheme();

  const financeSections = [
    {
      title: 'Accounts & Wallets',
      subtitle: 'Cash, Bank, Credit Cards & Investments',
      icon: Wallet,
      color: '#3B82F6',
      route: '/accounts',
    },
    {
      title: 'Assets',
      subtitle: 'Gold, Real Estate, Vehicles & Valuables',
      icon: Building2,
      color: '#10B981',
      route: '/assets',
    },
    {
      title: 'Liabilities',
      subtitle: 'Personal loans & Outstanding obligations',
      icon: ShieldAlert,
      color: '#F43F5E',
      route: '/liabilities',
    },
    {
      title: 'People Directory',
      subtitle: 'Contacts and individual debt books',
      icon: Users,
      color: '#8B5CF6',
      route: '/people',
    },
  ];

  const analyticsSections = [
    {
      title: 'Spending Insights',
      subtitle: 'Yearly & monthly trends, category drill-down',
      icon: Layers,
      color: '#F43F5E',
      route: '/spending-insights',
    },
    {
      title: 'Net Worth Trajectory',
      subtitle: 'Historical growth curve & asset ratios',
      icon: LineChart,
      color: '#D4A373',
      route: '/net-worth',
    },
    {
      title: 'Financial Analytics',
      subtitle: 'Cash flow & top spending categories',
      icon: PieChart,
      color: '#7E69AB',
      route: '/analytics',
    },
  ];

  const appSections = [
    {
      title: 'Profile & Personalization',
      subtitle: 'Name, theme mode & portfolio summary',
      icon: User,
      color: '#6366F1',
      route: '/profile',
    },
    {
      title: 'Settings & Security',
      subtitle: 'PIN lock, Biometrics, Backups & Appearance',
      icon: Settings,
      color: '#8E8D9E',
      route: '/settings',
    },
    {
      title: 'Developer & Demo Portfolio',
      subtitle: 'Load sample data or reset database',
      icon: Sparkles,
      color: '#D4A373',
      route: '/settings/demo',
    },
  ];

  const renderSectionItem = (item: any) => {
    const Icon = item.icon;
    return (
      <Pressable
        key={item.title}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push(item.route as any);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${item.subtitle}`}
        style={({ pressed }) => [
          styles.itemRow,
          {
            minHeight: 56,
            opacity: pressed ? 0.75 : 1,
            backgroundColor: pressed
              ? isDark
                ? 'rgba(255, 255, 255, 0.04)'
                : 'rgba(0, 0, 0, 0.02)'
              : 'transparent',
          },
        ]}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: `${item.color}18`,
              borderColor: `${item.color}30`,
            },
          ]}
        >
          <Icon size={19} color={item.color} strokeWidth={2.2} />
        </View>

        <View style={styles.itemText}>
          <Text
            style={[
              styles.itemTitle,
              {
                color: colors.textPrimary,
                fontFamily: typography.fontFamilies.bold,
              },
            ]}
          >
            {item.title}
          </Text>
          <Text
            style={[
              styles.itemSubtitle,
              {
                color: colors.textSecondary,
                fontFamily: typography.fontFamilies.medium,
              },
            ]}
          >
            {item.subtitle}
          </Text>
        </View>

        <ChevronRight size={17} color={colors.textMuted} />
      </Pressable>
    );
  };

  return (
    <ScreenContainer scrollable hasTabBar contentContainerStyle={styles.scrollContent}>
      {/* 1. Header (matching Reference Image 1) */}
      <AppHeader
        title="more"
        onProfilePress={() => router.push('/profile')}
        onRightPress={() => router.push('/settings/security')}
        rightAccessibilityLabel="Security settings"
        rightIcon={<ShieldCheck size={18} color={colors.textPrimary} strokeWidth={2.2} />}
      />

      {/* Portfolio & Accounts */}
      <View style={styles.sectionHeaderRow}>
        <Text
          style={[
            styles.sectionHeaderTitle,
            {
              color: colors.textSecondary,
              fontFamily: typography.fontFamilies.semibold,
            },
          ]}
        >
          PORTFOLIO & ACCOUNTS
        </Text>
      </View>
      <LiquidGlassCard style={styles.cardGroup} radius={20} padding={0}>
        {financeSections.map((item, idx) => (
          <React.Fragment key={item.title}>
            {renderSectionItem(item)}
            {idx < financeSections.length - 1 && (
              <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
            )}
          </React.Fragment>
        ))}
      </LiquidGlassCard>

      {/* Analytics & Trends */}
      <View style={styles.sectionHeaderRow}>
        <Text
          style={[
            styles.sectionHeaderTitle,
            {
              color: colors.textSecondary,
              fontFamily: typography.fontFamilies.semibold,
            },
          ]}
        >
          ANALYTICS & TRENDS
        </Text>
      </View>
      <LiquidGlassCard style={styles.cardGroup} radius={20} padding={0}>
        {analyticsSections.map((item, idx) => (
          <React.Fragment key={item.title}>
            {renderSectionItem(item)}
            {idx < analyticsSections.length - 1 && (
              <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
            )}
          </React.Fragment>
        ))}
      </LiquidGlassCard>

      {/* App & Preferences */}
      <View style={styles.sectionHeaderRow}>
        <Text
          style={[
            styles.sectionHeaderTitle,
            {
              color: colors.textSecondary,
              fontFamily: typography.fontFamilies.semibold,
            },
          ]}
        >
          APP & PREFERENCES
        </Text>
      </View>
      <LiquidGlassCard style={styles.cardGroup} radius={20} padding={0}>
        {appSections.map((item, idx) => (
          <React.Fragment key={item.title}>
            {renderSectionItem(item)}
            {idx < appSections.length - 1 && (
              <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
            )}
          </React.Fragment>
        ))}
      </LiquidGlassCard>

      {/* Brand Footer */}
      <View style={styles.footerBrand}>
        <VealthLogo size={42} />
        <Text
          style={[
            styles.footerTitle,
            {
              color: colors.textPrimary,
              fontFamily: typography.fontFamilies.bold,
            },
          ]}
        >
          vaelth
        </Text>
        <Text
          style={[
            styles.footerVersion,
            { color: colors.textMuted, fontFamily: typography.fontFamilies.medium },
          ]}
        >
          Private Offline Financial Vault • v1.0.0
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  sectionHeaderRow: {
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
  cardGroup: {
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
  itemSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginLeft: 68,
  },
  footerBrand: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 20,
  },
  footerTitle: {
    fontSize: 17,
    letterSpacing: -0.3,
    marginTop: 8,
  },
  footerVersion: {
    fontSize: 11,
    marginTop: 2,
  },
});
