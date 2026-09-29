import { create } from 'zustand';
import * as LocalAuthentication from 'expo-local-authentication';
let SecureStore: typeof import('expo-secure-store') | null = null;
try {
  SecureStore = require('expo-secure-store');
} catch {}

let Crypto: typeof import('expo-crypto') | null = null;
try {
  Crypto = require('expo-crypto');
} catch {}
import { getSetting, setSetting } from '../database/repositories/settingsRepository';

const SECURE_PIN_HASH_KEY = 'vaelth_security_pin_hash';
const PIN_SALT = 'vaelth_salt_sec_v1_';

// In-memory fallback for environments where SecureStore is unavailable (e.g. unit tests or unlinked builds)
const fallbackSecureMemory = new Map<string, string>();

export async function hashPin(pin: string): Promise<string> {
  try {
    if (Crypto) {
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${PIN_SALT}${pin}`
      );
    }
  } catch {}
  let hash = 0;
  const str = `${PIN_SALT}${pin}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `fallback_${hash}`;
}

async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (SecureStore) {
      const isAvail = await SecureStore.isAvailableAsync();
      if (isAvail) {
        return await SecureStore.getItemAsync(key);
      }
    }
  } catch {}
  return fallbackSecureMemory.get(key) ?? null;
}

async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    if (SecureStore) {
      const isAvail = await SecureStore.isAvailableAsync();
      if (isAvail) {
        await SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        });
        return;
      }
    }
  } catch {}
  fallbackSecureMemory.set(key, value);
}

async function deleteSecureItem(key: string): Promise<void> {
  try {
    if (SecureStore) {
      const isAvail = await SecureStore.isAvailableAsync();
      if (isAvail) {
        await SecureStore.deleteItemAsync(key);
      }
    }
  } catch {}
  fallbackSecureMemory.delete(key);
}

interface SecurityState {
  isPinEnabled: boolean;
  isBiometricEnabled: boolean;
  isLocked: boolean;
  hasCheckedAuth: boolean;
  checkSecurityConfig: () => Promise<void>;
  setPin: (pin: string | null) => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  verifyPin: (enteredPin: string) => Promise<boolean>;
  authenticateWithBiometrics: () => Promise<boolean>;
  lock: () => void;
  unlock: () => void;
}

export const useSecurityStore = create<SecurityState>((set, get) => ({
  isPinEnabled: false,
  isBiometricEnabled: false,
  isLocked: false,
  hasCheckedAuth: false,

  checkSecurityConfig: async () => {
    try {
      // 1. Check for legacy raw PIN in SQLite app_settings to migrate
      const legacyRawPin = await getSetting('security_pin');
      if (legacyRawPin) {
        // Migrate to hardware-backed Keystore / SecureStore with salted hash
        const hashed = await hashPin(legacyRawPin);
        await setSecureItem(SECURE_PIN_HASH_KEY, hashed);
        // Wipe legacy plaintext PIN from SQLite database permanently
        await setSetting('security_pin', '');
      }

      // 2. Read PIN status strictly from SecureStore
      const savedHash = await getSecureItem(SECURE_PIN_HASH_KEY);
      const isPinEnabled = Boolean(savedHash);

      // 3. Biometric preference from app_settings
      const bio = await getSetting('security_biometric');
      const isBiometricEnabled = bio === 'true' && isPinEnabled;

      set({
        isPinEnabled,
        isBiometricEnabled,
        isLocked: isPinEnabled,
        hasCheckedAuth: true,
      });
    } catch {
      set({ hasCheckedAuth: true, isLocked: false });
    }
  },

  setPin: async (pin: string | null) => {
    if (pin) {
      const hashed = await hashPin(pin);
      await setSecureItem(SECURE_PIN_HASH_KEY, hashed);
      // Ensure no raw PIN ever exists in SQLite
      await setSetting('security_pin', '');
      set({ isPinEnabled: true });
    } else {
      await deleteSecureItem(SECURE_PIN_HASH_KEY);
      await setSetting('security_pin', '');
      await setSetting('security_biometric', 'false');
      set({ isPinEnabled: false, isBiometricEnabled: false, isLocked: false });
    }
  },

  setBiometricEnabled: async (enabled: boolean) => {
    await setSetting('security_biometric', enabled ? 'true' : 'false');
    set({ isBiometricEnabled: enabled });
  },

  verifyPin: async (enteredPin: string) => {
    const savedHash = await getSecureItem(SECURE_PIN_HASH_KEY);
    if (!savedHash) return false;

    const enteredHash = await hashPin(enteredPin);
    if (savedHash === enteredHash) {
      set({ isLocked: false });
      return true;
    }
    return false;
  },

  authenticateWithBiometrics: async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return false;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Vaelth',
        fallbackLabel: 'Use PIN',
      });

      if (result.success) {
        set({ isLocked: false });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  lock: () => {
    if (get().isPinEnabled) {
      set({ isLocked: true });
    }
  },

  unlock: () => {
    set({ isLocked: false });
  },
}));
