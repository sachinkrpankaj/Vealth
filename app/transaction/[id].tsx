import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  ArrowLeft,
  Trash2,
  Edit2,
  Calendar,
  Wallet,
  User,
  ShoppingBag,
  Info,
  Check,
  Tag,
} from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { Badge } from '../../src/components/ui/Badge';
import { AmountText } from '../../src/components/ui/AmountText';
import { AmountInput } from '../../src/components/ui/AmountInput';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { SecondaryButton } from '../../src/components/ui/SecondaryButton';
import { DatePickerField } from '../../src/components/ui/DatePickerField';
import { CategoryPickerField } from '../../src/components/ui/CategoryPickerField';
import { useTheme } from '../../src/theme';
import {
  getTransactionById,
  getAllTransactions,
  updateTransaction,
  deleteTransaction,
} from '../../src/database/repositories/transactionRepository';
import { getAccountById } from '../../src/database/repositories/accountRepository';
import { getPersonById } from '../../src/database/repositories/personRepository';
import { getAssetById } from '../../src/database/repositories/assetRepository';
import { getCategoryById } from '../../src/database/repositories/categoryRepository';
import { calculateFinancialEffect } from '../../src/domain/finance/accountingRules';
import { calculatePersonDebt } from '../../src/domain/finance/financialEngine';
import { Transaction, Account, Person, Asset, Category } from '../../src/domain/finance/types';
import { formatRupee } from '../../src/domain/finance/currency';

export default function TransactionDetailScreen() {
  const { colors, typography, radii, spacing } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [destAccount, setDestAccount] = useState<Account | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editAmount, setEditAmount] = useState(0);
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCategory, setEditCategory] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const tx = await getTransactionById(id);
      if (tx) {
        setTransaction(tx);
        setEditAmount(tx.amount);
        setEditNote(tx.note || '');
        setEditDate(tx.date);
        setEditCategory(tx.categoryId || null);

        if (tx.categoryId) {
          const cat = await getCategoryById(tx.categoryId);
          setCategory(cat);
        } else {
          setCategory(null);
        }

        if (tx.accountId) {
          const acc = await getAccountById(tx.accountId);
          setAccount(acc);
        }
        if (tx.destinationAccountId) {
          const dest = await getAccountById(tx.destinationAccountId);
          setDestAccount(dest);
        }
        if (tx.personId) {
          const p = await getPersonById(tx.personId);
          setPerson(p);
        }
        if (tx.assetId) {
          const ast = await getAssetById(tx.assetId);
          setAsset(ast);
        }
      }
    } catch {
      // Handled silently
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction? All associated account balances and debt effects will be reversed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!id || isDeleting) return;
            setIsDeleting(true);
            try {
              await deleteTransaction(id);
              router.back();
            } catch (e: any) {
              setIsDeleting(false);
              Alert.alert('Delete Error', e?.message || 'Failed to delete transaction.');
            }
          },
        },
      ]
    );
  };

  const handleSaveEdit = async () => {
    if (isSaving || !transaction || editAmount <= 0) return;
    setIsSaving(true);

    // Enforce repayment balance checks on edit
    if (transaction.type === 'REPAYMENT_RECEIVED' || transaction.type === 'REPAYMENT_MADE') {
      if (person) {
        const allTx = await getAllTransactions();
        const debt = calculatePersonDebt(person, allTx);
        const currentOutstanding =
          transaction.type === 'REPAYMENT_RECEIVED' ? debt.owedToYou : debt.youOwe;
        // Total allowable is current balance plus the amount this transaction originally repaid
        const maxAllowed = currentOutstanding + transaction.amount;
        if (editAmount > maxAllowed) {
          setIsSaving(false);
          Alert.alert(
            'Overpayment Error',
            `Edited repayment (${formatRupee(editAmount)}) cannot exceed total outstanding balance of ${formatRupee(maxAllowed)}.`
          );
          return;
        }
      }
    }

    // Enforce asset valuation bounds check on edit
    if (transaction.type === 'ASSET_SALE' && asset) {
      const maxPossible = asset.currentValue + transaction.amount;
      if (editAmount > maxPossible) {
        setIsSaving(false);
        Alert.alert(
          'Valuation Limit',
          `Sale amount (${formatRupee(editAmount)}) cannot exceed available asset valuation (${formatRupee(maxPossible)}).`
        );
        return;
      }
    }
    try {
      await updateTransaction(transaction.id, {
        amount: editAmount,
        note: editNote.trim() || undefined,
        date: editDate.trim() || transaction.date,
        categoryId: transaction.type === 'EXPENSE' ? (editCategory || null) : (transaction.categoryId ?? null),
      });
      setIsEditing(false);
      await loadData();
    } catch (e: any) {
      Alert.alert('Update Error', e?.message || 'Failed to update transaction.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !transaction) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>Loading transaction...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const effect = calculateFinancialEffect(transaction, {
    accountName: account?.name,
    destAccountName: destAccount?.name,
    personName: person?.name,
    assetName: asset?.name,
    assetBookValue: asset?.currentValue,
  });

  return (
    <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        <LiquidGlassCard onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back" radius={radii.full} padding={0} style={styles.backBtn}>
          <ArrowLeft size={18} color={colors.textPrimary} />
        </LiquidGlassCard>

        <View style={styles.headerActions}>
          <LiquidGlassCard onPress={() => setIsEditing(!isEditing)} hitSlop={10} accessibilityLabel={isEditing ? 'Cancel editing' : 'Edit transaction'} radius={radii.full} padding={0} tone={isEditing ? 'emphasized' : 'default'} style={styles.actionBtn}>
            <Edit2 size={16} color={colors.textPrimary} />
          </LiquidGlassCard>
          <LiquidGlassCard onPress={handleDelete} hitSlop={10} accessibilityLabel="Delete transaction" radius={radii.full} padding={0} tone="negative" style={styles.actionBtn}>
            <Trash2 size={16} color={colors.textPrimary} />
          </LiquidGlassCard>
        </View>
      </View>

      {/* Main Card */}
      <Card style={[styles.mainCard, { backgroundColor: colors.surfaceElevated }]}>
        <Badge txType={transaction.type} style={{ marginBottom: 12 }} />

        {isEditing ? (
          <AmountInput
            label="Amount"
            value={editAmount}
            onChangeAmount={setEditAmount}
          />
        ) : (
          <AmountText
            amount={transaction.amount}
            size="hero"
            variant={
              transaction.type === 'INCOME' ||
              transaction.type === 'REPAYMENT_RECEIVED' ||
              transaction.type === 'BORROW'
                ? 'positive'
                : transaction.type === 'EXPENSE' ||
                  transaction.type === 'REPAYMENT_MADE' ||
                  transaction.type === 'LEND'
                ? 'negative'
                : 'default'
            }
            style={styles.amountText}
          />
        )}

        {isEditing ? (
          <View style={{ marginTop: 12 }}>
            <DatePickerField
              label="Date"
              value={editDate}
              onChange={setEditDate}
              placeholder="YYYY-MM-DD"
              style={{ marginBottom: 0 }}
            />

            {transaction.type === 'EXPENSE' ? (
              <CategoryPickerField
                selectedCategoryId={editCategory}
                onSelectCategory={setEditCategory}
                allowHistoricalMonth={transaction.date.slice(0, 7)}
              />
            ) : null}

            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>
              Note
            </Text>
            <TextInput
              value={editNote}
              onChangeText={setEditNote}
              style={[
                styles.editInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radii.md,
                  color: colors.textPrimary,
                },
              ]}
            />

            <PrimaryButton
              title="Save Changes"
              loading={isSaving}
              disabled={isSaving}
              onPress={handleSaveEdit}
              style={{ marginTop: 16 }}
            />
          </View>
        ) : (
          <Text style={[styles.noteText, { color: colors.textSecondary }]}>
            {transaction.note || 'No note attached'}
          </Text>
        )}
      </Card>

      {/* Metadata items */}
      <Card style={styles.metaCard}>
        <View style={styles.metaRow}>
          <Calendar size={18} color={colors.textMuted} style={styles.metaIcon} />
          <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Date</Text>
          <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
            {transaction.date}
          </Text>
        </View>

        {transaction.type === 'EXPENSE' ? (
          <View style={[styles.metaRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
            <Tag size={18} color={colors.textMuted} style={styles.metaIcon} />
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Category</Text>
            <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
              {category ? category.name : 'Uncategorized'}
            </Text>
          </View>
        ) : null}

        {account ? (
          <View style={[styles.metaRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
            <Wallet size={18} color={colors.textMuted} style={styles.metaIcon} />
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Account</Text>
            <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
              {account.name}
            </Text>
          </View>
        ) : null}

        {destAccount ? (
          <View style={[styles.metaRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
            <Wallet size={18} color={colors.textMuted} style={styles.metaIcon} />
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>To Account</Text>
            <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
              {destAccount.name}
            </Text>
          </View>
        ) : null}

        {person ? (
          <View style={[styles.metaRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
            <User size={18} color={colors.textMuted} style={styles.metaIcon} />
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Person</Text>
            <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
              {person.name}
            </Text>
          </View>
        ) : null}

        {asset ? (
          <View style={[styles.metaRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
            <ShoppingBag size={18} color={colors.textMuted} style={styles.metaIcon} />
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Asset</Text>
            <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
              {asset.name}
            </Text>
          </View>
        ) : null}

        {transaction.dueDate ? (
          <View style={[styles.metaRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
            <Calendar size={18} color={colors.warning} style={styles.metaIcon} />
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Due Date</Text>
            <Text style={[styles.metaValue, { color: colors.warning }]}>
              {transaction.dueDate}
            </Text>
          </View>
        ) : null}
      </Card>

      {/* Financial Effect Breakdown Card (Section 26) */}
      <Card style={styles.effectCard}>
        <View style={styles.effectHeader}>
          <Info size={18} color={colors.accent} style={{ marginRight: 8 }} />
          <Text style={[styles.effectTitle, { color: colors.textPrimary }]}>
            Accounting & Net Worth Effect
          </Text>
        </View>

        <View style={styles.effectLines}>
          {effect.descriptionLines.map((line, idx) => (
            <View key={idx} style={styles.effectLineRow}>
              <View
                style={[
                  styles.bullet,
                  { backgroundColor: colors.accent, borderRadius: radii.full },
                ]}
              />
              <Text style={[styles.effectLineText, { color: colors.textSecondary }]}>
                {line}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  mainCard: {
    padding: 20,
    marginBottom: 16,
  },
  amountText: {
    marginVertical: 4,
  },
  noteText: {
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  editInput: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  metaCard: {
    paddingVertical: 0,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  metaIcon: {
    marginRight: 12,
  },
  metaLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  effectCard: {
    padding: 16,
  },
  effectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  effectTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  effectLines: {
    gap: 8,
  },
  effectLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bullet: {
    width: 6,
    height: 6,
    marginRight: 10,
  },
  effectLineText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
