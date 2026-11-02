-- 1回のSQL文で単語と本人の統計を取得。JSON集約でData APIの行数上限を回避する。
create function public.game_bootstrap()
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
 select jsonb_build_object(
   'words', coalesce((select jsonb_agg(w order by w.id) from public.word w where w.deleted_at is null),'[]'::jsonb),
   'stats', coalesce((select jsonb_agg(s) from public.word_recent_stat s),'[]'::jsonb)
 );
$$;
revoke all on function public.game_bootstrap() from public, anon;
grant execute on function public.game_bootstrap() to authenticated;
