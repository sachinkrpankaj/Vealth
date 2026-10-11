import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { cleanCardNumber } from './cardValidation';

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
 * Retrieves or initializes the hardware-backed 256-bit AES master key.
 * Never silently regenerates an existing key if storage fails.
 */
export async function getMasterEncryptionKeyHex(): Promise<string> {
  const isTest = isTestEnvironment();

  // 1. Try reading existing key from SecureStore
  if (SecureStore) {
    try {
      const isAvailable = await SecureStore.isAvailableAsync();
      if (isAvailable) {
        let key = await SecureStore.getItemAsync(MASTER_CARD_KEY_NAME);
        if (key) return key;

        // Generate a new 256-bit key
        const newKeyBytes = getSecureRandomBytes(32);
        key = bytesToHex(newKeyBytes);
        await SecureStore.setItemAsync(MASTER_CARD_KEY_NAME, key, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        });
        return key;
      }
    } catch (e: any) {
      if (!isTest) {
        throw new Error(
          `Hardware keystore unavailable: could not securely initialize encryption key (${e?.message || 'storage error'}).`
        );
      }
    }
  }

  // Fallback for tests or web environments without native secure store
  if (isTest || Platform.OS === 'web') {
    let key = fallbackKeyMemory.get(MASTER_CARD_KEY_NAME);
    if (!key) {
      key = bytesToHex(getSecureRandomBytes(32));
      fallbackKeyMemory.set(MASTER_CARD_KEY_NAME, key);
    }
    return key;
  }

  throw new Error('Secure keystore is unavailable on this device.');
}

/**
 * Safely sets the master encryption key (e.g. during cross-device restore).
 */
export async function setMasterEncryptionKeyHex(keyHex: string): Promise<void> {
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('Invalid master encryption key: must be a 64-character hex string (256 bits).');
  }
  if (SecureStore) {
    try {
      const isAvailable = await SecureStore.isAvailableAsync();
      if (isAvailable) {
        await SecureStore.setItemAsync(MASTER_CARD_KEY_NAME, keyHex, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        });
        return;
      }
    } catch (e: any) {
      if (!isTestEnvironment()) {
        throw new Error(`Failed to store master key into hardware keystore: ${e?.message || 'error'}`);
      }
    }
  }

  if (isTestEnvironment() || Platform.OS === 'web') {
    fallbackKeyMemory.set(MASTER_CARD_KEY_NAME, keyHex);
    return;
  }

  throw new Error('Secure keystore is unavailable on this device.');
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
 * Encrypts a card number using AES-GCM (256-bit) with a unique 96-bit IV.
 * Format: aes-gcm:v1:<ivHex>:<ciphertextHex>
 * Fails closed if secure authenticated encryption is unavailable.
 */
export async function encryptCardNumber(cardNumber: string): Promise<string> {
  const clean = cleanCardNumber(cardNumber);
  if (!clean) throw new Error('Card number cannot be blank for encryption.');

  const keyHex = await getMasterEncryptionKeyHex();
  const keyBytes = hexToBytes(keyHex);
  const iv = getSecureRandomBytes(12); // 96-bit IV recommended for AES-GCM
  const plainBytes = new TextEncoder().encode(clean);

  // Authenticated encryption via WebCrypto SubtleCrypto AES-GCM
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

  // Fail-closed when secure authenticated encryption is unavailable
  throw new Error('Authenticated cryptographic encryption (AES-GCM) is unavailable on this device.');
}

/**
 * Checks whether an encrypted payload is in the legacy fallback:v1 format.
 */
export function isLegacyEncryptedCard(encryptedPayload: string): boolean {
  if (!encryptedPayload) return false;
  return encryptedPayload.startsWith('fallback:v1:');
}

/**
 * Decrypts an encrypted card number payload.
 * Supports modern authenticated AES-GCM and safe legacy fallback:v1 migration.
 */
export async function decryptCardNumber(encryptedPayload: string): Promise<string> {
  if (!encryptedPayload) throw new Error('Encrypted payload is empty.');

  const parts = encryptedPayload.split(':');
  if (parts.length < 4) {
    throw new Error('Invalid encrypted card format.');
  }

  const [scheme, version, ivHex, cipherHex] = parts;
  const keyHex = await getMasterEncryptionKeyHex();
  const keyBytes = hexToBytes(keyHex);
  const iv = hexToBytes(ivHex);
  const cipherBytes = hexToBytes(cipherHex);

  if (scheme === 'aes-gcm' && version === 'v1') {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle?.importKey) {
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
    }
    throw new Error('WebCrypto subtle is unavailable for AES-GCM decryption.');
  }

  // Safe migration support: decrypt existing fallback:v1 records so data is never destroyed
  if (scheme === 'fallback' && version === 'v1') {
    const plainBytes = legacyXorBytes(cipherBytes, legacyXorBytes(keyBytes, iv));
    return new TextDecoder().decode(plainBytes);
  }

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
    activeClipboardTimer = setTimeout(async () => {
      try {
        const current = await Clipboard.getStringAsync();
        if (current === text) {
          await Clipboard.setStringAsync('');
        }
      } catch {}
      activeClipboardTimer = null;
    }, clearDelayMs);
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
 */
export async function createCardKeyEnvelope(passphrase?: string): Promise<CardKeyEnvelope> {
  const masterKeyHex = await getMasterEncryptionKeyHex();
  const salt = getSecureRandomBytes(16);
  const iv = getSecureRandomBytes(12);

  const pw = passphrase || 'vaelth_default_card_envelope_v1';
  const enc = new TextEncoder();
  const importedPw = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(pw),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const wrappingKey = await globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    importedPw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const cipherBuffer = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    wrappingKey,
    enc.encode(masterKeyHex)
  );

  return {
    algorithm: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256',
    iterations: 100000,
    saltHex: bytesToHex(salt),
    ivHex: bytesToHex(iv),
    ciphertextHex: bytesToHex(new Uint8Array(cipherBuffer)),
  };
}

/**
 * Restores the master card encryption key from an encrypted envelope.
 */
export async function restoreCardKeyFromEnvelope(
  envelope: CardKeyEnvelope,
  passphrase?: string
): Promise<string> {
  if (!envelope || !envelope.saltHex || !envelope.ivHex || !envelope.ciphertextHex) {
    throw new Error('Invalid or corrupted card key envelope.');
  }

  const salt = hexToBytes(envelope.saltHex);
  const iv = hexToBytes(envelope.ivHex);
  const ciphertext = hexToBytes(envelope.ciphertextHex);

  const pw = passphrase || 'vaelth_default_card_envelope_v1';
  const enc = new TextEncoder();
  const importedPw = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(pw),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const wrappingKey = await globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: envelope.iterations || 100000,
      hash: 'SHA-256',
    },
    importedPw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      wrappingKey,
      ciphertext as unknown as BufferSource
    );
  } catch (err: any) {
    throw new Error('Failed to decrypt card key envelope. Incorrect password or corrupted envelope.');
  }

  const masterKeyHex = new TextDecoder().decode(decryptedBuffer);
  await setMasterEncryptionKeyHex(masterKeyHex);
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
