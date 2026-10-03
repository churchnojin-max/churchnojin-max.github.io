-- ============================================================
--  노진교회 홈페이지 — 오픈 전 보안 수정 (2026-10-03 점검 ①②③④)
--  2026-10-03 실제 DB 에 실행함(목사님 승인). 새 프로젝트를 만들거나 옛 SQL 을 다시 실행했다면
--  이 파일을 **맨 마지막에** 다시 실행해야 한다(옛 파일의 match_member·my_member_keys·list_access·보관함 규칙이 되살아나기 때문).
--  여러 번 실행해도 안전하다. 중간에 오류가 나면 아무것도 바뀌지 않는다(전부 되돌려짐).
--  되돌리기: 3_되돌리기.sql
--
--  바뀌는 것
--   ① 교적 인증: 이름+생년월일을 넣어도 바로 정회원이 되지 않는다. '신청'만 남고,
--      운영진이 교적관리 ▸ 권한 관리에서 정회원으로 바꿔야 연결된다.
--      헌금·가족·성도 문서는 승인된 정회원만 본다. 신청은 하루 5번까지.
--      (이미 정회원인 분들은 그대로다)
--   ② 공개 보관함(uploads): 로그인 안 한 사람이 파일 목록을 뽑을 수 없게 한다.
--      (사진·주보 공개 주소로 보는 것은 그대로 된다)
--   ③ 헌금 정리 기록표(offerings_match_log): 권한 거두기(잠금은 이미 켜져 있었음)
--   ④ 공개용 창(qt_published, bulletins_public)은 읽기만
-- ============================================================
begin;

-- ──────────────── ① 교적 인증: 신청 → 운영진 승인 ────────────────

-- 신청 기록(운영진만 본다). 본인도 읽지 못한다 — 맞았는지 틀렸는지 알려 주지 않기 위해서다.
create table if not exists public.member_match_requests (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  claim_name   text not null,
  claim_birth  text not null,
  matched      boolean not null default false,   -- 신청 당시 교적에 같은 이름·생년월일이 있었는가
  requested_at timestamptz not null default now()
);
alter table public.member_match_requests enable row level security;
revoke all on public.member_match_requests from anon, authenticated;
grant select on public.member_match_requests to authenticated;
drop policy if exists "match_requests_admin_read" on public.member_match_requests;
create policy "match_requests_admin_read" on public.member_match_requests
  for select to authenticated
  using (exists (select 1 from public.admins a where a.uid = auth.uid()));

-- 시도 횟수 기록(함수만 쓴다. 정책이 없으므로 누구도 직접 읽거나 쓸 수 없다)
create table if not exists public.member_match_attempts (
  id      bigint generated always as identity primary key,
  user_id uuid not null,
  at      timestamptz not null default now()
);
create index if not exists member_match_attempts_user_idx on public.member_match_attempts (user_id, at);
alter table public.member_match_attempts enable row level security;
revoke all on public.member_match_attempts from anon, authenticated;

-- 교적 인증: 이제 '신청'만 남긴다. 응답은 맞든 틀리든 같다.
create or replace function public.match_member(p_name text, p_birth text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_name   text := left(btrim(coalesce(p_name, '')), 40);
  v_status text;
  v_found  boolean;
  v_tries  int;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', '로그인이 필요합니다.');
  end if;
  if v_name = '' or coalesce(p_birth, '') !~ '^[0-9]{8}$' then
    return json_build_object('ok', false, 'error', '이름과 생년월일(YYYYMMDD)을 정확히 입력하세요.');
  end if;

  -- 이미 승인된 정회원은 바꾸지 않는다(다른 교인으로 갈아타는 것을 막는다)
  select member_status into v_status from public.member_links where user_id = v_uid;
  if v_status = '정회원' then
    return json_build_object('ok', true, 'status', '정회원',
      'name', (select member_name from public.member_links where user_id = v_uid));
  end if;

  -- 하루 5번까지만
  select count(*) into v_tries from public.member_match_attempts
   where user_id = v_uid and at > now() - interval '24 hours';
  if v_tries >= 5 then
    return json_build_object('ok', true, 'status', '준회원',
      'message', '오늘은 더 신청할 수 없습니다. 내일 다시 하시거나 교회로 연락해 주세요.');
  end if;
  insert into public.member_match_attempts (user_id) values (v_uid);

  v_found := exists (select 1 from public.gyojeok where member_key = v_name || '|' || p_birth);

  insert into public.member_match_requests (user_id, claim_name, claim_birth, matched, requested_at)
  values (v_uid, v_name, p_birth, v_found, now())
  on conflict (user_id) do update set
    claim_name = excluded.claim_name, claim_birth = excluded.claim_birth,
    matched = excluded.matched, requested_at = now();

  -- 연결표에는 이름만 적는다. 교적 번호(member_key)는 운영진이 승인할 때(admin_set_member) 들어간다.
  insert into public.member_links (user_id, member_status, member_key, member_name, spouse_key, updated_at)
  values (v_uid, '준회원', null, v_name, null, now())
  on conflict (user_id) do update set
    member_status = '준회원', member_key = null, spouse_key = null,
    member_name = excluded.member_name, updated_at = now();

  return json_build_object('ok', true, 'status', '준회원',
    'message', '신청이 접수되었습니다. 운영진이 확인한 뒤 정회원으로 승인해 드립니다.');
end $$;
revoke all on function public.match_member(text, text) from public, anon;
grant execute on function public.match_member(text, text) to authenticated;

-- 내 교적 번호(본인+배우자): 승인된 정회원일 때만 돌려준다.
-- 헌금(offerings)·성도 문서(member_files)·가족(my_family) 열람이 모두 이 함수를 거친다.
create or replace function public.my_member_keys()
returns setof text language sql security definer stable
set search_path = public as $$
  select member_key from public.member_links
   where user_id = auth.uid() and member_status = '정회원' and coalesce(member_key, '') <> ''
  union
  select spouse_key from public.member_links
   where user_id = auth.uid() and member_status = '정회원' and coalesce(spouse_key, '') <> ''
$$;

-- 승인 전(준회원) 계정에 남아 있는 '스스로 적은 번호'는 신청 기록으로 옮기고 지운다.
insert into public.member_match_requests (user_id, claim_name, claim_birth, matched, requested_at)
select l.user_id, split_part(l.member_key, '|', 1), split_part(l.member_key, '|', 2),
       exists (select 1 from public.gyojeok g where g.member_key = l.member_key),
       coalesce(l.updated_at, now())
  from public.member_links l
 where coalesce(l.member_status, '준회원') <> '정회원' and coalesce(l.member_key, '') like '%|%'
on conflict (user_id) do nothing;

update public.member_links
   set member_key = null, spouse_key = null
 where coalesce(member_status, '준회원') <> '정회원'
   and (member_key is not null or spouse_key is not null);

-- 운영진 목록(list_access)에 '교적 인증 신청' 내용을 덧붙인다(기존 칸은 그대로).
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
    order by exists(select 1 from public.admins a where a.uid = p.id) desc, coalesce(l.member_name, p.name)
  ) t;
$$;

-- ──────────────── ② 공개 보관함: 목록 조회 막기 ────────────────
-- 공개 주소(/object/public/uploads/…)로 사진·주보를 보는 것은 이 규칙과 상관없이 된다.
-- 이 규칙이 열려 있으면 로그인 안 한 사람도 '파일 목록'을 통째로 받을 수 있었다.
drop policy if exists "uploads public read" on storage.objects;
drop policy if exists "uploads read own or staff" on storage.objects;
create policy "uploads read own or staff" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'uploads' and (
      owner = auth.uid()
      or owner_id = auth.uid()::text
      or exists (select 1 from public.admins a where a.uid = auth.uid())
      or exists (select 1 from public.member_links m
                  where m.user_id = auth.uid()
                    and (m.can_finance or m.can_gyojeok or m.can_affairs or m.can_worship or m.can_homepage))
    )
  );

-- 한 파일 50MB 까지(지금까지는 제한이 없었다)
update storage.buckets set file_size_limit = 52428800
 where id = 'uploads' and file_size_limit is null;

-- ──────────────── ③ 헌금 정리 기록표 ────────────────
do $$ begin
  if to_regclass('public.offerings_match_log') is not null then
    execute 'alter table public.offerings_match_log enable row level security';
    execute 'revoke all on public.offerings_match_log from anon, authenticated';
  end if;
end $$;

-- ──────────────── ④ 공개용 창은 읽기만 ────────────────
revoke all on public.qt_published from anon, authenticated;
grant select on public.qt_published to anon, authenticated;
revoke all on public.bulletins_public from anon, authenticated;
grant select on public.bulletins_public to anon, authenticated;
do $$ begin
  if to_regclass('public.album_feed') is not null then
    execute 'revoke insert, update, delete, truncate, references, trigger on public.album_feed from anon, authenticated';
  end if;
end $$;

commit;
