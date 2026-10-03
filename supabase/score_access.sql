-- ============================================================
--  노진교회 — 악보(새찬송가·찬양집) 보기 권한 (2026-10-03)
--  목사님 뜻: 저작권 문의를 마칠 때까지 악보는 최고 관리자와
--  '악보' 권한을 받은 사람만 본다(정회원이라도 권한이 없으면 못 봄).
--  · 기존 권한 함수(list_access·set_access·my_perms)는 건드리지 않고 따로 더한다.
--  · member_links.can_score 칸 추가, can_score()·list_score_access()·set_score_access() 추가.
--  · 보관함 hymns 읽기 규칙을 정회원 → 악보 권한으로 바꾼다.
--  여러 번 실행해도 안전하다. Supabase ▸ SQL Editor 에서 실행.
-- ============================================================

alter table public.member_links add column if not exists can_score boolean not null default false;

-- 로그인한 본인이 악보를 볼 수 있는가(최고 관리자는 항상)
create or replace function public.can_score()
returns boolean language sql security definer stable
set search_path = public as $$
  select public.is_admin()
      or exists(select 1 from public.member_links m where m.user_id = auth.uid() and m.can_score)
$$;
grant execute on function public.can_score() to authenticated;

-- 관리자용: 악보 권한을 받은 사람 목록(uid 배열)
create or replace function public.list_score_access()
returns json language sql security definer stable
set search_path = public as $$
  select case when public.is_admin()
    then coalesce((select json_agg(user_id) from public.member_links where can_score), '[]'::json)
    else '[]'::json end
$$;
grant execute on function public.list_score_access() to authenticated;

-- 관리자용: 악보 권한 주기/거두기
create or replace function public.set_score_access(p_uid uuid, p_on boolean)
returns json language plpgsql security definer
set search_path = public as $$
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'error', '관리자만 가능합니다.');
  end if;
  insert into public.member_links(user_id, updated_at) values (p_uid, now())
    on conflict (user_id) do update set updated_at = now();
  update public.member_links set can_score = coalesce(p_on, false), updated_at = now() where user_id = p_uid;
  return json_build_object('ok', true);
end $$;
revoke all on function public.set_score_access(uuid, boolean) from public, anon;
grant execute on function public.set_score_access(uuid, boolean) to authenticated;

-- 보관함 읽기 규칙: 정회원 → 악보 권한
drop policy if exists "hymns_read_full_member" on storage.objects;
drop policy if exists "hymns_read_score" on storage.objects;
create policy "hymns_read_score" on storage.objects for select to authenticated
  using (bucket_id = 'hymns' and public.can_score());

-- 확인
select (select count(*) from pg_policies where schemaname = 'storage' and policyname like 'hymns_read%') as hymn_policies,
       (select policyname from pg_policies where schemaname = 'storage' and policyname like 'hymns_read%' limit 1) as policy_name,
       (select count(*) from public.member_links where can_score) as score_users;
