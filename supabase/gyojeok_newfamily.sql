-- ============================================================
--  ○○교회 — 교적(gyojeok) 새가족 등록 확장 컬럼
--  Supabase ▸ SQL Editor 에 붙여넣고 Run (1회).
--  기존 gyojeok.sql 로 테이블/RLS가 이미 만들어져 있어야 합니다.
-- ============================================================

alter table public.gyojeok add column if not exists reg_date     date;    -- 등록일
alter table public.gyojeok add column if not exists birth_lunar  boolean default false; -- 생년월일 음력 여부(true=음력, false=양력)
alter table public.gyojeok add column if not exists prev_church  text;    -- 직전교회
alter table public.gyojeok add column if not exists referrer     text;    -- 인도자
alter table public.gyojeok add column if not exists visited      text;    -- 새가족 심방여부(미실시/완료)
alter table public.gyojeok add column if not exists note         text;    -- 특이사항
