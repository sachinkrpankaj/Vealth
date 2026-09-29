import React from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, ShieldAlert, CreditCard, Landmark, CircleDot } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { AmountText } from '../../src/components/ui/AmountText';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { useTheme } from '../../src/theme';
import { Liability, LiabilityType } from '../../src/domain/finance/types';

function getLiabilityIcon(type: LiabilityType) {
  switch (type) {
    case 'CREDIT_CARD':
      return CreditCard;
    case 'PERSONAL_LOAN':
      return Landmark;
    default:
      return ShieldAlert;
  }
}

export default function LiabilitiesListScreen() {
  const { colors, radii, spacing, typography } = useTheme();
  const { standaloneLiabilities, refresh } = useFinancialData();

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  const totalObligations = standaloneLiabilities.reduce(
    (acc, curr) => acc + curr.amount,
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

        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Liabilities & Debt</Text>

        <Pressable
          onPress={() => router.push('/liabilities/add')}
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
          Total Standalone Liabilities
        </Text>
        <AmountText
          amount={totalObligations}
          size="hero"
          variant={totalObligations > 0 ? 'negative' : 'default'}
          style={{ marginVertical: 4 }}
        />
        <Text style={[styles.heroSub, { color: colors.textMuted }]}>
          {standaloneLiabilities.length} recorded obligations
        </Text>
      </Card>

      {standaloneLiabilities.length === 0 ? (
        <EmptyState
          title="You're clear"
          description="No standalone loans, credit card balances or personal liabilities recorded."
          actionTitle="Record Liability"
          onAction={() => router.push('/liabilities/add')}
        />
      ) : (
        <FlatList
          data={standaloneLiabilities}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
          renderItem={({ item }) => {
            const Icon = getLiabilityIcon(item.type);
            return (
              <Card style={styles.card}>
                <View style={styles.row}>
                  <View
                    style={[
                      styles.iconWrapper,
                      { backgroundColor: colors.negativeBg, borderRadius: radii.sm },
                    ]}
                  >
                    <Icon size={20} color={colors.negative} />
                  </View>

                  <View style={styles.details}>
                    <Text
                      style={[
                        styles.name,
                        { color: colors.textPrimary, fontSize: typography.fontSizes.body },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.type,
                        { color: colors.textMuted, fontSize: typography.fontSizes.caption },
                      ]}
                    >
                      {item.type.replace('_', ' ')}
                      {item.dueDate ? ` • Due ${item.dueDate}` : ''}
                    </Text>
                  </View>

                  <View style={styles.amountCol}>
                    <AmountText amount={item.amount} size="bodyLg" variant="negative" />
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
  row: {
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
  details: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontWeight: '600',
    marginBottom: 2,
  },
  type: {
    textTransform: 'capitalize',
  },
  amountCol: {
    alignItems: 'flex-end',
  },
});
