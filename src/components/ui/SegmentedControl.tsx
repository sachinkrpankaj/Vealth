import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../theme';
import * as Haptics from 'expo-haptics';

export interface SegmentOption<T extends string = string> {
  key: T;
  label: string;
  badge?: number | string;
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  activeKey: T;
  onChange: (key: T) => void;
  style?: any;
}

export function SegmentedControl<T extends string = string>({
  options,
  activeKey,
  onChange,
  style,
}: SegmentedControlProps<T>) {
  const { colors, typography, isDark } = useTheme();

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
        },
        style,
      ]}
    >
      {options.map((opt) => {
        const isActive = opt.key === activeKey;
        return (
          <Pressable
            key={opt.key}
            onPress={() => {
              if (!isActive) {
                Haptics.selectionAsync().catch(() => {});
                onChange(opt.key);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${opt.label}${opt.badge !== undefined ? `, ${opt.badge}` : ''}`}
            style={({ pressed }) => [
              styles.segment,
              isActive
                ? [
                    styles.activeSegment,
                    {
                      backgroundColor: isDark ? '#222436' : '#FFFFFF',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.04)',
                    },
                  ]
                : {
                    opacity: pressed ? 0.7 : 1,
                  },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: isActive
                    ? isDark
                      ? '#FFFFFF'
                      : colors.textPrimary
                    : colors.textSecondary,
                  fontFamily: isActive
                    ? typography.fontFamilies.bold
                    : typography.fontFamilies.semibold,
                },
              ]}
              numberOfLines={1}
            >
              {opt.label}
              {opt.badge !== undefined ? ` (${opt.badge})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
  },
  segment: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    paddingHorizontal: 12,
  },
  activeSegment: {
    borderWidth: 1,
    elevation: 3,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
  },
  segmentText: {
    fontSize: 13,
  },
});
