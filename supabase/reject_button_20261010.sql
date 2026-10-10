-- 2026-10-10 승인란 [승인 거절] 단추: 거절 = admin_set_suspend(정지 + 로그인 끊기, 되돌리기 가능).
--   권한 관리 목록(list_access)에 거절·정지 여부(suspended)와 까닭(suspendNote)을 함께 내보낸다. (실행함)
create or replace function public.list_access()
returns json language sql security definer set search_path to 'public' as $function$
  select coalesce(json_agg(row), '[]'::json) from (
    select json_build_object(
      'uid', p.id, 'name', coalesce(l.member_name, p.name, ''), 'email', coalesce(p.email,''),
      'status',         coalesce(l.member_status,'준회원'),
      'special',        (coalesce(l.member_status,'') = '정회원' and coalesce(l.special_note,'') <> ''),
      'specialExpired', (coalesce(l.member_status,'') <> '정회원' and coalesce(l.special_note,'') <> ''),
      'specialNote',    coalesce(l.special_note, ''),
      'specialAt',      l.special_at,
      'specialUntil',   l.special_until,
      'lastSignIn',     u.last_sign_in_at,
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
      'realName',       coalesce(u.raw_user_meta_data->>'real_name', ''),
      'signup',         coalesce(u.raw_user_meta_data->'signup', 'null'::jsonb),
      'linked',         (l.member_key is not null or l.member_id is not null),
      'suspended',      (p.suspended_at is not null),
      'suspendNote',    coalesce(p.suspend_note, ''),
      'claimName',      coalesce(r.claim_name, ''),
      'claimBirth',     coalesce(r.claim_birth, ''),
      'claimMatched',   coalesce(r.matched, false),
      'claimAt',        r.requested_at
    ) as row
    from public.profiles p
    left join public.member_links l on l.user_id = p.id
    left join auth.users u on u.id = p.id
    left join public.member_match_requests r on r.user_id = p.id
    where exists(select 1 from public.admins where uid = auth.uid())
      and p.merged_into is null
    order by exists(select 1 from public.admins a where a.uid = p.id) desc, coalesce(l.member_name, p.name)
  ) t;
$function$;
