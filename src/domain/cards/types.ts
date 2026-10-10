import { PaymentNetwork } from '../../components/cards/PaymentNetworkLogo';

export type CardType = 'CREDIT' | 'DEBIT';

export type CardColorTheme =
  | 'midnight'
  | 'obsidian'
  | 'emerald'
  | 'sapphire'
  | 'amethyst'
  | 'ruby'
  | 'gold';

export interface CardThemeConfig {
  id: CardColorTheme;
  name: string;
  gradient: [string, string];
  textColor: string;
  accentColor: string;
}

export const CARD_COLOR_THEMES: Record<CardColorTheme, CardThemeConfig> = {
  midnight: {
    id: 'midnight',
    name: 'Midnight Navy',
    gradient: ['#0F172A', '#1E293B'],
    textColor: '#F8FAFC',
    accentColor: '#38BDF8',
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Black',
    gradient: ['#18181B', '#27272A'],
    textColor: '#FFFFFF',
    accentColor: '#A1A1AA',
  },
  emerald: {
    id: 'emerald',
    name: 'Deep Emerald',
    gradient: ['#064E3B', '#047857'],
    textColor: '#ECFDF5',
    accentColor: '#34D399',
  },
  sapphire: {
    id: 'sapphire',
    name: 'Royal Sapphire',
    gradient: ['#1E3A8A', '#2563EB'],
    textColor: '#EFF6FF',
    accentColor: '#60A5FA',
  },
  amethyst: {
    id: 'amethyst',
    name: 'Imperial Amethyst',
    gradient: ['#4C1D95', '#7C3AED'],
    textColor: '#FAF5FF',
    accentColor: '#C084FC',
  },
  ruby: {
    id: 'ruby',
    name: 'Crimson Ruby',
    gradient: ['#881337', '#BE123C'],
    textColor: '#FFF1F2',
    accentColor: '#FB7185',
  },
  gold: {
    id: 'gold',
    name: 'Champagne Gold',
    gradient: ['#78350F', '#B45309'],
    textColor: '#FFFBEB',
    accentColor: '#FBBF24',
  },
};

export interface SavedCard {
  id: string;
  cardholderName: string;
  cardType: CardType;
  network: PaymentNetwork;
  encryptedCardNumber: string;
  lastFour: string;
  expiryMonth: number;
  expiryYear: number;
  cardNickname?: string;
  issuer?: string; // Bank / Card Issuer (e.g. HDFC Bank, SBI Card, ICICI Bank, etc.)
  linkedAccountId?: string;
  colorTheme?: CardColorTheme;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCardInput {
  cardholderName: string;
  cardNumber: string; // Plaintext full number provided during form creation
  cardType: CardType;
  network: PaymentNetwork;
  expiryMonth: number;
  expiryYear: number;
  cardNickname?: string;
  issuer?: string;
  linkedAccountId?: string;
  colorTheme?: CardColorTheme;
}

export interface UpdateCardInput {
  cardholderName?: string;
  cardNumber?: string; // Optional new full number if updating card number
  cardType?: CardType;
  network?: PaymentNetwork;
  expiryMonth?: number;
  expiryYear?: number;
  cardNickname?: string;
  issuer?: string | null;
  linkedAccountId?: string | null;
  colorTheme?: CardColorTheme;
}
