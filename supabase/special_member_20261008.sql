-- 특별 승인(2026-10-08 목사님: "우리 교회 성도가 아니어도 신뢰할 만한 사람이면 승인해 줄 수 있도록 특별 승인으로")
--   · 교적과 연결하지 않고 정회원으로 올린다(member_status='정회원', member_key 비움) + 누구인지·왜인지(special_note)를 꼭 남긴다.
--   · 정회원과 같이 대시보드·자료실 등을 쓰지만, 교적이 없으니 헌금 조회·가정 합산·성도 문서는 비어 있다(my_member_keys 가 없음).
--   · 관리자(admins)만 한다. 권한 변경 기록(access_log)에 '특별 승인'으로 남는다.
--   · 나중에 교적과 연결해 정회원으로 바꾸거나 준회원으로 내리면(admin_set_member) 특별 승인 표시는 저절로 지워진다.
-- Supabase → SQL Editor 에 1회 실행. 여러 번 실행해도 안전하다.

alter table public.member_links add column if not exists special_note text;
alter table public.member_links add column if not exists special_at timestamptz;

create or replace function public.admin_set_special(p_uid uuid, p_note text)
returns json language plpgsql security definer set search_path to 'public' as $function$
declare
  v_note text := btrim(coalesce(p_note, ''));
begin
  if not exists (select 1 from public.admins where uid = auth.uid()) then
    return json_build_object('ok', false, 'error', '관리자만 가능합니다.');
  end if;
  if length(v_note) < 2 then
    raise exception '특별 승인하는 까닭(어떤 분인지)을 적어 주세요.';
  end if;
  if length(v_note) > 200 then v_note := left(v_note, 200); end if;
  if not exists (select 1 from public.profiles where id = p_uid) then
    raise exception '그 회원을 찾지 못했습니다.';
  end if;
  insert into public.member_links (user_id, member_status, member_key, spouse_key, special_note, special_at, updated_at)
  values (p_uid, '정회원', null, null, v_note, now(), now())
  on conflict (user_id) do update set
    member_status = '정회원',
    member_key    = null,
    spouse_key    = null,
    special_note  = v_note,
    special_at    = now(),
    updated_at    = now();
  insert into public.access_log(actor, target, what, detail)
  values (auth.uid(), p_uid, '특별 승인', jsonb_build_object('note', v_note));
  return json_build_object('ok', true);
end $function$;
revoke all on function public.admin_set_special(uuid, text) from public, anon;
grant execute on function public.admin_set_special(uuid, text) to authenticated;

-- 교적 연결 정회원·준회원으로 바꿀 때는 특별 승인 표시를 지운다(그 밖은 2026-10-04 판과 같음)
create or replace function public.admin_set_member(p_uid uuid, p_status text, p_member_key text, p_member_name text)
returns json language plpgsql security definer set search_path to 'public' as $function$
declare
  v_spousekey  text := '';
  v_other      uuid;
  v_other_name text;
  v_other_prov text;
begin
  if not exists (select 1 from public.admins where uid = auth.uid()) then
    return json_build_object('ok', false, 'error', '관리자만 가능합니다.');
  end if;
  if p_status = '정회원' and coalesce(p_member_key, '') <> '' then
    select l.user_id, coalesce(nullif(pr.name, ''), l.member_name, ''), coalesce(u.raw_app_meta_data->>'provider', 'email')
      into v_other, v_other_name, v_other_prov
      from public.member_links l
      left join public.profiles pr on pr.id = l.user_id
      left join auth.users u on u.id = l.user_id
     where l.member_key = p_member_key and l.member_status = '정회원' and l.user_id <> p_uid
     limit 1;
    if v_other is not null then
      raise exception '이 교인은 이미 다른 계정(% · % 가입)에 정회원으로 연결되어 있습니다. 한 분은 한 계정만 쓸 수 있어요 — 겹친 계정을 합친 뒤에 승인해 주세요.',
        v_other_name, case when v_other_prov = 'kakao' then '카카오' else '이메일' end;
    end if;
    select coalesce(spouse_key, '') into v_spousekey from public.gyojeok where member_key = p_member_key limit 1;
  end if;
  insert into public.member_links (user_id, member_status, member_key, member_name, spouse_key, updated_at)
  values (p_uid, p_status, nullif(p_member_key, ''), nullif(p_member_name, ''), nullif(v_spousekey, ''), now())
  on conflict (user_id) do update set
    member_status = excluded.member_status,
    member_key    = excluded.member_key,
    member_name   = coalesce(excluded.member_name, public.member_links.member_name),
    spouse_key    = excluded.spouse_key,
    special_note  = null,
    special_at    = null,
    updated_at    = now();
  return json_build_object('ok', true);
end $function$;

-- 권한 관리 목록에 특별 승인 표시(special·specialNote)를 더한다(그 밖은 2026-10-04 판과 같음)
create or replace function public.list_access()
returns json language sql security definer set search_path to 'public' as $function$
  select coalesce(json_agg(row), '[]'::json) from (
    select json_build_object(
      'uid', p.id, 'name', coalesce(l.member_name, p.name, ''), 'email', coalesce(p.email,''),
      'status',         coalesce(l.member_status,'준회원'),
      'special',        (coalesce(l.member_status,'') = '정회원' and coalesce(l.special_note,'') <> ''),
      'specialNote',    coalesce(l.special_note, ''),
      'specialAt',      l.special_at,
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
