import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Calendar as CalendarIcon, X, ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CalendarModal } from './CalendarModal';
import { useTheme } from '../../theme';
import { formatDisplayDate } from '../../utils/dateUtils';

export interface DatePickerFieldProps {
  label?: string;
  value: string; // ISO format: YYYY-MM-DD
  onChange: (dateStr: string) => void;
  placeholder?: string;
  isClearable?: boolean;
  title?: string;
  minDate?: string;
  maxDate?: string;
  includeFutureShortcuts?: boolean;
  style?: StyleProp<ViewStyle>;
  error?: string;
}

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  isClearable = false,
  title,
  minDate,
  maxDate,
  includeFutureShortcuts = true,
  style,
  error,
}: DatePickerFieldProps) {
  const { colors, typography, radii } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const handleOpen = () => {
    Haptics.selectionAsync().catch(() => {});
    setModalVisible(true);
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onChange('');
  };

  const hasValue = Boolean(value && value.trim().length > 0);
  const displayString = hasValue ? formatDisplayDate(value) : '';

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <Text
          style={[
            styles.label,
            {
              color: colors.textSecondary,
              fontFamily: typography.fontFamilies.semibold,
            },
          ]}
        >
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={handleOpen}
        style={({ pressed }) => [
          styles.inputBox,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.negative : colors.border,
            borderRadius: radii.md,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={styles.contentRow}>
          <CalendarIcon
            size={17}
            color={hasValue ? colors.gold : colors.textMuted}
            style={{ marginRight: 10 }}
          />

          <View style={styles.textContainer}>
            {hasValue ? (
              <View style={styles.valueRow}>
                <Text
                  style={[
                    styles.valueText,
                    {
                      color: colors.textPrimary,
                      fontFamily: typography.fontFamilies.medium,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {displayString}
                </Text>
                <Text
                  style={[
                    styles.isoBadge,
                    {
                      color: colors.textMuted,
                      fontFamily: typography.fontFamilies.regular,
                    },
                  ]}
                >
                  ({value})
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.placeholderText,
                  {
                    color: colors.textMuted,
                    fontFamily: typography.fontFamilies.regular,
                  },
                ]}
              >
                {placeholder}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.rightActionsRow}>
          {isClearable && hasValue && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              hitSlop={8}
              style={({ pressed }) => [
                styles.clearBtn,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderRadius: radii.full,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <X size={12} color={colors.textSecondary} />
            </Pressable>
          )}

          <ChevronDown size={15} color={colors.textMuted} style={{ marginLeft: 4 }} />
        </View>
      </Pressable>

      {error ? (
        <Text style={[styles.errorText, { color: colors.negative }]}>{error}</Text>
      ) : null}

      <CalendarModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        selectedDate={value}
        onSelectDate={onChange}
        title={title || label || 'Select Date'}
        minDate={minDate}
        maxDate={maxDate}
        allowClear={isClearable}
        onClear={() => onChange('')}
        includeFutureShortcuts={includeFutureShortcuts}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  textContainer: {
    flex: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  valueText: {
    fontSize: 14,
  },
  isoBadge: {
    fontSize: 12,
  },
  placeholderText: {
    fontSize: 14,
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearBtn: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
});
