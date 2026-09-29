export interface ColorTokens {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  positive: string;
  positiveBg: string;
  negative: string;
  negativeBg: string;
  warning: string;
  warningBg: string;
  accent: string;
  accentBg: string;
  gold: string;
  goldBg: string;
  indigo: string;
  indigoBg: string;
  cardOverlay: string;
  tabBar: string;
  tabBarBorder: string;
  squircleTab: string;
  squircleTabActive: string;
  squircleIconActive: string;
  squircleIconInactive: string;
  glassBg: string;
  glassBorder: string;
  glassHighlight: string;
  glassBottomBorder: string;
  glassShadow: string;
  indicator: string;
}

export const darkColors: ColorTokens = {
  background: '#090A0E',       // Deep midnight obsidian
  surface: '#13131B',          // Dark slate surface
  surfaceElevated: '#1C1B28',  // Elevated surface with royal indigo undertone
  surfaceSubtle: '#262438',    // Subtle interactive fill
  textPrimary: '#F8FAFC',      // Crisp clean white
  textSecondary: '#9D9CAE',    // Subtle warm slate
  textMuted: '#6B6A7E',        // Muted gray
  border: 'rgba(255, 255, 255, 0.08)',
  borderSubtle: 'rgba(255, 255, 255, 0.04)',
  positive: '#10B981',         // Emerald green
  positiveBg: 'rgba(16, 185, 129, 0.12)',
  negative: '#F43F5E',         // Rose red
  negativeBg: 'rgba(244, 63, 94, 0.12)',
  warning: '#F59E0B',          // Amber
  warningBg: 'rgba(245, 158, 11, 0.12)',
  accent: '#D4A373',           // Brushed champagne gold from logo
  accentBg: 'rgba(212, 163, 115, 0.14)',
  gold: '#D4A373',
  goldBg: 'rgba(212, 163, 115, 0.14)',
  indigo: '#7E69AB',          // Royal jewel indigo from logo
  indigoBg: 'rgba(126, 105, 171, 0.16)',
  cardOverlay: 'rgba(255, 255, 255, 0.03)',
  tabBar: 'rgba(18, 18, 25, 0.90)',
  tabBarBorder: 'rgba(255, 255, 255, 0.08)',
  squircleTab: 'rgba(255, 255, 255, 0.08)',
  squircleTabActive: '#FFFFFF',
  squircleIconActive: '#090A0E',
  squircleIconInactive: '#8E8D9E',
  glassBg: 'rgba(20, 16, 40, 0.45)',          // Dark liquid glass fill — BlurView handles frosting
  glassBorder: 'rgba(255, 255, 255, 0.10)',     // SVG prism overlay handles real border
  glassHighlight: 'rgba(255, 255, 255, 0.60)',  // Top specular streak
  glassBottomBorder: 'rgba(129, 140, 248, 0.12)', // Indigo bottom edge
  glassShadow: 'rgba(26, 10, 59, 0.60)',        // Deep violet glow shadow
  indicator: '#E2E8F0',
};

export const lightColors: ColorTokens = {
  background: '#F4F6FB',       // Crisp modern alabaster canvas
  surface: '#FFFFFF',          // Clean white surface
  surfaceElevated: '#FFFFFF',  // Soft elevated surface
  surfaceSubtle: '#F0F2F8',    // Subtle interactive fill
  textPrimary: '#0F172A',      // Slate 900
  textSecondary: '#475569',    // Slate 600
  textMuted: '#94A3B8',        // Slate 400
  border: '#E8ECF4',          // Slate 200
  borderSubtle: '#F1F5F9',    // Slate 100
  positive: '#059669',         // Deep emerald
  positiveBg: 'rgba(5, 150, 105, 0.10)',
  negative: '#E11D48',         // Deep rose
  negativeBg: 'rgba(225, 29, 72, 0.10)',
  warning: '#D97706',          // Dark amber
  warningBg: 'rgba(217, 119, 6, 0.10)',
  accent: '#B07D4C',           // Warm gold accent
  accentBg: 'rgba(176, 125, 76, 0.10)',
  gold: '#B07D4C',
  goldBg: 'rgba(176, 125, 76, 0.10)',
  indigo: '#5C448E',           // Deep royal purple
  indigoBg: 'rgba(92, 68, 142, 0.10)',
  cardOverlay: 'rgba(255, 255, 255, 0.40)',
  tabBar: 'rgba(255, 255, 255, 0.94)',
  tabBarBorder: 'rgba(255, 255, 255, 0.90)',
  squircleTab: 'rgba(0, 0, 0, 0.03)',
  squircleTabActive: '#13131B',
  squircleIconActive: '#FFFFFF',
  squircleIconInactive: '#64748B',
  glassBg: 'rgba(255, 255, 255, 0.50)',          // Light liquid glass fill — BlurView handles frosting
  glassBorder: 'rgba(255, 255, 255, 0.92)',       // SVG prism overlay handles real border
  glassHighlight: '#FFFFFF',                       // Top specular streak
  glassBottomBorder: 'rgba(148, 163, 184, 0.35)',  // Subtle slate bottom edge
  glassShadow: 'rgba(91, 33, 182, 0.18)',          // Indigo luminous glow shadow
  indicator: '#1E293B',
};
