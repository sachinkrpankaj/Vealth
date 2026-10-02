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
import { ShoppingItem } from '../../domain/finance/types';
import { AmountInput } from '../ui/AmountInput';
import { PrimaryButton } from '../ui/PrimaryButton';
import { KeyboardAwareScrollView } from '../ui/KeyboardAwareScrollView';
import { useTheme } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

interface ItemFormModalProps {
  visible: boolean;
  initialItem?: ShoppingItem | null;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    estimatedPrice?: number;
    productUrl?: string;
    note?: string;
  }) => Promise<void>;
}

export const ItemFormModal: React.FC<ItemFormModalProps> = ({
  visible,
  initialItem,
  onClose,
  onSubmit,
}) => {
  const { colors, radii, typography, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);
  const [productUrl, setProductUrl] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (initialItem) {
        setName(initialItem.name);
        setEstimatedPrice(initialItem.estimatedPrice || 0);
        setProductUrl(initialItem.productUrl || '');
        setNote(initialItem.note || '');
      } else {
        setName('');
        setEstimatedPrice(0);
        setProductUrl('');
        setNote('');
      }
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [visible, initialItem]);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Please enter a product name.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      let cleanUrl = productUrl.trim();
      if (cleanUrl) {
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
          cleanUrl = `https://${cleanUrl}`;
        }
        try {
          const parsed = new URL(cleanUrl);
          if (!parsed.hostname || !parsed.hostname.includes('.')) {
            setErrorMessage('Please enter a valid web address (e.g. amazon.in or https://...)');
            setIsSubmitting(false);
            return;
          }
        } catch {
          setErrorMessage('Please enter a valid product link URL.');
          setIsSubmitting(false);
          return;
        }
      }

      await onSubmit({
        name: trimmedName,
        estimatedPrice: estimatedPrice > 0 ? estimatedPrice : undefined,
        productUrl: cleanUrl || undefined,
        note: note.trim() || undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
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
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              paddingBottom: Math.max(insets.bottom, 16),
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
              {initialItem ? 'Edit Item' : 'Add Item'}
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

          {/* Form Scroll Area */}
          <KeyboardAwareScrollView
            style={styles.scrollArea}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            extraScrollHeight={100}
          >
            {/* Product Name */}
            <Text
              style={[
                styles.fieldLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamilies.semibold,
                },
              ]}
            >
              Product Name *
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Wireless Mouse"
              placeholderTextColor={colors.textMuted}
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

            {/* Estimated Price */}
            <AmountInput
              label="Estimated Price (Optional)"
              value={estimatedPrice}
              onChangeAmount={setEstimatedPrice}
              style={{ marginTop: 14 }}
              placeholder="0"
            />

            {/* Product Link */}
            <Text
              style={[
                styles.fieldLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamilies.semibold,
                  marginTop: 14,
                },
              ]}
            >
              Product Link (Optional)
            </Text>
            <TextInput
              value={productUrl}
              onChangeText={setProductUrl}
              placeholder="e.g. amazon.in/dp/..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
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

            {/* Note */}
            <Text
              style={[
                styles.fieldLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamilies.semibold,
                  marginTop: 14,
                },
              ]}
            >
              Note / Specification (Optional)
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Black color, size 10"
              placeholderTextColor={colors.textMuted}
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

            <View style={{ height: 16 }} />
          </KeyboardAwareScrollView>

          {/* Bottom Pinned Action CTA */}
          <View style={styles.actionsContainer}>
            <PrimaryButton
              title={initialItem ? 'Save Changes' : 'Add Item'}
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
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalSheet: {
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
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
    paddingBottom: 12,
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
  scrollArea: {
    marginTop: 6,
    flexShrink: 1,
  },
  fieldLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
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
    paddingTop: 12,
  },
});
