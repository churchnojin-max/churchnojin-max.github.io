-- ============================================================
-- 대시보드 "오늘의 큐티" 아멘 체크 기록
-- Supabase ▸ SQL Editor 에 붙여넣고 Run 하세요. (한 번만, 다시 실행해도 안전)
-- 본인은 자신의 체크를 읽고/쓸 수 있고, 관리자는 전체 체크 현황을 읽을 수 있습니다
-- (목회행정 대시보드의 "QT 출석부"용).
-- ============================================================

create table if not exists public.qt_checks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  check_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, check_date)
);
alter table public.qt_checks enable row level security;

drop policy if exists "qt_checks_own" on public.qt_checks;
create policy "qt_checks_own" on public.qt_checks
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "qt_checks_admin_read" on public.qt_checks;
create policy "qt_checks_admin_read" on public.qt_checks
  for select to authenticated
  using (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- 본인이 그 날짜에 몇 번째로 아멘 체크했는지(순위)만 알려주는 함수.
-- RLS 우회(security definer)로 전체 체크 수를 세지만, 다른 사람의 신원은 노출하지 않음.
create or replace function public.qt_check_rank(p_date date)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.qt_checks c
  where c.check_date = p_date
    and c.created_at <= (
      select created_at from public.qt_checks
      where user_id = auth.uid() and check_date = p_date
    );
$$;
grant execute on function public.qt_check_rank(date) to authenticated;
