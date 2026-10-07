import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { ChevronDown, Check, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { IconButton } from './IconButton';

export interface SelectSheetOption<T = string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ size: number; color: string }> | React.ReactNode;
  color?: string;
  badge?: string;
}

export interface SelectSheetFieldProps<T = string> {
  label: string;
  value: T;
  options: SelectSheetOption<T>[];
  onSelect: (value: T) => void;
  title?: string;
  subtitle?: string;
  placeholder?: string;
  error?: string | null;
  disabled?: boolean;
  required?: boolean;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

export function SelectSheetField<T = string>({
  label,
  value,
  options,
  onSelect,
  title,
  subtitle,
  placeholder = 'Select...',
  error,
  disabled = false,
  required = false,
  style,
  containerStyle,
}: SelectSheetFieldProps<T>) {
  const { colors, radii, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  const renderIcon = (
    icon: React.ComponentType<{ size: number; color: string }> | React.ReactNode | undefined,
    color?: string
  ) => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return icon;
    }
    if (
      typeof icon === 'function' ||
      (typeof icon === 'object' && icon !== null && ('render' in icon || '$$typeof' in icon))
    ) {
      const IconComponent = icon as React.ComponentType<{ size: number; color: string }>;
      return <IconComponent size={20} color={color || colors.accent} />;
    }
    return null;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          {label} {required ? '*' : ''}
        </Text>
      ) : null}

      <Pressable
        onPress={() => {
          if (!disabled) setModalVisible(true);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selectedOption ? selectedOption.label : placeholder}. Tap to choose.`}
        accessibilityState={{ expanded: modalVisible, disabled }}
        style={({ pressed }) => [
          styles.triggerCard,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.negative || '#EF4444' : colors.border,
            borderRadius: radii.md,
            opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
          },
          style,
        ]}
      >
        <View style={styles.triggerLeft}>
          {selectedOption?.icon ? (
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor: selectedOption.color
                    ? `${selectedOption.color}18`
                    : colors.surfaceSubtle,
                  borderRadius: radii.sm,
                },
              ]}
            >
              {renderIcon(selectedOption.icon, selectedOption.color)}
            </View>
          ) : null}
          <View style={styles.triggerDetails}>
            <Text
              style={[
                styles.triggerValue,
                {
                  color: selectedOption ? colors.textPrimary : colors.textMuted,
                  fontSize: typography.fontSizes.body,
                },
              ]}
              numberOfLines={1}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </Text>
            {selectedOption?.description ? (
              <Text
                style={[
                  styles.triggerDesc,
                  {
                    color: colors.textSecondary,
                    fontSize: typography.fontSizes.caption,
                  },
                ]}
                numberOfLines={1}
              >
                {selectedOption.description}
              </Text>
            ) : null}
          </View>
        </View>

        <ChevronDown size={18} color={colors.textMuted} style={styles.chevron} />
      </Pressable>

      {error ? (
        <Text style={[styles.errorText, { color: colors.negative || '#EF4444' }]}>
          {error}
        </Text>
      ) : null}

      {/* Selection Bottom Sheet */}
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
            accessibilityLabel="Close selection sheet"
          />

          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.surfaceElevated || colors.surface,
                borderTopLeftRadius: radii.xl,
                borderTopRightRadius: radii.xl,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom + 16, 32),
              },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderTextCol}>
                <Text
                  style={[
                    styles.sheetTitle,
                    {
                      color: colors.textPrimary,
                      fontSize: typography.fontSizes.headingSm,
                    },
                  ]}
                >
                  {title || label}
                </Text>
                <Text
                  style={[
                    styles.sheetSubtitle,
                    {
                      color: colors.textSecondary,
                      fontSize: typography.fontSizes.caption,
                    },
                  ]}
                >
                  {subtitle || `Choose ${label.toLowerCase()}`}
                </Text>
              </View>

              <IconButton
                icon={<X size={16} color={colors.textPrimary} />}
                size={32}
                onPress={() => setModalVisible(false)}
                accessibilityLabel="Close selection"
              />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetScrollContent}
            >
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <Pressable
                    key={String(opt.value)}
                    onPress={() => {
                      onSelect(opt.value);
                      setModalVisible(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${opt.label}${opt.description ? `: ${opt.description}` : ''}`}
                    style={({ pressed }) => [
                      styles.optionRow,
                      {
                        backgroundColor: isSelected
                          ? `${colors.accent}14`
                          : pressed
                          ? colors.surfaceSubtle
                          : 'transparent',
                        borderColor: isSelected
                          ? colors.accent
                          : colors.borderSubtle || 'transparent',
                        borderRadius: radii.md,
                      },
                    ]}
                  >
                    {opt.icon ? (
                      <View
                        style={[
                          styles.optionIconBadge,
                          {
                            backgroundColor: opt.color
                              ? `${opt.color}18`
                              : colors.surfaceSubtle,
                            borderRadius: radii.sm,
                          },
                        ]}
                      >
                        {renderIcon(opt.icon, opt.color)}
                      </View>
                    ) : null}

                    <View style={styles.optionContent}>
                      <View style={styles.optionTitleRow}>
                        <Text
                          style={[
                            styles.optionTitle,
                            {
                              color: isSelected ? colors.accent : colors.textPrimary,
                              fontSize: typography.fontSizes.body,
                              fontWeight: isSelected ? '700' : '600',
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                        {opt.badge ? (
                          <View
                            style={[
                              styles.badge,
                              {
                                backgroundColor: colors.surfaceSubtle,
                                borderRadius: radii.xs,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                {
                                  color: colors.textMuted,
                                  fontSize: typography.fontSizes.micro,
                                },
                              ]}
                            >
                              {opt.badge}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {opt.description ? (
                        <Text
                          style={[
                            styles.optionDesc,
                            {
                              color: colors.textSecondary,
                              fontSize: typography.fontSizes.caption,
                            },
                          ]}
                        >
                          {opt.description}
                        </Text>
                      ) : null}
                    </View>

                    {isSelected ? (
                      <Check size={18} color={colors.accent} style={styles.checkIcon} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  triggerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    minHeight: 52,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  iconBadge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerDetails: {
    flex: 1,
  },
  triggerValue: {
    fontWeight: '600',
  },
  triggerDesc: {
    marginTop: 2,
  },
  chevron: {
    marginLeft: 4,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  modalSheet: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
    opacity: 0.5,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetHeaderTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  sheetTitle: {
    fontWeight: '700',
  },
  sheetSubtitle: {
    marginTop: 2,
  },
  sheetScrollContent: {
    paddingBottom: 24,
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  optionIconBadge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionTitle: {
    marginBottom: 2,
  },
  optionDesc: {
    lineHeight: 16,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontWeight: '700',
  },
  checkIcon: {
    marginLeft: 8,
  },
});
