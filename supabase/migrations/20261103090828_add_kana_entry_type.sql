-- Shared vocabulary and personal vocabulary use the same entry shape.
alter table public.word add column entry_type text not null default 'word';
alter table public.personal_word add column entry_type text not null default 'word';
alter table public.word drop constraint word_difficulty_range;
alter table public.personal_word drop constraint word_difficulty_range;
alter table public.word add constraint word_entry_kind check (
  (entry_type='word' and difficulty between 0 and 10) or
  (entry_type in ('hiragana','katakana') and difficulty=-1 and not has_kanji and hanja_reading is null)
);
alter table public.personal_word add constraint personal_word_entry_kind check (
  (entry_type='word' and difficulty between 0 and 10) or
  (entry_type in ('hiragana','katakana') and difficulty=-1 and not has_kanji and hanja_reading is null)
);
comment on column public.word.entry_type is 'word / hiragana / katakana。かなのmeaning_koは韓国語による発音表記。';
-- Kana reviews still use FSRS, but do not increase the evidence for vocabulary ability.
alter table public.learner_state add column ability_count integer not null default 0 check (ability_count>=0);
create or replace function public.commit_learning(expected_revision bigint, learner jsonb, states jsonb, processed_ids uuid[])
returns boolean language plpgsql security invoker set search_path=''
as $$
declare actor uuid := auth.uid(); current_revision bigint; entry jsonb;
begin
  if actor is null then raise exception 'unauthorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 9173));
  select revision into current_revision from public.learner_state where user_id=actor;
  if coalesce(current_revision,0) <> expected_revision then return false; end if;
  insert into public.learner_state(user_id,ability,precision,review_count,ability_count,last_answered_at,last_answer_id,revision,model_version)
  values(actor,(learner->>'ability')::double precision,(learner->>'precision')::double precision,
    (learner->>'review_count')::integer,coalesce((learner->>'ability_count')::integer,(learner->>'review_count')::integer),(learner->>'last_answered_at')::timestamptz,
    (learner->>'last_answer_id')::uuid,expected_revision+1,learner->>'model_version')
  on conflict (user_id) do update set ability=excluded.ability,precision=excluded.precision,
    review_count=excluded.review_count,ability_count=excluded.ability_count,last_answered_at=excluded.last_answered_at,
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
