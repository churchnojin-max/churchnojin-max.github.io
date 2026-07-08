-- 내 정보 "내 가족" 입력란 저장용 컬럼
-- Supabase → SQL Editor 에 붙여넣고 1회 실행하면 됩니다. (본인만 수정 가능 — 기존 profiles RLS 적용)
alter table public.profiles add column if not exists family text;
