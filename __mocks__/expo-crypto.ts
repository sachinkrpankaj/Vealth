import * as crypto from 'crypto';

export const CryptoDigestAlgorithm = {
  SHA256: 'SHA-256',
};

export const randomUUID = jest.fn(() => crypto.randomUUID());

export const digestStringAsync = jest.fn(async (_algo: string, val: string) => {
  return crypto.createHash('sha256').update(val).digest('hex');
});

export default {
  CryptoDigestAlgorithm,
  randomUUID,
  digestStringAsync,
};
