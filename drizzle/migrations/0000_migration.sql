CREATE TABLE public.collector_projects (
  id text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  customer_name text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  main_size text NOT NULL DEFAULT '2',
  out_size text NOT NULL DEFAULT '3/4',
  outlet_count integer NOT NULL DEFAULT 4 CHECK (outlet_count BETWEEN 1 AND 60),
  spacing double precision NOT NULL DEFAULT 20 CHECK (spacing > 0 AND spacing < 'Infinity'::double precision),
  start_length double precision NOT NULL DEFAULT 8 CHECK (start_length >= 0 AND start_length < 'Infinity'::double precision),
  end_length double precision NOT NULL DEFAULT 4 CHECK (end_length >= 0 AND end_length < 'Infinity'::double precision),
  layout text NOT NULL DEFAULT 'karsilikli' CHECK (layout IN ('tek', 'karsilikli', 'capraz')),
  thread text NOT NULL DEFAULT 'kapali' CHECK (thread IN ('acik', 'kapali', 'cift')),
  production_date text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  updated_at bigint NOT NULL,
  batch_id uuid,
  batch_saved_at bigint,
  batch_position integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collector_projects TO authenticated;
GRANT ALL ON public.collector_projects TO service_role;
ALTER TABLE public.collector_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own collectors" ON public.collector_projects FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Insert own collectors" ON public.collector_projects FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Update own collectors" ON public.collector_projects FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Delete own collectors" ON public.collector_projects FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE INDEX collector_projects_owner_updated ON public.collector_projects (user_id, updated_at DESC, id);
CREATE INDEX collector_projects_owner_batch_idx ON public.collector_projects (user_id, batch_id, batch_position);