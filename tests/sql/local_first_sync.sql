begin;
select set_config('test.sync_actor',gen_random_uuid()::text,true),set_config('test.sync_other',gen_random_uuid()::text,true),
 set_config('test.sync_word',gen_random_uuid()::text,true),set_config('test.sync_other_word',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.sync_actor')::uuid),(current_setting('test.sync_other')::uuid);
insert into public.personal_word(id,user_id,term,kana,meaning_ko,has_kanji,difficulty)
values(current_setting('test.sync_word')::uuid,current_setting('test.sync_actor')::uuid,'同期検証','どうきけんしょう','동기화 검증',true,0),
 (current_setting('test.sync_other_word')::uuid,current_setting('test.sync_other')::uuid,'別同期検証','べつどうきけんしょう','다른 사용자 검증',true,0);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.sync_actor'),true);
do $$
declare m jsonb; p jsonb; v text;
begin
 m:=public.sync_manifest();
 if m->>'owner'<>current_setting('test.sync_actor') then raise exception 'owner mismatch'; end if;
 v:=m->'versions'->>'personal_words';
 p:=public.sync_pull((m->'versions')||jsonb_build_object('$dataset','personal_words'));
 if jsonb_array_length(p->'changes')<>0 then raise exception 'unchanged pull returned rows'; end if;
 p:=public.sync_pull('{"$dataset":"personal_words"}');
 if exists(select 1 from jsonb_array_elements(p->'changes') e where e->>'key'=current_setting('test.sync_other_word')) then raise exception 'cross-owner leak'; end if;
 if not exists(select 1 from jsonb_array_elements(p->'changes') e where e->>'key'=current_setting('test.sync_word')) then raise exception 'missing initial row'; end if;
 update public.personal_word set deleted_at=clock_timestamp() where id=current_setting('test.sync_word')::uuid;
 p:=public.sync_pull((m->'versions')||jsonb_build_object('$dataset','personal_words'));
 if not exists(select 1 from jsonb_array_elements(p->'changes') e where e->>'key'=current_setting('test.sync_word') and (e->>'deleted')::boolean) then raise exception 'missing deletion'; end if;
 if (p->'versions'->>'personal_words')::bigint<=v::bigint then raise exception 'version did not advance'; end if;
 begin
   insert into public.sync_versions(scope,dataset,version) values(current_setting('test.sync_actor'),'answers',999);
   raise exception 'client changed server cursor';
 exception when insufficient_privilege then null; end;
end; $$;
rollback;
