-- Isolated fixtures only. All changes are rolled back.
begin;
select set_config('test.owner',gen_random_uuid()::text,true),
       set_config('test.other',gen_random_uuid()::text,true),
       set_config('test.personal',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.other')::uuid);
insert into public.personal_word(id,user_id,term,kana,meaning_ko,has_kanji,difficulty)
values(current_setting('test.personal')::uuid,current_setting('test.owner')::uuid,'検証%_','けんしょう','검증',true,6);
insert into public.answer_log(id,user_id,personal_word_id,question_type,result,response_ms,time_limit_ms,answered_at)
values(gen_random_uuid(),current_setting('test.owner')::uuid,current_setting('test.personal')::uuid,'meaning','timeout',10000,10000,now());
-- A selected personal distractor also references the parent. Unrelated answers
-- must survive the cascade, even for the same learner.
insert into public.answer_log(id,user_id,word_id,selected_personal_word_id,question_type,result,response_ms,time_limit_ms,answered_at)
select gen_random_uuid(),current_setting('test.owner')::uuid,id,current_setting('test.personal')::uuid,'meaning','incorrect',1000,10000,now()
from public.word where deleted_at is null limit 1;
insert into public.answer_log(id,user_id,word_id,question_type,result,response_ms,time_limit_ms,answered_at)
select gen_random_uuid(),current_setting('test.owner')::uuid,id,'meaning','timeout',10000,10000,now()
from public.word where deleted_at is null limit 1;
insert into public.word_learning_state(user_id,personal_word_id,question_type,card,due_at,last_review_at,last_result,last_answer_id,model_version)
values(current_setting('test.owner')::uuid,current_setting('test.personal')::uuid,'meaning','{}',now(),now(),'timeout',gen_random_uuid(),'test');
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.personal_word where id=current_setting('test.personal')::uuid) then raise exception 'cross-owner read'; end if;
  update public.personal_word set meaning_ko='intrusion' where id=current_setting('test.personal')::uuid;
  if found then raise exception 'cross-owner update'; end if;
  delete from public.personal_word where id=current_setting('test.personal')::uuid;
  if found then raise exception 'cross-owner delete'; end if;
  begin
    insert into public.personal_word(user_id,term,kana,meaning_ko,has_kanji)
    values(current_setting('test.owner')::uuid,'侵入','しんにゅう','침입',true);
    raise exception 'cross-owner insert allowed';
  exception when insufficient_privilege then null; end;
  if (public.personal_word_list('')->>'total')::int<>0 then raise exception 'list leaked words'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$ declare result jsonb; begin
  result:=public.personal_word_list('%_',999);
  if (result->>'total')::int<>1 or (result->>'page')::int<>1 then raise exception 'literal search/page clamp'; end if;
  update public.personal_word set meaning_ko='수정 검증' where id=current_setting('test.personal')::uuid;
  if not found then raise exception 'owner edit blocked'; end if;
  if not exists(select 1 from public.answer_log where personal_word_id=current_setting('test.personal')::uuid) then raise exception 'edit lost history'; end if;
  if not exists(select 1 from public.word_learning_state where personal_word_id=current_setting('test.personal')::uuid) then raise exception 'edit lost FSRS'; end if;
  begin
    insert into public.personal_word(term,kana,meaning_ko,has_kanji) values('<script>','かな','검증',false);
    raise exception 'markup accepted';
  exception when check_violation then null; end;
  begin
    update public.personal_word set note=chr(8238)||'spoof' where id=current_setting('test.personal')::uuid;
    raise exception 'bidi override accepted';
  exception when check_violation then null; end;
  begin
    update public.personal_word set kana='123' where id=current_setting('test.personal')::uuid;
    raise exception 'invalid kana accepted';
  exception when check_violation then null; end;
  begin
    update public.personal_word set meaning_ko=repeat('가',1001) where id=current_setting('test.personal')::uuid;
    raise exception 'unbounded meaning accepted';
  exception when check_violation then null; end;
  if (public.personal_word_list($attack$'); DROP TABLE public.personal_word; --$attack$)->>'total')::int<>0 then raise exception 'literal injection search'; end if;
  delete from public.personal_word where id=current_setting('test.personal')::uuid;
  if not found then raise exception 'owner delete blocked'; end if;
  if (public.personal_word_list('')->>'total')::int<>0 then raise exception 'deleted word listed'; end if;
  if jsonb_array_length(public.personal_game_bootstrap()->'words')<>0 then raise exception 'deleted word in training'; end if;
  if exists(select 1 from public.personal_word where id=current_setting('test.personal')::uuid) then raise exception 'word retained'; end if;
  if exists(select 1 from public.answer_log where personal_word_id=current_setting('test.personal')::uuid) then raise exception 'history retained'; end if;
  if exists(select 1 from public.answer_log where selected_personal_word_id=current_setting('test.personal')::uuid) then raise exception 'selected reference retained'; end if;
  if (select count(*) from public.answer_log where user_id=current_setting('test.owner')::uuid)<>1 then raise exception 'unrelated answer lost'; end if;
  if exists(select 1 from public.word_learning_state where personal_word_id=current_setting('test.personal')::uuid) then raise exception 'FSRS retained'; end if;
  insert into public.personal_word(term,kana,meaning_ko,has_kanji,difficulty) values('検証%_','けんしょう','다시 추가',true,6);
  if (public.personal_word_list('')->>'total')::int<>1 then raise exception 're-add failed'; end if;
end $$;
reset role;
rollback;
