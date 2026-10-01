import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  HandCoins,
  ArrowDownLeft,
  ArrowUpRight,
  Phone,
  Mail,
  FileText,
  Trash2,
  Pencil,
  X,
  Check,
} from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { Avatar } from '../../src/components/ui/Avatar';
import { ColorWheelPicker } from '../../src/components/ui/ColorWheelPicker';
import { AmountText } from '../../src/components/ui/AmountText';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { SecondaryButton } from '../../src/components/ui/SecondaryButton';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { TransactionRow } from '../../src/components/ui/TransactionRow';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { useTheme } from '../../src/theme';
import {
  getPersonById,
  updatePerson,
  archivePerson,
} from '../../src/database/repositories/personRepository';
import { getAllTransactions } from '../../src/database/repositories/transactionRepository';
import { getAllAccounts } from '../../src/database/repositories/accountRepository';
import { calculatePersonDebt } from '../../src/domain/finance/financialEngine';
import { Person, PersonDebtSummary, Transaction, Account } from '../../src/domain/finance/types';
import { formatRupee } from '../../src/domain/finance/currency';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLOR_OPTIONS = [
  '#6366F1', // Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#14B8A6', // Teal
];

export default function PersonDetailScreen() {
  const { colors, typography, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [person, setPerson] = useState<Person | null>(null);
  const [debtSummary, setDebtSummary] = useState<PersonDebtSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editAvatarColor, setEditAvatarColor] = useState(COLOR_OPTIONS[0]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const [p, txs, accs] = await Promise.all([
        getPersonById(id),
        getAllTransactions({ personId: id }),
        getAllAccounts(),
      ]);

      if (p) {
        setPerson(p);
        setDebtSummary(calculatePersonDebt(p, txs));
      }
      setTransactions(txs);
      setAccounts(accs);
    } catch (e) {
      console.error('Failed to load person details:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [id])
  );

  const handleOpenEdit = () => {
    if (!person) return;
    setEditName(person.name);
    setEditPhone(person.phone ?? '');
    setEditEmail(person.email ?? '');
    setEditNote(person.note ?? '');
    setEditAvatarColor(person.avatarColor || COLOR_OPTIONS[0]);
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (isSavingEdit || !id) return;
    if (!editName.trim()) {
      setEditError('Please enter a name');
      return;
    }

    const cleanedPhone = editPhone.replace(/[^0-9]/g, '').slice(0, 10);
    if (editPhone.trim() && cleanedPhone.length !== 10) {
      setEditError('Phone number must be exactly 10 digits (numbers only)');
      return;
    }

    try {
      setIsSavingEdit(true);
      setEditError(null);

      await updatePerson(id, {
        name: editName.trim(),
        phone: cleanedPhone || undefined,
        email: editEmail.trim() || undefined,
        note: editNote.trim() || undefined,
        avatarColor: editAvatarColor,
      });

      await loadData();
      setIsEditModalOpen(false);
    } catch (e: any) {
      setEditError(e?.message ?? 'Failed to update person');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleArchive = () => {
    Alert.alert(
      'Archive Person',
      `Are you sure you want to archive ${person?.name}? Their history will remain recorded in financial accounts.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            await archivePerson(id);
            router.back();
          },
        },
      ]
    );
  };

  if (isLoading || !person || !debtSummary) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>Loading person...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        <LiquidGlassCard onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back" radius={radii.full} padding={0} style={styles.iconBtn}>
          <ArrowLeft size={18} color={colors.textPrimary} />
        </LiquidGlassCard>

        <View style={styles.headerRightActions}>
          <LiquidGlassCard onPress={handleOpenEdit} hitSlop={8} accessibilityLabel="Edit person" radius={radii.full} padding={0} style={styles.actionPill}>
            <Pencil size={14} color={colors.textPrimary} />
            <Text style={[styles.actionPillText, { color: colors.textPrimary }]}>Edit</Text>
          </LiquidGlassCard>

          <LiquidGlassCard onPress={handleArchive} hitSlop={10} accessibilityLabel="Delete or archive person" radius={radii.full} padding={0} tone="negative" style={styles.iconBtn}>
            <Trash2 size={16} color={colors.textPrimary} />
          </LiquidGlassCard>
        </View>
      </View>

      {/* Person Profile Hero */}
      <View style={styles.profileHeader}>
        <Avatar name={person.name} color={person.avatarColor} size="lg" />
        <Text
          style={[
            styles.personName,
            { color: colors.textPrimary, fontSize: typography.fontSizes.headingLg },
          ]}
        >
          {person.name}
        </Text>
        
        {/* Contact Info Pills */}
        <View style={styles.contactPillsRow}>
          {person.phone ? (
            <View style={[styles.contactPill, { backgroundColor: colors.surfaceSubtle }]}>
              <Phone size={12} color={colors.textSecondary} />
              <Text style={[styles.contactPillText, { color: colors.textSecondary }]}>
                {person.phone}
              </Text>
            </View>
          ) : null}
          {person.email ? (
            <View style={[styles.contactPill, { backgroundColor: colors.surfaceSubtle }]}>
              <Mail size={12} color={colors.textSecondary} />
              <Text style={[styles.contactPillText, { color: colors.textSecondary }]}>
                {person.email}
              </Text>
            </View>
          ) : null}
        </View>

        {person.note ? (
          <View style={[styles.noteContainer, { backgroundColor: colors.surfaceSubtle, borderRadius: radii.sm }]}>
            <FileText size={12} color={colors.textMuted} style={{ marginTop: 2 }} />
            <Text style={[styles.noteText, { color: colors.textMuted }]}>{person.note}</Text>
          </View>
        ) : null}
      </View>

      {/* Debt Balance Hero Card */}
      <Card style={[styles.balanceCard, { backgroundColor: colors.surfaceElevated }]}>
        <Text style={[styles.netLabel, { color: colors.textSecondary }]}>Net Balance</Text>
        <AmountText
          amount={Math.abs(debtSummary.netBalance)}
          size="hero"
          variant={
            debtSummary.netBalance > 0
              ? 'positive'
              : debtSummary.netBalance < 0
              ? 'negative'
              : 'default'
          }
          style={styles.netAmount}
        />
        <Text style={[styles.netDescription, { color: colors.textSecondary }]}>
          {debtSummary.netBalance > 0
            ? `${person.name} owes you`
            : debtSummary.netBalance < 0
            ? `You owe ${person.name}`
            : 'All settled up'}
        </Text>

        <View style={[styles.subBalancesRow, { borderTopColor: colors.borderSubtle }]}>
          <View style={styles.subBalanceItem}>
            <Text style={[styles.subLabel, { color: colors.textMuted }]}>They owe you</Text>
            <AmountText
              amount={debtSummary.owedToYou}
              size="bodyLg"
              variant="positive"
            />
          </View>
          <View style={[styles.dividerVertical, { backgroundColor: colors.borderSubtle }]} />
          <View style={styles.subBalanceItem}>
            <Text style={[styles.subLabel, { color: colors.textMuted }]}>You owe them</Text>
            <AmountText
              amount={debtSummary.youOwe}
              size="bodyLg"
              variant={debtSummary.youOwe > 0 ? 'negative' : 'default'}
            />
          </View>
        </View>
      </Card>

      {/* Quick Action Buttons */}
      <View style={styles.actionButtonsRow}>
        {debtSummary.owedToYou > 0 ? (
          <PrimaryButton
            title="Record Repayment"
            onPress={() =>
              router.push({
                pathname: '/transaction/add',
                params: {
                  defaultType: 'REPAYMENT_RECEIVED',
                  personId: person.id,
                },
              })
            }
            style={{ flex: 1 }}
          />
        ) : debtSummary.youOwe > 0 ? (
          <PrimaryButton
            title="Pay Back Debt"
            onPress={() =>
              router.push({
                pathname: '/transaction/add',
                params: {
                  defaultType: 'REPAYMENT_MADE',
                  personId: person.id,
                },
              })
            }
            style={{ flex: 1 }}
          />
        ) : null}

        <SecondaryButton
          title="Lend Money"
          onPress={() =>
            router.push({
              pathname: '/transaction/add',
              params: {
                defaultType: 'LEND',
                personId: person.id,
              },
            })
          }
          style={{ flex: 1, marginLeft: debtSummary.netBalance !== 0 ? 8 : 0 }}
        />
      </View>

      {/* Transaction History with this Person */}
      <SectionHeader title="Transaction History" />
      {transactions.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          description={`Record money lent or borrowed with ${person.name}.`}
        />
      ) : (
        <Card style={styles.txCard}>
          {transactions.map((tx, idx) => (
            <React.Fragment key={tx.id}>
              <TransactionRow
                transaction={tx}
                accountName={tx.accountId ? accountMap.get(tx.accountId) : undefined}
                personName={person.name}
                onPress={() => router.push(`/transaction/${tx.id}`)}
              />
              {idx < transactions.length - 1 ? (
                <View
                  style={[styles.rowDivider, { backgroundColor: colors.borderSubtle }]}
                />
              ) : null}
            </React.Fragment>
          ))}
        </Card>
      )}

      {/* Edit Person Modal */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.background,
                borderTopColor: colors.border,
                borderTopLeftRadius: radii.xl,
                borderTopRightRadius: radii.xl,
                paddingBottom: insets.bottom,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Edit Person Details
              </Text>
              <LiquidGlassCard onPress={() => setIsEditModalOpen(false)} accessibilityLabel="Close editor" radius={radii.full} padding={0} style={styles.modalCloseBtn}>
                <X size={18} color={colors.textPrimary} />
              </LiquidGlassCard>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {/* Avatar Preview */}
              <View style={styles.modalAvatarRow}>
                <Avatar name={editName || person.name} color={editAvatarColor} size="lg" />
              </View>

              {/* Accent Color Palette & Wheel */}
              <Text style={[styles.modalFieldLabel, { color: colors.textSecondary }]}>
                Avatar Color
              </Text>
              <View style={{ marginBottom: 16 }}>
                <ColorWheelPicker
                  selectedColor={editAvatarColor}
                  onSelectColor={setEditAvatarColor}
                  presets={COLOR_OPTIONS}
                />
              </View>

              {/* Full Name */}
              <Text style={[styles.modalFieldLabel, { color: colors.textSecondary }]}>
                Full Name *
              </Text>
              <View
                style={[
                  styles.modalInputBox,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radii.md,
                    marginBottom: 14,
                  },
                ]}
              >
                <TextInput
                  value={editName}
                  onChangeText={(t) => {
                    setEditName(t);
                    if (editError) setEditError(null);
                  }}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.modalTextInput, { color: colors.textPrimary }]}
                />
              </View>

              {/* Strict 10-digit Phone Number */}
              <View style={styles.fieldLabelRow}>
                <Text style={[styles.modalFieldLabel, { color: colors.textSecondary }]}>
                  Phone Number (optional)
                </Text>
                {editPhone.length > 0 ? (
                  <Text
                    style={[
                      styles.digitCounter,
                      {
                        color: editPhone.length === 10 ? colors.positive : colors.textMuted,
                      },
                    ]}
                  >
                    {editPhone.length}/10 digits
                  </Text>
                ) : null}
              </View>
              <View
                style={[
                  styles.modalInputBox,
                  {
                    backgroundColor: colors.surface,
                    borderColor:
                      editPhone.length > 0 && editPhone.length < 10
                        ? colors.warning
                        : colors.border,
                    borderRadius: radii.md,
                    marginBottom: 14,
                  },
                ]}
              >
                <TextInput
                  value={editPhone}
                  onChangeText={(val) => {
                    const digits = val.replace(/[^0-9]/g, '').slice(0, 10);
                    setEditPhone(digits);
                    if (editError) setEditError(null);
                  }}
                  placeholder="10-digit mobile number (numbers only)"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={10}
                  style={[styles.modalTextInput, { color: colors.textPrimary }]}
                />
              </View>

              {/* Email */}
              <Text style={[styles.modalFieldLabel, { color: colors.textSecondary }]}>
                Email (optional)
              </Text>
              <View
                style={[
                  styles.modalInputBox,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radii.md,
                    marginBottom: 14,
                  },
                ]}
              >
                <TextInput
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="rahul@example.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.modalTextInput, { color: colors.textPrimary }]}
                />
              </View>

              {/* Note */}
              <Text style={[styles.modalFieldLabel, { color: colors.textSecondary }]}>
                Notes (optional)
              </Text>
              <View
                style={[
                  styles.modalInputBox,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radii.md,
                    marginBottom: 18,
                  },
                ]}
              >
                <TextInput
                  value={editNote}
                  onChangeText={setEditNote}
                  placeholder="e.g. College roommate, Office team"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.modalTextInput, { color: colors.textPrimary }]}
                />
              </View>

              {editError ? (
                <Text style={[styles.errorBanner, { color: colors.negative }]}>{editError}</Text>
              ) : null}

              <PrimaryButton
                title="Save Changes"
                onPress={handleSaveEdit}
                loading={isSavingEdit}
                disabled={!editName.trim() || isSavingEdit}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  actionPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  personName: {
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
  },
  contactPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 8,
  },
  contactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  contactPillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
    maxWidth: '85%',
  },
  noteText: {
    fontSize: 12,
    lineHeight: 16,
  },
  balanceCard: {
    padding: 20,
    marginBottom: 16,
  },
  netLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  netAmount: {
    marginVertical: 4,
  },
  netDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  subBalancesRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 14,
  },
  subBalanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  subLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  dividerVertical: {
    width: 1,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  txCard: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  rowDivider: {
    height: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalAvatarRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  modalFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  digitCounter: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  modalInputBox: {
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
    justifyContent: 'center',
  },
  modalTextInput: {
    fontSize: 14,
  },
  colorDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  errorBanner: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 14,
    textAlign: 'center',
  },
});
