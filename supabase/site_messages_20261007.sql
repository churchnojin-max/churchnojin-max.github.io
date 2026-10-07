-- ============================================================
--  노진교회 — 교회에 메시지 보내기 · 내 교적 보기 (2026-10-07, 1회 실행)
-- ------------------------------------------------------------
--  ① site_messages : 성도가 보내는 메시지. 받는 사람은 최고 운영자(목사님)뿐.
--     목사님이 '확인하였습니다'를 누르면 보낸 분 화면에 그 표시가 뜬다.
--  ② my_gyojeok()  : 로그인한 본인의 교적 한 줄만 돌려준다(읽기 전용).
--     특이사항·심방여부·인도자 같은 목회용 메모는 돌려주지 않는다.
-- ============================================================

-- ── ① 메시지 ────────────────────────────────────────────────
create table if not exists public.site_messages (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sender_name text,
  kind        text not null default '일반' check (kind in ('일반', '교적수정')),
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at  timestamptz not null default now(),
  checked_at  timestamptz,                 -- 목사님이 '확인하였습니다'를 누른 때
  notified    boolean not null default false   -- 텔레그램으로 알렸는지(사무실 PC 의 login_watch.py)
);

create index if not exists site_messages_user_idx on public.site_messages (user_id, created_at desc);
create index if not exists site_messages_open_idx on public.site_messages (checked_at, created_at desc);

alter table public.site_messages enable row level security;

-- 읽기: 보낸 분은 자기 것만, 최고 운영자는 전부
drop policy if exists "site_messages_read" on public.site_messages;
create policy "site_messages_read" on public.site_messages
  for select to authenticated
  using (user_id = auth.uid() or public.am_owner());

-- 보내기: 로그인한 분이 자기 이름으로만
drop policy if exists "site_messages_insert" on public.site_messages;
create policy "site_messages_insert" on public.site_messages
  for insert to authenticated
  with check (user_id = auth.uid());

-- '확인하였습니다' 표시: 최고 운영자만
drop policy if exists "site_messages_check" on public.site_messages;
create policy "site_messages_check" on public.site_messages
  for update to authenticated
  using (public.am_owner())
  with check (public.am_owner());

-- 보낼 때 정리: 확인 표시·알림 여부를 보낸 쪽이 미리 채워 넣지 못하게 하고,
-- 이름은 프로필에서 가져오며, 하루 10건을 넘으면 막는다(장난 방지).
create or replace function public.site_messages_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  today_count integer;
begin
  new.user_id    := auth.uid();
  new.created_at := now();
  new.checked_at := null;
  new.notified   := false;
  new.body       := btrim(new.body);
  select coalesce(nullif(l.member_name, ''), nullif(p.name, ''), '(이름 없음)')
    into new.sender_name
    from public.profiles p
    left join public.member_links l on l.user_id = p.id
   where p.id = auth.uid();
  if new.sender_name is null then new.sender_name := '(이름 없음)'; end if;

  select count(*) into today_count
    from public.site_messages
   where user_id = auth.uid() and created_at > now() - interval '1 day';
  if today_count >= 10 then
    raise exception '하루에 보낼 수 있는 메시지(10건)를 넘었습니다. 내일 다시 보내 주세요.';
  end if;
  return new;
end $$;

drop trigger if exists trg_site_messages_before_insert on public.site_messages;
create trigger trg_site_messages_before_insert
  before insert on public.site_messages
  for each row execute function public.site_messages_before_insert();

-- 목사님이 확인할 때 다른 칸은 바꾸지 못하게(확인 시각만)
create or replace function public.site_messages_before_update()
returns trigger language plpgsql as $$
begin
  new.user_id     := old.user_id;
  new.sender_name := old.sender_name;
  new.kind        := old.kind;
  new.body        := old.body;
  new.created_at  := old.created_at;
  return new;
end $$;

drop trigger if exists trg_site_messages_before_update on public.site_messages;
create trigger trg_site_messages_before_update
  before update on public.site_messages
  for each row execute function public.site_messages_before_update();

-- ── ② 내 교적 보기 ──────────────────────────────────────────
create or replace function public.my_gyojeok()
returns table (
  name text, birth date, birth_lunar boolean, sex text,
  role text, grade text, groups text, district_role text, org_role text,
  phone text, home_phone text, address text, work_address text, work_phone text,
  baptized boolean, baptism_date date, baptism_note text, baptism_church text,
  ordination_date date, reg_date date, prev_church text,
  head text, relation text
)
language sql security definer stable set search_path = public as $$
  select g.name, g.birth, g.birth_lunar, g.sex,
         g.role, g.grade, g.groups, g.district_role, g.org_role,
         g.phone, g.home_phone, g.address, g.work_address, g.work_phone,
         g.baptized, g.baptism_date, g.baptism_note, g.baptism_church,
         g.ordination_date, g.reg_date, g.prev_church,
         g.head, g.relation
    from public.gyojeok g
    join public.member_links l on l.member_key = g.member_key
   where l.user_id = auth.uid()
     and coalesce(l.member_key, '') <> ''
   order by g.id
   limit 1;
$$;
revoke all on function public.my_gyojeok() from public, anon;
grant execute on function public.my_gyojeok() to authenticated;

-- ── ③ 처리방침 제4조 ⑤ 를 지키는 장치 (2026-10-07 추가) ─────────
-- 회원 탈퇴(프로필 삭제) 때 그 분이 보낸 메시지도 바로 지운다.
-- (탈퇴는 auth.users 가 아니라 profiles 를 지우므로 위의 on delete cascade 만으로는 안 된다)
create or replace function public.site_messages_on_withdraw()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    delete from public.site_messages where user_id = old.id;
  exception when others then
    null;   -- 지우기가 실패해도 탈퇴는 막지 않는다
  end;
  return old;
end $$;
drop trigger if exists trg_site_messages_withdraw on public.profiles;
create trigger trg_site_messages_withdraw after delete on public.profiles
  for each row execute function public.site_messages_on_withdraw();

-- 매일 새벽 1년 지난 메시지를 지운다(서버에서 돌아 PC 가 꺼져 있어도 된다)
select cron.unschedule('site_messages_retention')
 where exists (select 1 from cron.job where jobname = 'site_messages_retention');
select cron.schedule('site_messages_retention', '20 18 * * *',
  $$delete from public.site_messages where created_at < now() - interval '1 year'$$);
