/**
 * Cubic ease-out curve for luxurious, fluid decelerating animation.
 * Progress curve: starts briskly and coasts smoothly to the final value.
 */
export function easeOutCubic(t: number): number {
  if (isNaN(t) || t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - Math.pow(1 - t, 3);
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
  const safeStart = isFinite(startVal) && !isNaN(startVal) ? startVal : 0;
  const safeTarget = isFinite(targetVal) && !isNaN(targetVal) ? targetVal : 0;
  if (!isFinite(durationMs) || durationMs <= 0 || !isFinite(elapsedMs) || elapsedMs >= durationMs) {
    return { currentVal: safeTarget, isComplete: true };
  }
  const progress = elapsedMs / durationMs;
  const eased = easeOutCubic(progress);
  const currentVal = Math.round(safeStart + (safeTarget - safeStart) * eased);
  return { currentVal, isComplete: false };
}
