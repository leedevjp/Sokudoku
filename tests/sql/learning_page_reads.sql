-- Run as postgres against a migrated database. Fixtures are always rolled back.
begin;
select set_config('test.owner',gen_random_uuid()::text,true),
       set_config('test.other',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.other')::uuid);
insert into public.personal_word(user_id,term,kana,meaning_ko,pronunciation_ko,hanja_reading,has_kanji,difficulty,created_at)
select current_setting('test.owner')::uuid,'速度検証'||lpad(i::text,2,'0'),
  case when i%2=0 then 'あ' else 'か' end,'검증%_검색','검색발음','검증한자',true,i%11,now()-i*interval '1 minute'
from generate_series(1,25) i;
insert into public.personal_word(user_id,term,kana,meaning_ko,has_kanji,difficulty,deleted_at)
values(current_setting('test.owner')::uuid,'削除済み','さくじょずみ','삭제됨',true,6,now());
insert into public.personal_word(user_id,term,kana,meaning_ko,has_kanji,difficulty)
select current_setting('test.owner')::uuid,term,kana,meaning_ko,has_kanji,difficulty
from public.word where deleted_at is null and difficulty>=0 order by id limit 1;
insert into public.answer_log(id,user_id,word_id,question_type,result,response_ms,time_limit_ms,answered_at)
select gen_random_uuid(),current_setting('test.owner')::uuid,id,'meaning','timeout',10000,10000,now()
from public.word where deleted_at is null and difficulty>=0 order by id limit 1;
insert into public.answer_log(id,user_id,personal_word_id,question_type,result,response_ms,time_limit_ms,answered_at)
select gen_random_uuid(),user_id,id,'meaning','timeout',10000,10000,now()-interval '1 second'
from public.personal_word where user_id=current_setting('test.owner')::uuid and term in ('速度検証01','削除済み');
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
set local role authenticated;
do $$ declare result jsonb; expected jsonb; actual jsonb; sort text; ordering text; stage text; n int; begin
  result:=public.personal_word_page('%_',999);
  if (result->>'total')::int<>25 or (result->>'page')::int<>2 or jsonb_array_length(result->'words')<>5 then
    raise exception 'literal search or page clamp changed'; end if;
  if (result->>'all_total')::int<>26 then raise exception 'deleted words counted'; end if;
  if (public.personal_word_page('검색발음')->>'total')::int<>25 or
     (public.personal_word_page('검증한자')->>'total')::int<>25 then raise exception 'pronunciation/hanja search lost'; end if;
  foreach stage in array array['all','1','2','3','4','5','10'] loop
    select count(*) into n from public.personal_word where user_id=auth.uid() and deleted_at is null
      and (case when stage='all' then true when stage='10' then difficulty=10
        else difficulty between (stage::int-1)*2 and (stage::int-1)*2+1 end);
    if (public.personal_word_page('',1,stage)->>'total')::int<>n then raise exception 'stage % mismatch',stage; end if;
  end loop;
  foreach sort in array array['recent','oldest','reading','easy','hard'] loop
    ordering:=case sort when 'recent' then 'created_at desc,id desc' when 'oldest' then 'created_at asc,id asc'
      when 'reading' then 'kana asc,created_at desc,id desc' when 'easy' then 'difficulty asc,created_at desc,id desc'
      else 'difficulty desc,created_at desc,id desc' end;
    execute 'select jsonb_agg(id) from (select id from public.personal_word where user_id=auth.uid() and deleted_at is null order by '||ordering||' limit 20) s' into expected;
    select jsonb_agg(w->'id' order by ord) into actual
      from jsonb_array_elements(public.personal_word_page('',1,'all',sort)->'words') with ordinality t(w,ord);
    if actual<>expected then raise exception 'sort % mismatch',sort; end if;
  end loop;
  result:=public.notebook_page();
  if jsonb_array_length(result->'words')<>2 then raise exception 'mistakes missing or deleted mistake visible'; end if;
  if not (result->'words'->0->>'in_personal')::bool or
     result->'words'->0->'personal_entry'->>'id' is null or
     not (result->'words'->0->>'can_add_personal')::bool then raise exception 'common membership enrichment changed'; end if;
  if result->'words'->1->>'source'<>'personal' or
     (result->'words'->1->>'can_add_personal')::bool then raise exception 'personal source changed'; end if;
  begin perform public.personal_word_page('',1,'invalid'); raise exception 'invalid stage accepted';
    exception when invalid_parameter_value then null; end;
  begin perform public.personal_word_page('',1,'all','invalid'); raise exception 'invalid sort accepted';
    exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$ begin
  if (public.personal_word_page()->>'all_total')::int<>0 or
     jsonb_array_length(public.notebook_page()->'words')<>0 then raise exception 'cross-owner data leak'; end if;
  if has_function_privilege('anon','public.notebook_page()','execute') or
     has_function_privilege('anon','public.personal_word_page(text,integer,text,text)','execute') then
    raise exception 'anonymous execution granted'; end if;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  begin perform public.personal_word_page(); raise exception 'missing identity accepted';
    exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'learning read regression checks passed' as result;
