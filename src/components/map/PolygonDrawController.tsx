import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Feature, FeatureCollection, Polygon as GeoJSONPolygon } from 'geojson';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { useUploadStore } from '@/stores/uploadStore';
import { useUIStore } from '@/stores/uiStore';
import { bboxOfFeatureCollection } from '@/lib/gis/shapefile';

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

const POLYGON_PATH_OPTIONS: L.PathOptions = {
  color: '#4cc9c0',
  weight: 2.5,
  opacity: 1,
  fillColor: '#4cc9c0',
  fillOpacity: 0.18,
};

/** Geoman's draw / edit options applied via setPathOptions on every layer.   */
const GEOMAN_DRAW_PATH_OPTIONS: L.PathOptions = {
  ...POLYGON_PATH_OPTIONS,
  dashArray: '6 4',
};

/** Source label set on the store when geoman commits the drawn shape. */
const DRAWN_SOURCE_LABEL = 'פוליגון מצויר';

/**
 * Geoman's instance methods sometimes reach into uninitialised internal state
 * (typically right after a fresh map mount, or while a layer that owned the
 * mode is mid-removal). Wrapping every call protects the React tree from
 * being torn down by errors that originate inside the plugin.
 */
function safeCall(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[PolygonDrawController] geoman call failed', err);
    }
  }
}

/** Boolean state-check wrapper — same intent as `safeCall`, returns `false`
 *  when the underlying getter throws so the caller can short-circuit. */
function safeBool(fn: () => boolean): boolean {
  try {
    return fn();
  } catch {
    return false;
  }
}

/**
 * Turn a freshly added Leaflet layer into a fully editable Geoman polygon.
 * `.pm` is attached lazily — once when the layer is added to the map and
 * Geoman's `Layer.onAdd` hook fires — so we have to guard against the case
 * where the property simply isn't there yet.
 */
function enableLayerEditing(layer: L.Polygon): void {
  const pm = (layer as L.Polygon & { pm?: { enable: (opts: object) => void } }).pm;
  if (!pm || typeof pm.enable !== 'function') return;
  safeCall(() =>
    pm.enable({
      allowSelfIntersection: false,
      snappable: true,
      draggable: true,
    })
  );
}

function disableLayerEditing(layer: L.Polygon): void {
  const pm = (layer as L.Polygon & { pm?: { disable: () => void } }).pm;
  if (!pm || typeof pm.disable !== 'function') return;
  safeCall(() => pm.disable());
}

/* -------------------------------------------------------------------------- */
/*                              Helper utilities                              */
/* -------------------------------------------------------------------------- */

/**
 * Geoman exposes a `toGeoJSON()` on every editable Leaflet layer. We rely on
 * polygons only (Rectangle is just a special-case Polygon under the hood) so
 * we always end up with a `Feature<Polygon>` we can stash in the store.
 */
function leafletPolygonToFeature(layer: L.Polygon): Feature<GeoJSONPolygon> | null {
  const raw = layer.toGeoJSON() as Feature;
  if (!raw || !raw.geometry) return null;
  if (raw.geometry.type !== 'Polygon') return null;
  return raw as Feature<GeoJSONPolygon>;
}

function featureToCollection(feature: Feature<GeoJSONPolygon>): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: feature.geometry,
        properties: { name: DRAWN_SOURCE_LABEL, source: 'draw' },
      },
    ],
  };
}

/**
 * Pull the *first* Polygon feature out of whatever the user uploaded /
 * previously drew. Geoman only edits a single shape — multi-feature uploads
 * still render via `UploadedPolygonLayer`, but cannot be edited inline.
 */
function firstPolygonFeature(fc: FeatureCollection | null): Feature<GeoJSONPolygon> | null {
  if (!fc) return null;
  for (const feature of fc.features) {
    if (feature.geometry?.type === 'Polygon') {
      return feature as Feature<GeoJSONPolygon>;
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*                                 Component                                  */
/* -------------------------------------------------------------------------- */

/**
 * Mounts Leaflet-Geoman on the active Leaflet map and wires its draw/edit
 * lifecycle to `useUploadStore`. Must be a child of `<MapContainer>` so that
 * `useMap()` resolves to the active Leaflet instance.
 *
 * Behavior:
 *   - When `inputMode === 'draw'` and the store is empty → enables polygon
 *     draw mode (click to add vertex, click first vertex / press Enter to
 *     finish).
 *   - When a drawn polygon exists → enables edit mode (drag vertices, drag
 *     the whole polygon, scale via the corner handles). Every edit pushes the
 *     latest geometry back to the store, which fans out to the analysis
 *     pipeline + the bottom KPIs without an explicit "save" step.
 *   - When `inputMode === 'upload'` → tears down all Geoman handlers so the
 *     map behaves exactly like before this controller existed.
 */
export function PolygonDrawController(): null {
  const map = useMap();
  const inputMode = useUploadStore((s) => s.inputMode);
  const polygon = useUploadStore((s) => s.polygon);
  const status = useUploadStore((s) => s.status);
  const showToast = useUIStore((s) => s.showToast);

  /** The single editable polygon layer geoman is currently controlling. */
  const editableLayerRef = useRef<L.Polygon | null>(null);
  /** Tracks the GeoJSON we last *pushed* to the store so we don't re-import it. */
  const lastSyncedRef = useRef<string | null>(null);

  /* ----------------------------- one-shot setup ----------------------------- */
  useEffect(() => {
    if (!map.pm) return;
    // Geoman ships with ~25 locales but no Hebrew — register the strings the
    // user actually sees during a draw. Anything we miss falls back to `en`.
    safeCall(() =>
      map.pm.setLang(
        'en',
        {
          tooltips: {
            firstVertex: 'לחץ להתחלת הציור',
            continueLine: 'לחץ להוספת נקודה',
            finishPoly: 'לחץ על הנקודה הראשונה לסיום',
          },
          actions: {
            finish: 'סיים',
            cancel: 'ביטול',
            removeLastVertex: 'הסר נקודה אחרונה',
          },
        },
        'en'
      )
    );
    safeCall(() =>
      map.pm.setGlobalOptions({
        pathOptions: GEOMAN_DRAW_PATH_OPTIONS,
        snappable: true,
        snapDistance: 18,
        finishOn: 'dblclick',
        allowSelfIntersection: false,
        preventMarkerRemoval: false,
        removeLayerBelowMinVertexCount: false,
      })
    );
    return () => {
      if (safeBool(() => map.pm.globalDrawModeEnabled())) {
        safeCall(() => map.pm.disableDraw());
      }
      if (safeBool(() => map.pm.globalEditModeEnabled())) {
        safeCall(() => map.pm.disableGlobalEditMode());
      }
      if (safeBool(() => map.pm.globalDragModeEnabled())) {
        safeCall(() => map.pm.disableGlobalDragMode());
      }
    };
  }, [map]);

  /* ------------------------ commit helper (closure-captured) ---------------- */
  const commitLayer = useRef<((layer: L.Polygon, source: 'draw' | 'edit') => void) | null>(
    null
  );
  commitLayer.current = (layer: L.Polygon, source: 'draw' | 'edit') => {
    const feature = leafletPolygonToFeature(layer);
    if (!feature) return;
    const fc = featureToCollection(feature);
    const bbox = bboxOfFeatureCollection(fc);
    if (!bbox) return;
    lastSyncedRef.current = JSON.stringify(feature.geometry);
    useUploadStore.getState().setPolygon({
      polygon: fc,
      bbox,
      sourceName: DRAWN_SOURCE_LABEL,
      featureCount: 1,
      reprojectedFrom: null,
    });
    if (source === 'draw') {
      showToast('הפוליגון צויר — אפשר לגרור או למתוח אותו');
    }
  };

  /* -------------------- adopt the drawn / uploaded polygon ------------------ */
  // Whenever the store receives a polygon we don't already own (e.g. via the
  // dropzone), we mirror it into a draggable L.Polygon so the user can switch
  // to "draw" mode and keep editing what they uploaded.
  useEffect(() => {
    if (!map.pm) return;

    if (!polygon) {
      removeEditableLayer();
      return;
    }

    const geometry = firstPolygonFeature(polygon)?.geometry ?? null;
    if (!geometry) {
      // Multi-polygon / lines / points: leave them to UploadedPolygonLayer.
      removeEditableLayer();
      return;
    }

    const serialized = JSON.stringify(geometry);
    if (lastSyncedRef.current === serialized && editableLayerRef.current) {
      // Geoman just pushed this exact geometry to the store — nothing to do.
      return;
    }

    removeEditableLayer();
    const latLngs = geometry.coordinates[0]?.map(
      ([lng, lat]) => L.latLng(lat as number, lng as number)
    );
    if (!latLngs || latLngs.length < 3) return;

    const created = L.polygon(latLngs, POLYGON_PATH_OPTIONS).addTo(map);
    editableLayerRef.current = created;
    lastSyncedRef.current = serialized;

    created.on('pm:edit', () => commitLayer.current?.(created, 'edit'));
    created.on('pm:dragend', () => commitLayer.current?.(created, 'edit'));
    created.on('pm:rotateend', () => commitLayer.current?.(created, 'edit'));
    created.on('pm:markerdragend', () => commitLayer.current?.(created, 'edit'));

    refreshEditAffordances();

    return () => {
      // Only the next polygon update or unmount removes the layer.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polygon, map]);

  /* ----------------------- mode-driven draw / edit toggling ----------------- */
  useEffect(() => {
    if (!map.pm) return;

    const setDrawingPhase = useUploadStore.getState().setDrawingPhase;

    // Always start clean — geoman's mode flags are sticky across re-renders.
    // Each call is individually guarded *and* state-checked because the
    // global disable* methods iterate every layer on the map; tile layers,
    // markers and our own results layer don't carry a `.pm` property and
    // make Geoman's iteration throw `reading 'pm'` when the mode wasn't
    // enabled to begin with.
    if (safeBool(() => map.pm.globalDrawModeEnabled())) {
      safeCall(() => map.pm.disableDraw());
    }
    if (safeBool(() => map.pm.globalEditModeEnabled())) {
      safeCall(() => map.pm.disableGlobalEditMode());
    }
    if (safeBool(() => map.pm.globalDragModeEnabled())) {
      safeCall(() => map.pm.disableGlobalDragMode());
    }

    if (inputMode !== 'draw') {
      setDrawingPhase('idle');
      refreshEditAffordances();
      return;
    }

    if (status === 'parsing') {
      setDrawingPhase('idle');
      return;
    }

    if (editableLayerRef.current) {
      // We already have a polygon — enable per-layer edits + drag.
      setDrawingPhase('editing');
      enableLayerEditing(editableLayerRef.current);
      return;
    }

    setDrawingPhase('drawing');
    safeCall(() =>
      map.pm.enableDraw('Polygon', {
        snappable: true,
        finishOn: 'dblclick',
        pathOptions: GEOMAN_DRAW_PATH_OPTIONS,
        templineStyle: { color: '#4cc9c0', dashArray: '4 4' },
        hintlineStyle: { color: '#4cc9c0', dashArray: '4 4', opacity: 0.6 },
      })
    );

    return () => {
      if (safeBool(() => map.pm.globalDrawModeEnabled())) {
        safeCall(() => map.pm.disableDraw());
      }
    };
  }, [inputMode, status, map, polygon]);

  /* -------------------- map-level draw lifecycle (one wiring) --------------- */
  useEffect(() => {
    if (!map.pm) return;

    const handleCreate = (event: { layer: L.Layer; shape?: string }): void => {
      const layer = event.layer;
      if (!(layer instanceof L.Polygon)) return;

      // Geoman renders the freshly drawn shape on its own — adopt it so we
      // can re-enable edit mode without rebuilding the layer.
      removeEditableLayer();
      editableLayerRef.current = layer;
      safeCall(() => layer.setStyle(POLYGON_PATH_OPTIONS));
      layer.on('pm:edit', () => commitLayer.current?.(layer, 'edit'));
      layer.on('pm:dragend', () => commitLayer.current?.(layer, 'edit'));
      layer.on('pm:rotateend', () => commitLayer.current?.(layer, 'edit'));
      layer.on('pm:markerdragend', () => commitLayer.current?.(layer, 'edit'));

      commitLayer.current?.(layer, 'draw');

      // After draw closes, immediately switch to edit mode so the user can
      // start tweaking without a second click.
      safeCall(() => map.pm.disableDraw());
      enableLayerEditing(layer);
      useUploadStore.getState().setDrawingPhase('editing');
    };

    const handleRemove = (event: { layer: L.Layer }): void => {
      if (event.layer === editableLayerRef.current) {
        editableLayerRef.current = null;
        lastSyncedRef.current = null;
        useUploadStore.getState().clear();
      }
    };

    map.on('pm:create', handleCreate);
    map.on('pm:remove', handleRemove);

    return () => {
      map.off('pm:create', handleCreate);
      map.off('pm:remove', handleRemove);
    };
    // `removeEditableLayer` is a closure over refs + `map` — already stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  /* -------------------------------- helpers --------------------------------- */
  function removeEditableLayer(): void {
    const layer = editableLayerRef.current;
    if (!layer) return;
    disableLayerEditing(layer);
    safeCall(() => layer.removeFrom(map));
    editableLayerRef.current = null;
    lastSyncedRef.current = null;
  }

  function refreshEditAffordances(): void {
    const layer = editableLayerRef.current;
    if (!layer) return;
    if (useUploadStore.getState().inputMode === 'draw') {
      enableLayerEditing(layer);
    } else {
      disableLayerEditing(layer);
    }
  }

  return null;
}
