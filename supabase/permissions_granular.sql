-- ============================================================
--  노진교회 — 권한 세분화
--  Supabase ▸ SQL Editor 에 붙여넣고 Run (1회).
--
--  왜 필요한가:
--    지금은 권한이 사실상 2단계뿐이다.
--      · admins 테이블에 uid 가 있으면  → 거의 모든 RLS 를 통과(전권)
--      · member_links.can_finance = true → 재정만 추가
--    그래서 "재정만 맡기고 싶은 분"에게 관리자를 주면 교적·설교·설정까지 다 열렸다.
--
--  어떻게 바꾸나:
--    영역별 권한 컬럼을 member_links 에 추가하고, 영역별 판정 함수를 만든다.
--    각 함수는 항상 `관리자이거나 OR 해당 권한` 으로 판정한다.
--      → 기존 관리자(담임목사)는 지금과 똑같이 전부 되므로 잠길 위험이 없다.
--      → 앞으로는 관리자로 올리지 말고 필요한 영역 권한만 주면 된다.
--
--  안전: add column if not exists / create or replace 라서 여러 번 실행해도 안전하고,
--        기존 RLS 정책은 이 파일에서 건드리지 않는다(호환 유지).
-- ============================================================

-- ── 1) 영역별 권한 컬럼 ──────────────────────────────────────
alter table public.member_links
  add column if not exists can_gyojeok  boolean not null default false,  -- 교적관리(교인 명단·가계도·교인번호)
  add column if not exists can_homepage boolean not null default false,  -- 홈페이지 설정(로고·배너·소개글·사진)
  add column if not exists can_worship  boolean not null default false,  -- 예배관리(이달의 찬양·예배자료실·주보)
  add column if not exists can_affairs  boolean not null default false,  -- 목회행정(심방·상담·설교관리)
  add column if not exists can_board    boolean not null default false;  -- 게시판(공지·앨범·나눔터 관리)

comment on column public.member_links.can_gyojeok  is '교적관리 권한';
comment on column public.member_links.can_homepage is '홈페이지 설정 권한';
comment on column public.member_links.can_worship  is '예배·찬양·자료실 권한';
comment on column public.member_links.can_affairs  is '목회행정(심방·상담·설교) 권한';
comment on column public.member_links.can_board    is '게시판·앨범 관리 권한';

-- ── 2) 영역별 판정 함수 ──────────────────────────────────────
-- 최고관리자: admins 테이블. 전권을 가진다(기존과 동일).
create or replace function public.is_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists(select 1 from public.admins a where a.uid = auth.uid())
$$;

-- 아래 함수들은 모두 '관리자이거나 OR 해당 영역 권한'.
create or replace function public.can_gyojeok()
returns boolean language sql security definer stable
set search_path = public as $$
  select public.is_admin()
      or exists(select 1 from public.member_links m where m.user_id = auth.uid() and m.can_gyojeok)
$$;

create or replace function public.can_homepage()
returns boolean language sql security definer stable
set search_path = public as $$
  select public.is_admin()
      or exists(select 1 from public.member_links m where m.user_id = auth.uid() and m.can_homepage)
$$;

create or replace function public.can_worship()
returns boolean language sql security definer stable
set search_path = public as $$
  select public.is_admin()
      or exists(select 1 from public.member_links m where m.user_id = auth.uid() and m.can_worship)
$$;

create or replace function public.can_affairs()
returns boolean language sql security definer stable
set search_path = public as $$
  select public.is_admin()
      or exists(select 1 from public.member_links m where m.user_id = auth.uid() and m.can_affairs)
$$;

create or replace function public.can_board()
returns boolean language sql security definer stable
set search_path = public as $$
  select public.is_admin()
      or exists(select 1 from public.member_links m where m.user_id = auth.uid() and m.can_board)
$$;

-- is_finance() 는 이미 57곳의 RLS 가 쓰고 있어 이름을 그대로 둔다(재정 영역 판정).
create or replace function public.is_finance()
returns boolean language sql security definer stable
set search_path = public as $$
  select public.is_admin()
      or exists(select 1 from public.member_links m where m.user_id = auth.uid() and m.can_finance)
$$;

-- ── 3) 권한 목록 조회 (관리자 전용) ──────────────────────────
-- 가입 시각(created_at)도 같이 준다 — 대시보드의 '정회원 승인 대기' 목록에서
-- 최근 가입자를 먼저 보여주기 위함.
create or replace function public.list_access()
returns json language sql security definer set search_path = public as $$
  select coalesce(json_agg(row), '[]'::json) from (
    select json_build_object(
      'uid', p.id, 'name', coalesce(l.member_name, p.name, ''), 'email', coalesce(p.email,''),
      'status',      coalesce(l.member_status,'준회원'),
      'isAdmin',     exists(select 1 from public.admins a where a.uid = p.id),
      'canFinance',  coalesce(l.can_finance,false),
      'canGyojeok',  coalesce(l.can_gyojeok,false),
      'canHomepage', coalesce(l.can_homepage,false),
      'canWorship',  coalesce(l.can_worship,false),
      'canAffairs',  coalesce(l.can_affairs,false),
      'canBoard',    coalesce(l.can_board,false),
      'joinedAt',    p.created_at
    ) as row
    from public.profiles p left join public.member_links l on l.user_id = p.id
    where exists(select 1 from public.admins where uid = auth.uid())
    order by exists(select 1 from public.admins a where a.uid = p.id) desc, coalesce(l.member_name, p.name)
  ) t;
$$;

-- ── 4) 권한 저장 (관리자 전용) ───────────────────────────────
-- null 로 넘긴 항목은 건드리지 않는다(체크박스 하나만 바꿔도 되도록).
create or replace function public.set_access(
  p_uid uuid,
  p_is_admin     boolean default null,
  p_can_finance  boolean default null,
  p_can_gyojeok  boolean default null,
  p_can_homepage boolean default null,
  p_can_worship  boolean default null,
  p_can_affairs  boolean default null,
  p_can_board    boolean default null
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
     or p_can_worship is not null or p_can_affairs is not null or p_can_board is not null then
    insert into public.member_links(user_id, updated_at) values (p_uid, now())
      on conflict (user_id) do update set updated_at = now();
    update public.member_links set
      can_finance  = coalesce(p_can_finance,  can_finance),
      can_gyojeok  = coalesce(p_can_gyojeok,  can_gyojeok),
      can_homepage = coalesce(p_can_homepage, can_homepage),
      can_worship  = coalesce(p_can_worship,  can_worship),
      can_affairs  = coalesce(p_can_affairs,  can_affairs),
      can_board    = coalesce(p_can_board,    can_board),
      updated_at   = now()
    where user_id = p_uid;
  end if;

  return json_build_object('ok', true);
end $$;

-- ── 5) 내 권한 조회 (로그인한 본인) ──────────────────────────
-- 화면에서 메뉴를 보여줄지 말지 정할 때 쓴다. RLS 를 대신하는 게 아니라 '표시용'이다.
create or replace function public.my_perms()
returns json language sql security definer stable
set search_path = public as $$
  select json_build_object(
    'isAdmin',     public.is_admin(),
    'canFinance',  public.is_finance(),
    'canGyojeok',  public.can_gyojeok(),
    'canHomepage', public.can_homepage(),
    'canWorship',  public.can_worship(),
    'canAffairs',  public.can_affairs(),
    'canBoard',    public.can_board(),
    'status',      coalesce((select member_status from public.member_links where user_id = auth.uid()), '준회원')
  )
$$;
