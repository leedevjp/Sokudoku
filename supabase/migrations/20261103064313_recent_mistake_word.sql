-- 誤答・時間切れだけの小さな索引。正答や別利用者の履歴を走査しない。
create index answer_log_mistake_idx
  on public.answer_log(user_id, word_id, personal_word_id, answered_at desc)
  where result in ('incorrect', 'timeout');

-- 全履歴をブラウザーに転送せず、異なる単語を最大100件だけ返す。
create function public.recent_mistake_word()
returns table (
  id uuid, source text, term text, kana text, hanja_reading text,
  meaning_ko text, note text, difficulty integer, last_incorrect_at timestamptz
)
language sql stable security invoker set search_path = ''
as $$
  with recent as (
    select a.word_id, a.personal_word_id, max(a.answered_at) as last_incorrect_at
    from public.answer_log a
    where a.user_id = (select auth.uid()) and a.result in ('incorrect', 'timeout')
    group by a.word_id, a.personal_word_id
  ), visible_word as (
    select w.id, 'word'::text as source, w.term, w.kana, w.hanja_reading,
      w.meaning_ko, w.note, w.difficulty::integer, r.last_incorrect_at
    from recent r join public.word w on w.id = r.word_id
    where w.deleted_at is null
    union all
    select w.id, 'personal'::text as source, w.term, w.kana, w.hanja_reading,
      w.meaning_ko, w.note, w.difficulty::integer, r.last_incorrect_at
    from recent r join public.personal_word w on w.id = r.personal_word_id
    where w.user_id = (select auth.uid()) and w.deleted_at is null
  )
  select * from visible_word order by last_incorrect_at desc, source, id limit 100;
$$;
revoke all on function public.recent_mistake_word() from public, anon;
grant execute on function public.recent_mistake_word() to authenticated;
comment on function public.recent_mistake_word() is '本人の最近の誤答・時間切れ単語100件。画面内のページ移動は追加取得しない。';
