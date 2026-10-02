let Crypto: typeof import('expo-crypto') | null = null;
try {
  Crypto = require('expo-crypto');
} catch {}

let monotonicCounter = 0;

/**
 * Generates collision-resistant, unique IDs for entities across Vaelth.
 * Format: `${prefix}_${uuid}` or `${prefix}_${timestamp}_${counter}_${entropy}`
 */
export function generateEntityId(prefix: string): string {
  // 1. Try expo-crypto randomUUID if available
  if (Crypto && typeof Crypto.randomUUID === 'function') {
    try {
      return `${prefix}_${Crypto.randomUUID()}`;
    } catch {}
  }

  // 2. Try globalThis.crypto.randomUUID if available (modern JS runtime / Web)
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    try {
      return `${prefix}_${globalThis.crypto.randomUUID()}`;
    } catch {}
  }

  // 3. Robust monotonic timestamp + counter + random entropy fallback
  monotonicCounter = (monotonicCounter + 1) % 1000000;
  const timestamp = Date.now().toString(36);
  const counterStr = monotonicCounter.toString(36).padStart(4, '0');
  const randomEntropy = Math.random().toString(36).substring(2, 10);

  return `${prefix}_${timestamp}_${counterStr}_${randomEntropy}`;
}
