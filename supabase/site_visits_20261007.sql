-- 홈페이지 방문자 수 — 2026-10-07 목사님 요청: "방문자 수 확인할 수 있는 카운터 기능을 넣자. 관리자인 나만 보면 돼."
--
-- 개인을 알아볼 수 있는 정보(이름·IP·브라우저 전체 정보)는 남기지 않는다.
--   vid    : 브라우저가 '그날만' 쓰는 임의 번호(날이 바뀌면 새 번호) — 그날 몇 명인지 세는 데만 쓴다
--   device : 서버가 브라우저 정보(user-agent)에서 '휴대폰/태블릿/컴퓨터' 낱말 하나만 뽑아 남긴다
--   src    : 들어온 곳(카카오톡·네이버 검색 등) 낱말 하나만
--   member : 로그인한 상태였는지(누구인지는 남기지 않음)
-- 쓰기: log_visit() — 누구나(js/layout.js 가 화면마다 한 번). 검색 로봇·관리자(목사님) 방문은 세지 않는다.
-- 읽기: visit_stats() — 최고 운영자(am_owner)만. 화면은 js/visit-stats.js(모든 화면 맨 아래 숫자 + 자세히 창).
-- Supabase → SQL Editor 에 1회 실행. 여러 번 실행해도 안전하다.

create table if not exists public.site_visits (
  id     bigserial primary key,
  day    date not null,                       -- 한국 날짜
  at     timestamptz not null default now(),
  vid    text not null,
  page   text not null,                       -- index, word, story …
  member boolean not null default false,
  device text not null,
  src    text not null
);
create index if not exists site_visits_day_idx on public.site_visits (day);

alter table public.site_visits enable row level security;    -- 정책 없음 = 아무도 직접 읽고 쓰지 못한다(아래 함수로만)
revoke all on public.site_visits from anon, authenticated;

create or replace function public.log_visit(p_vid text, p_page text, p_ref text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  ua  text := lower(coalesce(current_setting('request.headers', true)::json->>'user-agent', ''));
  d   date := (now() at time zone 'Asia/Seoul')::date;
  r   text := lower(coalesce(p_ref, ''));
  dev text;
  s   text;
begin
  if p_vid is null or p_vid !~ '^[a-z0-9]{8,32}$' then return; end if;
  if p_page is null or p_page !~ '^[a-z0-9_-]{1,40}$' then return; end if;
  -- 검색 로봇·미리보기·자동 점검 프로그램은 세지 않는다
  if ua = '' or ua ~ '(bot|crawl|spider|slurp|scrap|daumoa|yeti|facebookexternalhit|bingpreview|headless|lighthouse|pingdom|uptime|curl|wget|python|java/)' then return; end if;
  -- 목사님·관리자 방문은 세지 않는다
  if auth.uid() is not null and public.is_admin() then return; end if;
  -- 한 브라우저가 하루에 300번 넘게 보내면 더 받지 않는다(장난 막기)
  if (select count(*) from public.site_visits v where v.day = d and v.vid = p_vid) >= 300 then return; end if;
  dev := case when ua ~ '(ipad|tablet)' or (ua ~ 'android' and ua !~ 'mobile') then '태블릿'
              when ua ~ '(mobi|iphone|android)' then '휴대폰'
              else '컴퓨터' end;
  s := case when ua ~ 'kakaotalk' then '카카오톡'
            when ua ~ 'naver\(inapp' then '네이버 앱'
            when ua ~ 'instagram' then '인스타그램'
            when ua ~ '(fban|fbav)' then '페이스북'
            when ua ~ ' line/' then '라인'
            when ua ~ 'band/' then '밴드'
            when r ~ 'naver' then '네이버 검색'
            when r ~ 'google' then '구글 검색'
            when r ~ 'daum' then '다음 검색'
            when r ~ 'youtube' then '유튜브'
            when r ~ 'kakao' then '카카오'
            when r ~ 'band' then '밴드'
            when r ~ '^[a-z0-9.-]{3,60}$' then r
            else '직접 들어옴' end;
  insert into public.site_visits (day, vid, page, member, device, src)
  values (d, p_vid, p_page, auth.uid() is not null, dev, s);
end $$;
revoke all on function public.log_visit(text, text, text) from public;
grant execute on function public.log_visit(text, text, text) to anon, authenticated;

-- 방문 현황(최고 운영자만). 방문자 = 그날 서로 다른 브라우저 수(날마다 따로 셈), 조회 = 화면을 연 횟수.
create or replace function public.visit_stats(p_days int default 30)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  td date := (now() at time zone 'Asia/Seoul')::date;
  n  int  := greatest(1, least(coalesce(p_days, 30), 366));
  d0 date;
begin
  if not public.am_owner() then raise exception '최고 운영자만 볼 수 있습니다'; end if;
  d0 := td - (n - 1);
  return json_build_object(
    'today', td,
    'days', n,
    'counter', json_build_object(
      'today',       (select count(distinct vid) from public.site_visits where day = td),
      'today_views', (select count(*) from public.site_visits where day = td),
      'yesterday',   (select count(distinct vid) from public.site_visits where day = td - 1),
      'month',       (select coalesce(sum(c), 0) from (select count(distinct vid) c from public.site_visits where day >= date_trunc('month', td)::date group by day) x),
      'total',       (select coalesce(sum(c), 0) from (select count(distinct vid) c from public.site_visits group by day) x),
      'since',       (select min(day) from public.site_visits)),
    'daily', (select coalesce(json_agg(json_build_object('day', g.day::date, 'visitors', coalesce(v.visitors, 0), 'views', coalesce(v.views, 0), 'members', coalesce(v.members, 0)) order by g.day), '[]'::json)
                from generate_series(d0::timestamp, td::timestamp, interval '1 day') as g(day)
                left join (select day, count(distinct vid) visitors, count(*) views, count(distinct vid) filter (where member) members
                             from public.site_visits where day >= d0 group by day) v on v.day = g.day::date),
    'pages',   (select coalesce(json_agg(x), '[]'::json) from (select page, count(*) views, count(distinct (day, vid)) visitors from public.site_visits where day >= d0 group by page order by 2 desc limit 15) x),
    'devices', (select coalesce(json_agg(x), '[]'::json) from (select device, count(distinct (day, vid)) visitors from public.site_visits where day >= d0 group by device order by 2 desc) x),
    -- 들어온 곳은 그날 그 브라우저의 '첫 화면'으로만 센다(홈페이지 안에서 옮겨 다닌 화면은 '직접 들어옴'으로 잡히므로)
    'sources', (select coalesce(json_agg(x), '[]'::json) from (select src, count(*) visitors from (select distinct on (day, vid) day, vid, src from public.site_visits where day >= d0 order by day, vid, at) f group by src order by 2 desc limit 10) x),
    'members', (select json_build_object('member', count(distinct (day, vid)) filter (where member), 'guest', count(distinct (day, vid)) filter (where not member)) from public.site_visits where day >= d0)
  );
end $$;
revoke all on function public.visit_stats(int) from public, anon;
grant execute on function public.visit_stats(int) to authenticated;
