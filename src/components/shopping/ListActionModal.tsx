import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { X, Pencil, Archive, RotateCcw, Trash2 } from 'lucide-react-native';
import { ShoppingList, ShoppingListSummary } from '../../domain/finance/types';
import { useTheme } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

interface ListActionModalProps {
  visible: boolean;
  list: ShoppingList | null;
  summary?: ShoppingListSummary;
  onClose: () => void;
  onRename: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}

export const ListActionModal: React.FC<ListActionModalProps> = ({
  visible,
  list,
  summary,
  onClose,
  onRename,
  onToggleArchive,
  onDelete,
}) => {
  const { colors, radii, typography, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  if (!list) return null;

  const pendingCount = summary?.pendingCount ?? 0;
  const purchasedCount = summary?.purchasedCount ?? 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />

        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor: colors.surfaceElevated || colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.sheetTitle,
                  {
                    color: colors.textPrimary,
                    fontFamily: typography.fontFamilies.bold,
                  },
                ]}
                numberOfLines={1}
              >
                {list.name}
              </Text>
              <Text
                style={[
                  styles.sheetSubtitle,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamilies.medium,
                  },
                ]}
              >
                {pendingCount} to buy · {purchasedCount} purchased
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[styles.closeBtn, { backgroundColor: colors.borderSubtle }]}
            >
              <X size={18} color={colors.textPrimary} />
            </Pressable>
          </View>

          {/* Action List */}
          <View style={styles.actionList}>
            {/* Rename */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onClose();
                onRename();
              }}
              accessibilityRole="button"
              accessibilityLabel="Rename list"
              style={({ pressed }) => [
                styles.actionRow,
                {
                  backgroundColor: pressed
                    ? isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)'
                    : 'transparent',
                  borderRadius: radii.md,
                },
              ]}
            >
              <View
                style={[
                  styles.actionIconBox,
                  {
                    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.18)' : 'rgba(99, 102, 241, 0.10)',
                    borderRadius: radii.sm,
                  },
                ]}
              >
                <Pencil size={18} color={isDark ? '#818CF8' : '#6366F1'} />
              </View>
              <Text
                style={[
                  styles.actionText,
                  {
                    color: colors.textPrimary,
                    fontFamily: typography.fontFamilies.semibold,
                  },
                ]}
              >
                Rename List
              </Text>
            </Pressable>

            {/* Archive / Unarchive */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onClose();
                onToggleArchive();
              }}
              accessibilityRole="button"
              accessibilityLabel={list.isArchived ? 'Unarchive list' : 'Archive list'}
              style={({ pressed }) => [
                styles.actionRow,
                {
                  backgroundColor: pressed
                    ? isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)'
                    : 'transparent',
                  borderRadius: radii.md,
                },
              ]}
            >
              <View
                style={[
                  styles.actionIconBox,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    borderRadius: radii.sm,
                  },
                ]}
              >
                {list.isArchived ? (
                  <RotateCcw size={18} color={colors.textPrimary} />
                ) : (
                  <Archive size={18} color={colors.textPrimary} />
                )}
              </View>
              <Text
                style={[
                  styles.actionText,
                  {
                    color: colors.textPrimary,
                    fontFamily: typography.fontFamilies.semibold,
                  },
                ]}
              >
                {list.isArchived ? 'Unarchive List' : 'Archive List'}
              </Text>
            </Pressable>

            {/* Delete */}
            <Pressable
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                onClose();
                onDelete();
              }}
              accessibilityRole="button"
              accessibilityLabel="Delete list"
              style={({ pressed }) => [
                styles.actionRow,
                {
                  backgroundColor: pressed ? colors.negativeBg : 'transparent',
                  borderRadius: radii.md,
                },
              ]}
            >
              <View
                style={[
                  styles.actionIconBox,
                  {
                    backgroundColor: colors.negativeBg,
                    borderRadius: radii.sm,
                  },
                ]}
              >
                <Trash2 size={18} color={colors.negative} />
              </View>
              <Text
                style={[
                  styles.actionText,
                  {
                    color: colors.negative,
                    fontFamily: typography.fontFamilies.semibold,
                  },
                ]}
              >
                Delete List
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalSheet: {
    paddingHorizontal: 20,
    paddingTop: 16,
    elevation: 20,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.12)',
  },
  sheetTitle: {
    fontSize: 18,
  },
  sheetSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionList: {
    paddingTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginVertical: 2,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionText: {
    fontSize: 16,
  },
});
