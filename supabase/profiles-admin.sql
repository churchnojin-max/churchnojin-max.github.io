-- ============================================================
-- ○○교회 — 회원 프로필 + 관리자 (회원 목록 관리용)
-- Supabase ▸ SQL Editor 에 붙여넣고 Run 하세요. (한 번만)
-- ============================================================

-- ===== 회원 프로필 =====
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text,
  email      text,
  provider   text,
  created_at timestamptz not null default now()
);

-- ===== 관리자 목록 (여기에 등록된 사람만 전체 회원을 볼 수 있음) =====
create table if not exists public.admins (
  uid uuid primary key references auth.users (id) on delete cascade
);

alter table public.profiles enable row level security;
alter table public.admins   enable row level security;

-- ===== 신규 가입 시 프로필 자동 생성 (카카오/이메일 공통) =====
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, provider)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name',
             new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'nickname',
             split_part(coalesce(new.email,''),'@',1)),
    new.email,
    coalesce(new.raw_app_meta_data->>'provider','email')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== 기존 가입자 보충(트리거 적용 전 가입자) =====
insert into public.profiles (id, name, email, provider)
select u.id,
       coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'nickname', split_part(coalesce(u.email,''),'@',1)),
       u.email,
       coalesce(u.raw_app_meta_data->>'provider','email')
from auth.users u
on conflict (id) do nothing;

-- ===== RLS 정책 =====
-- 본인 프로필, 또는 관리자는 전체 조회 가능
create policy "profiles_select_self_or_admin" on public.profiles
  for select using (
    auth.uid() = id
    or auth.uid() in (select uid from public.admins)
  );
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id);

-- admins: 본인이 관리자인지 확인용(자기 행만 조회)
create policy "admins_select_self" on public.admins
  for select using (auth.uid() = uid);

-- ============================================================
-- ★ 관리자 지정 (한 번만) ★
-- 1) 사이트에서 한 번 로그인한 뒤
-- 2) Supabase ▸ Authentication ▸ Users 에서 본인 계정의 User UID 복사
-- 3) 아래 한 줄의 '여기에-UID'를 바꿔 실행:
--
-- insert into public.admins (uid) values ('여기에-UID') on conflict do nothing;
-- ============================================================
