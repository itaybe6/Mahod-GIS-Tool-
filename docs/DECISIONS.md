# Decisions

## Compress GTFS Shapes To LineStrings

`shapes.txt` in the Israel MOT GTFS feed contains about 7.1M point rows. Supabase does not need each raw point as a separate record for map rendering and route geometry queries, so we store each `shape_id` as one `GEOMETRY(LineString, 4326)` row in `gtfs_shapes`.

This reduces the table from millions of rows to roughly 50K rows and cuts storage from the raw 224MB CSV scale to about 30MB of route geometry, while preserving the ordered path of each shape.

The trade-off is that per-point attributes are no longer queryable as first-class rows. GTFS shapes do not carry timing data, but if future feeds include point-level metadata we will need either a side table or a separate raw archive.

## מיון מתקדם דינמי לפי טבלת GTFS פעילה

בעמוד `תחבורה ציבורית`, רכיב `SortControls` מקבל את ה-`TableConfig` של הכרטיס הפעיל (`חברות תחבורה`, `קווים`, `תחנות`, `לוחות שירות`, `נסיעות`, וכו׳) ומציג רק עמודות שמוגדרות באותה טבלה וניתנות למיון. כך, בחירה ב-`קווים` מציגה שדות כמו מס׳ קו, שם קו וסוג; בחירה ב-`תחנות` מציגה שדות תחנה וקואורדינטות; וכן הלאה.

בנוסף, לפני הרצת שאילתת Supabase ולפני ציור מצב המיון בטבלה, ה-state מסונן מול רשימת העמודות התקפה של הטבלה הפעילה. זה מונע מצב שבו מיון שנבחר בטבלה אחת ממשיך בטעות לטבלה אחרת עם שם עמודה שלא קיים בה.

## Client-Side Shapefile Parsing

העלאת ZIP של Shapefile (לדוגמה `sample_data/test.zip`) מפורסרת לחלוטין בדפדפן באמצעות `shpjs`, שמטפל בחילוץ ה-ZIP, בקריאת `.shp/.shx/.dbf/.prj/.cpg`, ובהמרת קואורדינטות ל-WGS84 דרך `proj4`. הפלט הוא `FeatureCollection` יחיד שמשותף בין Leaflet (`<GeoJSON>`) לבין Mapbox GL (`addSource`/`addLayer` של `fill` + `line`).

הבחירה לא לעבור דרך שרת (כמו ב-`api.py` המקורי של המשימה) נובעת משלוש סיבות: לפרויקט יש רק Supabase, אין endpoint משלנו לחילוץ קבצים זמניים; הקובץ ההדגמתי קטן (פחות מקילובייט), כך שעיבוד בלקוח הוא מיידי וללא round-trip; וכן זה משאיר את ה-GeoJSON בזיכרון של הסשן בלבד — אין צורך לאחסן או למחוק קבצים זמניים. אם בעתיד נתמוך בקבצים גדולים מאוד (למשל גבולות מוניציפליים של 80MB), נוכל להחליף את `parseShapefileFromFiles` ב-Edge Function ב-Supabase שמחזירה את אותה צורת `ParsedShapefile`, בלי לשנות את שכבות התצוגה.

ה-state של ההעלאה יושב ב-`useUploadStore` (status / polygon / bbox / sourceName / reprojectedFrom / error), ו-`UploadedPolygonLayer` (Leaflet) ו-`Mapbox3DView` שניהם מאזינים לאותו store ועושים `fitBounds` על ה-bbox שחושב מ-`bboxOfFeatureCollection`.

הרבה Shapefiles ישראליים (כולל `sample_data/test.zip` של המשימה) מגיעים בלי `.prj`, כך שה-coordinates נשארים במטרים של ITM (EPSG:2039) או ICS הישן (EPSG:28191). בלי טיפול ייעודי הם נראים כמו "פוליגון לא ב-WGS84" ונדחים. `src/lib/gis/projections.ts` מזהה אוטומטית את הגריד מטווח ה-bbox (WGS84 הוא בטווח של מעלות, ITM/ICS בטווח של מאות אלפי מטרים — אין חפיפה) ומפעיל reprojection מקומי דרך `proj4`. אם הזיהוי נכשל, מוצגת שגיאה ברורה למשתמש שמסבירה לצרף `.prj` או להמיר ל-WGS84 לפני ההעלאה. ה-CRS שזוהה נשמר ב-`reprojectedFrom` ומוצג בכרטיס הסטטוס כדי שהמשתמש יראה שהתבצעה המרה אוטומטית.

## שמירת קבצים למשתמש מחובר

העלאת קובץ נשארת Client-Side: `useShapefileUpload` מפרסר את הקובץ, מעדכן את `useUploadStore`, ובנוסף שומר ב-store גם `savedFile` שניתן להעלות ל־Supabase Storage. עבור קובץ יחיד אנחנו שומרים את הקובץ המקורי; עבור shapefile מפוצל אנחנו שומרים GeoJSON שנוצר מה־FeatureCollection המפוענח, כי `user_saved_files` מייצגת קובץ אחד והטעינה העתידית מ“קבצים אחרונים” צריכה להיות חד־משמעית.

הבחירה לא להוסיף כרגע עמודת `display_name` נועדה להישאר תואמים לסכמה הקיימת: השם שהמשתמש מזין נשמר בשדה `original_filename`, שהוא גם השדה שמוצג ב־`/recent-files`. ה־Storage path נפרד ומכיל מזהה רנדומלי תחת `{auth.uid()}/...`, כך שאין תלות בשם התצוגה לצורך ייחודיות או הרשאות.

RLS נשאר מקור האמת: `user_saved_files` מאפשר SELECT/INSERT/UPDATE/DELETE רק כאשר `auth.uid() = user_id`, ו־Storage bucket `user-uploads` מאפשר גישה רק לאובייקטים שהתיקייה הראשונה שלהם היא ה־`user_id`. לכן כפתור “שמור קובץ” מופיע רק כאשר יש `savedFile`, Supabase מוגדר, ו־`AuthSessionSync` מזהה session פעיל. אחרי העלאה מוצלחת ל־Storage נוצרת שורה בטבלה; אם הכנסת השורה נכשלת, האובייקט שהועלה נמחק כדי לא להשאיר orphan.

## Area Analysis — שני שלבים: פרסור קליינט + spatial queries בשרת

מערכת הניתוח הספציאלי בנויה משני שלבים מבודדים שכל אחד אחראי על הדבר שהוא טוב בו:

1. **פרסור הפוליגון בקליינט** (`src/lib/gis/shapefile.ts`) — קבלת `.zip` / `.geojson` / `.shp`+`.dbf` ישירות בדפדפן. shpjs + proj4 + auto-detection של ITM/ICS, ללא round-trip לשרת. זה מאפשר תגובה מיידית, פוליגון תצוגה על המפה לפני שמתחייבים לקריאת DB, וזמן השהיה אפס בזיהוי שגיאות (קובץ פגום, CRS לא מזוהה, אין `.dbf`).

2. **Spatial queries ב-Supabase Edge Function** (`supabase/functions/analyze-area`) שמפעילה ארבע פונקציות PostGIS — `query_gtfs_in_polygon`, `query_accidents_in_polygon`, `query_roads_in_polygon`, `query_infra_in_polygon` — ב-`Promise.allSettled` מקבילי. כך שכבה אחת שנכשלת (למשל `infra_metro_lines` ריקה) לא מפילה את כל התשובה — דרישת המשימה לתמיכה ב"תוצאות חלקיות".

הבחירה לפצל בין קליינט לשרת מתבססת על שתי הבחנות: ראשית, פרסור Shapefile/GeoJSON בדפדפן זול ומובן (`shpjs` הוא 13KB), בעוד שספציפית-Deno של Edge Functions עושה את זה כאב ראש (binary buffers, מודולי npm). שנית, `analyze-area` יושב פיזית ליד ה-DB; spatial queries כבדים (`ST_Intersection` עם 4K כבישים) רצים שם בלי לשלוח 50MB של GeoJSON ברשת, ומחזירים רק את התוצאה הקלפ. ה-Pattern הזה מאפשר גם להפוך בעתיד את ה-Edge Function ל-View מטריאליזציה אם נרצה caching.

ה-state של הניתוח יושב ב-`useAnalysisStore` (selection, results, durationMs, error), ו-`AnalysisResultsLayer` מצייר את כל ארבעת ה-FeatureCollections על Leaflet עם פליטה צבעונית לפי שכבה. ה-`LayerToggle` הקיים שולט ב-visibility של כל שכבה — בלי צורך להריץ ניתוח מחדש.

## תצוגת 3D עם Mapbox

Leaflet, שמשמש כמנוע המפה הראשי (DARK / OSM / SAT / TOPO), לא תומך בתצוגה תלת־ממדית אמיתית — אין הטיה, סיבוב או מבני 3D. לכן הכפתור "3D" בבורר סוגי המפה לא טוען עוד `TileLayer`, אלא מציג מפה נפרדת מבוססת Mapbox GL JS (סטייל `mapbox/standard`) עם pitch ובניינים בגובה.

הבחירה היא לשמור על Leaflet כברירת מחדל, וב־3D בלבד לטעון את Mapbox עם אותם נתוני GeoJSON (תאונות, תחנות, מסלולים, כבישים, תשתית). הטוקן נטען מ־`VITE_MAPBOX_ACCESS_TOKEN`, ואם הוא חסר מוצג fallback במקום מפה שבורה.

## תכנון מסלול A→B — למה זו הפיצ'ר הראשון שמומש מבין החמש?

מבין כיווני הפיתוח שהוצעו במשימה 4 (חיפוש מתקדם, סינון דינמי על המפה, השוואת תקופות, סטטיסטיקות חכמות, תכנון מסלול A→B, API חיצוני), בחרתי להתחיל ב**תכנון מסלול**. שלוש סיבות מצטרפות:

1. **שימוש חוזר מקסימלי בנכסי הדאטה הקיימים, במיוחד GTFS.** כבר הוטמעו `gtfs_stops` (Point/4326 עם אינדקס GIST), `gtfs_routes`, `gtfs_trips`, `gtfs_shapes` (LineString/4326, אחת לכל `shape_id` — ההחלטה מ-Compress GTFS Shapes לעיל), וטבלת ה-link `gtfs_stop_route(stop_id, route_id, direction_id)`. תכנון מסלול ישיר הוא ניצול ישיר של כל הארבעה: KNN על תחנות, JOIN לפי `(route_id, direction_id)`, ו-`ST_LineSubstring` על ה-shape. הפיצ'רים האחרים (סטטיסטיקות חכמות, השוואת תקופות) דורשים סדרת זמן עשירה יותר ש**עוד לא** קיימת בסכמה (`stop_times.txt` המלא לא נטען).

2. **ערך משתמש מיידי + בידול ברור משאר המסכים.** המסך הנוכחי מציע ניתוח **שטח** (פוליגון → סטטיסטיקות) ותצוגה כללית של שכבות. תכנון מסלול הוא הראשון שעונה על שאלת **משתמש קצה אופרטיבית** ("איך מגיעים מ-X ל-Y בקו ישיר") במקום שאלה אנליטית. זה גם הופך את הכפתור "תכנון מסלול A→B" עם ה-badge "חדש" לערך מוסף שניתן להדגים בלי לחכות לעדכון נתונים.

3. **גבול-עבודה ברור, ללא תלות בנתונים שעוד לא הועלו.** RPC אחת (`plan_transit_route`) + Store + Hook + Page + ארבעה Components — סקופ סגור, ניתן לשלוח ל-PR בלי "כל הצמתים בארץ" או import מחדש. שאר הכיוונים (חיפוש מתקדם, סינון דינמי) דורשים שינויי UX רוחביים שמשפיעים על כל המפה הקיימת. כאן הוספתי **מסך חדש** ו-route חדש, בלי לגעת בזרימת הניתוח שטח שכבר עובדת.

### תכן טכני

- **RPC בודדת ב-PostGIS** (`supabase/migrations/20260517000000_plan_transit_route.sql`). מקבלת `(origin_lng, origin_lat, dest_lng, dest_lat, max_walk_meters, max_stops_per_end, max_results)`. הזרימה:
  1. KNN על `gtfs_stops` למצוא עד 8 תחנות בכל קצה בתוך רדיוס הליכה.
  2. JOIN דרך `gtfs_stop_route` כדי לזהות זוגות תחנות שמשרתים אותו `(route_id, direction_id)` — זהו "קו ישיר אחד".
  3. בחירת `shape_id` יצוגי לכל `(route_id, direction_id)` מתוך `gtfs_trips`.
  4. `ST_LineLocatePoint` על שתי התחנות → אם `from_frac < to_frac` אז `from` באמת לפני `to` בכיוון הנסיעה; אחרת — נפסל.
  5. `ST_LineSubstring` מחזיר את קטע ה-shape בין שתי התחנות, וה-RPC מחזיר אותו כ-GeoJSON LineString כדי שהקליינט יוכל לצייר ישירות בלי שאילתה נוספת.
  6. אופציה אחת לכל `(route_id, direction_id)` (`DISTINCT ON`) ממוינות לפי `walk_to_stop_m + walk_from_stop_m` עולה.

- **אין מודל זמן/לוחות זמנים.** במכוון. הפרויקט לא מעלה את `stop_times.txt` (מיליוני שורות), אז כל ניסיון לתכנון רב-רגלי עם חלונות העברה היה דורש seed מאסיבי שלא היה משתלם. תכנון רגל-יחידה ("אוטובוס אחד מ-A ל-B") כן מבוסס על דאטה אמיתי דרך `gtfs_stop_route` ולכן אמין. את הזמן בפועל אנחנו **מעריכים** בקליינט (1.4 מ׳/שנייה הליכה, 22/50 קמ"ש לפי `route_type`) — וההסבר הזה מופיע בכרטיס התוצאות עצמו, כדי שלא ייווצר מצג שווא של "Google Maps".

- **שכבת מפה מבודדת**. במקום להוסיף שכבה ל-`MapContainer.tsx` הקיים (שכבר אחראי על mock data, ניתוח אזור, פוליגון מועלה ושכבת 3D), נבנה `RoutePlannerMap` רזה שמורכב מ-`<LeafletMap>` בסיסי + `RoutePlannerMapLayer`. השכבה מאזינה ל-`useRoutePlannerStore` בלבד, ולכן אין הצלבת state בין הניתוח הספציאלי לבין תכנון המסלול.

- **בחירת A/B דו-מצבית**: או דרך Mapbox Geocoding (אותו `MapboxGeocodeAutocomplete` שכבר משמש את שורת החיפוש), או דרך לחיצה ישירה על המפה במצב picking ייעודי שמשנה את הסמן ל-crosshair ומציג באנר באמצע למעלה. בלי לפתוח דיאלוגים נפרדים.

### תלויות נתונים — ולמה ויתרנו על stop_times.txt לחלוטין

הבעיה: ל-Mahod GIS אין את `stop_times.txt` ב-Supabase, ואין `DATABASE_URL` ב-`.env` (יש רק `SUPABASE_SERVICE_ROLE_KEY`). ה-seed המקורי `seed:stop-route` תלוי בשניהם. במקום להריץ אותו, אנחנו בונים את `gtfs_stop_route` בגישה אחרת — קירוב מרחבי על בסיס `gtfs_shapes`. שלושה שלבים שכולם רצים על Supabase Cloud (אין עיבוד מקומי כבד פרט ל-streaming של `shapes.txt`):

1. **`seed:shapes:rest`** — סקריפט TS חדש (`scripts/seed/seed-shapes-rest.ts`) שזורם את `shapes.txt` (218MB raw, 7.1M נקודות) ושולח אותו ל-Supabase דרך REST + service-role, בלי `DATABASE_URL`. הצבירה ל-LineString נעשית בשרת דרך ה-RPC `upsert_gtfs_shapes_bulk(jsonb)`. ברירת מחדל `MAX_SHAPES=30000`, וכל ריצה חוזרת מדלגת על shape_ids שכבר קיימים (idempotent). מסתבר שב-GTFS ישראל יש בסה"כ **רק 6,817 shape_id ייחודיים** ב-`gtfs_trips` — לא 50K כפי שמתואר בחלק העליון של המסמך — אז אפילו 30K הוא הרבה יותר מספיק.

2. **`populate_stop_route_from_shapes(buffer_meters, route_offset, route_limit)`** — RPC ב-PostgreSQL שעוברת על כל `(route_id, direction_id)` בעולם הקווים, בוחרת shape יציג אחד מ-`gtfs_trips`, ומחפשת את כל ה-stops בתוך `buffer_meters` (ברירת מחדל 30 מ׳) מ-LineString של ה-shape. שימוש ב-`ST_DWithin(geom, geom, buffer_degrees)` עם המרת מטרים למעלות (~110000.0 לק"מ) מנצל את GIST index, ו-`ST_Distance(geography)` עוטף לבדיקת דיוק. ה-RPC מדפדפת ב-batches של 300 ראש קו, כדי שלא נחצה את `statement_timeout` של service_role.

3. ה-RPC הראשית `plan_transit_route` משתמשת ב-`gtfs_stop_route` שנבנה ככה בלי לדעת את ההבדל — היא לא יודעת ולא אכפת לה אם הקישורים הגיעו מ-`stop_times.txt` או מ-spatial proximity. ב-`source_version` של כל שורה מצוין `spatial-30m` כדי שאפשר יהיה להבדיל בעתיד אם ירוץ seed אמיתי.

**הדיוק בפועל**: בריצה הראשונה התקבלו ~531K קישורים בכיסוי של 6,266 קווים (80% מהקווים בארץ) ו-32,448 תחנות (93% מהתחנות). מבחן ידני על ת"א מרכז → כיכר המדינה החזיר 10 אפשרויות עם קווים מציאותיים (3, 149, 89, 40, 601, 606, 650, 852). False positives קיימים — תחנת קו 5 ליד נתיב של קו 18 עלולה להיכלל גם בקו 18 — אבל הבדיקה השנייה ב-`plan_transit_route` (השוואת `ST_LineLocatePoint` של from וto) מסננת רוב המקרים אוטומטית.

**המגבלה הידועה**: ללא `stop_times.txt` אין לנו מידע על תדירות, שעות פעילות, או פערים בקווי לילה. ה-UI מצהיר על זה במפורש בכרטיס התוצאות ("ללוחות זמנים ממש (stop_times) נדרש seed מלא").

## ספירות תנועה — העלאה מ־2025 בלבד

הוחלט להעלות ל-Supabase רק נתוני ספירות תנועה משנת **2025**, ולא את כל ההיסטוריה הזמינה במקור. הסיבה העיקרית היא **מגבלות נפח דאטה ואחסון** בפרויקט Supabase: קובץ המקור של Vol4 כולל מיליוני רשומות נפח ב-`traffic_count_volumes`, והעלאה מלאה שלו מנפחת את בסיס הנתונים מהר מאוד ומקרבת את הפרויקט למכסות האחסון/שורות של הסביבה.

היישום בפועל נמצא ב-`scripts/seed/seed-traffic-counts.ts`: הסקריפט מסנן את `traffic_counts` לפי `VOLUME_SURVEY_YEAR = 2025`, ואז מעלה ל-`traffic_count_volumes` רק רשומות שה-`count_id` שלהן שייך לספירות של 2025. בנוסף קיימת תקרה קשיחה של `MAX_VOLUME_ROWS = 40_000`, כדי למנוע טעינה חוזרת של מיליוני רשומות בטעות.

המשמעות למשתמשי המערכת: ניתוחים והשוואות של ספירות תנועה לפני 2025 לא יופיעו בנתונים שמגיעים מהמסד, עד שיוגדל משאב האחסון/השורות או שתיבחר אסטרטגיה אחרת כמו ארכיון חיצוני, טעינה לפי אזור, או טעינה לפי בקשה.

## עמוד סטטיסטיקות (`/statistics`)

- האפליקציה היא Vite + React Router; חוויית `/statistics` מיושמת בארכיטקטורה הקיימת ולא כעץ `app/` של Next.js App Router.
- משיכת נתונים בצד הלקוח דרך לקוח Supabase בדפדפן ו-React Query; חישובים כבדים נשארים ב-SQL (views/RPC), לא ב-JavaScript.
- נוספו `recharts` ו-`@tanstack/react-table` כי נדרשו בפרויקט ולא היו ב-`package.json`.
- בטבלת `accidents` שורה משקפת אזור סטטיסטי; העתק והתוויות ב-UI נמנעים מלרמוז ששורה אחת = אירוע תאונה בודד.
- אשכול מרחבי נטען בעצלנות ולא מחזיר שורות עד ש-`accidents.geom` מאוכלס; ה-UI מציג הודעה בעברית במקרה הזה.
- תובנת אופנועים: לא ניתן לשייך ישירות מעורבות אופנועים לפציעות קשות מהעמודות האגרגטיביות הזמינות, ולכן המדד משווה את חלק האופנועים מכלול כלי רכב ידועים לחלק הפציעות הקשות מסך הפציעות.
- מיגרציות SQL עם שמות הקבצים שנדרשו, והרשאות קריאה/ביצוע ל-`anon` ו-`authenticated` עקביות עם שאר הסכמה.

## Output formats (Task 8)

**Chosen:** GeoJSON, CSV (טבלת סיכום UTF-8), HTML (דוח RTL ממותג), PDF — כולם דרך **Supabase Edge Function** `export-reports` (אין שירות Node נפרד ב-`backend/`).

**Rationale:**

- CSV מספק טבלת נתונים פשוטה לפתיחה באקסל / גיליון אלקטרוני, בלי מורכבות של ייצוא Excel מרובה גיליונות.
- HTML נותן דוח עשיר להצגה/הדפסה מהדפדפן, לצד ה-CSV השטוח.
- GeoJSON is nearly free thanks to PostGIS `ST_AsGeoJSON()` inside the existing `query_*_in_polygon` RPCs (the function merges per-layer FeatureCollections and tags `properties.layer`).
- PDF must be downloadable in environments where **Puppeteer/Chromium cannot run** (Supabase Edge blocks browser automation). We therefore generate PDF with **`pdf-lib`** plus an embedded **Noto Sans Hebrew** font fetched at runtime; CSV/HTML carry the same summary metrics (flat rows vs. styled report), while the PDF presents KPI tables and authority breakdown in a vector layout.

**Rejected alternatives:**

- Shapefile: four-file format, encoding pain with Hebrew, weak TypeScript library support.
- Excel (xlsx): multi-sheet formatting is heavier work than CSV + PDF combined; CSV covers the tabular export need.
- KML/KMZ: less standard than GeoJSON for tooling this project targets.
- Puppeteer on Edge: fails at runtime (`PermissionDenied` / missing Chromium); would force a separate always-on Node host, which we are not adding for this iteration.

**Client contract:** The browser calls `POST …/functions/v1/export-reports` with `{ format, polygon, layers, analysis? }`. `analysis` is a compact `ExportAnalysisPayload` built from `useAnalysisStore` + polygon metadata (`buildExportAnalysisPayload`, including `@turf/area` for polygon km²).

**מיקום ב-UI:** אין פריט תפריט צדדי לייצוא ואין דף ייעודי; כרטיס הייצוא (`ExportPanel`) יושב בפאנל הימני **מתחת לכרטיס "שכבות מידע"**. נתיב ישן `/export` מפנה לדשבורד (`/`) לסימניות קיימות.

## הסוכן החכם — עדכון אוטומטי חודשי מ-data.gov.il

**מה זה?** "הסוכן החכם" הוא ה-Edge Function `supabase/functions/update-agent`. הוא יודע למשוך לבד את מערכי הנתונים הפתוחים של ממשלת ישראל (תאונות `accid_taz`, ספירות תנועה `vehicle_counts`, תחנות רכבת `rail_stat`) ולעדכן את הטבלאות ב-Supabase — בלי שמישהו ילחץ על כפתור.

**איך הוא רץ?** מיגרציה `20260522000000_cron_update_agent_monthly.sql` מתקינה את ההרחבות `pg_cron` ו-`pg_net` ויוצרת תזמון בשם `update-agent-monthly` שרץ ב-1 לכל חודש בשעה 03:00 UTC. Postgres עצמו שולח בקשת `POST` ל-Edge Function עם header `x-trigger: cron`, וה-Function מתעוררת ועושה את שאר העבודה.

**איך נמנעות כפילויות?** שני שלבים:

1. **ברמת הקובץ** — לפני הורדה, הסוכן שואל את CKAN מתי הקובץ עודכן לאחרונה ומשווה ל-`data_sources.last_modified`. אם זה אותו תאריך — דילוג מלא, ה-status הופך ל-`skipped`.
2. **ברמת השורה** — כל אדפטר עושה `UPSERT` עם `onConflict` על המפתח הטבעי של אותו דאטה: `pk_teuna_fikt` בתאונות, `count_id` בספירות, `station_id` בתחנות רכבת, `code` בסוגי רכב. כך שורה קיימת מתעדכנת במקום שתשוכפל. החריג היחיד הוא `traffic_count_volumes` (מדידות שעתיות בלי מפתח טבעי) — שם הסוכן מוחק ומכניס מחדש את כל השורות של אותה ספירה.

**מה נשמר היכן?** הסוכן לא שומר כלום בדיסק (זה Deno, אין filesystem) ולא ב-Storage. הוא מוריד את ה-CSV/SHP מ-CKAN לזיכרון, מפענח, וכותב ישירות לטבלאות Postgres (`accidents`, `traffic_*`, `infra_railway_stations`). בנוסף הוא מתחזק שתי טבלאות ניהול: `update_log` (שורה לכל ריצה עם status ומונים) ו-`data_sources` (last_checked_at, last_modified). הצעד הזה הוא קריטי כי הוא מה שמאפשר את בדיקת השינוי בריצה הבאה.

**הרצה ידנית** עדיין אפשרית: `POST .../functions/v1/update-agent` (manual), עם `?force=true` כדי לדלג על בדיקת השינוי, או עם `?source=traffic_counts` כדי להריץ מקור אחד בלבד. ה-cron החודשי הוא רק "ברירת מחדל" — הוא לא חוסם הפעלות ידניות.

**למה חודשי ולא יומי?** מערכי הנתונים שעל הפרק (תאונות LMS, ספירות תנועה) מתפרסמים במחזור חודשי. הרצה תכופה יותר תיצור עומס מיותר על ה-DB ועל data.gov.il בלי להביא ערך מוסף — בדיקת ה-`last_modified` תזהה שאין שינוי ותדלג, אבל הקריאה ל-CKAN עצמה כבר התבזבזה. אם בעתיד יתווסף מקור עם תדירות שונה, אפשר להוסיף תזמון נפרד עם `cron.schedule` נוסף, או להגדיר תדירות לכל מקור ב-`data_sources.metadata`.

**הגדרה חד-פעמית.** המיגרציה מצפה לשני סודות ב-`supabase_vault`: `project_url` ו-`service_role_key`. צריך להזין אותם פעם אחת ב-SQL Editor (יש דוגמה בקובץ המיגרציה עצמו). הסיבה: לא רוצים את ה-service-role key בקוד שיושב ב-git.

### LRT — תמיכה בשתי סכמות באותו adapter

האדפטר `adapters/lrt.ts` נוסף בעקבות פיצול בפורמט של `lrt_stat` ב-data.gov.il לאורך השנים. במקום שני adapters נפרדים בחרנו לבנות אדפטר אחד שמזהה לבד באיזו סכמה מדובר ועובד איתה:

1. **`rail_asset`** — שדות `ASSET_NO` + `NAME`, אותה צורה כמו `rail_stat`. נמשך מהשורה ב-CSV באמצעות `ASSET_NO`.
2. **`lrt_entrance`** — שדות `STAT_NAME` + `ENTRC_LBL` (כניסות לתחנות). אין `ASSET_NO`, אז מדלגים על ה-CSV ומשתמשים רק ב-attributes שבתוך ה-SHP.

הבעיה ב-`lrt_entrance`: אין מזהה טבעי. אם פשוט נשים `station_id` לפי `STAT_NAME`, כל כניסה תדרוס את הקודמת, וגם בריצה הבאה כל כניסה תקבל ID אחר. הפתרון: מזהה דטרמיניסטי דרך **SHA-256 של `(LINE | STAT_NAME | ENTRC_LBL | lon | lat)`** (20 תווים הקסה ראשונים, עם prefix `lrt_e_`). כך אותה כניסה תקבל את אותו `station_id` בכל ריצה, ה-UPSERT עובד נכון, ואין כפילויות בין ריצות. תוך-batch אנחנו עוטפים גם ב-`dedupeByStationId` כי לפעמים יש שתי שורות SHP זהות שיתנגשו על אותו ID באותה ריצה (`ON CONFLICT DO UPDATE cannot affect row a second time`).

האדפטר כותב לטבלה `infra_metro_stations` (אותה טבלה שמשמשת לתחנות מטרו עתידיות) — לא ל-`infra_railway_stations`, כי הסכמה שונה (TEXT primary key ולא INTEGER, אין `metadata`/`is_active`). בריצה הראשונה, יש להריץ גם את המיגרציה `20260522010000_data_sources_seed_lrt.sql` שמכניסה את שורת ה-`lrt` לטבלת `data_sources` (היא לא הייתה ב-seed המקורי).

### Road authority — לא כלול במשיכת הסוכן

מערך הנתונים `roadauthority` (רשות הדרכים / סמכויות כביש) **לא** נכלל ב-`update-agent` ובטבלת `data_sources` לצורך משיכה אוטומטית. הסיבה: המקור אינו מתעדכן באופן **תקף** (עקבי ואמין מבחינת תאריכי פרסום ותדירות בפועל), כך שריצות חודשיות של הסוכן לא יבטיחו נתונים עדכניים — ולעומת זאת ייצרו רושם שווא של סנכרון שוטף. אם בעתיד יתברר שהמקור מתחזק בצורה צפויה, אפשר יהיה להוסיף אדפטר ייעודי ושורת `data_sources` עם מדיניות בדיקת שינוי מתאימה.
