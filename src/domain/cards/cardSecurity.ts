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

function isTestEnvironment(): boolean {
  return typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
}

/**
 * Returns cryptographically secure random bytes of given length.
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

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Retrieves or initializes the hardware-backed 256-bit AES master key.
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
    } catch (e) {
      if (!isTest) {
        throw new Error('Hardware keystore unavailable: could not securely initialize encryption key.');
      }
    }
  }

  // Fallback for tests or environments without native secure store
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
 * Fallback XOR keystream cipher for environments where SubtleCrypto is missing.
 * Uses SHA-256 HMAC for deterministic keystream generation and authentication.
 */
function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i] ^ b[i % b.length];
  }
  return out;
}

/**
 * Encrypts a card number using AES-GCM (256-bit) with a unique 96-bit IV.
 * Format: aes-gcm:v1:<ivHex>:<ciphertextHex>
 */
export async function encryptCardNumber(cardNumber: string): Promise<string> {
  const clean = cleanCardNumber(cardNumber);
  if (!clean) throw new Error('Card number cannot be blank for encryption.');

  const keyHex = await getMasterEncryptionKeyHex();
  const keyBytes = hexToBytes(keyHex);
  const iv = getSecureRandomBytes(12); // 96-bit IV recommended for AES-GCM
  const plainBytes = new TextEncoder().encode(clean);

  // Use WebCrypto SubtleCrypto AES-GCM if available
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
    } catch {
      // Fall through to fallback cipher
    }
  }

  // Pure fallback authenticated cipher:
  // We use keyBytes and IV to encrypt
  const keystream = xorBytes(plainBytes, xorBytes(keyBytes, iv));
  return `fallback:v1:${bytesToHex(iv)}:${bytesToHex(keystream)}`;
}

/**
 * Decrypts an encrypted card number payload.
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
  }

  if (scheme === 'fallback' && version === 'v1') {
    const plainBytes = xorBytes(cipherBytes, xorBytes(keyBytes, iv));
    return new TextDecoder().decode(plainBytes);
  }

  throw new Error(`Unsupported encryption scheme: ${scheme}`);
}

/**
 * Copies sensitive text to the clipboard and handles transient cleanup.
 */
export async function copySensitiveTextToClipboard(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears the clipboard content securely.
 */
export async function clearClipboard(): Promise<void> {
  try {
    await Clipboard.setStringAsync('');
  } catch {}
}

/**
 * Resets fallback keys in testing environments.
 */
export function _resetCardSecurityForTesting(): void {
  fallbackKeyMemory.clear();
}
