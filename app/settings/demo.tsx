import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { SecondaryButton } from '../../src/components/ui/SecondaryButton';
import { useTheme } from '../../src/theme';
import { seedDemoData, resetAllData } from '../../src/utils/demoData';

export default function DemoSettingsScreen() {
  const { colors, typography, radii, spacing } = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  const handleSeedDemo = async () => {
    try {
      setIsLoading(true);
      await seedDemoData();
      Alert.alert(
        'Sample Portfolio Loaded',
        'Demo accounts (Cash, Bank, Investment), people (Rahul, Amit), and realistic transactions have been added to your local database.',
        [{ text: 'View Dashboard', onPress: () => router.replace('/(tabs)/home') }]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to load demo data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetData = () => {
    Alert.alert(
      'Reset All Data',
      'This will erase all accounts, people, assets, liabilities, and transactions. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await resetAllData();
              Alert.alert('Reset Complete', 'All data has been cleared.', [
                { text: 'OK', onPress: () => router.replace('/(tabs)/home') },
              ]);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to reset database');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        <LiquidGlassCard onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back"
          radius={radii.full} padding={0} style={styles.iconBtn}>
          <ArrowLeft size={18} color={colors.textPrimary} />
        </LiquidGlassCard>

        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Developer & Demo</Text>

        <View style={{ width: 36 }} />
      </View>

      {/* Seed Demo Data Card */}
      <Card style={[styles.card, { backgroundColor: colors.surfaceElevated, marginBottom: 16 }]}>
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: 'rgba(236, 72, 153, 0.15)', borderRadius: radii.sm },
            ]}
          >
            <Sparkles size={22} color="#EC4899" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.cardTitle,
                { color: colors.textPrimary, fontSize: typography.fontSizes.body },
              ]}
            >
              Seed Sample Portfolio
            </Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              Quickly populate Vaelth with realistic personal finance data:
              {'\n'}• Cash ₹5,000, Bank ₹40,000, Mutual Funds ₹15,000
              {'\n'}• Rahul owes ₹3,000 (with repayments)
              {'\n'}• You owe Amit ₹2,000
              {'\n'}• Categorized expenses (Food, Groceries, Fuel)
              {'\n'}• Gold asset (₹25,000)
            </Text>
          </View>
        </View>

        <PrimaryButton
          title="Load Sample Portfolio"
          onPress={handleSeedDemo}
          loading={isLoading}
          style={{ marginTop: 16 }}
        />
      </Card>

      {/* Reset Database Card */}
      <Card style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: colors.negativeBg, borderRadius: radii.sm },
            ]}
          >
            <AlertTriangle size={22} color={colors.negative} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.cardTitle,
                { color: colors.negative, fontSize: typography.fontSizes.body },
              ]}
            >
              Reset All Database Records
            </Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              Permanently delete all accounts, transactions, people, assets and liabilities on this device.
            </Text>
          </View>
        </View>

        <SecondaryButton
          title="Reset Everything"
          onPress={handleResetData}
          disabled={isLoading}
          style={{ marginTop: 16, borderColor: colors.negative }}
          textStyle={{ color: colors.negative }}
        />
      </Card>
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
    fontWeight: '700',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  card: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 12,
    lineHeight: 18,
  },
});
