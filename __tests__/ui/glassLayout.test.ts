import React from 'react';

const mockFlatten = (value: any): any => Array.isArray(value)
  ? Object.assign({}, ...value.filter(Boolean).map(mockFlatten)) : value || {};
jest.mock('react', () => ({ ...jest.requireActual('react'), useMemo: (fn: Function) => fn() }));
jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (value: unknown) => value, flatten: (value: unknown) => mockFlatten(value) },
}));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg' }));
jest.mock('../../src/theme', () => ({
  useTheme: () => ({ isDark: false, colors: {}, radii: { md: 14 }, spacing: { md: 16, lg: 24 },
    typography: { fontSizes: { body: 16 } } }),
}));

import { LiquidGlassCard } from '../../src/components/ui/LiquidGlassCard';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { IconButton } from '../../src/components/ui/IconButton';
import { EmptyState } from '../../src/components/ui/EmptyState';

function renderCard(style: any, pressable = true, extra: any = {}) {
  const tree = LiquidGlassCard({ children: 'Content', style, onPress: pressable ? jest.fn() : undefined, ...extra }) as any;
  const outer = mockFlatten(typeof tree.props.style === 'function' ? tree.props.style({ pressed: false }) : tree.props.style);
  const children = React.Children.toArray(tree.props.children.props.children) as any[];
  return { outer, overlay: children[0], inner: mockFlatten(children[children.length - 1].props.style), tree };
}

describe('glass card layout ownership', () => {
  it.each([true, false])('applies dimensions once on the outer root (pressable=%s)', pressable => {
    const dimensions = { width: '80%', minWidth: 160, maxWidth: 400, height: '50%', minHeight: 48,
      maxHeight: 300, flex: 1, flexBasis: 0, alignSelf: 'center', marginHorizontal: 12 };
    const { outer, inner } = renderCard([dimensions, { padding: 12, justifyContent: 'center' }], pressable);
    expect(outer).toMatchObject(dimensions);
    for (const key of Object.keys(dimensions).filter(key => key !== 'minWidth' && key !== 'alignSelf')) {
      expect(inner).not.toHaveProperty(key);
    }
    expect(inner.minWidth).toBe(0);
    expect(inner).toMatchObject({ alignSelf: 'stretch', flexGrow: 1, flexShrink: 1, padding: 12, justifyContent: 'center' });
  });

  it('fills a centered minimum-width Add Asset button without a nested percentage width', () => {
    const empty = EmptyState({ title: 'Valuable Assets', description: '', actionTitle: 'Add Asset', onAction: jest.fn() }) as any;
    const wrapper = (React.Children.toArray(empty.props.children) as any[]).at(-1);
    expect(mockFlatten(wrapper.props.style)).toMatchObject({ width: '100%', alignItems: 'center' });
    const button = PrimaryButton(wrapper.props.children.props) as any;
    const { outer, inner } = renderCard(button.props.style, true, button.props);
    expect(outer).toMatchObject({ minWidth: 160, alignSelf: 'center' });
    expect(inner).toMatchObject({ alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' });
    expect(inner).not.toHaveProperty('width');
    expect(inner).not.toHaveProperty('height');
  });

  it('honors radius overrides and draws exactly one border', () => {
    const { outer, overlay } = renderCard({ borderWidth: 1, borderRadius: 28 });
    expect(outer.borderRadius).toBe(28);
    expect(overlay.props).toMatchObject({ borderRadius: 28, showBorder: false });
    expect(renderCard({}).overlay.props.showBorder).toBe(true);
    expect(renderCard({ borderRadius: 28 }, true, { radius: 16 }).outer.borderRadius).toBe(16);
  });

  it.each(['default', 'destructive', 'success', 'accent'] as const)('keeps %s icon actions circular and shadow-free', variant => {
    const button = IconButton({ onPress: jest.fn(), accessibilityLabel: 'Action', variant, size: 36,
      style: { elevation: 4, shadowOpacity: 0.5 } }) as any;
    const style = mockFlatten(button.props.style({ pressed: false }));
    expect(style).toMatchObject({ width: 36, height: 36, borderRadius: 18, borderWidth: 1,
      elevation: 0, shadowOpacity: 0, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' });
    expect(button.props.children).toBeUndefined();
  });
});
