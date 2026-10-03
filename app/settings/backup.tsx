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
import { exportBackupToFile, pickAndRestoreBackupFile } from '../../src/utils/backup';

export default function BackupScreen() {
  const { colors, typography, radii, spacing } = useTheme();
  const { transactions, refresh } = useFinancialData();

  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleExportCsv = async () => {
    if (isExportingCsv) return;
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
    if (isExportingBackup) return;
    try {
      setIsExportingBackup(true);
      setStatusMessage(null);
      await exportBackupToFile();
      setStatusMessage('Backup generated and shared successfully');
    } catch (e: any) {
      showThemedAlert('Backup Error', e?.message ?? 'Failed to create backup');
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleRestoreBackup = () => {
    if (isRestoring) return;
    showThemedAlert(
      'Restore Backup',
      'Restoring a backup will replace current records with the data from your backup file. Do you want to select a backup file to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Select Backup File',
          onPress: async () => {
            if (isRestoring) return;
            try {
              setIsRestoring(true);
              setStatusMessage(null);
              const result = await pickAndRestoreBackupFile();
              if (result.success) {
                await refresh();
                setStatusMessage(result.message);
                showThemedAlert('Restore Complete', result.message);
              } else if (result.message !== 'Restore cancelled.') {
                showThemedAlert('Restore Failed', result.message);
              }
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
              Safely exports all accounts, people, categories, transactions, assets, and liabilities. No PIN or security keys are included.
            </Text>
          </View>
        </View>

        <PrimaryButton
          title="Create JSON Backup"
          onPress={handleExportBackup}
          loading={isExportingBackup}
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
              Restore all financial accounts, people, assets, liabilities, and transactions from a previously exported Vaelth JSON backup file.
            </Text>
          </View>
        </View>

        <SecondaryButton
          title="Select & Restore Backup"
          onPress={handleRestoreBackup}
          loading={isRestoring}
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
