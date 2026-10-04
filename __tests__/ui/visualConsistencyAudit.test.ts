import * as fs from 'fs';

describe('UI Visual Consistency Audit — Verification Suite', () => {
  it('Bottom Navigation: verifies uniform tab rendering without Home-specific shadow or nested prisms', () => {
    const tabBarSource = fs.readFileSync('src/components/navigation/FloatingTabBar.tsx', 'utf8');

    // 1. Must not import or render nested LiquidGlassPrismOverlay inside the tab buttons
    expect(tabBarSource).not.toContain('<LiquidGlassPrismOverlay');
    expect(tabBarSource).not.toContain('LiquidGlassPrismOverlay');

    // 2. No heavy elevation 6 halo on activeSquircle
    expect(tabBarSource).not.toContain('elevation: 6');

    // 3. Inactive squircle must be clean and transparent (no hardcoded #EDF1FA background)
    expect(tabBarSource).not.toContain("backgroundColor: '#EDF1FA'");
    expect(tabBarSource).toContain("backgroundColor: 'transparent'");

    // 4. Inactive squircle must not leak borders
    expect(tabBarSource).toContain("borderColor: 'transparent'");

    // 5. Active tab must render identically for all routes without route-name branching
    expect(tabBarSource).not.toContain("route.name === 'home' ?");
    expect(tabBarSource).not.toContain("index === 0 ?");
  });

  it('LiquidGlassCard: verifies semantic tones fix in light mode and unique gradient IDs', () => {
    const cardSource = fs.readFileSync('src/components/ui/LiquidGlassCard.tsx', 'utf8');

    // 1. Negative tone must not turn into purple #4F46E5 in light mode
    expect(cardSource).toContain("tone === 'negative'");
    expect(cardSource).toContain("'#BE123C'");
    expect(cardSource).toContain("'#9F1239'");

    // 2. Positive tone must not turn into purple #4F46E5 in light mode
    expect(cardSource).toContain("tone === 'positive'");
    expect(cardSource).toContain("'#047857'");
    expect(cardSource).toContain("'#065F46'");

    // 3. Chromatic prism sheen must be disabled on semantic tones (negative/positive)
    expect(cardSource).toContain('isSemanticTone');

    // 4. Unique instance ID prefix used to prevent SVG gradient ID collisions
    expect(cardSource).toContain('idPrefix');
    expect(cardSource).toContain('`${idPrefix}_baseFillLight`');
    expect(cardSource).toContain('`${idPrefix}_baseFillDark`');
  });

  it('Date Picker: verifies shortcuts use unified FilterChip and clean buttons', () => {
    const calendarSource = fs.readFileSync('src/components/ui/CalendarModal.tsx', 'utf8');

    // 1. Must import and use FilterChip
    expect(calendarSource).toContain("import { FilterChip } from './FilterChip';");
    expect(calendarSource).toContain('<FilterChip');

    // 2. Shortcuts must render through FilterChip
    expect(calendarSource).toContain('shortcuts.map');
    expect(calendarSource).toContain('label={sc.label}');
    expect(calendarSource).toContain('selected={isActive}');

    // 3. Clear button must use FilterChip with destructive variant
    expect(calendarSource).toContain('label="Clear"');
    expect(calendarSource).toContain('variant="destructive"');
    expect(calendarSource).toContain('size="sm"');

    // 4. Footer cancel button must not be wrapped in LiquidGlassCard with double border
    expect(calendarSource).not.toContain('<LiquidGlassCard onPress={() => handleSmoothClose()}');
  });

  it('FilterChip: verifies design system component tokens and variants', () => {
    const chipSource = fs.readFileSync('src/components/ui/FilterChip.tsx', 'utf8');

    // 1. Supports destructive and default variants
    expect(chipSource).toContain("variant?: 'default' | 'destructive'");
    expect(chipSource).toContain('colors.negative');
    expect(chipSource).toContain('colors.negativeBg');

    // 2. Supports sm and md sizes
    expect(chipSource).toContain("size?: 'sm' | 'md'");
    expect(chipSource).toContain('sizeSm');
    expect(chipSource).toContain('sizeMd');
    expect(chipSource).toContain('minHeight: 32');
    expect(chipSource).toContain('minHeight: 38');

    // 3. Clean Pressable without nested LiquidGlassCard
    expect(chipSource).not.toContain('<LiquidGlassCard');
  });

  it('PayCreditCardBillModal: verifies clean border treatment without double borders', () => {
    const modalSource = fs.readFileSync('src/components/ui/PayCreditCardBillModal.tsx', 'utf8');

    // 1. accountOption specifies explicit border color when unselected
    expect(modalSource).toContain('colors.borderSubtle');
    expect(modalSource).toContain('colors.gold');

    // 2. closeBtn does not have stray borderWidth: 1
    expect(modalSource).not.toContain('closeBtn: {\n    width: 34,\n    height: 34,\n    alignItems: \'center\',\n    justifyContent: \'center\',\n    borderWidth: 1,');
  });

  it('ShoppingItemCard: verifies purchase button does not have nested shadow/elevation inside card', () => {
    const shoppingSource = fs.readFileSync('src/components/shopping/ShoppingItemCard.tsx', 'utf8');

    // purchaseBtn must not have elevation inside LiquidGlassCard
    expect(shoppingSource).not.toContain('purchaseBtn: {\n    flexDirection: \'row\',\n    alignItems: \'center\',\n    paddingVertical: 6,\n    paddingHorizontal: 14,\n    borderRadius: 8,\n    elevation: 2,');
  });
});
