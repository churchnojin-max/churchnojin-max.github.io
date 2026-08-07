-- ============================================================
-- offerings.member_key 컬럼 타입 수정 (uuid → text)
-- Supabase ▸ SQL Editor 에서 1회 실행하세요.
--
-- 증상: 재정관리 ▸ 엑셀 자동입력에서 헌금 저장 시
--   "invalid input syntax for type uuid: 손병민" 같은 오류로 저장 실패
--
-- 원인: 실제 라이브 테이블의 member_key 컬럼이 uuid 타입으로 되어 있음.
--   앱(finance.js/finance-api.js)은 항상 "이름|YYYYMMDD" 형태의 텍스트
--   교적 매칭키를 저장하도록 설계되어 있고, 저장소의 supabase/offerings.sql
--   에도 처음부터 text로 정의돼 있음 — 실제 테이블만 어긋나 있던 상태.
--
-- 이 문장은 안전합니다: 이미 text 타입이면 그대로 통과되고,
-- 혹시 uuid로 저장된 기존 값이 있어도 문자열로 그대로 변환됩니다.
--
-- 주의: offerings_select 정책이 member_key 컬럼을 참조하고 있어 타입을
-- 바로 바꿀 수 없음(Postgres 제약) → 정책을 잠깐 지웠다가 타입 변경 후
-- 원래 있던 정책 그대로 다시 만든다(supabase/offerings.sql 과 동일 내용).
-- ============================================================

drop policy if exists offerings_select on public.offerings;

alter table public.offerings
  alter column member_key type text using member_key::text;

create policy offerings_select on public.offerings for select
  using ( public.is_finance() or member_key in (select public.my_member_keys()) );
