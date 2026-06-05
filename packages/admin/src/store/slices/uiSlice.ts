import type { StateCreator } from 'zustand'

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  duration?: number;
}

export interface UiSlice {
  lastError: string | null;
  sidebarCollapsed: boolean;
  activeSection: string;
  breadcrumbPath: string[];
  toasts: ToastItem[];
  commandPaletteOpen: boolean;
  onboardingDismissed: boolean;

  setLastError: (e: string | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveSection: (section: string) => void;
  setBreadcrumbPath: (path: string[]) => void;
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  dismissOnboarding: () => void;
}

let toastCounter = 0;

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  lastError: null,
  sidebarCollapsed: false,
  activeSection: 'dashboard',
  breadcrumbPath: ['Dashboard'],
  toasts: [],
  commandPaletteOpen: false,
  onboardingDismissed: false,

  setLastError: (e) => set({ lastError: e }),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  setActiveSection: (section) => set({ activeSection: section }),

  setBreadcrumbPath: (path) => set({ breadcrumbPath: path }),

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${++toastCounter}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  dismissOnboarding: () => set({ onboardingDismissed: true }),
});
