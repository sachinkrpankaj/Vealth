import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Moon,
  Sun,
  Shield,
  Download,
  Sparkles,
  Info,
  ChevronRight,
} from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { VealthLogo } from '../../src/components/ui/VealthLogo';
import { useTheme } from '../../src/theme';
import { typography } from '../../src/theme/typography';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { setSetting } from '../../src/database/repositories/settingsRepository';

export default function SettingsIndexScreen() {
  const { colors, typography, radii, spacing, isDark } = useTheme();
  const { themeMode, setThemeMode } = useThemeStore();

  return (
    <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        <LiquidGlassCard onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back"
          radius={radii.full} padding={0} style={styles.iconBtn}>
          <ArrowLeft size={18} color={colors.textPrimary} />
        </LiquidGlassCard>

        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>

        <View style={{ width: 36 }} />
      </View>

      {/* Appearance & Theme */}
      <SectionHeader title="Appearance" />
      <Card style={styles.cardGroup}>
        <View style={[styles.row, { paddingVertical: spacing.md }]}>
          <View style={styles.rowLeft}>
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: colors.surfaceSubtle, borderRadius: radii.sm },
              ]}
            >
              {isDark ? (
                <Moon size={20} color={colors.textPrimary} />
              ) : (
                <Sun size={20} color={colors.textPrimary} />
              )}
            </View>
            <View>
              <Text
                style={[
                  styles.rowTitle,
                  { color: colors.textPrimary, fontSize: typography.fontSizes.body },
                ]}
              >
                Theme Mode
              </Text>
              <Text
                style={[
                  styles.rowSub,
                  { color: colors.textMuted, fontSize: typography.fontSizes.caption },
                ]}
              >
                {themeMode === 'dark' ? 'Dark Mode' : themeMode === 'light' ? 'Light Mode' : 'System Default'}
              </Text>
            </View>
          </View>

          {/* Theme Mode Toggle Pills */}
          <View style={styles.pillGroup}>
            {(['dark', 'light'] as const).map((m) => (
              <LiquidGlassCard
                key={m}
                onPress={() => {
                  setThemeMode(m);
                  setSetting('theme_mode', m).catch(() => {});
                }}
                accessibilityLabel={`${m} theme`}
                accessibilityState={{ selected: themeMode === m }}
                tone={themeMode === m ? 'emphasized' : 'default'}
                radius={radii.sm} padding={0} style={styles.themePill}
              >
                <Text
                  style={[
                    styles.themePillText,
                    { color: themeMode === m ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </Text>
              </LiquidGlassCard>
            ))}
          </View>
        </View>
      </Card>

      {/* Security & Privacy */}
      <SectionHeader title="Security & Privacy" />
      <Card style={styles.cardGroup}>
        <Pressable
          onPress={() => router.push('/settings/security')}
          style={({ pressed }) => [
            styles.row,
            { paddingVertical: spacing.md, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <View style={styles.rowLeft}>
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: 'rgba(99, 102, 241, 0.15)', borderRadius: radii.sm },
              ]}
            >
              <Shield size={20} color="#6366F1" />
            </View>
            <View>
              <Text
                style={[
                  styles.rowTitle,
                  { color: colors.textPrimary, fontSize: typography.fontSizes.body },
                ]}
              >
                App Security & PIN Lock
              </Text>
              <Text
                style={[
                  styles.rowSub,
                  { color: colors.textMuted, fontSize: typography.fontSizes.caption },
                ]}
              >
                4-digit PIN and Biometric authentication
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </Pressable>
      </Card>

      {/* Data Management */}
      <SectionHeader title="Data & Backup" />
      <Card style={styles.cardGroup}>
        <Pressable
          onPress={() => router.push('/settings/backup')}
          style={({ pressed }) => [
            styles.row,
            { paddingVertical: spacing.md, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <View style={styles.rowLeft}>
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderRadius: radii.sm },
              ]}
            >
              <Download size={20} color="#10B981" />
            </View>
            <View>
              <Text
                style={[
                  styles.rowTitle,
                  { color: colors.textPrimary, fontSize: typography.fontSizes.body },
                ]}
              >
                Backup & Export Data
              </Text>
              <Text
                style={[
                  styles.rowSub,
                  { color: colors.textMuted, fontSize: typography.fontSizes.caption },
                ]}
              >
                Export CSV or restore JSON backups
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </Pressable>

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        <Pressable
          onPress={() => router.push('/settings/demo')}
          style={({ pressed }) => [
            styles.row,
            { paddingVertical: spacing.md, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <View style={styles.rowLeft}>
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: 'rgba(236, 72, 153, 0.15)', borderRadius: radii.sm },
              ]}
            >
              <Sparkles size={20} color="#EC4899" />
            </View>
            <View>
              <Text
                style={[
                  styles.rowTitle,
                  { color: colors.textPrimary, fontSize: typography.fontSizes.body },
                ]}
              >
                Demo Portfolio Tools
              </Text>
              <Text
                style={[
                  styles.rowSub,
                  { color: colors.textMuted, fontSize: typography.fontSizes.caption },
                ]}
              >
                Seed sample financial data or reset database
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </Pressable>
      </Card>

      {/* About vealth */}
      <SectionHeader title="About" />
      <Card style={styles.aboutCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <VealthLogo size={28} style={{ marginRight: 10 }} />
          <Text style={[styles.aboutTitle, { color: colors.textPrimary }]}>vealth v1.0.0</Text>
        </View>
        <Text style={[styles.aboutDesc, { color: colors.textSecondary }]}>
          vealth is a private, offline-first personal finance and net-worth tracking mobile application. All data is saved on-device with zero cloud telemetry.
        </Text>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: typography.fontFamilies.bold,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cardGroup: {
    paddingVertical: 0,
    paddingHorizontal: 16,
    marginBottom: 8,
    marginHorizontal: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowTitle: {
    fontFamily: typography.fontFamilies.semibold,
    marginBottom: 2,
  },
  rowSub: {
    fontFamily: typography.fontFamilies.regular,
  },
  pillGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  themePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  themePillText: {
    fontSize: 12,
    fontFamily: typography.fontFamilies.semibold,
  },
  divider: {
    height: 1,
  },
  aboutCard: {
    padding: 16,
    marginHorizontal: 0,
  },
  aboutTitle: {
    fontSize: 14,
    fontFamily: typography.fontFamilies.bold,
  },
  aboutDesc: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.fontFamilies.regular,
  },
});
