-- 설교 기록에 예배 정보(교독문·찬송가) 저장용 컬럼
alter table public.sermons add column if not exists gyodok text;  -- 교독문 (예: 23. 시편 23편)
alter table public.sermons add column if not exists hymns  text;  -- 찬송가 번호 목록 (예: 1,305,391)
alter table public.sermons add column if not exists praise text;  -- 찬양곡 업로드 JSON: [{"title":"...","url":"..."}]
alter table public.sermons add column if not exists worship_order text;  -- 예배 순서 JSON: [{"label":"...","detail":"...","url":"..."}]
alter table public.sermons add column if not exists bible_text text;  -- 설교 성경 본문 전문 (개역개정 — 새벽기도회/주일 등)
alter table public.sermons add column if not exists qt_bible_text text;  -- QT 전용 성경 본문 (우리말성경)
alter table public.sermons add column if not exists prayer text;  -- 설교 후 기도 (설교 원고 아래)

-- 홈페이지 '오늘의 말씀(QT)' 공개 뷰
--  · 게시는 '매일 QT'만! (2026-07 정책 변경) — '새벽기도'는 공개 QT에 노출하지 않는다.
--    과거 새벽기도 말씀은 sermons_dawn_to_qt_migrate.sql 로 '매일 QT'로 전환해 보존.
--  · 본문은 우리말성경(qt_bible_text) 우선, 없으면 개역개정(bible_text)
--  · 오늘까지의 글만 anon 에 노출(미래 QT는 당일이 되기 전까지 숨김)
--  · 날짜 비교는 반드시 한국시각(Asia/Seoul) 기준! current_date(UTC)를 쓰면
--    한국 00:00~09:00 사이에는 UTC가 아직 전날이라 그날 QT가 숨겨지는 버그가 생긴다.
drop view if exists public.qt_published;
create view public.qt_published as
  select sermon_date, title, scripture,
         coalesce(nullif(btrim(qt_bible_text), ''), bible_text) as qt_bible_text,
         content, prayer
  from public.sermons
  where service = '매일 QT'
    and sermon_date is not null
    and sermon_date <= (now() at time zone 'Asia/Seoul')::date
  order by sermon_date desc;
grant select on public.qt_published to anon, authenticated;
