-- 특별 승인 신청서·점검표·추천인 보증·1년 기한 (2026-10-08 목사님)
--   "스스로 어느 교회 소속인지, 직분은 무엇인지, 이 사람을 알릴 수 있는 방법… 기본적인 자기 신상을 넣을 수 있도록,
--    확실하게 허락을 해야 될지 말아야 될지 알 수 있는 기준… 유령 회원을 막을 수 있게"
--   고르신 것: ① 신청서 + ② 점검표 ③ 1년마다 다시 확인 ④ 텔레그램 알림 ⑤ 추천인 보증(최고 운영자도 누를 수 있게), 휴대폰 번호 필수
--   · special_requests: 본인이 쓰는 신청서. 표를 직접 읽고 쓰지 못하게 막고(RLS, 정책 없음) 아래 함수로만.
--   · 점검표(신호)는 admin_special_requests() 가 계산한다 — IP 는 화면에 내보내지 않고 '같은 기기·인터넷으로 다른 계정' 수만.
--   · 승인(decide_special_request)하면 member_links: 정회원 + special_note·special_at·special_until(1년).
--   · 기한이 지나면 매일 새벽 준회원으로(기록 남김), 거절한 신청의 신상은 30일 뒤 지운다.
--   · 새 신청은 PC 의 tools/login_watch.py 가 5분마다 보고 목사님 텔레그램으로 '신청 N건'만 알린다(신상은 안 보냄).
-- 앞의 special_member_20261008.sql 다음에 1회 실행. 여러 번 실행해도 안전하다.

alter table public.member_links add column if not exists special_until timestamptz;

create table if not exists public.special_requests (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  real_name     text not null,
  church        text not null,
  region        text not null,
  denomination  text,
  office        text not null,
  referrer_name text not null,
  phone         text not null,
  reason        text,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  vouched_by    uuid,
  vouched_at    timestamptz,
  vouch_kind    text check (vouch_kind in ('referrer','owner','denied')),
  notified      boolean not null default false,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid,
  decide_note   text
);
create unique index if not exists special_requests_one_pending on public.special_requests (user_id) where status = 'pending';
create index if not exists special_requests_status_idx on public.special_requests (status, created_at desc);
alter table public.special_requests enable row level security;
revoke all on public.special_requests from anon, authenticated;

-- 이 계정이 교적과 연결된 정회원이면 그 교적 이름(추천인 확인용)
create or replace function public.my_gyojeok_name() returns text
language sql stable security definer set search_path = public as $$
  select g.name from public.member_links l join public.gyojeok g on g.member_key = l.member_key
   where l.user_id = auth.uid() and l.member_status = '정회원' and l.member_key is not null limit 1;
$$;
revoke all on function public.my_gyojeok_name() from public, anon;
grant execute on function public.my_gyojeok_name() to authenticated;

-- ① 신청서 내기(본인)
create or replace function public.submit_special_request(p_real_name text, p_church text, p_region text, p_denomination text,
                                                         p_office text, p_referrer text, p_phone text, p_reason text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_n     int;
begin
  if v_uid is null then raise exception '로그인한 뒤에 신청할 수 있습니다.'; end if;
  if exists (select 1 from public.member_links where user_id = v_uid and member_status = '정회원') then
    raise exception '이미 정회원입니다.';
  end if;
  if length(btrim(coalesce(p_real_name,''))) < 2 or length(btrim(coalesce(p_church,''))) < 2 or length(btrim(coalesce(p_region,''))) < 2
     or length(btrim(coalesce(p_office,''))) < 1 or length(btrim(coalesce(p_referrer,''))) < 2 then
    raise exception '이름·소속 교회·지역·직분·추천인을 모두 적어 주세요.';
  end if;
  if v_phone !~ '^01[016789][0-9]{7,8}$' then raise exception '휴대폰 번호를 정확히 적어 주세요(예: 010-1234-5678).'; end if;
  select count(*) into v_n from public.special_requests where user_id = v_uid and created_at > now() - interval '1 day';
  if v_n >= 3 then raise exception '오늘은 더 신청할 수 없습니다. 내일 다시 해 주세요.'; end if;
  delete from public.special_requests where user_id = v_uid and status = 'pending';   -- 고쳐서 다시 내면 앞의 것을 바꾼다
  insert into public.special_requests (user_id, real_name, church, region, denomination, office, referrer_name, phone, reason)
  values (v_uid, left(btrim(p_real_name),40), left(btrim(p_church),60), left(btrim(p_region),40), nullif(left(btrim(coalesce(p_denomination,'')),40),''),
          left(btrim(p_office),20), left(btrim(p_referrer),40),
          substr(v_phone,1,3) || '-' || substr(v_phone,4,length(v_phone)-7) || '-' || right(v_phone,4),
          nullif(left(btrim(coalesce(p_reason,'')),200),''));
  return json_build_object('ok', true);
end $$;
revoke all on function public.submit_special_request(text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.submit_special_request(text,text,text,text,text,text,text,text) to authenticated;

-- 내 신청 상태(본인)
create or replace function public.my_special_request() returns json
language sql stable security definer set search_path = public as $$
  select coalesce((select json_build_object('status', status, 'church', church, 'office', office, 'referrer', referrer_name,
                                            'createdAt', created_at, 'decidedAt', decided_at)
                     from public.special_requests where user_id = auth.uid() order by id desc limit 1), 'null'::json);
$$;
revoke all on function public.my_special_request() from public, anon;
grant execute on function public.my_special_request() to authenticated;

-- ⑤ 추천인 보증 — 나를 추천인으로 적은 대기 중 신청(정회원 본인) · 최고 운영자는 모두
create or replace function public.my_vouch_requests() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', r.id, 'name', r.real_name, 'church', r.church, 'region', r.region,
                                             'office', r.office, 'createdAt', r.created_at) order by r.id), '[]'::json)
    from public.special_requests r
   where r.status = 'pending' and r.vouched_by is null
     and r.referrer_name = public.my_gyojeok_name();
$$;
revoke all on function public.my_vouch_requests() from public, anon;
grant execute on function public.my_vouch_requests() to authenticated;

create or replace function public.vouch_special_request(p_id bigint, p_yes boolean) returns json
language plpgsql security definer set search_path = public as $$
declare r public.special_requests; v_kind text;
begin
  select * into r from public.special_requests where id = p_id and status = 'pending';
  if r.id is null then raise exception '대기 중인 신청을 찾지 못했습니다.'; end if;
  if public.am_owner() then v_kind := 'owner';
  elsif r.referrer_name = public.my_gyojeok_name() then v_kind := 'referrer';
  else raise exception '추천인으로 적힌 분이나 최고 운영자만 보증할 수 있습니다.';
  end if;
  if not p_yes then v_kind := 'denied'; end if;
  update public.special_requests set vouched_by = auth.uid(), vouched_at = now(), vouch_kind = v_kind where id = p_id;
  return json_build_object('ok', true, 'kind', v_kind);
end $$;
revoke all on function public.vouch_special_request(bigint, boolean) from public, anon;
grant execute on function public.vouch_special_request(bigint, boolean) to authenticated;

-- ② 점검표 — 관리자만. 대기 중 + 최근 30일 결정한 것
create or replace function public.admin_special_requests() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.admins where uid = auth.uid()) then raise exception '관리자만 볼 수 있습니다.'; end if;
  return coalesce((select json_agg(x order by (x->>'status') <> 'pending', (x->>'id')::bigint desc) from (
    select json_build_object(
      'id', r.id, 'uid', r.user_id, 'status', r.status, 'name', r.real_name, 'church', r.church, 'region', r.region,
      'denomination', coalesce(r.denomination,''), 'office', r.office, 'referrer', r.referrer_name, 'phone', r.phone,
      'reason', coalesce(r.reason,''), 'createdAt', r.created_at, 'decidedAt', r.decided_at,
      'email', coalesce(p.email,''), 'provider', coalesce(u.raw_app_meta_data->>'provider','email'),
      'signupName', coalesce(nullif(u.raw_user_meta_data->>'real_name',''), nullif(p.name,''), u.raw_user_meta_data->>'name', ''),
      'joinedAt', u.created_at,
      'minutesToApply', floor(extract(epoch from (r.created_at - u.created_at)) / 60),
      'referrerMembers', (select count(*) from public.member_links l join public.gyojeok g on g.member_key = l.member_key
                           where l.member_status = '정회원' and g.name = r.referrer_name),
      'referrerInGyojeok', (select count(*) from public.gyojeok g where g.name = r.referrer_name),
      'vouchKind', coalesce(r.vouch_kind,''), 'vouchedAt', r.vouched_at,
      'vouchedByName', coalesce((select coalesce(nullif(pp.name,''), ll.member_name, '') from public.profiles pp
                                   left join public.member_links ll on ll.user_id = pp.id where pp.id = r.vouched_by), ''),
      'foreignLogin', exists(select 1 from public.login_log lg where lg.user_id = r.user_id and coalesce(lg.country,'KR') not in ('KR','')),
      'sharedAccounts', (select count(distinct lg2.user_id) from public.login_log lg1 join public.login_log lg2
                           on lg2.ip = lg1.ip and lg2.user_id <> lg1.user_id and lg2.at > now() - interval '60 days'
                          where lg1.user_id = r.user_id and lg1.at > now() - interval '60 days' and coalesce(lg1.ip,'') <> ''),
      'logins', (select count(*) from public.login_log lg where lg.user_id = r.user_id)
    ) as x
    from public.special_requests r
    left join public.profiles p on p.id = r.user_id
    left join auth.users u on u.id = r.user_id
    where r.status = 'pending' or r.decided_at > now() - interval '30 days'
  ) t), '[]'::json);
end $$;
revoke all on function public.admin_special_requests() from public, anon;
grant execute on function public.admin_special_requests() to authenticated;

-- 승인·거절(관리자)
create or replace function public.decide_special_request(p_id bigint, p_approve boolean, p_note text default null)
returns json language plpgsql security definer set search_path = public as $$
declare r public.special_requests; v_note text;
begin
  if not exists (select 1 from public.admins where uid = auth.uid()) then raise exception '관리자만 할 수 있습니다.'; end if;
  select * into r from public.special_requests where id = p_id and status = 'pending';
  if r.id is null then raise exception '대기 중인 신청을 찾지 못했습니다.'; end if;
  if p_approve then
    v_note := left(r.church || ' (' || r.region || ') · ' || r.office || ' · 추천 ' || r.referrer_name ||
                   case r.vouch_kind when 'referrer' then '(보증함)' when 'owner' then '(최고 운영자 보증)' else '' end, 200);
    insert into public.member_links (user_id, member_status, member_key, spouse_key, member_name, special_note, special_at, special_until, updated_at)
    values (r.user_id, '정회원', null, null, r.real_name, v_note, now(), now() + interval '1 year', now())
    on conflict (user_id) do update set member_status = '정회원', member_key = null, spouse_key = null,
      member_name = coalesce(public.member_links.member_name, excluded.member_name),
      special_note = v_note, special_at = now(), special_until = now() + interval '1 year', updated_at = now();
    insert into public.access_log(actor, target, what, detail) values (auth.uid(), r.user_id, '특별 승인', jsonb_build_object('note', v_note, 'request', r.id));
  else
    insert into public.access_log(actor, target, what, detail) values (auth.uid(), r.user_id, '특별 승인 거절', jsonb_build_object('request', r.id));
  end if;
  update public.special_requests set status = case when p_approve then 'approved' else 'rejected' end,
         decided_at = now(), decided_by = auth.uid(), decide_note = nullif(left(btrim(coalesce(p_note,'')),200),'')
   where id = p_id;
  return json_build_object('ok', true);
end $$;
revoke all on function public.decide_special_request(bigint, boolean, text) from public, anon;
grant execute on function public.decide_special_request(bigint, boolean, text) to authenticated;

-- ③ 1년 기한 — 손으로 특별 승인할 때도 1년, 연장은 지금(또는 남은 기한)부터 1년
create or replace function public.admin_set_special(p_uid uuid, p_note text)
returns json language plpgsql security definer set search_path to 'public' as $function$
declare
  v_note text := btrim(coalesce(p_note, ''));
begin
  if not exists (select 1 from public.admins where uid = auth.uid()) then
    return json_build_object('ok', false, 'error', '관리자만 가능합니다.');
  end if;
  if length(v_note) < 2 then raise exception '특별 승인하는 까닭(어떤 분인지)을 적어 주세요.'; end if;
  if length(v_note) > 200 then v_note := left(v_note, 200); end if;
  if not exists (select 1 from public.profiles where id = p_uid) then raise exception '그 회원을 찾지 못했습니다.'; end if;
  insert into public.member_links (user_id, member_status, member_key, spouse_key, special_note, special_at, special_until, updated_at)
  values (p_uid, '정회원', null, null, v_note, now(), now() + interval '1 year', now())
  on conflict (user_id) do update set member_status = '정회원', member_key = null, spouse_key = null,
    special_note = v_note, special_at = now(), special_until = now() + interval '1 year', updated_at = now();
  insert into public.access_log(actor, target, what, detail) values (auth.uid(), p_uid, '특별 승인', jsonb_build_object('note', v_note));
  return json_build_object('ok', true);
end $function$;

create or replace function public.admin_extend_special(p_uid uuid) returns json
language plpgsql security definer set search_path = public as $$
declare v_until timestamptz;
begin
  if not exists (select 1 from public.admins where uid = auth.uid()) then raise exception '관리자만 할 수 있습니다.'; end if;
  update public.member_links set member_status = '정회원', member_key = null,
         special_until = greatest(coalesce(special_until, now()), now()) + interval '1 year', updated_at = now()
   where user_id = p_uid and coalesce(special_note,'') <> ''
  returning special_until into v_until;
  if v_until is null then raise exception '특별 승인된 분이 아닙니다.'; end if;
  insert into public.access_log(actor, target, what, detail) values (auth.uid(), p_uid, '특별 승인 연장', jsonb_build_object('until', v_until));
  return json_build_object('ok', true, 'until', v_until);
end $$;
revoke all on function public.admin_extend_special(uuid) from public, anon;
grant execute on function public.admin_extend_special(uuid) to authenticated;

-- 기한 지난 특별 승인은 준회원으로(기록은 남김), 거절한 신청은 30일 뒤 지움 — 매일 새벽 3시 10분(한국)
create or replace function public.expire_special_members() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select user_id from public.member_links
            where member_status = '정회원' and coalesce(special_note,'') <> '' and special_until is not null and special_until < now() loop
    update public.member_links set member_status = '준회원', updated_at = now() where user_id = r.user_id;
    insert into public.access_log(actor, target, what, detail) values (null, r.user_id, '특별 승인 기한 지남', '{}'::jsonb);
  end loop;
  delete from public.special_requests where status = 'rejected' and decided_at < now() - interval '30 days';
end $$;
revoke all on function public.expire_special_members() from public, anon, authenticated;
do $$ begin
  perform cron.unschedule('special_member_expiry') where exists (select 1 from cron.job where jobname = 'special_member_expiry');
  perform cron.schedule('special_member_expiry', '10 18 * * *', 'select public.expire_special_members()');
end $$;

-- 권한 관리 목록: 특별 승인 기한·지난 것·마지막 로그인
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

-- 이미 특별 승인된 분(오늘 손으로 승인한 분)에게도 1년 기한
update public.member_links set special_until = coalesce(special_at, now()) + interval '1 year'
 where coalesce(special_note,'') <> '' and special_until is null;
