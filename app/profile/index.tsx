import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Settings as SettingsIcon,
  User,
  Pencil,
  Check,
  X,
  Moon,
  Sun,
  Wallet,
  Landmark,
  Gem,
  ShieldAlert,
  Plus,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  TrendingUp,
  PiggyBank,
  CircleDot,
} from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { AmountText } from '../../src/components/ui/AmountText';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { useTheme } from '../../src/theme';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { setSetting } from '../../src/database/repositories/settingsRepository';
import { formatRupee } from '../../src/domain/finance/currency';
import { getCreditCardBillingInfo } from '../../src/domain/finance/creditCardBilling';
import {
  calculateTotalPhysicalAssets,
  calculateTotalStandaloneLiabilities,
} from '../../src/domain/finance/financialEngine';

export default function ProfileScreen() {
  const { colors, isDark, typography, radii, spacing } = useTheme();
  const { themeMode, setThemeMode } = useThemeStore();
  const {
    userName,
    accounts,
    accountBalances,
    transactions,
    physicalAssets,
    standaloneLiabilities,
    netWorth,
    refresh,
  } = useFinancialData();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userName || '');
  const [isSavingName, setIsSavingName] = useState(false);

  // Sync state when userName is loaded/refreshed
  useEffect(() => {
    if (!isEditingName) {
      setNameInput(userName || '');
    }
  }, [userName, isEditingName]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    try {
      setIsSavingName(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await setSetting('user_name', trimmed);
      await refresh();
      setIsEditingName(false);
    } catch {
      // Fallback
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancelEdit = () => {
    setNameInput(userName || '');
    setIsEditingName(false);
  };

  const handleThemeChange = async (mode: 'dark' | 'light') => {
    Haptics.selectionAsync().catch(() => {});
    setThemeMode(mode);
    try {
      await setSetting('theme_mode', mode);
    } catch {
      // Best effort
    }
  };

  // Asset & liability aggregate figures (excluding archived items to match Net Worth)
  const totalAssetValuation = calculateTotalPhysicalAssets(physicalAssets, undefined, transactions);
  const totalLiabilityValuation = calculateTotalStandaloneLiabilities(standaloneLiabilities, accounts);

  // Initial letter for avatar
  const avatarLetter = (userName || 'V').charAt(0).toUpperCase();

  return (
    <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 140 }}>
        {/* 1. Header Row */}
        <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
          <LiquidGlassCard
            radius={19}
            padding={9}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.headerBtn}
          >
            <ArrowLeft size={18} color={colors.textPrimary} strokeWidth={2.2} />
          </LiquidGlassCard>

          <Text
            style={[
              styles.headerTitle,
              {
                color: colors.textPrimary,
                fontFamily: typography.fontFamilies.bold,
              },
            ]}
          >
            Profile
          </Text>

          <LiquidGlassCard
            radius={19}
            padding={9}
            onPress={() => router.push('/settings')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={styles.headerBtn}
          >
            <SettingsIcon size={18} color={colors.textPrimary} strokeWidth={2.2} />
          </LiquidGlassCard>
        </View>

        {/* 2. Hero Identity Card with Inline Name Editor */}
        <LiquidGlassCard style={styles.heroCard} radius={radii.xl} padding={spacing.lg}>
          <View style={styles.avatarRow}>
            {/* Avatar with luminous frosted ring */}
            <View
              style={[
                styles.avatarCircle,
                {
                  backgroundColor: isDark ? 'rgba(129, 140, 248, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                  borderColor: isDark ? 'rgba(129, 140, 248, 0.25)' : 'rgba(99, 102, 241, 0.40)',
                },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  {
                    color: isDark ? colors.accent : '#6366F1',
                    fontFamily: typography.fontFamilies.bold,
                  },
                ]}
              >
                {avatarLetter}
              </Text>
            </View>

            {/* Name / Editing Block */}
            <View style={styles.identityDetails}>
              {isEditingName ? (
                <View style={styles.editInputRow}>
                  <TextInput
                    value={nameInput}
                    onChangeText={setNameInput}
                    placeholder="Enter your name"
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                    maxLength={30}
                    style={[
                      styles.nameTextInput,
                      {
                        color: colors.textPrimary,
                        backgroundColor: isDark ? colors.surfaceSubtle : 'rgba(255, 255, 255, 0.90)',
                        borderColor: isDark ? colors.border : colors.accent,
                        fontFamily: typography.fontFamilies.bold,
                      },
                    ]}
                  />
                  <LiquidGlassCard onPress={handleSaveName} disabled={isSavingName}
                    accessibilityLabel="Save name" accessibilityState={{ disabled: isSavingName }}
                    tone="positive" radius={radii.full} padding={0} style={styles.actionIconBtn}>
                    <Check size={16} color="#FFFFFF" strokeWidth={3} />
                  </LiquidGlassCard>
                  <LiquidGlassCard onPress={handleCancelEdit} accessibilityLabel="Cancel name edit"
                    radius={radii.full} padding={0} style={styles.actionIconBtn}>
                    <X size={16} color={colors.textSecondary} strokeWidth={2.5} />
                  </LiquidGlassCard>
                </View>
              ) : (
                <View style={styles.nameDisplayRow}>
                  <Text
                    style={[
                      styles.userNameText,
                      {
                        color: colors.textPrimary,
                        fontFamily: typography.fontFamilies.bold,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {userName || 'Vault Owner'}
                  </Text>
                  <LiquidGlassCard
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setIsEditingName(true);
                    }}
                    accessibilityLabel="Edit name" hitSlop={8}
                    radius={radii.full} padding={0} style={styles.editPillBtn}
                  >
                    <Pencil
                      size={12}
                      color={isDark ? colors.textSecondary : '#4F46E5'}
                      strokeWidth={2.2}
                    />
                    <Text
                      style={[
                        styles.editPillText,
                        {
                          color: isDark ? colors.textSecondary : '#4F46E5',
                          fontFamily: typography.fontFamilies.semibold,
                        },
                      ]}
                    >
                      Edit
                    </Text>
                  </LiquidGlassCard>
                </View>
              )}

              <View style={styles.membershipRow}>
                <ShieldCheck size={13} color={colors.positive} strokeWidth={2.2} />
                <Text
                  style={[
                    styles.membershipText,
                    {
                      color: colors.textSecondary,
                      fontFamily: typography.fontFamilies.medium,
                    },
                  ]}
                >
                  Private Portfolio • Stored On Device
                </Text>
              </View>
            </View>
          </View>
        </LiquidGlassCard>

        {/* 3. Appearance & Theme Switcher (Dark vs. Light) */}
        <SectionHeader title="Appearance & Theme" />
        <LiquidGlassCard style={styles.themeCard} radius={radii.xl} padding={10}>
          <View style={styles.themeOptionsGrid}>
            {/* Dark Mode Option */}
            <Pressable
              onPress={() => handleThemeChange('dark')}
              accessibilityRole="button"
              accessibilityLabel="Dark Obsidian theme"
              accessibilityState={{ selected: isDark }}
              style={({ pressed }) => [
                styles.themeOptionTile,
                {
                  borderRadius: radii.lg,
                  backgroundColor: isDark
                    ? 'rgba(129, 140, 248, 0.08)'
                    : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? colors.accent : colors.border,
                  borderWidth: isDark ? 1.5 : 1,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.themeIconWrap,
                  {
                    backgroundColor: isDark
                      ? 'rgba(129, 140, 248, 0.16)'
                      : 'rgba(0, 0, 0, 0.05)',
                  },
                ]}
              >
                <Moon size={18} color={isDark ? colors.accent : colors.textMuted} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.themeTileTitle,
                    {
                      color: colors.textPrimary,
                      fontFamily: typography.fontFamilies.bold,
                    },
                  ]}
                >
                  Dark Obsidian
                </Text>
                <Text
                  style={[
                    styles.themeTileSub,
                    {
                      color: colors.textMuted,
                      fontFamily: typography.fontFamilies.medium,
                    },
                  ]}
                >
                  Private & battery-saving
                </Text>
              </View>
              {isDark && (
                <View style={[styles.activeCheckCircle, { backgroundColor: colors.accent }]}>
                  <Check size={12} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
            </Pressable>

            {/* Light Mode Option */}
            <Pressable
              onPress={() => handleThemeChange('light')}
              accessibilityRole="button"
              accessibilityLabel="Clean Light theme"
              accessibilityState={{ selected: !isDark }}
              style={({ pressed }) => [
                styles.themeOptionTile,
                {
                  borderRadius: radii.lg,
                  backgroundColor: !isDark
                    ? 'rgba(79, 70, 229, 0.08)'
                    : 'rgba(255, 255, 255, 0.03)',
                  borderColor: !isDark ? colors.accent : colors.border,
                  borderWidth: !isDark ? 1.5 : 1,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.themeIconWrap,
                  {
                    backgroundColor: !isDark
                      ? '#FEF3C7'
                      : 'rgba(255, 255, 255, 0.05)',
                  },
                ]}
              >
                <Sun size={18} color={!isDark ? '#D97706' : colors.textMuted} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.themeTileTitle,
                    {
                      color: colors.textPrimary,
                      fontFamily: typography.fontFamilies.bold,
                    },
                  ]}
                >
                  Clean Light
                </Text>
                <Text
                  style={[
                    styles.themeTileSub,
                    {
                      color: colors.textMuted,
                      fontFamily: typography.fontFamilies.medium,
                    },
                  ]}
                >
                  Bright, modern liquid glass
                </Text>
              </View>
              {!isDark && (
                <View style={[styles.activeCheckCircle, { backgroundColor: colors.accent }]}>
                  <Check size={12} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
            </Pressable>
          </View>
        </LiquidGlassCard>

        {/* 4. Bank Accounts & Cash Wallets Section */}
        <SectionHeader
          title="Bank Accounts & Wallets"
          actionText="Manage All"
          onAction={() => router.push('/accounts')}
        />
        <LiquidGlassCard style={styles.groupCard} radius={radii.xl} padding={0}>
          {accounts.length === 0 ? (
            <View style={styles.emptyAccountsRow}>
              <View
                style={[
                  styles.emptyAccountsIconCircle,
                  { backgroundColor: isDark ? 'rgba(99,102,241,0.16)' : 'rgba(99,102,241,0.10)' },
                ]}
              >
                <Wallet size={22} color="#6366F1" strokeWidth={2.2} />
              </View>
              <Text
                style={[
                  styles.emptyAccountsText,
                  {
                    color: colors.textPrimary,
                    fontFamily: typography.fontFamilies.bold,
                  },
                ]}
              >
                No accounts recorded yet
              </Text>
              <Text
                style={[
                  styles.emptyAccountsSubtext,
                  {
                    color: colors.textMuted,
                    fontFamily: typography.fontFamilies.medium,
                  },
                ]}
              >
                Add your bank, cash wallets or investment accounts
              </Text>
              <LiquidGlassCard onPress={() => router.push('/accounts/add')}
                accessibilityLabel="Add account" tone="emphasized"
                radius={radii.full} padding={0} style={styles.addAccountBtn}>
                <Plus size={14} color="#FFFFFF" strokeWidth={2.8} />
                <Text
                  style={[
                    styles.addAccountBtnText,
                    {
                      color: '#FFFFFF',
                      fontFamily: typography.fontFamilies.bold,
                    },
                  ]}
                >
                  Add Account
                </Text>
              </LiquidGlassCard>
            </View>
          ) : (
            accounts.map((acc, index) => {
              const balance = accountBalances.get(acc.id) ?? acc.openingBalance;
              const isBank = acc.type === 'BANK';
              const isCash = acc.type === 'CASH';
              const isCC = acc.type === 'CREDIT_CARD';
              const isInvest = acc.type === 'INVESTMENT';

              const IconComponent = isBank
                ? Landmark
                : isCash
                ? Wallet
                : isCC
                ? CreditCard
                : isInvest
                ? TrendingUp
                : CircleDot;

              const badgeColor = isBank
                ? '#6366F1'
                : isCash
                ? '#10B981'
                : isCC
                ? '#EC4899'
                : isInvest
                ? '#F59E0B'
                : '#64748B';

              const badgeBg = isBank
                ? 'rgba(99, 102, 241, 0.12)'
                : isCash
                ? 'rgba(16, 185, 129, 0.12)'
                : isCC
                ? 'rgba(236, 72, 153, 0.12)'
                : isInvest
                ? 'rgba(245, 158, 11, 0.12)'
                : 'rgba(100, 116, 139, 0.12)';

              const ccInfo = isCC ? getCreditCardBillingInfo(acc, transactions) : null;
              const isLast = index === accounts.length - 1;

              return (
                <Pressable
                  key={acc.id}
                  onPress={() => router.push(`/accounts/${acc.id}`)}
                  style={({ pressed }) => [
                    styles.accountItemRow,
                    !isLast && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.borderSubtle,
                    },
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <View
                    style={[
                      styles.accountIconBadge,
                      {
                        backgroundColor: badgeBg,
                        borderRadius: radii.md,
                      },
                    ]}
                  >
                    <IconComponent
                      size={18}
                      color={badgeColor}
                      strokeWidth={2.2}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={[
                        styles.accountItemName,
                        {
                          color: colors.textPrimary,
                          fontFamily: typography.fontFamilies.semibold,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {acc.name}
                    </Text>
                    <Text
                      style={[
                        styles.accountItemType,
                        {
                          color: colors.textMuted,
                          fontFamily: typography.fontFamilies.medium,
                        },
                      ]}
                    >
                      {isBank
                        ? 'Bank Account'
                        : isCash
                        ? 'Cash Wallet'
                        : isCC
                        ? 'Credit Card'
                        : isInvest
                        ? 'Investment'
                        : 'Other Account'}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    {isCC && ccInfo ? (
                      <>
                        <AmountText
                          amount={ccInfo.remainingLimit}
                          size="bodyLg"
                          variant="default"
                        />
                        <Text
                          style={{
                            fontSize: 10,
                            color: colors.textMuted,
                            fontFamily: typography.fontFamilies.medium,
                            marginTop: 1,
                          }}
                        >
                          Remaining
                        </Text>
                      </>
                    ) : (
                      <AmountText
                        amount={balance}
                        size="bodyLg"
                        variant={balance < 0 ? 'negative' : 'default'}
                      />
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </LiquidGlassCard>

        {/* 5. Assets & Liabilities Bento Cards */}
        <SectionHeader title="Assets & Liabilities" />
        <View style={styles.bentoRow}>
          {/* Valuable Assets Bento Tile */}
          <LiquidGlassCard
            style={styles.bentoTile}
            radius={radii.xl}
            padding={spacing.md}
            onPress={() => router.push('/assets')}
          >
            <View style={styles.bentoTileTop}>
              <View
                style={[
                  styles.bentoIconBadge,
                  {
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    borderRadius: radii.md,
                  },
                ]}
              >
                <Gem size={18} color="#10B981" strokeWidth={2.2} />
              </View>
              <ChevronRight size={16} color={colors.textMuted} />
            </View>

            <Text
              style={[
                styles.bentoLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamilies.medium,
                },
              ]}
            >
              Valuable Assets
            </Text>

            <AmountText
              amount={totalAssetValuation}
              size="bodyLg"
              style={{ marginVertical: 2 }}
            />

            <Text
              style={[
                styles.bentoCount,
                {
                  color: colors.textMuted,
                  fontFamily: typography.fontFamilies.medium,
                },
              ]}
            >
              {physicalAssets.length} recorded items
            </Text>
          </LiquidGlassCard>

          {/* Liabilities & Debt Bento Tile */}
          <LiquidGlassCard
            style={styles.bentoTile}
            radius={radii.xl}
            padding={spacing.md}
            onPress={() => router.push('/liabilities')}
          >
            <View style={styles.bentoTileTop}>
              <View
                style={[
                  styles.bentoIconBadge,
                  {
                    backgroundColor: 'rgba(244, 63, 94, 0.12)',
                    borderRadius: radii.md,
                  },
                ]}
              >
                <ShieldAlert size={18} color="#F43F5E" strokeWidth={2.2} />
              </View>
              <ChevronRight size={16} color={colors.textMuted} />
            </View>

            <Text
              style={[
                styles.bentoLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamilies.medium,
                },
              ]}
            >
              Liabilities & Debt
            </Text>

            <AmountText
              amount={totalLiabilityValuation}
              size="bodyLg"
              variant={totalLiabilityValuation > 0 ? 'negative' : 'default'}
              style={{ marginVertical: 2 }}
            />

            <Text
              style={[
                styles.bentoCount,
                {
                  color: colors.textMuted,
                  fontFamily: typography.fontFamilies.medium,
                },
              ]}
            >
              {standaloneLiabilities.length} recorded items
            </Text>
          </LiquidGlassCard>
        </View>

        {/* 6. Net Worth Trajectory Shortcut Card */}
        <SectionHeader
          title="Portfolio Valuation"
          actionText="Historical Chart"
          onAction={() => router.push('/net-worth')}
        />
        <LiquidGlassCard
          style={styles.netWorthCard}
          radius={radii.xl}
          padding={spacing.lg}
          onPress={() => router.push('/net-worth')}
        >
          <View style={styles.netWorthRow}>
            <View>
              <Text
                style={[
                  styles.netWorthLabel,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamilies.medium,
                  },
                ]}
              >
                Current Net Worth
              </Text>
              <AmountText amount={netWorth.netWorth} size="hero" style={{ marginVertical: 4 }} />
              <Text
                style={[
                  styles.netWorthChange,
                  {
                    color: netWorth.netWorthChangeMonth >= 0 ? colors.positive : colors.negative,
                    fontFamily: typography.fontFamilies.semibold,
                  },
                ]}
              >
                {netWorth.netWorthChangeMonth >= 0 ? '+' : ''}
                {formatRupee(netWorth.netWorthChangeMonth)} this month
              </Text>
            </View>

            <View style={[styles.chartIconBtn, { backgroundColor: colors.surfaceSubtle }]}>
              <ChevronRight size={18} color={colors.textSecondary} />
            </View>
          </View>
        </LiquidGlassCard>
      </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    letterSpacing: -0.3,
  },
  headerBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    marginBottom: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
  },
  identityDetails: {
    flex: 1,
  },
  nameDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  userNameText: {
    fontSize: 18,
    letterSpacing: -0.3,
    flex: 1,
  },
  editPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  editPillText: {
    fontSize: 12,
  },
  editInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameTextInput: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    fontSize: 15,
  },
  actionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  membershipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  membershipText: {
    fontSize: 11,
  },
  themeCard: {
    marginBottom: 14,
  },
  themeOptionsGrid: {
    gap: 8,
  },
  themeOptionTile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  themeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeTileTitle: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
  themeTileSub: {
    fontSize: 11,
    marginTop: 1,
  },
  activeCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCard: {
    marginBottom: 14,
    overflow: 'hidden',
  },
  emptyAccountsRow: {
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  emptyAccountsIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyAccountsText: {
    fontSize: 15,
    letterSpacing: -0.2,
  },
  emptyAccountsSubtext: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 12,
  },
  addAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  addAccountBtnText: {
    fontSize: 13,
  },
  accountItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  accountIconBadge: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountItemName: {
    fontSize: 14,
  },
  accountItemType: {
    fontSize: 11,
    marginTop: 1,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    alignItems: 'stretch',
  },
  bentoTile: {
    flex: 1,
    minHeight: 124,
    justifyContent: 'space-between',
  },
  bentoTileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bentoIconBadge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  bentoAmount: {
    fontSize: 18,
    letterSpacing: -0.3,
  },
  bentoCount: {
    fontSize: 11,
    marginTop: 2,
  },
  netWorthCard: {
    marginBottom: 28,
  },
  netWorthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  netWorthLabel: {
    fontSize: 12,
  },
  netWorthChange: {
    fontSize: 12,
    marginTop: 2,
  },
  chartIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
