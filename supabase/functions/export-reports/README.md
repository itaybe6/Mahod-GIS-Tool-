# `export-reports` Edge Function

ייצוא **GeoJSON** (מיזוג שכבות מה-RPC הקיימים), **CSV** (טבלה UTF-8 עם BOM) ו-**HTML** (דוח RTL בעברית).

## פריסה

```bash
supabase functions deploy export-reports --project-ref <project-id>
```

## קריאה

`POST /functions/v1/export-reports` עם גוף JSON:

```jsonc
{
  "format": "geojson", // או "csv" | "html"
  "polygon": { "type": "FeatureCollection", ... }, // נדרש ל-geojson
  "layers": {
    "publicTransport": true,
    "accidents": true,
    "roads": false
  }, // נדרש ל-geojson (לפחות שכבה אחת = true)
  "analysis": { ... } // נדרש ל-csv ול-html — אותו מבנה כמו `ExportAnalysisPayload` בקליינט
}
```

כותרות: `Authorization: Bearer <anon JWT>` ו-`apikey` כמו ב-`analyze-area`.

## הערות

- **GeoJSON:** דורש `polygon` + `layers` + הגדרות Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). כל פיצ'ר מקבל `properties.layer` = `gtfs_stop` | `accident` | `road`. אם חלק מהשכבות נכשלו, הצלחות חלקיות מוחזרות והכותרת `X-Export-Warnings` תכיל את השגיאות.
- **CSV:** דורש רק `analysis`. הקובץ כולל BOM כדי שאקסל יזהה UTF-8 נכון.
- **HTML:** דורש רק `analysis`. דוח RTL מלא; נטען כקובץ מצורף או נפתח בדפדפן.
