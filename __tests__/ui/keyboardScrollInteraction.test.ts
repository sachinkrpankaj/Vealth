const mockEffects: Array<() => (() => void) | void> = [];
const mockSetState = jest.fn();
const mockListeners = new Map<string, (event?: any) => void>();
const mockFrames = new Map<number, () => void>();
let mockFocused: any = null;
let mockFrameId = 0;

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useRef: (current: unknown) => ({ current }),
  useState: (value: unknown) => [value, mockSetState],
  useCallback: (fn: unknown) => fn,
  useEffect: (fn: () => void) => { mockEffects.push(fn); },
}));
jest.mock('react-native', () => ({
  ScrollView: 'ScrollView', View: 'View', Platform: { OS: 'android' },
  StyleSheet: { create: (value: unknown) => value },
  TextInput: { State: { currentlyFocusedInput: () => mockFocused } },
  Keyboard: {
    metrics: () => undefined,
    addListener: (name: string, fn: () => void) => {
      mockListeners.set(name, fn);
      return { remove: () => mockListeners.delete(name) };
    },
  },
}));

import { KeyboardAwareScrollView } from '../../src/components/ui/KeyboardAwareScrollView';

function flushFrame() {
  const frames = [...mockFrames.values()];
  mockFrames.clear();
  frames.forEach(fn => fn());
}

function mount(props: Record<string, unknown> = {}) {
  const tree = (KeyboardAwareScrollView as any).render({ children: null, ...props }, null);
  const cleanups = mockEffects.splice(0).map(fn => fn());
  let top = 100;
  let height = 600;
  let inputTop = 620;
  const input = { measureInWindow: (fn: Function) => fn(10, inputTop, 200, 48) };
  const native = { measureInWindow: jest.fn((fn: Function) => fn(0, top, 360, height)) };
  const scrollTo = jest.fn(({ y }: { y: number }) => {
    inputTop -= y;
    tree.props.onScroll({ nativeEvent: { contentOffset: { y } } });
  });
  tree.props.ref({ getNativeScrollRef: () => native, scrollTo });
  return {
    tree, scrollTo, native, input,
    focus: () => {
      mockFocused = input;
      const event = { stopPropagation: jest.fn() };
      tree.props.onFocus(event);
      expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    },
    setViewport: (nextTop: number, nextHeight: number) => { top = nextTop; height = nextHeight; },
    setInputTop: (value: number) => { inputTop = value; },
    unmount: () => cleanups.forEach(fn => fn?.()),
  };
}

beforeEach(() => {
  mockEffects.length = 0;
  mockFrames.clear();
  mockListeners.clear();
  mockSetState.mockClear();
  mockFocused = null;
  global.requestAnimationFrame = jest.fn(fn => { const id = ++mockFrameId; mockFrames.set(id, () => fn(0)); return id; });
  global.cancelAnimationFrame = jest.fn(id => { if (id != null) mockFrames.delete(id); });
});

describe('keyboard event and scroll integration', () => {
  it('reveals an occluded bottom field and retries from content-size changes', () => {
    const form = mount();
    form.focus();
    mockListeners.get('keyboardDidShow')!({ endCoordinates: { screenY: 500 } });
    flushFrame();
    expect(mockSetState).toHaveBeenLastCalledWith(200);
    expect(form.scrollTo).toHaveBeenCalledWith({ y: 168, animated: false });
    form.tree.props.onContentSizeChange(360, 1000);
    flushFrame();
    expect(form.scrollTo).toHaveBeenCalledTimes(1);
    form.unmount();
  });

  it('composes caller events and never scrolls visible fields after Android resize', () => {
    const onLayout = jest.fn(); const onScroll = jest.fn(); const onContentSizeChange = jest.fn();
    const form = mount({ onLayout, onScroll, onContentSizeChange });
    form.setViewport(100, 400);
    form.setInputTop(120);
    form.focus();
    form.tree.props.onLayout({ nativeEvent: { layout: { height: 400 } } });
    form.tree.props.onContentSizeChange(360, 700);
    mockListeners.get('keyboardDidShow')!({ endCoordinates: { screenY: 500 } });
    flushFrame();
    expect(onLayout).toHaveBeenCalledTimes(1);
    expect(onContentSizeChange).toHaveBeenCalledWith(360, 700);
    expect(mockSetState).toHaveBeenLastCalledWith(0);
    expect(form.scrollTo).not.toHaveBeenCalled();
    form.tree.props.onScroll({ nativeEvent: { contentOffset: { y: 42 } } });
    expect(onScroll).toHaveBeenCalledTimes(1);
    form.unmount();
  });

  it('ignores inputs in another modal and cancels stale measurements on blur', () => {
    const form = mount();
    mockFocused = form.input;
    mockListeners.get('keyboardDidShow')!({ endCoordinates: { screenY: 500 } });
    flushFrame();
    expect(form.native.measureInWindow).not.toHaveBeenCalled();
    form.focus();
    let delayedMeasure: Function = () => {};
    form.native.measureInWindow.mockImplementation(fn => { delayedMeasure = fn; });
    flushFrame();
    form.tree.props.onBlur({ stopPropagation: jest.fn() });
    delayedMeasure(0, 100, 360, 600);
    expect(form.scrollTo).not.toHaveBeenCalled();
    form.unmount();
  });

  it('clears overlap on dismissal and cancels pending work on unmount', () => {
    const form = mount();
    form.focus();
    mockListeners.get('keyboardDidHide')!();
    expect(mockSetState).toHaveBeenLastCalledWith(0);
    form.unmount();
    flushFrame();
    expect(mockListeners.size).toBe(0);
    expect(form.scrollTo).not.toHaveBeenCalled();
  });
});
