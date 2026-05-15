import { create } from 'zustand';

const AUTH_STORAGE_KEY = 'mahod:is-authenticated';
const GUEST_STORAGE_KEY = 'mahod:is-guest';

interface AuthState {
  isAuthenticated: boolean;
  isGuest: boolean;
  setAuthenticated: (authenticated: boolean) => void;
  setGuest: (guest: boolean) => void;
  logout: () => void;
}

function readInitialAuth(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(AUTH_STORAGE_KEY) === '1';
}

function readInitialGuest(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(GUEST_STORAGE_KEY) === '1';
}

function writeAuth(value: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, value ? '1' : '0');
}

function writeGuest(value: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(GUEST_STORAGE_KEY, value ? '1' : '0');
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: readInitialAuth(),
  isGuest: readInitialGuest(),
  setAuthenticated: (authenticated) => {
    writeAuth(authenticated);
    if (authenticated) {
      writeGuest(false);
      set({ isAuthenticated: true, isGuest: false });
    } else {
      set({ isAuthenticated: false });
    }
  },
  setGuest: (guest) => {
    writeGuest(guest);
    set({ isGuest: guest });
  },
  logout: () => {
    writeAuth(false);
    writeGuest(false);
    set({ isAuthenticated: false, isGuest: false });
  },
}));
