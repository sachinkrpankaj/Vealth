import { easeOutCubic, calculateCountStep } from '../../src/utils/animationMath';

describe('Counting Animation Math & Interpolation', () => {
  test('easeOutCubic starts at 0 and ends at 1 with smooth deceleration', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 3); // decelerates towards 1
  });

  test('calculateCountStep interpolates correctly from 0 to 500000 paise (₹5,000)', () => {
    const stepStart = calculateCountStep(0, 500000, 0, 800);
    expect(stepStart.currentVal).toBe(0);
    expect(stepStart.isComplete).toBe(false);

    const stepHalf = calculateCountStep(0, 500000, 400, 800);
    expect(stepHalf.currentVal).toBe(437500); // 87.5% of 500,000
    expect(stepHalf.isComplete).toBe(false);

    const stepEnd = calculateCountStep(0, 500000, 800, 800);
    expect(stepEnd.currentVal).toBe(500000);
    expect(stepEnd.isComplete).toBe(true);
  });

  test('calculateCountStep handles negative values correctly', () => {
    const step = calculateCountStep(0, -200000, 800, 800);
    expect(step.currentVal).toBe(-200000);
    expect(step.isComplete).toBe(true);
  });

  test('calculateCountStep handles instantaneous duration', () => {
    const step = calculateCountStep(0, 100000, 0, 0);
    expect(step.currentVal).toBe(100000);
    expect(step.isComplete).toBe(true);
  });
});
