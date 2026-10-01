import React from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';

export interface VealthLogoProps {
  size?: number;
  variant?: 'transparent' | 'badge' | 'default';
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  borderRadius?: number;
}

export const VealthLogo: React.FC<VealthLogoProps> = ({
  size = 40,
  variant = 'default',
  style,
  imageStyle,
  borderRadius,
}) => {
  const cornerRadius = borderRadius !== undefined ? borderRadius : Math.round(size * 0.22);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: cornerRadius,
        },
        variant === 'badge' && styles.badgeShadow,
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

export const VaelthLogo = VealthLogo;
export default VealthLogo;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#F3EFEA',
  },
  badgeShadow: {
    borderWidth: 1,
    borderColor: '#E2DCD5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
});
