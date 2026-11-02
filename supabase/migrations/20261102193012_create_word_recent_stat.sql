-- 問題形式を合算し、回答履歴が存在するユーザー×単語だけを集計する。
-- 未学習の単語に対する行は作成しない。
drop index public.answer_log_recent_idx;
create index answer_log_recent_idx
  on public.answer_log(user_id, word_id, answered_at desc, id desc);

create view public.word_recent_stat
with (security_invoker = true)
as
select
  user_id,
  word_id,
  count(*)::integer as attempt_count,
  count(*) filter (where result = 'correct')::integer as correct_count,
  (count(*) filter (where result = 'correct'))::numeric / count(*) as accuracy,
  avg(response_ms) filter (where result = 'correct') as average_correct_response_ms,
  max(answered_at) as last_answered_at
from (
  select
    user_id,
    word_id,
    result,
    response_ms,
    answered_at,
    row_number() over (
      partition by user_id, word_id
      order by answered_at desc, id desc
    ) as attempt_rank
  from public.answer_log
) ranked
where attempt_rank <= 20
group by user_id, word_id;

comment on view public.word_recent_stat is '履歴があるユーザー×単語の直近最大20試行。意味・読みを合算。時間切れを試行に含め、未学習の行は作成しない。通常VIEWのためREFRESH不要。';
comment on column public.word_recent_stat.accuracy is '正答数÷試行数（0〜1）。';
comment on column public.word_recent_stat.average_correct_response_ms is '直近20試行のうち正答した試行の平均時間。正答がなければNULL。';

revoke all on public.word_recent_stat from anon, authenticated;
grant select on public.word_recent_stat to authenticated, service_role;
