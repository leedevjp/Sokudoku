-- Date-first covering index for the authenticated user's recent activity.
create index answer_log_user_activity_idx on public.answer_log(user_id,answered_at)
include(word_id,personal_word_id,question_type,result,response_ms);

-- Keep short dashboard requests out of per-request JIT compilation.
create or replace function public.learning_dashboard(p_timezone text default 'UTC')
returns jsonb language plpgsql stable security invoker set search_path='' set jit=off
as $$
declare actor uuid := auth.uid(); local_today date; dashboard_payload jsonb;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if p_timezone is null or length(p_timezone)>100 then
    raise exception 'invalid timezone' using errcode='22023';
  end if;
  -- PostgreSQL validates the zone here. Enumerating pg_timezone_names on every
  -- request is expensive; the HTTP API also validates with Intl.DateTimeFormat.
  local_today := (now() at time zone p_timezone)::date;
  with catalog as materialized (
    select 'word'::text as source,id,entry_type,has_kanji,
      case when difficulty<=1 then '1' when difficulty<=3 then '2'
        when difficulty<=5 then '3' when difficulty<=7 then '4' else '5' end as level
    from public.word where deleted_at is null
    union all
    select 'personal',id,entry_type,has_kanji,'P'
    from public.personal_word where user_id=actor and deleted_at is null
  ), totals as (
    select entry_type,level,'meaning'::text as kind,count(*) as total from catalog group by entry_type,level
    union all
    select entry_type,level,'reading',count(*) from catalog
    where entry_type='word' and has_kanji group by entry_type,level
  ), history as (
    select case when personal_word_id is null then 'word' else 'personal' end as source,
      coalesce(word_id,personal_word_id) as word_ref,question_type,count(*) as attempts
    from public.answer_log where user_id=actor
    group by personal_word_id is null,coalesce(word_id,personal_word_id),question_type
  ), studied as (
    select coalesce(h.source,s.source) as source,coalesce(h.word_ref,s.word_ref) as word_ref,
      coalesce(h.question_type,s.question_type) as kind,coalesce(h.attempts,0) as attempts,
      (s.word_ref is not null and (s.due_at<=now() or s.last_result<>'correct')) as review,
      case when s.word_ref is null or s.last_result<>'correct' or coalesce((s.card->>'stability')::float8,0)<7 then 0
        when (s.card->>'stability')::float8<21 then 1 else 2 end as band
    from history h full join (select * from public.word_learning_state where user_id=actor) s
      on h.source=s.source and h.word_ref=s.word_ref and h.question_type=s.question_type
  ), learning_groups as (
    select c.entry_type,d.kind,c.level,count(*) as learned,count(*) filter(where d.review) as review,
      jsonb_build_array(count(*) filter(where band=0),count(*) filter(where band=1),count(*) filter(where band=2)) as memory,
      sum(d.attempts) as attempts
    from studied d join catalog c on c.source=d.source and c.id=d.word_ref
    where d.kind='meaning' or (d.kind='reading' and c.entry_type='word' and c.has_kanji)
    group by c.entry_type,d.kind,c.level
  ), groups as (
    select t.entry_type,t.kind,t.level,t.total,coalesce(g.learned,0) as learned,coalesce(g.review,0) as review,
      coalesce(g.memory,'[0,0,0]'::jsonb) as memory,coalesce(g.attempts,0) as attempts
    from totals t left join learning_groups g using(entry_type,kind,level)
  ), activity as (
    select c.entry_type,a.question_type as kind,c.level,(a.answered_at at time zone p_timezone)::date as day,
      count(*) as attempts,count(*) filter(where a.result='correct') as correct,
      coalesce(sum(a.response_ms) filter(where a.result='correct'),0) as correct_ms
    from public.answer_log a join catalog c
      on c.source=case when a.personal_word_id is null then 'word' else 'personal' end
      and c.id=coalesce(a.word_id,a.personal_word_id)
    where a.user_id=actor and (a.question_type='meaning' or (a.question_type='reading' and c.entry_type='word' and c.has_kanji))
      and a.answered_at>=((local_today-6)::timestamp at time zone p_timezone)
      and a.answered_at<((local_today+1)::timestamp at time zone p_timezone)
    group by c.entry_type,a.question_type,c.level,(a.answered_at at time zone p_timezone)::date
  )
  select jsonb_build_object('today',local_today,'updated_at',now(),
    'groups',coalesce((select jsonb_agg(to_jsonb(g) order by entry_type,kind,level) from groups g),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(to_jsonb(a) order by day,entry_type,kind,level) from activity a),'[]'::jsonb))
  into dashboard_payload;
  return dashboard_payload;
end; $$;
