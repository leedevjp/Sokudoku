-- FSRS-7 state exists only for reviewed user/word/question-type combinations.
create table public.word_learning_state (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  word_id uuid references public.word(id) on delete restrict,
  personal_word_id uuid,
  source text generated always as (case when personal_word_id is null then 'word' else 'personal' end) stored,
  word_ref uuid generated always as (coalesce(word_id, personal_word_id)) stored,
  question_type text not null check (question_type in ('reading','meaning')),
  card jsonb not null check (jsonb_typeof(card) = 'object'),
  due_at timestamptz not null,
  last_review_at timestamptz not null,
  last_result text not null check (last_result in ('correct','incorrect','timeout')),
  last_answer_id uuid not null,
  model_version text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, source, word_ref, question_type),
  foreign key (user_id, personal_word_id) references public.personal_word(user_id,id) on delete restrict,
  check (num_nonnulls(word_id, personal_word_id) = 1)
);
create index word_learning_state_due_idx on public.word_learning_state(user_id,due_at);

-- One ability estimate per learner, independent of FSRS's word difficulty.
create table public.learner_state (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  ability double precision not null check (ability between 0 and 10),
  precision double precision not null check (precision > 0 and precision <= 1000),
  review_count integer not null check (review_count >= 0),
  last_answered_at timestamptz not null,
  last_answer_id uuid not null,
  revision bigint not null default 1 check (revision > 0),
  model_version text not null,
  updated_at timestamptz not null default now()
);
alter table public.word_learning_state enable row level security;
alter table public.learner_state enable row level security;
revoke all on public.word_learning_state, public.learner_state from anon, authenticated;
grant select, insert, update on public.word_learning_state, public.learner_state to authenticated;
grant all on public.word_learning_state, public.learner_state to service_role;
create policy word_learning_owner_read on public.word_learning_state for select to authenticated using ((select auth.uid())=user_id);
create policy word_learning_owner_insert on public.word_learning_state for insert to authenticated with check ((select auth.uid())=user_id);
create policy word_learning_owner_update on public.word_learning_state for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy learner_owner_read on public.learner_state for select to authenticated using ((select auth.uid())=user_id);
create policy learner_owner_insert on public.learner_state for insert to authenticated with check ((select auth.uid())=user_id);
create policy learner_owner_update on public.learner_state for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

-- Raw answers remain immutable. Only processing metadata can be updated.
alter table public.answer_log add column learning_processed_at timestamptz,
  add column learning_version text,
  add column learning_rating smallint generated always as (case when result='correct' then 3 else 1 end) stored;
grant update(learning_processed_at, learning_version) on public.answer_log to authenticated;
create policy answer_log_owner_processing on public.answer_log for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create index answer_log_learning_pending_idx on public.answer_log(user_id, answered_at, id) where learning_processed_at is null;

create function public.learning_snapshot() returns jsonb
language sql stable security invoker set search_path=''
as $$ select jsonb_build_object(
  'learner',(select to_jsonb(s) from public.learner_state s where s.user_id=(select auth.uid())),
  'words',coalesce((select jsonb_agg(s) from public.word_learning_state s where s.user_id=(select auth.uid())),'[]'::jsonb)
); $$;

-- Called only by the sync/bootstrap server, never once per in-game question.
create function public.learning_history(pending_only boolean default true) returns jsonb
language sql stable security invoker set search_path=''
as $$ select coalesce(jsonb_agg(e order by e.answered_at,e.id),'[]'::jsonb) from (
  select a.id, coalesce(a.word_id,a.personal_word_id) as word_id,
    case when a.personal_word_id is null then 'word' else 'personal' end as source,
    a.question_type,a.result,a.response_ms,a.time_limit_ms,a.answered_at,
    coalesce(w.difficulty,p.difficulty,0)::integer as difficulty
  from public.answer_log a
  left join public.word w on w.id=a.word_id
  left join public.personal_word p on p.id=a.personal_word_id and p.user_id=a.user_id
  where a.user_id=(select auth.uid()) and (not pending_only or a.learning_processed_at is null)
) e; $$;

-- Compare-and-swap revision serializes concurrent devices. State and processing
-- acknowledgements commit together; failed sync can safely replay the same UUIDs.
create function public.commit_learning(expected_revision bigint, learner jsonb, states jsonb, processed_ids uuid[])
returns boolean language plpgsql security invoker set search_path=''
as $$
declare actor uuid := auth.uid(); current_revision bigint; entry jsonb;
begin
  if actor is null then raise exception 'unauthorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 9173));
  select revision into current_revision from public.learner_state where user_id=actor;
  if coalesce(current_revision,0) <> expected_revision then return false; end if;
  insert into public.learner_state(user_id,ability,precision,review_count,last_answered_at,last_answer_id,revision,model_version)
  values(actor,(learner->>'ability')::double precision,(learner->>'precision')::double precision,
    (learner->>'review_count')::integer,(learner->>'last_answered_at')::timestamptz,
    (learner->>'last_answer_id')::uuid,expected_revision+1,learner->>'model_version')
  on conflict (user_id) do update set ability=excluded.ability,precision=excluded.precision,
    review_count=excluded.review_count,last_answered_at=excluded.last_answered_at,
    last_answer_id=excluded.last_answer_id,revision=excluded.revision,model_version=excluded.model_version,updated_at=now();
  for entry in select value from jsonb_array_elements(states) loop
    insert into public.word_learning_state(user_id,word_id,personal_word_id,question_type,card,due_at,last_review_at,last_result,last_answer_id,model_version)
    values(actor,(entry->>'word_id')::uuid,(entry->>'personal_word_id')::uuid,entry->>'question_type',entry->'card',
      (entry->>'due_at')::timestamptz,(entry->>'last_review_at')::timestamptz,entry->>'last_result',
      (entry->>'last_answer_id')::uuid,entry->>'model_version')
    on conflict (user_id,source,word_ref,question_type) do update set card=excluded.card,due_at=excluded.due_at,
      last_review_at=excluded.last_review_at,last_result=excluded.last_result,last_answer_id=excluded.last_answer_id,
      model_version=excluded.model_version,updated_at=now();
  end loop;
  update public.answer_log set learning_processed_at=now(),learning_version=learner->>'model_version'
    where user_id=actor and id=any(processed_ids);
  return true;
end; $$;
revoke all on function public.learning_snapshot(),public.learning_history(boolean),public.commit_learning(bigint,jsonb,jsonb,uuid[]) from public,anon;
grant execute on function public.learning_snapshot(),public.learning_history(boolean),public.commit_learning(bigint,jsonb,jsonb,uuid[]) to authenticated;
