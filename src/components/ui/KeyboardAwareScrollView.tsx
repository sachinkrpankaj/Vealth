import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  ScrollViewProps,
  Keyboard,
  Platform,
  StyleSheet,
  TextInput,
  KeyboardEvent,
  findNodeHandle,
  View,
} from 'react-native';

export interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  children: React.ReactNode;
  extraScrollHeight?: number;
  bottomOffset?: number;
}

export const KeyboardAwareScrollView = React.forwardRef<
  ScrollView,
  KeyboardAwareScrollViewProps
>(
  (
    {
      children,
      extraScrollHeight = 100,
      bottomOffset = 20,
      contentContainerStyle,
      style,
      onFocus,
      ...props
    },
    ref
  ) => {
    const internalRef = useRef<ScrollView>(null);
    const innerViewRef = useRef<View>(null);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const isMountedRef = useRef(true);
    const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Merge forwarded ref with internal ref
    const setRef = useCallback(
      (node: ScrollView | null) => {
        internalRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref && typeof ref === 'object') {
          (ref as React.MutableRefObject<ScrollView | null>).current = node;
        }
      },
      [ref]
    );

    const scrollYRef = useRef(0);
    const scrollViewHeightRef = useRef(0);

    const fallbackScrollResponder = (currentlyFocusedInput: any) => {
      try {
        if (!internalRef.current || !currentlyFocusedInput) return;
        const responder = (internalRef.current as any).getScrollResponder?.();
        if (
          responder &&
          typeof responder.scrollResponderScrollNativeHandleToKeyboard === 'function'
        ) {
          const target =
            typeof currentlyFocusedInput.measureLayout === 'function'
              ? currentlyFocusedInput
              : (typeof findNodeHandle === 'function'
                  ? findNodeHandle(currentlyFocusedInput)
                  : null) ?? currentlyFocusedInput;

          responder.scrollResponderScrollNativeHandleToKeyboard(
            target,
            extraScrollHeight,
            true
          );
        }
      } catch {
        // Best effort
      }
    };

    const scrollToFocusedInput = useCallback(() => {
      if (!isMountedRef.current || !internalRef.current) return;

      try {
        const currentlyFocusedInput = TextInput.State?.currentlyFocusedInput
          ? TextInput.State.currentlyFocusedInput()
          : null;

        if (!currentlyFocusedInput) return;

        const containerNode =
          (internalRef.current as any)?.getInnerViewRef?.() ??
          innerViewRef.current ??
          (internalRef.current as any)?.getNativeScrollRef?.();

        const targetNode = currentlyFocusedInput as any;

        if (
          containerNode &&
          targetNode &&
          typeof targetNode.measureLayout === 'function'
        ) {
          targetNode.measureLayout(
            containerNode,
            (x: number, y: number, width: number, height: number) => {
              if (!isMountedRef.current || !internalRef.current) return;
              const currentScrollY = scrollYRef.current;
              const viewportHeight = scrollViewHeightRef.current || 400;

              // The vertical extent of the focused input with a comfortable padding margin
              const inputTop = y;
              const inputBottom = y + height + 24;

              // Check if the input is below the currently visible viewport
              if (inputBottom > currentScrollY + viewportHeight) {
                // Input is partially or fully hidden beneath the bottom of the viewport / keyboard.
                // Scroll down just enough to bring the input and its margin into comfortable view.
                const targetY = inputBottom - viewportHeight + 20;
                internalRef.current.scrollTo({ y: Math.max(0, targetY), animated: true });
              } else if (inputTop < currentScrollY) {
                // Input is scrolled above the top of the viewport.
                // Scroll up to reveal it with a top margin.
                const targetY = Math.max(0, inputTop - 16);
                internalRef.current.scrollTo({ y: targetY, animated: true });
              }
              // If inputTop >= currentScrollY && inputBottom <= currentScrollY + viewportHeight:
              // The input is already completely visible in the viewport!
              // Do NOT scroll at all. This completely prevents static top elements,
              // headers, and controls from jumping unnecessarily.
            },
            () => {
              // Measurement failed
            }
          );
        } else {
          fallbackScrollResponder(currentlyFocusedInput);
        }
      } catch {
        // Best effort
      }
    }, [extraScrollHeight]);

    const scheduleScroll = useCallback(() => {
      scrollToFocusedInput();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(
        () => {
          if (isMountedRef.current) {
            scrollToFocusedInput();
          }
        },
        Platform.OS === 'android' ? 180 : 80
      );
    }, [scrollToFocusedInput]);

    useEffect(() => {
      isMountedRef.current = true;
      const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

      const onShow = (e: KeyboardEvent) => {
        if (!isMountedRef.current) return;
        const height = e.endCoordinates ? e.endCoordinates.height : 0;
        setKeyboardHeight(height);
        scheduleScroll();
      };

      const onHide = () => {
        if (!isMountedRef.current) return;
        setKeyboardHeight(0);
      };

      const showSub = Keyboard.addListener(showEvent, onShow);
      const hideSub = Keyboard.addListener(hideEvent, onHide);

      return () => {
        isMountedRef.current = false;
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        showSub.remove();
        hideSub.remove();
      };
    }, [scheduleScroll]);

    const handleChildFocus = (e: any) => {
      onFocus?.(e);
      scheduleScroll();
    };

    const flattenedContent = StyleSheet.flatten(contentContainerStyle) || {};
    const basePaddingBottom =
      typeof flattenedContent.paddingBottom === 'number'
        ? flattenedContent.paddingBottom
        : 20;

    // Provide extra scrollable clearance when keyboard is active
    const dynamicPaddingBottom =
      basePaddingBottom +
      (keyboardHeight > 0 ? Math.max(extraScrollHeight + 40, 120) : 0);

    return (
      <ScrollView
        ref={setRef}
        innerViewRef={innerViewRef as any}
        style={[styles.scroll, style]}
        contentContainerStyle={[
          contentContainerStyle,
          { paddingBottom: dynamicPaddingBottom },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onFocus={handleChildFocus}
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
          props.onScroll?.(e);
        }}
        onLayout={(e) => {
          scrollViewHeightRef.current = e.nativeEvent.layout.height;
          props.onLayout?.(e);
        }}
        scrollEventThrottle={16}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }
);

KeyboardAwareScrollView.displayName = 'KeyboardAwareScrollView';

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
});
