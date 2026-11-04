-- Standalone transactional check; creates no persistent users or answers.
begin;
select set_config('test.user', gen_random_uuid()::text, true),
       set_config('test.word', gen_random_uuid()::text, true);
insert into auth.users(id) values (current_setting('test.user')::uuid);
insert into public.word(id,term,kana,meaning_ko,has_kanji)
values (current_setting('test.word')::uuid,'検証','けんしょう','검증',true);
select set_config('request.jwt.claim.sub', current_setting('test.user'), true);
set local role authenticated;
insert into public.answer_log(id,user_id,word_id,question_type,selected_word_id,result,response_ms,time_limit_ms,answered_at,mode)
select gen_random_uuid(),auth.uid(),current_setting('test.word')::uuid,'meaning',current_setting('test.word')::uuid,'correct',500,10000,now(),m
from unnest(array['exploration','review',null]::text[]) m;
do $$ begin
  if (select count(*) from public.answer_log) <> 3 then
    raise exception 'Missing mode or legacy answer';
  end if;
  begin
    insert into public.answer_log(id,user_id,word_id,question_type,selected_word_id,result,response_ms,time_limit_ms,answered_at,mode)
    values (gen_random_uuid(),auth.uid(),current_setting('test.word')::uuid,'meaning',current_setting('test.word')::uuid,'correct',500,10000,now(),'invalid');
    raise exception 'Invalid mode accepted';
  exception when check_violation then null;
  end;
end $$;
rollback;
