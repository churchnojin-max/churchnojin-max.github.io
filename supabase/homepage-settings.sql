-- ============================================================
-- 홈페이지 설정 공개 읽기 정책
-- church_settings 테이블은 기존에 관리자만 읽고 쓸 수 있었으나,
-- 홈페이지(로고 · 섬기는 사람들 · 월별 봉사위원)에 표시할 값은
-- 로그인하지 않은 방문자도 읽을 수 있어야 한다.
-- 아래 키에 한해 익명(anon) SELECT 를 허용한다. (쓰기는 여전히 관리자 전용)
--   homepage   : 로고 dataURL · 섬기는 사람들
--   committees : 월별 봉사위원(교회행정 봉사위원과 통합)
--   general    : 설립연도 등 일반 설정
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run 한 번 실행하세요.
-- ============================================================

-- 기존에 같은 이름 정책이 있으면 교체
drop policy if exists "public read display settings" on public.church_settings;

create policy "public read display settings"
  on public.church_settings
  for select
  using (key in ('homepage', 'committees', 'general'));

-- 참고: 여러 SELECT 정책은 OR 로 합쳐지므로, 기존 "admin all church_settings"
-- 정책(관리자 전체 권한)과 함께 동작합니다. 즉 관리자는 모든 키를 읽고 쓰며,
-- 익명 방문자는 위 세 키만 읽을 수 있습니다.
