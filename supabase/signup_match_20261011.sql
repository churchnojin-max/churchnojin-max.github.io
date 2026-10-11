-- 2026-10-11 가입 기본 정보 ↔ 교적 대조(gjMatch, 실행함): 가입 때 적은 휴대폰이 교적 전화와 같거나,
--   실명+생년월일이 교적과 같은 사람을 찾아 승인 목록에 보여 준다(카카오 가입자도 로그인 때 기본 정보 창에서 휴대폰을 적는다).
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
      'gjMatch',        (select json_build_object('name', g.name,
                           'phone', length(sp.d) >= 10 and regexp_replace(coalesce(g.phone,''),'\D','','g') = sp.d,
                           'nameBirth', g.name = btrim(coalesce(u.raw_user_meta_data->>'real_name','')) and g.birth::text = coalesce(u.raw_user_meta_data#>>'{signup,birth}',''))
                         from public.gyojeok g
                         where (length(sp.d) >= 10 and regexp_replace(coalesce(g.phone,''),'\D','','g') = sp.d)
                            or (g.name = btrim(coalesce(u.raw_user_meta_data->>'real_name','')) and g.birth::text = coalesce(u.raw_user_meta_data#>>'{signup,birth}',''))
                         order by (g.name = btrim(coalesce(u.raw_user_meta_data->>'real_name',''))) desc
                         limit 1),
      'claimName',      coalesce(r.claim_name, ''),
      'claimBirth',     coalesce(r.claim_birth, ''),
      'claimMatched',   coalesce(r.matched, false),
      'claimAt',        r.requested_at
    ) as row
    from public.profiles p
    left join public.member_links l on l.user_id = p.id
    left join auth.users u on u.id = p.id
    left join public.member_match_requests r on r.user_id = p.id
    cross join lateral (select regexp_replace(coalesce(u.raw_user_meta_data#>>'{signup,phone}',''),'\D','','g') as d) sp
    where exists(select 1 from public.admins where uid = auth.uid())
      and p.merged_into is null
    order by exists(select 1 from public.admins a where a.uid = p.id) desc, coalesce(l.member_name, p.name)
  ) t;
$function$;
