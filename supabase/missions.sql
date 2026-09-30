-- ============================================================
--  선교사님 소개 · 사진 · 사역 보고 (선교와 사역 › 선교)
--  저장 위치: church_settings 의 key = 'missions'  (js/missions.js)
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 Run 한 번. (다시 실행해도 안전합니다)
--
--  1) 로그인하지 않은 방문자도 선교사님 소개·사진·보고를 볼 수 있게 'missions' 읽기 허용
--     (기존 공개 읽기 규칙은 그대로 두고, missions 만 새 규칙으로 더합니다)
--  2) 관리자는 이미 고칠 수 있음. '홈페이지' 권한을 받은 분도 고칠 수 있게 허용
-- ============================================================

drop policy if exists "public read missions" on public.church_settings;
create policy "public read missions"
  on public.church_settings
  for select
  using (key = 'missions');

do $$
begin
  if exists (select 1 from pg_proc where proname = 'can_homepage') then
    execute 'drop policy if exists "perm homepage missions" on public.church_settings';
    execute 'create policy "perm homepage missions" on public.church_settings for all to authenticated
             using (public.can_homepage() and key = ''missions'')
             with check (public.can_homepage() and key = ''missions'')';
  end if;
end $$;

-- 확인: 아래 결과에 'public read missions' 가 보이면 됩니다.
select policyname from pg_policies where tablename = 'church_settings' order by policyname;
