-- Optional Korean phonetic transcription for P (personal_word).
-- Do not populate existing personal words.
ALTER TABLE public.personal_word ADD COLUMN IF NOT EXISTS pronunciation_ko text;

COMMENT ON COLUMN public.personal_word.pronunciation_ko IS
  'Optional Korean transcription of the Japanese kana pronunciation; distinct from Korean hanja_reading.';

CREATE OR REPLACE FUNCTION public.game_catalog_sync(since timestamp with time zone DEFAULT NULL::timestamp with time zone, personal boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); boundary timestamptz; full_sync boolean; words jsonb;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if personal then
    boundary:=clock_timestamp();
    full_sync:=true;
    select coalesce(jsonb_agg(to_jsonb(w) order by id),'[]'::jsonb) into words from (
      select id,term,kana,pronunciation_ko,hanja_reading,meaning_ko,
        has_kanji,difficulty,entry_type,deleted_at
      from public.personal_word where user_id=actor and deleted_at is null
    ) w;
  else
    perform pg_catalog.pg_advisory_xact_lock_shared(735019284);
    boundary:=clock_timestamp();
    full_sync:=since is null or since>boundary;
    if full_sync then
      select coalesce(jsonb_agg(to_jsonb(w) order by id),'[]'::jsonb) into words from (
        select id,term,kana,pronunciation_ko,hanja_reading,
          meaning_ko,has_kanji,difficulty,entry_type,deleted_at
        from public.word where deleted_at is null
      ) w;
    else
      select coalesce(jsonb_agg(to_jsonb(w) order by id),'[]'::jsonb) into words from (
        select id,term,kana,pronunciation_ko,hanja_reading,
          meaning_ko,has_kanji,difficulty,entry_type,deleted_at
        from public.word where updated_at>=since
      ) w;
    end if;
  end if;
  return jsonb_build_object('synced_at',to_char(boundary at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'reset',full_sync,'words',words,'stats','[]'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.personal_word_list(p_query text DEFAULT ''::text, p_page integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare actor uuid := auth.uid(); result jsonb;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if length(p_query)>100 or p_page<1 or p_page>100000 then
    raise exception 'invalid query' using errcode='22023';
  end if;
  with matches as materialized (
    select w.id,w.term,w.kana,w.pronunciation_ko,w.hanja_reading,
      w.meaning_ko,w.has_kanji,w.difficulty,w.note,w.entry_type,
      w.created_at,w.updated_at,w.deleted_at
    from public.personal_word w
    where w.user_id=actor and w.deleted_at is null
      and (p_query='' or strpos(lower(w.term),lower(p_query))>0
        or strpos(lower(w.kana),lower(p_query))>0
        or strpos(lower(w.meaning_ko),lower(p_query))>0
        or strpos(lower(coalesce(w.pronunciation_ko,'')),lower(p_query))>0
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
$function$;
