-- 2026-10-31 0시 11/1 주보가 게시됐는데 로그인 안 한 화면에 "아직 게시된 주보가 없습니다"로 나왔다.
-- 까닭: outside_member_20261020.sql 이 bulletins_public 보기 안에서 is_outside_member() 를 부르게 했는데
--       그 함수 실행 권한을 anon(로그인 안 한 분)에게서 뺐다 → 주보 전체(select=*)를 읽으면
--       "permission denied for function is_outside_member"(401). 10/20부터 로그인 안 한 화면엔 주보가 안 보였다.
-- 고침: anon 에게 실행만 허락한다. 로그인 안 한 분에겐 auth.uid() 가 비어 있어 늘 false 를 돌려주므로 드러나는 것이 없다.
grant execute on function public.is_outside_member() to anon;
