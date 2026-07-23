-- ============================================================
--  노진교회 — 회원 계정 정지 (관리자 전용)
--  Supabase → SQL Editor 에 붙여넣고 RUN 하세요. (여러 번 실행해도 안전)
--
--  · 관리자만 실행 가능, 관리자 계정과 탈퇴 회원은 정지 불가
--  · 정지 시: 정지 표시 + 사유 메모 저장 + 로그인 차단 + 열린 세션 종료
--  · 해제 시: 표시·메모 삭제 + 로그인 다시 허용
-- ============================================================

alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.profiles add column if not exists suspend_note text;

create or replace function public.admin_set_suspend(target uuid, suspend boolean, note text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.admins a where a.uid = auth.uid()) then
    raise exception '관리자만 사용할 수 있습니다';
  end if;
  if exists (select 1 from public.admins a where a.uid = target) then
    raise exception '관리자 계정은 정지할 수 없습니다';
  end if;
  if exists (select 1 from public.profiles p where p.id = target and p.withdrawn_at is not null) then
    raise exception '이미 탈퇴한 회원입니다';
  end if;

  if suspend then
    update public.profiles
       set suspended_at = now(),
           suspend_note = nullif(trim(coalesce(note, '')), '')
     where id = target;
    update auth.users set banned_until = now() + interval '100 years' where id = target;
    -- 이미 로그인돼 있던 기기도 바로 끊는다
    delete from auth.sessions where user_id = target;
    delete from auth.refresh_tokens where user_id = target::text;
  else
    update public.profiles set suspended_at = null, suspend_note = null where id = target;
    update auth.users set banned_until = null where id = target;
  end if;
end; $$;

revoke all on function public.admin_set_suspend(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_suspend(uuid, boolean, text) to authenticated;
