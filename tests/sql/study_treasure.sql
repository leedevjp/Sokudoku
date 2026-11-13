-- Synthetic users and words only; no existing user data modified. Always rollback.
begin;
select set_config('test.owner',gen_random_uuid()::text,true),set_config('test.other',gen_random_uuid()::text,true),set_config('test.word',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.other')::uuid);
insert into public.personal_word(id,user_id,term,kana,meaning_ko,has_kanji,difficulty) values(current_setting('test.word')::uuid,current_setting('test.owner')::uuid,'検証','けんしょう','검증',true,6);
insert into public.answer_log(id,user_id,personal_word_id,question_type,result,response_ms,time_limit_ms,answered_at)
values(gen_random_uuid(),current_setting('test.owner')::uuid,current_setting('test.word')::uuid,'meaning','timeout',10000,10000,now());
insert into public.answer_log(id,user_id,personal_word_id,selected_personal_word_id,question_type,result,response_ms,time_limit_ms,answered_at)
select gen_random_uuid(),current_setting('test.owner')::uuid,current_setting('test.word')::uuid,current_setting('test.word')::uuid,'meaning','correct',1000,10000,now() from generate_series(1,4);
do $$ begin
 if (select solved from public.treasure_progress where user_id=current_setting('test.owner')::uuid)<>4 then raise exception 'timeout counted'; end if;
 if exists(select 1 from public.study_chest where user_id=current_setting('test.owner')::uuid) then raise exception 'early award'; end if;
end $$;
insert into public.answer_log(id,user_id,personal_word_id,selected_personal_word_id,question_type,result,response_ms,time_limit_ms,answered_at)
values(gen_random_uuid(),current_setting('test.owner')::uuid,current_setting('test.word')::uuid,current_setting('test.word')::uuid,'meaning','correct',1000,10000,now());
-- Exact UUID replay must not trigger another reward or progress increment.
insert into public.answer_log(id,user_id,personal_word_id,selected_personal_word_id,question_type,result,response_ms,time_limit_ms,answered_at) select id,user_id,personal_word_id,selected_personal_word_id,question_type,result,response_ms,time_limit_ms,answered_at from public.answer_log where user_id=current_setting('test.owner')::uuid on conflict(id) do nothing;
do $$ begin
 if (select solved from public.treasure_progress where user_id=current_setting('test.owner')::uuid)<>5 then raise exception 'duplicate credited'; end if;
 if (select count(*) from public.study_chest where user_id=current_setting('test.owner')::uuid)<>1 then raise exception 'fifth answer missing'; end if;
end $$;
-- Wrong answers also count. Common selected word differs from the personal question.
insert into public.answer_log(id,user_id,personal_word_id,selected_word_id,question_type,result,response_ms,time_limit_ms,answered_at)
select gen_random_uuid(),current_setting('test.owner')::uuid,current_setting('test.word')::uuid,(select id from public.word where deleted_at is null limit 1),'meaning','incorrect',1000,10000,now() from generate_series(1,5);
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
set local role authenticated;
do $$ begin
 if (public.treasure_inventory()->>'pending_count')::int<>0 then raise exception 'inventory leak'; end if;
 begin
  insert into public.study_chest(user_id,ordinal) values(auth.uid(),1);
  raise exception 'direct mint allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('test.first',(select id::text from public.study_chest where user_id=current_setting('test.owner')::uuid order by ordinal limit 1),true),set_config('test.second',(select id::text from public.study_chest where user_id=current_setting('test.owner')::uuid order by ordinal desc limit 1),true);
set local role authenticated;
do $$ begin
 begin
  perform public.open_study_chest(current_setting('test.first')::uuid);
  raise exception 'cross owner opening allowed';
 exception when no_data_found then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$ declare a jsonb; b jsonb; begin
 if (public.treasure_inventory()->>'pending_count')::int<>2 then raise exception 'wrong answers not credited'; end if;
 begin
  perform public.open_study_chest(current_setting('test.second')::uuid);
  raise exception 'out of order allowed';
 exception when invalid_parameter_value then null; end;
 a:=public.open_study_chest(current_setting('test.first')::uuid);
 b:=public.open_study_chest(current_setting('test.first')::uuid);
 if a<>b or a->>'tier' not in ('common','rare','unique') then raise exception 'reroll or invalid tier'; end if;
 if (public.treasure_inventory()->>'pending_count')::int<>1 then raise exception 'incorrect consumption'; end if;
 begin
  update public.study_chest set tier='unique' where id=current_setting('test.first')::uuid;
  raise exception 'direct reroll allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from public.personal_word where id=current_setting('test.word')::uuid;
do $$ begin
 if (select solved from public.treasure_progress where user_id=current_setting('test.owner')::uuid)<>10 then raise exception 'progress lost on deletion'; end if;
 if (select count(*) from public.study_chest where user_id=current_setting('test.owner')::uuid)<>2 then raise exception 'rewards lost on deletion'; end if;
end $$;
select 'treasure regression passed' as result;
rollback;
