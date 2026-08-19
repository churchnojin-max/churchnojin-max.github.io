-- ============================================================
--  노진교회 — 교적(gyojeok) 권한을 영역 권한으로 전환
--  Supabase ▸ SQL Editor 에 붙여넣고 Run (1회).
--  선행: supabase/permissions_granular.sql 을 먼저 실행해야 한다(can_gyojeok 함수 필요).
--
--  지금까지:
--    select/insert/update/delete 모두 is_finance() 하나로 판정했다.
--    → 재정만 맡은 분도 교적을 '수정'할 수 있었다.
--
--  바꾼 뒤:
--    · 읽기(select) : can_gyojeok() 또는 is_finance()
--        재정 페이지가 헌금자 이름을 교적에서 찾아 매칭하므로 재정 담당자도 읽어야 한다.
--        (js/finance-api.js 의 'masters' 가 gyojeok 전체를 읽는다)
--    · 쓰기         : can_gyojeok() 만
--        교적 추가·수정·삭제는 교적 담당자(와 관리자)만.
--
--  ※ can_gyojeok() 은 내부에서 is_admin() 을 포함하므로 관리자는 계속 전부 가능하다.
-- ============================================================

-- 기존 정책 제거(이름이 다르면 아래 select 로 확인 후 맞춰서 지울 것)
drop policy if exists gyojeok_select on public.gyojeok;
drop policy if exists gyojeok_write  on public.gyojeok;

-- 읽기: 교적 담당자 + 재정 담당자(헌금자 매칭에 필요)
create policy gyojeok_select on public.gyojeok
  for select using ( public.can_gyojeok() or public.is_finance() );

-- 쓰기: 교적 담당자만
create policy gyojeok_insert on public.gyojeok
  for insert with check ( public.can_gyojeok() );

create policy gyojeok_update on public.gyojeok
  for update using ( public.can_gyojeok() ) with check ( public.can_gyojeok() );

create policy gyojeok_delete on public.gyojeok
  for delete using ( public.can_gyojeok() );

-- 확인용: 적용된 정책 목록
select policyname, cmd, qual, with_check
from pg_policies where schemaname = 'public' and tablename = 'gyojeok'
order by policyname;
