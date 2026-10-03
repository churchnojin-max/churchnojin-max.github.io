-- ============================================================
--  교인 번호(매칭키 = 이름|생년월일) 바뀜 자동 연동 (2026-10-01)
--  Supabase ▸ SQL Editor 에서 실행. 여러 번 실행해도 안전하다.
--
--  왜: 교적에서 생년월일을 고치면 매칭키가 바뀌는데, 로그인 계정 연결(member_links)과
--      헌금 기록(offerings)은 옛 번호에 남아 대시보드에서 헌금이 빠져 보였다.
--      (실제로 한 분의 계정·헌금 일부가 옛 번호에 남아, 올바른 번호로 적힌 헌금이 대시보드에 안 보였다)
--  ※ 이 저장소는 공개된다. 실제 이름·생년월일(매칭키)을 이 파일에 적지 말 것.
--  무엇을: 교적의 member_key 가 바뀌면, 그 번호를 쓰는 모든 표를 새 번호로 함께 바꾼다.
-- ============================================================

create or replace function public.gyojeok_key_cascade()
returns trigger language plpgsql security definer set search_path = public as $$
declare o text := old.member_key; n text := new.member_key;
begin
  if coalesce(o, '') <> '' and coalesce(n, '') <> '' and n is distinct from o then
    update public.offerings          set member_key = n where member_key = o;
    update public.member_links       set member_key = n where member_key = o;
    update public.member_links       set spouse_key = n where spouse_key = o;
    update public.gyojeok            set spouse_key = n where spouse_key = o and id <> new.id;
    update public.counsels           set member_key = n where member_key = o;
    update public.visitations        set member_key = n where member_key = o;
    update public.donation_receipts  set member_key = n where member_key = o;
    update public.member_files       set member_key = n where member_key = o;
  end if;
  return new;
end $$;

drop trigger if exists gyojeok_key_cascade on public.gyojeok;
create trigger gyojeok_key_cascade after update of member_key on public.gyojeok
  for each row execute function public.gyojeok_key_cascade();

-- ── 이미 어긋나 있던 번호 한 건은 2026-10-01 에 정리를 마쳤다(그때 쓴 값은 개인정보라 지움). ──
--    같은 일이 또 생기면 SQL Editor 에서 아래 틀에 옛 번호·새 번호를 직접 넣어 실행하고, 파일에는 남기지 않는다.
-- do $$
-- declare o text := '옛번호(이름|생년월일)'; n text := '새번호(이름|생년월일)';
-- begin
--   if exists (select 1 from public.gyojeok where member_key = n) then
--     update public.offerings          set member_key = n where member_key = o;
--     update public.member_links       set member_key = n where member_key = o;
--     update public.member_links       set spouse_key = n where spouse_key = o;
--     update public.gyojeok            set spouse_key = n where spouse_key = o;
--     update public.counsels           set member_key = n where member_key = o;
--     update public.visitations        set member_key = n where member_key = o;
--     update public.donation_receipts  set member_key = n where member_key = o;
--     update public.member_files       set member_key = n where member_key = o;
--   end if;
-- end $$;

-- 확인: 교적에 없는 번호로 적힌 헌금이 남아 있는가(0 이어야 한다)
select count(*) as orphan_offerings
from public.offerings o
where coalesce(o.member_key, '') <> ''
  and not exists (select 1 from public.gyojeok g where g.member_key = o.member_key);
