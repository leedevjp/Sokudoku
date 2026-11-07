-- Check extra selections under real authenticated column grants and RLS.
-- Everything, including the temporary user, is rolled back.
begin;
select set_config('test.meaning_reader',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.meaning_reader')::uuid);
select set_config('request.jwt.claim.sub',current_setting('test.meaning_reader'),true);
set local role authenticated;
do $test$
declare target uuid; extra uuid; answer_id uuid:=gen_random_uuid(); bank jsonb;
begin
  bank:=public.game_meaning_bank(array[0,1,2,3,4,5,6,7,8,9]);
  if exists(select 1 from jsonb_each(bank) x where jsonb_array_length(x.value) not between 6 and 20)
    then raise exception 'invalid candidate count'; end if;
  if exists(select 1 from public.meaning_distractor where status<>'approved')
    then raise exception 'unapproved candidates exposed'; end if;
  select target_word_id,candidate_id into target,extra
    from public.meaning_distractor where candidate_source='extra' limit 1;
  if target is null then raise exception 'approved fixture required'; end if;
  insert into public.answer_log(id,user_id,word_id,question_type,selected_extra_meaning_choice_id,result,response_ms,time_limit_ms,answered_at,mode)
    values(answer_id,auth.uid(),target,'meaning',extra,'incorrect',500,10000,now(),'exam')
    on conflict(id) do nothing;
  insert into public.answer_log(id,user_id,word_id,question_type,selected_extra_meaning_choice_id,result,response_ms,time_limit_ms,answered_at,mode)
    values(answer_id,auth.uid(),target,'meaning',extra,'incorrect',500,10000,now(),'exam')
    on conflict(id) do nothing;
  if (select count(*) from public.answer_log where id=answer_id)<>1
    then raise exception 'extra answer save/retry failed'; end if;
  begin
    insert into public.answer_log(id,user_id,word_id,question_type,selected_extra_meaning_choice_id,result,response_ms,time_limit_ms,answered_at)
      values(gen_random_uuid(),auth.uid(),target,'reading',extra,'incorrect',500,10000,now());
    raise exception 'extra reading answer accepted';
  exception when check_violation then null; end;
  begin
    insert into public.answer_log(id,user_id,word_id,question_type,selected_word_id,selected_extra_meaning_choice_id,result,response_ms,time_limit_ms,answered_at)
      values(gen_random_uuid(),auth.uid(),target,'meaning',target,extra,'incorrect',500,10000,now());
    raise exception 'multiple selection sources accepted';
  exception when check_violation then null; end;
end $test$;
rollback;
select 'meaning bank RLS, extra answer insertion, idempotent retries and constraints passed' result;
