-- ============================================================
--  새벽기도 → 매일 QT 전환/정리 (2026-07 게시정책 변경, 1회 실행)
--  Supabase ▸ SQL Editor 에 붙여넣고 Run. (SQL Editor는 RLS를 우회하므로 안전하게 처리됨)
--  목적: "게시는 매일 QT만" 정책에 맞춰
--    · 과거 새벽기도 말씀(여호수아·룻기·고린도전서·시편 등 약 5개월치)은 '매일 QT'로 전환해 공개 QT·진행표에 보존
--    · 같은 날 이미 '매일 QT'가 있으면(예: 생명의삶으로 이미 분류된 날) 그날 새벽기도는 게시하지 않음
--        - 제목·본문이 완전히 같은 중복본은 삭제
--        - 내용이 다르면 '새벽기도'로 그대로 두어(비게시) 기록은 보존
--  ※ 반드시 sermons_extra.sql(qt_published 뷰: service='매일 QT'만 게시)도 함께 Run 해야 실제로 새벽기도가 내려갑니다.
--  ※ 재실행해도 안전(idempotent): 새벽기도가 없으면 아무 것도 하지 않음.
-- ============================================================

-- 1) 같은 날짜에 '새벽기도'가 둘 이상이면 하나만 남기고 삭제(내용이 더 긴 것 우선)
delete from public.sermons a
using public.sermons b
where a.service = '새벽기도' and b.service = '새벽기도'
  and a.sermon_date = b.sermon_date
  and a.ctid <> b.ctid
  and ( length(coalesce(a.content, '')) < length(coalesce(b.content, ''))
        or ( length(coalesce(a.content, '')) = length(coalesce(b.content, '')) and a.ctid < b.ctid ) );

-- 2) 같은 날 '매일 QT'와 제목·본문이 동일한 '새벽기도' 완전중복본은 삭제
delete from public.sermons d
where d.service = '새벽기도'
  and exists (
    select 1 from public.sermons q
    where q.service = '매일 QT'
      and q.sermon_date = d.sermon_date
      and coalesce(q.title, '')     = coalesce(d.title, '')
      and coalesce(q.scripture, '') = coalesce(d.scripture, '')
  );

-- 3) 같은 날 '매일 QT'가 없는 '새벽기도'는 '매일 QT'로 전환(과거 QT 아카이브 보존)
--    (내용이 다른 채로 같은 날 '매일 QT'가 이미 있는 새벽기도는 전환하지 않고 '새벽기도'로 남겨 비게시·기록 보존)
update public.sermons d
set service = '매일 QT'
where d.service = '새벽기도'
  and not exists (
    select 1 from public.sermons q
    where q.service = '매일 QT' and q.sermon_date = d.sermon_date
  );
