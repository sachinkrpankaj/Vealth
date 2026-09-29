import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { formatRupee, formatRupeeMasked, FormatRupeeOptions } from '../domain/finance/currency';
import { easeOutCubic, calculateCountStep } from '../utils/animationMath';

export { easeOutCubic, calculateCountStep };

export interface UseCountingAnimationOptions {
  duration?: number; // duration in ms, default 750ms
  triggerOnFocus?: boolean; // restart animation on screen focus, default true
  enabled?: boolean; // whether animation is active, default true
  isMinorUnits?: boolean; // if true, treats values as paise (minor units), default true
  isMasked?: boolean; // if true, returns masked privacy dots
  formatOptions?: FormatRupeeOptions;
  formatter?: (val: number) => string;
}

/**
 * Hook to smoothly animate counting from 0 (or previous value) to target value.
 * Triggers automatically on screen focus (e.g. when switching tabs or navigating back)
 * and whenever the target value updates.
 */
export function useCountingAnimation(
  targetValue: number,
  options?: UseCountingAnimationOptions
): {
  displayValue: number;
  formattedText: string;
} {
  const {
    duration = 750,
    triggerOnFocus = true,
    enabled = true,
    isMinorUnits = true,
    isMasked = false,
    formatOptions,
    formatter,
  } = options || {};

  const [displayValue, setDisplayValue] = useState<number>(enabled ? 0 : targetValue);
  const rafId = useRef<number | null>(null);
  const prevTargetRef = useRef<number>(targetValue);
  const currentDisplayRef = useRef<number>(displayValue);
  currentDisplayRef.current = displayValue;

  const cancelAnimation = useCallback(() => {
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  }, []);

  const runAnimation = useCallback(
    (fromVal: number, toVal: number) => {
      cancelAnimation();

      if (!enabled || duration <= 0) {
        setDisplayValue(toVal);
        return;
      }

      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const { currentVal, isComplete } = calculateCountStep(
          fromVal,
          toVal,
          elapsed,
          duration
        );

        setDisplayValue(currentVal);

        if (!isComplete) {
          rafId.current = requestAnimationFrame(step);
        } else {
          setDisplayValue(toVal);
          rafId.current = null;
        }
      };

      rafId.current = requestAnimationFrame(step);
    },
    [enabled, duration, cancelAnimation]
  );

  // Trigger on screen focus (e.g. user switches to this page/tab)
  useFocusEffect(
    useCallback(() => {
      if (triggerOnFocus && enabled) {
        // Animate from 0 to targetValue for a satisfying entrance
        runAnimation(0, targetValue);
      }
      return () => {
        cancelAnimation();
      };
    }, [triggerOnFocus, enabled, targetValue, runAnimation, cancelAnimation])
  );

  // Trigger if targetValue changes while screen is active
  useEffect(() => {
    if (prevTargetRef.current !== targetValue) {
      const fromVal = currentDisplayRef.current;
      prevTargetRef.current = targetValue;
      runAnimation(fromVal, targetValue);
    }
  }, [targetValue, runAnimation]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancelAnimation();
    };
  }, [cancelAnimation]);

  // Format display output
  let formattedText = '';
  if (isMasked) {
    formattedText = formatRupeeMasked(targetValue, {
      showSign: formatOptions?.showSign,
      symbol: formatOptions?.symbol,
    });
  } else if (formatter) {
    formattedText = formatter(displayValue);
  } else if (isMinorUnits) {
    formattedText = formatRupee(displayValue, formatOptions);
  } else {
    formattedText = displayValue.toLocaleString('en-IN');
  }

  return {
    displayValue,
    formattedText,
  };
}
