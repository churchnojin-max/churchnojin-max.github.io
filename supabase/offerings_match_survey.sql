-- ============================================================
--  노진교회 — 미등록 헌금자 조사 (읽기만 함 · 아무것도 바꾸지 않는다)
-- ------------------------------------------------------------
--  헌금자 칸에 두 사람이 적혀 앞 이름이 버려지던 문제로 쌓인
--  '미등록'(member_key 가 비어 있는) 건이 몇 건인지, 그중 앞 이름으로
--  교적을 찾을 수 있는 건이 몇 건인지 센다.
--  고치는 것은 offerings_match_apply.sql 이 한다.
-- ============================================================

with unmatched as (
  select
    o.id,
    o.giver,
    -- 맨 앞 이름: 괄호를 떼고, 공백·가운뎃점·쉼표·빗금 앞까지
    nullif(trim(substring(
      regexp_replace(coalesce(o.giver, ''), '\(.*\)$', '')
      from '^[^[:space:]·・,、/／&＆]+'
    )), '') as first_name
  from public.offerings o
  where coalesce(o.member_key, '') = ''
    and coalesce(o.giver, '') <> ''
),
scored as (
  select
    u.*,
    (select count(*) from public.gyojeok g where g.name = u.first_name) as hits
  from unmatched u
)
select
  count(*)                                        as "미등록 전체",
  count(*) filter (where hits = 1)                as "앞이름으로 매칭 가능",
  count(*) filter (where hits > 1)                as "동명이인(손대지 않음)",
  count(*) filter (where hits = 0)                as "교적에 없음",
  count(*) filter (where hits = 1 and giver <> first_name) as "└ 그중 이름이 둘 이상 적힌 건"
from scored;
