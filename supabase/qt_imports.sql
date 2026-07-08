-- 생명의 삶 가져오기(개인 참고용 비공개 보관함) — 관리자만 읽기/쓰기.
-- ⚠️ 공개 뷰(qt_published)나 홈페이지에는 절대 노출되지 않는다(별도 테이블, anon 권한 없음).
-- Supabase → SQL Editor 에 1회 실행.
create table if not exists public.qt_imports (
  ref_date   date primary key,   -- QT 날짜(하루 1건; 같은 날짜 다시 가져오면 덮어씀)
  title      text,               -- 제목(파싱되면)
  scripture  text,               -- 본문 참조(파싱되면)
  raw_text   text,               -- 붙여넣은 원문 전체(신뢰 보관)
  created_by uuid default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.qt_imports enable row level security;
drop policy if exists "admin all qt_imports" on public.qt_imports;
create policy "admin all qt_imports" on public.qt_imports for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));
