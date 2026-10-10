import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  CreditCard,
  ShieldCheck,
  Search,
  Filter,
  Wallet,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { CardPreview } from '../../src/components/cards/CardPreview';
import { CardDetailModal } from '../../src/components/cards/CardDetailModal';
import { CardFormModal } from '../../src/components/cards/CardFormModal';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { SegmentedControl } from '../../src/components/ui/SegmentedControl';
import { useTheme } from '../../src/theme';
import { SavedCard, CardType } from '../../src/domain/cards/types';
import { Account } from '../../src/domain/finance/types';
import { getAllCards } from '../../src/database/repositories/cardRepository';
import { getAllAccounts } from '../../src/database/repositories/accountRepository';

export default function CardWalletScreen() {
  const { colors, radii, spacing, typography, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ initialAccountId?: string; autoAdd?: string }>();

  const [cards, setCards] = useState<SavedCard[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [selectedCard, setSelectedCard] = useState<SavedCard | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingCard, setEditingCard] = useState<SavedCard | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [allCards, allAccounts] = await Promise.all([
        getAllCards(),
        getAllAccounts(),
      ]);
      setCards(allCards);
      setAccounts(allAccounts);
    } catch (e) {
      console.error('Failed to load card wallet:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Handle auto-add param if redirected from account detail
  React.useEffect(() => {
    if (params.autoAdd === 'true') {
      setEditingCard(null);
      setFormModalVisible(true);
    }
  }, [params.autoAdd]);

  const creditCount = useMemo(() => cards.filter((c) => c.cardType === 'CREDIT').length, [cards]);
  const debitCount = useMemo(() => cards.filter((c) => c.cardType === 'DEBIT').length, [cards]);

  const filteredCards = useMemo(() => {
    return cards.filter((c) => {
      // Type filter
      if (filterType === 'CREDIT' && c.cardType !== 'CREDIT') return false;
      if (filterType === 'DEBIT' && c.cardType !== 'DEBIT') return false;

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = c.cardholderName.toLowerCase().includes(q);
        const matchesNick = c.cardNickname ? c.cardNickname.toLowerCase().includes(q) : false;
        const matchesNetwork = c.network.toLowerCase().includes(q);
        const matchesDigits = c.lastFour.includes(q);
        return matchesName || matchesNick || matchesNetwork || matchesDigits;
      }

      return true;
    });
  }, [cards, filterType, searchQuery]);

  const accountMap = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a]));
  }, [accounts]);

  const handleOpenCard = (card: SavedCard) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedCard(card);
    setDetailModalVisible(true);
  };

  const handleAddNew = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setEditingCard(null);
    setFormModalVisible(true);
  };

  const handleEditCard = (card: SavedCard) => {
    setEditingCard(card);
    setFormModalVisible(true);
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.sm }]}>
        <LiquidGlassCard
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel="Go back"
          radius={radii.full}
          padding={0}
          style={styles.iconBtn}
        >
          <ArrowLeft size={18} color={colors.textPrimary} />
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
          Card Wallet
        </Text>

        <LiquidGlassCard
          onPress={handleAddNew}
          hitSlop={10}
          accessibilityLabel="Add card"
          tone="emphasized"
          radius={radii.full}
          padding={0}
          style={styles.iconBtn}
        >
          <Plus size={18} color="#FFFFFF" />
        </LiquidGlassCard>
      </View>

      {/* Security Info Card */}
      <View
        style={[
          styles.securityCard,
          {
            backgroundColor: colors.surfaceSubtle,
            borderColor: colors.borderSubtle,
            borderRadius: radii.md,
          },
        ]}
      >
        <ShieldCheck size={18} color={colors.accent} style={{ marginRight: 10 }} />
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.securityTitle,
              {
                color: colors.textPrimary,
                fontFamily: typography.fontFamilies.semibold,
              },
            ]}
          >
            Encrypted Card Vault
          </Text>
          <Text
            style={[
              styles.securityDesc,
              {
                color: colors.textSecondary,
                fontFamily: typography.fontFamilies.regular,
              },
            ]}
          >
            Hardware keystore encryption. Adding cards is optional and has zero impact on financial records.
          </Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterSection}>
        <SegmentedControl
          options={[
            { key: 'ALL', label: 'All', badge: cards.length },
            { key: 'CREDIT', label: 'Credit', badge: creditCount },
            { key: 'DEBIT', label: 'Debit', badge: debitCount },
          ]}
          activeKey={filterType}
          onChange={(key) => setFilterType(key as 'ALL' | 'CREDIT' | 'DEBIT')}
        />
      </View>

      {/* Search Input (Shown if there are cards) */}
      {cards.length > 2 && (
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.md,
            },
          ]}
        >
          <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name, nickname, or digits..."
            placeholderTextColor={colors.textMuted}
            style={[
              styles.searchInput,
              {
                color: colors.textPrimary,
                fontFamily: typography.fontFamilies.regular,
              },
            ]}
          />
        </View>
      )}

      {/* Cards List or Empty State */}
      {filteredCards.length === 0 ? (
        <EmptyState
          title={
            cards.length === 0
              ? 'No cards saved yet'
              : `No ${filterType.toLowerCase()} cards found`
          }
          description={
            cards.length === 0
              ? 'Securely store and copy your Credit and Debit card details with hardware encryption.'
              : 'Try selecting a different filter or adding a new card.'
          }
          actionTitle="Add Card to Wallet"
          onAction={handleAddNew}
        />
      ) : (
        <FlatList
          data={filteredCards}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 60, 80) }}
          renderItem={({ item }) => {
            const linkedAcc = item.linkedAccountId ? accountMap.get(item.linkedAccountId) : null;
            return (
              <View style={styles.cardItemWrapper}>
                <CardPreview
                  cardholderName={item.cardholderName}
                  lastFour={item.lastFour}
                  network={item.network}
                  cardType={item.cardType}
                  issuer={item.issuer}
                  expiryMonth={item.expiryMonth}
                  expiryYear={item.expiryYear}
                  cardNickname={item.cardNickname}
                  linkedAccountName={linkedAcc?.name}
                  colorTheme={item.colorTheme}
                  onPress={() => handleOpenCard(item)}
                />
              </View>
            );
          }}
        />
      )}

      {/* Detail Modal */}
      <CardDetailModal
        visible={detailModalVisible}
        card={selectedCard}
        linkedAccount={selectedCard?.linkedAccountId ? accountMap.get(selectedCard.linkedAccountId) : null}
        onClose={() => {
          setDetailModalVisible(false);
          setSelectedCard(null);
        }}
        onEdit={(c) => {
          setDetailModalVisible(false);
          setSelectedCard(null);
          setTimeout(() => {
            handleEditCard(c);
          }, 120);
        }}
        onCardDeleted={() => {
          loadData();
        }}
      />

      {/* Add / Edit Form Modal */}
      <CardFormModal
        visible={formModalVisible}
        initialCard={editingCard}
        preselectedAccountId={params.initialAccountId}
        accounts={accounts}
        onClose={() => {
          setFormModalVisible(false);
          setEditingCard(null);
        }}
        onSuccess={() => {
          loadData();
        }}
      />
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
  securityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  securityTitle: {
    fontSize: 13,
  },
  securityDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  filterSection: {
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  cardItemWrapper: {
    marginBottom: 16,
  },
});
