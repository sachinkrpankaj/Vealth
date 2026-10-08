import React from 'react';

// Exercise the screens' real event handlers and React element trees without loading native views.
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: jest.fn(),
  useRef: jest.fn(),
  useEffect: jest.fn(),
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
}));
jest.mock('react-native', () => ({
  ...Object.fromEntries(['View', 'Text', 'Pressable', 'TextInput', 'ScrollView', 'FlatList', 'Modal', 'KeyboardAvoidingView', 'Switch'].map((name) => [name, name])),
  StyleSheet: {
    create: (styles: unknown) => styles,
    absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    flatten: (styles: any): any => Array.isArray(styles)
      ? Object.assign({}, ...styles.map((style) => style || {})) : styles,
  },
  Platform: { OS: 'android' },
  Keyboard: { dismiss: jest.fn() },
  BackHandler: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({ id: 'person-1' }),
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, key) => key === '__esModule' ? true : key }));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Medium: 'Medium' },
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'Success' },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 30, left: 0, right: 0 }) }));
jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    isDark: true,
    colors: new Proxy({}, { get: () => '#123456' }),
    radii: { sm: 8, md: 12, lg: 18, xl: 24, full: 999 },
    spacing: { xs: 4, md: 16, lg: 24 },
    typography: { fontSizes: { body: 14, headingLg: 26 }, fontFamilies: { bold: 'bold' } },
  }),
}));
jest.mock('../../src/hooks/useFinancialData', () => ({ useFinancialData: jest.fn() }));
jest.mock('../../src/stores/useThemeStore', () => ({ useThemeStore: { getState: () => ({ setThemeMode: jest.fn() }) } }));
jest.mock('../../src/stores/useSecurityStore', () => ({ useSecurityStore: jest.fn() }));
jest.mock('../../src/database/repositories/accountRepository', () => ({ createAccount: jest.fn(), getAllAccounts: jest.fn(), getAccountById: jest.fn(), archiveAccount: jest.fn() }));
jest.mock('../../src/database/repositories/settingsRepository', () => ({ setSetting: jest.fn() }));
jest.mock('../../src/database/repositories/assetRepository', () => ({ updateAsset: jest.fn(), deleteAsset: jest.fn() }));
jest.mock('../../src/database/repositories/liabilityRepository', () => ({ updateLiability: jest.fn(), deleteLiability: jest.fn() }));
jest.mock('../../src/database/repositories/personRepository', () => ({ getPersonById: jest.fn(), getAllPeople: jest.fn(), updatePerson: jest.fn(), archivePerson: jest.fn() }));
jest.mock('../../src/database/repositories/transactionRepository', () => ({ getAllTransactions: jest.fn() }));
jest.mock('../../src/components/ui/ThemedDialog', () => ({ showThemedAlert: jest.fn() }));
jest.mock('../../src/utils/idGenerator', () => ({ generateEntityId: jest.fn((prefix: string) => `${prefix}-test`) }));

for (const name of ['ScreenContainer', 'PrimaryButton', 'SecondaryButton', 'AmountInput', 'VealthLogo', 'LiquidGlassCard', 'ColorWheelPicker', 'IconButton', 'Card', 'AmountText', 'EmptyState', 'KeyboardAwareScrollView', 'Avatar', 'SectionHeader', 'TransactionRow', 'SearchBar', 'FilterChip']) {
  jest.doMock(`../../src/components/ui/${name}`, () => ({ [name]: name }));
}
jest.doMock('../../src/components/navigation/AppHeader', () => ({ AppHeader: 'AppHeader' }));
jest.doMock('../../src/components/ui/PayCreditCardBillModal', () => ({ PayCreditCardBillModal: 'PayCreditCardBillModal' }));

const Onboarding = require('../../app/onboarding').default;
const Assets = require('../../app/assets/index').default;
const Liabilities = require('../../app/liabilities/index').default;
const Person = require('../../app/people/[id]').default;
const Security = require('../../app/settings/security').default;
const Activity = require('../../app/(tabs)/transactions').default;
const AccountDetail = require('../../app/accounts/[id]').default;
const { Keyboard, BackHandler, StyleSheet } = require('react-native');
const { router, useFocusEffect } = require('expo-router');
const { useFinancialData } = require('../../src/hooks/useFinancialData');
const { useSecurityStore } = require('../../src/stores/useSecurityStore');
const { createAccount } = require('../../src/database/repositories/accountRepository');
const { updateAsset } = require('../../src/database/repositories/assetRepository');
const { updateLiability } = require('../../src/database/repositories/liabilityRepository');
const { updatePerson } = require('../../src/database/repositories/personRepository');

let slots: any[];
let cursor: number;
function render(Screen: () => any) {
  cursor = 0;
  return Screen();
}
function descendants(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(descendants);
  return [tree, ...descendants(tree.props?.children)];
}
function find(tree: any, match: (element: any) => boolean) {
  const element = descendants(tree).find(match);
  if (!element) throw new Error('Expected element was not rendered');
  return element;
}
const byTitle = (tree: any, title: string) => find(tree, (element) => element.props?.title === title);
const byLabel = (tree: any, label: string) => find(tree, (element) => element.props?.accessibilityLabel === label);
const modal = (tree: any) => find(tree, (element) => element.type === 'Modal');
const text = (tree: any) => descendants(tree).filter((element) => element.type === 'Text').map((element) => element.props.children).join(' ');

const asset = { id: 'asset-1', name: 'Gold', category: 'GOLD', currentValue: 50000, purchaseValue: 50000, purchaseDate: '2026-01-01', isArchived: false };
const liability = { id: 'liability-1', name: 'Loan', type: 'PERSONAL_LOAN', amount: 40000, isArchived: false };
const person = { id: 'person-1', name: 'Alex', avatarColor: '#123456', isArchived: false };
let financialData: any;
let setPin: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  slots = [];
  cursor = 0;
  (React.useState as jest.Mock).mockImplementation((initial: any) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], (next: any) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
  });
  (React.useRef as jest.Mock).mockImplementation((initial: any) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = { current: initial };
    return slots[index];
  });
  financialData = { physicalAssets: [asset], standaloneLiabilities: [liability], accounts: [], people: [], categories: [], transactions: [], refresh: jest.fn().mockResolvedValue(undefined) };
  useFinancialData.mockImplementation(() => financialData);
  setPin = jest.fn().mockResolvedValue(undefined);
  useSecurityStore.mockReturnValue({ isPinEnabled: false, isBiometricEnabled: false, setPin, setBiometricEnabled: jest.fn() });
  createAccount.mockResolvedValue(undefined);
  updateAsset.mockResolvedValue(undefined);
  updateLiability.mockResolvedValue(undefined);
});

describe('onboarding navigation', () => {
  it('visits all four slides without rapid Next taps skipping a step, and allows Android back', () => {
    const titles = ['Know Your Net Worth', 'Track Every Money Movement', 'Understand Where Your Money Goes', 'Your Finances, Private'];
    for (let index = 0; index < titles.length; index++) {
      const tree = render(Onboarding);
      expect(text(tree)).toContain(titles[index]);
      const body = find(tree, (element) => element.type === 'ScrollView');
      expect(text(body)).toContain(titles[index]);
      expect(descendants(body).some((element) => element.type === 'PrimaryButton')).toBe(false);
      const next = byTitle(tree, index === 3 ? 'Get Started' : 'Next');
      next.props.onPress();
      next.props.onPress();
    }
    let tree = render(Onboarding);
    expect(text(tree)).toContain('Personalize your vault');
    byLabel(tree, 'Back to introduction').props.onPress();
    tree = render(Onboarding);
    expect(text(tree)).toContain(titles[3]);
    const register = useFocusEffect.mock.calls.at(-1)[0];
    const cleanup = register();
    expect(BackHandler.addEventListener.mock.calls.at(-1)[0]).toBe('hardwareBackPress');
    expect(BackHandler.addEventListener.mock.calls.at(-1)[1]()).toBe(true);
    expect(text(render(Onboarding))).toContain(titles[2]);
    cleanup();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('Skip still requires setup and prevents duplicate completion submissions', async () => {
    let tree = render(Onboarding);
    byLabel(tree, 'Skip onboarding introduction').props.onPress();
    tree = render(Onboarding);
    expect(text(tree)).toContain('Personalize your vault');
    byTitle(tree, 'Continue to Account Setup').props.onPress();
    tree = render(Onboarding);
    const finish = byTitle(tree, 'Complete Setup');
    await Promise.all([finish.props.onPress(), finish.props.onPress()]);
    expect(createAccount).toHaveBeenCalledTimes(2); // one cash and one bank account
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/home');
  });
});

describe.each([
  { name: 'asset', Screen: Assets, item: asset, update: updateAsset },
  { name: 'liability', Screen: Liabilities, item: liability, update: updateLiability },
  { name: 'person', Screen: Person, item: person, update: updatePerson },
])('$name edit modal', ({ name, Screen, item, update }) => {
  function openEditor() {
    if (name === 'person') {
      // Loaded person and debt summary are normally populated by the focus effect.
      slots = [person, { person, owedToYou: 0, youOwe: 0, netBalance: 0, dueStatus: 'SETTLED' }, [], [], false];
    }
    let tree = render(Screen);
    if (name === 'person') byLabel(tree, 'Edit person').props.onPress();
    else {
      const list = find(tree, (element) => element.type === 'FlatList');
      list.props.renderItem({ item }).props.onPress();
    }
    tree = render(Screen);
    expect(modal(tree).props.visible).toBe(true);
    return tree;
  }

  it('dismisses from the backdrop without saving and keeps content outside its touch target', () => {
    const tree = openEditor();
    const overlay = modal(tree).props.children;
    const siblings = React.Children.toArray(overlay.props.children) as any[];
    const backdrop = siblings.find((element) => element.type === 'Pressable');
    const positioner = siblings.find((element) => element.type === 'KeyboardAvoidingView');
    expect(positioner.props.pointerEvents).toBe('box-none');
    expect(backdrop.props.children).toBeUndefined();
    expect(descendants(positioner).some((element) => element.type === 'TextInput')).toBe(true);
    expect(modal(tree).props.onRequestClose).toBe(backdrop.props.onPress);
    backdrop.props.onPress();
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
    expect(modal(render(Screen)).props.visible).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('uses the same dismissal for Android Back and the close button', () => {
    const tree = openEditor();
    expect(byLabel(tree, `Close ${name} editor`).props.onPress).toBe(modal(tree).props.onRequestClose);
    modal(tree).props.onRequestClose();
    expect(modal(render(Screen)).props.visible).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});

it('Security Cancel clears both PIN fields and dismisses the keyboard without changing credentials', () => {
  let tree = render(Security);
  byTitle(tree, 'Set 4-Digit PIN').props.onPress();
  tree = render(Security);
  const fields = descendants(tree).filter((element) => element.type === 'TextInput');
  fields[0].props.onChangeText('1234');
  fields[1].props.onChangeText('1234');
  tree = render(Security);
  byTitle(tree, 'Cancel').props.onPress();
  tree = render(Security);
  expect(descendants(tree).some((element) => element.type === 'TextInput')).toBe(false);
  byTitle(tree, 'Set 4-Digit PIN').props.onPress();
  tree = render(Security);
  expect(descendants(tree).filter((element) => element.type === 'TextInput').map((element) => element.props.value)).toEqual(['', '']);
  expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
  expect(setPin).not.toHaveBeenCalled();
});

it('Activity Lowest remains inside the scrollable safe-area sheet and sorts values ascending', () => {
  financialData.transactions = [
    { id: 'large', type: 'EXPENSE', amount: 90000, date: '2026-01-02' },
    { id: 'small', type: 'EXPENSE', amount: 10000, date: '2026-01-01' },
  ];
  let tree = render(Activity);
  const sheet = modal(tree);
  const scroll = find(sheet, (element) => element.type === 'ScrollView');
  const lowest = byLabel(scroll, 'Lowest Amount: Smallest monetary values first');
  const sheetView = sheet.props.children.props.children[1];
  expect(StyleSheet.flatten(sheetView.props.style).paddingBottom).toBe(30);
  lowest.props.onPress();
  tree = render(Activity);
  expect(descendants(tree).filter((element) => element.type === 'TransactionRow').map((element) => element.props.transaction.id)).toEqual(['small', 'large']);
  expect(modal(tree).props.visible).toBe(false);
});

it('refreshes Account Activity after bill payment without unmounting or reopening the closing modal', async () => {
  const accounts = require('../../src/database/repositories/accountRepository');
  const transactions = require('../../src/database/repositories/transactionRepository');
  const people = require('../../src/database/repositories/personRepository');
  const card = { id: 'card', name: 'Card', type: 'CREDIT_CARD', openingBalance: -10000,
    creditLimit: 100000, billingDay: 1, dueDay: 20, isArchived: false };
  accounts.getAccountById.mockResolvedValue(card);
  accounts.getAllAccounts.mockResolvedValue([card]);
  transactions.getAllTransactions.mockResolvedValue([]);
  people.getAllPeople.mockResolvedValue([]);
  render(AccountDetail);
  useFocusEffect.mock.calls.at(-1)[0]();
  for (let i = 0; i < 12; i++) await Promise.resolve();
  let tree = render(AccountDetail);
  const getBillModal = (node: any) => find(node, element => element.type === 'PayCreditCardBillModal');
  // Open the actual screen action, then hold its refresh at the database boundary.
  const openButton = find(tree, element => element.props?.accessibilityLabel === 'Pay credit card bill');
  openButton.props.onPress();
  tree = render(AccountDetail);
  expect(getBillModal(tree).props.visible).toBe(true);
  let finishRefresh!: (value: unknown) => void;
  accounts.getAccountById.mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
  getBillModal(tree).props.onPaymentSuccess();
  tree = render(AccountDetail);
  expect(getBillModal(tree).props.visible).toBe(true);
  // Only the modal's close completion changes visibility, even while refresh is pending.
  getBillModal(tree).props.onClose();
  expect(getBillModal(render(AccountDetail)).props.visible).toBe(false);
  finishRefresh(card);
  for (let i = 0; i < 12; i++) await Promise.resolve();
  expect(getBillModal(render(AccountDetail)).props.visible).toBe(false);
});
