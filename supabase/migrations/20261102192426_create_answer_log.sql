-- 1問につき1件の回答結果。再送時は同じUUIDを使い、既存行を更新しない。
create table public.answer_log (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  word_id uuid not null references public.word(id) on delete restrict,
  question_type text not null,
  selected_word_id uuid references public.word(id) on delete restrict,
  result text not null,
  response_ms integer not null,
  time_limit_ms integer not null,
  answered_at timestamptz not null,
  received_at timestamptz not null default clock_timestamp(),
  constraint answer_log_question_type check (question_type in ('meaning', 'reading')),
  constraint answer_log_result check (result in ('correct', 'incorrect', 'timeout')),
  constraint answer_log_response_nonnegative check (response_ms >= 0),
  constraint answer_log_time_limit_positive check (time_limit_ms > 0),
  constraint answer_log_result_consistent check (
    (result = 'correct' and selected_word_id is not null and selected_word_id = word_id and response_ms < time_limit_ms)
    or (result = 'incorrect' and selected_word_id is not null and selected_word_id <> word_id and response_ms < time_limit_ms)
    or (result = 'timeout' and selected_word_id is null and response_ms = time_limit_ms)
  )
);

comment on table public.answer_log is '回答と時間切れの追記専用ログ。UUIDによる再送の重複排除。';
comment on column public.answer_log.response_ms is '入力可能になってからの有効経過時間（ミリ秒）。時間切れ時は制限時間。';
comment on column public.answer_log.time_limit_ms is 'その問題に適用された制限時間（ミリ秒）。';
comment on column public.answer_log.answered_at is 'ブラウザーで回答または時間切れを確定した日時。';
comment on column public.answer_log.received_at is 'DBでの初回受信日時。一般クライアントからの指定は禁止。';

create index answer_log_recent_idx
  on public.answer_log(user_id, word_id, question_type, answered_at desc, id desc);
create index answer_log_word_idx on public.answer_log(word_id);
create index answer_log_selected_word_idx on public.answer_log(selected_word_id)
  where selected_word_id is not null;

alter table public.answer_log enable row level security;
revoke all on table public.answer_log from anon, authenticated;
grant select on table public.answer_log to authenticated;
grant insert (id, user_id, word_id, question_type, selected_word_id, result, response_ms, time_limit_ms, answered_at)
  on public.answer_log to authenticated;
grant all on table public.answer_log to service_role;

create policy answer_log_owner_read on public.answer_log
  for select to authenticated using ((select auth.uid()) = user_id);
create policy answer_log_owner_insert on public.answer_log
  for insert to authenticated with check ((select auth.uid()) = user_id);
