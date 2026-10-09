import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ScrollView, ScrollViewProps, Keyboard, Platform, StyleSheet,
  TextInput, KeyboardEvent, View,
} from 'react-native';
import { getKeyboardViewport, getFocusedScrollOffset } from '../../utils/keyboardLayout';

export interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  children: React.ReactNode;
  /** Optional spacing between the focused field and the visible viewport edge. */
  bottomOffset?: number;
}

export const KeyboardAwareScrollView = React.forwardRef<ScrollView, KeyboardAwareScrollViewProps>(
  ({ children, bottomOffset = 16, style, onFocus, onBlur, onScroll, onScrollBeginDrag, onLayout,
    onContentSizeChange, ...props }, ref) => {
    const scrollRef = useRef<ScrollView | null>(null);
    const focusedRef = useRef<ReturnType<typeof TextInput.State.currentlyFocusedInput>>(null);
    const keyboardTopRef = useRef<number | null>(null);
    const scrollYRef = useRef(0);
    const frameRef = useRef<number | null>(null);
    const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const revisionRef = useRef(0);
    const mountedRef = useRef(true);
    const [overlap, setOverlap] = useState(0);
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    const cancelReveal = useCallback(() => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (retryRef.current !== null) clearTimeout(retryRef.current);
      frameRef.current = null;
      retryRef.current = null;
      ++revisionRef.current;
    }, []);

    const setRef = useCallback((node: ScrollView | null) => {
      scrollRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    }, [ref]);

    const measureAndReveal = useCallback(() => {
      const scroll = scrollRef.current;
      const focused = focusedRef.current;
      const revision = ++revisionRef.current;
      const isCurrent = () => mountedRef.current && revision === revisionRef.current &&
        focused === focusedRef.current && focused === TextInput.State.currentlyFocusedInput();
      // Only the scroll view receiving the input's focus event may reveal it.
      // Mounted screens behind a modal must never scroll the modal's input.
      if (!scroll || !focused || !isCurrent()) return;

      scroll.getNativeScrollRef()?.measureInWindow((_x, top, _width, height) => {
        if (!isCurrent() || height <= 0) return;
        const viewport = getKeyboardViewport(top, height, keyboardTopRef.current);
        setOverlap(viewport.overlap);
        focused.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
          if (!isCurrent() || inputHeight <= 0) return;
          const currentY = scrollYRef.current;
          const targetY = getFocusedScrollOffset({
            scrollY: currentY, inputTop, inputHeight,
            viewportTop: viewport.top, viewportBottom: viewport.bottom,
            clearance: bottomOffset,
          });
          if (targetY !== currentY) {
            // Layout and content-size events retry after the measured spacer commits.
            // Native scrolling clamps to content bounds; onScroll records that value.
            scroll.scrollTo({ y: targetY, animated: false });
          }
        });
      });
    }, [bottomOffset]);

    const scheduleReveal = useCallback(() => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        measureAndReveal();
      });
    }, [measureAndReveal]);

    const revealAfterTransition = useCallback(() => {
      scheduleReveal();
      if (retryRef.current !== null) clearTimeout(retryRef.current);
      // Native modal/keyboard animations can move the window without a new
      // React layout event. Measure again once that transition has settled.
      retryRef.current = setTimeout(() => {
        retryRef.current = null;
        scheduleReveal();
      }, 350);
    }, [scheduleReveal]);

    useEffect(() => {
      mountedRef.current = true;
      keyboardTopRef.current = Keyboard.metrics()?.screenY ?? null;
      setKeyboardVisible(keyboardTopRef.current !== null);
      const onShow = (event: KeyboardEvent) => {
        keyboardTopRef.current = event.endCoordinates.screenY;
        setKeyboardVisible(true);
        revealAfterTransition();
      };
      const onHide = () => {
        keyboardTopRef.current = null;
        cancelReveal();
        setKeyboardVisible(false);
        setOverlap(0);
      };
      const subscriptions = [
        Keyboard.addListener('keyboardDidShow', onShow),
        Keyboard.addListener('keyboardDidHide', onHide),
        ...(Platform.OS === 'ios' ? [Keyboard.addListener('keyboardDidChangeFrame', onShow)] : []),
      ];
      return () => {
        mountedRef.current = false;
        cancelReveal();
        subscriptions.forEach(subscription => subscription.remove());
      };
    }, [revealAfterTransition, cancelReveal]);

    return (
      <ScrollView
        {...props}
        ref={setRef}
        style={[styles.scroll, style]}
        keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? 'handled'}
        keyboardDismissMode={props.keyboardDismissMode ?? 'on-drag'}
        automaticallyAdjustKeyboardInsets={false}
        onFocus={event => {
          // A form inside a modal/nested scroll region owns its own focus adjustment.
          event.stopPropagation();
          focusedRef.current = TextInput.State.currentlyFocusedInput();
          onFocus?.(event);
          revealAfterTransition();
        }}
        onBlur={event => {
          event.stopPropagation();
          focusedRef.current = null;
          cancelReveal();
          onBlur?.(event);
        }}
        onScroll={event => {
          scrollYRef.current = event.nativeEvent.contentOffset.y;
          onScroll?.(event);
        }}
        onScrollBeginDrag={event => {
          cancelReveal();
          onScrollBeginDrag?.(event);
        }}
        onLayout={event => {
          onLayout?.(event);
          scheduleReveal();
        }}
        onContentSizeChange={(width, height) => {
          onContentSizeChange?.(width, height);
          scheduleReveal();
        }}
        scrollEventThrottle={props.scrollEventThrottle ?? 16}
      >
        {children}
        <View pointerEvents="none" style={{ height: overlap + (keyboardVisible ? bottomOffset : 0), flexShrink: 0 }} />
      </ScrollView>
    );
  }
);

KeyboardAwareScrollView.displayName = 'KeyboardAwareScrollView';
const styles = StyleSheet.create({ scroll: { flex: 1 } });
