ALTER TABLE public.collector_projects ADD COLUMN auxiliary_outlets jsonb;
CREATE OR REPLACE FUNCTION public.save_manufacturing_project(_project_id uuid, _customer_name text, _title text, _rows jsonb)
 RETURNS SETOF public.collector_projects
 LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $function$
DECLARE uid uuid:=auth.uid(); cid uuid; label text:=coalesce(nullif(trim(_customer_name),''),'İsimsiz Müşteri'); r jsonb; stamp bigint; BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF jsonb_typeof(_rows)<>'array' OR jsonb_array_length(_rows)=0 THEN RAISE EXCEPTION 'Collectors required'; END IF;
 stamp:=((_rows->0)->>'updated_at')::bigint;
 INSERT INTO public.manufacturing_customers(user_id,name,name_key) VALUES(uid,label,lower(label)) ON CONFLICT(user_id,name_key) DO UPDATE SET name=excluded.name RETURNING id INTO cid;
 INSERT INTO public.manufacturing_projects(id,user_id,customer_id,title,updated_at) VALUES(_project_id,uid,cid,coalesce(nullif(trim(_title),''),'Kollektör projesi'),stamp) ON CONFLICT(id) DO UPDATE SET customer_id=excluded.customer_id,title=excluded.title,updated_at=excluded.updated_at WHERE manufacturing_projects.user_id=uid;
 IF NOT EXISTS(SELECT 1 FROM public.manufacturing_projects WHERE id=_project_id AND user_id=uid) THEN RAISE EXCEPTION 'Project access denied'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
 IF EXISTS(SELECT 1 FROM public.collector_projects WHERE user_id=uid AND id=r->>'id' AND manufacturing_project_id IS DISTINCT FROM _project_id) THEN RAISE EXCEPTION 'Collector belongs to another project'; END IF;
 INSERT INTO public.collector_projects(id,user_id,customer_name,name,notes,main_size,out_size,outlet_count,spacing,start_length,end_length,layout,thread,production_date,quantity,updated_at,batch_id,batch_saved_at,batch_position,manufacturing_project_id,project_title,main_end_type,branches,auxiliary_outlets)
 VALUES(r->>'id',uid,label,coalesce(r->>'name',''),r->>'notes',r->>'main_size',r->>'out_size',(r->>'outlet_count')::integer,(r->>'spacing')::float8,(r->>'start_length')::float8,(r->>'end_length')::float8,r->>'layout',r->>'thread',r->>'production_date',(r->>'quantity')::integer,stamp,_project_id,stamp,(r->>'batch_position')::integer,_project_id,coalesce(nullif(trim(_title),''),'Kollektör projesi'),r->>'main_end_type',nullif(r->'branches','null'::jsonb),nullif(r->'auxiliary_outlets','null'::jsonb))
 ON CONFLICT(user_id,id) DO UPDATE SET customer_name=excluded.customer_name,notes=excluded.notes,main_size=excluded.main_size,out_size=excluded.out_size,outlet_count=excluded.outlet_count,spacing=excluded.spacing,start_length=excluded.start_length,end_length=excluded.end_length,layout=excluded.layout,thread=excluded.thread,production_date=excluded.production_date,quantity=excluded.quantity,updated_at=excluded.updated_at,batch_id=excluded.batch_id,batch_saved_at=excluded.batch_saved_at,batch_position=excluded.batch_position,manufacturing_project_id=excluded.manufacturing_project_id,project_title=excluded.project_title,main_end_type=excluded.main_end_type,branches=excluded.branches,auxiliary_outlets=excluded.auxiliary_outlets;
 END LOOP;
 DELETE FROM public.collector_projects c WHERE c.user_id=uid AND c.manufacturing_project_id=_project_id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(_rows) AS item(value) WHERE item.value->>'id'=c.id);
 RETURN QUERY SELECT * FROM public.collector_projects c WHERE c.user_id=uid AND c.manufacturing_project_id=_project_id ORDER BY c.batch_position;
END $function$;