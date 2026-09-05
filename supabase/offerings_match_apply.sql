-- ============================================================
--  노진교회 — 미등록 헌금자를 앞 이름으로 교적에 연결한다
-- ------------------------------------------------------------
--  반드시 offerings_match_survey.sql 로 건수를 먼저 확인한 뒤 실행할 것.
--
--  안전장치
--   · 교적에서 그 이름이 '딱 한 사람'일 때만 연결한다.
--     동명이인이면 손대지 않는다(사람이 판단해야 하므로).
--   · 헌금자 이름(giver)은 적힌 그대로 둔다. member_key 만 채운다.
--   · 이미 연결된 건은 건드리지 않는다.
--   · 되돌릴 수 있도록 바꾼 내역을 offerings_match_log 에 남긴다.
-- ============================================================

-- 되돌리기용 기록표
create table if not exists public.offerings_match_log (
  id          bigint generated always as identity primary key,
  offering_id bigint not null,
  giver       text,
  matched_key text,
  matched_at  timestamptz not null default now()
);

with target as (
  select
    o.id,
    o.giver,
    nullif(trim(substring(
      regexp_replace(coalesce(o.giver, ''), '\(.*\)$', '')
      from '^[^[:space:]·・,、/／&＆]+'
    )), '') as first_name
  from public.offerings o
  where coalesce(o.member_key, '') = ''
    and coalesce(o.giver, '') <> ''
),
solo as (                       -- 그 이름이 교적에 딱 한 사람인 것만
  select t.id, t.giver, g.member_key
  from target t
  join public.gyojeok g on g.name = t.first_name
  where t.first_name is not null
    and (select count(*) from public.gyojeok g2 where g2.name = t.first_name) = 1
    and coalesce(g.member_key, '') <> ''
),
logged as (
  insert into public.offerings_match_log (offering_id, giver, matched_key)
  select id, giver, member_key from solo
  returning offering_id
)
update public.offerings o
   set member_key = s.member_key
  from solo s
 where o.id = s.id
   and coalesce(o.member_key, '') = '';

-- 결과 확인
select count(*) as "이번에 연결한 건수" from public.offerings_match_log
 where matched_at > now() - interval '1 minute';

-- ── 되돌리려면 (필요할 때만) ────────────────────────────────
-- update public.offerings o set member_key = null
--   from public.offerings_match_log l
--  where o.id = l.offering_id and o.member_key = l.matched_key;
-- delete from public.offerings_match_log;
