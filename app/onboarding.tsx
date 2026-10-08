import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, BackHandler } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  Landmark,
  Check,
  Sparkles,
  Moon,
  Sun,
  User,
  ChevronLeft,
  ArrowRightLeft,
  PieChart,
  CheckCircle2,
} from 'lucide-react-native';
import { ScreenContainer } from '../src/components/ui/ScreenContainer';
import { PrimaryButton } from '../src/components/ui/PrimaryButton';
import { AmountInput } from '../src/components/ui/AmountInput';
import { VealthLogo } from '../src/components/ui/VealthLogo';
import { LiquidGlassCard } from '../src/components/ui/LiquidGlassCard';
import { ColorWheelPicker } from '../src/components/ui/ColorWheelPicker';
import { IconButton } from '../src/components/ui/IconButton';
import { useTheme } from '../src/theme';
import { typography } from '../src/theme/typography';
import { useThemeStore } from '../src/stores/useThemeStore';
import { createAccount } from '../src/database/repositories/accountRepository';
import { setSetting } from '../src/database/repositories/settingsRepository';
import { generateEntityId } from '../src/utils/idGenerator';
import { formatRupee } from '../src/domain/finance/currency';
import { showThemedAlert } from '../src/components/ui/ThemedDialog';

interface OnboardingSlide {
  title: string;
  subtitle: string;
  description: string;
  icon: any;
  color: string;
  badges: string[];
}

const SLIDES: OnboardingSlide[] = [
  {
    title: 'Know Your Net Worth',
    subtitle: 'Accounts, Assets & Liabilities',
    description: 'vealth brings accounts, valuable assets and liabilities together so you can see your true net worth in real time.',
    icon: TrendingUp,
    color: '#10B981',
    badges: ['Bank & Cash Balances', 'Valuable Assets', 'Credit & Loans'],
  },
  {
    title: 'Track Every Money Movement',
    subtitle: 'Zero Double-Counting',
    description: 'Seamlessly record income, daily expenses, inter-account transfers, lending to friends, borrowing and repayments.',
    icon: ArrowRightLeft,
    color: '#6366F1',
    badges: ['Income & Expenses', 'Transfers', 'Lending & Debt Tracking'],
  },
  {
    title: 'Understand Where Your Money Goes',
    subtitle: 'Categories & Spending Visibility',
    description: 'Gain complete clarity into your capital flows with visual category breakdowns, monthly insights, and searchable history.',
    icon: PieChart,
    color: '#F59E0B',
    badges: ['Custom Categories', 'Monthly Insights', 'Searchable Activity'],
  },
  {
    title: 'Your Finances, Private',
    subtitle: 'Local Records & Optional App Lock',
    description: 'Your financial records stay on your device. Enable a PIN and supported biometric unlock in Security settings to protect access to the app.',
    icon: ShieldCheck,
    color: '#06B6D4',
    badges: ['Works Offline', 'Optional PIN Lock', 'Biometric Unlock'],
  },
];

const BANK_PRESETS = [
  { name: 'HDFC Bank', color: '#004C8F', short: 'HDFC' },
  { name: 'State Bank of India', color: '#0A60AF', short: 'SBI' },
  { name: 'ICICI Bank', color: '#A01E28', short: 'ICICI' },
  { name: 'Axis Bank', color: '#861F41', short: 'Axis' },
  { name: 'Kotak Bank', color: '#ED1B24', short: 'Kotak' },
];

const COLOR_OPTIONS = [
  '#3B82F6', // Royal Blue
  '#004C8F', // Navy (HDFC)
  '#0A60AF', // Classic Blue (SBI)
  '#6366F1', // Indigo Fintech
  '#10B981', // Emerald Green
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#A01E28', // Crimson (ICICI)
  '#861F41', // Burgundy (Axis)
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#64748B', // Slate
];

export default function OnboardingScreen() {
  const { colors, typography, radii, spacing, isDark } = useTheme();
  const [currentStep, setCurrentStep] = useState<number>(0);

  // Step 4: Personalization state (Name & Theme)
  const [userName, setUserName] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<'dark' | 'light'>(isDark ? 'dark' : 'light');

  // Step 5: Dual account setup states
  const [includeCash, setIncludeCash] = useState(true);
  const [cashBalance, setCashBalance] = useState<number>(0); // minor units paise

  const [includeBank, setIncludeBank] = useState(true);
  const [bankName, setBankName] = useState('HDFC Bank');
  const [bankNickname, setBankNickname] = useState('');
  const [bankBalance, setBankBalance] = useState<number>(0); // minor units paise
  const [bankColor, setBankColor] = useState('#004C8F');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const handleBack = useCallback(() => {
    if (submittingRef.current) return true;
    if (currentStep === 0) return false;
    setCurrentStep(Math.max(0, currentStep - 1));
    return true;
  }, [currentStep]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => subscription.remove();
  }, [handleBack]));

  const handleNext = () => {
    // A rapid second tap from this render must not skip a slide or a setup step.
    setCurrentStep(Math.min(currentStep + 1, SLIDES.length + 1));
  };

  const handleThemeChange = (mode: 'dark' | 'light') => {
    setSelectedTheme(mode);
    useThemeStore.getState().setThemeMode(mode);
  };

  const totalStartingBalance =
    (includeCash ? cashBalance : 0) + (includeBank ? bankBalance : 0);

  const handleFinishSetup = async () => {
    if (submittingRef.current || (!includeCash && !includeBank)) return;
    submittingRef.current = true;
    try {
      setIsSubmitting(true);
      // Save user details & theme preference
      if (userName.trim()) {
        await setSetting('user_name', userName.trim());
      }
      await setSetting('theme_mode', selectedTheme);

      // 1. Create Cash account if included
      if (includeCash) {
        await createAccount({
          id: generateEntityId('acc-cash'),
          name: 'Cash in Hand',
          type: 'CASH',
          openingBalance: cashBalance,
          currency: 'INR',
          color: '#10B981',
          isArchived: false,
        });
      }

      // 2. Create Bank account if included
      if (includeBank) {
        const rawName = bankName.trim() || 'Primary Bank';
        const finalName = bankNickname.trim()
          ? `${rawName} (${bankNickname.trim()})`
          : rawName;

        await createAccount({
          id: generateEntityId('acc-bank'),
          name: finalName,
          type: 'BANK',
          openingBalance: bankBalance,
          currency: 'INR',
          color: bankColor,
          isArchived: false,
        });
      }

      await setSetting('onboarding_completed', 'true');
      router.replace('/(tabs)/home');
    } catch (e) {
      showThemedAlert('Setup could not finish', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // If in slide steps (0 - 3)
  if (currentStep < SLIDES.length) {
    const slide = SLIDES[currentStep];
    const Icon = slide.icon;

    return (
      <ScreenContainer>
        <View style={styles.slideContainer}>
          {/* Top Progress & Skip */}
          <View style={styles.topProgressRow}>
            <VealthLogo size={32} />
            <View style={styles.topProgress}>
              {SLIDES.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressPill,
                    {
                      backgroundColor: i === currentStep ? colors.accent : colors.surfaceSubtle,
                      opacity: i === currentStep ? 1 : 0.4,
                    },
                  ]}
                />
              ))}
            </View>
            <Pressable
              onPress={() => setCurrentStep(SLIDES.length)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding introduction"
            >
              <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip</Text>
            </Pressable>
          </View>

          {/* Center Graphic & Messaging */}
          <ScrollView
            key={currentStep}
            style={styles.slideScroll}
            contentContainerStyle={styles.centerContent}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.iconBubble,
                {
                  backgroundColor: `${slide.color}15`,
                  borderColor: `${slide.color}35`,
                  borderRadius: radii.full,
                },
              ]}
            >
              <Icon size={46} color={slide.color} strokeWidth={2.2} />
            </View>

            <Text
              style={[
                styles.slideTitle,
                { color: colors.textPrimary, fontSize: typography.fontSizes.headingLg },
              ]}
            >
              {slide.title}
            </Text>

            <Text
              style={[
                styles.slideSubtitle,
                { color: slide.color, fontSize: typography.fontSizes.body },
              ]}
            >
              {slide.subtitle}
            </Text>

            <Text
              style={[
                styles.slideDesc,
                { color: colors.textSecondary, fontSize: typography.fontSizes.body },
              ]}
            >
              {slide.description}
            </Text>

            {/* Value Highlights Badges */}
            <View style={styles.highlightsContainer}>
              {slide.badges.map((badge, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.highlightPill,
                    {
                      backgroundColor: isDark ? colors.surface : 'rgba(0,0,0,0.04)',
                      borderColor: isDark ? colors.border : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                >
                  <CheckCircle2 size={13} color={slide.color} style={{ marginRight: 6 }} />
                  <Text style={[styles.highlightText, { color: colors.textPrimary }]}>
                    {badge}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Bottom Bar with Back & Next/Get Started */}
          <View style={styles.bottomBar}>
            {currentStep > 0 ? (
              <IconButton
                icon={<ChevronLeft size={22} color={colors.textPrimary} />}
                size={48}
                onPress={handleBack}
                accessibilityLabel="Previous slide"
                style={{ marginRight: 12 }}
              />
            ) : null}
            <PrimaryButton
              title={currentStep === SLIDES.length - 1 ? 'Get Started' : 'Next'}
              onPress={handleNext}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  // Step 4: Profile Personalization & Theme Preference (Before Balances)
  if (currentStep === SLIDES.length) {
    return (
      <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.setupContainer}>
          <IconButton
            icon={<ChevronLeft size={22} color={colors.textPrimary} />}
            onPress={handleBack}
            accessibilityLabel="Back to introduction"
            style={{ marginBottom: 12 }}
          />
          <View style={styles.setupHeader}>
            <View
              style={[
                styles.iconBubbleSmall,
                { backgroundColor: colors.surfaceElevated, borderRadius: radii.full },
              ]}
            >
              <User size={28} color={colors.accent} />
            </View>
            <Text
              style={[
                styles.setupTitle,
                { color: colors.textPrimary, fontSize: typography.fontSizes.headingLg },
              ]}
            >
              Personalize your vault
            </Text>
            <Text
              style={[
                styles.setupSubtitle,
                { color: colors.textSecondary, fontSize: typography.fontSizes.body },
              ]}
            >
              Tell us what to call you and choose your preferred visual theme.
            </Text>
          </View>

          {/* 1. NAME INPUT CARD */}
          <LiquidGlassCard style={{ marginBottom: 20 }} radius={radii.lg} padding={spacing.md}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary, marginBottom: 4 }]}>
              What should we call you?
            </Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary, marginBottom: 12 }]}>
              Your name will appear in your private portfolio greeting.
            </Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  borderColor: colors.border,
                  borderRadius: radii.md,
                  backgroundColor: colors.background,
                },
              ]}
            >
              <TextInput
                value={userName}
                onChangeText={setUserName}
                placeholder="e.g. Sachin"
                placeholderTextColor={colors.textMuted}
                style={[styles.textInput, { color: colors.textPrimary }]}
              />
            </View>
          </LiquidGlassCard>

          {/* 2. THEME SELECTION */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 4 }]}>
            Choose your aesthetic
          </Text>
          <Text style={[styles.cardSub, { color: colors.textSecondary, marginBottom: 14 }]}>
            You can always switch between Dark and Light mode later in Settings.
          </Text>

          <View style={{ gap: 12, marginBottom: 28 }}>
            {/* Dark Mode Card */}
            <LiquidGlassCard
              onPress={() => handleThemeChange('dark')}
              accessibilityLabel="Dark Obsidian theme"
              accessibilityState={{ selected: selectedTheme === 'dark' }}
              padding={0}
              radius={radii.lg}
              style={[styles.themeOptionCard, selectedTheme === 'dark' && { borderColor: colors.accent, borderWidth: 2 }]}
            >
              <View style={styles.themeCardHeader}>
                <View style={styles.themeHeaderDetails}>
                  <View style={[styles.themeIconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                    <Moon size={20} color="#818CF8" />
                  </View>
                  <View style={styles.headerText}>
                    <Text style={[styles.themeTitle, { color: colors.textPrimary }]}>Dark Obsidian</Text>
                    <Text style={[styles.themeDesc, { color: colors.textSecondary }]}>
                      Sleek contrast, private & battery-saving
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.radioIndicator,
                    {
                      borderColor: selectedTheme === 'dark' ? colors.accent : '#334155',
                      backgroundColor: selectedTheme === 'dark' ? colors.accent : 'transparent',
                    },
                  ]}
                >
                  {selectedTheme === 'dark' ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
                </View>
              </View>

              {/* Palette preview bar */}
              <View style={styles.paletteRow}>
                {['#0B0D10', '#1D222A', '#6366F1', '#10B981'].map((hex) => (
                  <View key={hex} style={[styles.paletteChip, { backgroundColor: hex }]} />
                ))}
              </View>
            </LiquidGlassCard>

            {/* Light Mode Card */}
            <LiquidGlassCard
              onPress={() => handleThemeChange('light')}
              accessibilityLabel="Clean Light theme"
              accessibilityState={{ selected: selectedTheme === 'light' }}
              padding={0}
              radius={radii.lg}
              style={[styles.themeOptionCard, selectedTheme === 'light' && { borderColor: colors.accent, borderWidth: 2 }]}
            >
              <View style={styles.themeCardHeader}>
                <View style={styles.themeHeaderDetails}>
                  <View style={[styles.themeIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                    <Sun size={20} color="#D97706" />
                  </View>
                  <View style={styles.headerText}>
                    <Text style={[styles.themeTitle, { color: colors.textPrimary }]}>Clean Light</Text>
                    <Text style={[styles.themeDesc, { color: colors.textSecondary }]}>
                      Bright, modern & crisp slate aesthetic
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.radioIndicator,
                    {
                      borderColor: selectedTheme === 'light' ? colors.accent : '#CBD5E1',
                      backgroundColor: selectedTheme === 'light' ? colors.accent : 'transparent',
                    },
                  ]}
                >
                  {selectedTheme === 'light' ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
                </View>
              </View>

              {/* Palette preview bar */}
              <View style={styles.paletteRow}>
                {['#F8FAFC', '#E2E8F0', '#4F46E5', '#059669'].map((hex) => (
                  <View
                    key={hex}
                    style={[
                      styles.paletteChip,
                      { backgroundColor: hex, borderWidth: 1, borderColor: '#CBD5E1' },
                    ]}
                  />
                ))}
              </View>
            </LiquidGlassCard>
          </View>

          {/* Continue Button */}
          <PrimaryButton
            title="Continue to Account Setup"
            onPress={handleNext}
          />
        </View>
      </ScreenContainer>
    );
  }

  // Final Step: Dual Account Setup (Cash + Bank with Details & Preferred Color)
  return (
    <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.setupContainer}>
        {/* Back to Profile button */}
        <Pressable
          onPress={() => setCurrentStep(SLIDES.length)}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Back to Profile and Theme"
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
        >
          <ChevronLeft size={18} color={colors.textSecondary} />
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginLeft: 2, fontWeight: '600' }}>
            Back to Profile & Theme
          </Text>
        </Pressable>

        <View style={styles.setupHeader}>
          <View
            style={[
              styles.iconBubbleSmall,
              { backgroundColor: colors.surfaceElevated, borderRadius: radii.full },
            ]}
          >
            <Sparkles size={28} color={colors.accent} />
          </View>
          <Text
            style={[
              styles.setupTitle,
              { color: colors.textPrimary, fontSize: typography.fontSizes.headingLg },
            ]}
          >
            Set up your accounts
          </Text>
          <Text
            style={[
              styles.setupSubtitle,
              { color: colors.textSecondary, fontSize: typography.fontSizes.body },
            ]}
          >
            Enter your starting balances. You can track cash, bank accounts, or both seamlessly.
          </Text>
        </View>

        {/* 1. CASH WALLET CARD */}
        <LiquidGlassCard
          style={[styles.accountCard, includeCash && { borderWidth: 2, borderColor: '#10B981' }]}
          radius={radii.lg}
          padding={0}
        >
          <Pressable
            onPress={() => setIncludeCash((prev) => !prev)}
            style={styles.cardHeaderRow}
          >
            <View style={styles.cardHeaderLeft}>
              <View
                style={[
                  styles.cardIconBadge,
                  { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderRadius: radii.md },
                ]}
              >
                <Wallet size={20} color="#10B981" />
              </View>
              <View style={styles.headerText}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Cash Wallet</Text>
                <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                  Cash in hand / physical wallet
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: includeCash ? '#10B981' : 'transparent',
                  borderColor: includeCash ? '#10B981' : colors.border,
                  borderRadius: radii.sm,
                },
              ]}
            >
              {includeCash && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
            </View>
          </Pressable>

          {includeCash && (
            <View style={styles.cardBody}>
              <AmountInput
                label="Cash Balance (optional)"
                value={cashBalance}
                onChangeAmount={setCashBalance}
                placeholder="0"
              />
            </View>
          )}
        </LiquidGlassCard>

        {/* 2. BANK ACCOUNT CARD */}
        <LiquidGlassCard
          style={[styles.accountCard, { marginTop: 16 }, includeBank && { borderWidth: 2, borderColor: bankColor }]}
          radius={radii.lg}
          padding={0}
        >
          <Pressable
            onPress={() => setIncludeBank((prev) => !prev)}
            style={styles.cardHeaderRow}
          >
            <View style={styles.cardHeaderLeft}>
              <View
                style={[
                  styles.cardIconBadge,
                  { backgroundColor: `${bankColor}25`, borderRadius: radii.md },
                ]}
              >
                <Landmark size={20} color={bankColor} />
              </View>
              <View style={styles.headerText}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Bank Account</Text>
                <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                  Savings, current, or salary account
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: includeBank ? bankColor : 'transparent',
                  borderColor: includeBank ? bankColor : colors.border,
                  borderRadius: radii.sm,
                },
              ]}
            >
              {includeBank && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
            </View>
          </Pressable>

          {includeBank && (
            <View style={styles.cardBody}>
              {/* Bank Presets */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Popular Indian Banks
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetsRow}
              >
                {BANK_PRESETS.map((p) => {
                  const isSelected = bankName === p.name;
                  return (
                    <LiquidGlassCard
                      key={p.short}
                      onPress={() => {
                        setBankName(p.name);
                        setBankColor(p.color);
                      }}
                      accessibilityLabel={p.name}
                      accessibilityState={{ selected: isSelected }}
                      tone={isSelected ? 'emphasized' : 'default'}
                      radius={radii.full}
                      padding={0}
                      style={styles.presetChip}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          { color: isSelected ? '#FFFFFF' : colors.textPrimary },
                        ]}
                      >
                        {p.short}
                      </Text>
                    </LiquidGlassCard>
                  );
                })}
              </ScrollView>

              {/* Bank Name Input */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                Bank Name *
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    borderRadius: radii.md,
                  },
                ]}
              >
                <TextInput
                  value={bankName}
                  onChangeText={setBankName}
                  placeholder="e.g. HDFC Bank, SBI, ICICI"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.textInput, { color: colors.textPrimary }]}
                />
              </View>

              {/* Account Nickname or Details */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                Account Nickname / Last 4 Digits (optional)
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    borderRadius: radii.md,
                  },
                ]}
              >
                <TextInput
                  value={bankNickname}
                  onChangeText={setBankNickname}
                  placeholder="e.g. Salary ••4821, Savings"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.textInput, { color: colors.textPrimary }]}
                />
              </View>

              {/* Bank Opening Balance */}
              <View style={{ marginTop: 12 }}>
                <AmountInput
                  label="Bank Balance (optional)"
                  value={bankBalance}
                  onChangeAmount={setBankBalance}
                  placeholder="0"
                />
              </View>

              {/* Preferred Color Palette & Wheel */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 14 }]}>
                Preferred Accent Color
              </Text>
              <View style={{ marginVertical: 4 }}>
                <ColorWheelPicker
                  selectedColor={bankColor}
                  onSelectColor={setBankColor}
                  presets={COLOR_OPTIONS}
                />
              </View>
            </View>
          )}
        </LiquidGlassCard>

        {/* SUMMARY PREVIEW */}
        <LiquidGlassCard style={[styles.summaryCard, { marginTop: 20 }]} radius={radii.md} padding={0}>
          <View style={styles.summaryTop}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              Starting Net Worth
            </Text>
            <Text style={[styles.summaryAmount, { color: colors.positive }]}>
              {formatRupee(totalStartingBalance)}
            </Text>
          </View>
          <Text style={[styles.summaryHint, { color: colors.textMuted }]}>
            {[
              includeCash ? `Cash: ${formatRupee(cashBalance)}` : null,
              includeBank ? `${bankName || 'Bank'}: ${formatRupee(bankBalance)}` : null,
            ]
              .filter(Boolean)
              .join('  •  ') || 'No accounts selected'}
          </Text>
        </LiquidGlassCard>

        {/* Complete Setup Button */}
        <View style={{ marginTop: 24, marginBottom: 30 }}>
          <PrimaryButton
            title="Complete Setup"
            onPress={handleFinishSetup}
            loading={isSubmitting}
            disabled={(!includeCash && !includeBank) || isSubmitting}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  slideContainer: {
    flex: 1,
    paddingVertical: 12,
  },
  topProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 16,
  },
  topProgress: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  progressPill: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  centerContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 24,
  },
  slideScroll: {
    flex: 1,
  },
  iconBubble: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 24,
  },
  slideTitle: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  slideSubtitle: {
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  slideDesc: {
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  highlightsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    maxWidth: 340,
  },
  highlightPill: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  highlightText: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: typography.fontFamilies.medium,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    flexShrink: 0,
  },
  setupContainer: {
    paddingTop: 20,
  },
  setupHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBubbleSmall: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  setupTitle: {
    fontFamily: typography.fontFamilies.extrabold,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  setupSubtitle: {
    fontFamily: typography.fontFamilies.medium,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  accountCard: {
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIconBadge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamilies.bold,
  },
  cardSub: {
    fontSize: 12,
    fontFamily: typography.fontFamilies.medium,
    marginTop: 2,
  },
  checkbox: {
    flexShrink: 0,
    width: 24,
    height: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: typography.fontFamilies.semibold,
    marginBottom: 6,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    paddingVertical: 4,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 12,
    fontFamily: typography.fontFamilies.bold,
  },
  inputWrapper: {
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 14,
    fontFamily: typography.fontFamilies.medium,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  colorSwatch: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    padding: 14,
    borderWidth: 1,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: typography.fontFamilies.semibold,
  },
  summaryAmount: {
    fontSize: 18,
    fontFamily: typography.fontFamilies.extrabold,
  },
  summaryHint: {
    fontSize: 12,
    fontFamily: typography.fontFamilies.medium,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamilies.bold,
  },
  themeOptionCard: {
    padding: 16,
    borderWidth: 1,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },
  themeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  themeHeaderDetails: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  themeIconCircle: {
    flexShrink: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamilies.bold,
  },
  themeDesc: {
    fontSize: 12,
    fontFamily: typography.fontFamilies.medium,
    marginTop: 2,
  },
  radioIndicator: {
    flexShrink: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteRow: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  paletteChip: {
    flex: 1,
    height: 10,
    borderRadius: 5,
  },
});

