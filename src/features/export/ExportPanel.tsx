import { FileText, FileSpreadsheet, Map as MapIcon, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { useUIStore } from '@/stores/uiStore';
import { useExportTrigger } from './hooks/useExportTrigger';

export type ExportFormat = 'pdf' | 'excel' | 'geojson' | 'shp';

interface ExportEntry {
  id: ExportFormat;
  icon: LucideIcon;
  label: string;
}

const EXPORT_ENTRIES: ExportEntry[] = [
  { id: 'pdf', icon: FileText, label: 'PDF' },
  { id: 'excel', icon: FileSpreadsheet, label: 'Excel' },
  { id: 'geojson', icon: MapIcon, label: 'GeoJSON' },
  { id: 'shp', icon: Layers, label: 'Shapefile' },
];

/**
 * Right-rail export card. Real export pipelines (PDF render, Excel, GeoJSON /
 * Shapefile bundling) will be added on top of the upcoming Supabase view.
 */
export function ExportPanel(): JSX.Element {
  const triggerExport = useExportTrigger();
  const showToast = useUIStore((s) => s.showToast);

  return (
    <Card>
      <CardHeader>
        <CardTitle>ייצוא</CardTitle>
      </CardHeader>
      <div className="grid grid-cols-2 gap-2">
        {EXPORT_ENTRIES.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                triggerExport(entry.id);
                showToast(`מייצא ${entry.label}...`);
              }}
              className="flex items-center gap-2 rounded-lg border border-border bg-bg-2 px-2.5 py-2.5 text-[12.5px] text-text-dim transition-all hover:border-brand-teal hover:bg-brand-teal/10 hover:text-brand-teal hover:shadow-[0_0_0_1px_rgba(76,175,80,0.32)]"
            >
              <Icon size={15} className="shrink-0" />
              {entry.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
