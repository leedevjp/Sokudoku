-- 単語の原本。学習者は参照のみ、編集は管理用接続から行う。
create table public.word (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  kana text not null,
  hanja_reading text,
  meaning_ko text not null,
  has_kanji boolean not null,
  difficulty smallint not null default 3,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint word_term_not_blank check (length(btrim(term)) > 0 and term = btrim(term)),
  constraint word_kana_not_blank check (length(btrim(kana)) > 0 and kana = btrim(kana)),
  constraint word_meaning_ko_not_blank check (length(btrim(meaning_ko)) > 0),
  constraint word_hanja_reading_not_blank check (hanja_reading is null or length(btrim(hanja_reading)) > 0),
  constraint word_difficulty_range check (difficulty between 0 and 10),
  constraint word_term_kana_key unique (term, kana)
);

comment on table public.word is '日本語の表記・読み・韓国語の意味。削除はdeleted_atによる論理削除。';
comment on column public.word.has_kanji is '表記に漢字が含まれるか。trueの単語は読み問題の対象。';
comment on column public.word.hanja_reading is '韓国漢字音。例: 実装 → 실장。該当しない場合はNULL。';
comment on column public.word.difficulty is '0–1: N5、2–3: N4、4–5: N3、6–7: N2、8–9: N1、10: 試験範囲外の生活・専門・固有名詞など。独自の目安。';

create function public.word_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- トリガー専用。Data APIから直接実行させない。
revoke all on function public.word_set_updated_at() from public, anon, authenticated;
create trigger word_set_updated_at
before update on public.word
for each row execute function public.word_set_updated_at();

alter table public.word enable row level security;
revoke all on table public.word from anon, authenticated;
grant select on table public.word to authenticated;
grant all on table public.word to service_role;

-- 削除マーカーもキャッシュ同期に必要なため参照可能。出題側はdeleted_atを確認する。
create policy word_authenticated_read
on public.word for select to authenticated
using (true);
