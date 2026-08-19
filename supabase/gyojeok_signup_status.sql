-- ============================================================
--  노진교회 — 교적 명단에 '홈페이지 가입 여부' 표시
--  Supabase ▸ SQL Editor 에 붙여넣고 Run (1회).
--  선행: supabase/permissions_granular.sql (can_gyojeok 함수 필요)
--
--  왜 함수로 만드나:
--    가입 정보는 member_links 에 있는데, 이 테이블의 select 정책은
--    '관리자 또는 본인'뿐이라 교적 담당자(can_gyojeok)는 읽을 수 없다.
--    교적 화면에서 필요한 최소한(매칭키·이름·이메일·회원상태)만
--    security definer 함수로 돌려준다.
--
--  누가 호출할 수 있나: 교적 담당자 또는 재정 담당자(둘 다 관리자를 포함).
--  그 외에는 빈 배열이 나간다.
-- ============================================================

create or replace function public.gyojeok_signups()
returns json language sql security definer stable
set search_path = public as $$
  select coalesce(json_agg(json_build_object(
           'memberKey',  l.member_key,
           'memberName', l.member_name,
           'email',      p.email,
           'status',     coalesce(l.member_status, '준회원')
         )), '[]'::json)
  from public.member_links l
  left join public.profiles p on p.id = l.user_id
  where (public.can_gyojeok() or public.is_finance())
    and coalesce(l.member_key, '') <> '';
$$;

-- 확인용
select public.gyojeok_signups();
