-- ============================================================
-- offerings / expenses 의 created_by 컬럼 타입 수정 (uuid → text)
-- Supabase ▸ SQL Editor 에 전체 붙여넣고 Run (1회).
--
-- [증상]
--   재정관리 ▸ 엑셀 자동입력에서 헌금 저장 시
--   invalid input syntax for type uuid: "손병민"
--
-- [진짜 원인]
--   여기서 "손병민"은 헌금자가 아니라 '로그인한 입력자(담임목사)'의 이름이다.
--   전표를 넣을 때 입력자를 기록하는 트리거가 created_by 에 사람 '이름'(텍스트)을
--   넣는데, 실제 컬럼이 uuid 로 되어 있어 거부된 것.
--   같은 테이블의 짝 컬럼 updated_by 는 이미 text 이고, 앱(finance-api.js의
--   offOut/expOut)도 created_by 를 '입력자' 이름으로 그대로 화면에 표시한다.
--   → created_by 도 text 가 맞다. updated_by 와 타입을 일치시킨다.
--
-- [안전성]
--   · 이미 text 면 아무 일도 일어나지 않는다(그대로 통과).
--   · 기존에 uuid 로 들어간 값이 있으면 문자열로 그대로 보존된다(데이터 손실 없음).
--   · created_by 를 참조하는 RLS 정책/제약은 없다(정책은 member_key·is_finance만 사용).
-- ============================================================

alter table public.offerings
  alter column created_by type text using created_by::text;

alter table public.expenses
  alter column created_by type text using created_by::text;

-- PostgREST(API 서버)가 바뀐 스키마를 즉시 다시 읽도록 알림
NOTIFY pgrst, 'reload schema';

-- 확인용: 아래 결과에서 네 컬럼이 모두 text 로 보이면 성공
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('offerings', 'expenses')
  and column_name in ('created_by', 'updated_by', 'member_key')
order by table_name, column_name;
