import { create } from 'zustand';
import type { DateRange, Severity } from '@/types/common';

interface FilterState {
  searchQuery: string;
  dateRange: DateRange | null;
  severities: Severity[];

  setSearchQuery: (query: string) => void;
  setDateRange: (range: DateRange | null) => void;
  setSeverities: (severities: Severity[]) => void;
  toggleSeverity: (severity: Severity) => void;
  reset: () => void;
}

const initialState: Pick<FilterState, 'searchQuery' | 'dateRange' | 'severities'> = {
  searchQuery: '',
  dateRange: null,
  severities: ['low', 'mid', 'high'],
};

export const useFilterStore = create<FilterState>((set) => ({
  ...initialState,
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setDateRange: (dateRange) => set({ dateRange }),
  setSeverities: (severities) => set({ severities }),
  toggleSeverity: (severity) =>
    set((state) => ({
      severities: state.severities.includes(severity)
        ? state.severities.filter((s) => s !== severity)
        : [...state.severities, severity],
    })),
  reset: () => set({ ...initialState }),
}));
