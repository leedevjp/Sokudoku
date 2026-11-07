-- Resolve approved banks under the caller's RLS policies, once per catalog load.
create function public.game_meaning_bank(difficulties integer[])
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_object_agg(target_word_id, choices), '{}'::jsonb)
  from (
    select d.target_word_id,
      jsonb_agg(jsonb_build_array(d.candidate_source, d.candidate_id,
        case when d.candidate_source='word' then c.meaning_ko else e.label end,
        case when d.candidate_source='word' then c.hanja_reading else null end)
        order by d.rank) choices
    from public.meaning_distractor d
    join public.word w on w.id=d.target_word_id
    left join public.word c on d.candidate_source='word' and c.id=d.candidate_id
      and c.deleted_at is null and c.entry_type='word'
    left join public.extra_meaning_choice e on d.candidate_source='extra' and e.id=d.candidate_id
    where (select auth.uid()) is not null and d.status='approved'
      and w.deleted_at is null and w.entry_type='word'
      and w.difficulty between 0 and 9 and w.difficulty=any(difficulties)
      and (c.id is not null or e.id is not null)
    group by d.target_word_id having count(*) between 6 and 20
  ) banks;
$$;
revoke all on function public.game_meaning_bank(integer[]) from public, anon;
grant execute on function public.game_meaning_bank(integer[]) to authenticated;

alter table public.answer_log add column selected_extra_meaning_choice_id uuid
  references public.extra_meaning_choice(id) on delete restrict;
create index answer_log_selected_extra_idx on public.answer_log(selected_extra_meaning_choice_id)
  where selected_extra_meaning_choice_id is not null;
alter table public.answer_log drop constraint answer_log_one_selection_source;
alter table public.answer_log add constraint answer_log_one_selection_source check (
  num_nonnulls(selected_word_id, selected_personal_word_id, selected_extra_meaning_choice_id) <= 1
);
alter table public.answer_log drop constraint answer_log_result_consistent;
alter table public.answer_log add constraint answer_log_result_consistent check (
  (result='correct' and selected_extra_meaning_choice_id is null
    and coalesce(selected_word_id,selected_personal_word_id) is not null
    and coalesce(selected_word_id,selected_personal_word_id)=coalesce(word_id,personal_word_id)
    and response_ms<time_limit_ms)
  or (result='incorrect'
    and coalesce(selected_word_id,selected_personal_word_id,selected_extra_meaning_choice_id) is not null
    and coalesce(selected_word_id,selected_personal_word_id,selected_extra_meaning_choice_id)<>coalesce(word_id,personal_word_id)
    and response_ms<time_limit_ms)
  or (result='timeout'
    and num_nonnulls(selected_word_id,selected_personal_word_id,selected_extra_meaning_choice_id)=0
    and response_ms=time_limit_ms)
);
alter table public.answer_log add constraint answer_log_extra_meaning_only check (
  selected_extra_meaning_choice_id is null or
  (question_type='meaning' and result='incorrect' and word_id is not null)
);

-- Activate the prepared release only; rejected candidates remain excluded.
update public.meaning_distractor set status='approved'
where status='draft' and batch_id in (
  'meaning_pilot_100_v1','meaning_stage_1_v1','meaning_stage_2_v1',
  'meaning_stage_3_v1','meaning_stage_4_v1','meaning_stage_5_v1'
);
