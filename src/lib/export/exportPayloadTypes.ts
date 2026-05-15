/**
 * Payload sent to the `export-reports` Edge Function for CSV/HTML summary export.
 * Built on the client from `AnalysisResults` + upload metadata.
 */
export interface ExportAnalysisPayload {
  metadata: {
    polygonName?: string;
    polygonAreaKm2: number;
    analyzedAt: string;
    dataVersions?: {
      gtfs?: string;
      accidents?: string;
      roads?: string;
    };
  };
  publicTransport: {
    stopsCount: number;
    /** Sum of per-stop route counts (not unique routes across the area). */
    routesServingSum: number;
    agenciesCount: number;
  };
  accidents: {
    total: number;
    bySeverity: {
      fatal: number;
      severe: number;
      light: number;
    };
    byYear: Record<string, number>;
  };
  roads: {
    totalLengthMeters: number;
    segmentsCount: number;
    byAuthority: Record<string, number>;
  };
}

export type ExportFormat = 'geojson' | 'csv' | 'html';

export interface ExportRequestBody {
  format: ExportFormat;
  polygon: unknown;
  layers: {
    publicTransport: boolean;
    accidents: boolean;
    roads: boolean;
  };
  analysis?: ExportAnalysisPayload;
}
