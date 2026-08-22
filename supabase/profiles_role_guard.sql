-- ============================================================
--  노진교회 — profiles.role 은 관리자만 바꿀 수 있게 한다 (1회 실행)
-- ------------------------------------------------------------
--  왜: profiles 의 UPDATE 정책은 본인에게 모든 컬럼 수정을 허용한다.
--      role 은 지금 권한 판정에 쓰이지 않는 표시용 값이지만,
--      나중에 누군가 role 로 권한을 판단하면 그날로 구멍이 된다.
--      미리 막아 둔다.
--
--  방식: 오류를 내지 않고 조용히 옛 값으로 되돌린다.
--        일반 교인이 내 정보 저장을 눌렀을 때 role 이 함께 전송되는데,
--        오류를 내면 저장 자체가 실패해 버리기 때문이다.
-- ============================================================

create or replace function public.profiles_guard_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() not in (select uid from public.admins) then
    new.role := old.role;          -- 관리자가 아니면 바꾼 값을 무시한다
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard_role on public.profiles;
create trigger trg_profiles_guard_role
  before update on public.profiles
  for each row execute function public.profiles_guard_role();
