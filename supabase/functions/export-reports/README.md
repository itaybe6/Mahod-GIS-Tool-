# `export-reports` Edge Function

ייצוא **GeoJSON** (מיזוג שכבות מה-RPC הקיימים), **דוח HTML** (תבנית RTL בעברית), ו-**PDF** (אותם נתונים דרך `pdf-lib` + גופן Noto Sans Hebrew — ללא Puppeteer, שאינו נתמך בסביבת Edge).

## פריסה

```bash
supabase functions deploy export-reports --project-ref <project-id>
```

## קריאה

`POST /functions/v1/export-reports` עם גוף JSON:

```jsonc
{
  "format": "geojson", // או "html" | "pdf"
  "polygon": { "type": "FeatureCollection", ... },
  "layers": {
    "publicTransport": true,
    "accidents": true,
    "roads": false
  },
  "analysis": { ... } // נדרש ל-html ול-pdf — אותו מבנה כמו `ExportAnalysisPayload` בקליינט
}
```

כותרות: `Authorization: Bearer <anon JWT>` ו-`apikey` כמו ב-`analyze-area`.

## הערות

- **GeoJSON:** כל פיצ'ר מקבל `properties.layer` = `gtfs_stop` | `accident` | `road`.
- **PDF:** דורש הורדת גופן מ-jsDelivr בזמן ריצה; אם הרשת חוסמת, תוחזר שגיאה 500 עם הודעה בעברית.
