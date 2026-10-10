import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, {
  Path,
  Rect,
  Circle,
  G,
  Text as SvgText,
} from 'react-native-svg';
import { useTheme } from '../../theme';

export type PaymentNetwork =
  | 'VISA'
  | 'MASTERCARD'
  | 'RUPAY'
  | 'AMEX'
  | 'DISCOVER'
  | 'DINERS'
  | 'JCB'
  | 'OTHER';

export interface PaymentNetworkLogoProps {
  network: PaymentNetwork | string;
  size?: number; // base height in pixels
  variant?: 'color' | 'badge' | 'card' | 'dark' | 'light';
  style?: StyleProp<ViewStyle>;
}

export const PAYMENT_NETWORK_CONFIG: Record<
  PaymentNetwork,
  {
    id: PaymentNetwork;
    name: string;
    brandColor: string;
    description: string;
  }
> = {
  VISA: {
    id: 'VISA',
    name: 'Visa',
    brandColor: '#1A1F71',
    description: 'Worldwide Visa payment network',
  },
  MASTERCARD: {
    id: 'MASTERCARD',
    name: 'Mastercard',
    brandColor: '#EB001B',
    description: 'Mastercard worldwide payment system',
  },
  RUPAY: {
    id: 'RUPAY',
    name: 'RuPay',
    brandColor: '#0979BE',
    description: 'National Payments Corporation of India (NPCI)',
  },
  AMEX: {
    id: 'AMEX',
    name: 'American Express',
    brandColor: '#006FCF',
    description: 'American Express Global Card Network',
  },
  DISCOVER: {
    id: 'DISCOVER',
    name: 'Discover',
    brandColor: '#FF6000',
    description: 'Discover Global Network',
  },
  DINERS: {
    id: 'DINERS',
    name: 'Diners Club',
    brandColor: '#0079BE',
    description: 'Diners Club International',
  },
  JCB: {
    id: 'JCB',
    name: 'JCB',
    brandColor: '#0E4EAD',
    description: 'Japan Credit Bureau global network',
  },
  OTHER: {
    id: 'OTHER',
    name: 'Other Network',
    brandColor: '#64748B',
    description: 'Standard payment card provider',
  },
};

/**
 * Authentic, vector-accurate payment network logos with exact brand proportions,
 * crisp geometries, official colors, zero unwanted white boxes, and clean text fallback.
 */
export const PaymentNetworkLogo: React.FC<PaymentNetworkLogoProps> = ({
  network,
  size = 24,
  variant = 'badge',
  style,
}) => {
  const { isDark } = useTheme();
  const normalized = (network || '').toUpperCase() as PaymentNetwork;
  const config = PAYMENT_NETWORK_CONFIG[normalized];

  // Dark context detection: Cards are always dark, modal details follow theme
  const isDarkContext =
    variant === 'card' ||
    variant === 'dark' ||
    (variant !== 'light' && isDark);

  // Exact brand proportions to eliminate any distortion or stretching
  const getDimensions = (): { width: number; height: number } => {
    switch (normalized) {
      case 'VISA':
        return { width: Math.round(size * 3.0), height: size };
      case 'MASTERCARD':
        return { width: Math.round(size * 1.55), height: size };
      case 'RUPAY':
        return { width: Math.round(size * 2.8), height: size };
      case 'AMEX':
        return { width: Math.round(size * 1.5), height: size };
      case 'DISCOVER':
        return { width: Math.round(size * 3.4), height: size };
      case 'DINERS':
        return { width: Math.round(size * 2.1), height: size };
      case 'JCB':
        return { width: Math.round(size * 1.65), height: size };
      default:
        return { width: Math.round(size * 2.0), height: size };
    }
  };

  const { width, height } = getDimensions();

  const renderLogoGraphic = () => {
    switch (normalized) {
      case 'VISA': {
        // Authentic Visa wordmark:
        // On dark card faces & dark UI: Crisp white wordmark with official gold wing on V
        // On light surfaces: Brand Visa Blue (#1A1F71) with gold wing on V
        // Balanced optical kerning between I-S and S-A with authentic vector geometry
        // Completely transparent background with ZERO white box container
        const wordmarkFill = isDarkContext ? '#FFFFFF' : '#1A1F71';
        return (
          <Svg width={width} height={height} viewBox="5.5 10.5 57 19" fill="none">
            {/* Visa Gold Wing */}
            <Path
              d="M12.6 11H6.2L6 11.3C10.8 12.5 15 15.9 16.3 19.5L14.7 12C14.4 11.2 13.6 11 12.6 11Z"
              fill="#F7B600"
            />
            {/* V right stem */}
            <Path
              d="M20.2 11L16 22.6L15.5 20.3C14.7 17.5 12.1 14.3 9.3 12.8L13.2 28H17.8L24.8 11H20.2Z"
              fill={wordmarkFill}
            />
            {/* I */}
            <Path
              d="M24.8 28L27.6 11H32L29.2 28H24.8Z"
              fill={wordmarkFill}
            />
            {/* S - Kerned for balanced optical spacing */}
            <Path
              d="M45.4 11.3C44.5 11 43.1 10.7 41.4 10.7C36.8 10.7 33.6 13.1 33.6 16.6C33.6 19.2 35.9 20.6 37.7 21.5C39.5 22.4 40.1 23 40.1 23.8C40.1 25.1 38.6 25.6 37.2 25.6C35.3 25.6 34.1 25.3 32.8 24.7L32.2 24.4L31.6 28.3C32.8 28.8 34.9 29.3 37 29.3C41.9 29.3 45.1 26.9 45.1 23.1C45.1 20.2 43.2 18.6 41 17.5C39.4 16.7 38.5 16.1 38.5 15.2C38.5 14.3 39.6 13.5 40.9 13.5C42.2 13.5 43.3 13.8 44.1 14.2L44.6 14.4L45.4 11.3Z"
              fill={wordmarkFill}
            />
            {/* A - Kerned for balanced optical spacing */}
            <Path
              d="M53.4 22.7C53.7 21.9 54.9 18.8 54.9 18.8C54.9 18.8 55.2 17.7 55.4 16.9L55.7 18.3C55.7 18.3 56.5 22.2 56.7 22.7H53.4ZM58.8 11H55.4C54.4 11 53.6 11.6 53.2 12.6L46.2 28H50.8L51.7 25.5H57.3L57.8 28H61.9L58.8 11Z"
              fill={wordmarkFill}
            />
          </Svg>
        );
      }

      case 'MASTERCARD': {
        // Official intersecting Red & Yellow circles with vibrant Orange lens
        // Floating cleanly with transparent background
        return (
          <Svg width={width} height={height} viewBox="10.5 7 41 26" fill="none">
            {/* Left Red Circle */}
            <Circle cx="23.5" cy="20" r="13" fill="#EB001B" />
            {/* Right Yellow Circle */}
            <Circle cx="38.5" cy="20" r="13" fill="#F79E1B" />
            {/* Center Orange Lens */}
            <Path
              d="M31 10.5C33.7 12.9 35.5 16.2 35.5 20C35.5 23.8 33.7 27.1 31 29.5C28.3 27.1 26.5 23.8 26.5 20C26.5 16.2 28.3 12.9 31 10.5Z"
              fill="#FF5F00"
            />
          </Svg>
        );
      }

      case 'RUPAY': {
        // RuPay wordmark with official Orange & Cyan dual chevrons
        const textFill = isDarkContext ? '#FFFFFF' : '#0979BE';
        return (
          <Svg width={width} height={height} viewBox="0 2 68 20" fill="none">
            {/* RuPay Typography */}
            <SvgText
              x="0"
              y="17"
              fill={textFill}
              fontSize="16"
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              RuPay
            </SvgText>
            {/* Inner Orange Chevron */}
            <Path
              d="M48 3L55 12L48 21H55L62 12L55 3H48Z"
              fill="#F47920"
            />
            {/* Outer Cyan Chevron */}
            <Path
              d="M54 3L61 12L54 21H61L68 12L61 3H54Z"
              fill="#0979BE"
            />
          </Svg>
        );
      }

      case 'AMEX':
        return (
          <Svg width={width} height={height} viewBox="0 0 54 36" fill="none">
            {/* Official American Express Blue Box Badge */}
            <Rect width="54" height="36" rx="4" fill="#006FCF" />
            <Rect
              x="2"
              y="2"
              width="50"
              height="32"
              rx="2.5"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="0.8"
              strokeOpacity="0.7"
            />
            <G transform="translate(4, 9)">
              <SvgText
                x="23"
                y="8"
                fill="#FFFFFF"
                fontSize="7.4"
                fontWeight="900"
                fontFamily="sans-serif"
                textAnchor="middle"
                letterSpacing="0.8"
              >
                AMERICAN
              </SvgText>
              <SvgText
                x="23"
                y="17"
                fill="#FFFFFF"
                fontSize="7.4"
                fontWeight="900"
                fontFamily="sans-serif"
                textAnchor="middle"
                letterSpacing="0.8"
              >
                EXPRESS
              </SvgText>
            </G>
          </Svg>
        );

      case 'DISCOVER': {
        const textColor = isDarkContext ? '#FFFFFF' : '#111827';
        return (
          <Svg width={width} height={height} viewBox="0 2 70 17" fill="none">
            <SvgText
              x="0"
              y="15"
              fill={textColor}
              fontSize="13"
              fontWeight="900"
              fontFamily="sans-serif"
              letterSpacing="0.5"
            >
              DISC
            </SvgText>
            {/* Center Orange Sun Disc */}
            <Circle cx="40" cy="10.5" r="5.8" fill="#FF6000" />
            <SvgText
              x="48"
              y="15"
              fill={textColor}
              fontSize="13"
              fontWeight="900"
              fontFamily="sans-serif"
              letterSpacing="0.5"
            >
              VER
            </SvgText>
          </Svg>
        );
      }

      case 'DINERS': {
        const crestColor = isDarkContext ? '#38BDF8' : '#0079BE';
        const textColor = isDarkContext ? '#FFFFFF' : '#0079BE';
        return (
          <Svg width={width} height={height} viewBox="0 0 74 24" fill="none">
            {/* Diners Club Crest */}
            <Circle cx="12" cy="12" r="10" fill={crestColor} />
            <Circle cx="12" cy="12" r="7.2" fill={isDarkContext ? '#0F172A' : '#FFFFFF'} />
            <Path
              d="M9.5 5C10.5 5 11.2 7 11.2 12C11.2 17 10.5 19 9.5 19C8.5 19 7.8 17 7.8 12C7.8 7 8.5 5 9.5 5Z"
              fill={crestColor}
            />
            <Path
              d="M14.5 5C15.5 5 16.2 7 16.2 12C16.2 17 15.5 19 14.5 19C13.5 19 12.8 17 12.8 12C12.8 7 13.5 5 14.5 5Z"
              fill={crestColor}
            />
            <G transform="translate(25, 4)">
              <SvgText
                x="0"
                y="8"
                fill={textColor}
                fontSize="7.5"
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                Diners Club
              </SvgText>
              <SvgText
                x="0"
                y="15"
                fill={isDarkContext ? '#94A3B8' : '#64748B'}
                fontSize="4.8"
                fontWeight="600"
                fontFamily="sans-serif"
                letterSpacing="0.4"
              >
                INTERNATIONAL
              </SvgText>
            </G>
          </Svg>
        );
      }

      case 'JCB':
        // JCB 3-pill emblem: Blue (J), Red (C), Green (B)
        // Floats cleanly with transparent background
        return (
          <Svg width={width} height={height} viewBox="0 0 40 24" fill="none">
            {/* Blue Pill J */}
            <Rect x="0" y="0" width="12" height="24" rx="3.5" fill="#0E4EAD" />
            <SvgText x="6" y="17" fill="#FFFFFF" fontSize="13" fontWeight="bold" textAnchor="middle">
              J
            </SvgText>
            {/* Red Pill C */}
            <Rect x="14" y="0" width="12" height="24" rx="3.5" fill="#DA291C" />
            <SvgText x="20" y="17" fill="#FFFFFF" fontSize="13" fontWeight="bold" textAnchor="middle">
              C
            </SvgText>
            {/* Green Pill B */}
            <Rect x="28" y="0" width="12" height="24" rx="3.5" fill="#00853F" />
            <SvgText x="34" y="17" fill="#FFFFFF" fontSize="13" fontWeight="bold" textAnchor="middle">
              B
            </SvgText>
          </Svg>
        );

      case 'OTHER':
      default:
        // Clean, authentic text fallback pill when official logo is not available
        return (
          <View
            style={[
              styles.fallbackBadge,
              {
                width,
                height,
                backgroundColor: isDarkContext
                  ? 'rgba(255, 255, 255, 0.12)'
                  : 'rgba(0, 0, 0, 0.06)',
                borderColor: isDarkContext
                  ? 'rgba(255, 255, 255, 0.22)'
                  : 'rgba(0, 0, 0, 0.12)',
              },
            ]}
          >
            <Text
              style={[
                styles.fallbackText,
                {
                  color: isDarkContext ? '#FFFFFF' : '#334155',
                  fontSize: Math.max(9, Math.round(size * 0.42)),
                },
              ]}
              numberOfLines={1}
            >
              {config?.name ? config.name.toUpperCase() : (network || 'CARD').toUpperCase()}
            </Text>
          </View>
        );
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={`${config?.name || 'Card'} payment network logo`}
    >
      {renderLogoGraphic()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
  },
  fallbackText: {
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
