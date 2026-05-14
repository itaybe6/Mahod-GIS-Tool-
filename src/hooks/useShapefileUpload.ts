import { useCallback } from 'react';
import type { FeatureCollection } from 'geojson';
import {
  parseShapefileFromFiles,
  ShapefileParseError,
} from '@/lib/gis/shapefile';
import { useUploadStore, type MunicipalityHit } from '@/stores/uploadStore';
import { useUIStore } from '@/stores/uiStore';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';

/**
 * Fire-and-forget lookup: as soon as a polygon is ready, ask Supabase which
 * Israeli municipalities it overlaps with. Errors are surfaced into the store
 * but never block the upload UX — the polygon is still rendered on the map.
 */
async function lookupMunicipalities(polygon: FeatureCollection): Promise<void> {
  const {
    setMunicipalitiesLoading,
    setMunicipalities,
    setMunicipalitiesError,
  } = useUploadStore.getState();

  if (!isSupabaseConfigured) {
    setMunicipalitiesError('Supabase לא מוגדר');
    return;
  }

  setMunicipalitiesLoading();

  const { data, error } = await supabase.rpc('find_municipalities_for_polygon', {
    polygon_geojson: JSON.stringify(polygon),
  });

  if (error) {
    setMunicipalitiesError(error.message || 'שגיאה בשליפת רשויות מסופהבייס');
    return;
  }

  const hits = (data?.municipalities ?? []) as MunicipalityHit[];
  setMunicipalities(hits);
}

/**
 * Shared upload pipeline used by the dropzone, the quick-pick buttons, and any
 * future entry point. Centralises the store mutations + toast feedback so the
 * call sites stay tiny.
 */
export function useShapefileUpload(): {
  ingestFiles: (files: FileList | File[]) => Promise<void>;
  isParsing: boolean;
} {
  const setParsing = useUploadStore((s) => s.setParsing);
  const setPolygon = useUploadStore((s) => s.setPolygon);
  const setError = useUploadStore((s) => s.setError);
  const status = useUploadStore((s) => s.status);
  const showToast = useUIStore((s) => s.showToast);

  const ingestFiles = useCallback(
    async (input: FileList | File[]): Promise<void> => {
      const files = Array.from(input);
      if (files.length === 0) return;

      const previewName = files[0]!.name;
      setParsing(previewName);
      showToast('מעבד את הקובץ...');

      try {
        const result = await parseShapefileFromFiles(files);
        setPolygon({
          polygon: result.geojson,
          bbox: result.bbox,
          sourceName: result.sourceName,
          featureCount: result.featureCount,
          reprojectedFrom: result.reprojectedFrom,
        });
        const reprojNote = result.reprojectedFrom
          ? ` · המרה אוטומטית מ-${result.reprojectedFrom}`
          : '';
        showToast(
          `נטען בהצלחה: ${result.sourceName} (${result.featureCount} פיצ'ר${
            result.featureCount === 1 ? '' : "ים"
          })${reprojNote}`,
          result.reprojectedFrom ? 4000 : 2200
        );

        // Don't await — we don't want to delay the dropzone returning to idle.
        void lookupMunicipalities(result.geojson);
      } catch (err) {
        const message =
          err instanceof ShapefileParseError
            ? err.message
            : `שגיאה לא צפויה: ${(err as Error).message}`;
        setError(message);
        showToast(message, 4500);
      }
    },
    [setError, setParsing, setPolygon, showToast]
  );

  return { ingestFiles, isParsing: status === 'parsing' };
}
