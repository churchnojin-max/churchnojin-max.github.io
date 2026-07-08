-- ============================================================
-- ○○교회 — 나의 도서관: 수동 분류 변경 저장
-- 드래그&드롭으로 책의 분류를 옮기면 여기에 저장됩니다.
-- (자동 키워드 분류보다 우선 적용 / 관리자 공유 / 영구 보존)
-- Supabase ▸ SQL Editor 에 붙여넣고 Run 하세요. (한 번만)
-- ============================================================

create table if not exists public.library_overrides (
  book_id    text primary key,          -- 구글 드라이브 파일 ID
  category   text not null,             -- 옮긴 분류 이름
  subcat     text,                      -- 세부분류(시리즈/종류). 없으면 자동
  updated_at timestamptz not null default now()
);

-- 이미 만들어 둔 경우에도 안전하게 세부분류 컬럼 추가(재실행 가능)
alter table public.library_overrides add column if not exists subcat text;

alter table public.library_overrides enable row level security;

-- 관리자(admins 등록자)만 읽기/쓰기 가능
drop policy if exists "libov_admin_all" on public.library_overrides;
create policy "libov_admin_all" on public.library_overrides
  for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));
