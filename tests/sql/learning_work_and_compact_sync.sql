begin;
select set_config('test.work_actor',gen_random_uuid()::text,true),
  set_config('test.work_other',gen_random_uuid()::text,true),
  set_config('test.work_word',gen_random_uuid()::text,true),
  set_config('test.work_untouched',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.work_actor')::uuid),(current_setting('test.work_other')::uuid);
insert into public.personal_word(id,user_id,term,kana,meaning_ko,has_kanji,difficulty)
values(current_setting('test.work_word')::uuid,current_setting('test.work_actor')::uuid,'検証甲','けんしょうこう','검증 갑',true,2),
  (current_setting('test.work_untouched')::uuid,current_setting('test.work_actor')::uuid,'検証乙','けんしょうおつ','검증 을',true,3);
insert into public.word_learning_state(user_id,personal_word_id,question_type,card,due_at,last_review_at,last_result,last_answer_id,model_version)
select current_setting('test.work_actor')::uuid,id,'meaning','{}'::jsonb,now(),now(),'correct',gen_random_uuid(),'fixture'
from public.personal_word where user_id=current_setting('test.work_actor')::uuid;
insert into public.answer_log(id,user_id,personal_word_id,question_type,result,response_ms,time_limit_ms,answered_at)
values(gen_random_uuid(),current_setting('test.work_actor')::uuid,current_setting('test.work_word')::uuid,'meaning','timeout',10000,10000,now());
-- Only synthetic projection rows. No vocabulary or existing records change.
insert into public.sync_changes(scope,dataset,record_key,version,deleted,payload) values
('global','distractors','zzzz-work-approved-'||current_setting('test.work_actor'),1,false,
  jsonb_build_object('target_word_id','target','candidate_source','word','candidate_id','candidate','status','approved','reason','private review metadata')),
('global','distractors','zzzz-work-rejected-'||current_setting('test.work_actor'),1,false,
  jsonb_build_object('target_word_id','target','candidate_source','extra','candidate_id','rejected','status','rejected'));
do $$ begin
 if has_function_privilege('anon','public.learning_work()','execute') or
   has_function_privilege('anon','public.sync_pull_compact(jsonb)','execute') then raise exception 'anonymous RPC grant'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.work_actor'),true);
do $$
declare w jsonb; original jsonb; compact jsonb; input jsonb; e jsonb;
begin
  w:=public.learning_work();
  if w->'events'<>public.learning_history(true) then raise exception 'event inputs changed'; end if;
  if jsonb_array_length(w->'words')<>1 then raise exception 'untouched cards loaded'; end if;
  if jsonb_array_length(public.learning_snapshot()->'words')<>2 then raise exception 'full snapshot changed'; end if;
  if w->'words'->0->>'word_ref'<>current_setting('test.work_word') then raise exception 'wrong card'; end if;
  input:=jsonb_build_object('$dataset','distractors','$after',jsonb_build_array('1','zzza'));
  original:=public.sync_pull(input); compact:=public.sync_pull_compact(input);
  if compact->'after' is distinct from original->'after' or compact->'versions'<>original->'versions' then raise exception 'cursor changed'; end if;
  select value into e from jsonb_array_elements(compact->'changes') where value->>'key'='zzzz-work-approved-'||current_setting('test.work_actor');
  if e is null or e->'value'<>'["target","word","candidate"]'::jsonb then raise exception 'compact payload incorrect'; end if;
  select value into e from jsonb_array_elements(compact->'changes') where value->>'key'='zzzz-work-rejected-'||current_setting('test.work_actor');
  if e is null or not (e->>'deleted')::boolean or e->'value'<>'null'::jsonb then raise exception 'revocation lost'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.work_other'),true);
do $$ begin
 if public.learning_work()->'events'<>'[]'::jsonb or public.learning_work()->'words'<>'[]'::jsonb then raise exception 'foreign data exposed'; end if;
end $$;
rollback;
