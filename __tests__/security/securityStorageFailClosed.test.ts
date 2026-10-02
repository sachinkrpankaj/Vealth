import * as SecureStore from 'expo-secure-store';
import { useSecurityStore } from '../../src/stores/useSecurityStore';

jest.mock('expo-secure-store', () => ({
  isAvailableAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('13. Security Store & Fail-Closed Keystore Persistence — Regression Tests', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    useSecurityStore.setState({
      isPinEnabled: false,
      isBiometricEnabled: false,
      isLocked: false,
      hasCheckedAuth: false,
      failedAttempts: 0,
      lockoutUntil: null,
    });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('fails closed and throws in production mode if SecureStore is unavailable during setPin', async () => {
    // Simulate production environment
    (process.env as any).NODE_ENV = 'production';

    (SecureStore.isAvailableAsync as jest.Mock).mockResolvedValue(false);

    await expect(useSecurityStore.getState().setPin('1234')).rejects.toThrow(
      'Hardware-backed SecureStore is unavailable on this device.'
    );

    // PIN must NOT be marked as enabled
    expect(useSecurityStore.getState().isPinEnabled).toBe(false);
  });

  it('fails closed and throws in production mode if SecureStore.setItemAsync throws a hardware error', async () => {
    (process.env as any).NODE_ENV = 'production';

    (SecureStore.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(
      new Error('Keystore key generation failed: Keystore locked')
    );

    await expect(useSecurityStore.getState().setPin('5678')).rejects.toThrow(
      'Failed to persist security credentials to hardware-backed keystore.'
    );

    // PIN must NOT be enabled
    expect(useSecurityStore.getState().isPinEnabled).toBe(false);
  });

  it('successfully enables PIN and persists salt and PBKDF2 hash when SecureStore succeeds', async () => {
    (SecureStore.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

    await useSecurityStore.getState().setPin('1234');

    expect(useSecurityStore.getState().isPinEnabled).toBe(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'vaelth_security_pin_hash',
      expect.stringContaining('pbkdf2:v1:'),
      expect.anything()
    );
  });
});
