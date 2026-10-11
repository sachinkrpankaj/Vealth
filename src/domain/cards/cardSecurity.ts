import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { cleanCardNumber } from './cardValidation';
import { pbkdf2HmacSha256 } from '../../stores/useSecurityStore';

let SecureStore: typeof import('expo-secure-store') | null = null;
try {
  SecureStore = require('expo-secure-store');
} catch {}

let Crypto: typeof import('expo-crypto') | null = null;
try {
  Crypto = require('expo-crypto');
} catch {}

const MASTER_CARD_KEY_NAME = 'vaelth_card_wallet_master_key';
const fallbackKeyMemory = new Map<string, string>();

let activeClipboardTimer: NodeJS.Timeout | null = null;
let lastCopiedSensitiveText: string | null = null;

const AES_GCM_V1_REGEX = /^aes-gcm:v1:([0-9a-f]{24}):([0-9a-f]{32,})$/i;
const FALLBACK_V1_REGEX = /^fallback:v1:([0-9a-f]{24}):([0-9a-f]+)$/i;

function isTestEnvironment(): boolean {
  return typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
}

/**
 * Returns cryptographically secure random bytes of given length.
 * Fails closed if no CSPR source is available.
 */
export function getSecureRandomBytes(byteLength = 32): Uint8Array {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(byteLength);
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }
  if (Crypto?.getRandomValues) {
    const bytes = new Uint8Array(byteLength);
    Crypto.getRandomValues(bytes);
    return bytes;
  }
  if (Crypto?.getRandomBytes) {
    return Crypto.getRandomBytes(byteLength);
  }
  throw new Error('Cryptographically secure random number generator is unavailable.');
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Retrieves or initializes the 256-bit AES master key in OS-protected secure storage.
 * Never silently regenerates an existing key if storage fails.
 * On web, explicitly fails closed with clear user explanation.
 */
export async function getMasterEncryptionKeyHex(): Promise<string> {
  const isTest = isTestEnvironment();

  if (Platform.OS === 'web') {
    throw new Error(
      'Card number storage and decryption are disabled on web platforms for security. Sensitive card management requires OS-protected secure storage available on iOS and Android.'
    );
  }

  // 1. Try reading existing key from SecureStore
  if (SecureStore) {
    let isAvailable = false;
    try {
      isAvailable = await SecureStore.isAvailableAsync();
    } catch (e: any) {
      throw new Error(
        `OS secure storage unavailable: could not check keystore availability (${e?.message || 'storage error'}).`
      );
    }

    if (isAvailable) {
      let existingKey: string | null = null;
      try {
        existingKey = await SecureStore.getItemAsync(MASTER_CARD_KEY_NAME);
      } catch (e: any) {
        // SecureStore read failure: FAIL CLOSED, never treat read error as an empty keystore!
        throw new Error(
          `OS secure storage unavailable: failed to read master encryption key (${e?.message || 'storage read error'}).`
        );
      }

      // Only generate a new master key when SecureStore confirms the key is genuinely absent (null/undefined)
      if (existingKey === null || existingKey === undefined) {
        // Genuinely absent: generate a new 256-bit key
        const newKeyBytes = getSecureRandomBytes(32);
        const newKey = bytesToHex(newKeyBytes);
        try {
          await SecureStore.setItemAsync(MASTER_CARD_KEY_NAME, newKey, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED,
          });
        } catch (e: any) {
          throw new Error(
            `OS secure storage unavailable: failed to persist newly generated master encryption key (${e?.message || 'storage write error'}).`
          );
        }
        return newKey;
      }

      // Key exists: validate format (must be 64-character hex string)
      if (existingKey.length === 64 && /^[0-9a-f]{64}$/i.test(existingKey)) {
        return existingKey;
      }

      // Key exists but is empty or malformed: treat as corruption, NEVER overwrite!
      throw new Error(
        'OS secure storage contains a corrupted or unreadable master encryption key. Cannot initialize or overwrite existing key material.'
      );
    }
  }

  // Fallback ONLY for unit tests when SecureStore is not provided
  if (isTest) {
    if (fallbackKeyMemory.has(MASTER_CARD_KEY_NAME)) {
      const key = fallbackKeyMemory.get(MASTER_CARD_KEY_NAME);
      if (key === null || key === undefined) {
        // genuinely absent
      } else if (key.length === 64 && /^[0-9a-f]{64}$/i.test(key)) {
        return key;
      } else {
        throw new Error(
          'OS secure storage contains a corrupted or unreadable master encryption key. Cannot initialize or overwrite existing key material.'
        );
      }
    }
    const key = bytesToHex(getSecureRandomBytes(32));
    fallbackKeyMemory.set(MASTER_CARD_KEY_NAME, key);
    return key;
  }

  throw new Error('OS secure storage is unavailable on this device.');
}

/**
 * Safely sets the master encryption key in OS-protected secure storage.
 */
export async function setMasterEncryptionKeyHex(keyHex: string): Promise<void> {
  if (!keyHex || keyHex.length !== 64 || !/^[0-9a-f]{64}$/i.test(keyHex)) {
    throw new Error('Invalid master encryption key: must be a 64-character hex string (256 bits).');
  }

  if (Platform.OS === 'web') {
    throw new Error(
      'Card encryption key management is disabled on web platforms for security. Secure storage is only supported on iOS and Android.'
    );
  }

  if (SecureStore) {
    let isAvailable = false;
    try {
      isAvailable = await SecureStore.isAvailableAsync();
    } catch (e: any) {
      throw new Error(`OS secure storage unavailable: ${e?.message || 'error'}`);
    }
    if (isAvailable) {
      try {
        await SecureStore.setItemAsync(MASTER_CARD_KEY_NAME, keyHex, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        });
        return;
      } catch (e: any) {
        throw new Error(`Failed to store master key into OS secure storage: ${e?.message || 'error'}`);
      }
    }
  }

  if (isTestEnvironment()) {
    fallbackKeyMemory.set(MASTER_CARD_KEY_NAME, keyHex);
    return;
  }

  throw new Error('OS secure storage is unavailable on this device.');
}

/**
 * Legacy XOR keystream helper ONLY used for decrypting legacy fallback:v1 records.
 * NEVER used for creating new ciphertexts.
 */
function legacyXorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i] ^ b[i % b.length];
  }
  return out;
}

/**
 * Encrypts a card number using authenticated AES-GCM (256-bit) with a unique 96-bit IV.
 * Format: aes-gcm:v1:<ivHex>:<ciphertextAndTagHex>
 * Fails closed if secure authenticated encryption is unavailable.
 */
export async function encryptCardNumber(cardNumber: string, explicitKeyHex?: string): Promise<string> {
  const clean = cleanCardNumber(cardNumber);
  if (!clean) throw new Error('Card number cannot be blank for encryption.');

  const keyHex = explicitKeyHex || (await getMasterEncryptionKeyHex());
  if (!keyHex || keyHex.length !== 64 || !/^[0-9a-f]{64}$/i.test(keyHex)) {
    throw new Error('Invalid master encryption key: must be a 64-character hex string (256 bits).');
  }

  const keyBytes = hexToBytes(keyHex);
  const iv = getSecureRandomBytes(12); // 96-bit IV recommended for AES-GCM
  const plainBytes = new TextEncoder().encode(clean);

  // 1. WebCrypto SubtleCrypto AES-GCM (standard in Hermes 0.76+ and Node.js)
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle?.importKey) {
    try {
      const cryptoKey = await globalThis.crypto.subtle.importKey(
        'raw',
        keyBytes as unknown as BufferSource,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      const cipherBuffer = await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        cryptoKey,
        plainBytes as unknown as BufferSource
      );

      const cipherBytes = new Uint8Array(cipherBuffer);
      return `aes-gcm:v1:${bytesToHex(iv)}:${bytesToHex(cipherBytes)}`;
    } catch (e: any) {
      throw new Error(`Failed to encrypt card number with authenticated AES-GCM: ${e?.message || 'crypto error'}`);
    }
  }

  // 2. Native ExpoCrypto AES fallback if subtle is unavailable
  if (Crypto?.aesEncryptAsync && Crypto?.AESEncryptionKey) {
    try {
      const aesKey = await Crypto.AESEncryptionKey.import(keyBytes);
      const sealed = await Crypto.aesEncryptAsync(plainBytes, aesKey, {
        nonce: { bytes: iv } as any,
      });
      const cipherWithTag = await sealed.ciphertext({ includeTag: true, encoding: 'bytes' });
      return `aes-gcm:v1:${bytesToHex(iv)}:${bytesToHex(cipherWithTag as Uint8Array)}`;
    } catch (e: any) {
      throw new Error(`Failed to encrypt card number with authenticated AES-GCM: ${e?.message || 'crypto error'}`);
    }
  }

  // Fail-closed when secure authenticated encryption is unavailable
  throw new Error('Authenticated cryptographic encryption (AES-GCM) is unavailable on this device.');
}

/**
 * Checks whether an encrypted payload is in the legacy fallback:v1 format.
 */
export function isLegacyEncryptedCard(encryptedPayload: string): boolean {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') return false;
  return FALLBACK_V1_REGEX.test(encryptedPayload);
}

/**
 * Decrypts an encrypted card number payload.
 * Supports modern authenticated AES-GCM and safe legacy fallback:v1 migration.
 * Validates ciphertext format strictly, including IV length and auth tag presence.
 */
export async function decryptCardNumber(
  encryptedPayload: string,
  explicitKeyHex?: string
): Promise<string> {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') {
    throw new Error('Encrypted payload is empty or invalid.');
  }

  const keyHex = explicitKeyHex || (await getMasterEncryptionKeyHex());
  if (!keyHex || keyHex.length !== 64 || !/^[0-9a-f]{64}$/i.test(keyHex)) {
    throw new Error('Invalid master encryption key: must be a 64-character hex string (256 bits).');
  }
  const keyBytes = hexToBytes(keyHex);

  // 1. Modern authenticated AES-GCM
  const gcmMatch = encryptedPayload.match(AES_GCM_V1_REGEX);
  if (gcmMatch) {
    const ivHex = gcmMatch[1];
    const cipherHex = gcmMatch[2];
    const iv = hexToBytes(ivHex);
    const cipherBytes = hexToBytes(cipherHex);

    // Try WebCrypto SubtleCrypto AES-GCM first (standard in Hermes and Node)
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle?.importKey) {
      try {
        const cryptoKey = await globalThis.crypto.subtle.importKey(
          'raw',
          keyBytes as unknown as BufferSource,
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        );

        const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv as unknown as BufferSource },
          cryptoKey,
          cipherBytes as unknown as BufferSource
        );

        return new TextDecoder().decode(decryptedBuffer);
      } catch (err: any) {
        throw new Error(`Failed to decrypt card number with authenticated AES-GCM: ${err?.message || 'authentication failed'}`);
      }
    }

    // Try native ExpoCrypto AES fallback if subtle is unavailable
    if (Crypto?.aesDecryptAsync && Crypto?.AESEncryptionKey && Crypto?.AESSealedData) {
      try {
        const aesKey = await Crypto.AESEncryptionKey.import(keyBytes);
        const sealed = Crypto.AESSealedData.fromParts(iv, cipherBytes, 16);
        const decrypted = await Crypto.aesDecryptAsync(sealed, aesKey, { output: 'bytes' });
        return new TextDecoder().decode(decrypted as Uint8Array);
      } catch (err: any) {
        throw new Error(`Failed to decrypt card number with authenticated AES-GCM: ${err?.message || 'authentication failed'}`);
      }
    }

    throw new Error('Authenticated cryptographic encryption (AES-GCM) is unavailable on this device.');
  }

  // 2. Safe migration support: decrypt existing fallback:v1 records so data is never destroyed
  const fallbackMatch = encryptedPayload.match(FALLBACK_V1_REGEX);
  if (fallbackMatch) {
    const ivHex = fallbackMatch[1];
    const cipherHex = fallbackMatch[2];
    const iv = hexToBytes(ivHex);
    const cipherBytes = hexToBytes(cipherHex);
    const plainBytes = legacyXorBytes(cipherBytes, legacyXorBytes(keyBytes, iv));
    return new TextDecoder().decode(plainBytes);
  }

  if (!encryptedPayload.includes(':')) {
    throw new Error('Invalid encrypted card format: missing scheme delimiter.');
  }

  // Reject malformed or truncated payloads with descriptive errors
  if (encryptedPayload.startsWith('aes-gcm:') || encryptedPayload.startsWith('fallback:')) {
    throw new Error('Invalid or corrupted encrypted card payload format.');
  }

  const scheme = encryptedPayload.split(':')[0] || 'unknown';
  throw new Error(`Unsupported encryption scheme: ${scheme}`);
}

/**
 * Copies sensitive text to the clipboard and handles transient, safe cleanup.
 * Verifies write success and only clears the clipboard if user hasn't copied newer content.
 */
export async function copySensitiveTextToClipboard(
  text: string,
  clearDelayMs = 30000
): Promise<boolean> {
  if (!text) return false;
  try {
    await Clipboard.setStringAsync(text);
  } catch {
    return false;
  }

  lastCopiedSensitiveText = text;

  // Clear any previously pending clipboard clean timer
  if (activeClipboardTimer) {
    clearTimeout(activeClipboardTimer);
    activeClipboardTimer = null;
  }

  // Safe timer: only clear if clipboard still matches the copied sensitive text
  if (clearDelayMs > 0) {
    const expectedText = text;
    activeClipboardTimer = setTimeout(async () => {
      try {
        const current = await Clipboard.getStringAsync();
        if (current === expectedText) {
          await Clipboard.setStringAsync('');
        }
      } catch {}
      activeClipboardTimer = null;
    }, clearDelayMs);
    if (typeof (activeClipboardTimer as any)?.unref === 'function') {
      (activeClipboardTimer as any).unref();
    }
  }

  return true;
}

/**
 * Clears the clipboard content securely.
 */
export async function clearClipboard(): Promise<void> {
  if (activeClipboardTimer) {
    clearTimeout(activeClipboardTimer);
    activeClipboardTimer = null;
  }
  try {
    await Clipboard.setStringAsync('');
  } catch {}
}

export interface CardKeyEnvelope {
  algorithm: string;
  kdf: string;
  iterations: number;
  saltHex: string;
  ivHex: string;
  ciphertextHex: string;
}

/**
 * Creates an encrypted envelope containing the master card encryption key.
 * Master key is never stored or exported in plaintext.
 * Requires user-supplied passphrase; never uses hardcoded or default credentials.
 */
export async function createCardKeyEnvelope(passphrase: string): Promise<CardKeyEnvelope> {
  if (!passphrase || typeof passphrase !== 'string' || !passphrase.trim()) {
    throw new Error('A backup passphrase is required to securely encrypt Card Wallet keys.');
  }

  const masterKeyHex = await getMasterEncryptionKeyHex();
  const salt = getSecureRandomBytes(16);
  const iv = getSecureRandomBytes(12);
  const iterations = 100000;

  const enc = new TextEncoder();
  const derivedHex = pbkdf2HmacSha256(enc.encode(passphrase.trim()), salt, iterations);
  const wrappingKeyBytes = hexToBytes(derivedHex);
  const plainBytes = enc.encode(masterKeyHex);

  let cipherHex: string;

  if (Crypto?.aesEncryptAsync && Crypto?.AESEncryptionKey) {
    const aesKey = await Crypto.AESEncryptionKey.import(wrappingKeyBytes);
    const sealed = await Crypto.aesEncryptAsync(plainBytes, aesKey, {
      nonce: { bytes: iv } as any,
    });
    const cipherWithTag = await sealed.ciphertext({ includeTag: true, encoding: 'bytes' });
    cipherHex = bytesToHex(cipherWithTag as Uint8Array);
  } else if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle?.importKey) {
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      wrappingKeyBytes as unknown as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const cipherBuffer = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      cryptoKey,
      plainBytes as unknown as BufferSource
    );
    cipherHex = bytesToHex(new Uint8Array(cipherBuffer));
  } else {
    throw new Error('Authenticated cryptographic encryption (AES-GCM) is unavailable to create key envelope.');
  }

  return {
    algorithm: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256',
    iterations,
    saltHex: bytesToHex(salt),
    ivHex: bytesToHex(iv),
    ciphertextHex: cipherHex,
  };
}

/**
 * Restores and returns the master card encryption key from an encrypted envelope.
 * Validates envelope algorithm, KDF, iteration count, salt, and IV before executing operations.
 * Returns the unwrapped key; does NOT silently mutate the device's current master key.
 */
export async function restoreCardKeyFromEnvelope(
  envelope: CardKeyEnvelope,
  passphrase: string
): Promise<string> {
  if (!passphrase || typeof passphrase !== 'string' || !passphrase.trim()) {
    throw new Error('A backup passphrase is required to decrypt Card Wallet keys.');
  }

  if (!envelope || typeof envelope !== 'object') {
    throw new Error('Invalid or corrupted card key envelope.');
  }

  // Pre-validate envelope parameters before performing expensive operations
  if (envelope.algorithm !== 'AES-GCM-256') {
    throw new Error(`Unsupported envelope algorithm: ${envelope.algorithm || 'unknown'}`);
  }
  if (envelope.kdf !== 'PBKDF2-SHA256') {
    throw new Error(`Unsupported envelope KDF: ${envelope.kdf || 'unknown'}`);
  }
  if (
    typeof envelope.iterations !== 'number' ||
    envelope.iterations < 10000 ||
    envelope.iterations > 1000000
  ) {
    throw new Error(`Unsafe or invalid envelope iteration count: ${envelope.iterations}`);
  }
  if (!envelope.saltHex || envelope.saltHex.length !== 32 || !/^[0-9a-f]{32}$/i.test(envelope.saltHex)) {
    throw new Error('Invalid or corrupted envelope salt.');
  }
  if (!envelope.ivHex || envelope.ivHex.length !== 24 || !/^[0-9a-f]{24}$/i.test(envelope.ivHex)) {
    throw new Error('Invalid or corrupted envelope IV.');
  }
  if (
    !envelope.ciphertextHex ||
    envelope.ciphertextHex.length < 32 ||
    !/^[0-9a-f]+$/i.test(envelope.ciphertextHex)
  ) {
    throw new Error('Invalid or corrupted envelope ciphertext.');
  }

  const salt = hexToBytes(envelope.saltHex);
  const iv = hexToBytes(envelope.ivHex);
  const cipherBytes = hexToBytes(envelope.ciphertextHex);

  const enc = new TextEncoder();
  const derivedHex = pbkdf2HmacSha256(enc.encode(passphrase.trim()), salt, envelope.iterations);
  const wrappingKeyBytes = hexToBytes(derivedHex);

  let decryptedBytes: Uint8Array;
  try {
    if (Crypto?.aesDecryptAsync && Crypto?.AESEncryptionKey && Crypto?.AESSealedData) {
      const aesKey = await Crypto.AESEncryptionKey.import(wrappingKeyBytes);
      const sealed = Crypto.AESSealedData.fromParts(iv, cipherBytes, 16);
      const dec = await Crypto.aesDecryptAsync(sealed, aesKey, { output: 'bytes' });
      decryptedBytes = dec as Uint8Array;
    } else if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle?.importKey) {
      const cryptoKey = await globalThis.crypto.subtle.importKey(
        'raw',
        wrappingKeyBytes as unknown as BufferSource,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      const buf = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        cryptoKey,
        cipherBytes as unknown as BufferSource
      );
      decryptedBytes = new Uint8Array(buf);
    } else {
      throw new Error('Authenticated cryptographic decryption (AES-GCM) is unavailable on this device.');
    }
  } catch (err: any) {
    throw new Error('Failed to decrypt card key envelope. Incorrect password or corrupted envelope.');
  }

  const masterKeyHex = new TextDecoder().decode(decryptedBytes);
  if (!masterKeyHex || masterKeyHex.length !== 64 || !/^[0-9a-f]{64}$/i.test(masterKeyHex)) {
    throw new Error('Decrypted card master key is malformed or invalid.');
  }

  return masterKeyHex;
}

/**
 * Resets fallback keys and clipboard timers in testing environments.
 */
export function _resetCardSecurityForTesting(): void {
  fallbackKeyMemory.clear();
  if (activeClipboardTimer) {
    clearTimeout(activeClipboardTimer);
    activeClipboardTimer = null;
  }
  lastCopiedSensitiveText = null;
}
