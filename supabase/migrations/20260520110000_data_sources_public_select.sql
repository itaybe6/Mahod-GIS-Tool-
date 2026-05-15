-- קטלוג מקורות מידע — קריאה ציבורית לעמוד "מקורות מידע" בקליינט (anon)
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_sources_public_select ON public.data_sources;
CREATE POLICY data_sources_public_select ON public.data_sources
  FOR SELECT TO anon, authenticated USING (true);
