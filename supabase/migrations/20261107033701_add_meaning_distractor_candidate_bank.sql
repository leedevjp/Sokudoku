create table public.extra_meaning_choice (
  id uuid primary key default gen_random_uuid(),
  label text not null check (label = btrim(label) and char_length(label) between 1 and 120),
  normalized_label text generated always as (normalize(regexp_replace(btrim(label), '[[:space:]]+', ' ', 'g'), NFC)) stored,
  created_at timestamptz not null default now(),
  unique (normalized_label)
);
create table public.meaning_distractor (
  target_word_id uuid not null references public.word(id) on delete cascade,
  candidate_id uuid not null,
  candidate_source text not null check (candidate_source in ('word','extra')),
  question_type text not null default 'meaning' check (question_type = 'meaning'),
  rank smallint not null check (rank between 1 and 20),
  reason text not null,
  status text not null default 'draft' check (status in ('draft','approved','rejected')),
  batch_id text not null,
  created_at timestamptz not null default now(),
  primary key (target_word_id, candidate_source, candidate_id),
  unique (target_word_id, rank),
  check (candidate_source <> 'word' or candidate_id <> target_word_id)
);
create index meaning_distractor_candidate_idx on public.meaning_distractor(candidate_source,candidate_id);
create index meaning_distractor_batch_idx on public.meaning_distractor(batch_id);
comment on table public.extra_meaning_choice is 'Shared Korean distractor labels only; never scheduled as learning words.';
comment on column public.meaning_distractor.candidate_id is 'Polymorphic reference selected by candidate_source (word/extra); importer and audit validate existence. Intentionally no candidate FK.';
comment on table public.meaning_distractor is 'Curated meaning-only candidate bank, not fixed four-choice sets. Draft pilot rows are not exposed to learners.';
alter table public.extra_meaning_choice enable row level security;
alter table public.meaning_distractor enable row level security;
revoke all on public.extra_meaning_choice, public.meaning_distractor from public, anon, authenticated;
grant select on public.extra_meaning_choice, public.meaning_distractor to authenticated;
grant all on public.extra_meaning_choice, public.meaning_distractor to service_role;
create policy extra_meaning_choice_read on public.extra_meaning_choice for select to authenticated using (true);
create policy meaning_distractor_read_approved on public.meaning_distractor for select to authenticated using (status = 'approved');
