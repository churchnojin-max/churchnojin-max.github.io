-- ============================================================
--  교적(gyojeok) — 교인 신상 통합 명부의 항목을 빠짐없이 담기 위한 컬럼 추가
--  Supabase ▸ SQL Editor 에 붙여넣고 Run (1회).
--
--  왜 필요한가:
--   '노진교회 교인 신상 통합 명부(.xlsx)'에는 기존 교적 테이블에 자리가 없는
--   항목(집 전화·직장 정보·구역직분·기관직책·세례 상세·가족사항)이 있어
--   그동안 특이사항(note)에 글로 몰아넣어야 했다. 각각 제 칸을 만들어
--   검색·수정이 가능하도록 한다.
--
--  안전: add column if not exists 라서 여러 번 실행해도 안전하고,
--        기존 데이터는 건드리지 않는다(새 칸은 NULL로 시작).
--  보안: 기존 RLS 정책(is_finance)이 테이블 단위로 걸려 있어 새 칸에도 그대로 적용된다.
-- ============================================================

alter table public.gyojeok
  add column if not exists home_phone     text,   -- 집 전화번호
  add column if not exists work_address   text,   -- 직장 주소
  add column if not exists work_phone     text,   -- 직장 전화번호
  add column if not exists district_role  text,   -- 구역직분 (구역장·인도자 등)
  add column if not exists org_role       text,   -- 기관직책 (루디아 회장 등)
  add column if not exists baptized       boolean,-- 세례 여부
  add column if not exists baptism_note   text,   -- 세례일시 원문 ("1982년", "유아세례" 등 — 날짜로 못 바꾸는 표기 보존)
  add column if not exists baptism_church text,   -- 세례 받은 교회
  add column if not exists baptism_by     text,   -- 집례자
  add column if not exists family_note    text;   -- 가족사항 원문 (배우자/자녀 명단)

-- 교인번호(gyojeok_id)로 자주 찾게 되므로 인덱스 추가
create index if not exists gyojeok_gid_idx on public.gyojeok(gyojeok_id);
