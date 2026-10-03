import React, { useState } from 'react';
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
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Circle,
} from 'react-native-svg';
import { Palette, Check, X, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LiquidGlassCard } from './LiquidGlassCard';
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

// 24 Vibrant Hues for the color spectrum (Every 15 degrees)
const HUE_WHEEL_COLORS = [
  '#FF0000', // 0° Red
  '#FF3F00', // 15°
  '#FF7F00', // 30° Orange
  '#FFBF00', // 45°
  '#FFFF00', // 60° Yellow
  '#BFFF00', // 75°
  '#7FFF00', // 90° Chartreuse
  '#3FFF00', // 105°
  '#00FF00', // 120° Green
  '#00FF7F', // 135° Spring Green
  '#00FFFF', // 150° Cyan
  '#00BFFF', // 165° Deep Sky Blue
  '#007FFF', // 180° Azure
  '#003FFF', // 195°
  '#0000FF', // 210° Blue
  '#3F00FF', // 225°
  '#7F00FF', // 240° Violet
  '#BF00FF', // 255°
  '#FF00FF', // 270° Magenta
  '#FF00BF', // 285°
  '#FF007F', // 300° Rose
  '#FF003F', // 315°
  '#E11D48', // 330° Crimson
  '#BE123C', // 345°
];

// Extended designer shades
const EXTENDED_PALETTE = [
  '#4F46E5', '#6366F1', '#818CF8', '#A5B4FC',
  '#059669', '#10B981', '#34D399', '#6EE7B7',
  '#D97706', '#F59E0B', '#FBBF24', '#FCD34D',
  '#E11D48', '#F43F5E', '#FB7185', '#FDA4AF',
  '#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD',
  '#0891B2', '#06B6D4', '#22D3EE', '#67E8F9',
  '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD',
  '#475569', '#64748B', '#94A3B8', '#CBD5E1',
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
  const { colors, isDark, typography } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [tempColor, setTempColor] = useState(selectedColor);
  const [hexInput, setHexInput] = useState(selectedColor.toUpperCase());
  const [hexError, setHexError] = useState(false);

  const openWheelModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTempColor(selectedColor);
    setHexInput(selectedColor.toUpperCase());
    setHexError(false);
    setModalVisible(true);
  };

  const handleApplyColor = (color: string) => {
    Haptics.selectionAsync().catch(() => {});
    setTempColor(color);
    setHexInput(color.toUpperCase());
    setHexError(false);
  };

  const handleHexSubmit = () => {
    let formatted = hexInput.trim();
    if (!formatted.startsWith('#')) {
      formatted = '#' + formatted;
    }
    const isValid = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(formatted);
    if (isValid) {
      setHexError(false);
      setTempColor(formatted);
      setHexInput(formatted.toUpperCase());
    } else {
      setHexError(true);
    }
  };

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onSelectColor(tempColor);
    setModalVisible(false);
  };

  const isCustomColor = !presets.some(
    (c) => c.toLowerCase() === selectedColor.toLowerCase()
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.swatchRow}
      >
        {/* Colour Wheel Trigger Button - Prominently Placed First */}
        <LiquidGlassCard onPress={openWheelModal} accessibilityLabel="Open color picker" radius={19} padding={0} style={styles.wheelButton}>
          {/* Rainbow ring overlay */}
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

      {/* Interactive Color Wheel Modal */}
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
              <LiquidGlassCard onPress={() => setModalVisible(false)} accessibilityLabel="Close color picker" radius={16} padding={0} style={styles.closeIconBtn}>
                <X size={18} color={colors.textSecondary} />
              </LiquidGlassCard>
            </View>

            {/* Live Color Preview Chip */}
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
                  styles.previewColorBubble,
                  {
                    backgroundColor: tempColor,
                    shadowColor: tempColor,
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
                  {tempColor.toUpperCase()}
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

              {/* Quick Hex Input */}
              <View style={styles.hexInputBox}>
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
                <LiquidGlassCard onPress={handleHexSubmit} accessibilityLabel="Apply hex value" radius={8} padding={0} tone="emphasized" style={styles.applyHexBtn}>
                  <Check size={14} color="#FFFFFF" strokeWidth={3} />
                </LiquidGlassCard>
              </View>
            </View>

            {/* Radial Spectrum Section */}
            <Text
              style={[
                styles.sectionLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamilies.semibold,
                },
              ]}
            >
              Chromatic Hue Spectrum
            </Text>
            <View style={styles.wheelGrid}>
              {HUE_WHEEL_COLORS.map((hue) => {
                const isPicked = tempColor.toLowerCase() === hue.toLowerCase();
                return (
                  <Pressable
                    key={hue}
                    onPress={() => handleApplyColor(hue)}
                    style={({ pressed }) => [
                      styles.hueWedge,
                      {
                        backgroundColor: hue,
                        borderColor: isPicked ? '#FFFFFF' : 'rgba(0,0,0,0.1)',
                        borderWidth: isPicked ? 2.5 : 1,
                        transform: [{ scale: pressed ? 0.9 : isPicked ? 1.15 : 1 }],
                      },
                    ]}
                  >
                    {isPicked && (
                      <Check size={11} color="#FFFFFF" strokeWidth={3.5} style={styles.checkShadow} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Extended Designer Palette */}
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
              {EXTENDED_PALETTE.map((pal) => {
                const isSelected = tempColor.toLowerCase() === pal.toLowerCase();
                return (
                  <Pressable
                    key={pal}
                    onPress={() => handleApplyColor(pal)}
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
                      <Check size={10} color="#FFFFFF" strokeWidth={3.5} style={styles.checkShadow} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Confirm Button */}
            <LiquidGlassCard onPress={handleConfirm} accessibilityLabel="Apply color" radius={23} padding={0} tone="emphasized" style={styles.confirmBtn}>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
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
    marginBottom: 16,
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
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  previewColorBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  previewMeta: {
    flex: 1,
  },
  previewHexText: {
    fontSize: 16,
    letterSpacing: 0.5,
  },
  previewSubtext: {
    fontSize: 11,
    marginTop: 1,
  },
  hexInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hexInput: {
    width: 80,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  applyHexBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  wheelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  hueWedge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 20,
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
    borderRadius: 23,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
