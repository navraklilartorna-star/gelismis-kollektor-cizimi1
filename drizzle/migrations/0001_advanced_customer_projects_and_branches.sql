CREATE TABLE public.manufacturing_customers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), name text NOT NULL DEFAULT 'İsimsiz Müşteri', name_key text NOT NULL, UNIQUE(user_id,name_key), UNIQUE(user_id,id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_customers TO authenticated;
GRANT ALL ON public.manufacturing_customers TO service_role;
ALTER TABLE public.manufacturing_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own customers" ON public.manufacturing_customers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TABLE public.manufacturing_projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), customer_id uuid NOT NULL, title text NOT NULL DEFAULT 'Kollektör projesi', updated_at bigint NOT NULL DEFAULT 0, UNIQUE(user_id,id), FOREIGN KEY(user_id,customer_id) REFERENCES public.manufacturing_customers(user_id,id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_projects TO authenticated;
GRANT ALL ON public.manufacturing_projects TO service_role;
ALTER TABLE public.manufacturing_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own manufacturing projects" ON public.manufacturing_projects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.collector_projects ADD COLUMN manufacturing_project_id uuid, ADD COLUMN project_title text NOT NULL DEFAULT '', ADD COLUMN main_end_type text, ADD COLUMN branches jsonb;
INSERT INTO public.manufacturing_customers(user_id,name,name_key)
SELECT DISTINCT ON (user_id,lower(trim(coalesce(nullif(trim(customer_name),''),'İsimsiz Müşteri')))) user_id, coalesce(nullif(trim(customer_name),''),'İsimsiz Müşteri'), lower(trim(coalesce(nullif(trim(customer_name),''),'İsimsiz Müşteri'))) FROM public.collector_projects;
INSERT INTO public.manufacturing_projects(id,user_id,customer_id,title,updated_at)
SELECT coalesce(c.batch_id,gen_random_uuid()),c.user_id,m.id,'Kollektör projesi',max(c.updated_at)
FROM public.collector_projects c JOIN public.manufacturing_customers m ON m.user_id=c.user_id AND m.name_key=lower(trim(coalesce(nullif(trim(c.customer_name),''),'İsimsiz Müşteri')))
GROUP BY c.user_id,m.id,c.batch_id,CASE WHEN c.batch_id IS NULL THEN c.id ELSE '' END;
UPDATE public.collector_projects c SET manufacturing_project_id=p.id,project_title=p.title FROM public.manufacturing_projects p JOIN public.manufacturing_customers m ON m.id=p.customer_id AND m.user_id=p.user_id WHERE c.user_id=p.user_id AND c.batch_id=p.id;
-- Legacy rows have no recoverable grouping and remain individual projects.
DO $$ DECLARE r record; pid uuid; cid uuid; BEGIN FOR r IN SELECT * FROM public.collector_projects WHERE manufacturing_project_id IS NULL LOOP SELECT id INTO cid FROM public.manufacturing_customers WHERE user_id=r.user_id AND name_key=lower(trim(coalesce(nullif(trim(r.customer_name),''),'İsimsiz Müşteri'))); SELECT id INTO pid FROM public.manufacturing_projects p WHERE p.user_id=r.user_id AND p.customer_id=cid AND NOT EXISTS(SELECT 1 FROM public.collector_projects c WHERE c.manufacturing_project_id=p.id) LIMIT 1; IF pid IS NULL THEN INSERT INTO public.manufacturing_projects(user_id,customer_id,title,updated_at) VALUES(r.user_id,cid,'Kollektör projesi',r.updated_at) RETURNING id INTO pid; END IF; UPDATE public.collector_projects SET manufacturing_project_id=pid,project_title='Kollektör projesi' WHERE user_id=r.user_id AND id=r.id; END LOOP; END $$;
ALTER TABLE public.collector_projects ADD CONSTRAINT collector_manufacturing_owner_fk FOREIGN KEY(user_id,manufacturing_project_id) REFERENCES public.manufacturing_projects(user_id,id);
CREATE INDEX collector_manufacturing_project_idx ON public.collector_projects(user_id,manufacturing_project_id);
CREATE OR REPLACE FUNCTION public.save_manufacturing_project(_project_id uuid, _customer_name text, _title text, _rows jsonb) RETURNS SETOF public.collector_projects LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); cid uuid; label text:=coalesce(nullif(trim(_customer_name),''),'İsimsiz Müşteri'); r jsonb; stamp bigint; BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF jsonb_typeof(_rows)<>'array' OR jsonb_array_length(_rows)=0 THEN RAISE EXCEPTION 'Collectors required'; END IF;
 stamp:=((_rows->0)->>'updated_at')::bigint;
 INSERT INTO public.manufacturing_customers(user_id,name,name_key) VALUES(uid,label,lower(label)) ON CONFLICT(user_id,name_key) DO UPDATE SET name=excluded.name RETURNING id INTO cid;
 INSERT INTO public.manufacturing_projects(id,user_id,customer_id,title,updated_at) VALUES(_project_id,uid,cid,coalesce(nullif(trim(_title),''),'Kollektör projesi'),stamp) ON CONFLICT(id) DO UPDATE SET customer_id=excluded.customer_id,title=excluded.title,updated_at=excluded.updated_at WHERE manufacturing_projects.user_id=uid;
 IF NOT EXISTS(SELECT 1 FROM public.manufacturing_projects WHERE id=_project_id AND user_id=uid) THEN RAISE EXCEPTION 'Project access denied'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
 IF EXISTS(SELECT 1 FROM public.collector_projects WHERE user_id=uid AND id=r->>'id' AND manufacturing_project_id IS DISTINCT FROM _project_id) THEN RAISE EXCEPTION 'Collector belongs to another project'; END IF;
 INSERT INTO public.collector_projects(id,user_id,customer_name,name,notes,main_size,out_size,outlet_count,spacing,start_length,end_length,layout,thread,production_date,quantity,updated_at,batch_id,batch_saved_at,batch_position,manufacturing_project_id,project_title,main_end_type,branches)
 VALUES(r->>'id',uid,label,coalesce(r->>'name',''),r->>'notes',r->>'main_size',r->>'out_size',(r->>'outlet_count')::integer,(r->>'spacing')::float8,(r->>'start_length')::float8,(r->>'end_length')::float8,r->>'layout',r->>'thread',r->>'production_date',(r->>'quantity')::integer,stamp,_project_id,stamp,(r->>'batch_position')::integer,_project_id,coalesce(nullif(trim(_title),''),'Kollektör projesi'),r->>'main_end_type',nullif(r->'branches','null'::jsonb))
 ON CONFLICT(user_id,id) DO UPDATE SET customer_name=excluded.customer_name,notes=excluded.notes,main_size=excluded.main_size,out_size=excluded.out_size,outlet_count=excluded.outlet_count,spacing=excluded.spacing,start_length=excluded.start_length,end_length=excluded.end_length,layout=excluded.layout,thread=excluded.thread,production_date=excluded.production_date,quantity=excluded.quantity,updated_at=excluded.updated_at,batch_id=excluded.batch_id,batch_saved_at=excluded.batch_saved_at,batch_position=excluded.batch_position,manufacturing_project_id=excluded.manufacturing_project_id,project_title=excluded.project_title,main_end_type=excluded.main_end_type,branches=excluded.branches;
 END LOOP;
 DELETE FROM public.collector_projects c WHERE c.user_id=uid AND c.manufacturing_project_id=_project_id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(_rows) r WHERE r->>'id'=c.id);
 RETURN QUERY SELECT * FROM public.collector_projects c WHERE c.user_id=uid AND c.manufacturing_project_id=_project_id ORDER BY c.batch_position;
END $$;
REVOKE ALL ON FUNCTION public.save_manufacturing_project(uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_manufacturing_project(uuid,text,text,jsonb) TO authenticated;