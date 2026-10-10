import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Search, Check, X, ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { IconButton } from '../ui/IconButton';
import {
  PaymentNetwork,
  PaymentNetworkLogo,
  PAYMENT_NETWORK_CONFIG,
} from './PaymentNetworkLogo';

export interface PaymentNetworkPickerProps {
  value: PaymentNetwork;
  onSelect: (network: PaymentNetwork) => void;
  label?: string;
  error?: string | null;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const NETWORKS_LIST: PaymentNetwork[] = [
  'VISA',
  'MASTERCARD',
  'RUPAY',
  'AMEX',
  'DISCOVER',
  'DINERS',
  'JCB',
  'OTHER',
];

export const PaymentNetworkPicker: React.FC<PaymentNetworkPickerProps> = ({
  value,
  onSelect,
  label = 'Payment Network',
  error,
  disabled = false,
  style,
}) => {
  const { colors, radii, spacing, typography, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNetworks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return NETWORKS_LIST;
    return NETWORKS_LIST.filter((net) => {
      const config = PAYMENT_NETWORK_CONFIG[net];
      return (
        config.name.toLowerCase().includes(q) ||
        config.id.toLowerCase().includes(q) ||
        config.description.toLowerCase().includes(q)
      );
    });
  }, [searchQuery]);

  const selectedConfig = PAYMENT_NETWORK_CONFIG[value] || PAYMENT_NETWORK_CONFIG.OTHER;

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
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={() => {
          if (!disabled) {
            setSearchQuery('');
            setModalVisible(true);
          }
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Payment Network: ${selectedConfig.name}. Tap to change.`}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.negative || '#EF4444' : colors.border,
            borderRadius: radii.md,
            opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={styles.triggerContent}>
          <View
            style={[
              styles.triggerLogoWrap,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                borderRadius: radii.sm,
              },
            ]}
          >
            <PaymentNetworkLogo network={value} size={20} />
          </View>
          <View style={styles.triggerTextCol}>
            <Text
              style={[
                styles.triggerTitle,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fontFamilies.semibold,
                },
              ]}
            >
              {selectedConfig.name}
            </Text>
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
              {selectedConfig.description}
            </Text>
          </View>
        </View>

        <ChevronDown size={18} color={colors.textMuted} />
      </Pressable>

      {error ? (
        <Text style={[styles.errorText, { color: colors.negative || '#EF4444' }]}>
          {error}
        </Text>
      ) : null}

      {/* Searchable Modal Bottom Sheet */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setModalVisible(false)}
            accessibilityLabel="Close payment network selector"
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
                  Select Payment Network
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
                  Choose the provider stamped on your card
                </Text>
              </View>

              <IconButton
                onPress={() => setModalVisible(false)}
                accessibilityLabel="Close"
                size={34}
                icon={<X size={18} color={colors.textSecondary} />}
              />
            </View>

            {/* Search Input */}
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
                placeholder="Search network (Visa, Mastercard, RuPay...)"
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
            </View>

            {/* Network Options List */}
            <ScrollView
              style={styles.optionsList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {filteredNetworks.map((net) => {
                const config = PAYMENT_NETWORK_CONFIG[net];
                const isSelected = net === value;

                return (
                  <Pressable
                    key={net}
                    onPress={() => {
                      onSelect(net);
                      setModalVisible(false);
                    }}
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
                          styles.optionLogoWrap,
                          {
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                            borderRadius: radii.sm,
                          },
                        ]}
                      >
                        <PaymentNetworkLogo network={net} size={20} />
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
                          {config.name}
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
                          {config.description}
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

              {filteredNetworks.length === 0 && (
                <View style={styles.emptySearch}>
                  <Text style={[styles.emptySearchText, { color: colors.textMuted }]}>
                    No payment network matches "{searchQuery}"
                  </Text>
                </View>
              )}
            </ScrollView>
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
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    minHeight: 56,
  },
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  triggerLogoWrap: {
    width: 76,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  triggerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  triggerTitle: {
    fontSize: 15,
  },
  triggerSubtitle: {
    fontSize: 12,
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
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
    maxHeight: '80%',
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
    marginBottom: 12,
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
    paddingVertical: 8,
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
    maxHeight: 360,
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
    marginRight: 8,
  },
  optionLogoWrap: {
    width: 78,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionTextCol: {
    flex: 1,
    minWidth: 0,
  },
  optionName: {
    fontSize: 15,
  },
  optionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  checkBadge: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptySearch: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 14,
  },
});
