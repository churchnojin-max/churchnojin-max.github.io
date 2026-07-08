-- 회원 정보 추가 컬럼(연락처·한 줄 소개)
-- Supabase ▸ SQL Editor 에 붙여넣고 Run 하세요. (한 번만)
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists bio text;
