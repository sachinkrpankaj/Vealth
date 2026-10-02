import React, { useRef, useEffect, useState } from 'react';
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
    const scrollViewRef = (ref as React.RefObject<ScrollView | null>) || internalRef;
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const scrollToFocusedInput = () => {
      try {
        const currentlyFocusedInput = TextInput.State.currentlyFocusedInput
          ? TextInput.State.currentlyFocusedInput()
          : null;

        if (currentlyFocusedInput && scrollViewRef.current) {
          const reactTag = findNodeHandle(currentlyFocusedInput as any);
          if (reactTag) {
            const responder = (scrollViewRef.current as any).getScrollResponder?.();
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
        }
      } catch {
        // Best effort
      }
    };

    useEffect(() => {
      const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

      const onShow = (e: KeyboardEvent) => {
        const height = e.endCoordinates ? e.endCoordinates.height : 0;
        setKeyboardHeight(height);

        // Auto scroll to focused input when keyboard opens
        setTimeout(
          () => {
            scrollToFocusedInput();
          },
          Platform.OS === 'android' ? 120 : 50
        );
      };

      const onHide = () => {
        setKeyboardHeight(0);
      };

      const showSub = Keyboard.addListener(showEvent, onShow);
      const hideSub = Keyboard.addListener(hideEvent, onHide);

      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, [extraScrollHeight]);

    const handleChildFocus = (e: any) => {
      onFocus?.(e);
      setTimeout(
        () => {
          scrollToFocusedInput();
        },
        Platform.OS === 'android' ? 80 : 30
      );
    };

    const flattenedContent = StyleSheet.flatten(contentContainerStyle) || {};
    const basePaddingBottom =
      typeof flattenedContent.paddingBottom === 'number'
        ? flattenedContent.paddingBottom
        : 20;

    // On Android, provide extra scrollable clearance when keyboard is active
    const dynamicPaddingBottom =
      basePaddingBottom +
      (keyboardHeight > 0
        ? Math.max(keyboardHeight * 0.4, extraScrollHeight + 40)
        : 0);

    return (
      <ScrollView
        ref={scrollViewRef}
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
