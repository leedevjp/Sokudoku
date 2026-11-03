-- Aggregates only: no raw answer history leaves the database.
-- Memory bands are a presentation policy, independent of the FSRS scheduler.
create function public.learning_dashboard(p_timezone text default 'UTC')
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  local_today date;
  result jsonb;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'invalid timezone' using errcode = '22023';
  end if;
  local_today := (now() at time zone p_timezone)::date;
  with catalog as materialized (
    select 'word'::text as source, id, entry_type, has_kanji,
      case when difficulty <= 1 then '1' when difficulty <= 3 then '2'
        when difficulty <= 5 then '3' when difficulty <= 7 then '4' else '5' end as level
    from public.word where deleted_at is null
    union all
    select 'personal', id, entry_type, has_kanji, 'P'
    from public.personal_word where user_id=actor and deleted_at is null
  ), eligible as materialized (
    select c.*, k.kind from catalog c cross join (values ('meaning'),('reading')) k(kind)
    where k.kind='meaning' or (c.entry_type='word' and c.has_kanji)
  ), answers as materialized (
    select a.*, case when a.personal_word_id is null then 'word' else 'personal' end as source,
      coalesce(a.word_id,a.personal_word_id) as word_ref
    from public.answer_log a where a.user_id=actor
  ), history as (
    select source,word_ref,question_type,count(*) as attempts
    from answers group by source,word_ref,question_type
  ), learned as (
    select e.*, coalesce(h.attempts,0) as attempts,
      (h.attempts is not null or s.word_ref is not null) as studied,
      (s.word_ref is not null and (s.due_at <= now() or s.last_result <> 'correct')) as review,
      case when s.word_ref is null or s.last_result <> 'correct' or coalesce((s.card->>'stability')::float8,0) < 7 then 0
        when (s.card->>'stability')::float8 < 21 then 1 else 2 end as band
    from eligible e
    left join history h on h.source=e.source and h.word_ref=e.id and h.question_type=e.kind
    left join public.word_learning_state s on s.user_id=actor and s.source=e.source and s.word_ref=e.id and s.question_type=e.kind
  ), groups as (
    select entry_type,kind,level,count(*) as total,
      count(*) filter(where studied) as learned,
      count(*) filter(where review) as review,
      jsonb_build_array(count(*) filter(where studied and band=0),count(*) filter(where studied and band=1),count(*) filter(where studied and band=2)) as memory,
      sum(attempts) as attempts
    from learned group by entry_type,kind,level
  ), activity as (
    select e.entry_type,e.kind,e.level,(a.answered_at at time zone p_timezone)::date as day,
      count(*) as attempts,count(*) filter(where a.result='correct') as correct,
      coalesce(sum(a.response_ms) filter(where a.result='correct'),0) as correct_ms
    from answers a join eligible e on e.source=a.source and e.id=a.word_ref and e.kind=a.question_type
    where a.answered_at >= ((local_today-6)::timestamp at time zone p_timezone)
      and a.answered_at < ((local_today+1)::timestamp at time zone p_timezone)
    group by e.entry_type,e.kind,e.level,(a.answered_at at time zone p_timezone)::date
  )
  select jsonb_build_object('today',local_today,'updated_at',now(),
    'groups',coalesce((select jsonb_agg(to_jsonb(g) order by entry_type,kind,level) from groups g),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(to_jsonb(a) order by day,entry_type,kind,level) from activity a),'[]'::jsonb))
  into result;
  return result;
end;
$$;
revoke all on function public.learning_dashboard(text) from public, anon;
grant execute on function public.learning_dashboard(text) to authenticated;
