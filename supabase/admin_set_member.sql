-- ============================================================
--  ○○교회 — 관리자가 회원의 정/준회원 상태 + 교적 연결을 직접 설정
--  Supabase ▸ SQL Editor 에 붙여넣고 Run (1회).
--  · 권한관리 화면에서 준회원→정회원 승격 시 교적(매칭키)과 연동.
--  · 관리자만 호출 가능. 정회원 연결 시 교적의 배우자매칭키도 동기화.
-- ============================================================

create or replace function public.admin_set_member(p_uid uuid, p_status text, p_member_key text, p_member_name text)
returns json language plpgsql security definer set search_path = public as $$
declare v_spousekey text := '';
begin
  if not exists (select 1 from public.admins where uid = auth.uid()) then
    return json_build_object('ok', false, 'error', '관리자만 가능합니다.');
  end if;
  if p_status = '정회원' and coalesce(p_member_key, '') <> '' then
    select coalesce(spouse_key, '') into v_spousekey from public.gyojeok where member_key = p_member_key limit 1;
  end if;
  insert into public.member_links (user_id, member_status, member_key, member_name, spouse_key, updated_at)
  values (p_uid, p_status, nullif(p_member_key, ''), nullif(p_member_name, ''), nullif(v_spousekey, ''), now())
  on conflict (user_id) do update set
    member_status = excluded.member_status,
    member_key    = excluded.member_key,
    member_name   = coalesce(excluded.member_name, public.member_links.member_name),
    spouse_key    = excluded.spouse_key,
    updated_at    = now();
  return json_build_object('ok', true);
end $$;
