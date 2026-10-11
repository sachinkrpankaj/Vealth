import * as crypto from 'crypto';

export const CryptoDigestAlgorithm = {
  SHA256: 'SHA-256',
  SHA512: 'SHA-512',
};

export const randomUUID = jest.fn(() => crypto.randomUUID());

export const digestStringAsync = jest.fn(async (_algo: string, val: string) => {
  return crypto.createHash('sha256').update(val).digest('hex');
});

export const getRandomBytes = jest.fn((byteCount: number) => {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Cryptographically secure random number generator is unavailable.');
  }
  return new Uint8Array(crypto.randomBytes(byteCount));
});

export const getRandomValues = jest.fn(<T extends ArrayBufferView>(typedArray: T): T => {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Cryptographically secure random number generator is unavailable.');
  }
  const bytes = crypto.randomBytes(typedArray.byteLength);
  new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength).set(bytes);
  return typedArray;
});

export class AESEncryptionKey {
  public keyBytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.keyBytes = bytes;
  }

  static async generate(size = 256): Promise<AESEncryptionKey> {
    return new AESEncryptionKey(new Uint8Array(crypto.randomBytes(size / 8)));
  }

  static async import(
    input: Uint8Array | string,
    encoding?: 'hex' | 'base64'
  ): Promise<AESEncryptionKey> {
    if (typeof input === 'string') {
      const buf = Buffer.from(input, encoding === 'base64' ? 'base64' : 'hex');
      return new AESEncryptionKey(new Uint8Array(buf));
    }
    return new AESEncryptionKey(new Uint8Array(input));
  }

  async bytes(): Promise<Uint8Array> {
    return this.keyBytes;
  }

  async encoded(encoding: 'hex' | 'base64'): Promise<string> {
    const buf = Buffer.from(this.keyBytes);
    return encoding === 'base64' ? buf.toString('base64') : buf.toString('hex');
  }

  get size(): number {
    return this.keyBytes.length * 8;
  }
}

export class AESSealedData {
  public ivBytes: Uint8Array;
  public ciphertextBytesWithTag: Uint8Array;
  public tagLength: number;

  constructor(iv: Uint8Array, ciphertextWithTag: Uint8Array, tagLength = 16) {
    this.ivBytes = iv;
    this.ciphertextBytesWithTag = ciphertextWithTag;
    this.tagLength = tagLength;
  }

  static fromParts(
    iv: Uint8Array | string,
    ciphertext: Uint8Array | string,
    tag?: Uint8Array | string | number
  ): AESSealedData {
    const ivB = typeof iv === 'string' ? new Uint8Array(Buffer.from(iv, 'base64')) : new Uint8Array(iv);
    const cipherB =
      typeof ciphertext === 'string'
        ? new Uint8Array(Buffer.from(ciphertext, 'base64'))
        : new Uint8Array(ciphertext);

    if (typeof tag === 'number' || !tag) {
      return new AESSealedData(ivB, cipherB, typeof tag === 'number' ? tag : 16);
    }
    const tagB = typeof tag === 'string' ? new Uint8Array(Buffer.from(tag, 'base64')) : new Uint8Array(tag);
    const combinedCipher = new Uint8Array(cipherB.length + tagB.length);
    combinedCipher.set(cipherB);
    combinedCipher.set(tagB, cipherB.length);
    return new AESSealedData(ivB, combinedCipher, tagB.length);
  }

  static fromCombined(
    combined: Uint8Array | string,
    config?: { ivLength?: number; tagLength?: number }
  ): AESSealedData {
    const bytes =
      typeof combined === 'string'
        ? new Uint8Array(Buffer.from(combined, 'base64'))
        : new Uint8Array(combined);
    const ivLen = config?.ivLength ?? 12;
    const tagLen = config?.tagLength ?? 16;
    const iv = bytes.slice(0, ivLen);
    const cipherWithTag = bytes.slice(ivLen);
    return new AESSealedData(iv, cipherWithTag, tagLen);
  }

  async iv(encoding?: 'bytes' | 'base64'): Promise<Uint8Array | string> {
    if (encoding === 'base64') return Buffer.from(this.ivBytes).toString('base64');
    return this.ivBytes;
  }

  async tag(encoding?: 'bytes' | 'base64'): Promise<Uint8Array | string> {
    const offset = this.ciphertextBytesWithTag.length - this.tagLength;
    const tagBytes = this.ciphertextBytesWithTag.slice(offset);
    if (encoding === 'base64') return Buffer.from(tagBytes).toString('base64');
    return tagBytes;
  }

  async ciphertext(options?: {
    includeTag?: boolean;
    encoding?: 'bytes' | 'base64';
  }): Promise<Uint8Array | string> {
    const includeTag = options?.includeTag ?? false;
    const sliceEnd = includeTag
      ? this.ciphertextBytesWithTag.length
      : this.ciphertextBytesWithTag.length - this.tagLength;
    const bytes = this.ciphertextBytesWithTag.slice(0, sliceEnd);
    if (options?.encoding === 'base64') return Buffer.from(bytes).toString('base64');
    return bytes;
  }

  async combined(encoding?: 'bytes' | 'base64'): Promise<Uint8Array | string> {
    const total = new Uint8Array(this.ivBytes.length + this.ciphertextBytesWithTag.length);
    total.set(this.ivBytes);
    total.set(this.ciphertextBytesWithTag, this.ivBytes.length);
    if (encoding === 'base64') return Buffer.from(total).toString('base64');
    return total;
  }
}

export async function aesEncryptAsync(
  plaintext: Uint8Array | string,
  key: AESEncryptionKey,
  options: { nonce?: { bytes?: Uint8Array } | Uint8Array | number; additionalData?: Uint8Array | string } = {}
): Promise<AESSealedData> {
  const plainBytes =
    typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf-8') : Buffer.from(plaintext);

  let ivBytes: Buffer;
  if (options.nonce && typeof options.nonce === 'object' && 'bytes' in options.nonce && options.nonce.bytes) {
    ivBytes = Buffer.from(options.nonce.bytes);
  } else if (options.nonce instanceof Uint8Array) {
    ivBytes = Buffer.from(options.nonce);
  } else {
    ivBytes = crypto.randomBytes(typeof options.nonce === 'number' ? options.nonce : 12);
  }

  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key.keyBytes), ivBytes);
  if (options.additionalData) {
    const aad =
      typeof options.additionalData === 'string'
        ? Buffer.from(options.additionalData)
        : Buffer.from(options.additionalData);
    cipher.setAAD(aad);
  }

  const enc = Buffer.concat([cipher.update(plainBytes), cipher.final()]);
  const tag = cipher.getAuthTag();
  const cipherWithTag = Buffer.concat([enc, tag]);

  return new AESSealedData(new Uint8Array(ivBytes), new Uint8Array(cipherWithTag), tag.length);
}

export async function aesDecryptAsync(
  sealedData: AESSealedData,
  key: AESEncryptionKey,
  options: { output?: 'bytes' | 'base64'; additionalData?: Uint8Array | string } = {}
): Promise<Uint8Array | string> {
  const iv = Buffer.from(sealedData.ivBytes);
  const tagLen = sealedData.tagLength || 16;
  const cipherWithTag = Buffer.from(sealedData.ciphertextBytesWithTag);
  const enc = cipherWithTag.subarray(0, cipherWithTag.length - tagLen);
  const tag = cipherWithTag.subarray(cipherWithTag.length - tagLen);

  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key.keyBytes), iv);
  decipher.setAuthTag(tag);
  if (options.additionalData) {
    const aad =
      typeof options.additionalData === 'string'
        ? Buffer.from(options.additionalData)
        : Buffer.from(options.additionalData);
    decipher.setAAD(aad);
  }

  const decrypted = Buffer.concat([decipher.update(enc), decipher.final()]);
  if (options.output === 'base64') {
    return decrypted.toString('base64');
  }
  return new Uint8Array(decrypted);
}

export default {
  CryptoDigestAlgorithm,
  randomUUID,
  digestStringAsync,
  getRandomBytes,
  getRandomValues,
  AESEncryptionKey,
  AESSealedData,
  aesEncryptAsync,
  aesDecryptAsync,
};
