-- An acknowledged answer may still need derived-state repair after a failed
-- background job. The existing partial index makes this an inexpensive probe.
create or replace function public.sync_manifest() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode='42501'; end if;
  return jsonb_build_object('owner',auth.uid(),'protocol',1,'versions',(
    select coalesce(jsonb_object_agg(dataset,version::text),'{}'::jsonb)
    from public.sync_versions where scope in ('global',auth.uid()::text)
  ),'pending_learning',exists(
    select 1 from public.answer_log where user_id=auth.uid() and learning_processed_at is null
  ));
end; $$;
