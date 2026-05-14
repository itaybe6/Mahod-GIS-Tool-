/** Payload for HTML/PDF (matches client `ExportAnalysisPayload`). */
export interface ReportData {
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
    routesServingSum: number;
    agenciesCount: number;
  };
  accidents: {
    total: number;
    bySeverity: { fatal: number; severe: number; light: number };
    byYear: Record<string, number>;
  };
  roads: {
    totalLengthMeters: number;
    segmentsCount: number;
    byAuthority: Record<string, number>;
  };
}
