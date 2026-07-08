-- ============================================================
--  상담 AI(○○교회 말씀지기) — 1인 1일 질문 한도용 사용량 테이블
--  Supabase → SQL Editor 에 붙여넣고 RUN 한 번만 실행하세요.
-- ============================================================

create table if not exists public.counsel_usage (
  user_id uuid not null,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);

-- 본인 외에는 접근 불가(함수가 security definer로 우회 처리)
alter table public.counsel_usage enable row level security;

-- 오늘 사용량을 확인하고, 한도 미만이면 1 증가시키는 함수.
-- auth.uid()로 호출자 본인만 집계하므로 위조 불가.
create or replace function public.counsel_check_and_bump(p_limit int default 20)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  cur int;
begin
  uid := auth.uid();
  if uid is null then
    return json_build_object('allowed', false, 'count', 0, 'limit', p_limit);
  end if;

  select count into cur from public.counsel_usage
   where user_id = uid and day = current_date;
  cur := coalesce(cur, 0);

  if cur >= p_limit then
    return json_build_object('allowed', false, 'count', cur, 'limit', p_limit);
  end if;

  insert into public.counsel_usage(user_id, day, count)
  values (uid, current_date, 1)
  on conflict (user_id, day)
  do update set count = public.counsel_usage.count + 1;

  return json_build_object('allowed', true, 'count', cur + 1, 'limit', p_limit);
end;
$$;

grant execute on function public.counsel_check_and_bump(int) to authenticated;
