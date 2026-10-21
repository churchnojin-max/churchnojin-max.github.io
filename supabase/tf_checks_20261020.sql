-- 위임식 준비 점검판 (tf.html) — 2026-10-20, 10-21 고침(이름으로 맞춤)
-- 할 일 목록은 data/tf-tasks.json(번호 = code), 여기에는 "누가 언제 무엇을 끝냈는지"와 건의 사항만 저장한다.
-- 누가 볼 수 있나: 담임목사(site_owners) + 아래 '준비위원 명단(tf_roster)'에 이름이 있는 분.
--   이메일이 없어도 된다 — 로그인한 사람의 이름(교적 이름 → 프로필 이름 → 가입 때 적은 이름 → 카카오 닉네임)이 명단과 같으면 들어온다.
--   see_all = true 인 분(문명수 장로)은 전체, 나머지는 자기 이름이 든 팀만(화면에서 거름).
-- 여러 번 실행해도 안전함.

-- 1) 준비위원 명단 (이름으로)
create table if not exists public.tf_roster (
  name     text primary key,                  -- 할 일 표의 이름과 같게 (성+이름, 직함 없이)
  see_all  boolean not null default false,
  note     text,
  added_at timestamptz not null default now()
);
alter table public.tf_roster enable row level security;   -- 정책 없음 → 브라우저에서 직접 못 읽음(함수로만)

insert into public.tf_roster (name, see_all, note) values
  ('문명수', true,  '장로 · 의전·사례비·재정 총책 — 전체 보기'),
  ('오성자', false, '권사 · 식당 및 간식(정) · 하객 선물'),
  ('김은희', false, '권사 · 식당 및 간식(부) · 하객 선물'),
  ('신성호', false, '집사 · 미디어·현수막·순서지·사진'),
  ('김평애', false, '권사 · 안내(팀장)'),
  ('고은성', false, '안내'),
  ('김종학', false, '집사 · 주차'),
  ('최명철', false, '집사 · 주차'),
  ('신성찬', false, '집사 · 예배 음악·순서 지원'),
  ('최지연', false, '권사 · 자리 꾸밈·코사지·강단 꽃'),
  ('임혜은', false, '집사 · 지원팀'),
  ('황귀순', false, '집사 · 지원팀'),
  ('문선경', false, '집사 · 지원팀')
on conflict (name) do update set see_all = excluded.see_all, note = excluded.note;

-- 2) 로그인한 사람의 이름 찾기 (띄어쓰기 뺀 성+이름)
create or replace function public.tf_my_name()
returns text language sql stable security definer set search_path = public as $$
  select regexp_replace(coalesce(
           nullif((select ml.member_name from public.member_links ml where ml.user_id = auth.uid()), ''),
           nullif((select p.name from public.profiles p where p.id = auth.uid()), ''),
           nullif((select u.raw_user_meta_data->>'real_name' from auth.users u where u.id = auth.uid()), ''),
           nullif((select u.raw_user_meta_data->>'name' from auth.users u where u.id = auth.uid()), ''),
           nullif((select u.raw_user_meta_data->>'nickname' from auth.users u where u.id = auth.uid()), ''),
           ''), '\s+', '', 'g');
$$;
revoke all on function public.tf_my_name() from public;
grant execute on function public.tf_my_name() to authenticated;

create or replace function public.tf_allowed()
returns boolean language sql stable security definer set search_path = public as $$
  select public.am_owner()
      or exists (select 1 from public.tf_roster r where r.name = public.tf_my_name());
$$;
revoke all on function public.tf_allowed() from public;
grant execute on function public.tf_allowed() to authenticated;

-- 나에 대한 정보: 볼 수 있는지 · 이름 · 전체를 보는지
create or replace function public.tf_me()
returns json language sql stable security definer set search_path = public as $$
  select case
    when public.am_owner() then json_build_object('allowed', true, 'name', coalesce(nullif(public.tf_my_name(), ''), '손병민'), 'see_all', true)
    when exists (select 1 from public.tf_roster r where r.name = public.tf_my_name())
      then (select json_build_object('allowed', true, 'name', r.name, 'see_all', r.see_all) from public.tf_roster r where r.name = public.tf_my_name())
    else json_build_object('allowed', false, 'name', public.tf_my_name())
  end;
$$;
revoke all on function public.tf_me() from public;
grant execute on function public.tf_me() to authenticated;

-- 3) 할 일별 상태
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

-- 4) 바꾼 기록
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

-- 5) 건의 사항
create table if not exists public.tf_suggestions (
  id         bigserial primary key,
  by_uid     uuid default auth.uid(),
  by_name    text,
  team       text,
  body       text not null,
  reply      text,
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
-- 확인: 명단과, 가입한 사람 중 이름이 맞는 사람
select r.name, r.see_all,
       (select count(*) from public.profiles p where regexp_replace(coalesce(p.name,''), '\s+', '', 'g') = r.name) as "프로필 이름 같은 사람 수"
from public.tf_roster r order by r.see_all desc, r.name;

-- 어떤 분의 이름이 명단과 다르게 가입돼 있으면(예: 카카오 닉네임) 아래처럼 프로필 이름을 고쳐 주면 된다:
-- update public.profiles set name = '김은희' where id = (select id from auth.users where email = 'xxx@kakao.com');
-- 또는 명단 쪽에 그 이름을 하나 더 넣어도 된다:
-- insert into public.tf_roster (name, see_all, note) values ('은희맘', false, '김은희 권사 카카오 이름') on conflict do nothing;
