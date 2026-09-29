import React from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, Building2, Car, Gem, Laptop, CircleDot } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { AmountText } from '../../src/components/ui/AmountText';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { useTheme } from '../../src/theme';
import { Asset, AssetCategory } from '../../src/domain/finance/types';

function getAssetIcon(cat: AssetCategory) {
  switch (cat) {
    case 'GOLD':
      return Gem;
    case 'PROPERTY':
      return Building2;
    case 'VEHICLE':
      return Car;
    case 'ELECTRONICS':
      return Laptop;
    default:
      return CircleDot;
  }
}

export default function AssetsListScreen() {
  const { colors, radii, spacing, typography } = useTheme();
  const { physicalAssets, refresh } = useFinancialData();

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  const totalValuation = physicalAssets.reduce(
    (acc, curr) => acc + curr.currentValue,
    0
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.full,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <ArrowLeft size={18} color={colors.textPrimary} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Valuable Assets</Text>

        <Pressable
          onPress={() => router.push('/assets/add')}
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: colors.textPrimary,
              borderRadius: radii.full,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Plus size={18} color={colors.background} />
        </Pressable>
      </View>

      {/* Hero Card */}
      <Card style={[styles.heroCard, { backgroundColor: colors.surfaceElevated }]}>
        <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
          Total Physical & Investment Assets
        </Text>
        <AmountText
          amount={totalValuation}
          size="hero"
          style={{ marginVertical: 4 }}
        />
        <Text style={[styles.heroSub, { color: colors.textMuted }]}>
          {physicalAssets.length} recorded items
        </Text>
      </Card>

      {physicalAssets.length === 0 ? (
        <EmptyState
          title="No assets recorded"
          description="Keep track of gold, properties, vehicles, electronics or other valuables in your net worth."
          actionTitle="Add Asset"
          onAction={() => router.push('/assets/add')}
        />
      ) : (
        <FlatList
          data={physicalAssets}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
          renderItem={({ item }) => {
            const Icon = getAssetIcon(item.category);
            return (
              <Card style={styles.card}>
                <View style={styles.assetRow}>
                  <View
                    style={[
                      styles.iconWrapper,
                      { backgroundColor: colors.surfaceSubtle, borderRadius: radii.sm },
                    ]}
                  >
                    <Icon size={20} color={colors.accent} />
                  </View>

                  <View style={styles.assetDetails}>
                    <Text
                      style={[
                        styles.assetName,
                        { color: colors.textPrimary, fontSize: typography.fontSizes.body },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.assetCategory,
                        { color: colors.textMuted, fontSize: typography.fontSizes.caption },
                      ]}
                    >
                      {item.category} • Acquired {item.purchaseDate}
                    </Text>
                  </View>

                  <View style={styles.amountCol}>
                    <AmountText amount={item.currentValue} size="bodyLg" />
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
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
  heroCard: {
    padding: 20,
    marginBottom: 16,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  heroSub: {
    fontSize: 12,
  },
  card: {
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  assetDetails: {
    flex: 1,
    marginRight: 12,
  },
  assetName: {
    fontWeight: '600',
    marginBottom: 2,
  },
  assetCategory: {
    textTransform: 'capitalize',
  },
  amountCol: {
    alignItems: 'flex-end',
  },
});
