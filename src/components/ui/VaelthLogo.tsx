import React from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { useTheme } from '../../theme';

export interface VaelthLogoProps {
  size?: number;
  variant?: 'transparent' | 'badge';
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

export const VaelthLogo: React.FC<VaelthLogoProps> = ({
  size = 40,
  variant = 'transparent',
  style,
  imageStyle,
}) => {
  const { colors, radii, isDark } = useTheme();

  const cornerRadius = Math.round(size * 0.26);

  if (variant === 'badge') {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: cornerRadius,
            backgroundColor: isDark ? '#27282D' : '#27282D',
            borderColor: isDark ? colors.border : '#2B3242',
            borderWidth: 1,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 6,
            elevation: 3,
          },
          style,
        ]}
      >
        <Image
          source={require('../../../assets/logo.png')}
          style={[
            {
              width: size * 0.9,
              height: size * 0.9,
              borderRadius: Math.round(size * 0.22),
            },
            imageStyle,
          ]}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: cornerRadius,
          backgroundColor: '#27282D',
          borderColor: isDark ? colors.borderSubtle : '#252B38',
          borderWidth: StyleSheet.hairlineWidth,
        },
        style,
      ]}
    >
      <Image
        source={require('../../../assets/logo.png')}
        style={[
          {
            width: size,
            height: size,
            borderRadius: cornerRadius,
          },
          imageStyle,
        ]}
        resizeMode="cover"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
