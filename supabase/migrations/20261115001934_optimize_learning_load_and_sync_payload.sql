-- One SQL snapshot, same event inputs and RLS as learning_history.
create function public.learning_work() returns jsonb
language sql stable security invoker set search_path='' set jit=off as $$
  with pending as materialized (
    select a.id,coalesce(a.word_id,a.personal_word_id) as word_id,
      case when a.personal_word_id is null then 'word' else 'personal' end as source,
      a.question_type,a.result,a.response_ms,a.time_limit_ms,a.answered_at,
      coalesce(w.difficulty,p.difficulty,0)::integer as difficulty
    from public.answer_log a
    left join public.word w on w.id=a.word_id
    left join public.personal_word p on p.id=a.personal_word_id and p.user_id=a.user_id
    where a.user_id=(select auth.uid()) and a.learning_processed_at is null
  ), touched as (select distinct source,word_id,question_type from pending)
  select jsonb_build_object(
    'learner',(select to_jsonb(s)-'user_id'-'updated_at' from public.learner_state s where s.user_id=(select auth.uid())),
    'events',coalesce((select jsonb_agg(p order by p.answered_at,p.id) from pending p),'[]'::jsonb),
    'words',coalesce((select jsonb_agg(to_jsonb(s)-'user_id'-'updated_at')
      from touched t join public.word_learning_state s on s.user_id=(select auth.uid())
        and s.source=t.source and s.word_ref=t.word_id and s.question_type=t.question_type),'[]'::jsonb)
  );
$$;
revoke all on function public.learning_work() from public,anon;
grant execute on function public.learning_work() to authenticated;

-- Opt-in wire schema: retain old RPC/cursors for existing/open clients.
-- Revocation becomes a tombstone; never omit a row and lose its deletion.
create function public.sync_pull_compact(p_versions jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' set jit=off as $$
declare page jsonb;
begin
  page:=public.sync_pull(p_versions);
  return page || jsonb_build_object('content_schema',1,'changes',(
    select coalesce(jsonb_agg(
      case when e->>'dataset'<>'distractors' then e
        when (e->>'deleted')::boolean or e->'value'->>'status' is distinct from 'approved'
          then e || jsonb_build_object('deleted',true,'value',null)
        else e || jsonb_build_object('value',jsonb_build_array(
          e->'value'->>'target_word_id',e->'value'->>'candidate_source',e->'value'->>'candidate_id'))
      end order by position),'[]'::jsonb)
    from jsonb_array_elements(page->'changes') with ordinality as changes(e,position)
  ));
end; $$;
revoke all on function public.sync_pull_compact(jsonb) from public,anon;
grant execute on function public.sync_pull_compact(jsonb) to authenticated;
