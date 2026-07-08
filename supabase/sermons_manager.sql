-- ============================================================
--  설교 매니저 확장 컬럼 (2026-07, 1회 실행)
--  Supabase ▸ SQL Editor 에 붙여넣고 Run.
--  · series   : 설교 시리즈 (쉼표로 여러 개 — 예: "룻기 강해, 새벽 시리즈")
--  · keywords : 키워드 (쉼표, 최대 3개)
--  · summary  : 미리보기 요약 (최대 500자 — 목록·카드 하단 노출용)
--  · status   : 작성 상태 (작성중 / 수정중 / 완료)
--  실행하지 않아도 설교 저장은 되지만, 시리즈·키워드·요약·상태는 저장되지 않습니다.
-- ============================================================
alter table public.sermons add column if not exists series   text;
alter table public.sermons add column if not exists keywords text;
alter table public.sermons add column if not exists summary  text;
alter table public.sermons add column if not exists status   text default '작성중';
