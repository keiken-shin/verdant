import { create } from 'zustand';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  kind?: 'danger' | 'warning' | 'info';
}

interface ConfirmStore {
  isOpen: boolean;
  options: ConfirmOptions | null;
  resolver: ((value: boolean) => void) | null;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  respond: (value: boolean) => void;
}

export const useConfirmStore = create<ConfirmStore>((set, get) => ({
  isOpen: false,
  options: null,
  resolver: null,

  confirm: (options) => {
    return new Promise((resolve) => {
      set({
        isOpen: true,
        options,
        resolver: resolve,
      });
    });
  },

  respond: (value) => {
    const { resolver } = get();
    if (resolver) resolver(value);
    set({ isOpen: false, options: null, resolver: null });
  },
}));
