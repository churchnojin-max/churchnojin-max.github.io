-- ============================================================
--  ○○교회 — 재정/교적 Supabase 완전 전환 (Apps Script 대체)
--  Supabase ▸ SQL Editor 에 붙여넣고 Run (1회).
--  선행: offerings.sql, gyojeok.sql 실행됨.
--  의존 기존 테이블: admins(uid), profiles(id,name,email),
--    member_links(user_id UNIQUE, member_status, member_name, member_key, can_finance, spouse_key)
-- ============================================================

-- 공통 보안 함수(이미 있으면 갱신) ----------------------------------------
create or replace function public.is_finance()
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from public.admins a where a.uid = auth.uid())
      or exists(select 1 from public.member_links m where m.user_id = auth.uid() and m.can_finance = true)
$$;

create or replace function public.my_member_keys()
returns setof text language sql security definer stable set search_path = public as $$
  select member_key from public.member_links where user_id = auth.uid() and coalesce(member_key,'') <> ''
  union
  select spouse_key from public.member_links where user_id = auth.uid() and coalesce(spouse_key,'') <> ''
$$;

-- ── 마스터/거래 테이블 ───────────────────────────────────────────────
create table if not exists public.accounts (   -- 계정과목
  id bigint generated always as identity primary key,
  code text, atype text,            -- atype: 수입 / 지출
  category text, name text,         -- category=상위계정, name=계정명
  sort int default 0
);

create table if not exists public.services (   -- 예배
  id bigint generated always as identity primary key,
  name text, sort int default 0, active boolean default true
);

create table if not exists public.budget (     -- 예산
  id bigint generated always as identity primary key,
  code text, name text, atype text,
  prev_budget bigint default 0, prev_actual bigint default 0, budget bigint default 0
);

create table if not exists public.expenses (   -- 지출 전표
  id bigint generated always as identity primary key,
  exp_date date, account text, category text, payee text,
  amount integer not null default 0, method text, memo text,
  created_by uuid default auth.uid(), created_at timestamptz default now()
);
create index if not exists expenses_date_idx on public.expenses(exp_date);

-- offerings(헌금)에 항목/예배 입력분 대비 컬럼 보강(이미 있으면 무시)
alter table public.offerings add column if not exists created_by uuid;

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.accounts enable row level security;
alter table public.services enable row level security;
alter table public.budget   enable row level security;
alter table public.expenses enable row level security;

do $$ begin
  -- 마스터(accounts/services/budget): 재정권한자만 조회·수정
  drop policy if exists accounts_all on public.accounts;
  create policy accounts_all on public.accounts for all using (public.is_finance()) with check (public.is_finance());
  drop policy if exists services_all on public.services;
  create policy services_all on public.services for all using (public.is_finance()) with check (public.is_finance());
  drop policy if exists budget_all on public.budget;
  create policy budget_all on public.budget for all using (public.is_finance()) with check (public.is_finance());
  drop policy if exists expenses_all on public.expenses;
  create policy expenses_all on public.expenses for all using (public.is_finance()) with check (public.is_finance());
end $$;

-- ============================================================
--  RPC (security definer) — Apps Script 대체 권한 작업
-- ============================================================

-- 교적 인증(이름+생년월일 → 정/준회원 기록). actionMatch_ 대체.
create or replace function public.match_member(p_name text, p_birth text)
returns json language plpgsql security definer set search_path = public as $$
declare v_key text; v_g public.gyojeok%rowtype; v_found boolean := false;
begin
  if coalesce(p_name,'') = '' or p_birth !~ '^[0-9]{8}$' then
    return json_build_object('ok', false, 'error', '이름과 생년월일(YYYYMMDD)을 정확히 입력하세요.');
  end if;
  v_key := p_name || '|' || p_birth;
  select * into v_g from public.gyojeok where member_key = v_key limit 1;
  v_found := found;
  insert into public.member_links(user_id, member_status, member_key, member_name, spouse_key, updated_at)
  values (auth.uid(), case when v_found then '정회원' else '준회원' end, v_key, p_name,
          case when v_found then coalesce(v_g.spouse_key,'') else null end, now())
  on conflict (user_id) do update set
    member_status = excluded.member_status, member_key = excluded.member_key,
    member_name = excluded.member_name,
    spouse_key = coalesce(excluded.spouse_key, public.member_links.spouse_key),
    updated_at = now();
  if v_found then
    return json_build_object('ok', true, 'status', '정회원', 'name', p_name);
  else
    return json_build_object('ok', true, 'status', '준회원', 'message', '교적에서 이름+생년월일이 일치하지 않습니다. 관리자 승인 후 정회원이 됩니다.');
  end if;
end $$;

-- 내 상태(정/준회원·매칭키·배우자·재정권한). actionMe_ 대체. + spouse_key 동기화.
create or replace function public.my_profile()
returns json language plpgsql security definer set search_path = public as $$
declare v_link public.member_links%rowtype; v_g public.gyojeok%rowtype;
        v_spouse text := ''; v_spousekey text := '';
begin
  select * into v_link from public.member_links where user_id = auth.uid() limit 1;
  if v_link.member_status = '정회원' and coalesce(v_link.member_key,'') <> '' then
    select * into v_g from public.gyojeok where member_key = v_link.member_key limit 1;
    if found then
      v_spouse := coalesce(v_g.spouse,''); v_spousekey := coalesce(v_g.spouse_key,'');
      update public.member_links set spouse_key = v_spousekey
        where user_id = auth.uid() and coalesce(spouse_key,'') <> v_spousekey;
    end if;
  end if;
  return json_build_object(
    'status', coalesce(v_link.member_status, '준회원'),
    'memberName', coalesce(v_link.member_name, ''),
    'memberKey', coalesce(v_link.member_key, ''),
    'spouse', v_spouse, 'spouseKey', v_spousekey,
    'canFinance', (exists(select 1 from public.admins where uid = auth.uid()) or coalesce(v_link.can_finance, false))
  );
end $$;

-- 권한 목록(관리자만). actionListAccess_ 대체.
create or replace function public.list_access()
returns json language sql security definer set search_path = public as $$
  select coalesce(json_agg(row), '[]'::json) from (
    select json_build_object(
      'uid', p.id, 'name', coalesce(l.member_name, p.name, ''), 'email', coalesce(p.email,''),
      'status', coalesce(l.member_status,'준회원'), 'canFinance', coalesce(l.can_finance,false),
      'isAdmin', exists(select 1 from public.admins a where a.uid = p.id)
    ) as row
    from public.profiles p left join public.member_links l on l.user_id = p.id
    where exists(select 1 from public.admins where uid = auth.uid())
    order by exists(select 1 from public.admins a where a.uid = p.id) desc, coalesce(l.member_name, p.name)
  ) t;
$$;

-- 권한 부여/회수(관리자만). actionSetAccess_ 대체.
create or replace function public.set_access(p_uid uuid, p_is_admin boolean, p_can_finance boolean)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.admins where uid = auth.uid()) then
    return json_build_object('ok', false, 'error', '관리자만 가능합니다.');
  end if;
  if p_is_admin is not null then
    if p_is_admin then insert into public.admins(uid) values (p_uid) on conflict (uid) do nothing;
    else delete from public.admins where uid = p_uid; end if;
  end if;
  if p_can_finance is not null then
    insert into public.member_links(user_id, can_finance, updated_at) values (p_uid, p_can_finance, now())
    on conflict (user_id) do update set can_finance = p_can_finance, updated_at = now();
  end if;
  return json_build_object('ok', true);
end $$;

-- 정회원 승격 시 헌금조회 즉시 가능하도록: 교적 매칭키 기준 정회원 자동 승격은
-- 관리자 화면(권한관리)에서 set_access 로 처리.

-- ── 기본 예배(services) 시드 (없을 때만) ──────────────────────────────
insert into public.services (name, sort)
select x.name, x.sort from (values
  ('주일 낮 예배',1),('주일 오후 예배',2),('수요 예배',3),('금요 기도회',4),('새벽 기도회',5)
) as x(name, sort)
where not exists (select 1 from public.services);
