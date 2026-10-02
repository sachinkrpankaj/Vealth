import * as Crypto from 'expo-crypto';

/**
 * Generates entity IDs with Expo's platform CSPRNG-backed UUID implementation.
 * Fails closed if the platform cannot provide a secure UUID.
 */
export function generateEntityId(prefix: string): string {
  if (!prefix || !/^[a-z0-9-]+$/i.test(prefix)) {
    throw new Error('Entity ID prefix must contain only letters, numbers, and hyphens.');
  }
  const uuid = Crypto.randomUUID();
  if (!uuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
    throw new Error('Secure UUID generation is unavailable.');
  }
  return `${prefix}_${uuid}`;
}
