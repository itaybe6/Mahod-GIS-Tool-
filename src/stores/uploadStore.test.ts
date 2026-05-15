import { describe, it, expect, beforeEach } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { useUploadStore } from './uploadStore';

const mockPolygon: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [34.75, 31.25],
            [34.85, 31.25],
            [34.85, 31.35],
            [34.75, 31.35],
            [34.75, 31.25],
          ],
        ],
      },
    },
  ],
};

const mockBbox: [number, number, number, number] = [34.75, 31.25, 34.85, 31.35];

beforeEach(() => {
  useUploadStore.setState({
    status: 'idle',
    polygon: null,
    bbox: null,
    sourceName: null,
    savedFile: null,
    featureCount: 0,
    reprojectedFrom: null,
    error: null,
    municipalitiesStatus: 'idle',
    municipalities: null,
    municipalitiesError: null,
    inputMode: 'upload',
    drawingPhase: 'idle',
  });
});

describe('uploadStore — setParsing', () => {
  it('sets status to parsing with the source name', () => {
    useUploadStore.getState().setParsing('test.zip');
    const s = useUploadStore.getState();
    expect(s.status).toBe('parsing');
    expect(s.sourceName).toBe('test.zip');
  });

  it('clears previous error', () => {
    useUploadStore.setState({ error: 'old error' });
    useUploadStore.getState().setParsing('file.geojson');
    expect(useUploadStore.getState().error).toBeNull();
  });

  it('resets municipalities state', () => {
    useUploadStore.setState({ municipalitiesStatus: 'ready', municipalities: [] });
    useUploadStore.getState().setParsing('file.zip');
    expect(useUploadStore.getState().municipalitiesStatus).toBe('idle');
    expect(useUploadStore.getState().municipalities).toBeNull();
  });
});

describe('uploadStore — setPolygon', () => {
  it('sets status to ready and stores the polygon', () => {
    useUploadStore.getState().setPolygon({
      polygon: mockPolygon,
      bbox: mockBbox,
      sourceName: 'area.geojson',
      featureCount: 1,
      reprojectedFrom: null,
    });
    const s = useUploadStore.getState();
    expect(s.status).toBe('ready');
    expect(s.polygon).toEqual(mockPolygon);
    expect(s.bbox).toEqual(mockBbox);
    expect(s.sourceName).toBe('area.geojson');
    expect(s.featureCount).toBe(1);
    expect(s.reprojectedFrom).toBeNull();
  });

  it('clears error on success', () => {
    useUploadStore.setState({ error: 'prev error' });
    useUploadStore.getState().setPolygon({
      polygon: mockPolygon,
      bbox: mockBbox,
      sourceName: 'area.geojson',
      featureCount: 1,
      reprojectedFrom: null,
    });
    expect(useUploadStore.getState().error).toBeNull();
  });
});

describe('uploadStore — setError', () => {
  it('sets status to error with the message', () => {
    useUploadStore.getState().setError('קובץ לא תקין');
    const s = useUploadStore.getState();
    expect(s.status).toBe('error');
    expect(s.error).toBe('קובץ לא תקין');
  });
});

describe('uploadStore — municipalities', () => {
  it('setMunicipalitiesLoading sets status to loading', () => {
    useUploadStore.getState().setMunicipalitiesLoading();
    expect(useUploadStore.getState().municipalitiesStatus).toBe('loading');
  });

  it('setMunicipalities stores hits and sets status to ready', () => {
    const hits = [
      {
        semel_yishuv: 1,
        name_he: 'תל אביב',
        name_en: 'Tel Aviv',
        nafa: null,
        mahoz: null,
        overlap_area_m2: 100,
        overlap_pct: 80,
        is_nearest: false,
        distance_m: 0,
      },
    ];
    useUploadStore.getState().setMunicipalities(hits);
    const s = useUploadStore.getState();
    expect(s.municipalitiesStatus).toBe('ready');
    expect(s.municipalities).toEqual(hits);
  });

  it('setMunicipalitiesError sets status to error', () => {
    useUploadStore.getState().setMunicipalitiesError('network error');
    const s = useUploadStore.getState();
    expect(s.municipalitiesStatus).toBe('error');
    expect(s.municipalitiesError).toBe('network error');
    expect(s.municipalities).toBeNull();
  });
});

describe('uploadStore — input mode & drawing phase', () => {
  it('setInputMode switches to draw', () => {
    useUploadStore.getState().setInputMode('draw');
    expect(useUploadStore.getState().inputMode).toBe('draw');
  });

  it('setDrawingPhase switches to drawing', () => {
    useUploadStore.getState().setDrawingPhase('drawing');
    expect(useUploadStore.getState().drawingPhase).toBe('drawing');
  });

  it('setDrawingPhase switches to editing', () => {
    useUploadStore.getState().setDrawingPhase('editing');
    expect(useUploadStore.getState().drawingPhase).toBe('editing');
  });
});

describe('uploadStore — clear', () => {
  it('resets polygon and status to idle', () => {
    useUploadStore.setState({
      status: 'ready',
      polygon: mockPolygon,
      bbox: mockBbox,
      featureCount: 3,
    });
    useUploadStore.getState().clear();
    const s = useUploadStore.getState();
    expect(s.status).toBe('idle');
    expect(s.polygon).toBeNull();
    expect(s.bbox).toBeNull();
    expect(s.featureCount).toBe(0);
  });

  it('preserves the inputMode after clear', () => {
    useUploadStore.setState({ inputMode: 'draw' });
    useUploadStore.getState().clear();
    expect(useUploadStore.getState().inputMode).toBe('draw');
  });

  it('resets drawingPhase to idle', () => {
    useUploadStore.setState({ drawingPhase: 'editing' });
    useUploadStore.getState().clear();
    expect(useUploadStore.getState().drawingPhase).toBe('idle');
  });
});
