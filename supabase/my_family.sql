-- 내 가족 가계도: 로그인 회원이 '본인 가족'만 조회(이름·관계·생년·직분만, 연락처 제외).
-- 교적 전체는 관리자만(RLS) — 이 RPC는 security definer 로 본인 세대 + 부모/분가 세대만 안전 반환.
create or replace function public.my_family()
returns table (
  name text, member_key text, head text, relation text,
  spouse text, spouse_key text, origin_head text, birth date, role text
)
language sql security definer stable
set search_path = public
as $$
  with me as (
    select g.head, g.name
    from public.gyojeok g
    where g.member_key in (select public.my_member_keys())
    order by g.id limit 1
  ),
  myhead as (
    select coalesce(nullif((select head from me), ''), (select name from me)) as h
  ),
  headrow as (
    select g.origin_head
    from public.gyojeok g
    where g.name = (select h from myhead)
    order by g.id limit 1
  ),
  heads as (
    select (select h from myhead) as h
    union
    select nullif((select origin_head from headrow), '')               -- 부모 세대(분가 출신)
    union
    select g.name from public.gyojeok g                                -- 분가한 자녀 세대
      where g.origin_head = (select h from myhead) and coalesce(g.origin_head, '') <> ''
  )
  select g.name, g.member_key, g.head, g.relation, g.spouse, g.spouse_key, g.origin_head, g.birth, g.role
  from public.gyojeok g
  where coalesce(nullif(g.head, ''), g.name) in (select h from heads where coalesce(h, '') <> '');
$$;

grant execute on function public.my_family() to authenticated;
