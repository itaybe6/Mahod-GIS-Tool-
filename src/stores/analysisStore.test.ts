import { describe, it, expect, beforeEach } from 'vitest';
import type { FeatureCollection } from 'geojson';
import {
  useAnalysisStore,
  hasAnyLayerSelected,
  type AnalysisLayerSelection,
  type AnalysisResults,
} from './analysisStore';

const emptyFC: FeatureCollection = { type: 'FeatureCollection', features: [] };

const mockResults: AnalysisResults = {
  accidents: {
    features: emptyFC,
    counts: { count: 5, breakdown: { fatal: 1, severe: 2, light: 2 } },
  },
};

const defaultSelection: AnalysisLayerSelection = {
  transit: true,
  accidents: true,
  roads: false,
  infrastructure: false,
  traffic: true,
};

beforeEach(() => {
  useAnalysisStore.setState({
    selection: { ...defaultSelection },
    status: 'idle',
    results: null,
    error: null,
    durationMs: null,
    lastAnalyzedAt: null,
  });
});

describe('hasAnyLayerSelected', () => {
  it('returns true when at least one layer is selected', () => {
    expect(hasAnyLayerSelected(defaultSelection)).toBe(true);
  });

  it('returns false when all layers are deselected', () => {
    const none: AnalysisLayerSelection = {
      transit: false,
      accidents: false,
      roads: false,
      infrastructure: false,
      traffic: false,
    };
    expect(hasAnyLayerSelected(none)).toBe(false);
  });

  it('returns true when only one layer is selected', () => {
    expect(
      hasAnyLayerSelected({
        transit: false,
        accidents: true,
        roads: false,
        infrastructure: false,
        traffic: false,
      }),
    ).toBe(true);
  });
});

describe('analysisStore — setSelection', () => {
  it('replaces the full selection', () => {
    const newSel: AnalysisLayerSelection = {
      transit: false,
      accidents: false,
      roads: true,
      infrastructure: true,
      traffic: false,
    };
    useAnalysisStore.getState().setSelection(newSel);
    expect(useAnalysisStore.getState().selection).toEqual(newSel);
  });
});

describe('analysisStore — toggleLayer', () => {
  it('flips transit from true to false', () => {
    useAnalysisStore.getState().toggleLayer('transit');
    expect(useAnalysisStore.getState().selection.transit).toBe(false);
  });

  it('flips roads from false to true', () => {
    useAnalysisStore.getState().toggleLayer('roads');
    expect(useAnalysisStore.getState().selection.roads).toBe(true);
  });

  it('does not affect other layers', () => {
    useAnalysisStore.getState().toggleLayer('transit');
    const s = useAnalysisStore.getState().selection;
    expect(s.accidents).toBe(true);
    expect(s.traffic).toBe(true);
  });
});

describe('analysisStore — beginRun', () => {
  it('sets status to running and clears error', () => {
    useAnalysisStore.setState({ error: 'old error', status: 'error' });
    useAnalysisStore.getState().beginRun();
    const s = useAnalysisStore.getState();
    expect(s.status).toBe('running');
    expect(s.error).toBeNull();
  });
});

describe('analysisStore — setResults', () => {
  it('sets status to ready and stores results', () => {
    useAnalysisStore.getState().setResults(mockResults, 1500);
    const s = useAnalysisStore.getState();
    expect(s.status).toBe('ready');
    expect(s.results).toEqual(mockResults);
    expect(s.durationMs).toBe(1500);
  });

  it('sets lastAnalyzedAt to an ISO string', () => {
    useAnalysisStore.getState().setResults(mockResults, 100);
    const ts = useAnalysisStore.getState().lastAnalyzedAt;
    expect(ts).not.toBeNull();
    expect(() => new Date(ts!)).not.toThrow();
  });

  it('clears any previous error', () => {
    useAnalysisStore.setState({ error: 'prev error' });
    useAnalysisStore.getState().setResults(mockResults, 100);
    expect(useAnalysisStore.getState().error).toBeNull();
  });
});

describe('analysisStore — setError', () => {
  it('sets status to error with the message', () => {
    useAnalysisStore.getState().setError('Edge Function failed');
    const s = useAnalysisStore.getState();
    expect(s.status).toBe('error');
    expect(s.error).toBe('Edge Function failed');
  });
});

describe('analysisStore — clearResults', () => {
  it('resets status to idle and nullifies results', () => {
    useAnalysisStore.setState({
      status: 'ready',
      results: mockResults,
      durationMs: 1000,
      lastAnalyzedAt: new Date().toISOString(),
    });
    useAnalysisStore.getState().clearResults();
    const s = useAnalysisStore.getState();
    expect(s.status).toBe('idle');
    expect(s.results).toBeNull();
    expect(s.durationMs).toBeNull();
    expect(s.lastAnalyzedAt).toBeNull();
    expect(s.error).toBeNull();
  });
});
