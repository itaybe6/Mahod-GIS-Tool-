import { describe, it, expect, beforeEach } from 'vitest';
import { useFilterStore } from './filterStore';

beforeEach(() => {
  useFilterStore.getState().reset();
});

describe('filterStore — setSearchQuery', () => {
  it('stores the query string', () => {
    useFilterStore.getState().setSearchQuery('תל אביב');
    expect(useFilterStore.getState().searchQuery).toBe('תל אביב');
  });

  it('can be cleared', () => {
    useFilterStore.getState().setSearchQuery('something');
    useFilterStore.getState().setSearchQuery('');
    expect(useFilterStore.getState().searchQuery).toBe('');
  });
});

describe('filterStore — setDateRange', () => {
  it('stores a date range', () => {
    const range = { from: new Date('2023-01-01'), to: new Date('2023-12-31') };
    useFilterStore.getState().setDateRange(range);
    expect(useFilterStore.getState().dateRange).toEqual(range);
  });

  it('can be cleared to null', () => {
    useFilterStore.getState().setDateRange({ from: new Date(), to: new Date() });
    useFilterStore.getState().setDateRange(null);
    expect(useFilterStore.getState().dateRange).toBeNull();
  });
});

describe('filterStore — setSeverities', () => {
  it('replaces the severities array', () => {
    useFilterStore.getState().setSeverities(['high']);
    expect(useFilterStore.getState().severities).toEqual(['high']);
  });

  it('can set empty array', () => {
    useFilterStore.getState().setSeverities([]);
    expect(useFilterStore.getState().severities).toHaveLength(0);
  });
});

describe('filterStore — toggleSeverity', () => {
  it('removes an existing severity', () => {
    useFilterStore.setState({ severities: ['low', 'mid', 'high'] });
    useFilterStore.getState().toggleSeverity('mid');
    expect(useFilterStore.getState().severities).toEqual(['low', 'high']);
  });

  it('adds a missing severity', () => {
    useFilterStore.setState({ severities: ['low', 'high'] });
    useFilterStore.getState().toggleSeverity('mid');
    expect(useFilterStore.getState().severities).toContain('mid');
  });

  it('does not duplicate an existing severity', () => {
    useFilterStore.setState({ severities: ['high'] });
    useFilterStore.getState().toggleSeverity('high');
    expect(useFilterStore.getState().severities).not.toContain('high');
  });
});

describe('filterStore — reset', () => {
  it('restores all fields to initial values', () => {
    useFilterStore.setState({
      searchQuery: 'something',
      dateRange: { from: new Date(), to: new Date() },
      severities: ['high'],
    });
    useFilterStore.getState().reset();
    const s = useFilterStore.getState();
    expect(s.searchQuery).toBe('');
    expect(s.dateRange).toBeNull();
    expect(s.severities).toEqual(['low', 'mid', 'high']);
  });
});
