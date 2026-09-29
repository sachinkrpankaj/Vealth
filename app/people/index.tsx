import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, UserPlus } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { SearchBar } from '../../src/components/ui/SearchBar';
import { PersonRow } from '../../src/components/ui/PersonRow';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { useTheme } from '../../src/theme';

export default function PeopleListScreen() {
  const { colors, radii, spacing } = useTheme();
  const { personDebts, refresh } = useFinancialData();
  const [query, setQuery] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  const filtered = personDebts.filter((d) =>
    d.person.name.toLowerCase().includes(query.toLowerCase().trim())
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.sm }]}>
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

        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>People Directory</Text>

        <Pressable
          onPress={() => router.push('/people/add')}
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: colors.textPrimary,
              borderRadius: radii.full,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <UserPlus size={18} color={colors.background} />
        </Pressable>
      </View>

      {/* Search */}
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search people..."
        style={{ marginBottom: 12 }}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="No people found"
          description={
            query
              ? 'No one matches your search keyword.'
              : 'Add people to track money lent, borrowed and repayments.'
          }
          actionTitle="Add Person"
          onAction={() => router.push('/people/add')}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.person.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderItem={({ item }) => (
            <Card style={styles.card} padding={0} radius={18}>
              <PersonRow
                debtSummary={item}
                onPress={() => router.push(`/people/${item.person.id}`)}
              />
            </Card>
          )}
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
  card: {
    marginBottom: 10,
  },
});
