import * as fs from 'fs';

describe('Android keyboard adjustment strategy', () => {
  it('keeps the People modal scroll-aware while avoiding a second Android KAV adjustment', () => {
    const peopleScreen = fs.readFileSync('app/people/[id].tsx', 'utf8');
    const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');

    expect(peopleScreen).toContain('<KeyboardAwareScrollView');
    expect(peopleScreen).toContain("behavior={Platform.OS === 'ios' ? 'padding' : undefined}");
    expect(peopleScreen).not.toContain("behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}");
    expect(manifest).toContain('android:windowSoftInputMode="adjustResize"');
  });

  it('does not combine the custom scroll view with Android KAV padding elsewhere', () => {
    const screens = [
      'app/assets/index.tsx',
      'app/liabilities/index.tsx',
      'app/spending-insights/index.tsx',
      'app/people/[id].tsx',
      'src/components/ui/ScreenContainer.tsx',
      'src/components/ui/CategoryPickerField.tsx',
      'src/components/ui/PayCreditCardBillModal.tsx',
      'src/components/shopping/ItemFormModal.tsx',
      'src/components/shopping/PurchaseItemModal.tsx',
    ];
    for (const path of screens) {
      const source = fs.readFileSync(path, 'utf8');
      if (source.includes('<KeyboardAwareScrollView')) {
        expect(source).toContain("behavior={Platform.OS === 'ios' ? 'padding' : undefined}");
        expect(source).not.toContain("behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}");
      }
    }
  });
});

describe('Shopping Add Item modal layout', () => {
  it('keeps the auto-sized form visible while retaining keyboard-aware scrolling and the pinned CTA', () => {
    const source = fs.readFileSync('src/components/shopping/ItemFormModal.tsx', 'utf8');
    const scrollArea = source.indexOf('<KeyboardAwareScrollView');
    const closeScrollArea = source.indexOf('</KeyboardAwareScrollView>', scrollArea);
    const pinnedCta = source.indexOf('{/* Bottom Pinned Action CTA */}');

    expect(source).toContain('style={[styles.scrollArea, { flex: 0, flexShrink: 1 }]}');
    expect(source).toContain('keyboardShouldPersistTaps="handled"');
    expect(source).toContain('extraScrollHeight={100}');
    expect(source).toContain("behavior={Platform.OS === 'ios' ? 'padding' : undefined}");
    expect(source).toContain('Product Name *');
    expect(source).toContain('Estimated Price (Optional)');
    expect(source).toContain('Product Link (Optional)');
    expect(source).toContain('Note / Specification (Optional)');
    expect(scrollArea).toBeGreaterThanOrEqual(0);
    expect(closeScrollArea).toBeGreaterThan(scrollArea);
    expect(pinnedCta).toBeGreaterThan(closeScrollArea);
    expect(source).toContain("title={initialItem ? 'Save Changes' : 'Add Item'}");
  });
});
