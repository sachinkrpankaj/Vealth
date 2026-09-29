import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const AppBackground: React.FC = React.memo(() => {
  const { isDark } = useTheme();

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
              {/* Base dark canvas */}
              <LinearGradient id="darkBase" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#08090E" />
                <Stop offset="50%" stopColor="#0A0B12" />
                <Stop offset="100%" stopColor="#07080C" />
              </LinearGradient>

              {/* Top-left Royal Indigo ambient aura */}
              <RadialGradient
                id="darkAuraIndigo"
                cx="15%"
                cy="10%"
                r="65%"
                fx="15%"
                fy="10%"
              >
                <Stop offset="0%" stopColor="#7E69AB" stopOpacity="0.18" />
                <Stop offset="50%" stopColor="#635BFF" stopOpacity="0.06" />
                <Stop offset="100%" stopColor="#08090E" stopOpacity="0" />
              </RadialGradient>

              {/* Center-right Champagne Gold ambient aura */}
              <RadialGradient
                id="darkAuraGold"
                cx="88%"
                cy="42%"
                r="55%"
                fx="88%"
                fy="42%"
              >
                <Stop offset="0%" stopColor="#D4A373" stopOpacity="0.12" />
                <Stop offset="60%" stopColor="#D4A373" stopOpacity="0.02" />
                <Stop offset="100%" stopColor="#08090E" stopOpacity="0" />
              </RadialGradient>

              {/* Bottom-left subtle Emerald depth */}
              <RadialGradient
                id="darkAuraBottom"
                cx="20%"
                cy="85%"
                r="50%"
                fx="20%"
                fy="85%"
              >
                <Stop offset="0%" stopColor="#10B981" stopOpacity="0.07" />
                <Stop offset="100%" stopColor="#08090E" stopOpacity="0" />
              </RadialGradient>
            </>
          ) : (
            <>
              {/* Base light pearl canvas */}
              <LinearGradient id="lightBase" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#F4F6FC" />
                <Stop offset="50%" stopColor="#EEF2FA" />
                <Stop offset="100%" stopColor="#E6ECF7" />
              </LinearGradient>

              {/* Top-right vibrant royal violet / lavender ambient aura */}
              <RadialGradient
                id="lightAuraLavender"
                cx="85%"
                cy="10%"
                r="70%"
                fx="85%"
                fy="10%"
              >
                <Stop offset="0%" stopColor="#7E69AB" stopOpacity="0.22" />
                <Stop offset="45%" stopColor="#818CF8" stopOpacity="0.10" />
                <Stop offset="100%" stopColor="#EEF2FA" stopOpacity="0" />
              </RadialGradient>

              {/* Mid-left warm Champagne apricot / gold aura */}
              <RadialGradient
                id="lightAuraGold"
                cx="12%"
                cy="44%"
                r="60%"
                fx="12%"
                fy="44%"
              >
                <Stop offset="0%" stopColor="#F59E0B" stopOpacity="0.18" />
                <Stop offset="50%" stopColor="#D4A373" stopOpacity="0.08" />
                <Stop offset="100%" stopColor="#EEF2FA" stopOpacity="0" />
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
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#darkAuraIndigo)" />
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#darkAuraGold)" />
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#darkAuraBottom)" />
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
