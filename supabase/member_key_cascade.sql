-- ============================================================
--  교인 번호(매칭키 = 이름|생년월일) 바뀜 자동 연동 (2026-10-01)
--  Supabase ▸ SQL Editor 에서 실행. 여러 번 실행해도 안전하다.
--
--  왜: 교적에서 생년월일을 고치면 매칭키가 바뀌는데, 로그인 계정 연결(member_links)과
--      헌금 기록(offerings)은 옛 번호에 남아 대시보드에서 헌금이 빠져 보였다.
--      (실제 사례: 손병민 목사 계정·헌금 5건이 옛 번호 '손병민|19820101' 에 남아,
--       올바른 번호 '손병민|19820419' 로 적힌 9건이 대시보드에 안 보임)
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

-- ── 이미 어긋나 있던 것 정리: 손병민 목사 옛 번호 → 교적의 올바른 번호 ──
do $$
declare o text := '손병민|19820101'; n text := '손병민|19820419';
begin
  if exists (select 1 from public.gyojeok where member_key = n) then
    update public.offerings          set member_key = n where member_key = o;
    update public.member_links       set member_key = n where member_key = o;
    update public.member_links       set spouse_key = n where spouse_key = o;
    update public.gyojeok            set spouse_key = n where spouse_key = o;
    update public.counsels           set member_key = n where member_key = o;
    update public.visitations        set member_key = n where member_key = o;
    update public.donation_receipts  set member_key = n where member_key = o;
    update public.member_files       set member_key = n where member_key = o;
  end if;
end $$;

-- 확인
select
  (select string_agg(member_name || ' → ' || member_key || ' / 배우자 ' || coalesce(spouse_key, '-'), ' | ') from public.member_links where member_name like '손병민%') as link,
  (select count(*) || '건 ' || sum(amount) || '원' from public.offerings where member_key in ('손병민|19820419', '채애리|19851020')) as dashboard_total,
  (select count(*) from public.offerings o where coalesce(o.member_key, '') <> '' and not exists (select 1 from public.gyojeok g where g.member_key = o.member_key)) as orphan_offerings;
