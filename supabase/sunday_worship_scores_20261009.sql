-- ============================================================
--  주일 예배 화면(worship.html): 정회원에게 새찬송가 악보를 '주일 예배 시간에만' 보여 주기 — 2026-10-09
--  목사님 결정: 로그인한 정회원은 주일 10:45~12:30 예배 화면에서 새찬송가 악보를 볼 수 있다.
--             모두의 찬양(ccm/)·새 찬양(new/)은 열지 않는다(지금처럼 '악보' 권한자만). 악보집 화면은 그대로 권한자만.
--  Supabase ▸ SQL Editor 에 통째로 붙여넣고 Run (한 번).
--  · 기존 규칙(hymns_read_score: 관리자 + '악보' 권한)은 그대로 두고, 규칙을 하나 더한다(보관함 규칙은 서로 '또는'으로 합쳐짐).
--  · 시간은 앞뒤 5분 여유(10:40~12:35, 한국 시각) — 화면은 js/church.js 의 10:45~12:30 에만 열린다.
--  · is_full_member() 는 supabase/hymns_bucket.sql 에서 만든 함수(관리자 또는 정회원).
-- ============================================================

create or replace function public.sunday_worship_open()
returns boolean language sql stable
set search_path = public as $$
  select extract(dow from (now() at time zone 'Asia/Seoul')) = 0
     and (now() at time zone 'Asia/Seoul')::time >= time '10:40'
     and (now() at time zone 'Asia/Seoul')::time <  time '12:35'
$$;

grant execute on function public.sunday_worship_open() to authenticated;

drop policy if exists "hymns_read_sunday_member" on storage.objects;
create policy "hymns_read_sunday_member" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'hymns'
    and name ~ '^[0-9]{3}\.webp$'          -- 새찬송가 001~645.webp 만 (ccm/·new/ 폴더는 안 됨)
    and public.is_full_member()
    and public.sunday_worship_open()
  );

-- 확인: "규칙" 칸에 hymns_read_score, hymns_read_sunday_member 두 이름이 나오면 됨(지금 열림은 주일 예배 시간에만 true)
select (select string_agg(policyname, ', ' order by policyname) from pg_policies
         where tablename = 'objects' and policyname in ('hymns_read_score', 'hymns_read_sunday_member')) as "규칙",
       public.sunday_worship_open() as "지금 열림";
