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

    const fallbackScrollResponder = (currentlyFocusedInput: any) => {
      try {
        if (!internalRef.current) return;
        const reactTag = findNodeHandle(currentlyFocusedInput);
        if (reactTag) {
          const responder = (internalRef.current as any).getScrollResponder?.();
          if (
            responder &&
            typeof responder.scrollResponderScrollNativeHandleToKeyboard === 'function'
          ) {
            responder.scrollResponderScrollNativeHandleToKeyboard(
              reactTag,
              extraScrollHeight,
              true
            );
          }
        }
      } catch {
        // Best effort
      }
    };

    const scrollToFocusedInput = useCallback(() => {
      if (!isMountedRef.current || !internalRef.current) return;

      try {
        const currentlyFocusedInput = TextInput.State.currentlyFocusedInput
          ? TextInput.State.currentlyFocusedInput()
          : null;

        if (!currentlyFocusedInput) return;

        const containerNode = findNodeHandle(internalRef.current);
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
              // Scroll to position input comfortably above bottom (accounting for labels/CTA)
              const targetY = Math.max(
                0,
                y - (extraScrollHeight > 60 ? 60 : extraScrollHeight)
              );
              internalRef.current.scrollTo({ y: targetY, animated: true });
            },
            () => {
              // Fallback to ScrollResponder native method
              fallbackScrollResponder(currentlyFocusedInput);
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
        style={[styles.scroll, style]}
        contentContainerStyle={[
          contentContainerStyle,
          { paddingBottom: dynamicPaddingBottom },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onFocus={handleChildFocus}
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
