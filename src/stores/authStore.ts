import { create } from 'zustand';

const AUTH_STORAGE_KEY = 'mahod:is-authenticated';

interface AuthState {
  isAuthenticated: boolean;
  setAuthenticated: (authenticated: boolean) => void;
  logout: () => void;
}

function readInitialAuth(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(AUTH_STORAGE_KEY) === '1';
}

function writeAuth(value: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, value ? '1' : '0');
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: readInitialAuth(),
  setAuthenticated: (authenticated) => {
    writeAuth(authenticated);
    set({ isAuthenticated: authenticated });
  },
  logout: () => {
    writeAuth(false);
    set({ isAuthenticated: false });
  },
}));
