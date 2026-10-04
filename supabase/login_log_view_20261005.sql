-- ============================================================
--  노진교회 — 로그인·접속 기록 보기(최고 운영자만) (2026-10-05 목사님 요청)
--  Supabase ▸ SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.
-- ------------------------------------------------------------
--  · 교적관리 ▸ 권한 관리 의 '로그인·접속 기록'(js/gyojeok.js)이 부른다. 최고 운영자(site_owners)만.
--  · 최근 접속 중인 기기(auth.sessions: 마지막 사용 시각) + 로그인 기록(login_log, 기본 30일, 최대 365일).
--  · 열어 볼 때마다 access_log 에 '로그인 기록 열람'을 남긴다(로그인 기록 이용 원칙: 보안 목적으로만, 처리방침 제4조 ④).
--  · login_log 표 자체는 여전히 홈페이지에서 직접 읽을 수 없다(정책 없음) — 이 함수로만.
-- ============================================================
create or replace function public.list_login_log(p_days int default 30)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
begin
  if not public.am_owner() then
    raise exception '최고 운영자만 볼 수 있습니다.';
  end if;
  insert into public.access_log (actor, target, what, detail)
  values (auth.uid(), null, '로그인 기록 열람', jsonb_build_object('days', v_days));

  return json_build_object(
    'sessions', coalesce((
      select json_agg(x order by x.last_at desc) from (
        select s.created_at as login_at,
               greatest(s.updated_at, coalesce(s.refreshed_at at time zone 'UTC', s.updated_at)) as last_at,
               coalesce(nullif(p.name, ''), '(이름 없음)') as name,
               coalesce(u.raw_app_meta_data->>'provider', 'email') as provider,
               host(s.ip) as ip,
               left(s.user_agent, 300) as ua,
               (select l.country from public.login_log l where l.session_id = s.id) as country
        from auth.sessions s
        left join public.profiles p on p.id = s.user_id
        left join auth.users u on u.id = s.user_id
        where s.not_after is null or s.not_after > now()
        order by 2 desc
        limit 50
      ) x), '[]'::json),
    'logins', coalesce((
      select json_agg(y order by y.at desc) from (
        select l.at,
               coalesce(nullif(p.name, ''), '(이름 없음)') as name,
               coalesce(u.raw_app_meta_data->>'provider', 'email') as provider,
               l.ip,
               left(l.user_agent, 300) as ua,
               l.country
        from public.login_log l
        left join public.profiles p on p.id = l.user_id
        left join auth.users u on u.id = l.user_id
        where l.at > now() - make_interval(days => v_days)
        order by l.at desc
        limit 300
      ) y), '[]'::json)
  );
end $$;
revoke all on function public.list_login_log(int) from public, anon;
grant execute on function public.list_login_log(int) to authenticated;

select exists (select 1 from pg_proc where proname = 'list_login_log') as ok;
