import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Platform,
  Animated,
} from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  X,
  Check,
  RotateCcw,
  ChevronDown,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LiquidGlassCard } from './LiquidGlassCard';
import { useTheme } from '../../theme';
import {
  CalendarDay,
  WEEKDAYS_SHORT,
  getMonthMatrix,
  getMonthName,
  formatDateIso,
  formatDisplayDate,
  parseDateIso,
  getSelectableDateShortcuts,
  getEffectiveDateBounds,
  isDateDisabled,
  selectDateWithinBounds,
} from '../../utils/dateUtils';

export { isDateDisabled };

export interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate?: string; // ISO format: YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  title?: string;
  minDate?: string;
  maxDate?: string;
  allowClear?: boolean;
  onClear?: () => void;
  includeFutureShortcuts?: boolean;
  allowFutureDates?: boolean;
}

export function CalendarModal({
  visible,
  onClose,
  selectedDate,
  onSelectDate,
  title = 'Select Date',
  minDate,
  maxDate,
  allowClear = false,
  onClear,
  includeFutureShortcuts = true,
  allowFutureDates = true,
}: CalendarModalProps) {
  const { colors, typography, radii, spacing, isDark } = useTheme();

  const todayDate = new Date();
  const todayStr = formatDateIso(todayDate);
  const effectiveBounds = useMemo(
    () => getEffectiveDateBounds(minDate, maxDate, allowFutureDates, todayStr),
    [minDate, maxDate, allowFutureDates, todayStr]
  );
  const effectiveMinDate = effectiveBounds.minDate;
  const effectiveMaxDate = effectiveBounds.maxDate;

  const checkDateDisabled = useCallback(
    (dateStr: string): boolean => {
      return isDateDisabled(dateStr, effectiveMinDate, effectiveMaxDate, true, todayStr);
    },
    [effectiveMinDate, effectiveMaxDate, todayStr]
  );

  // Selected date inside modal before confirmation
  const [tempSelectedDate, setTempSelectedDate] = useState<string>(() => {
    const initial = selectedDate || todayStr;
    if (effectiveMaxDate && initial > effectiveMaxDate) return effectiveMaxDate;
    if (effectiveMinDate && initial < effectiveMinDate) return effectiveMinDate;
    return initial;
  });

  // Calendar month/year navigation state
  const [viewYear, setViewYear] = useState<number>(() => {
    const parsed = parseDateIso(selectedDate);
    return parsed ? parsed.getFullYear() : new Date().getFullYear();
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    const parsed = parseDateIso(selectedDate);
    return parsed ? parsed.getMonth() : new Date().getMonth();
  });

  // Toggle year/month fast-jump grid
  const [showFastPicker, setShowFastPicker] = useState(false);

  // Sync state when modal opens or selectedDate prop changes
  useEffect(() => {
    if (visible) {
      let initial = selectedDate || todayStr;
      if (effectiveMaxDate && initial > effectiveMaxDate) {
        initial = effectiveMaxDate;
      }
      if (effectiveMinDate && initial < effectiveMinDate) {
        initial = effectiveMinDate;
      }
      setTempSelectedDate(initial);
      const parsed = parseDateIso(initial);
      if (parsed) {
        setViewYear(parsed.getFullYear());
        setViewMonth(parsed.getMonth());
      }
      setShowFastPicker(false);
    }
  }, [visible, selectedDate, effectiveMinDate, effectiveMaxDate, todayStr]);

  // Generate calendar days matrix
  const daysMatrix = useMemo(() => {
    return getMonthMatrix(viewYear, viewMonth);
  }, [viewYear, viewMonth]);

  // Quick preset shortcuts
  const shortcuts = useMemo(() => {
    return getSelectableDateShortcuts(
      includeFutureShortcuts && allowFutureDates,
      effectiveBounds,
      todayDate
    );
  }, [includeFutureShortcuts, allowFutureDates, effectiveBounds, todayStr]);

  // Navigate to previous month
  const handlePrevMonth = () => {
    Haptics.selectionAsync().catch(() => {});
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  // Navigate to next month
  const handleNextMonth = () => {
    Haptics.selectionAsync().catch(() => {});
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Select a day cell
  const handleDayPress = (day: CalendarDay) => {
    if (checkDateDisabled(day.dateStr)) return;
    Haptics.selectionAsync().catch(() => {});
    setTempSelectedDate(day.dateStr);

    // If tapped a leading or trailing day from another month, navigate to that month
    if (!day.isCurrentMonth) {
      setViewYear(day.year);
      setViewMonth(day.month);
    }
  };

  // Apply a quick shortcut
  const handleShortcutPress = (dateStr: string) => {
    const selectedDate = selectDateWithinBounds(dateStr, effectiveBounds);
    if (!selectedDate) return;
    Haptics.selectionAsync().catch(() => {});
    setTempSelectedDate(selectedDate);
    const parsed = parseDateIso(dateStr);
    if (parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
  };

  // Smooth slide-up and fade animation
  const slideAnim = useRef(new Animated.Value(240)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(240);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 24,
          mass: 0.9,
          stiffness: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleSmoothClose = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 240,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (callback) callback();
      onClose();
    });
  };

  // Clear date
  const handleClearPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    handleSmoothClose(() => {
      if (onClear) {
        onClear();
      } else {
        onSelectDate('');
      }
    });
  };

  const isConfirmDisabled = !tempSelectedDate || checkDateDisabled(tempSelectedDate);

  // Confirm selection
  const handleConfirm = () => {
    if (isConfirmDisabled) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    handleSmoothClose(() => {
      onSelectDate(tempSelectedDate);
    });
  };

  // Generate list of selectable years (e.g. 10 years past to 10 years future)
  const currentYear = new Date().getFullYear();
  const selectableYears = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear - 10; y <= currentYear + 10; y++) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => handleSmoothClose()}
    >
      <View style={styles.modalOverlay}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => handleSmoothClose()} />
        </Animated.View>

        <Animated.View
          style={[
            { width: '100%', maxWidth: 380 },
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <LiquidGlassCard
            radius={24}
            padding={20}
            style={styles.dialogCard}
          >
            {/* Header */}
            <View style={styles.dialogHeader}>
              <View style={styles.dialogHeaderTitleRow}>
                <View
                  style={[
                    styles.titleIconBadge,
                    { backgroundColor: colors.accentBg, borderRadius: radii.full },
                  ]}
                >
                  <CalendarIcon size={16} color={colors.accent} strokeWidth={2.4} />
                </View>
                <Text
                  style={[
                    styles.dialogTitle,
                    {
                      color: colors.textPrimary,
                      fontFamily: typography.fontFamilies.bold,
                    },
                  ]}
                >
                  {title}
                </Text>
              </View>

              <LiquidGlassCard onPress={() => handleSmoothClose()} hitSlop={8} accessibilityLabel="Close calendar" radius={radii.full} padding={0} style={styles.closeBtn}>
                <X size={16} color={colors.textSecondary} />
              </LiquidGlassCard>
            </View>

          {/* Month & Year Navigation Bar */}
          <View style={[styles.navBar, { borderBottomColor: colors.borderSubtle }]}>
            <LiquidGlassCard onPress={handlePrevMonth} hitSlop={8} accessibilityLabel="Previous month" radius={radii.full} padding={0} style={styles.navArrowBtn}>
              <ChevronLeft size={18} color={colors.textPrimary} />
            </LiquidGlassCard>

            <LiquidGlassCard
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setShowFastPicker(!showFastPicker);
              }}
              accessibilityLabel="Choose month and year"
              radius={radii.full}
              padding={0}
              tone={showFastPicker ? 'emphasized' : 'default'}
              style={styles.monthYearSelectorBtn}
            >
              <Text
                style={[
                  styles.monthYearText,
                  {
                    color: showFastPicker ? colors.accent : colors.textPrimary,
                    fontFamily: typography.fontFamilies.bold,
                  },
                ]}
              >
                {getMonthName(viewMonth)} {viewYear}
              </Text>
              <ChevronDown
                size={14}
                color={showFastPicker ? colors.accent : colors.textSecondary}
                style={{
                  marginLeft: 4,
                  transform: [{ rotate: showFastPicker ? '180deg' : '0deg' }],
                }}
              />
            </LiquidGlassCard>

            <LiquidGlassCard onPress={handleNextMonth} hitSlop={8} accessibilityLabel="Next month" radius={radii.full} padding={0} style={styles.navArrowBtn}>
              <ChevronRight size={18} color={colors.textPrimary} />
            </LiquidGlassCard>
          </View>

          {/* Fast Month / Year Jump View */}
          {showFastPicker ? (
            <View style={styles.fastPickerContainer}>
              <Text
                style={[
                  styles.fastPickerSubtitle,
                  { color: colors.textSecondary, fontFamily: typography.fontFamilies.semibold },
                ]}
              >
                Jump to Month
              </Text>
              <View style={styles.monthsGrid}>
                {Array.from({ length: 12 }).map((_, idx) => {
                  const isCurrentMonthActive = viewMonth === idx;
                  return (
                    <LiquidGlassCard
                      key={idx}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setViewMonth(idx);
                      }}
                      radius={radii.sm}
                      padding={0}
                      tone={isCurrentMonthActive ? 'emphasized' : 'default'}
                      style={styles.monthChip}
                    >
                      <Text
                        style={[
                          styles.monthChipText,
                          {
                            color: isCurrentMonthActive ? '#FFFFFF' : colors.textPrimary,
                            fontFamily: isCurrentMonthActive
                              ? typography.fontFamilies.bold
                              : typography.fontFamilies.medium,
                          },
                        ]}
                      >
                        {getMonthName(idx, true)}
                      </Text>
                    </LiquidGlassCard>
                  );
                })}
              </View>

              <Text
                style={[
                  styles.fastPickerSubtitle,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamilies.semibold,
                    marginTop: 12,
                  },
                ]}
              >
                Jump to Year
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.yearsRow}
              >
                {selectableYears.map((yr) => {
                  const isYrActive = viewYear === yr;
                  return (
                    <LiquidGlassCard
                      key={yr}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setViewYear(yr);
                      }}
                      radius={radii.sm}
                      padding={0}
                      tone={isYrActive ? 'emphasized' : 'default'}
                      style={styles.yearChip}
                    >
                      <Text
                        style={[
                          styles.yearChipText,
                          {
                            color: isYrActive ? '#FFFFFF' : colors.textPrimary,
                            fontFamily: isYrActive
                              ? typography.fontFamilies.bold
                              : typography.fontFamilies.medium,
                          },
                        ]}
                      >
                        {yr}
                      </Text>
                    </LiquidGlassCard>
                  );
                })}
              </ScrollView>

              <LiquidGlassCard onPress={() => setShowFastPicker(false)} radius={radii.md} padding={0} style={styles.closeFastPickerBtn}>
                <Text
                  style={[
                    styles.closeFastPickerBtnText,
                    { color: colors.textPrimary, fontFamily: typography.fontFamilies.semibold },
                  ]}
                >
                  Return to Calendar Grid
                </Text>
              </LiquidGlassCard>
            </View>
          ) : (
            <>
              {/* Weekday Column Headers */}
              <View style={styles.weekdayRow}>
                {WEEKDAYS_SHORT.map((wd, index) => (
                  <View key={wd + index} style={styles.weekdayCol}>
                    <Text
                      style={[
                        styles.weekdayText,
                        {
                          color: index === 0 || index === 6 ? colors.negative : colors.textMuted,
                          fontFamily: typography.fontFamilies.semibold,
                        },
                      ]}
                    >
                      {wd}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Month Days Grid */}
              <View style={styles.daysGrid}>
                {daysMatrix.map((day) => {
                  const isSelected = day.dateStr === tempSelectedDate;
                  const isDisabled = checkDateDisabled(day.dateStr);
                  return (
                    <View key={day.dateStr} style={styles.dayCol}>
                      <Pressable
                        onPress={() => handleDayPress(day)}
                        disabled={isDisabled}
                        accessibilityState={{ disabled: isDisabled }}
                        style={({ pressed }) => [
                          styles.dayCell,
                          {
                            borderRadius: radii.md,
                            backgroundColor: isSelected
                              ? colors.accent
                              : day.isToday && !isDisabled
                              ? colors.surfaceSubtle
                              : 'transparent',
                            borderColor: day.isToday && !isSelected && !isDisabled
                              ? colors.accent
                              : 'transparent',
                            borderWidth: day.isToday && !isSelected && !isDisabled ? 1 : 0,
                            opacity: isDisabled ? 0.25 : 1,
                            transform: [{ scale: pressed && !isDisabled ? 0.9 : isSelected ? 1.05 : 1 }],
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumberText,
                            {
                              color: isSelected
                                ? '#FFFFFF'
                                : isDisabled
                                ? colors.textMuted
                                : day.isCurrentMonth
                                ? colors.textPrimary
                                : colors.textMuted,
                              opacity: isDisabled ? 0.4 : day.isCurrentMonth || isSelected ? 1 : 0.35,
                              fontFamily: isSelected || (day.isToday && !isDisabled)
                                ? typography.fontFamilies.bold
                                : typography.fontFamilies.medium,
                            },
                          ]}
                        >
                          {day.dayNumber}
                        </Text>
                        {day.isToday && !isSelected && !isDisabled && (
                          <View
                            style={[
                              styles.todayDot,
                              { backgroundColor: colors.accent, borderRadius: radii.full },
                            ]}
                          />
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Quick Preset Shortcuts */}
          <View style={styles.shortcutsRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shortcutsScrollContent}
            >
              {shortcuts.map((sc) => {
                const isActive = tempSelectedDate === sc.dateStr;
                return (
                  <LiquidGlassCard key={sc.label} onPress={() => handleShortcutPress(sc.dateStr)} radius={radii.full} padding={0} tone={isActive ? 'emphasized' : 'default'} style={styles.shortcutChip}>
                    <Text
                      style={[
                        styles.shortcutText,
                        {
                          color: isActive ? '#FFFFFF' : colors.textSecondary,
                          fontFamily: isActive
                            ? typography.fontFamilies.bold
                            : typography.fontFamilies.medium,
                        },
                      ]}
                    >
                      {sc.label}
                    </Text>
                  </LiquidGlassCard>
                );
              })}

              {allowClear && (
                <LiquidGlassCard onPress={handleClearPress} radius={radii.full} padding={0} tone="negative" style={styles.shortcutChip}>
                  <RotateCcw size={11} color={colors.negative} style={{ marginRight: 4 }} />
                  <Text
                    style={[
                      styles.shortcutText,
                      {
                        color: colors.negative,
                        fontFamily: typography.fontFamilies.medium,
                      },
                    ]}
                  >
                    Clear
                  </Text>
                </LiquidGlassCard>
              )}
            </ScrollView>
          </View>

          {/* Selected Date Summary & Actions */}
          <View style={[styles.dialogFooter, { borderTopColor: colors.borderSubtle }]}>
            <View style={styles.datePreviewBox}>
              <Text
                style={[
                  styles.datePreviewLabel,
                  { color: colors.textMuted, fontFamily: typography.fontFamilies.medium },
                ]}
              >
                Selected
              </Text>
              <Text
                style={[
                  styles.datePreviewValue,
                  { color: colors.textPrimary, fontFamily: typography.fontFamilies.bold },
                ]}
              >
                {tempSelectedDate ? formatDisplayDate(tempSelectedDate) : 'No date'}
              </Text>
            </View>

            <View style={styles.footerButtons}>
              <LiquidGlassCard onPress={() => handleSmoothClose()} radius={radii.md} padding={0} style={styles.cancelBtn}>
                <Text
                  style={[
                    styles.cancelBtnText,
                    { color: colors.textSecondary, fontFamily: typography.fontFamilies.semibold },
                  ]}
                >
                  Cancel
                </Text>
              </LiquidGlassCard>

              <LiquidGlassCard
                onPress={handleConfirm}
                disabled={isConfirmDisabled}
                radius={radii.md}
                padding={0}
                tone="emphasized"
                style={[styles.confirmBtn, isConfirmDisabled && { opacity: 0.4 }]}
              >
                <Check size={16} color="#FFFFFF" strokeWidth={2.8} />
                <Text
                  style={[
                    styles.confirmBtnText,
                    { color: '#FFFFFF', fontFamily: typography.fontFamilies.bold },
                  ]}
                >
                  Done
                </Text>
              </LiquidGlassCard>
            </View>
          </View>
        </LiquidGlassCard>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 10, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdropDismiss: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 360,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dialogHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIconBadge: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  dialogTitle: {
    fontSize: 16,
  },
  closeBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    marginBottom: 10,
    borderBottomWidth: 1,
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthYearSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
  },
  monthYearText: {
    fontSize: 14,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 12,
    textTransform: 'uppercase',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCol: {
    width: '14.285%',
    aspectRatio: 1,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCell: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumberText: {
    fontSize: 13,
  },
  todayDot: {
    width: 4,
    height: 4,
    position: 'absolute',
    bottom: 3,
  },
  shortcutsRow: {
    marginTop: 10,
    marginBottom: 8,
  },
  shortcutsScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shortcutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
  },
  shortcutText: {
    fontSize: 12,
  },
  fastPickerContainer: {
    paddingVertical: 10,
  },
  fastPickerSubtitle: {
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  monthChip: {
    width: '23%',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthChipText: {
    fontSize: 12,
  },
  yearsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
  },
  yearChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearChipText: {
    fontSize: 13,
  },
  closeFastPickerBtn: {
    marginTop: 14,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  closeFastPickerBtnText: {
    fontSize: 13,
  },
  dialogFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
  },
  datePreviewBox: {
    flex: 1,
    marginRight: 10,
  },
  datePreviewLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  datePreviewValue: {
    fontSize: 14,
  },
  footerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
  },
  confirmBtn: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
});
