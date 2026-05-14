import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  /** Auto-dismiss timeout (ms). */
  durationMs: number;
}

interface UIState {
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  topLoaderVisible: boolean;
  toast: Toast | null;

  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setRightPanelOpen: (open: boolean) => void;
  setTopLoaderVisible: (visible: boolean) => void;
  /** Show a transient toast (replaces any existing one). */
  showToast: (message: string, durationMs?: number) => void;
  dismissToast: () => void;
}

let toastSeq = 0;

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  rightPanelOpen: true,
  topLoaderVisible: true,
  toast: null,

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setTopLoaderVisible: (visible) => set({ topLoaderVisible: visible }),
  showToast: (message, durationMs = 2200) => {
    toastSeq += 1;
    set({ toast: { id: toastSeq, message, durationMs } });
  },
  dismissToast: () => set({ toast: null }),
}));
