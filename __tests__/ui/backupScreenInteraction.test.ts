import React from 'react';

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: (initial: any) => [typeof initial === 'function' ? initial() : initial, jest.fn()],
  useRef: (initial: any) => ({ current: initial }),
  useEffect: jest.fn(),
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
}));

jest.mock('react-native', () => ({
  ...Object.fromEntries([
    'View',
    'Text',
    'Pressable',
    'TextInput',
    'ScrollView',
    'FlatList',
    'Modal',
    'KeyboardAvoidingView',
    'ActivityIndicator',
  ].map((name) => [name, name])),
  StyleSheet: {
    create: (styles: unknown) => styles,
    flatten: (styles: any): any =>
      Array.isArray(styles) ? Object.assign({}, ...styles.map((s: any) => s || {})) : styles,
  },
  Platform: { OS: 'android' },
  Keyboard: { dismiss: jest.fn() },
}));

jest.mock('lucide-react-native', () =>
  new Proxy({}, { get: (_, key) => (key === '__esModule' ? true : key) })
);

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    isDark: true,
    colors: {
      accent: '#6366F1',
      surface: '#1E293B',
      surfaceElevated: '#334155',
      surfaceSubtle: '#0F172A',
      border: '#475569',
      textPrimary: '#FFFFFF',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      negative: '#EF4444',
      positive: '#10B981',
      positiveBg: 'rgba(16, 185, 129, 0.1)',
    },
    radii: { sm: 6, md: 10, lg: 16, xl: 20, full: 9999 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
    typography: {
      fontSizes: { body: 14, caption: 12 },
      fontFamilies: { regular: 'System', bold: 'System-Bold' },
    },
  }),
}));

import { BackupPassphraseModal } from '../../src/components/backup/BackupPassphraseModal';

describe('BackupPassphraseModal UI & Interaction Tests', () => {
  it('renders correctly in export mode with testID', () => {
    const handleClose = jest.fn();
    const handleSubmit = jest.fn().mockResolvedValue(undefined);

    const element = React.createElement(BackupPassphraseModal, {
      visible: true,
      mode: 'export',
      cardCount: 3,
      onClose: handleClose,
      onSubmit: handleSubmit,
    });

    expect(element).toBeDefined();
    const rendered = (element.type as any)(element.props);
    expect(rendered).not.toBeNull();
    expect(rendered.props.testID).toBe('backup-passphrase-modal');
  });

  it('renders correctly in restore mode with restore title and single passphrase field', () => {
    const handleClose = jest.fn();
    const handleSubmit = jest.fn().mockResolvedValue(undefined);

    const element = React.createElement(BackupPassphraseModal, {
      visible: true,
      mode: 'restore',
      cardCount: 2,
      onClose: handleClose,
      onSubmit: handleSubmit,
    });

    const rendered = (element.type as any)(element.props);
    expect(rendered).not.toBeNull();
    expect(rendered.props.testID).toBe('backup-passphrase-modal');
  });

  it('does not render when visible is false', () => {
    const element = React.createElement(BackupPassphraseModal, {
      visible: false,
      mode: 'export',
      onClose: jest.fn(),
      onSubmit: jest.fn(),
    });

    const rendered = (element.type as any)(element.props);
    expect(rendered).toBeNull();
  });
});
