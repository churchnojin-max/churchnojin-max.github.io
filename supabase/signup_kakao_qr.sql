-- ============================================================
--  카카오 로그인 · QR 가입 준비 (2026-10-01)
--  Supabase ▸ SQL Editor 에서 실행. 여러 번 실행해도 안전하다.
--
--  1) list_access(관리자 전용 가입자 목록)에 세 칸 추가 — 기존 칸은 그대로
--       provider : 가입 방식(kakao / email)
--       joinVia  : 'qr' 이면 교회 QR 코드를 찍고 가입한 분
--       realName : 가입자가 직접 적은 실명(카카오 별명과 다를 수 있어 따로 받음)
--  2) set_my_name(이름): 로그인한 본인이 자기 실명을 저장(profiles.name)
--     카카오로 가입하면 이름 자리에 카카오 별명이 들어가므로, 첫 로그인 때 실명을 받아 여기로 저장한다.
-- ============================================================

-- ※ 2026-10-03: 이 함수는 security_fix_20261003.sql 에서 더 안전하게 다시 정의했다. 이 파일을 다시 실행했다면 security_fix_20261003.sql 도 반드시 다시 실행할 것.
create or replace function public.list_access()
returns json language sql security definer set search_path = public as $$
  select coalesce(json_agg(row), '[]'::json) from (
    select json_build_object(
      'uid', p.id, 'name', coalesce(l.member_name, p.name, ''), 'email', coalesce(p.email,''),
      'status',         coalesce(l.member_status,'준회원'),
      'isAdmin',        exists(select 1 from public.admins a where a.uid = p.id),
      'canFinance',     coalesce(l.can_finance,false),
      'canGyojeok',     coalesce(l.can_gyojeok,false),
      'canHomepage',    coalesce(l.can_homepage,false),
      'canWorship',     coalesce(l.can_worship,false),
      'canAffairs',     coalesce(l.can_affairs,false),
      'canBoard',       coalesce(l.can_board,false),
      'canDistrict',    coalesce(l.can_district,false),
      'canDistrictAll', coalesce(l.can_district_all,false),
      'joinedAt',       p.created_at,
      'provider',       coalesce(u.raw_app_meta_data->>'provider', 'email'),
      'joinVia',        coalesce(u.raw_user_meta_data->>'join_via', ''),
      'realName',       coalesce(u.raw_user_meta_data->>'real_name', '')
    ) as row
    from public.profiles p
    left join public.member_links l on l.user_id = p.id
    left join auth.users u on u.id = p.id
    where exists(select 1 from public.admins where uid = auth.uid())
    order by exists(select 1 from public.admins a where a.uid = p.id) desc, coalesce(l.member_name, p.name)
  ) t;
$$;

create or replace function public.set_my_name(p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare v text := left(btrim(coalesce(p_name, '')), 30);
begin
  if auth.uid() is null then return json_build_object('ok', false, 'error', '로그인이 필요합니다.'); end if;
  if v = '' then return json_build_object('ok', false, 'error', '이름을 적어 주세요.'); end if;
  update public.profiles set name = v where id = auth.uid();
  return json_build_object('ok', true);
end $$;
revoke all on function public.set_my_name(text) from public, anon;
grant execute on function public.set_my_name(text) to authenticated;

-- 확인
select count(*) as users, count(*) filter (where row->>'provider' is not null) as with_provider
from json_array_elements((select public.list_access())) as t(row);
