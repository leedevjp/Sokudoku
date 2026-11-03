-- 個人単語は共通wordと独立した所有権・ライフサイクルを持つ。
create table public.personal_word (
  like public.word including defaults including constraints,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (id),
  unique (user_id, term, kana),
  unique (user_id, id)
);
create trigger personal_word_set_updated_at before insert or update on public.personal_word
for each row execute function public.word_set_updated_at();
alter table public.personal_word enable row level security;
revoke all on public.personal_word from anon, authenticated;
grant select, insert, update, delete on public.personal_word to authenticated;
grant all on public.personal_word to service_role;
create policy personal_word_owner_read on public.personal_word for select to authenticated using ((select auth.uid()) = user_id);
create policy personal_word_owner_insert on public.personal_word for insert to authenticated with check ((select auth.uid()) = user_id);
create policy personal_word_owner_update on public.personal_word for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy personal_word_owner_delete on public.personal_word for delete to authenticated using ((select auth.uid()) = user_id);
comment on table public.personal_word is '利用者本人が管理する個人単語。共通wordとは独立。';

-- 共通・個人の回答を同じ追記専用ログに記録する。
alter table public.answer_log alter column word_id drop not null;
alter table public.answer_log add column personal_word_id uuid,
  add column selected_personal_word_id uuid,
  add constraint answer_log_personal_word_fkey foreign key (user_id, personal_word_id)
    references public.personal_word(user_id, id) on delete restrict,
  add constraint answer_log_selected_personal_word_fkey foreign key (user_id, selected_personal_word_id)
    references public.personal_word(user_id, id) on delete restrict,
  add constraint answer_log_one_question_source check (num_nonnulls(word_id, personal_word_id) = 1),
  add constraint answer_log_one_selection_source check (num_nonnulls(selected_word_id, selected_personal_word_id) <= 1);
alter table public.answer_log drop constraint answer_log_result_consistent;
alter table public.answer_log add constraint answer_log_result_consistent check (
  (result = 'correct' and coalesce(selected_word_id, selected_personal_word_id) is not null
    and coalesce(selected_word_id, selected_personal_word_id) = coalesce(word_id, personal_word_id)
    and response_ms < time_limit_ms)
  or (result = 'incorrect' and coalesce(selected_word_id, selected_personal_word_id) is not null
    and coalesce(selected_word_id, selected_personal_word_id) <> coalesce(word_id, personal_word_id)
    and response_ms < time_limit_ms)
  or (result = 'timeout' and selected_word_id is null and selected_personal_word_id is null and response_ms = time_limit_ms)
);
grant insert (personal_word_id, selected_personal_word_id) on public.answer_log to authenticated;
create index answer_log_personal_recent_idx on public.answer_log(user_id, personal_word_id, answered_at desc, id desc) where personal_word_id is not null;
create index answer_log_selected_personal_idx on public.answer_log(user_id, selected_personal_word_id) where selected_personal_word_id is not null;

create or replace view public.word_recent_stat with (security_invoker = true) as
select user_id, word_id, count(*)::integer as attempt_count,
  count(*) filter (where result = 'correct')::integer as correct_count,
  (count(*) filter (where result = 'correct'))::numeric / count(*) as accuracy,
  avg(response_ms) filter (where result = 'correct') as average_correct_response_ms,
  max(answered_at) as last_answered_at
from (
  select user_id, coalesce(word_id, personal_word_id) as word_id, result, response_ms, answered_at,
    row_number() over (partition by user_id, coalesce(word_id, personal_word_id) order by answered_at desc, id desc) as attempt_rank
  from public.answer_log
) ranked where attempt_rank <= 20 group by user_id, word_id;

-- 個人単語は物理削除も可能なので、所有者の小さな集合を毎回置換する。
create function public.personal_game_bootstrap()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'synced_at', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'reset', true,
    'words', coalesce((select jsonb_agg(w order by w.id) from public.personal_word w where w.user_id = (select auth.uid()) and w.deleted_at is null), '[]'::jsonb),
    'stats', coalesce((select jsonb_agg(s) from public.word_recent_stat s where s.word_id in (select id from public.personal_word where user_id = (select auth.uid()))), '[]'::jsonb)
  );
$$;
revoke all on function public.personal_game_bootstrap() from public, anon;
grant execute on function public.personal_game_bootstrap() to authenticated;
