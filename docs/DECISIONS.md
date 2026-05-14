# Decisions

## Compress GTFS Shapes To LineStrings

`shapes.txt` in the Israel MOT GTFS feed contains about 7.1M point rows. Supabase does not need each raw point as a separate record for map rendering and route geometry queries, so we store each `shape_id` as one `GEOMETRY(LineString, 4326)` row in `gtfs_shapes`.

This reduces the table from millions of rows to roughly 50K rows and cuts storage from the raw 224MB CSV scale to about 30MB of route geometry, while preserving the ordered path of each shape.

The trade-off is that per-point attributes are no longer queryable as first-class rows. GTFS shapes do not carry timing data, but if future feeds include point-level metadata we will need either a side table or a separate raw archive.

## Client-Side Shapefile Parsing

העלאת ZIP של Shapefile (לדוגמה `sample_data/test.zip`) מפורסרת לחלוטין בדפדפן באמצעות `shpjs`, שמטפל בחילוץ ה-ZIP, בקריאת `.shp/.shx/.dbf/.prj/.cpg`, ובהמרת קואורדינטות ל-WGS84 דרך `proj4`. הפלט הוא `FeatureCollection` יחיד שמשותף בין Leaflet (`<GeoJSON>`) לבין Mapbox GL (`addSource`/`addLayer` של `fill` + `line`).

הבחירה לא לעבור דרך שרת (כמו ב-`api.py` המקורי של המשימה) נובעת משלוש סיבות: לפרויקט יש רק Supabase, אין endpoint משלנו לחילוץ קבצים זמניים; הקובץ ההדגמתי קטן (פחות מקילובייט), כך שעיבוד בלקוח הוא מיידי וללא round-trip; וכן זה משאיר את ה-GeoJSON בזיכרון של הסשן בלבד — אין צורך לאחסן או למחוק קבצים זמניים. אם בעתיד נתמוך בקבצים גדולים מאוד (למשל גבולות מוניציפליים של 80MB), נוכל להחליף את `parseShapefileFromFiles` ב-Edge Function ב-Supabase שמחזירה את אותה צורת `ParsedShapefile`, בלי לשנות את שכבות התצוגה.

ה-state של ההעלאה יושב ב-`useUploadStore` (status / polygon / bbox / sourceName / reprojectedFrom / error), ו-`UploadedPolygonLayer` (Leaflet) ו-`Mapbox3DView` שניהם מאזינים לאותו store ועושים `fitBounds` על ה-bbox שחושב מ-`bboxOfFeatureCollection`.

הרבה Shapefiles ישראליים (כולל `sample_data/test.zip` של המשימה) מגיעים בלי `.prj`, כך שה-coordinates נשארים במטרים של ITM (EPSG:2039) או ICS הישן (EPSG:28191). בלי טיפול ייעודי הם נראים כמו "פוליגון לא ב-WGS84" ונדחים. `src/lib/gis/projections.ts` מזהה אוטומטית את הגריד מטווח ה-bbox (WGS84 הוא בטווח של מעלות, ITM/ICS בטווח של מאות אלפי מטרים — אין חפיפה) ומפעיל reprojection מקומי דרך `proj4`. אם הזיהוי נכשל, מוצגת שגיאה ברורה למשתמש שמסבירה לצרף `.prj` או להמיר ל-WGS84 לפני ההעלאה. ה-CRS שזוהה נשמר ב-`reprojectedFrom` ומוצג בכרטיס הסטטוס כדי שהמשתמש יראה שהתבצעה המרה אוטומטית.

## Area Analysis — שני שלבים: פרסור קליינט + spatial queries בשרת

מערכת הניתוח הספציאלי בנויה משני שלבים מבודדים שכל אחד אחראי על הדבר שהוא טוב בו:

1. **פרסור הפוליגון בקליינט** (`src/lib/gis/shapefile.ts`) — קבלת `.zip` / `.geojson` / `.shp`+`.dbf` ישירות בדפדפן. shpjs + proj4 + auto-detection של ITM/ICS, ללא round-trip לשרת. זה מאפשר תגובה מיידית, פוליגון תצוגה על המפה לפני שמתחייבים לקריאת DB, וזמן השהיה אפס בזיהוי שגיאות (קובץ פגום, CRS לא מזוהה, אין `.dbf`).

2. **Spatial queries ב-Supabase Edge Function** (`supabase/functions/analyze-area`) שמפעילה ארבע פונקציות PostGIS — `query_gtfs_in_polygon`, `query_accidents_in_polygon`, `query_roads_in_polygon`, `query_infra_in_polygon` — ב-`Promise.allSettled` מקבילי. כך שכבה אחת שנכשלת (למשל `infra_metro_lines` ריקה) לא מפילה את כל התשובה — דרישת המשימה לתמיכה ב"תוצאות חלקיות".

הבחירה לפצל בין קליינט לשרת מתבססת על שתי הבחנות: ראשית, פרסור Shapefile/GeoJSON בדפדפן זול ומובן (`shpjs` הוא 13KB), בעוד שספציפית-Deno של Edge Functions עושה את זה כאב ראש (binary buffers, מודולי npm). שנית, `analyze-area` יושב פיזית ליד ה-DB; spatial queries כבדים (`ST_Intersection` עם 4K כבישים) רצים שם בלי לשלוח 50MB של GeoJSON ברשת, ומחזירים רק את התוצאה הקלפ. ה-Pattern הזה מאפשר גם להפוך בעתיד את ה-Edge Function ל-View מטריאליזציה אם נרצה caching.

ה-state של הניתוח יושב ב-`useAnalysisStore` (selection, results, durationMs, error), ו-`AnalysisResultsLayer` מצייר את כל ארבעת ה-FeatureCollections על Leaflet עם פליטה צבעונית לפי שכבה. ה-`LayerToggle` הקיים שולט ב-visibility של כל שכבה — בלי צורך להריץ ניתוח מחדש.

## תצוגת 3D עם Mapbox

Leaflet, שמשמש כמנוע המפה הראשי (DARK / OSM / SAT / TOPO), לא תומך בתצוגה תלת־ממדית אמיתית — אין הטיה, סיבוב או מבני 3D. לכן הכפתור "3D" בבורר סוגי המפה לא טוען עוד `TileLayer`, אלא מציג מפה נפרדת מבוססת Mapbox GL JS (סטייל `mapbox/standard`) עם pitch ובניינים בגובה.

הבחירה היא לשמור על Leaflet כברירת מחדל, וב־3D בלבד לטעון את Mapbox עם אותם נתוני GeoJSON (תאונות, תחנות, מסלולים, כבישים, תשתית). הטוקן נטען מ־`VITE_MAPBOX_ACCESS_TOKEN`, ואם הוא חסר מוצג fallback במקום מפה שבורה.

## ספירות תנועה — העלאה מ־2025 בלבד

הוחלט להעלות ל-Supabase רק נתוני ספירות תנועה משנת **2025**, ולא את כל ההיסטוריה הזמינה במקור. הסיבה העיקרית היא **מגבלות נפח דאטה ואחסון** בפרויקט Supabase: קובץ המקור של Vol4 כולל מיליוני רשומות נפח ב-`traffic_count_volumes`, והעלאה מלאה שלו מנפחת את בסיס הנתונים מהר מאוד ומקרבת את הפרויקט למכסות האחסון/שורות של הסביבה.

היישום בפועל נמצא ב-`scripts/seed/seed-traffic-counts.ts`: הסקריפט מסנן את `traffic_counts` לפי `VOLUME_SURVEY_YEAR = 2025`, ואז מעלה ל-`traffic_count_volumes` רק רשומות שה-`count_id` שלהן שייך לספירות של 2025. בנוסף קיימת תקרה קשיחה של `MAX_VOLUME_ROWS = 40_000`, כדי למנוע טעינה חוזרת של מיליוני רשומות בטעות.

המשמעות למשתמשי המערכת: ניתוחים והשוואות של ספירות תנועה לפני 2025 לא יופיעו בנתונים שמגיעים מהמסד, עד שיוגדל משאב האחסון/השורות או שתיבחר אסטרטגיה אחרת כמו ארכיון חיצוני, טעינה לפי אזור, או טעינה לפי בקשה.
