-- Compare the optimized result with the original aggregate under RLS.
-- Includes unanswered words, state-only entries, kana, personal/deleted content,
-- separate meaning/reading history, three owners and three calendar zones.
begin;
select set_config('test.reader',gen_random_uuid()::text,true),
 set_config('test.other_reader',gen_random_uuid()::text,true),
 set_config('test.empty_reader',gen_random_uuid()::text,true),
 set_config('test.dashboard_word',gen_random_uuid()::text,true),
 set_config('test.dashboard_kana',gen_random_uuid()::text,true),
 set_config('test.dashboard_deleted',gen_random_uuid()::text,true),
 set_config('test.dashboard_personal',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.reader')::uuid),
 (current_setting('test.other_reader')::uuid),(current_setting('test.empty_reader')::uuid);
insert into public.word(id,term,kana,meaning_ko,has_kanji,difficulty,entry_type,deleted_at)
values(current_setting('test.dashboard_word')::uuid,'検証専用','けんしょうせんよう','검증',true,6,'word',null),
 (current_setting('test.dashboard_kana')::uuid,'検証かな','かな','가나 검증',false,-1,'hiragana',null),
 (current_setting('test.dashboard_deleted')::uuid,'検証削除','けんしょうさくじょ','삭제 검증',true,8,'word',now());
insert into public.personal_word(id,user_id,term,kana,meaning_ko,has_kanji,difficulty)
values(current_setting('test.dashboard_personal')::uuid,current_setting('test.reader')::uuid,'検証個人','けんしょうこじん','개인 검증',true,4);
insert into public.answer_log(id,user_id,word_id,question_type,result,response_ms,time_limit_ms,answered_at)
select gen_random_uuid(),current_setting('test.reader')::uuid,current_setting('test.dashboard_word')::uuid,
 k,'timeout',10000,10000,now()-interval '1 day' from (values('meaning'),('reading')) kinds(k);
insert into public.answer_log(id,user_id,personal_word_id,question_type,result,response_ms,time_limit_ms,answered_at)
values(gen_random_uuid(),current_setting('test.reader')::uuid,current_setting('test.dashboard_personal')::uuid,'meaning','timeout',10000,10000,now()-interval '10 days');
insert into public.answer_log(id,user_id,word_id,question_type,result,response_ms,time_limit_ms,answered_at)
values(gen_random_uuid(),current_setting('test.reader')::uuid,current_setting('test.dashboard_deleted')::uuid,'meaning','timeout',10000,10000,now());
insert into public.word_learning_state(user_id,word_id,question_type,card,due_at,last_review_at,last_result,last_answer_id,model_version)
values(current_setting('test.reader')::uuid,current_setting('test.dashboard_word')::uuid,'meaning','{"stability":7}',now()+interval '1 day',now(),'correct',gen_random_uuid(),'fixture'),
 (current_setting('test.reader')::uuid,current_setting('test.dashboard_kana')::uuid,'meaning','{"stability":21}',now()-interval '1 day',now(),'correct',gen_random_uuid(),'fixture');
insert into public.word_learning_state(user_id,personal_word_id,question_type,card,due_at,last_review_at,last_result,last_answer_id,model_version)
values(current_setting('test.reader')::uuid,current_setting('test.dashboard_personal')::uuid,'reading','{}',now(),now(),'incorrect',gen_random_uuid(),'fixture');
set local role authenticated;
do $test$
declare actor uuid; p_timezone text; local_today date; expected jsonb; actual jsonb; old_payload jsonb; new_payload jsonb; projected jsonb; state_expected jsonb;
begin
 for actor in select x::uuid from unnest(array[current_setting('test.reader'),current_setting('test.other_reader'),current_setting('test.empty_reader')]) x loop
  perform set_config('request.jwt.claim.sub',actor::text,true);
  foreach p_timezone in array array['Asia/Tokyo','UTC','America/Los_Angeles'] loop
   local_today:=(now() at time zone p_timezone)::date;
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
   into expected;
   actual:=public.learning_dashboard(p_timezone);
   if (actual-'updated_at') is distinct from (expected-'updated_at') then
    raise exception 'dashboard changed for owner % / zone %',actor,p_timezone;
   end if;
  end loop;
  old_payload:=public.game_sync(null);
  new_payload:=public.game_catalog_sync(null,false);
  select coalesce(jsonb_agg(w-'created_at'-'updated_at'-'note' order by w->>'id'),'[]'::jsonb)
    into projected from jsonb_array_elements(old_payload->'words') w;
  if new_payload->'words' is distinct from projected or new_payload->'stats'<>'[]'::jsonb then
   raise exception 'common catalog content changed';
  end if;
  old_payload:=public.personal_game_bootstrap();
  new_payload:=public.game_catalog_sync(null,true);
  select coalesce(jsonb_agg(w-'user_id'-'created_at'-'updated_at'-'note' order by w->>'id'),'[]'::jsonb)
    into projected from jsonb_array_elements(old_payload->'words') w;
  if new_payload->'words' is distinct from projected then raise exception 'personal catalog content changed'; end if;
  select jsonb_build_object(
    'learner',(select to_jsonb(s)-'user_id'-'updated_at' from public.learner_state s where user_id=actor),
    'words',coalesce((select jsonb_agg(to_jsonb(s)-'user_id'-'updated_at') from public.word_learning_state s where user_id=actor),'[]'::jsonb)
  ) into state_expected;
  if public.learning_snapshot() is distinct from state_expected then raise exception 'FSRS state changed'; end if;
 end loop;
 perform set_config('request.jwt.claim.sub',current_setting('test.reader'),true);
 old_payload:=public.game_sync(transaction_timestamp()-interval '1 minute');
 new_payload:=public.game_catalog_sync(transaction_timestamp()-interval '1 minute',false);
 select coalesce(jsonb_agg(w-'created_at'-'updated_at'-'note' order by w->>'id'),'[]'::jsonb)
   into projected from jsonb_array_elements(old_payload->'words') w;
 if new_payload->'words' is distinct from projected then raise exception 'incremental tombstone lost'; end if;
 if not (public.game_catalog_sync(now()+interval '1 day',false)->>'reset')::boolean then raise exception 'future cursor not reset'; end if;
 begin
  perform public.learning_dashboard('not/a/real/timezone');
  raise exception 'invalid timezone accepted';
 exception when invalid_parameter_value then null; end;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.game_catalog_sync();
  raise exception 'unauthenticated catalog accepted';
 exception when insufficient_privilege then null; end;
end $test$;
reset role;
rollback;

