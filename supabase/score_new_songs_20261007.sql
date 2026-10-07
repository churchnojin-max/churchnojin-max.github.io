-- ============================================================
--  노진교회 — 악보집 '새 찬양': 목사님(최고 운영자)이 화면에서 악보 올리기·빼기 (2026-10-07)
--  목사님 말씀: "악보 올린 것들을 악보집에 업데이트할 수 있을까? 지금 악보집에 새로운 곡들 악보가 없어.
--               악보 업데이트할 수 있는 무언가가 있으면 내가 업데이트도 할 수 있고."
--  · 보관함 hymns 의 new/ 폴더(목록 new/index.json + 악보 그림)에만 쓰기를 연다. 새찬송가·모두의 찬양 그림은 그대로 읽기만.
--  · 읽기는 지금 규칙("hymns_read_score" = can_score())이 그대로 맡는다.
--  · 수요기도회 원고 속 새 곡은 tools/wed_notes.py 가 service_role 로 더하므로 이 규칙과 상관없다.
--  · 보관함 hymns 가 목록 파일(json)도 받도록 allowed_mime_types 에 application/json 을 더함 — 2026-10-07 클로드가 storage API(service_role)로 이미 바꿈.
--    (다시 만들 때를 위해 아래에도 적어 둔다)
--  여러 번 실행해도 안전하다. Supabase ▸ SQL Editor 에서 실행.
-- ============================================================

update storage.buckets set allowed_mime_types = array['image/webp','application/json'] where id = 'hymns';

drop policy if exists "hymns_new_admin_insert" on storage.objects;
create policy "hymns_new_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'hymns' and name like 'new/%' and public.is_admin());

drop policy if exists "hymns_new_admin_update" on storage.objects;
create policy "hymns_new_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'hymns' and name like 'new/%' and public.is_admin())
  with check (bucket_id = 'hymns' and name like 'new/%' and public.is_admin());

drop policy if exists "hymns_new_admin_delete" on storage.objects;
create policy "hymns_new_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'hymns' and name like 'new/%' and public.is_admin());

-- 확인: 3이 나오면 됩니다
select count(*) as hymns_new_policies from pg_policies
 where schemaname = 'storage' and policyname like 'hymns_new_admin_%';
