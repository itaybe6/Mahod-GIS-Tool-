import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from './mapStore';

const ALL_LAYERS_ON = {
  transit: true,
  accidents: true,
  roads: true,
  infrastructure: true,
  traffic: true,
};

beforeEach(() => {
  localStorage.clear();
  useMapStore.setState({
    mapType: 'mapbox3d',
    activeLayers: { ...ALL_LAYERS_ON },
    activeDomain: 'all',
    focusRequest: null,
    lastGeocodeCamera: null,
    focusAnalysisFeature: null,
  });
});

describe('mapStore — toggleLayer', () => {
  it('disables an enabled layer', () => {
    useMapStore.getState().toggleLayer('transit');
    expect(useMapStore.getState().activeLayers.transit).toBe(false);
  });

  it('enables a disabled layer', () => {
    useMapStore.setState({ activeLayers: { ...ALL_LAYERS_ON, roads: false } });
    useMapStore.getState().toggleLayer('roads');
    expect(useMapStore.getState().activeLayers.roads).toBe(true);
  });

  it('does not affect other layers', () => {
    useMapStore.getState().toggleLayer('accidents');
    expect(useMapStore.getState().activeLayers.transit).toBe(true);
    expect(useMapStore.getState().activeLayers.roads).toBe(true);
  });
});

describe('mapStore — setLayer', () => {
  it('sets a layer to false explicitly', () => {
    useMapStore.getState().setLayer('infrastructure', false);
    expect(useMapStore.getState().activeLayers.infrastructure).toBe(false);
  });

  it('sets a layer to true explicitly', () => {
    useMapStore.setState({ activeLayers: { ...ALL_LAYERS_ON, traffic: false } });
    useMapStore.getState().setLayer('traffic', true);
    expect(useMapStore.getState().activeLayers.traffic).toBe(true);
  });
});

describe('mapStore — setActiveDomain', () => {
  it('sets domain to transit and enables only transit layer', () => {
    useMapStore.getState().setActiveDomain('transit');
    const s = useMapStore.getState();
    expect(s.activeDomain).toBe('transit');
    expect(s.activeLayers.transit).toBe(true);
    expect(s.activeLayers.accidents).toBe(false);
    expect(s.activeLayers.roads).toBe(false);
  });

  it('sets domain to all and enables all layers', () => {
    useMapStore.setState({ activeDomain: 'transit', activeLayers: { ...ALL_LAYERS_ON, roads: false } });
    useMapStore.getState().setActiveDomain('all');
    const layers = useMapStore.getState().activeLayers;
    expect(Object.values(layers).every(Boolean)).toBe(true);
  });

  it('sets domain to accidents and enables only accidents layer', () => {
    useMapStore.getState().setActiveDomain('accidents');
    const l = useMapStore.getState().activeLayers;
    expect(l.accidents).toBe(true);
    expect(l.transit).toBe(false);
    expect(l.traffic).toBe(false);
  });
});

describe('mapStore — requestMapFocus', () => {
  it('creates a focusRequest with lat/lng', () => {
    useMapStore.getState().requestMapFocus(32.08, 34.78);
    const s = useMapStore.getState();
    expect(s.focusRequest).not.toBeNull();
    expect(s.focusRequest?.lat).toBe(32.08);
    expect(s.focusRequest?.lng).toBe(34.78);
  });

  it('includes zoom when provided', () => {
    useMapStore.getState().requestMapFocus(32.08, 34.78, 14);
    expect(useMapStore.getState().focusRequest?.zoom).toBe(14);
  });

  it('includes bbox when provided', () => {
    const bbox: [number, number, number, number] = [34.7, 31.9, 34.9, 32.1];
    useMapStore.getState().requestMapFocus(32.0, 34.8, undefined, bbox);
    expect(useMapStore.getState().focusRequest?.bbox).toEqual(bbox);
  });

  it('updates lastGeocodeCamera', () => {
    useMapStore.getState().requestMapFocus(31.5, 34.9, 16);
    const cam = useMapStore.getState().lastGeocodeCamera;
    expect(cam?.lat).toBe(31.5);
    expect(cam?.lng).toBe(34.9);
    expect(cam?.zoom).toBe(16);
  });

  it('seq increments on each call', () => {
    useMapStore.getState().requestMapFocus(32.0, 34.8);
    const seq1 = useMapStore.getState().focusRequest?.seq ?? 0;
    useMapStore.getState().requestMapFocus(32.1, 34.9);
    const seq2 = useMapStore.getState().focusRequest?.seq ?? 0;
    expect(seq2).toBeGreaterThanOrEqual(seq1);
  });
});

describe('mapStore — clearMapFocusRequest', () => {
  it('clears the focus request', () => {
    useMapStore.getState().requestMapFocus(32.0, 34.8);
    useMapStore.getState().clearMapFocusRequest();
    expect(useMapStore.getState().focusRequest).toBeNull();
  });
});

describe('mapStore — focusAnalysisFeature', () => {
  it('sets the focus feature', () => {
    useMapStore.getState().setFocusAnalysisFeature({ layerKey: 'accidents', featureIndex: 2 });
    expect(useMapStore.getState().focusAnalysisFeature).toEqual({
      layerKey: 'accidents',
      featureIndex: 2,
    });
  });

  it('clears the focus feature', () => {
    useMapStore.getState().setFocusAnalysisFeature({ layerKey: 'transit', featureIndex: 0 });
    useMapStore.getState().clearFocusAnalysisFeature();
    expect(useMapStore.getState().focusAnalysisFeature).toBeNull();
  });
});

describe('mapStore — setMapType', () => {
  it('changes map type to dark', () => {
    useMapStore.getState().setMapType('dark');
    expect(useMapStore.getState().mapType).toBe('dark');
  });

  it('persists map type to localStorage', () => {
    useMapStore.getState().setMapType('osm');
    expect(localStorage.getItem('mahod:map-type')).toBe('osm');
  });
});
