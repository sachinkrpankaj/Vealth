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

describe('modal form and Android back regressions', () => {
  const modalFormSources = [
    'src/components/shopping/ItemFormModal.tsx',
    'src/components/shopping/PurchaseItemModal.tsx',
    'src/components/ui/PayCreditCardBillModal.tsx',
    'app/people/[id].tsx',
    'src/components/ui/CategoryPickerField.tsx',
    'app/assets/index.tsx',
    'app/liabilities/index.tsx',
    'app/spending-insights/index.tsx',
  ];

  it('keeps the shared flex default and locally opts auto-height modal forms out of flex growth', () => {
    const sharedScrollView = fs.readFileSync('src/components/ui/KeyboardAwareScrollView.tsx', 'utf8');
    expect(sharedScrollView).toContain('flex: 1');

    for (const path of modalFormSources) {
      const source = fs.readFileSync(path, 'utf8');
      expect(source).toContain('flex: 0');
      expect(source).toContain('flexShrink: 1');
      expect(source).toContain('extraScrollHeight={100}');
      expect(source).toContain("behavior={Platform.OS === 'ios' ? 'padding' : undefined}");
    }
  });

  it('keeps all requested modal form fields and keyboard-accessible actions in their scroll regions', () => {
    const requiredFieldsByFile: Record<string, string[]> = {
      'src/components/shopping/ItemFormModal.tsx': [
        'Product Name *',
        'Estimated Price (Optional)',
        'Product Link (Optional)',
        'Note / Specification (Optional)',
      ],
      'src/components/shopping/PurchaseItemModal.tsx': [
        'Actual Purchase Price *',
        'Paid From Account *',
        'Expense Category',
        'Purchase Date',
        'Transaction Note',
      ],
      'src/components/ui/PayCreditCardBillModal.tsx': [
        'Amount to Pay',
        'Payment Date *',
        'Paid Using Account *',
      ],
      'app/people/[id].tsx': ['Full Name *', 'Phone Number (optional)', 'Email (optional)', 'Notes (optional)'],
      'src/components/ui/CategoryPickerField.tsx': ['NAME', 'ACCENT COLOR'],
    };

    for (const [path, fields] of Object.entries(requiredFieldsByFile)) {
      const source = fs.readFileSync(path, 'utf8');
      const scrollStart = source.indexOf('<KeyboardAwareScrollView');
      const scrollEnd = source.indexOf('</KeyboardAwareScrollView>', scrollStart);
      expect(scrollStart).toBeGreaterThanOrEqual(0);
      expect(scrollEnd).toBeGreaterThan(scrollStart);
      const scrollContent = source.slice(scrollStart, scrollEnd);
      for (const field of fields) expect(scrollContent).toContain(field);
    }

    const purchaseForm = fs.readFileSync('src/components/shopping/PurchaseItemModal.tsx', 'utf8');
    const billForm = fs.readFileSync('src/components/ui/PayCreditCardBillModal.tsx', 'utf8');
    expect(purchaseForm).toContain('allowFutureDates={false}');
    expect(billForm).toContain('allowFutureDates={false}');
    expect(purchaseForm.indexOf('{/* Bottom Pinned Action CTA */}')).toBeGreaterThan(
      purchaseForm.indexOf('</KeyboardAwareScrollView>')
    );
    expect(billForm.indexOf('title="Confirm & Deduct Bill"')).toBeGreaterThan(
      billForm.indexOf('</KeyboardAwareScrollView>')
    );
    expect(purchaseForm).toContain('title="Confirm Purchase"');
    expect(billForm).toContain('extraScrollHeight={100}');
  });

  it('provides an Android onRequestClose handler for every React Native modal', () => {
    const modalFiles = [
      'app/assets/index.tsx',
      'app/liabilities/index.tsx',
      'app/people/[id].tsx',
      'app/spending-insights/index.tsx',
      'src/components/shopping/ItemFormModal.tsx',
      'src/components/shopping/ListActionModal.tsx',
      'src/components/shopping/ListFormModal.tsx',
      'src/components/shopping/PurchaseItemModal.tsx',
      'src/components/security/SecurityLockScreen.tsx',
      'src/components/ui/CalendarModal.tsx',
      'src/components/ui/CategoryPickerField.tsx',
      'src/components/ui/ColorWheelPicker.tsx',
      'src/components/ui/PayCreditCardBillModal.tsx',
    ];

    for (const path of modalFiles) {
      const source = fs.readFileSync(path, 'utf8');
      const modalCount = source.match(/<Modal\b/g)?.length ?? 0;
      const closeHandlerCount = source.match(/\bonRequestClose\s*=/g)?.length ?? 0;
      expect(closeHandlerCount).toBe(modalCount);
    }
  });
});
