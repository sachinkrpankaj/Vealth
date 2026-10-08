import React, { useState, useMemo, useRef, useId } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  GestureResponderEvent,
  PanResponderGestureState,
  PanResponder,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Circle,
} from 'react-native-svg';
import { Palette, Check, X, Sparkles, Hash } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LiquidGlassCard } from './LiquidGlassCard';
import { IconButton } from './IconButton';
import { KeyboardAwareScrollView } from './KeyboardAwareScrollView';
import { useTheme } from '../../theme';
import { colorFieldSelection, hexToHsv, HsvColor, hsvToHex, hueSliderSelection, normalizeHexColor } from '../../utils/colorPicker';

export const DEFAULT_COLOR_PRESETS = [
  '#3B82F6', // Royal Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#EF4444', // Coral Red
  '#64748B', // Slate
];

// Curated designer tones for 1-tap quick pick
const DESIGNER_TONES = [
  '#4F46E5', '#6366F1', '#818CF8', '#A5B4FC',
  '#059669', '#10B981', '#34D399', '#6EE7B7',
  '#D97706', '#F59E0B', '#FBBF24', '#FCD34D',
  '#E11D48', '#F43F5E', '#FB7185', '#FDA4AF',
  '#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD',
  '#0891B2', '#06B6D4', '#22D3EE', '#67E8F9',
];

interface ColorWheelPickerProps {
  selectedColor: string;
  onSelectColor: (color: string) => void;
  label?: string;
  presets?: string[];
}

export const ColorWheelPicker: React.FC<ColorWheelPickerProps> = ({
  selectedColor,
  onSelectColor,
  presets = DEFAULT_COLOR_PRESETS,
}) => {
  const { colors, isDark, typography, radii } = useTheme();
  const gradientPrefix = useId().replace(/:/g, '');
  const [modalVisible, setModalVisible] = useState(false);
  const [tempColor, setTempColor] = useState(selectedColor);

  // HSV state for visual manipulation
  const [hsv, setHsv] = useState(() => hexToHsv(selectedColor));
  const [showHexInput, setShowHexInput] = useState(false);
  const [hexInput, setHexInput] = useState(selectedColor.toUpperCase());
  const [hexError, setHexError] = useState(false);

  // Dimensions for layout-aware touch calculations
  const [sbSize, setSbSize] = useState({ width: 0, height: 0 });
  const [hueBarWidth, setHueBarWidth] = useState(0);

  // References to keep event handlers current
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;
  const sbSizeRef = useRef(sbSize);
  sbSizeRef.current = sbSize;
  const hueBarWidthRef = useRef(hueBarWidth);
  hueBarWidthRef.current = hueBarWidth;
  const dragStart = useRef({ x: 0, y: 0 });

  const openWheelModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const initialHsv = hexToHsv(selectedColor);
    hsvRef.current = initialHsv;
    setHsv(initialHsv);
    setTempColor(selectedColor);
    setHexInput(selectedColor.toUpperCase());
    setHexError(false);
    setShowHexInput(false);
    setModalVisible(true);
  };

  const updateFromHsv = (newHsv: HsvColor) => {
    hsvRef.current = newHsv;
    setHsv(newHsv);
    const hex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);
    setTempColor(hex);
    setHexInput(hex);
    setHexError(false);
  };

  const handleApplyPreset = (color: string) => {
    Haptics.selectionAsync().catch(() => {});
    const newHsv = hexToHsv(color);
    hsvRef.current = newHsv;
    setHsv(newHsv);
    setTempColor(color);
    setHexInput(color.toUpperCase());
    setHexError(false);
  };

  const handleHexSubmit = () => {
    const formatted = normalizeHexColor(hexInput);
    if (formatted) {
      setHexError(false);
      const parsedHsv = hexToHsv(formatted);
      hsvRef.current = parsedHsv;
      setHsv(parsedHsv);
      setTempColor(formatted);
      setHexInput(formatted);
      setShowHexInput(false);
    } else {
      setHexError(true);
    }
  };

  const handleConfirm = () => {
    const selected = showHexInput ? normalizeHexColor(hexInput) : tempColor;
    if (!selected) {
      setHexError(true);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onSelectColor(selected);
    setModalVisible(false);
  };

  // SVG decorations cannot receive touches; local grant coordinates belong to the field.
  // Subsequent moves use gesture deltas so dragging outside the field stays stable on Android.
  const sbPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          dragStart.current = { x: locationX, y: locationY };
          const { width, height } = sbSizeRef.current;
          updateFromHsv(colorFieldSelection(hsvRef.current, locationX, locationY, width, height));
        },
        onPanResponderMove: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
          const { width, height } = sbSizeRef.current;
          updateFromHsv(colorFieldSelection(hsvRef.current, dragStart.current.x + gesture.dx, dragStart.current.y + gesture.dy, width, height));
        },
      }),
    []
  );

  // PanResponder for 1D Hue Bar
  const huePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          const { locationX } = evt.nativeEvent;
          dragStart.current = { x: locationX, y: 0 };
          const width = hueBarWidthRef.current;
          updateFromHsv(hueSliderSelection(hsvRef.current, locationX, width));
        },
        onPanResponderMove: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
          const width = hueBarWidthRef.current;
          updateFromHsv(hueSliderSelection(hsvRef.current, dragStart.current.x + gesture.dx, width));
        },
      }),
    []
  );

  const pureHueHex = useMemo(() => hsvToHex(hsv.h, 1, 1), [hsv.h]);
  const isCustomColor = !presets.some((c) => c.toLowerCase() === selectedColor.toLowerCase());

  // Thumb positions
  const sbThumbLeft = Math.max(0, Math.min(sbSize.width - 24, hsv.s * sbSize.width - 12));
  const sbThumbTop = Math.max(0, Math.min(sbSize.height - 24, (1 - hsv.v) * sbSize.height - 12));
  const hueThumbLeft = Math.max(0, Math.min(hueBarWidth - 24, (hsv.h / 360) * hueBarWidth - 12));

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.swatchRow}
      >
        {/* Colour Wheel Trigger Button */}
        <LiquidGlassCard
          onPress={openWheelModal}
          accessibilityLabel="Open visual color picker"
          radius={19}
          padding={0}
          style={styles.wheelButton}
        >
          <Svg width={36} height={36} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={`${gradientPrefix}_rainbow`} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#EF4444" />
                <Stop offset="25%" stopColor="#F59E0B" />
                <Stop offset="50%" stopColor="#10B981" />
                <Stop offset="75%" stopColor="#3B82F6" />
                <Stop offset="100%" stopColor="#8B5CF6" />
              </LinearGradient>
            </Defs>
            <Circle
              cx={18}
              cy={18}
              r={16}
              stroke={`url(#${gradientPrefix}_rainbow)`}
              strokeWidth={2.5}
              fill="none"
            />
          </Svg>
          <Palette size={16} color={colors.accent} strokeWidth={2.2} />
        </LiquidGlassCard>

        {/* Custom picked color badge if outside presets */}
        {isCustomColor && (
          <Pressable
            onPress={() => onSelectColor(selectedColor)}
            style={[
              styles.swatchDot,
              {
                backgroundColor: selectedColor,
                borderColor: isDark ? colors.accent : '#1E1B4B',
                borderWidth: 3,
              },
            ]}
          >
            <Check size={14} color="#FFFFFF" strokeWidth={3.2} />
          </Pressable>
        )}

        {/* Presets */}
        {presets.map((c) => {
          const isSelected = selectedColor.toLowerCase() === c.toLowerCase();
          return (
            <Pressable
              key={c}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onSelectColor(c);
              }}
              style={({ pressed }) => [
                styles.swatchDot,
                {
                  backgroundColor: c,
                  borderColor: isSelected ? (isDark ? colors.accent : '#1E1B4B') : 'rgba(0,0,0,0.06)',
                  borderWidth: isSelected ? 3 : 1,
                  transform: [{ scale: pressed ? 0.9 : 1 }],
                },
              ]}
            >
              {isSelected && (
                <Check
                  size={14}
                  color="#FFFFFF"
                  strokeWidth={3.2}
                />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Visual Color Picker Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setModalVisible(false)}
            accessibilityLabel="Dismiss color picker"
          />
          <LiquidGlassCard
            radius={28}
            padding={20}
            style={styles.modalCard}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Palette size={20} color={tempColor} strokeWidth={2.5} />
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color: colors.textPrimary,
                      fontFamily: typography.fontFamilies.bold,
                    },
                  ]}
                >
                  Choose a color
                </Text>
              </View>
              <IconButton
                icon={<X size={18} color={colors.textPrimary} />}
                size={32}
                onPress={() => setModalVisible(false)}
                accessibilityLabel="Close color picker"
              />
            </View>

            <KeyboardAwareScrollView
              style={{ flex: 0, flexShrink: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >

            {/* Primary visual color field */}
            <Text
              style={[
                styles.sectionLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamilies.semibold,
                },
              ]}
            >
              Drag to choose saturation and brightness
            </Text>
            <View
              testID="color-saturation-brightness"
              accessibilityLabel="Color saturation and brightness"
              accessibilityHint="Drag horizontally for saturation and vertically for brightness"
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                if (width > 0 && height > 0) {
                  sbSizeRef.current = { width, height };
                  setSbSize({ width, height });
                }
              }}
              {...sbPanResponder.panHandlers}
              style={[
                styles.sbField,
                {
                  borderRadius: radii.md,
                  borderColor: colors.border,
                },
              ]}
            >
              <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id={`${gradientPrefix}_saturation`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                    <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                  </LinearGradient>
                  <LinearGradient id={`${gradientPrefix}_value`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
                    <Stop offset="100%" stopColor="#000000" stopOpacity="1" />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill={pureHueHex} />
                <Rect width="100%" height="100%" fill={`url(#${gradientPrefix}_saturation)`} />
                <Rect width="100%" height="100%" fill={`url(#${gradientPrefix}_value)`} />
              </Svg>

              {/* Draggable Selector Thumb */}
              <View
                pointerEvents="none"
                style={[
                  styles.sbThumb,
                  {
                    left: sbThumbLeft,
                    top: sbThumbTop,
                    backgroundColor: tempColor,
                  },
                ]}
              />
            </View>

            {/* Hue spectrum slider */}
            <Text
              style={[
                styles.sectionLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamilies.semibold,
                  marginTop: 12,
                },
              ]}
            >
              Hue
            </Text>
            <View
              testID="color-hue-slider"
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Hue"
              accessibilityValue={{ min: 0, max: 360, now: Math.round(hsv.h) }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={({ nativeEvent }) => {
                updateFromHsv({ ...hsvRef.current, h: Math.max(0, Math.min(360, hsvRef.current.h + (nativeEvent.actionName === 'increment' ? 10 : -10))) });
              }}
              onLayout={(e) => {
                const { width } = e.nativeEvent.layout;
                if (width > 0) {
                  hueBarWidthRef.current = width;
                  setHueBarWidth(width);
                }
              }}
              {...huePanResponder.panHandlers}
              style={[
                styles.hueBar,
                {
                  borderRadius: radii.full,
                  borderColor: colors.border,
                },
              ]}
            >
              <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id={`${gradientPrefix}_hue`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#FF0000" />
                    <Stop offset={`${100 / 6}%`} stopColor="#FFFF00" />
                    <Stop offset={`${100 / 3}%`} stopColor="#00FF00" />
                    <Stop offset="50%" stopColor="#00FFFF" />
                    <Stop offset={`${200 / 3}%`} stopColor="#0000FF" />
                    <Stop offset={`${500 / 6}%`} stopColor="#FF00FF" />
                    <Stop offset="100%" stopColor="#FF0000" />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" rx={13} ry={13} fill={`url(#${gradientPrefix}_hue)`} />
              </Svg>

              {/* Draggable Hue Thumb */}
              <View
                pointerEvents="none"
                style={[
                  styles.hueThumb,
                  {
                    left: hueThumbLeft,
                    backgroundColor: pureHueHex,
                  },
                ]}
              />
            </View>

            {/* Selection preview and secondary HEX input */}
            <View
              style={[
                styles.previewContainer,
                {
                  backgroundColor: isDark ? colors.surfaceSubtle : 'rgba(0,0,0,0.03)',
                  borderColor: isDark ? colors.border : 'rgba(0,0,0,0.06)',
                },
              ]}
            >
              <View
                style={[
                  styles.previewColorSwatch,
                  {
                    backgroundColor: tempColor,
                    borderColor: '#FFFFFF',
                  },
                ]}
              />
              <View style={styles.previewMeta}>
                <Text
                  style={[
                    styles.previewHexText,
                    {
                      color: colors.textPrimary,
                      fontFamily: typography.fontFamilies.bold,
                    },
                  ]}
                >
                  Selected color
                </Text>
                <Text
                  style={[
                    styles.previewSubtext,
                    {
                      color: colors.textMuted,
                      fontFamily: typography.fontFamilies.medium,
                    },
                  ]}
                >
                  {tempColor}
                </Text>
              </View>

              {/* Optional Hex Edit Toggle (Does NOT open keyboard automatically) */}
              <Pressable
                onPress={() => setShowHexInput(!showHexInput)}
                accessibilityLabel="Toggle hex input"
                hitSlop={8}
                style={[
                  styles.hexToggleBtn,
                  {
                    backgroundColor: showHexInput ? colors.accent + '20' : colors.surface,
                    borderColor: showHexInput ? colors.accent : colors.border,
                  },
                ]}
              >
                <Hash size={15} color={showHexInput ? colors.accent : colors.textSecondary} />
              </Pressable>
            </View>

            {/* Optional Secondary Hex Input (only shown when explicitly tapped) */}
            {showHexInput && (
              <View style={styles.hexInputRow}>
                <TextInput
                  value={hexInput}
                  onChangeText={(val) => {
                    setHexInput(val);
                    if (hexError) setHexError(false);
                  }}
                  onSubmitEditing={handleHexSubmit}
                  maxLength={7}
                  placeholder="#HEX"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  style={[
                    styles.hexInput,
                    {
                      color: colors.textPrimary,
                      borderColor: hexError ? colors.negative : colors.border,
                      backgroundColor: isDark ? colors.surfaceSubtle : '#FFFFFF',
                    },
                  ]}
                />
                <IconButton
                  onPress={handleHexSubmit}
                  accessibilityLabel="Apply hex value"
                  variant="success"
                  size={38}
                  icon={<Check size={14} color={colors.positive} strokeWidth={3} />}
                />
              </View>
            )}
            {hexError && <Text style={{ color: colors.negative, marginBottom: 8 }}>Enter a valid 3 or 6 digit HEX color.</Text>}

            {/* Quick color presets */}
            <Text
              style={[
                styles.sectionLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamilies.semibold,
                  marginTop: 14,
                },
              ]}
            >
              Quick colors
            </Text>
            <View style={styles.paletteGrid}>
              {DESIGNER_TONES.map((pal) => {
                const isSelected = tempColor.toLowerCase() === pal.toLowerCase();
                return (
                  <Pressable
                    key={pal}
                    onPress={() => handleApplyPreset(pal)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select color ${pal}`}
                    style={({ pressed }) => [
                      styles.paletteDot,
                      {
                        backgroundColor: pal,
                        borderColor: isSelected ? '#FFFFFF' : 'rgba(0,0,0,0.06)',
                        borderWidth: isSelected ? 2.5 : 1,
                        transform: [{ scale: pressed ? 0.9 : isSelected ? 1.15 : 1 }],
                      },
                    ]}
                  >
                    {isSelected && (
                      <Check size={11} color="#FFFFFF" strokeWidth={3.5} />
                    )}
                  </Pressable>
                );
              })}
            </View>
            </KeyboardAwareScrollView>

            {/* Confirm Button */}
            <LiquidGlassCard
              onPress={handleConfirm}
              accessibilityLabel="Apply color"
              radius={radii.md}
              padding={0}
              tone="emphasized"
              style={styles.confirmBtn}
            >
              <Sparkles size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.confirmBtnText}>Apply Color</Text>
            </LiquidGlassCard>
          </LiquidGlassCard>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  swatchDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.70)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  modalTitle: {
    fontSize: 17,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    marginBottom: 12,
    gap: 12,
  },
  previewColorSwatch: {
    width: 48,
    height: 36,
    borderRadius: 8,
    borderWidth: 2,
  },
  previewMeta: {
    flex: 1,
  },
  previewHexText: {
    fontSize: 15,
    letterSpacing: 0.5,
  },
  previewSubtext: {
    fontSize: 11,
    marginTop: 1,
  },
  hexToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hexInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  hexInput: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  sbField: {
    width: '100%',
    height: 168,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  sbThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  hueBar: {
    width: '100%',
    height: 44,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  hueThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  paletteDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
