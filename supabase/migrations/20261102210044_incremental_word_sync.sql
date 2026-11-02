-- 書き込みと同期境界を直列化し、未コミット変更の取りこぼしを防ぐ。
create or replace function public.word_set_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(735019284);
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
drop trigger word_set_updated_at on public.word;
create trigger word_set_updated_at before insert or update on public.word
for each row execute function public.word_set_updated_at();

create index word_updated_at_idx on public.word(updated_at);

create function public.game_sync(since timestamptz default null)
returns jsonb language plpgsql volatile security invoker set search_path = ''
as $$
declare
  boundary timestamptz;
  full_sync boolean;
  payload jsonb;
begin
  -- Writers hold the exclusive lock until commit; reads may run concurrently.
  perform pg_catalog.pg_advisory_xact_lock_shared(735019284);
  boundary := clock_timestamp();
  full_sync := since is null or since > boundary;
  select jsonb_build_object(
    'synced_at', to_char(boundary at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'reset', full_sync,
    'words', coalesce((
      select jsonb_agg(w order by w.id) from public.word w
      where (full_sync and w.deleted_at is null)
         or (not full_sync and w.updated_at >= since)
    ), '[]'::jsonb),
    'stats', coalesce((select jsonb_agg(s) from public.word_recent_stat s), '[]'::jsonb)
  ) into payload;
  return payload;
end;
$$;
revoke all on function public.game_sync(timestamptz) from public, anon;
grant execute on function public.game_sync(timestamptz) to authenticated;
