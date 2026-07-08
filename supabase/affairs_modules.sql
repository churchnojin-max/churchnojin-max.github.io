-- 목회 행정 추가 모듈: 교육관리(edu_records) · 설교관리(sermons) · 문서관리(documents)
-- 관리자(admins)만 읽기/쓰기. Supabase → SQL Editor 에 1회 실행.

create table if not exists public.edu_records (
  id uuid primary key default gen_random_uuid(),
  edu_date   date,
  title      text,      -- 교육명
  target     text,      -- 대상/부서
  teacher    text,      -- 강사/인도자
  attendance text,      -- 참석 인원
  content    text,      -- 내용/비고
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);

create table if not exists public.sermons (
  id uuid primary key default gen_random_uuid(),
  sermon_date date,
  service    text,      -- 예배
  title      text,      -- 제목
  scripture  text,      -- 본문(성경)
  preacher   text,      -- 설교자
  media_url  text,      -- 영상/음성 링크
  file_url   text,      -- 원고/자료 파일
  content    text,      -- 요약/메모
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  doc_date   date,
  title      text,      -- 제목
  category   text,      -- 분류
  manager    text,      -- 담당/부서
  file_url   text,      -- 첨부 파일
  content    text,      -- 내용/비고
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);

alter table public.edu_records enable row level security;
alter table public.sermons enable row level security;
alter table public.documents enable row level security;

do $$
declare t text;
begin
  foreach t in array array['edu_records','sermons','documents'] loop
    execute format('drop policy if exists "admin all %1$s" on public.%1$s', t);
    execute format('create policy "admin all %1$s" on public.%1$s for all using (exists (select 1 from public.admins a where a.uid = auth.uid())) with check (exists (select 1 from public.admins a where a.uid = auth.uid()))', t);
  end loop;
end $$;
