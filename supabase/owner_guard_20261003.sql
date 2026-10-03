-- ============================================================
--  노진교회 — 최후 방어: '최고 운영자' 자리 + 권한 변경 기록 (2026-10-03 목사님 요청)
--  Supabase ▸ SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.
-- ------------------------------------------------------------
--  왜: 관리자 계정 하나가 털리면, 그 사람이 목사님의 관리자 권한을 빼고 계정까지 정지시킬 수 있었다.
--
--  ① site_owners(최고 운영자) — 홈페이지(API)로는 읽지도 고치지도 못하는 표. 여기 넣고 빼기는
--     Supabase 관리 화면(SQL Editor)이나 사무실 PC 비상 복구 도구(service_role 열쇠)로만.
--  ② admins(관리자) 표는 홈페이지에서는 최고 운영자만 넣고 뺄 수 있다(관리자 지정·해제 모두).
--     최고 운영자 자신의 관리자 자리는 홈페이지에서는 아무도(본인도) 뺄 수 없다.
--     → 관리자로 남아 있으니 기존 규칙대로 계정 정지(admin_set_suspend)도 안 된다.
--  ③ access_log — 관리자 지정·해제, 영역 권한(can_*)·회원 상태, 계정 정지·해제를 누가 언제 했는지 자동 기록.
--     관리자만 읽을 수 있고, 아무도 고치거나 지울 수 없다(쓰기는 아래 트리거만).
--
--  기존 함수(set_access·list_access·admin_set_suspend 등)와 기존 자료는 건드리지 않는다. 표·트리거·함수를 더하기만.
-- ============================================================

-- 지금 이 요청이 홈페이지(로그인한 사람·손님)에서 온 것인지. 관리 화면·service_role 이면 false
create or replace function public._from_web()
returns boolean language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::json->>'role',
    nullif(current_setting('request.jwt.claim.role', true), ''),
    ''
  ) in ('authenticated', 'anon');
$$;

-- ① 최고 운영자 ------------------------------------------------
create table if not exists public.site_owners (
  uid        uuid primary key references auth.users(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.site_owners enable row level security;      -- 정책 없음 = 홈페이지에서는 못 읽고 못 고침
revoke all on public.site_owners from anon, authenticated;

insert into public.site_owners (uid, note)
select id, '담임목사(churchnojin@gmail.com)' from auth.users where lower(email) = 'churchnojin@gmail.com'
on conflict (uid) do nothing;

-- 내가 최고 운영자인지(본인 것만 알려 준다)
create or replace function public.am_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.site_owners where uid = auth.uid());
$$;
revoke all on function public.am_owner() from public, anon;
grant execute on function public.am_owner() to authenticated;

-- ② 관리자 표 지키기 ---------------------------------------------
create or replace function public.admins_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public._from_web() then
    if tg_op = 'DELETE' then return old; end if;                 -- 관리 화면·비상 복구는 통과
    return new;
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    if exists (select 1 from public.site_owners where uid = old.uid) then
      raise exception '최고 운영자의 관리자 권한은 홈페이지에서 뺄 수 없습니다.';
    end if;
  end if;
  if not exists (select 1 from public.site_owners where uid = auth.uid()) then
    raise exception '관리자 지정·해제는 최고 운영자만 할 수 있습니다.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists trg_admins_guard on public.admins;
create trigger trg_admins_guard
  before insert or update or delete on public.admins
  for each row execute function public.admins_guard();

-- ③ 권한 변경 기록 ----------------------------------------------
create table if not exists public.access_log (
  id      bigserial primary key,
  at      timestamptz not null default now(),
  actor   uuid,                 -- 바꾼 사람(비어 있으면 관리 화면·비상 복구)
  target  uuid,                 -- 바뀐 사람
  what    text not null,        -- 관리자 지정 / 관리자 해제 / 권한 / 계정 정지 / 정지 해제
  detail  jsonb
);
create index if not exists access_log_at_idx on public.access_log (at desc);
alter table public.access_log enable row level security;
revoke all on public.access_log from anon, authenticated;
grant select on public.access_log to authenticated;
drop policy if exists "access_log_admin_read" on public.access_log;
create policy "access_log_admin_read" on public.access_log
  for select to authenticated using (exists (select 1 from public.admins a where a.uid = auth.uid()));

create or replace function public.log_admins_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.access_log(actor, target, what) values (auth.uid(), new.uid, '관리자 지정');
  elsif tg_op = 'DELETE' then
    insert into public.access_log(actor, target, what) values (auth.uid(), old.uid, '관리자 해제');
  end if;
  return null;
end $$;
drop trigger if exists trg_log_admins on public.admins;
create trigger trg_log_admins after insert or delete on public.admins
  for each row execute function public.log_admins_change();

-- member_links: can_* 권한과 회원 상태가 바뀐 칸만 {"칸": [전, 후]} 로
create or replace function public.log_member_links_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  n jsonb := to_jsonb(new);
  d jsonb := '{}'::jsonb;
  k text;
begin
  for k in select jsonb_object_keys(n) loop
    if (k like 'can\_%' or k = 'member_status')
       and (o -> k) is distinct from (n -> k)
       and not (tg_op = 'INSERT' and coalesce(n ->> k, 'false') in ('false', '')) then
      d := d || jsonb_build_object(k, jsonb_build_array(o -> k, n -> k));
    end if;
  end loop;
  if d <> '{}'::jsonb then
    insert into public.access_log(actor, target, what, detail) values (auth.uid(), new.user_id, '권한', d);
  end if;
  return null;
end $$;
drop trigger if exists trg_log_member_links on public.member_links;
create trigger trg_log_member_links after insert or update on public.member_links
  for each row execute function public.log_member_links_change();

-- profiles: 계정 정지·해제
create or replace function public.log_suspend_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (old.suspended_at is null) <> (new.suspended_at is null) then
    insert into public.access_log(actor, target, what, detail)
    values (auth.uid(), new.id, case when new.suspended_at is null then '정지 해제' else '계정 정지' end,
            case when new.suspend_note is null then null else jsonb_build_object('note', new.suspend_note) end);
  end if;
  return null;
end $$;
drop trigger if exists trg_log_suspend on public.profiles;
create trigger trg_log_suspend after update of suspended_at on public.profiles
  for each row execute function public.log_suspend_change();

-- 권한 관리 화면용: 최근 기록(이름을 붙여서). 관리자만
create or replace function public.list_access_log(p_limit int default 50)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.admins where uid = auth.uid()) then
    raise exception '관리자만 볼 수 있습니다.';
  end if;
  return coalesce((
    select json_agg(x order by x.at desc) from (
      select l.at, l.what, l.detail,
             coalesce(pa.name, case when l.actor is null then '관리 화면·비상 복구' else '(알 수 없음)' end) as actor_name,
             coalesce(pt.name, '(이름 없음)') as target_name
      from public.access_log l
      left join public.profiles pa on pa.id = l.actor
      left join public.profiles pt on pt.id = l.target
      order by l.at desc
      limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) x), '[]'::json);
end $$;
revoke all on function public.list_access_log(int) from public, anon;
grant execute on function public.list_access_log(int) to authenticated;

-- 확인: 최고 운영자 · 트리거
select (select string_agg(u.email, ', ') from public.site_owners o join auth.users u on u.id = o.uid) as owners,
       (select string_agg(tgname, ', ' order by tgname) from pg_trigger
         where tgname in ('trg_admins_guard','trg_log_admins','trg_log_member_links','trg_log_suspend')) as triggers;
