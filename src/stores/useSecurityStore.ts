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
const LEGACY_PIN_SALT = 'vaelth_salt_sec_v1_';
const PBKDF2_ITERATIONS = 10000;

// In-memory fallback for environments where SecureStore is unavailable (e.g. unit tests or unlinked builds)
const fallbackSecureMemory = new Map<string, string>();

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Generates cryptographically secure random bytes formatted as a hex string.
 */
function generateRandomSaltHex(byteLength = 16): string {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      const bytes = new Uint8Array(byteLength);
      globalThis.crypto.getRandomValues(bytes);
      return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    if (Crypto) {
      const bytes = Crypto.getRandomBytes(byteLength);
      return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {}
  let s = '';
  for (let i = 0; i < byteLength; i++) {
    s += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  }
  return s;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Derives a key using platform Web Crypto PBKDF2 with HMAC-SHA256,
 * falling back to an iterative salted digest if Web Crypto is unavailable.
 */
async function deriveKeyFromPin(pin: string, saltHex: string, iterations: number): Promise<string> {
  // 1. Preferred: Standard Web Crypto SubtleCrypto PBKDF2
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle?.deriveBits) {
      const enc = new TextEncoder();
      const keyMaterial = await globalThis.crypto.subtle.importKey(
        'raw',
        enc.encode(pin),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      const saltBytes = hexToBytes(saltHex);
      const derived = await globalThis.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBytes as unknown as BufferSource,
          iterations,
          hash: 'SHA-256',
        },
        keyMaterial,
        256 // 256 bits = 32 bytes
      );
      return Array.from(new Uint8Array(derived))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {}

  // 2. Fallback: Iterative salted SHA-256
  let current = `${saltHex}:${pin}`;
  for (let i = 0; i < Math.min(iterations, 2000); i++) {
    if (Crypto) {
      current = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, current);
    } else {
      let h = 0;
      for (let j = 0; j < current.length; j++) {
        h = (h << 5) - h + current.charCodeAt(j);
        h |= 0;
      }
      current = `fallback_${h}_${i}`;
    }
  }
  return current;
}

/**
 * Legacy static SHA-256 hash function (only used for backward compatibility migration).
 */
export async function hashPinLegacy(pin: string): Promise<string> {
  try {
    if (Crypto) {
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${LEGACY_PIN_SALT}${pin}`
      );
    }
  } catch {}
  let hash = 0;
  const str = `${LEGACY_PIN_SALT}${pin}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `fallback_${hash}`;
}

/**
 * Generates a modern PBKDF2 hash using a per-credential cryptographic salt.
 * Output format: pbkdf2:v1:<saltHex>:<iterations>:<derivedKeyHex>
 */
export async function hashPin(pin: string, explicitSaltHex?: string): Promise<string> {
  const salt = explicitSaltHex || generateRandomSaltHex(16);
  const iterations = PBKDF2_ITERATIONS;
  const derived = await deriveKeyFromPin(pin, salt, iterations);
  return `pbkdf2:v1:${salt}:${iterations}:${derived}`;
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
  failedAttempts: number;
  lockoutUntil: number | null;
  getRemainingLockoutSeconds: () => number;
  resetLockout: () => void;
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
  failedAttempts: 0,
  lockoutUntil: null,

  getRemainingLockoutSeconds: () => {
    const { lockoutUntil } = get();
    if (!lockoutUntil) return 0;
    const diff = Math.ceil((lockoutUntil - Date.now()) / 1000);
    return Math.max(0, diff);
  },

  resetLockout: () => {
    set({ failedAttempts: 0, lockoutUntil: null });
  },

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
      try {
        await setSetting('security_pin', '');
      } catch {}
      set({ isPinEnabled: true });
    } else {
      await deleteSecureItem(SECURE_PIN_HASH_KEY);
      try {
        await setSetting('security_pin', '');
        await setSetting('security_biometric', 'false');
      } catch {}
      set({ isPinEnabled: false, isBiometricEnabled: false, isLocked: false });
    }
  },

  setBiometricEnabled: async (enabled: boolean) => {
    await setSetting('security_biometric', enabled ? 'true' : 'false');
    set({ isBiometricEnabled: enabled });
  },

  verifyPin: async (enteredPin: string) => {
    const { lockoutUntil, failedAttempts } = get();
    const now = Date.now();
    if (lockoutUntil && now < lockoutUntil) {
      return false;
    }

    const savedHash = await getSecureItem(SECURE_PIN_HASH_KEY);
    if (!savedHash) return false;

    let isMatch = false;

    // Check if stored in modern PBKDF2 format: pbkdf2:v1:<salt>:<iterations>:<derived>
    if (savedHash.startsWith('pbkdf2:v1:')) {
      const parts = savedHash.split(':');
      if (parts.length === 5) {
        const saltHex = parts[2];
        const iterations = parseInt(parts[3], 10) || PBKDF2_ITERATIONS;
        const expectedDerived = parts[4];
        const enteredDerived = await deriveKeyFromPin(enteredPin, saltHex, iterations);
        isMatch = timingSafeEqual(expectedDerived, enteredDerived);
      }
    } else {
      // Check legacy static SHA-256 hash for seamless backward compatibility
      const legacyHash = await hashPinLegacy(enteredPin);
      if (savedHash === legacyHash) {
        // Automatically upgrade to modern PBKDF2 KDF with unique random salt
        const modernHash = await hashPin(enteredPin);
        await setSecureItem(SECURE_PIN_HASH_KEY, modernHash);
        isMatch = true;
      }
    }

    if (isMatch) {
      set({
        isLocked: false,
        failedAttempts: 0,
        lockoutUntil: null,
      });
      return true;
    } else {
      const nextFailed = failedAttempts + 1;
      let newLockoutUntil: number | null = null;
      if (nextFailed >= 10) {
        newLockoutUntil = Date.now() + 300000; // 5 minutes lockout after 10 failures
      } else if (nextFailed >= 7) {
        newLockoutUntil = Date.now() + 60000;  // 1 minute lockout after 7 failures
      } else if (nextFailed >= 5) {
        newLockoutUntil = Date.now() + 30000;  // 30 seconds lockout after 5 failures
      }
      set({
        failedAttempts: nextFailed,
        lockoutUntil: newLockoutUntil,
      });
      return false;
    }
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
