-- ============================================================
--  노진교회 — 권한 관리 화면에 교구사역 두 칸을 더한다 (1회 실행)
-- ------------------------------------------------------------
--  교적관리 ▸ 권한 관리 표에서 체크할 수 있도록,
--  기존 list_access / set_access 에 교구사역 권한을 추가한다.
--    can_district      교구사역 — 사역보고 작성·자기 것 열람
--    can_district_all  교구사역(전체) — 전 구역 열람 + 말씀 나눔지 올리기
--  나머지 항목과 동작은 그대로 두었다.
-- ============================================================

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
      'joinedAt',       p.created_at
    ) as row
    from public.profiles p left join public.member_links l on l.user_id = p.id
    where exists(select 1 from public.admins where uid = auth.uid())
    order by exists(select 1 from public.admins a where a.uid = p.id) desc, coalesce(l.member_name, p.name)
  ) t;
$$;

create or replace function public.set_access(
  p_uid uuid,
  p_is_admin         boolean default null,
  p_can_finance      boolean default null,
  p_can_gyojeok      boolean default null,
  p_can_homepage     boolean default null,
  p_can_worship      boolean default null,
  p_can_affairs      boolean default null,
  p_can_board        boolean default null,
  p_can_district     boolean default null,
  p_can_district_all boolean default null
)
returns json language plpgsql security definer set search_path = public as $$
declare
  admin_count integer;
begin
  if not exists(select 1 from public.admins where uid = auth.uid()) then
    return json_build_object('ok', false, 'error', '관리자만 가능합니다.');
  end if;

  if p_is_admin is not null then
    if p_is_admin then
      insert into public.admins(uid) values (p_uid) on conflict (uid) do nothing;
    else
      -- 마지막 관리자까지 지우면 아무도 권한을 되돌릴 수 없게 되므로 막는다.
      select count(*) into admin_count from public.admins;
      if admin_count <= 1 and exists(select 1 from public.admins where uid = p_uid) then
        return json_build_object('ok', false, 'error', '마지막 관리자는 해제할 수 없습니다.');
      end if;
      delete from public.admins where uid = p_uid;
    end if;
  end if;

  -- 영역 권한은 member_links 한 줄에 모여 있다. 없으면 만들고, 넘어온 것만 갱신.
  if p_can_finance is not null or p_can_gyojeok is not null or p_can_homepage is not null
     or p_can_worship is not null or p_can_affairs is not null or p_can_board is not null
     or p_can_district is not null or p_can_district_all is not null then
    insert into public.member_links(user_id, updated_at) values (p_uid, now())
      on conflict (user_id) do update set updated_at = now();
    update public.member_links set
      can_finance      = coalesce(p_can_finance,      can_finance),
      can_gyojeok      = coalesce(p_can_gyojeok,      can_gyojeok),
      can_homepage     = coalesce(p_can_homepage,     can_homepage),
      can_worship      = coalesce(p_can_worship,      can_worship),
      can_affairs      = coalesce(p_can_affairs,      can_affairs),
      can_board        = coalesce(p_can_board,        can_board),
      can_district     = coalesce(p_can_district,     can_district),
      can_district_all = coalesce(p_can_district_all, can_district_all),
      updated_at       = now()
    where user_id = p_uid;
  end if;

  return json_build_object('ok', true);
end $$;

-- 인자 수가 달라진 옛 함수가 남아 있으면 지운다(둘이 공존하면 호출이 갈린다)
drop function if exists public.set_access(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean);
