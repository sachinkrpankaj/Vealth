import { create } from 'zustand';

export type DialogType = 'default' | 'danger' | 'warning' | 'info' | 'success';

export interface DialogButton {
  text: string;
  onPress?: () => void | Promise<void>;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface DialogConfig {
  title: string;
  message?: string;
  buttons?: DialogButton[];
  type?: DialogType;
  dismissable?: boolean;
}

interface DialogState {
  currentDialog: DialogConfig | null;
  isOpen: boolean;
  showDialog: (config: DialogConfig) => void;
  hideDialog: () => void;
  clearDialog: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  currentDialog: null,
  isOpen: false,
  showDialog: (config) => {
    // Determine type automatically if not explicitly provided
    let inferredType = config.type;
    if (!inferredType) {
      const hasDestructive = config.buttons?.some((b) => b.style === 'destructive');
      const lowerTitle = config.title.toLowerCase();
      if (hasDestructive || lowerTitle.includes('delete') || lowerTitle.includes('erase') || lowerTitle.includes('reset')) {
        inferredType = 'danger';
      } else if (lowerTitle.includes('error') || lowerTitle.includes('failed')) {
        inferredType = 'danger';
      } else if (lowerTitle.includes('required') || lowerTitle.includes('limit') || lowerTitle.includes('warning') || lowerTitle.includes('balance')) {
        inferredType = 'warning';
      } else if (lowerTitle.includes('success') || lowerTitle.includes('complete') || lowerTitle.includes('saved')) {
        inferredType = 'success';
      } else {
        inferredType = 'info';
      }
    }

    set({
      currentDialog: {
        ...config,
        type: inferredType,
      },
      isOpen: true,
    });
  },
  hideDialog: () => set({ isOpen: false }),
  clearDialog: () => set({ currentDialog: null, isOpen: false }),
}));

/**
 * Drop-in replacement for React Native's Alert.alert.
 * Adheres to the exact same signature while rendering within Vaelth's theme system.
 */
export function showThemedAlert(
  title: string,
  message?: string,
  buttons?: DialogButton[],
  options?: { cancelable?: boolean }
): void {
  useDialogStore.getState().showDialog({
    title,
    message,
    buttons,
    dismissable: options?.cancelable ?? true,
  });
}

export const ThemedAlert = {
  alert: showThemedAlert,
};
