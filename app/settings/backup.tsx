import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, FileSpreadsheet, HardDriveDownload, HardDriveUpload, CheckCircle } from 'lucide-react-native';
import { ScreenContainer } from '../../src/components/ui/ScreenContainer';
import { Card } from '../../src/components/ui/Card';
import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { SecondaryButton } from '../../src/components/ui/SecondaryButton';
import { showThemedAlert } from '../../src/components/ui/ThemedDialog';
import { useTheme } from '../../src/theme';
import { useFinancialData } from '../../src/hooks/useFinancialData';
import { exportTransactionsToCSV } from '../../src/utils/csv';
import {
  exportBackupToFile,
  restoreBackup,
  pickAndInspectBackupFile,
  VealthBackupData,
} from '../../src/utils/backup';
import { getAllCards } from '../../src/database/repositories/cardRepository';
import { BackupPassphraseModal } from '../../src/components/backup/BackupPassphraseModal';

export default function BackupScreen() {
  const { colors, typography, radii, spacing } = useTheme();
  const { transactions, refresh } = useFinancialData();

  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Passphrase modal states
  const [exportPassphraseVisible, setExportPassphraseVisible] = useState(false);
  const [restorePassphraseVisible, setRestorePassphraseVisible] = useState(false);
  const [cardCountForModal, setCardCountForModal] = useState<number>(0);
  const [pendingRestoreBackup, setPendingRestoreBackup] = useState<VealthBackupData | null>(null);

  const handleExportCsv = async () => {
    if (isExportingCsv || isExportingBackup || isRestoring || isSubmittingModal) return;
    try {
      setIsExportingCsv(true);
      setStatusMessage(null);
      await exportTransactionsToCSV(transactions);
      setStatusMessage('CSV exported successfully');
    } catch (e: any) {
      showThemedAlert('Export Error', e?.message ?? 'Failed to export CSV');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportBackup = async () => {
    if (isExportingBackup || isRestoring || isExportingCsv || isSubmittingModal) return;
    try {
      setIsExportingBackup(true);
      setStatusMessage(null);
      const cards = await getAllCards({ includeArchived: true });
      if (cards && cards.length > 0) {
        setCardCountForModal(cards.length);
        setExportPassphraseVisible(true);
        return;
      }
      await exportBackupToFile();
      setStatusMessage('Backup generated and shared successfully');
    } catch (e: any) {
      showThemedAlert('Backup Error', e?.message ?? 'Failed to create backup');
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleExportWithPassphrase = async (passphrase: string) => {
    if (isSubmittingModal) return;
    try {
      setIsSubmittingModal(true);
      await exportBackupToFile({ cardBackupPassphrase: passphrase });
      setExportPassphraseVisible(false);
      setStatusMessage('Backup generated and shared successfully');
    } catch (e: any) {
      throw e;
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const handleRestoreBackup = () => {
    if (isRestoring || isExportingBackup || isExportingCsv || isSubmittingModal) return;
    showThemedAlert(
      'Restore Backup',
      'Restoring a backup will replace current records with the data from your backup file. Do you want to select a backup file to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Select Backup File',
          onPress: async () => {
            if (isRestoring || isExportingBackup || isSubmittingModal) return;
            try {
              setIsRestoring(true);
              setStatusMessage(null);
              const result = await pickAndInspectBackupFile();
              if (result.cancelled) {
                setStatusMessage('Restore cancelled.');
                return;
              }
              if (!result.success || !result.parsed) {
                showThemedAlert('Restore Failed', result.message || 'Invalid backup file.');
                return;
              }

              const backupData = result.parsed;
              const hasCards = backupData.data?.cards && backupData.data.cards.length > 0;
              if (hasCards) {
                setPendingRestoreBackup(backupData);
                setCardCountForModal(backupData.data.cards!.length);
                setRestorePassphraseVisible(true);
                return;
              }

              await restoreBackup(backupData);
              await refresh();
              const msg = `Successfully restored ${backupData.data?.transactions?.length ?? 0} transactions and ${backupData.data?.accounts?.length ?? 0} accounts.`;
              setStatusMessage(msg);
              showThemedAlert('Restore Complete', msg);
            } catch (err: any) {
              showThemedAlert('Restore Error', err?.message || 'Failed to restore backup.');
            } finally {
              setIsRestoring(false);
            }
          },
        },
      ]
    );
  };

  const handleRestoreWithPassphrase = async (passphrase: string) => {
    if (!pendingRestoreBackup || isSubmittingModal) return;
    try {
      setIsSubmittingModal(true);
      await restoreBackup(pendingRestoreBackup, { cardBackupPassphrase: passphrase });
      setRestorePassphraseVisible(false);
      const restoredTxCount = pendingRestoreBackup.data?.transactions?.length ?? 0;
      const restoredAccCount = pendingRestoreBackup.data?.accounts?.length ?? 0;
      setPendingRestoreBackup(null);
      await refresh();
      const msg = `Successfully restored ${restoredTxCount} transactions and ${restoredAccCount} accounts.`;
      setStatusMessage(msg);
      showThemedAlert('Restore Complete', msg);
    } catch (err: any) {
      throw err;
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const handleCloseRestoreModal = () => {
    if (isSubmittingModal) return;
    setRestorePassphraseVisible(false);
    setPendingRestoreBackup(null);
    setStatusMessage('Restore cancelled.');
  };

  return (
    <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={[styles.headerRow, { marginTop: spacing.xs, marginBottom: spacing.md }]}>
        <LiquidGlassCard onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back"
          radius={radii.full} padding={0} style={styles.iconBtn}>
          <ArrowLeft size={18} color={colors.textPrimary} />
        </LiquidGlassCard>

        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Data & Backup</Text>

        <View style={{ width: 36 }} />
      </View>

      {/* CSV Export Card */}
      <Card style={[styles.card, { backgroundColor: colors.surfaceElevated, marginBottom: 16 }]}>
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderRadius: radii.sm },
            ]}
          >
            <FileSpreadsheet size={22} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.cardTitle,
                { color: colors.textPrimary, fontSize: typography.fontSizes.body },
              ]}
            >
              Export Transactions to CSV
            </Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              Export all {transactions.length} records into a spreadsheet-compatible CSV file.
            </Text>
          </View>
        </View>

        <PrimaryButton
          title="Export CSV"
          onPress={handleExportCsv}
          loading={isExportingCsv}
          disabled={isExportingCsv || isExportingBackup || isRestoring || isSubmittingModal}
          style={{ marginTop: 16 }}
        />
      </Card>

      {/* JSON Full Backup Card */}
      <Card style={[styles.card, { backgroundColor: colors.surfaceElevated, marginBottom: 16 }]}>
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: 'rgba(99, 102, 241, 0.15)', borderRadius: radii.sm },
            ]}
          >
            <HardDriveDownload size={22} color="#6366F1" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.cardTitle,
                { color: colors.textPrimary, fontSize: typography.fontSizes.body },
              ]}
            >
              Full Local Backup (JSON)
            </Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              Safely exports all accounts, people, categories, transactions, assets, and liabilities. Card Wallet credentials are encrypted with your passphrase.
            </Text>
          </View>
        </View>

        <PrimaryButton
          title="Create JSON Backup"
          onPress={handleExportBackup}
          loading={isExportingBackup}
          disabled={isExportingCsv || isExportingBackup || isRestoring || isSubmittingModal}
          style={{ marginTop: 16 }}
        />
      </Card>

      {/* JSON Full Restore Card */}
      <Card style={[styles.card, { backgroundColor: colors.surfaceElevated, marginBottom: 16 }]}>
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: 'rgba(212, 163, 115, 0.15)', borderRadius: radii.sm },
            ]}
          >
            <HardDriveUpload size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.cardTitle,
                { color: colors.textPrimary, fontSize: typography.fontSizes.body },
              ]}
            >
              Restore from JSON Backup
            </Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              Restore all financial accounts, people, assets, liabilities, and transactions from a previously exported vealth JSON backup file.
            </Text>
          </View>
        </View>

        <SecondaryButton
          title="Select & Restore Backup"
          onPress={handleRestoreBackup}
          loading={isRestoring}
          disabled={isExportingCsv || isExportingBackup || isRestoring || isSubmittingModal}
          style={{ marginTop: 16 }}
        />
      </Card>

      {/* Status Feedback */}
      {statusMessage ? (
        <View style={[styles.statusBanner, { backgroundColor: colors.positiveBg, borderRadius: radii.md }]}>
          <CheckCircle size={16} color={colors.positive} style={{ marginRight: 8 }} />
          <Text style={[styles.statusText, { color: colors.positive }]}>{statusMessage}</Text>
        </View>
      ) : null}

      {/* Card Wallet Export Passphrase Modal */}
      <BackupPassphraseModal
        visible={exportPassphraseVisible}
        mode="export"
        cardCount={cardCountForModal}
        onClose={() => setExportPassphraseVisible(false)}
        onSubmit={handleExportWithPassphrase}
        isSubmitting={isSubmittingModal}
      />

      {/* Card Wallet Restore Passphrase Modal */}
      <BackupPassphraseModal
        visible={restorePassphraseVisible}
        mode="restore"
        cardCount={cardCountForModal}
        onClose={handleCloseRestoreModal}
        onSubmit={handleRestoreWithPassphrase}
        isSubmitting={isSubmittingModal}
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
  card: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginTop: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
