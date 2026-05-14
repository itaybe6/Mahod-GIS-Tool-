import { Card, CardHeader, CardTitle } from '@/components/ui/card';

interface DataSourceEntry {
  name: string;
  description: string;
  status: 'planned' | 'scoped' | 'wip';
}

const SOURCES: DataSourceEntry[] = [
  {
    name: 'GTFS — תחבורה ציבורית',
    description: 'israel-public-transportation.zip (משרד התחבורה / רכבות ישראל / NTA).',
    status: 'scoped',
  },
  {
    name: 'LMS — תאונות דרכים',
    description: 'data.gov.il — מערכת ניהול תאונות. ייובא כ-CSV ויותאם לסכימה ייעודית.',
    status: 'scoped',
  },
  {
    name: 'נתיבי ישראל — כבישים',
    description: 'גיאומטריה של רשת הכבישים, סיווג והיררכיה, נקודות ק״מ.',
    status: 'planned',
  },
  {
    name: 'תשתיות — שכבה רביעית (חדשה)',
    description: 'גשרים, מנהרות, תחמ״שים, תחנות רכבת, מחסנים תפעוליים.',
    status: 'planned',
  },
];

const STATUS_LABEL: Record<DataSourceEntry['status'], { label: string; cls: string }> = {
  planned: { label: 'בתכנון', cls: 'text-text-faint border-border bg-bg-1' },
  scoped: { label: 'מוגדר', cls: 'text-warning border-warning/30 bg-warning/10' },
  wip: { label: 'בפיתוח', cls: 'text-brand-teal border-brand-teal/30 bg-brand-teal/10' },
};

export function SourcesPage(): JSX.Element {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 p-3.5">
      <h1 className="text-lg font-semibold text-text">מקורות מידע</h1>
      <p className="max-w-3xl text-sm text-text-dim">
        ארבע שכבות הנתונים שיוטמעו במערכת. הסכימה ב-Supabase תיגזר מהם אחרי שלב הסקירה.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {SOURCES.map((s) => (
          <Card key={s.name}>
            <CardHeader>
              <CardTitle>{s.name}</CardTitle>
              <span
                className={`rounded-full border px-2 py-0.5 font-mono text-[10.5px] ${STATUS_LABEL[s.status].cls}`}
              >
                {STATUS_LABEL[s.status].label}
              </span>
            </CardHeader>
            <p className="text-sm leading-relaxed text-text-dim">{s.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
