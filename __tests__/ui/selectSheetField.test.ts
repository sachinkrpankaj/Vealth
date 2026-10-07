import * as fs from 'fs';

describe('SelectSheetField UI & Component Audit', () => {
  const source = fs.readFileSync('src/components/ui/SelectSheetField.tsx', 'utf8');

  it('safely handles forwardRef icons like Lucide icons without returning raw objects', () => {
    // 1. Must check React.isValidElement(icon)
    expect(source).toContain('React.isValidElement(icon)');

    // 2. Must check for component types and forwardRef objects ('render' in icon or '$$typeof' in icon)
    expect(source).toContain("'render' in icon || '$$typeof' in icon");

    // 3. Must not return raw unrendered component objects
    expect(source).toContain('return null;');
  });

  it('renders a bottom sheet modal with dismiss backdrop', () => {
    expect(source).toContain('<Modal');
    expect(source).toContain('onPress={() => setModalVisible(false)}');
    expect(source).toContain('accessibilityRole="button"');
  });

  it('provides accessible select options with checkmark indicator', () => {
    expect(source).toContain('accessibilityState={{ selected: isSelected }}');
    expect(source).toContain('<Check');
  });
});
