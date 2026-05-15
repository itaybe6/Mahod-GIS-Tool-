# `export-reports` Edge Function

ייצוא **GeoJSON** (מיזוג שכבות מה-RPC הקיימים), **CSV** (טבלה UTF-8 עם BOM), **HTML** (דוח RTL בעברית), ו-**PDF** (`pdf-lib` + גופן Noto Sans Hebrew — ללא Puppeteer).

## פריסה

```bash
supabase functions deploy export-reports --project-ref <project-id>
```

## קריאה

`POST /functions/v1/export-reports` עם גוף JSON:

```jsonc
{
  "format": "geojson", // או "csv" | "html" | "pdf"
  "polygon": { "type": "FeatureCollection", ... },
  "layers": {
    "publicTransport": true,
    "accidents": true,
    "roads": false
  },
  "analysis": { ... } // נדרש ל-csv, html ו-pdf — אותו מבנה כמו `ExportAnalysisPayload` בקליינט
}
```

כותרות: `Authorization: Bearer <anon JWT>` ו-`apikey` כמו ב-`analyze-area`.

## הערות

- **GeoJSON:** כל פיצ'ר מקבל `properties.layer` = `gtfs_stop` | `accident` | `road`.
- **HTML:** דוח RTL מלא; נטען כקובץ מצורף או נפתח בדפדפן.
- **PDF:** דורש הורדת גופן מ-jsDelivr בזמן ריצה; אם הרשת חוסמת, תוחזר שגיאה 500 עם הודעה בעברית.
