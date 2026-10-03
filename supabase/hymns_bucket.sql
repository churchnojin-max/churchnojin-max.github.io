-- ============================================================
--  노진교회 — 새찬송가 악보(비공개 보관함 'hymns') 정회원만 보기 (2026-10-03)
--  · 악보 그림 645장(001.webp ~ 645.webp)은 tools 없이 service_role 로 미리 올려 둠.
--  · 보관함은 비공개(public=false) — 공개 주소로는 열리지 않는다.
--  · 정회원(member_links.member_status='정회원')과 관리자만 읽을 수 있다(저작권 때문에 준회원·손님 제외).
--  · 더하기만 하는 SQL(기존 자료를 바꾸거나 지우지 않음). Supabase ▸ SQL Editor 에 1회 실행.
-- ============================================================

create or replace function public.is_full_member()
returns boolean language sql security definer stable
set search_path = public as $$
  select public.is_admin()
      or exists(select 1 from public.member_links m where m.user_id = auth.uid() and m.member_status = '정회원')
$$;
grant execute on function public.is_full_member() to authenticated;

drop policy if exists "hymns_read_full_member" on storage.objects;
create policy "hymns_read_full_member" on storage.objects for select to authenticated
  using (bucket_id = 'hymns' and public.is_full_member());
