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
  background: '#0A0B0E',       // Deep near-black obsidian canvas with subtle cool undertone
  surface: '#12131A',          // Calm obsidian surface, noticeably elevated from canvas
  surfaceElevated: '#171821',  // Slightly elevated surface for modals, dialogs, active states
  surfaceSubtle: '#1E1F2A',    // Subtle interactive fill, inputs, and segmented controls
  textPrimary: '#F1F5F9',      // Crisp clean off-white (Slate 100)
  textSecondary: '#94A3B8',    // Muted cool slate (Slate 400)
  textMuted: '#64748B',        // Darker muted cool gray (Slate 500, WCAG AA compliant)
  border: 'rgba(255, 255, 255, 0.06)',       // Subtle, low-contrast border
  borderSubtle: 'rgba(255, 255, 255, 0.03)', // Whisper separator border
  positive: '#10B981',         // Emerald green
  positiveBg: 'rgba(16, 185, 129, 0.12)',
  negative: '#F43F5E',         // Rose red
  negativeBg: 'rgba(244, 63, 94, 0.12)',
  warning: '#F59E0B',          // Amber
  warningBg: 'rgba(245, 158, 11, 0.12)',
  accent: '#818CF8',           // Modern Luminous Iris / Electric Indigo
  accentBg: 'rgba(129, 140, 248, 0.12)',
  gold: '#818CF8',             // Unified with sleek modern accent
  goldBg: 'rgba(129, 140, 248, 0.12)',
  indigo: '#818CF8',          // Vibrant Iris Indigo
  indigoBg: 'rgba(129, 140, 248, 0.12)',
  cardOverlay: 'rgba(255, 255, 255, 0.02)',
  tabBar: 'rgba(18, 19, 26, 0.95)',          // Grounded, restrained dock surface
  tabBarBorder: 'rgba(255, 255, 255, 0.06)',  // Subtle dock border
  squircleTab: 'rgba(255, 255, 255, 0.04)',
  squircleTabActive: '#1E1F2C',              // Restrained elevated dark pill
  squircleIconActive: '#F1F5F9',              // Crisp off-white icon on active tab
  squircleIconInactive: '#64748B',            // Slate 500 muted tab icon
  glassBg: 'rgba(18, 19, 26, 0.85)',          // Calm obsidian glass fill
  glassBorder: 'rgba(255, 255, 255, 0.06)',   // Subtle low-contrast rim
  glassHighlight: 'rgba(255, 255, 255, 0.04)',// Subtle specular whisper (no plastic glare)
  glassBottomBorder: 'rgba(255, 255, 255, 0.02)',
  glassShadow: 'rgba(0, 0, 0, 0.35)',         // Restrained depth shadow
  indicator: '#94A3B8',
};

export const lightColors: ColorTokens = {
  background: '#F4F6FB',       // Crisp modern alabaster canvas
  surface: '#FFFFFF',          // Clean white surface
  surfaceElevated: '#FFFFFF',  // Soft elevated surface
  surfaceSubtle: '#F0F2F8',    // Subtle interactive fill
  textPrimary: '#0F172A',      // Slate 900
  textSecondary: '#334155',    // Slate 700 (high readability on alabaster canvas)
  textMuted: '#64748B',        // Slate 500 (WCAG AA compliant)
  border: '#E8ECF4',          // Slate 200
  borderSubtle: '#F1F5F9',    // Slate 100
  positive: '#059669',         // Deep emerald
  positiveBg: 'rgba(5, 150, 105, 0.10)',
  negative: '#E11D48',         // Deep rose
  negativeBg: 'rgba(225, 29, 72, 0.10)',
  warning: '#D97706',          // Dark amber
  warningBg: 'rgba(217, 119, 6, 0.10)',
  accent: '#4F46E5',           // Modern Electric Indigo
  accentBg: 'rgba(79, 70, 229, 0.08)',
  gold: '#4F46E5',             // Unified with modern accent (replaces muddy mustard)
  goldBg: 'rgba(79, 70, 229, 0.08)',
  indigo: '#4F46E5',           // Modern Electric Indigo (replaces dull murky purple)
  indigoBg: 'rgba(79, 70, 229, 0.08)',
  cardOverlay: 'rgba(255, 255, 255, 0.40)',
  tabBar: 'rgba(255, 255, 255, 0.94)',
  tabBarBorder: 'rgba(255, 255, 255, 0.90)',
  squircleTab: 'rgba(0, 0, 0, 0.03)',
  squircleTabActive: '#13131B',
  squircleIconActive: '#FFFFFF',
  squircleIconInactive: '#64748B',
  glassBg: 'rgba(255, 255, 255, 0.50)',          // Light liquid glass fill
  glassBorder: 'rgba(255, 255, 255, 0.92)',       // SVG prism overlay handles real border
  glassHighlight: '#FFFFFF',                       // Top specular streak
  glassBottomBorder: 'rgba(79, 70, 229, 0.12)',   // Crisp indigo bottom edge
  glassShadow: 'rgba(79, 70, 229, 0.10)',          // Luminous modern indigo shadow
  indicator: '#1E293B',
};
