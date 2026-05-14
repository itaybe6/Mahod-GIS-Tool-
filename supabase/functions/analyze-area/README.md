# `analyze-area` Edge Function

## תפקיד

מקבל פוליגון WGS84 (Polygon / MultiPolygon / Feature / FeatureCollection) ובחירת שכבות, מריץ במקביל את ארבעת ה-RPCs הספציאליים שמוגדרים ב-`supabase/migrations/20260514210000_create_polygon_query_functions.sql`, ומחזיר `{ results, errors?, durationMs }`.

## פריסה

```bash
# פעם ראשונה
supabase functions deploy analyze-area --project-ref <project-id>

# פיתוח מקומי
supabase functions serve analyze-area --env-file ./supabase/.env
```

`SUPABASE_URL` ו-`SUPABASE_SERVICE_ROLE_KEY` נטענים אוטומטית בסביבת הפונקציה ב-Supabase Cloud, אבל בפיתוח מקומי הם חייבים להיות ב-`./supabase/.env`.

## חוזה הקלט

```jsonc
POST /functions/v1/analyze-area
{
  "polygon": { "type": "Polygon", "coordinates": [...] },  // או FeatureCollection
  "layers": {
    "transit":        true,
    "accidents":      true,
    "roads":          false,
    "infrastructure": false
  }
}
```

## חוזה הפלט

```jsonc
{
  "durationMs": 124,
  "results": {
    "transit":   { "features": { ... }, "counts": { "count": 42 } },
    "accidents": { "features": { ... }, "counts": { "count": 13, "breakdown": { "fatal": 1, "severe": 4, "light": 8 } } }
  },
  "errors": {                    // קיים רק אם שכבה ספציפית נכשלה
    "infrastructure": "query_infra_in_polygon: ..."
  }
}
```

## הערות

- ה-CORS פתוח (`*`) כדי לאפשר קריאות מ-Vite dev server. לפרודקשן צמצמו ל-domain האפליקציה.
- כל קריאה ל-RPC מתבצעת עם service-role; לכן אין צורך ב-RLS על הטבלאות הסטטיסטיות.
- אם ל-DB אין `gtfs_stop_route` (למשל בסביבה ריקה), ה-LATERAL JOIN ב-`query_gtfs_in_polygon` עדיין יחזיר 0 לכל תחנה.
