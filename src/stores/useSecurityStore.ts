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
 * Fails closed if no CSPR source is available.
 */
export function generateRandomSaltHex(byteLength = 16): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(byteLength);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  if (Crypto?.getRandomValues) {
    const bytes = new Uint8Array(byteLength);
    Crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  if (Crypto?.getRandomBytes) {
    const bytes = Crypto.getRandomBytes(byteLength);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  throw new Error('Cryptographically secure random number generator is unavailable.');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Standard SHA-256 round constants (RFC 6234)
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr32(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256Bytes(data: Uint8Array): Uint8Array {
  const len = data.length;
  const totalLen = Math.ceil((len + 9) / 64) * 64;
  const buf = new Uint8Array(totalLen);
  buf.set(data);
  buf[len] = 0x80;

  const bitLen = len * 8;
  const view = new DataView(buf.buffer);
  view.setUint32(totalLen - 4, bitLen >>> 0, false);
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let i = 0; i < totalLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr32(w[t - 15], 7) ^ rotr32(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr32(w[t - 2], 17) ^ rotr32(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[t] + w[t]) >>> 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

function hmacSha256Bytes(key: Uint8Array, message: Uint8Array): Uint8Array {
  let k = key;
  if (k.length > 64) {
    k = sha256Bytes(k);
  }
  const paddedK = new Uint8Array(64);
  paddedK.set(k);

  const iPad = new Uint8Array(64);
  const oPad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    iPad[i] = paddedK[i] ^ 0x36;
    oPad[i] = paddedK[i] ^ 0x5c;
  }

  const inner = new Uint8Array(64 + message.length);
  inner.set(iPad);
  inner.set(message, 64);
  const innerHash = sha256Bytes(inner);

  const outer = new Uint8Array(64 + 32);
  outer.set(oPad);
  outer.set(innerHash, 64);
  return sha256Bytes(outer);
}

/**
 * Standard RFC 8018 PBKDF2-HMAC-SHA256 (32 bytes derived key output).
 */
export function pbkdf2HmacSha256(passwordBytes: Uint8Array, saltBytes: Uint8Array, iterations: number): string {
  const initial = new Uint8Array(saltBytes.length + 4);
  initial.set(saltBytes);
  initial[saltBytes.length + 3] = 1; // block 1

  let u = hmacSha256Bytes(passwordBytes, initial);
  const t = new Uint8Array(u);

  for (let i = 1; i < iterations; i++) {
    u = hmacSha256Bytes(passwordBytes, u);
    for (let j = 0; j < 32; j++) {
      t[j] ^= u[j];
    }
  }

  return Array.from(t).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derives a key using standard RFC 8018 PBKDF2 with HMAC-SHA256.
 * Uses Web Crypto SubtleCrypto if available; otherwise uses guaranteed pure standard implementation.
 */
async function deriveKeyFromPin(pin: string, saltHex: string, iterations: number): Promise<string> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle?.deriveBits) {
    try {
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
    } catch {}
  }

  const enc = new TextEncoder();
  const passwordBytes = enc.encode(pin);
  const saltBytes = hexToBytes(saltHex);
  return pbkdf2HmacSha256(passwordBytes, saltBytes, iterations);
}

/**
 * Legacy static SHA-256 hash function (only used for backward compatibility migration).
 */
export async function hashPinLegacy(pin: string): Promise<string> {
  const str = `${LEGACY_PIN_SALT}${pin}`;
  if (Crypto?.digestStringAsync) {
    try {
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        str
      );
    } catch {}
  }
  const enc = new TextEncoder();
  const digest = sha256Bytes(enc.encode(str));
  return Array.from(digest).map((b) => b.toString(16).padStart(2, '0')).join('');
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

function isTestEnvironment(): boolean {
  return typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
}

async function isSecureStoreAvailable(): Promise<boolean> {
  if (!SecureStore) return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

async function getSecureItem(key: string): Promise<string | null> {
  const available = await isSecureStoreAvailable();
  if (available && SecureStore) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      if (!isTestEnvironment()) throw e;
    }
  }
  if (isTestEnvironment()) {
    return fallbackSecureMemory.get(key) ?? null;
  }
  return null;
}

async function setSecureItem(key: string, value: string): Promise<void> {
  const available = await isSecureStoreAvailable();
  if (available && SecureStore) {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });
      return;
    } catch (e) {
      if (!isTestEnvironment()) {
        throw new Error('Failed to persist security credentials to hardware-backed keystore.');
      }
    }
  }
  if (isTestEnvironment()) {
    fallbackSecureMemory.set(key, value);
    return;
  }
  throw new Error('Hardware-backed SecureStore is unavailable on this device. PIN could not be saved.');
}

async function deleteSecureItem(key: string): Promise<void> {
  const available = await isSecureStoreAvailable();
  if (available && SecureStore) {
    try {
      await SecureStore.deleteItemAsync(key);
      return;
    } catch (e) {
      if (!isTestEnvironment()) throw e;
    }
  }
  if (isTestEnvironment()) {
    fallbackSecureMemory.delete(key);
  }
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
