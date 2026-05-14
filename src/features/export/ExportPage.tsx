import { ExportPanel } from './ExportPanel';

export function ExportPage(): JSX.Element {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-start gap-4 p-3.5">
      <h1 className="text-lg font-semibold text-text">ייצוא דוחות</h1>
      <p className="max-w-2xl text-sm text-text-dim">
        בחר פורמט לייצוא של תוצאות הניתוח הנוכחיות. צינור הייצוא יחובר לאחר שכבת ה-Supabase
        — בינתיים הכפתורים מציגים אישור בלבד.
      </p>
      <div className="w-full max-w-md">
        <ExportPanel />
      </div>
    </div>
  );
}
