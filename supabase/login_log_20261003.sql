-- ============================================================
--  노진교회 — 로그인 기록(보안용) (2026-10-03 목사님 요청: 해외 접속은 바로, 나머지는 하루 요약을 텔레그램으로)
--  Supabase ▸ SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.
-- ------------------------------------------------------------
--  · 누가 로그인하면(auth.sessions 에 새 줄) login_log 에 시각·사람·IP·기기를 한 줄 남긴다.
--    기록이 실패해도 로그인은 절대 막지 않는다(오류를 삼킴).
--  · login_log 는 홈페이지(API)로는 읽지도 고치지도 못한다. 사무실 PC 알림 도구(tools/login_watch.py, service_role)만.
--  · 나라(country)는 알림 도구가 PC 안의 자료(DB-IP)로 찾아 채운다. 교인 IP 를 바깥에 보내지 않는다.
--  · 1년 지난 기록은 알림 도구가 지운다(개인정보처리방침 제4조).
-- ============================================================

create table if not exists public.login_log (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  user_id    uuid,
  session_id uuid unique,
  ip         text,
  user_agent text,
  country    text,                       -- KR, US … (알림 도구가 채움)
  alerted    boolean not null default false
);
create index if not exists login_log_at_idx on public.login_log (at desc);
alter table public.login_log enable row level security;   -- 정책 없음 = 홈페이지에서는 못 읽고 못 고침
revoke all on public.login_log from anon, authenticated;

create or replace function public.log_login()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.login_log(at, user_id, session_id, ip, user_agent)
    values (coalesce(new.created_at, now()), new.user_id, new.id, host(new.ip), left(new.user_agent, 400))
    on conflict (session_id) do nothing;
  exception when others then
    null;   -- 기록이 실패해도 로그인은 막지 않는다
  end;
  return new;
end $$;

drop trigger if exists trg_log_login on auth.sessions;
create trigger trg_log_login after insert on auth.sessions
  for each row execute function public.log_login();

-- 지금 남아 있는 로그인도 넣어 둔다(IP 는 host() 로 '/32' 없이)
insert into public.login_log(at, user_id, session_id, ip, user_agent)
select created_at, user_id, id, host(ip), left(user_agent, 400) from auth.sessions
on conflict (session_id) do nothing;

select (select count(*) from public.login_log) as rows,
       exists (select 1 from pg_trigger where tgname = 'trg_log_login') as trigger_ok;

-- ── 1년 보관(2026-10-03 추가): DB 가 매일 03:10(한국, = 18:10 UTC) 스스로 지운다. 사무실 PC 가 꺼져 있어도 된다.
--    (같은 이름으로 다시 실행하면 바꿔 걸린다. 확인: select * from cron.job;)
select cron.schedule('login_log_retention', '10 18 * * *',
  $job$delete from public.login_log where at < now() - interval '365 days'$job$);

-- ── 회원 탈퇴(프로필 삭제) 때 그 사람의 로그인 기록도 바로 지운다(2026-10-03 추가, 처리방침 제4조 ③)
create or replace function public.login_log_on_withdraw()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    delete from public.login_log where user_id = old.id;
  exception when others then
    null;   -- 기록 지우기가 실패해도 탈퇴는 막지 않는다
  end;
  return old;
end $$;
drop trigger if exists trg_login_log_withdraw on public.profiles;
create trigger trg_login_log_withdraw after delete on public.profiles
  for each row execute function public.login_log_on_withdraw();

-- ── 매일 새벽 정리(위의 1년 보관을 바꿔 건다): 1년 지난 기록 + 계정이 아예 없어진 사람의 기록
select cron.schedule('login_log_retention', '10 18 * * *',
  $job$delete from public.login_log l
        where l.at < now() - interval '365 days'
           or (l.user_id is not null and not exists (select 1 from auth.users u where u.id = l.user_id))$job$);
