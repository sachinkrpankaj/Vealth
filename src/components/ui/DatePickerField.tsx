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

      <View
        style={[
          styles.inputBox,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.negative : colors.border,
            borderRadius: radii.md,
          },
        ]}
      >
        <Pressable onPress={handleOpen} accessibilityRole="button" accessibilityLabel={label || 'Select date'} style={({ pressed }) => [styles.contentRow, { opacity: pressed ? 0.85 : 1 } ]}>
          <CalendarIcon
            size={16}
            color={hasValue ? colors.accent : colors.textMuted}
            style={{ marginRight: 8 }}
          />

          <View style={styles.textContainer}>
            {hasValue ? (
              <Text
                style={[
                  styles.valueText,
                  {
                    color: colors.textPrimary,
                    fontFamily: typography.fontFamilies.medium,
                  },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {displayString}
              </Text>
            ) : (
              <Text
                style={[
                  styles.placeholderText,
                  {
                    color: colors.textMuted,
                    fontFamily: typography.fontFamilies.regular,
                  },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {placeholder}
              </Text>
            )}
          </View>
        </Pressable>

        <View style={styles.rightActionsRow}>
          {isClearable && hasValue ? (
            <Pressable
              onPress={handleClear}
              hitSlop={8}
              accessibilityLabel="Clear date"
              accessibilityRole="button"
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
          ) : (
            <Pressable onPress={handleOpen} accessibilityRole="button" accessibilityLabel="Open calendar" hitSlop={8}>
              <ChevronDown size={14} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

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
    paddingHorizontal: 10,
    height: 48,
    borderWidth: 1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
    minWidth: 0,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  valueText: {
    fontSize: 13,
  },
  placeholderText: {
    fontSize: 13,
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
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
