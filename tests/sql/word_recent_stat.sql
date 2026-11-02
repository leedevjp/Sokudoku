begin;
select set_config('test.user_a',gen_random_uuid()::text,true),
set_config('test.user_b',gen_random_uuid()::text,true),
set_config('test.word_a',gen_random_uuid()::text,true),
set_config('test.word_b',gen_random_uuid()::text,true),
set_config('test.word_unseen',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.user_a')::uuid),(current_setting('test.user_b')::uuid);
insert into public.word(id,term,kana,meaning_ko,has_kanji)
values(current_setting('test.word_a')::uuid,'__集計A__','__しゅうけいA__','검증',true),
(current_setting('test.word_b')::uuid,'__集計B__','__しゅうけいB__','검증',true),
(current_setting('test.word_unseen')::uuid,'__未学習__','__みがくしゅう__','미학습',true);
-- 同一時刻でもUUID順で25〜6番の20試行を採用。意味・読みは交互。
insert into public.answer_log(id,user_id,word_id,question_type,selected_word_id,result,response_ms,time_limit_ms,answered_at)
select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
current_setting('test.user_a')::uuid,current_setting('test.word_a')::uuid,
case when n%2=0 then 'meaning' else 'reading' end,
case when n%2=0 then current_setting('test.word_a')::uuid when n=7 then current_setting('test.word_b')::uuid else null end,
case when n%2=0 then 'correct' when n=7 then 'incorrect' else 'timeout' end,
case when n%2=0 or n=7 then n*100 else 3000 end,3000,'2026-01-01T00:00:00Z'
from generate_series(1,25) n;
insert into public.answer_log(id,user_id,word_id,question_type,result,response_ms,time_limit_ms,answered_at)
values(gen_random_uuid(),current_setting('test.user_a')::uuid,current_setting('test.word_b')::uuid,'meaning','timeout',3000,3000,'2026-01-02T00:00:00Z');
insert into public.answer_log(id,user_id,word_id,question_type,selected_word_id,result,response_ms,time_limit_ms,answered_at)
values(gen_random_uuid(),current_setting('test.user_b')::uuid,current_setting('test.word_a')::uuid,'meaning',current_setting('test.word_a')::uuid,'correct',42,3000,now());
select set_config('request.jwt.claim.sub',current_setting('test.user_a'),true);
set local role authenticated;
do $$ declare s record; begin
 if (select count(*) from public.word_recent_stat) <> 2 then raise exception 'unexpected row count'; end if;
 if exists(select 1 from public.word_recent_stat where word_id=current_setting('test.word_unseen')::uuid) then raise exception 'unseen row exists'; end if;
 select * into strict s from public.word_recent_stat where word_id=current_setting('test.word_a')::uuid;
 if s.attempt_count<>20 or s.correct_count<>10 or s.accuracy<>0.5 or s.average_correct_response_ms<>1500 then raise exception 'recent-20/type-combining/tie order failed: %',row_to_json(s); end if;
 if s.last_answered_at<>'2026-01-01T00:00:00Z'::timestamptz then raise exception 'last timestamp wrong'; end if;
 select * into strict s from public.word_recent_stat where word_id=current_setting('test.word_b')::uuid;
 if s.attempt_count<>1 or s.correct_count<>0 or s.accuracy<>0 or s.average_correct_response_ms is not null then raise exception 'all timeout stats wrong'; end if;
 if exists(select 1 from public.word_recent_stat where user_id<>current_setting('test.user_a')::uuid) then raise exception 'other user exposed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.user_b'),true);
set local role authenticated;
do $$ declare s record; begin
 if (select count(*) from public.word_recent_stat)<>1 then raise exception 'user B row count wrong'; end if;
 select * into strict s from public.word_recent_stat;
 if s.attempt_count<>1 or s.average_correct_response_ms<>42 then raise exception 'user isolation failed'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform user_id from public.word_recent_stat; raise exception 'anonymous view access allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: sparse rows, latest 20, combined types, tied timestamp ordering, timeouts, NULL correct average, user isolation and anon denial; fixtures rolled back' as verification;
