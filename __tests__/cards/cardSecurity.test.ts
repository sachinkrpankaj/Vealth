import {
  encryptCardNumber,
  decryptCardNumber,
  getMasterEncryptionKeyHex,
  copySensitiveTextToClipboard,
  _resetCardSecurityForTesting,
} from '../../src/domain/cards/cardSecurity';
import * as SecureStore from 'expo-secure-store';

describe('Card Wallet — Cryptography & Security Architecture', () => {
  beforeEach(() => {
    _resetCardSecurityForTesting();
    jest.clearAllMocks();
  });

  it('generates and securely stores 256-bit AES master key in hardware SecureStore', async () => {
    const key = await getMasterEncryptionKeyHex();
    expect(key).toBeDefined();
    expect(key.length).toBe(64); // 32 bytes = 64 hex characters (256-bit key)
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'vaelth_card_wallet_master_key',
      key,
      expect.anything()
    );
  });

  it('successfully encrypts and decrypts card numbers (round-trip)', async () => {
    const testCardNumber = '4532015098211234';
    const encrypted = await encryptCardNumber(testCardNumber);

    expect(encrypted).toBeDefined();
    expect(encrypted.startsWith('aes-gcm:v1:') || encrypted.startsWith('fallback:v1:')).toBe(true);

    // CRITICAL: Plaintext card number must NEVER appear in ciphertext
    expect(encrypted).not.toContain(testCardNumber);

    const decrypted = await decryptCardNumber(encrypted);
    expect(decrypted).toBe(testCardNumber);
  });

  it('generates unique ciphertexts for identical card numbers due to random IVs', async () => {
    const cardNumber = '5100000000001234';
    const cipher1 = await encryptCardNumber(cardNumber);
    const cipher2 = await encryptCardNumber(cardNumber);

    expect(cipher1).not.toBe(cipher2); // Distinct IVs

    // Both decrypt to identical number
    expect(await decryptCardNumber(cipher1)).toBe(cardNumber);
    expect(await decryptCardNumber(cipher2)).toBe(cardNumber);
  });

  it('rejects empty or whitespace-only card numbers', async () => {
    await expect(encryptCardNumber('')).rejects.toThrow(/cannot be blank/i);
    await expect(encryptCardNumber('   ')).rejects.toThrow(/cannot be blank/i);
  });

  it('rejects invalid or corrupted encrypted payloads', async () => {
    await expect(decryptCardNumber('')).rejects.toThrow(/empty/i);
    await expect(decryptCardNumber('invalid-payload')).rejects.toThrow(/invalid encrypted card format/i);
    await expect(decryptCardNumber('unknown:v1:123:456')).rejects.toThrow(/unsupported encryption scheme/i);
  });

  it('copies sensitive text to clipboard safely', async () => {
    const result = await copySensitiveTextToClipboard('4532015098211234');
    expect(result).toBe(true);
  });
});
