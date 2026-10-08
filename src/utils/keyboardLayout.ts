/** All positions are measured in window coordinates, including the keyboard frame. */
export function getKeyboardViewport(top: number, height: number, keyboardTop: number | null) {
  const bottom = keyboardTop === null ? top + height : Math.max(top, Math.min(top + height, keyboardTop));
  return { top, bottom, overlap: Math.max(0, top + height - bottom) };
}

export function getFocusedScrollOffset({ scrollY, inputTop, inputHeight, viewportTop, viewportBottom, clearance = 0 }: {
  scrollY: number;
  inputTop: number;
  inputHeight: number;
  viewportTop: number;
  viewportBottom: number;
  clearance?: number;
}): number {
  if (viewportBottom <= viewportTop) return scrollY;
  // Oversized multiline fields reveal their top rather than oscillating between edges.
  const visibleHeight = viewportBottom - viewportTop;
  const inputBottom = inputTop + Math.min(inputHeight, visibleHeight);
  const gap = Math.min(Math.max(0, clearance), Math.max(0, visibleHeight - inputHeight));
  if (inputTop < viewportTop) return Math.max(0, scrollY + inputTop - viewportTop);
  if (inputBottom > viewportBottom - gap) {
    return Math.max(0, scrollY + inputBottom - viewportBottom + gap);
  }
  return scrollY;
}
