-- ============================================================
--  노진교회 — 가입하지 않은 분께 가리기 (2026-10-05 목사님)
--  Supabase ▸ SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.
-- ------------------------------------------------------------
--  목사님 고르심: '우리들 소식 사진' + '주보 속 성도님 이름' 을 가리고, 가입하고 로그인한 분은 누구나 본다.
--  교회 소개·예배 시간·설교 영상·오시는 길·새가족 안내·주보의 말씀/예배 순서/소식은 그대로 누구나 본다.
--   ① 우리들 소식 사진·댓글·좋아요: 로그인한 분만 읽기(집계 뷰 album_feed 도 부르는 사람 권한으로)
--   ② 봉사위원(church_settings 'committees'): 로그인한 분만 읽기
--   ③ 주보(bulletins_public): 로그인하지 않은 분께는 향기로운 예물·봉사위원 명단과 PDF 주소를 빼고 보낸다
--  되돌리기: 아래 '원래대로' 주석을 참고(공개 읽기 정책을 다시 만들면 된다).
-- ============================================================

-- ① 우리들 소식
drop policy if exists "album_select_all" on public.album_photos;              -- 원래: for select using (true)
drop policy if exists "album_select_signed_in" on public.album_photos;
create policy "album_select_signed_in" on public.album_photos
  for select to authenticated using (true);

drop policy if exists "album_comments_select_all" on public.album_comments;   -- 원래: for select using (true)
drop policy if exists "album_comments_select_signed_in" on public.album_comments;
create policy "album_comments_select_signed_in" on public.album_comments
  for select to authenticated using (true);

drop policy if exists "album_likes_select_all" on public.album_likes;         -- 원래: for select using (true)
drop policy if exists "album_likes_select_signed_in" on public.album_likes;
create policy "album_likes_select_signed_in" on public.album_likes
  for select to authenticated using (true);

-- 집계 뷰는 만든 사람(postgres) 권한으로 돌면 위 규칙을 건너뛰므로, 부르는 사람 권한으로 돌게 하고 익명 읽기를 뺀다
alter view public.album_feed set (security_invoker = true);
revoke all on public.album_feed from anon;
grant select on public.album_feed to authenticated;

-- ② 봉사위원 명단(이름이 들어 있다) — 공개 읽기에서 빼고, 로그인한 분 읽기를 따로 둔다
drop policy if exists "public read display settings" on public.church_settings;  -- 원래: key = any(homepage, committees, general, monthly_song)
create policy "public read display settings" on public.church_settings
  for select using (key = any (array['homepage', 'general', 'monthly_song']));
drop policy if exists "signed-in read committees" on public.church_settings;
create policy "signed-in read committees" on public.church_settings
  for select to authenticated using (key = 'committees');

-- ③ 주보: 로그인하지 않은 분께는 이름 명단(향기로운 예물·봉사위원)과 PDF 주소를 뺀다(헌금 금액은 원래부터 모두에게 뺌)
create or replace view public.bulletins_public as
select id, bdate, title, scripture, preacher,
       case when auth.uid() is null
            then data - 'offering_amounts' - 'offering' - 'committee' - 'pdf_url' - 'pdf_name'
            else data - 'offering_amounts'
       end as data,
       updated_at
from public.bulletins
where published = true;

-- 확인: 익명으로 보이는 것(0이어야 하는 것들)
select
  (select count(*) from pg_policies where tablename in ('album_photos', 'album_comments', 'album_likes') and cmd = 'SELECT' and 'public' = any(roles)) as album_public_read_policies,
  has_table_privilege('anon', 'public.album_feed', 'select') as anon_can_read_feed,
  (select count(*) from pg_policies where tablename = 'church_settings' and policyname = 'signed-in read committees') as committees_signed_in_policy;
