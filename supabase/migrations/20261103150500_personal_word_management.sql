-- Server-side search/pagination over only the caller's active personal words.
create function public.personal_word_list(p_query text default '', p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path=''
as $$
declare actor uuid := auth.uid(); result jsonb;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if length(p_query)>100 or p_page<1 or p_page>100000 then
    raise exception 'invalid query' using errcode='22023';
  end if;
  with matches as materialized (
    select w.id,w.term,w.kana,w.hanja_reading,w.meaning_ko,w.has_kanji,w.difficulty,w.note,w.entry_type,w.created_at,w.updated_at,w.deleted_at
    from public.personal_word w
    where w.user_id=actor and w.deleted_at is null
      and (p_query='' or strpos(lower(w.term),lower(p_query))>0
        or strpos(lower(w.kana),lower(p_query))>0
        or strpos(lower(w.meaning_ko),lower(p_query))>0
        or strpos(lower(coalesce(w.hanja_reading,'')),lower(p_query))>0)
  ), counts as (
    select count(*) as total, greatest(1,ceil(count(*)/20.0)::integer) as pages from matches
  ), bounds as (
    select *, least(p_page,pages) as page from counts
  )
  select jsonb_build_object('total',b.total,'page',b.page,'page_size',20,
    'all_total',(select count(*) from public.personal_word where user_id=actor and deleted_at is null),
    'words',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,id desc) from
      (select * from matches order by created_at desc,id desc limit 20 offset ((b.page-1)*20)) p),'[]'::jsonb))
    into result from bounds b;
  return result;
end;
$$;
revoke all on function public.personal_word_list(text,integer) from public,anon;
grant execute on function public.personal_word_list(text,integer) to authenticated;
-- The app removes words via deleted_at. Preserve references and learning history.
revoke delete on public.personal_word from authenticated;
