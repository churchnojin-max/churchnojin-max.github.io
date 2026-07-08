-- ============================================================
-- 이메일 인증 수동 처리 — churchnojin@gmail.com
-- ------------------------------------------------------------
-- 확인 메일 링크가 만료/무효일 때, 소유자가 직접 인증 완료 처리.
-- Supabase ▸ SQL Editor 에 붙여넣고 Run.
-- 실행 후에는 홈페이지에서 이메일+비밀번호로 바로 로그인됩니다.
-- ============================================================
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where lower(email) = 'churchnojin@gmail.com';

-- 확인용: 인증 시각이 채워졌는지 조회
select email, email_confirmed_at
from auth.users
where lower(email) = 'churchnojin@gmail.com';
