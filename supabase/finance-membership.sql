-- ============================================================
-- ○○교회 — 정회원/준회원 + 재정관리 권한 (교적 연동)
-- Supabase ▸ SQL Editor 에 통째로 붙여넣고 Run 하세요. (여러 번 실행해도 안전)
--
-- [설계]
--  - 교적 매칭(이름+생년월일) 결과와 '재정관리' 접근 권한을 담는 표입니다.
--  - 보안: 회원 본인은 자기 상태를 "읽기"만 가능, "쓰기"는 관리자(admins) 또는
--    서버(Apps Script의 service_role)만 가능 → 스스로 정회원/재정권한 승격 불가.
--  - 헌금 등 재정 데이터 자체는 여기 저장하지 않습니다(구글시트에 보관).
--    이 표는 "이 로그인 계정이 교적의 누구인가 + 재정 접근 가능한가"만 담습니다.
-- ============================================================

-- ── 1) 회원-교적 연결 표 ─────────────────────────────────────
create table if not exists public.member_links (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  member_status  text    not null default '준회원',  -- '준회원' | '정회원'
  member_key     text,                               -- 교적 매칭키 (이름|YYYYMMDD)
  member_id      integer,                            -- 교적ID (구글시트 교적 탭)
  member_name    text,                               -- 매칭된 교적 이름
  can_finance    boolean not null default false,     -- 재정관리 페이지 접근 권한
  matched_at     timestamptz,                        -- 정회원 매칭 시각
  note           text,                               -- 관리자 메모(수동승인 사유 등)
  updated_at     timestamptz not null default now()
);

create index if not exists member_links_key_idx on public.member_links (member_key);

alter table public.member_links enable row level security;

-- PostgREST(REST API)에서 접근 가능하도록 권한 부여 (실제 차단은 아래 RLS가 함)
grant select, insert, update, delete on public.member_links to authenticated;

-- ── 2) RLS 정책 ─────────────────────────────────────────────
-- (가) 조회: 본인 또는 관리자
drop policy if exists "member_links_select" on public.member_links;
create policy "member_links_select" on public.member_links
  for select using (
    auth.uid() = user_id
    or auth.uid() in (select uid from public.admins)
  );

-- (나) 쓰기(등록/수정/삭제): 관리자만.
--      일반 회원에게는 쓰기 정책이 없으므로 RLS가 자동 차단합니다.
--      Apps Script는 service_role 키로 호출 → RLS를 우회해 매칭 결과를 기록합니다.
drop policy if exists "member_links_admin_write" on public.member_links;
create policy "member_links_admin_write" on public.member_links
  for all
  using      (auth.uid() in (select uid from public.admins))
  with check (auth.uid() in (select uid from public.admins));

-- ── 3) 편의 함수: 현재 로그인 사용자의 재정 접근 가능 여부 ─────
--     (관리자이거나 can_finance=true 이면 true)
create or replace function public.can_access_finance()
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    exists (select 1 from public.admins a where a.uid = auth.uid())
    or exists (select 1 from public.member_links m
               where m.user_id = auth.uid() and m.can_finance = true);
$$;

-- ============================================================
-- ★ 운영 참고 (수동 작업 예시) ★
--
-- 1) 특정 회원에게 '재정관리' 권한 주기 (UID는 Authentication ▸ Users에서 확인):
--    insert into public.member_links (user_id, can_finance, member_status)
--    values ('여기에-UID', true, '정회원')
--    on conflict (user_id) do update set can_finance = true;
--
-- 2) 생년월일 미입력 교인(영유아 등) 수동 정회원 승인:
--    update public.member_links
--      set member_status = '정회원', member_id = 82, member_name = '김준상',
--          matched_at = now(), note = '생년월일 미입력 수동승인'
--      where user_id = '여기에-UID';
--
-- 3) 관리자 본인(목사님)은 admins 테이블에 있으면 can_access_finance()가 자동 true.
-- ============================================================
