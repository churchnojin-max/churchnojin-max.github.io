-- ============================================================
--  노진교회 — 비상 복구용 '강제 로그아웃' (2026-10-03, owner_guard_20261003.sql 다음에 실행)
--  Supabase ▸ SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.
-- ------------------------------------------------------------
--  사무실 PC 비상 복구 도구(service_role 열쇠)만 부를 수 있다. 홈페이지(로그인한 사람·손님)에서는 못 부른다.
--  · emergency_logout(uid) : 그 사람의 모든 기기 로그인을 끊는다(목사님 비밀번호가 털렸을 때 → 해커 접속도 끊김)
--  · emergency_logout(null): 모든 사람의 로그인을 끊는다
--  이미 받아 간 열쇠(access token)는 길어야 1시간 뒤 끝나고, 새로 받는 것(refresh)은 바로 막힌다.
--  한 일은 access_log 에 '강제 로그아웃'으로 남는다.
-- ============================================================

create or replace function public.emergency_logout(p_uid uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if public._from_web() then
    raise exception '홈페이지에서는 쓸 수 없습니다.';
  end if;
  if p_uid is null then
    delete from auth.refresh_tokens where true;
    delete from auth.sessions where true;
  else
    delete from auth.refresh_tokens where user_id = p_uid::text;
    delete from auth.sessions where user_id = p_uid;
  end if;
  get diagnostics n = row_count;
  insert into public.access_log(actor, target, what, detail)
  values (null, p_uid, '강제 로그아웃', jsonb_build_object('sessions', n, 'scope', case when p_uid is null then '모든 사람' else '한 사람' end));
  return n;
end $$;
revoke all on function public.emergency_logout(uuid) from public, anon, authenticated;
grant execute on function public.emergency_logout(uuid) to service_role;

-- 기록 화면: 대상이 없는 기록(모든 사람 로그아웃)은 '모든 사람'으로
create or replace function public.list_access_log(p_limit int default 50)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.admins where uid = auth.uid()) then
    raise exception '관리자만 볼 수 있습니다.';
  end if;
  return coalesce((
    select json_agg(x order by x.at desc) from (
      select l.at, l.what, l.detail,
             coalesce(pa.name, case when l.actor is null then '관리 화면·비상 복구' else '(알 수 없음)' end) as actor_name,
             coalesce(pt.name, case when l.target is null then '모든 사람' else '(이름 없음)' end) as target_name
      from public.access_log l
      left join public.profiles pa on pa.id = l.actor
      left join public.profiles pt on pt.id = l.target
      order by l.at desc
      limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) x), '[]'::json);
end $$;
revoke all on function public.list_access_log(int) from public, anon;
grant execute on function public.list_access_log(int) to authenticated;

-- 확인: 홈페이지 사용자(authenticated)는 emergency_logout 을 부를 수 없어야 한다(false)
select has_function_privilege('authenticated', 'public.emergency_logout(uuid)', 'execute') as web_can_call,
       has_function_privilege('service_role', 'public.emergency_logout(uuid)', 'execute') as service_can_call;
