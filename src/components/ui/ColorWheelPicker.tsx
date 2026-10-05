import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  Platform,
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
import { useTheme } from '../../theme';

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

// HSV <-> HEX Conversion Utilities
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num) || clean.length !== 6) {
    return { h: 230, s: 0.75, v: 0.95 }; // Default safe indigo
  }
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }

  return { h: Math.round(h) % 360, s, v };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) => {
    const val = Math.max(0, Math.min(255, Math.round((n + m) * 255)));
    const hex = val.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

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
  const [modalVisible, setModalVisible] = useState(false);
  const [tempColor, setTempColor] = useState(selectedColor);

  // HSV state for visual manipulation
  const [hsv, setHsv] = useState(() => hexToHsv(selectedColor));
  const [showHexInput, setShowHexInput] = useState(false);
  const [hexInput, setHexInput] = useState(selectedColor.toUpperCase());
  const [hexError, setHexError] = useState(false);

  // Dimensions for layout-aware touch calculations
  const [sbSize, setSbSize] = useState({ width: 280, height: 140 });
  const [hueBarWidth, setHueBarWidth] = useState(280);

  // References to keep event handlers current
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;
  const sbSizeRef = useRef(sbSize);
  sbSizeRef.current = sbSize;
  const hueBarWidthRef = useRef(hueBarWidth);
  hueBarWidthRef.current = hueBarWidth;

  const openWheelModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const initialHsv = hexToHsv(selectedColor);
    setHsv(initialHsv);
    setTempColor(selectedColor);
    setHexInput(selectedColor.toUpperCase());
    setHexError(false);
    setShowHexInput(false);
    setModalVisible(true);
  };

  const updateFromHsv = (newHsv: { h: number; s: number; v: number }) => {
    setHsv(newHsv);
    const hex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);
    setTempColor(hex);
    setHexInput(hex);
  };

  const handleApplyPreset = (color: string) => {
    Haptics.selectionAsync().catch(() => {});
    const newHsv = hexToHsv(color);
    setHsv(newHsv);
    setTempColor(color);
    setHexInput(color.toUpperCase());
  };

  const handleHexSubmit = () => {
    let formatted = hexInput.trim();
    if (!formatted.startsWith('#')) {
      formatted = '#' + formatted;
    }
    const isValid = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(formatted);
    if (isValid) {
      setHexError(false);
      const parsedHsv = hexToHsv(formatted);
      setHsv(parsedHsv);
      const fullHex = hsvToHex(parsedHsv.h, parsedHsv.s, parsedHsv.v);
      setTempColor(fullHex);
      setHexInput(fullHex);
      setShowHexInput(false);
    } else {
      setHexError(true);
    }
  };

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onSelectColor(tempColor);
    setModalVisible(false);
  };

  // PanResponder for Saturation-Brightness 2D Visual Field
  const sbPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const { width, height } = sbSizeRef.current;
          if (width > 0 && height > 0) {
            const s = Math.max(0, Math.min(1, locationX / width));
            const v = Math.max(0, Math.min(1, 1 - locationY / height));
            updateFromHsv({ ...hsvRef.current, s, v });
          }
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const { width, height } = sbSizeRef.current;
          if (width > 0 && height > 0) {
            const s = Math.max(0, Math.min(1, locationX / width));
            const v = Math.max(0, Math.min(1, 1 - locationY / height));
            updateFromHsv({ ...hsvRef.current, s, v });
          }
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
        onPanResponderGrant: (evt) => {
          const { locationX } = evt.nativeEvent;
          const width = hueBarWidthRef.current;
          if (width > 0) {
            const fraction = Math.max(0, Math.min(1, locationX / width));
            const h = Math.round(fraction * 360) % 360;
            updateFromHsv({ ...hsvRef.current, h });
          }
        },
        onPanResponderMove: (evt) => {
          const { locationX } = evt.nativeEvent;
          const width = hueBarWidthRef.current;
          if (width > 0) {
            const fraction = Math.max(0, Math.min(1, locationX / width));
            const h = Math.round(fraction * 360) % 360;
            updateFromHsv({ ...hsvRef.current, h });
          }
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
              <LinearGradient id="rainbowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
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
              stroke="url(#rainbowGrad)"
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
            <Check size={14} color="#FFFFFF" strokeWidth={3.2} style={styles.checkShadow} />
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
                  style={styles.checkShadow}
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
        <View style={styles.modalBackdrop}>
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
                  Color Wheel & Picker
                </Text>
              </View>
              <IconButton
                icon={<X size={18} color={colors.textPrimary} />}
                size={32}
                onPress={() => setModalVisible(false)}
                accessibilityLabel="Close color picker"
              />
            </View>

            {/* 1. Live Color Preview Swatch & Secondary Hex Reference */}
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
                  {tempColor}
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
                  Active Selection
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
                <LiquidGlassCard
                  onPress={handleHexSubmit}
                  accessibilityLabel="Apply hex value"
                  radius={8}
                  padding={0}
                  tone="emphasized"
                  style={styles.applyHexBtn}
                >
                  <Check size={14} color="#FFFFFF" strokeWidth={3} />
                </LiquidGlassCard>
              </View>
            )}

            {/* 2. Visual 2D Saturation-Brightness Picker */}
            <Text
              style={[
                styles.sectionLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamilies.semibold,
                },
              ]}
            >
              Saturation & Brightness
            </Text>
            <View
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                if (width > 0 && height > 0) {
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
              <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="satGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                    <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                  </LinearGradient>
                  <LinearGradient id="valGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
                    <Stop offset="100%" stopColor="#000000" stopOpacity="1" />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill={pureHueHex} />
                <Rect width="100%" height="100%" fill="url(#satGrad)" />
                <Rect width="100%" height="100%" fill="url(#valGrad)" />
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

            {/* 3. 1D Hue Spectrum Slider */}
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
              Hue Spectrum
            </Text>
            <View
              onLayout={(e) => {
                const { width } = e.nativeEvent.layout;
                if (width > 0) {
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
              <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="hueStrip" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#FF0000" />
                    <Stop offset="17%" stopColor="#FFFF00" />
                    <Stop offset="33%" stopColor="#00FF00" />
                    <Stop offset="50%" stopColor="#00FFFF" />
                    <Stop offset="67%" stopColor="#0000FF" />
                    <Stop offset="83%" stopColor="#FF00FF" />
                    <Stop offset="100%" stopColor="#FF0000" />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" rx={13} ry={13} fill="url(#hueStrip)" />
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

            {/* 4. Curated Designer Tones */}
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
              Curated Designer Tones
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
                      <Check size={11} color="#FFFFFF" strokeWidth={3.5} style={styles.checkShadow} />
                    )}
                  </Pressable>
                );
              })}
            </View>

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
        </View>
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
  checkShadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.5,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
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
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
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
  },
  modalTitle: {
    fontSize: 17,
    letterSpacing: -0.3,
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  previewColorSwatch: {
    width: 48,
    height: 36,
    borderRadius: 8,
    borderWidth: 2,
    elevation: 3,
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
  applyHexBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  sbField: {
    width: '100%',
    height: 130,
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
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
  hueBar: {
    width: '100%',
    height: 26,
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
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
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
    elevation: 3,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
