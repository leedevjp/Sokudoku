-- Per-scope counters are row-locked until commit, unlike sequence IDs. Each
-- pull is one stable DB snapshot; latest-per-record deltas include tombstones.
create schema if not exists sync_private;
revoke all on schema sync_private from public, anon, authenticated;
create table public.sync_versions (
  scope text not null,
  dataset text not null check (dataset in ('words','personal_words','distractors','extra_choices','answers','learning_states','learner')),
  version bigint not null default 0 check (version >= 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(scope,dataset)
);
create table public.sync_changes (
  scope text not null,
  dataset text not null,
  record_key text not null,
  version bigint not null,
  deleted boolean not null,
  payload jsonb,
  primary key(scope,dataset,record_key)
);
create index sync_changes_since on public.sync_changes(scope,dataset,version);
alter table public.sync_versions enable row level security;
alter table public.sync_changes enable row level security;
revoke all on public.sync_versions,public.sync_changes from public,anon,authenticated;
grant select on public.sync_versions,public.sync_changes to authenticated;
create policy sync_versions_read on public.sync_versions for select to authenticated
  using (scope='global' or scope=(select auth.uid())::text);
create policy sync_changes_read on public.sync_changes for select to authenticated
  using (scope='global' or scope=(select auth.uid())::text);

create function sync_private.record_change(p_scope text,p_dataset text,p_key text,p_deleted boolean,p_payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v bigint;
begin
  insert into public.sync_versions(scope,dataset,version) values(p_scope,p_dataset,1)
  on conflict(scope,dataset) do update set version=public.sync_versions.version+1,updated_at=clock_timestamp()
  returning version into v;
  insert into public.sync_changes(scope,dataset,record_key,version,deleted,payload)
  values(p_scope,p_dataset,p_key,v,p_deleted,case when p_deleted then null else p_payload end)
  on conflict(scope,dataset,record_key) do update set
    version=excluded.version,deleted=excluded.deleted,payload=excluded.payload;
end; $$;
revoke all on function sync_private.record_change(text,text,text,boolean,jsonb) from public,anon,authenticated;

create function sync_private.track_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare row_data jsonb; old_data jsonb; actor text; old_actor text; k text; gone boolean;
begin
  row_data := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  -- Derived processing flags are not a new answer and must not cause a sync loop.
  if tg_table_name='answer_log' and tg_op='UPDATE' and
    (to_jsonb(old)-'learning_processed_at'-'learning_version')=(row_data-'learning_processed_at'-'learning_version') then return new; end if;
  actor := coalesce(row_data->>'user_id','global');
  if tg_table_name='word_learning_state' then
    k := (row_data->>'source')||':'||(row_data->>'word_ref')||':'||(row_data->>'question_type');
  elsif tg_table_name='meaning_distractor' then
    k := (row_data->>'target_word_id')||':'||(row_data->>'question_type')||':'||(row_data->>'candidate_source')||':'||(row_data->>'candidate_id');
  elsif tg_table_name='learner_state' then k := 'self';
  else k := row_data->>'id'; end if;
  if tg_op='UPDATE' then
    old_data:=to_jsonb(old); old_actor:=coalesce(old_data->>'user_id','global');
    if old_actor<>actor then perform sync_private.record_change(old_actor,tg_argv[0],k,true,null); end if;
  end if;
  gone := tg_op='DELETE' or row_data->>'deleted_at' is not null;
  perform sync_private.record_change(actor,tg_argv[0],k,gone,
    row_data-'user_id'-'learning_processed_at'-'learning_version');
  if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function sync_private.track_change() from public,anon,authenticated;

-- Bootstrap the existing rows once. No learning history is rewritten.
lock table public.word,public.personal_word,public.meaning_distractor,public.extra_meaning_choice,
  public.answer_log,public.word_learning_state,public.learner_state in share row exclusive mode;
insert into public.sync_changes(scope,dataset,record_key,version,deleted,payload)
select 'global','words',id::text,1,deleted_at is not null,to_jsonb(w) from public.word w
union all select user_id::text,'personal_words',id::text,1,deleted_at is not null,to_jsonb(w)-'user_id' from public.personal_word w
union all select 'global','distractors',target_word_id::text||':'||question_type||':'||candidate_source||':'||candidate_id::text,1,false,to_jsonb(d) from public.meaning_distractor d
union all select 'global','extra_choices',id::text,1,false,to_jsonb(e) from public.extra_meaning_choice e
union all select user_id::text,'answers',id::text,1,false,to_jsonb(a)-'user_id'-'learning_processed_at'-'learning_version' from public.answer_log a
union all select user_id::text,'learning_states',source||':'||word_ref::text||':'||question_type,1,false,to_jsonb(s)-'user_id' from public.word_learning_state s
union all select user_id::text,'learner','self',1,false,to_jsonb(l)-'user_id' from public.learner_state l;
update public.sync_changes set payload=null where deleted;
insert into public.sync_versions(scope,dataset,version)
select scope,dataset,1 from public.sync_changes group by scope,dataset;
-- Global empty collections still have an explicit version.
insert into public.sync_versions(scope,dataset,version)
select 'global',d,0 from unnest(array['words','distractors','extra_choices']) d on conflict do nothing;

create trigger sync_words after insert or update or delete on public.word for each row execute function sync_private.track_change('words');
create trigger sync_personal after insert or update or delete on public.personal_word for each row execute function sync_private.track_change('personal_words');
create trigger sync_distractors after insert or update or delete on public.meaning_distractor for each row execute function sync_private.track_change('distractors');
create trigger sync_extra_choices after insert or update or delete on public.extra_meaning_choice for each row execute function sync_private.track_change('extra_choices');
create trigger sync_answers after insert or update or delete on public.answer_log for each row execute function sync_private.track_change('answers');
create trigger sync_learning after insert or update or delete on public.word_learning_state for each row execute function sync_private.track_change('learning_states');
create trigger sync_learner after insert or update or delete on public.learner_state for each row execute function sync_private.track_change('learner');

create function public.sync_manifest() returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode='42501'; end if;
  return jsonb_build_object('owner',auth.uid(),'protocol',1,'versions',(
    select coalesce(jsonb_object_agg(dataset,version::text),'{}'::jsonb)
    from public.sync_versions where scope in ('global',auth.uid()::text)
  ));
end; $$;
create function public.sync_pull(p_versions jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' set jit=off as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode='42501'; end if;
  with heads as materialized (
    select * from public.sync_versions where scope in ('global',auth.uid()::text)
  )
  select jsonb_build_object('owner',auth.uid(),'protocol',1,
    'versions',(select coalesce(jsonb_object_agg(dataset,version::text),'{}'::jsonb) from heads),
    'changes',coalesce(jsonb_agg(jsonb_build_object('dataset',c.dataset,'key',c.record_key,
      'version',c.version::text,'deleted',c.deleted,'value',c.payload)
      order by c.dataset,c.version,c.record_key) filter(where c.record_key is not null),'[]'::jsonb)) into result
  from heads h left join public.sync_changes c on c.scope=h.scope and c.dataset=h.dataset
    and c.version>coalesce((p_versions->>h.dataset)::bigint,-1) and c.version<=h.version;
  return result;
end; $$;
revoke all on function public.sync_manifest(),public.sync_pull(jsonb) from public,anon;
grant execute on function public.sync_manifest(),public.sync_pull(jsonb) to authenticated;
