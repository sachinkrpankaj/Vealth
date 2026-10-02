import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, AlertCircle } from 'lucide-react-native';
import { ShoppingList } from '../../domain/finance/types';
import { PrimaryButton } from '../ui/PrimaryButton';
import { useTheme } from '../../theme';
import * as Haptics from 'expo-haptics';

interface ListFormModalProps {
  visible: boolean;
  initialList?: ShoppingList | null;
  existingLists?: ShoppingList[];
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export const ListFormModal: React.FC<ListFormModalProps> = ({
  visible,
  initialList,
  existingLists = [],
  onClose,
  onSubmit,
}) => {
  const { colors, radii, typography } = useTheme();

  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName(initialList?.name || '');
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [visible, initialList]);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a list name.');
      return;
    }

    // Check duplicate name
    const isDuplicate = existingLists.some(
      (l) => l.name.toLowerCase() === trimmed.toLowerCase() && l.id !== initialList?.id
    );
    if (isDuplicate) {
      setErrorMessage(`A shopping list named "${trimmed}" already exists.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onSubmit(trimmed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save shopping list.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />

        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor: colors.surfaceElevated || colors.surface,
              borderRadius: radii.xl,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text
              style={[
                styles.sheetTitle,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fontFamilies.bold,
                },
              ]}
            >
              {initialList ? 'Rename Shopping List' : 'Create Shopping List'}
            </Text>
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

          {/* List Name Input */}
          <Text
            style={[
              styles.fieldLabel,
              {
                color: colors.textSecondary,
                fontFamily: typography.fontFamilies.semibold,
              },
            ]}
          >
            List Name *
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Groceries, Needs, Electronics"
            placeholderTextColor={colors.textMuted}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            style={[
              styles.textInput,
              {
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.md,
                fontFamily: typography.fontFamilies.regular,
              },
            ]}
          />

          {/* Error Message */}
          {errorMessage ? (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: colors.negativeBg, borderRadius: radii.sm },
              ]}
            >
              <AlertCircle size={15} color={colors.negative} style={{ marginRight: 6 }} />
              <Text
                style={[
                  styles.errorText,
                  {
                    color: colors.negative,
                    fontFamily: typography.fontFamilies.medium,
                  },
                ]}
              >
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {/* Submit Button */}
          <View style={styles.actionsContainer}>
            <PrimaryButton
              title={initialList ? 'Save Changes' : 'Create List'}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting || !name.trim()}
              style={{ width: '100%' }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalSheet: {
    width: '100%',
    padding: 20,
    elevation: 20,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  textInput: {
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    fontSize: 15,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginTop: 12,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  actionsContainer: {
    width: '100%',
    marginTop: 20,
  },
});
