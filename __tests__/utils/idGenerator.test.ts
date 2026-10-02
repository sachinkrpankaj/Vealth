import * as fs from 'fs';
import * as Crypto from 'expo-crypto';
import { generateEntityId } from '../../src/utils/idGenerator';

describe('secure entity ID generation', () => {
  afterEach(() => {
    (Crypto.randomUUID as jest.Mock).mockReset();
    (Crypto.randomUUID as jest.Mock).mockImplementation(() => require('crypto').randomUUID());
  });

  it('uses Expo Crypto UUIDs and preserves the requested entity prefix', () => {
    const id = generateEntityId('tx');
    expect(id).toMatch(/^tx_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(Crypto.randomUUID).toHaveBeenCalled();
  });

  it('produces a unique batch of IDs', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateEntityId('asset')));
    expect(ids.size).toBe(1000);
  });

  it('fails loudly when the secure UUID provider fails', () => {
    (Crypto.randomUUID as jest.Mock).mockImplementationOnce(() => {
      throw new Error('secure RNG unavailable');
    });
    expect(() => generateEntityId('tx')).toThrow('secure RNG unavailable');
  });

  it('has no weak production ID fallback', () => {
    const source = fs.readFileSync('src/utils/idGenerator.ts', 'utf8');
    expect(source).not.toMatch(/Math\.random|Date\.now|monotonicCounter|timestamp/i);
  });
});
