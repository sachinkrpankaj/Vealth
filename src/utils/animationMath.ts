/**
 * Cubic ease-out curve for luxurious, fluid decelerating animation.
 * Progress curve: starts briskly and coasts smoothly to the final value.
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
}

/**
 * Calculate interpolated value given start, target, elapsed time, and duration.
 */
export function calculateCountStep(
  startVal: number,
  targetVal: number,
  elapsedMs: number,
  durationMs: number
): { currentVal: number; isComplete: boolean } {
  if (durationMs <= 0 || elapsedMs >= durationMs) {
    return { currentVal: targetVal, isComplete: true };
  }
  const progress = elapsedMs / durationMs;
  const eased = easeOutCubic(progress);
  const currentVal = Math.round(startVal + (targetVal - startVal) * eased);
  return { currentVal, isComplete: false };
}
