import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Building2, ChevronDown, Check, Search, X, Edit3 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { IconButton } from '../ui/IconButton';

export interface CardIssuerOption {
  id: string;
  name: string;
  category: string;
}

export const COMMON_CARD_ISSUERS: CardIssuerOption[] = [
  { id: 'HDFC', name: 'HDFC Bank', category: 'Major Private Bank' },
  { id: 'SBI', name: 'SBI Card', category: 'Major Public Bank' },
  { id: 'ICICI', name: 'ICICI Bank', category: 'Major Private Bank' },
  { id: 'AXIS', name: 'Axis Bank', category: 'Major Private Bank' },
  { id: 'KOTAK', name: 'Kotak Mahindra Bank', category: 'Private Bank' },
  { id: 'AMEX', name: 'American Express', category: 'Global Issuer' },
  { id: 'BOB', name: 'Bank of Baroda', category: 'Public Sector Bank' },
  { id: 'PNB', name: 'Punjab National Bank', category: 'Public Sector Bank' },
  { id: 'IDFC', name: 'IDFC FIRST Bank', category: 'Private Bank' },
  { id: 'INDUSIND', name: 'IndusInd Bank', category: 'Private Bank' },
  { id: 'RBL', name: 'RBL Bank', category: 'Private Bank' },
  { id: 'FEDERAL', name: 'Federal Bank', category: 'Private Bank' },
  { id: 'YES', name: 'YES Bank', category: 'Private Bank' },
  { id: 'STANCHAR', name: 'Standard Chartered', category: 'International Bank' },
  { id: 'CITI', name: 'Citibank', category: 'International Bank' },
  { id: 'HSBC', name: 'HSBC', category: 'International Bank' },
  { id: 'OTHER', name: 'Other (Specify Custom Issuer)', category: 'Custom' },
];

export interface CardIssuerPickerProps {
  value: string;
  onSelect: (issuer: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const CardIssuerPicker: React.FC<CardIssuerPickerProps> = ({
  value,
  onSelect,
  label = 'Bank / Card Issuer',
  error,
  disabled = false,
  required = false,
  style,
}) => {
  const { colors, radii, typography, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customInputValue, setCustomInputValue] = useState('');

  // Check if current value matches one of the predefined list
  const knownIssuer = COMMON_CARD_ISSUERS.find(
    (opt) => opt.name.toLowerCase() === (value || '').toLowerCase()
  );

  const displayTitle = value
    ? value
    : 'Select Bank or Card Issuer';

  const filteredIssuers = useMemo(() => {
    if (!searchQuery.trim()) {
      return COMMON_CARD_ISSUERS;
    }
    const q = searchQuery.toLowerCase().trim();
    return COMMON_CARD_ISSUERS.filter(
      (opt) =>
        opt.name.toLowerCase().includes(q) ||
        opt.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleSelectOption = (opt: CardIssuerOption) => {
    if (opt.id === 'OTHER') {
      setIsCustomMode(true);
      setCustomInputValue(knownIssuer ? '' : value || '');
    } else {
      setIsCustomMode(false);
      onSelect(opt.name);
      setModalVisible(false);
      setSearchQuery('');
    }
  };

  const handleConfirmCustom = () => {
    const trimmed = customInputValue.trim();
    if (trimmed) {
      onSelect(trimmed);
      setModalVisible(false);
      setIsCustomMode(false);
      setSearchQuery('');
    }
  };

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <Text
          style={[
            styles.label,
            {
              color: colors.textSecondary,
              fontFamily: typography.fontFamilies.medium,
            },
          ]}
        >
          {label} {required ? '*' : ''}
        </Text>
      ) : null}

      <Pressable
        onPress={() => {
          if (!disabled) {
            setSearchQuery('');
            // If current value is custom, default custom input to current value
            if (value && !knownIssuer) {
              setCustomInputValue(value);
            }
            setModalVisible(true);
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${displayTitle}`}
        style={({ pressed }) => [
          styles.triggerButton,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.negative || '#EF4444' : colors.border,
            borderRadius: radii.md,
            opacity: disabled ? 0.6 : pressed ? 0.88 : 1,
          },
        ]}
      >
        <View style={styles.triggerContent}>
          <View
            style={[
              styles.triggerIconWrap,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(0, 0, 0, 0.05)',
                borderRadius: radii.sm,
              },
            ]}
          >
            <Building2 size={18} color={value ? colors.accent : colors.textMuted} />
          </View>

          <View style={styles.triggerTextCol}>
            <Text
              style={[
                styles.triggerTitle,
                {
                  color: value ? colors.textPrimary : colors.textMuted,
                  fontFamily: value
                    ? typography.fontFamilies.semibold
                    : typography.fontFamilies.regular,
                },
              ]}
              numberOfLines={1}
            >
              {displayTitle}
            </Text>
            {value ? (
              <Text
                style={[
                  styles.triggerSubtitle,
                  {
                    color: colors.textMuted,
                    fontFamily: typography.fontFamilies.regular,
                  },
                ]}
                numberOfLines={1}
              >
                {knownIssuer ? knownIssuer.category : 'Custom Card Issuer'}
              </Text>
            ) : null}
          </View>
        </View>

        <ChevronDown size={18} color={colors.textSecondary} />
      </Pressable>

      {error ? (
        <Text style={[styles.errorText, { color: colors.negative }]}>{error}</Text>
      ) : null}

      {/* Searchable Picker Sheet Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setModalVisible(false);
          setIsCustomMode(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              setModalVisible(false);
              setIsCustomMode(false);
            }}
            accessibilityLabel="Close bank issuer selector"
          />

          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.surfaceElevated || colors.surface,
                borderTopLeftRadius: radii.xl,
                borderTopRightRadius: radii.xl,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom + 16, 28),
              },
            ]}
          >
            {/* Sheet Handle */}
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <View>
                <Text
                  style={[
                    styles.sheetTitle,
                    {
                      color: colors.textPrimary,
                      fontFamily: typography.fontFamilies.bold,
                      fontSize: typography.fontSizes.headingSm,
                    },
                  ]}
                >
                  Select Bank / Card Issuer
                </Text>
                <Text
                  style={[
                    styles.sheetSubtitle,
                    {
                      color: colors.textSecondary,
                      fontFamily: typography.fontFamilies.regular,
                      fontSize: typography.fontSizes.caption,
                    },
                  ]}
                >
                  Choose the financial institution that issued your card
                </Text>
              </View>

              <IconButton
                onPress={() => {
                  setModalVisible(false);
                  setIsCustomMode(false);
                }}
                accessibilityLabel="Close"
                size={34}
                icon={<X size={18} color={colors.textSecondary} />}
              />
            </View>

            {isCustomMode ? (
              /* Custom Issuer Input View */
              <View style={styles.customModeContainer}>
                <Text
                  style={[
                    styles.customInputLabel,
                    {
                      color: colors.textSecondary,
                      fontFamily: typography.fontFamilies.medium,
                    },
                  ]}
                >
                  Custom Bank or Issuer Name *
                </Text>
                <View
                  style={[
                    styles.customInputWrap,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                      borderRadius: radii.md,
                    },
                  ]}
                >
                  <Edit3 size={16} color={colors.accent} style={{ marginRight: 8 }} />
                  <TextInput
                    value={customInputValue}
                    onChangeText={setCustomInputValue}
                    placeholder="e.g. Barclays, Chase, Deutsche Bank"
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                    style={[
                      styles.customTextInput,
                      {
                        color: colors.textPrimary,
                        fontFamily: typography.fontFamilies.semibold,
                      },
                    ]}
                  />
                </View>

                <View style={styles.customActionRow}>
                  <Pressable
                    onPress={() => setIsCustomMode(false)}
                    style={[
                      styles.customCancelBtn,
                      {
                        borderColor: colors.border,
                        borderRadius: radii.md,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.customCancelText,
                        {
                          color: colors.textSecondary,
                          fontFamily: typography.fontFamilies.medium,
                        },
                      ]}
                    >
                      Back to List
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleConfirmCustom}
                    disabled={!customInputValue.trim()}
                    style={[
                      styles.customConfirmBtn,
                      {
                        backgroundColor: customInputValue.trim()
                          ? colors.accent
                          : colors.surfaceSubtle,
                        borderRadius: radii.md,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.customConfirmText,
                        {
                          color: customInputValue.trim() ? '#FFFFFF' : colors.textMuted,
                          fontFamily: typography.fontFamilies.bold,
                        },
                      ]}
                    >
                      Save Issuer
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              /* Searchable List View */
              <>
                <View
                  style={[
                    styles.searchBox,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.borderSubtle,
                      borderRadius: radii.md,
                    },
                  ]}
                >
                  <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search bank (HDFC, SBI, ICICI, Axis...)"
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.searchInput,
                      {
                        color: colors.textPrimary,
                        fontFamily: typography.fontFamilies.regular,
                      },
                    ]}
                    autoCapitalize="none"
                    clearButtonMode="while-editing"
                  />
                  {searchQuery.length > 0 && (
                    <Pressable
                      onPress={() => setSearchQuery('')}
                      hitSlop={8}
                      accessibilityLabel="Clear search"
                    >
                      <X size={14} color={colors.textMuted} />
                    </Pressable>
                  )}
                </View>

                <ScrollView
                  style={styles.optionsList}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredIssuers.map((opt) => {
                    const isSelected =
                      opt.name.toLowerCase() === (value || '').toLowerCase() ||
                      (opt.id === 'OTHER' && value && !knownIssuer);

                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => handleSelectOption(opt)}
                        style={({ pressed }) => [
                          styles.optionItem,
                          {
                            backgroundColor: isSelected
                              ? `${colors.accent}14`
                              : pressed
                              ? colors.surfaceSubtle
                              : 'transparent',
                            borderRadius: radii.md,
                          },
                        ]}
                      >
                        <View style={styles.optionLeft}>
                          <View
                            style={[
                              styles.optionIconSlot,
                              {
                                backgroundColor: isSelected
                                  ? `${colors.accent}25`
                                  : isDark
                                  ? 'rgba(255, 255, 255, 0.06)'
                                  : 'rgba(0, 0, 0, 0.04)',
                                borderRadius: radii.sm,
                              },
                            ]}
                          >
                            <Building2
                              size={16}
                              color={isSelected ? colors.accent : colors.textSecondary}
                            />
                          </View>
                          <View style={styles.optionTextCol}>
                            <Text
                              style={[
                                styles.optionName,
                                {
                                  color: isSelected ? colors.accent : colors.textPrimary,
                                  fontFamily: isSelected
                                    ? typography.fontFamilies.bold
                                    : typography.fontFamilies.semibold,
                                },
                              ]}
                            >
                              {opt.name}
                            </Text>
                            <Text
                              style={[
                                styles.optionDesc,
                                {
                                  color: colors.textMuted,
                                  fontFamily: typography.fontFamilies.regular,
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {opt.category}
                            </Text>
                          </View>
                        </View>

                        {isSelected && (
                          <View
                            style={[
                              styles.checkBadge,
                              {
                                backgroundColor: colors.accent,
                                borderRadius: radii.full,
                              },
                            ]}
                          >
                            <Check size={14} color="#FFFFFF" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
  },
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    minHeight: 56,
  },
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  triggerIconWrap: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  triggerTextCol: {
    flex: 1,
  },
  triggerTitle: {
    fontSize: 15,
  },
  triggerSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
    maxHeight: '82%',
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 17,
  },
  sheetSubtitle: {
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  optionsList: {
    maxHeight: 380,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIconSlot: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionTextCol: {
    flex: 1,
  },
  optionName: {
    fontSize: 15,
  },
  optionDesc: {
    fontSize: 11.5,
    marginTop: 1,
  },
  checkBadge: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  customModeContainer: {
    paddingVertical: 8,
  },
  customInputLabel: {
    fontSize: 13,
    marginBottom: 8,
  },
  customInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    marginBottom: 18,
  },
  customTextInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  customActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  customCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  customCancelText: {
    fontSize: 14,
  },
  customConfirmBtn: {
    flex: 1.5,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customConfirmText: {
    fontSize: 14,
  },
});
