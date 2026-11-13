-- Future inserts only: no retroactive award and no coupling to deletable history counts.
create table public.treasure_progress (
 user_id uuid primary key references auth.users(id) on delete cascade,
 solved bigint not null default 0 check(solved>=0)
);
create table public.study_chest (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 ordinal bigint not null check(ordinal>0),
 created_at timestamptz not null default now(),
 opened_at timestamptz,
 tier text check(tier in ('common','rare','unique')),
 unique(user_id,ordinal),
 check((opened_at is null)=(tier is null))
);
create index study_chest_pending on public.study_chest(user_id,ordinal) where opened_at is null;
alter table public.treasure_progress enable row level security;
alter table public.study_chest enable row level security;
revoke all on public.treasure_progress,public.study_chest from anon,authenticated;
grant select on public.treasure_progress,public.study_chest to authenticated;
create policy own_progress on public.treasure_progress for select to authenticated using(user_id=(select auth.uid()));
create policy own_chests on public.study_chest for select to authenticated using(user_id=(select auth.uid()));

-- Trigger needs definer rights: users cannot mint or edit rewards directly.
create function public.award_study_chest() returns trigger language plpgsql security definer set search_path='' as $$
declare n bigint;
begin
 if new.result='timeout' then return new; end if;
 insert into public.treasure_progress(user_id,solved) values(new.user_id,1)
 on conflict(user_id) do update set solved=public.treasure_progress.solved+1 returning solved into n;
 if n%5=0 then insert into public.study_chest(user_id,ordinal) values(new.user_id,n/5); end if;
 return new;
end; $$;
revoke all on function public.award_study_chest() from public,anon,authenticated;
create trigger award_study_chest after insert on public.answer_log for each row execute function public.award_study_chest();

create function public.treasure_inventory() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'progress',coalesce((select solved%5 from public.treasure_progress where user_id=(select auth.uid())),0),
 'pending_count',(select count(*) from public.study_chest where user_id=(select auth.uid()) and opened_at is null),
 'pending',coalesce((select jsonb_agg(p order by ordinal) from (select id,ordinal from public.study_chest where user_id=(select auth.uid()) and opened_at is null order by ordinal limit 12)p),'[]'::jsonb),
 'collection',jsonb_build_object(
 'common',(select count(*) from public.study_chest where user_id=(select auth.uid()) and tier='common'),
 'rare',(select count(*) from public.study_chest where user_id=(select auth.uid()) and tier='rare'),
 'unique',(select count(*) from public.study_chest where user_id=(select auth.uid()) and tier='unique')))
 where (select auth.uid()) is not null;
$$;
revoke all on function public.treasure_inventory() from public,anon;
grant execute on function public.treasure_inventory() to authenticated;

create function public.open_study_chest(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); box public.study_chest; first_id uuid; roll double precision; grade text;
begin
 if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
 -- Same lock as the award counter: serialize parallel tabs/open requests per owner.
 perform 1 from public.treasure_progress where user_id=actor for update;
 select * into box from public.study_chest where id=p_id and user_id=actor for update;
 if not found then raise exception 'not_found' using errcode='P0002'; end if;
 if box.opened_at is not null then return jsonb_build_object('id',box.id,'tier',box.tier); end if;
 select id into first_id from public.study_chest where user_id=actor and opened_at is null order by ordinal limit 1;
 if first_id<>p_id then raise exception 'open_in_order' using errcode='22023'; end if;
 roll:=random(); grade:=case when roll<0.6 then 'common' when roll<0.9 then 'rare' else 'unique' end;
 update public.study_chest set tier=grade,opened_at=clock_timestamp() where id=p_id;
 return jsonb_build_object('id',p_id,'tier',grade);
end; $$;
revoke all on function public.open_study_chest(uuid) from public,anon;
grant execute on function public.open_study_chest(uuid) to authenticated;
