import { NativeModulesProxy } from 'expo-modules-core';

// Provide CSPRNG-backed fallback for unlinked native Expo modules in release APK
if (NativeModulesProxy) {
  if (!NativeModulesProxy.ExpoCrypto) {
    NativeModulesProxy.ExpoCrypto = {
      randomUUID: () => {
        if (typeof globalThis.crypto?.randomUUID === 'function') {
          return globalThis.crypto.randomUUID();
        }
        if (typeof globalThis.crypto?.getRandomValues === 'function') {
          const bytes = new Uint8Array(16);
          globalThis.crypto.getRandomValues(bytes);
          bytes[6] = (bytes[6] & 0x0f) | 0x40; // RFC4122 v4
          bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC4122 variant
          const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
          return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        }
        throw new Error('Secure UUID generation is unavailable.');
      },
      getRandomValues: (byteArray) => {
        if (typeof globalThis.crypto?.getRandomValues === 'function') {
          return globalThis.crypto.getRandomValues(byteArray);
        }
        throw new Error('Secure RNG unavailable.');
      },
      digestStringAsync: async (algo, data) => {
        if (typeof globalThis.crypto?.subtle?.digest === 'function') {
          const encoder = new TextEncoder();
          const hash = await globalThis.crypto.subtle.digest(algo || 'SHA-256', encoder.encode(data));
          return Array.from(new Uint8Array(hash))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
        }
        throw new Error('Secure digest unavailable.');
      },
    };
  }
  if (!NativeModulesProxy.ExpoCryptoAES) {
    NativeModulesProxy.ExpoCryptoAES = {
      EncryptionKey: class {},
      SealedData: class {},
    };
  }
  if (!NativeModulesProxy.ExpoSecureStore) {
    const memoryStore = new Map();
    NativeModulesProxy.ExpoSecureStore = {
      AFTER_FIRST_UNLOCK: 0,
      AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
      ALWAYS: 2,
      WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 3,
      ALWAYS_THIS_DEVICE_ONLY: 4,
      WHEN_UNLOCKED: 5,
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
      getValueWithKeyAsync: async (key) => memoryStore.get(key) ?? null,
      setValueWithKeyAsync: async (value, key) => { memoryStore.set(key, value); },
      deleteValueWithKeyAsync: async (key) => { memoryStore.delete(key); },
    };
  }
}

import 'expo-router/entry';
