-- Bounded, indexed pages avoid constructing a 100k-record JSON aggregate.
create index sync_changes_cursor on public.sync_changes(scope,dataset,version,record_key);
create or replace function public.sync_pull(p_versions jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' set jit=off as $$
declare heads jsonb; through jsonb; d text; actor text; base bigint; ceiling bigint; cursor_version bigint;
 cursor_key text; rows_json jsonb; last_row jsonb; n integer;
begin
 if auth.uid() is null then raise exception 'unauthorized' using errcode='42501'; end if;
 heads:=public.sync_manifest()->'versions';
 through:=coalesce(p_versions->'$through',heads);
 d:=coalesce(p_versions->>'$dataset','words');
 if d not in ('words','personal_words','distractors','extra_choices','answers','learning_states','learner') then raise exception 'invalid dataset'; end if;
 actor:=case when d in ('words','distractors','extra_choices') then 'global' else auth.uid()::text end;
 base:=coalesce((p_versions->>d)::bigint,-1);
 ceiling:=least(coalesce((through->>d)::bigint,0),coalesce((heads->>d)::bigint,0));
 cursor_version:=coalesce((p_versions->'$after'->>0)::bigint,base);
 cursor_key:=coalesce(p_versions->'$after'->>1,'');
 select coalesce(json_agg(json_build_object('dataset',c.dataset,'key',c.record_key,'version',c.version::text,
   'deleted',c.deleted,'value',c.payload) order by c.version,c.record_key),'[]'::json)::jsonb into rows_json
 from (select * from public.sync_changes c where c.scope=actor and c.dataset=d
   and c.version>base and c.version<=ceiling and (c.version,c.record_key)>(cursor_version,cursor_key)
   order by c.version,c.record_key limit 2001) c;
 n:=jsonb_array_length(rows_json);
 if n>2000 then rows_json:=rows_json-2000; end if;
 last_row:=rows_json->(jsonb_array_length(rows_json)-1);
 return jsonb_build_object('owner',auth.uid(),'protocol',1,'versions',through,'changes',rows_json,
   'done',n<=2000,'after',case when n>2000 then jsonb_build_array(last_row->>'version',last_row->>'key') else null end);
end; $$;
