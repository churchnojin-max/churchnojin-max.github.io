-- 위임식 준비 점검판 (tf.html) — 2026-10-20, 10-21 고침
-- 할 일 목록은 data/tf-tasks.json(번호 = code), 여기에는 "누가 언제 무엇을 끝냈는지"와 건의 사항만 저장한다.
-- 보는 범위: 담임목사(site_owners)와 see_all 인 사람(문명수 장로)은 전체, 나머지 팀원은 자기 이름이 든 팀만(화면에서 거름).
-- 여러 번 실행해도 안전함.

-- 1) 점검판을 쓸 수 있는 팀원
create table if not exists public.tf_members (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  name     text not null,               -- 할 일 표의 이름과 같게 (예: 김은희)
  see_all  boolean not null default false,
  added_at timestamptz not null default now()
);
alter table public.tf_members add column if not exists see_all boolean not null default false;
alter table public.tf_members enable row level security;

create or replace function public.tf_allowed()
returns boolean language sql stable security definer set search_path = public as $$
  select public.am_owner() or exists (select 1 from public.tf_members where user_id = auth.uid());
$$;
revoke all on function public.tf_allowed() from public;
grant execute on function public.tf_allowed() to authenticated;

-- 나에 대한 정보: 볼 수 있는지 · 이름 · 전체를 보는지
create or replace function public.tf_me()
returns json language sql stable security definer set search_path = public as $$
  select case
    when public.am_owner() then json_build_object('allowed', true, 'name', coalesce((select name from public.tf_members where user_id = auth.uid()), '손병민'), 'see_all', true)
    when exists (select 1 from public.tf_members where user_id = auth.uid())
      then (select json_build_object('allowed', true, 'name', name, 'see_all', see_all) from public.tf_members where user_id = auth.uid())
    else json_build_object('allowed', false)
  end;
$$;
revoke all on function public.tf_me() from public;
grant execute on function public.tf_me() to authenticated;

-- 2) 할 일별 상태
create table if not exists public.tf_checks (
  code         text primary key,
  status       text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  note         text,
  done_at      timestamptz,
  updated_by   uuid default auth.uid(),
  updated_name text,
  updated_at   timestamptz not null default now()
);
alter table public.tf_checks enable row level security;
drop policy if exists "tf_checks_read" on public.tf_checks;
create policy "tf_checks_read" on public.tf_checks for select to authenticated using (public.tf_allowed());
drop policy if exists "tf_checks_insert" on public.tf_checks;
create policy "tf_checks_insert" on public.tf_checks for insert to authenticated with check (public.tf_allowed());
drop policy if exists "tf_checks_update" on public.tf_checks;
create policy "tf_checks_update" on public.tf_checks for update to authenticated using (public.tf_allowed()) with check (public.tf_allowed());

-- 3) 바꾼 기록
create table if not exists public.tf_check_log (
  id bigserial primary key, code text not null, status text, note text, by_uid uuid, by_name text, at timestamptz not null default now()
);
alter table public.tf_check_log enable row level security;
drop policy if exists "tf_check_log_read" on public.tf_check_log;
create policy "tf_check_log_read" on public.tf_check_log for select to authenticated using (public.tf_allowed());
create or replace function public.tf_checks_log_trg() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.tf_check_log (code, status, note, by_uid, by_name) values (new.code, new.status, new.note, auth.uid(), new.updated_name);
  return new;
end; $$;
drop trigger if exists tf_checks_log on public.tf_checks;
create trigger tf_checks_log after insert or update on public.tf_checks for each row execute function public.tf_checks_log_trg();

-- 4) 건의 사항
create table if not exists public.tf_suggestions (
  id         bigserial primary key,
  by_uid     uuid default auth.uid(),
  by_name    text,
  team       text,                        -- 어느 팀 이야기인지(선택)
  body       text not null,
  reply      text,                        -- 목사님 답(선택)
  created_at timestamptz not null default now()
);
alter table public.tf_suggestions enable row level security;
drop policy if exists "tf_sug_read" on public.tf_suggestions;
create policy "tf_sug_read" on public.tf_suggestions for select to authenticated using (public.tf_allowed());
drop policy if exists "tf_sug_insert" on public.tf_suggestions;
create policy "tf_sug_insert" on public.tf_suggestions for insert to authenticated with check (public.tf_allowed());
drop policy if exists "tf_sug_update" on public.tf_suggestions;
create policy "tf_sug_update" on public.tf_suggestions for update to authenticated using (public.am_owner()) with check (public.am_owner());

-- ─────────────────────────────────────────────
-- 팀원 넣기 (목사님이 확인한 뒤, 이메일을 각 사람 로그인 이메일로 바꿔 실행)
-- 이름은 할 일 표의 이름(성+이름)과 똑같이. 문명수 장로는 see_all = true.
-- insert into public.tf_members (user_id, name, see_all)
--   select id, '문명수', true from auth.users where email = 'example@gmail.com'
-- on conflict (user_id) do update set name = excluded.name, see_all = excluded.see_all;
-- insert into public.tf_members (user_id, name)
--   select id, '김은희' from auth.users where email = 'example2@gmail.com'
-- on conflict (user_id) do update set name = excluded.name;
