import { create } from 'zustand';
import type { FeatureCollection } from 'geojson';

/** Which spatial layers the user wants returned by `analyze-area`. */
export interface AnalysisLayerSelection {
  transit: boolean;
  accidents: boolean;
  roads: boolean;
  infrastructure: boolean;
}

export type AnalysisLayerKey = keyof AnalysisLayerSelection;

/** Stats payload returned for a single layer when present. */
export interface LayerCounts {
  /** Total feature count after the spatial filter. */
  count: number;
  /** Optional per-category breakdown (e.g. fatal/severe/light for accidents). */
  breakdown?: Record<string, number>;
}

export interface LayerResult {
  features: FeatureCollection;
  counts: LayerCounts;
}

export interface AnalysisResults {
  transit?: LayerResult;
  accidents?: LayerResult;
  roads?: LayerResult;
  infrastructure?: LayerResult;
}

export type AnalysisStatus = 'idle' | 'running' | 'ready' | 'error';

interface AnalysisState {
  /** Currently selected layers (persists across runs). */
  selection: AnalysisLayerSelection;
  status: AnalysisStatus;
  results: AnalysisResults | null;
  error: string | null;
  /** Wall-clock duration of the most recent run, in ms. */
  durationMs: number | null;

  setSelection: (selection: AnalysisLayerSelection) => void;
  toggleLayer: (key: AnalysisLayerKey) => void;
  beginRun: () => void;
  setResults: (results: AnalysisResults, durationMs: number) => void;
  setError: (error: string) => void;
  clearResults: () => void;
}

const DEFAULT_SELECTION: AnalysisLayerSelection = {
  transit: true,
  accidents: true,
  roads: false,
  infrastructure: false,
};

export const useAnalysisStore = create<AnalysisState>((set) => ({
  selection: DEFAULT_SELECTION,
  status: 'idle',
  results: null,
  error: null,
  durationMs: null,

  setSelection: (selection) => set({ selection }),
  toggleLayer: (key) =>
    set((state) => ({ selection: { ...state.selection, [key]: !state.selection[key] } })),
  beginRun: () => set({ status: 'running', error: null }),
  setResults: (results, durationMs) =>
    set({ status: 'ready', results, error: null, durationMs }),
  setError: (error) => set({ status: 'error', error }),
  clearResults: () =>
    set({ status: 'idle', results: null, error: null, durationMs: null }),
}));

/** Helper for the analyze button — true if at least one layer is selected. */
export function hasAnyLayerSelected(selection: AnalysisLayerSelection): boolean {
  return Object.values(selection).some(Boolean);
}
