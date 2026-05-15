import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './uiStore';

beforeEach(() => {
  useUIStore.setState({
    sidebarCollapsed: false,
    rightPanelOpen: true,
    topLoaderVisible: true,
    toast: null,
    mobileSidebarOpen: false,
    mobileRightPanelOpen: false,
  });
});

describe('uiStore — sidebar', () => {
  it('setSidebarCollapsed sets the value', () => {
    useUIStore.getState().setSidebarCollapsed(true);
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
  });

  it('toggleSidebar flips from false to true', () => {
    useUIStore.setState({ sidebarCollapsed: false });
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
  });

  it('toggleSidebar flips from true to false', () => {
    useUIStore.setState({ sidebarCollapsed: true });
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });
});

describe('uiStore — right panel', () => {
  it('setRightPanelOpen sets to false', () => {
    useUIStore.getState().setRightPanelOpen(false);
    expect(useUIStore.getState().rightPanelOpen).toBe(false);
  });

  it('setRightPanelOpen sets to true', () => {
    useUIStore.setState({ rightPanelOpen: false });
    useUIStore.getState().setRightPanelOpen(true);
    expect(useUIStore.getState().rightPanelOpen).toBe(true);
  });
});

describe('uiStore — mobile overlays', () => {
  it('setMobileSidebarOpen sets to true', () => {
    useUIStore.getState().setMobileSidebarOpen(true);
    expect(useUIStore.getState().mobileSidebarOpen).toBe(true);
  });

  it('setMobileRightPanelOpen sets to true', () => {
    useUIStore.getState().setMobileRightPanelOpen(true);
    expect(useUIStore.getState().mobileRightPanelOpen).toBe(true);
  });
});

describe('uiStore — top loader', () => {
  it('setTopLoaderVisible sets to false', () => {
    useUIStore.getState().setTopLoaderVisible(false);
    expect(useUIStore.getState().topLoaderVisible).toBe(false);
  });
});

describe('uiStore — toast', () => {
  it('showToast creates a toast with the message', () => {
    useUIStore.getState().showToast('hello');
    const toast = useUIStore.getState().toast;
    expect(toast).not.toBeNull();
    expect(toast?.message).toBe('hello');
  });

  it('showToast uses default duration of 2200ms', () => {
    useUIStore.getState().showToast('test');
    expect(useUIStore.getState().toast?.durationMs).toBe(2200);
  });

  it('showToast accepts a custom duration', () => {
    useUIStore.getState().showToast('test', 5000);
    expect(useUIStore.getState().toast?.durationMs).toBe(5000);
  });

  it('consecutive showToast calls increment the id', () => {
    useUIStore.getState().showToast('first');
    const id1 = useUIStore.getState().toast?.id ?? 0;
    useUIStore.getState().showToast('second');
    const id2 = useUIStore.getState().toast?.id ?? 0;
    expect(id2).toBeGreaterThan(id1);
  });

  it('dismissToast clears the toast', () => {
    useUIStore.getState().showToast('test');
    useUIStore.getState().dismissToast();
    expect(useUIStore.getState().toast).toBeNull();
  });
});
