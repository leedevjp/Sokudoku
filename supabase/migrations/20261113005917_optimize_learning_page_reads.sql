-- Return the same page, counts, search and stage filters in one DB round trip.
-- Invoker rights keep the caller's RLS policies in force.
create function public.personal_word_page(
  p_query text default '', p_page integer default 1,
  p_stage text default 'all', p_sort text default 'recent'
) returns jsonb language plpgsql stable security invoker
set search_path = '' set jit = off
as $$
declare actor uuid := auth.uid(); payload jsonb;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if p_query is null or length(p_query)>100 or p_page is null or p_page<1 or p_page>100000
    or p_stage is null or p_stage not in ('all','1','2','3','4','5','10')
    or p_sort is null or p_sort not in ('recent','oldest','reading','easy','hard') then
    raise exception 'invalid query' using errcode='22023';
  end if;
  with owned as materialized (
    select w.id,w.term,w.kana,w.pronunciation_ko,w.hanja_reading,w.meaning_ko,
      w.has_kanji,w.difficulty,w.note,w.entry_type,w.created_at,w.updated_at,w.deleted_at
    from public.personal_word w where w.user_id=actor and w.deleted_at is null
  ), matches as materialized (
    select * from owned w
    where (case when p_stage='all' then true when p_stage='10' then w.difficulty=10
      else w.difficulty between (p_stage::int-1)*2 and (p_stage::int-1)*2+1 end)
      and (p_query='' or strpos(lower(w.term),lower(p_query))>0
        or strpos(lower(w.kana),lower(p_query))>0
        or strpos(lower(w.meaning_ko),lower(p_query))>0
        or strpos(lower(coalesce(w.pronunciation_ko,'')),lower(p_query))>0
        or strpos(lower(coalesce(w.hanja_reading,'')),lower(p_query))>0)
  ), bounds as (
    select count(*) as total,least(p_page,greatest(1,ceil(count(*)/20.0)::int)) as page from matches
  ), page_rows as (
    select w.*,row_number() over(order by
      case when p_sort='reading' then kana end asc,
      case when p_sort='easy' then difficulty end asc,
      case when p_sort='hard' then difficulty end desc,
      case when p_sort='oldest' then created_at end asc,
      case when p_sort<>'oldest' then created_at end desc,
      case when p_sort='oldest' then id end asc,
      case when p_sort<>'oldest' then id end desc) as position
    from matches w
    order by position limit 20 offset ((select page from bounds)-1)*20
  )
  select jsonb_build_object('total',b.total,'all_total',(select count(*) from owned),
    'page',b.page,'page_size',20,'words',coalesce(
      (select jsonb_agg(to_jsonb(p)-'position' order by position) from page_rows p),'[]'::jsonb))
  into payload from bounds b;
  return payload;
end; $$;
revoke all on function public.personal_word_page(text,integer,text,text) from public,anon;
grant execute on function public.personal_word_page(text,integer,text,text) to authenticated;

-- Enrich only the latest 100 visible mistakes; avoid two follow-up HTTP reads.
create function public.notebook_page()
returns jsonb language sql stable security invoker set search_path='' set jit=off
as $$
  select jsonb_build_object('words',coalesce(jsonb_agg(
    to_jsonb(r) || jsonb_build_object(
      'entry_type',case when r.source='word' then coalesce(w.entry_type,'word') else 'word' end,
      'in_personal',r.source='personal' or p.id is not null,
      'personal_entry',case when p.id is null then null else
        jsonb_build_object('id',p.id,'term',p.term,'kana',p.kana,'updated_at',p.updated_at) end,
      'can_add_personal',r.source='word' and r.difficulty>=0
    ) order by r.last_incorrect_at desc,r.source,r.id),'[]'::jsonb))
  from public.recent_mistake_word() r
  left join public.word w on r.source='word' and w.id=r.id
  left join public.personal_word p on p.user_id=(select auth.uid())
    and p.deleted_at is null and p.term=r.term and p.kana=r.kana;
$$;
revoke all on function public.notebook_page() from public,anon;
grant execute on function public.notebook_page() to authenticated;
