import { describe, it, expect, beforeEach } from 'vitest';
import {
  useRoutePlannerStore,
  optionId,
  hasBothEndpoints,
  type RoutePlannerEndpoint,
} from './routePlannerStore';

const origin: RoutePlannerEndpoint = { lat: 32.08, lng: 34.78, label: 'תל אביב' };
const destination: RoutePlannerEndpoint = { lat: 31.9, lng: 34.8, label: 'ראשון לציון' };

beforeEach(() => {
  useRoutePlannerStore.getState().clear();
});

describe('optionId', () => {
  it('builds a string from route_id and direction_id', () => {
    expect(optionId({ route_id: 1, direction_id: 0 })).toBe('1-0');
  });

  it('handles different values', () => {
    expect(optionId({ route_id: 999, direction_id: 1 })).toBe('999-1');
  });
});

describe('hasBothEndpoints', () => {
  it('returns false when both are null', () => {
    expect(hasBothEndpoints({ origin: null, destination: null })).toBe(false);
  });

  it('returns false when only origin is set', () => {
    expect(hasBothEndpoints({ origin, destination: null })).toBe(false);
  });

  it('returns false when only destination is set', () => {
    expect(hasBothEndpoints({ origin: null, destination })).toBe(false);
  });

  it('returns true when both are set', () => {
    expect(hasBothEndpoints({ origin, destination })).toBe(true);
  });
});

describe('routePlannerStore — setOrigin / setDestination', () => {
  it('sets origin and clears pickingMode', () => {
    useRoutePlannerStore.setState({ pickingMode: 'origin' });
    useRoutePlannerStore.getState().setOrigin(origin);
    const s = useRoutePlannerStore.getState();
    expect(s.origin).toEqual(origin);
    expect(s.pickingMode).toBeNull();
  });

  it('sets destination and clears pickingMode', () => {
    useRoutePlannerStore.setState({ pickingMode: 'destination' });
    useRoutePlannerStore.getState().setDestination(destination);
    const s = useRoutePlannerStore.getState();
    expect(s.destination).toEqual(destination);
    expect(s.pickingMode).toBeNull();
  });

  it('can set origin to null (clear it)', () => {
    useRoutePlannerStore.setState({ origin });
    useRoutePlannerStore.getState().setOrigin(null);
    expect(useRoutePlannerStore.getState().origin).toBeNull();
  });
});

describe('routePlannerStore — swapEndpoints', () => {
  it('swaps origin and destination', () => {
    useRoutePlannerStore.setState({ origin, destination });
    useRoutePlannerStore.getState().swapEndpoints();
    const s = useRoutePlannerStore.getState();
    expect(s.origin).toEqual(destination);
    expect(s.destination).toEqual(origin);
  });

  it('resets results and status after swap', () => {
    useRoutePlannerStore.setState({ origin, destination, status: 'ready' });
    useRoutePlannerStore.getState().swapEndpoints();
    const s = useRoutePlannerStore.getState();
    expect(s.status).toBe('idle');
    expect(s.results).toBeNull();
    expect(s.selectedOptionId).toBeNull();
  });
});

describe('routePlannerStore — setPickingMode', () => {
  it('sets picking mode to origin', () => {
    useRoutePlannerStore.getState().setPickingMode('origin');
    expect(useRoutePlannerStore.getState().pickingMode).toBe('origin');
  });

  it('clears picking mode', () => {
    useRoutePlannerStore.setState({ pickingMode: 'destination' });
    useRoutePlannerStore.getState().setPickingMode(null);
    expect(useRoutePlannerStore.getState().pickingMode).toBeNull();
  });
});

describe('routePlannerStore — setMaxWalkMeters', () => {
  it('stores the walk distance', () => {
    useRoutePlannerStore.getState().setMaxWalkMeters(400);
    expect(useRoutePlannerStore.getState().maxWalkMeters).toBe(400);
  });
});

describe('routePlannerStore — beginRun', () => {
  it('sets status to running and clears error and results', () => {
    useRoutePlannerStore.setState({ status: 'error', error: 'fail', results: null });
    useRoutePlannerStore.getState().beginRun();
    const s = useRoutePlannerStore.getState();
    expect(s.status).toBe('running');
    expect(s.error).toBeNull();
    expect(s.results).toBeNull();
  });
});

describe('routePlannerStore — setError', () => {
  it('sets status to error with the message', () => {
    useRoutePlannerStore.getState().setError('no route found');
    const s = useRoutePlannerStore.getState();
    expect(s.status).toBe('error');
    expect(s.error).toBe('no route found');
  });
});

describe('routePlannerStore — selectOption', () => {
  it('sets selectedOptionId', () => {
    useRoutePlannerStore.getState().selectOption('42-0');
    expect(useRoutePlannerStore.getState().selectedOptionId).toBe('42-0');
  });

  it('can clear selectedOptionId', () => {
    useRoutePlannerStore.setState({ selectedOptionId: '1-0' });
    useRoutePlannerStore.getState().selectOption(null);
    expect(useRoutePlannerStore.getState().selectedOptionId).toBeNull();
  });
});

describe('routePlannerStore — clear', () => {
  it('resets all fields', () => {
    useRoutePlannerStore.setState({
      origin,
      destination,
      status: 'ready',
      selectedOptionId: '1-0',
      error: 'err',
      durationMs: 500,
    });
    useRoutePlannerStore.getState().clear();
    const s = useRoutePlannerStore.getState();
    expect(s.origin).toBeNull();
    expect(s.destination).toBeNull();
    expect(s.status).toBe('idle');
    expect(s.selectedOptionId).toBeNull();
    expect(s.error).toBeNull();
    expect(s.durationMs).toBeNull();
  });
});
