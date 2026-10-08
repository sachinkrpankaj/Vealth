import { getKeyboardViewport, getFocusedScrollOffset } from '../../src/utils/keyboardLayout';

describe('measured keyboard layout', () => {
  it.each([320, 360, 393, 412, 480, 600])('does not subtract the keyboard twice on a %i dp Android window', width => {
    // Width is deliberately independent of the vertical visibility calculation.
    const keyboardTop = width + 200;
    const resized = getKeyboardViewport(80, keyboardTop - 80, keyboardTop);
    expect(resized).toEqual({ top: 80, bottom: keyboardTop, overlap: 0 });
    expect(getFocusedScrollOffset({ scrollY: 0, inputTop: 120, inputHeight: 48,
      viewportTop: resized.top, viewportBottom: resized.bottom })).toBe(0);
  });

  it('adds only the portion that actually overlaps a modal viewport', () => {
    expect(getKeyboardViewport(220, 480, 500)).toEqual({ top: 220, bottom: 500, overlap: 200 });
    expect(getKeyboardViewport(220, 200, 500).overlap).toBe(0);
    expect(getKeyboardViewport(220, 480, null)).toEqual({ top: 220, bottom: 700, overlap: 0 });
  });

  it('reveals the bottom Note/Product Link with the minimum scroll delta', () => {
    expect(getFocusedScrollOffset({ scrollY: 140, inputTop: 460, inputHeight: 48,
      viewportTop: 100, viewportBottom: 480 })).toBe(168);
    expect(getFocusedScrollOffset({ scrollY: 168, inputTop: 432, inputHeight: 48,
      viewportTop: 100, viewportBottom: 480 })).toBe(168);
  });

  it('uses the actual modal origin and preserves an already visible top field', () => {
    expect(getFocusedScrollOffset({ scrollY: 90, inputTop: 250, inputHeight: 48,
      viewportTop: 220, viewportBottom: 500 })).toBe(90);
    expect(getFocusedScrollOffset({ scrollY: 90, inputTop: 200, inputHeight: 48,
      viewportTop: 220, viewportBottom: 500 })).toBe(70);
  });

  it('does not oscillate for a multiline field taller than the viewport', () => {
    const input = { scrollY: 0, inputTop: 180, inputHeight: 400, viewportTop: 100, viewportBottom: 300 };
    expect(getFocusedScrollOffset(input)).toBe(80);
    expect(getFocusedScrollOffset({ ...input, scrollY: 80, inputTop: 100 })).toBe(80);
    expect(getFocusedScrollOffset({ ...input, viewportBottom: 100 })).toBe(0);
  });
});
