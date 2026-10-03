import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../../theme';

export const AppBackground: React.FC = React.memo(() => {
  const { isDark } = useTheme();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${SCREEN_WIDTH} ${SCREEN_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <Defs>
          {isDark ? (
            <>
              {/* Base dark obsidian canvas with subtle cool undertone */}
              <LinearGradient id="darkBase" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#0B0C10" />
                <Stop offset="50%" stopColor="#0A0B0E" />
                <Stop offset="100%" stopColor="#08090C" />
              </LinearGradient>

              {/* Gentle top ambient cool aura */}
              <RadialGradient
                id="darkAuraCool"
                cx="50%"
                cy="0%"
                r="70%"
                fx="50%"
                fy="0%"
              >
                <Stop offset="0%" stopColor="#6366F1" stopOpacity="0.04" />
                <Stop offset="60%" stopColor="#4F46E5" stopOpacity="0.01" />
                <Stop offset="100%" stopColor="#0A0B0E" stopOpacity="0" />
              </RadialGradient>
            </>
          ) : (
            <>
              {/* Base light pearl canvas */}
              <LinearGradient id="lightBase" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#F8FAFC" />
                <Stop offset="50%" stopColor="#F1F5F9" />
                <Stop offset="100%" stopColor="#E2E8F0" />
              </LinearGradient>

              {/* Top-right vibrant modern iris / sky ambient aura */}
              <RadialGradient
                id="lightAuraLavender"
                cx="85%"
                cy="10%"
                r="70%"
                fx="85%"
                fy="10%"
              >
                <Stop offset="0%" stopColor="#6366F1" stopOpacity="0.10" />
                <Stop offset="45%" stopColor="#818CF8" stopOpacity="0.05" />
                <Stop offset="100%" stopColor="#F1F5F9" stopOpacity="0" />
              </RadialGradient>

              {/* Mid-left crisp Sky ambient aura (replaces muddy yellow) */}
              <RadialGradient
                id="lightAuraGold"
                cx="12%"
                cy="44%"
                r="60%"
                fx="12%"
                fy="44%"
              >
                <Stop offset="0%" stopColor="#38BDF8" stopOpacity="0.08" />
                <Stop offset="50%" stopColor="#818CF8" stopOpacity="0.03" />
                <Stop offset="100%" stopColor="#F1F5F9" stopOpacity="0" />
              </RadialGradient>

              {/* Bottom-right soft Cyan / Emerald freshness */}
              <RadialGradient
                id="lightAuraBottom"
                cx="75%"
                cy="86%"
                r="60%"
                fx="75%"
                fy="86%"
              >
                <Stop offset="0%" stopColor="#06B6D4" stopOpacity="0.15" />
                <Stop offset="45%" stopColor="#10B981" stopOpacity="0.07" />
                <Stop offset="100%" stopColor="#E6ECF7" stopOpacity="0" />
              </RadialGradient>

              {/* Center soft crystalline highlight */}
              <RadialGradient
                id="lightAuraCenter"
                cx="48%"
                cy="25%"
                r="50%"
                fx="48%"
                fy="25%"
              >
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </RadialGradient>
            </>
          )}
        </Defs>

        {isDark ? (
          <>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#darkBase)" />
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#darkAuraCool)" />
          </>
        ) : (
          <>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#lightBase)" />
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#lightAuraLavender)" />
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#lightAuraGold)" />
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#lightAuraBottom)" />
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#lightAuraCenter)" />
          </>
        )}
      </Svg>
    </View>
  );
});
