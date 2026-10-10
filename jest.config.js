module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^~/(.*)$': '<rootDir>/$1',
    '^expo-sqlite$': '<rootDir>/__mocks__/expo-sqlite.ts',
    '^expo-file-system/legacy$': '<rootDir>/__mocks__/expo-file-system.ts',
    '^expo-file-system$': '<rootDir>/__mocks__/expo-file-system.ts',
    '^expo-sharing$': '<rootDir>/__mocks__/expo-sharing.ts',
    '^expo-document-picker$': '<rootDir>/__mocks__/expo-document-picker.ts',
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.ts',
    '^expo-crypto$': '<rootDir>/__mocks__/expo-crypto.ts',
    '^expo-local-authentication$': '<rootDir>/__mocks__/expo-local-authentication.ts',
    '^expo-clipboard$': '<rootDir>/__mocks__/expo-clipboard.ts',
    '^react-native-svg$': '<rootDir>/__mocks__/react-native-svg.ts',
    '^react-native$': '<rootDir>/__mocks__/react-native.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        isolatedModules: true,
        rootDir: '.',
        ignoreDeprecations: '6.0',
        types: ['jest', 'node'],
      },
    }],
  },
};
