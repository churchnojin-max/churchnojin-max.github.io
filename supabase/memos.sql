-- 메모장(memos): 교회에서 일어나는 잡다한 일들을 기록·관리하는 관리자 전용 메모.
-- 관리자(admins 테이블에 등록된 사용자)만 읽기/쓰기 가능.
-- Supabase → SQL Editor 에 붙여넣고 1회 실행하세요.

create table if not exists public.memos (
  id uuid primary key default gen_random_uuid(),
  title text,               -- 제목(선택)
  content text,             -- 내용
  category text,            -- 분류(할 일·아이디어·전달사항 등)
  color text,               -- 메모지 색(hex)
  pinned boolean default false,   -- 상단 고정
  done boolean default false,     -- 완료 표시
  created_by uuid default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.memos enable row level security;

drop policy if exists "admin all memos" on public.memos;
create policy "admin all memos" on public.memos for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));
