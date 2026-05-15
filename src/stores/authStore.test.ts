import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ isAuthenticated: false, isGuest: false });
});

describe('authStore — setAuthenticated', () => {
  it('sets isAuthenticated to true and clears isGuest', () => {
    useAuthStore.setState({ isGuest: true });
    useAuthStore.getState().setAuthenticated(true);
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(true);
    expect(s.isGuest).toBe(false);
  });

  it('persists authenticated flag to localStorage', () => {
    useAuthStore.getState().setAuthenticated(true);
    expect(localStorage.getItem('mahod:is-authenticated')).toBe('1');
  });

  it('sets isAuthenticated to false', () => {
    useAuthStore.setState({ isAuthenticated: true });
    useAuthStore.getState().setAuthenticated(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('writes 0 to localStorage when set to false', () => {
    useAuthStore.getState().setAuthenticated(false);
    expect(localStorage.getItem('mahod:is-authenticated')).toBe('0');
  });
});

describe('authStore — setGuest', () => {
  it('sets isGuest to true', () => {
    useAuthStore.getState().setGuest(true);
    expect(useAuthStore.getState().isGuest).toBe(true);
  });

  it('persists guest flag to localStorage', () => {
    useAuthStore.getState().setGuest(true);
    expect(localStorage.getItem('mahod:is-guest')).toBe('1');
  });

  it('sets isGuest to false', () => {
    useAuthStore.setState({ isGuest: true });
    useAuthStore.getState().setGuest(false);
    expect(useAuthStore.getState().isGuest).toBe(false);
  });
});

describe('authStore — logout', () => {
  it('clears isAuthenticated and isGuest', () => {
    useAuthStore.setState({ isAuthenticated: true, isGuest: true });
    useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.isGuest).toBe(false);
  });

  it('clears localStorage keys', () => {
    localStorage.setItem('mahod:is-authenticated', '1');
    localStorage.setItem('mahod:is-guest', '1');
    useAuthStore.getState().logout();
    expect(localStorage.getItem('mahod:is-authenticated')).toBe('0');
    expect(localStorage.getItem('mahod:is-guest')).toBe('0');
  });
});
