-- ============================================================
-- 노진교회 최고 관리자 지정 — churchnojin@gmail.com
-- ------------------------------------------------------------
-- ★ 순서 ★
--   1) 먼저 홈페이지(로그인 창)에서 churchnojin@gmail.com 으로 "회원가입"
--   2) 가입 확인 메일의 링크를 눌러 이메일 인증 완료
--   3) 아래 SQL 을 Supabase ▸ SQL Editor 에 붙여넣고 Run
--      (이메일로 자동 조회하므로 UID를 직접 복사할 필요 없습니다)
--   * 재실행해도 안전합니다.
-- ============================================================
insert into public.admins (uid)
select id from auth.users
where lower(email) = 'churchnojin@gmail.com'
on conflict (uid) do nothing;

-- 확인용: 관리자로 잘 등록됐는지 조회
select u.email, a.uid
from public.admins a
join auth.users u on u.id = a.uid;
