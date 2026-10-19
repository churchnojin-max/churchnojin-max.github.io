-- 2026-10-20 목사님: "특별 승인 말고 외부 성도 칸 하나 더" — 우리 교인이 아닌 다른 교회 성도
--   외부 성도(member_links.member_status = '외부성도'):
--     · 볼 수 있음: 정회원과 같음 — 사진첩, 봉사위원, 자료실, 수요 말씀 자료·콘티, 주일 예배 화면(새찬송가 악보), 주보 본문, AI 말씀 상담
--     · 못 봄: 주보의 향기로운 예물(헌금) 명단·주보 PDF, 교적·헌금·행정(원래 권한자만), 나의 대시보드
--     · 못 함: 게시판 글·댓글·반응, 사진 올리기·댓글·좋아요 (쓰기 규칙은 is_full_member() 그대로)
--   특별 승인(정회원 + special_note)은 그대로 정회원이다.
--   승인: 대시보드 '외부 성도로 승인' 단추 또는 교적관리 ▸ 권한 관리 '외부 성도' → admin_set_member(p_status='외부성도')

create or replace function public.is_outside_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.member_links m where m.user_id = auth.uid() and m.member_status = '외부성도')
$$;
revoke all on function public.is_outside_member() from public, anon;
grant execute on function public.is_outside_member() to authenticated;

-- 읽기(보기) 기준: 정회원(관리자 포함) 또는 외부 성도
create or replace function public.is_viewer() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_full_member() or public.is_outside_member()
$$;
revoke all on function public.is_viewer() from public, anon;
grant execute on function public.is_viewer() to authenticated;

-- 화면이 내 등급을 알 수 있게: 'full' / 'outside' / 'none'(승인 대기)
create or replace function public.am_member_level() returns text
language sql stable security definer set search_path = public as $$
  select case when public.is_full_member() then 'full'
              when public.is_outside_member() then 'outside'
              else 'none' end
$$;
revoke all on function public.am_member_level() from public, anon;
grant execute on function public.am_member_level() to authenticated;

-- ── 읽기 규칙: is_full_member() → is_viewer() (규칙의 나머지 조건은 그대로 둔다) ──
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname, qual from pg_policies
            where cmd = 'SELECT' and qual like '%is_full_member()%'
              and policyname in ('album_select_signed_in', 'album_comments_select_signed_in', 'album_likes_select_signed_in',
                                 'signed-in read committees', 'resources_tbl_read', 'resources_read_authenticated',
                                 'sermon notes members read', 'sermon conti members read', 'private_files conti read',
                                 'hymns_read_sunday_member', 'private_files read')
  loop
    execute format('alter policy %I on %I.%I using (%s)', r.policyname, r.schemaname, r.tablename,
                   replace(r.qual, 'is_full_member()', 'is_viewer()'));
  end loop;
end $$;

-- 주보: 정회원 = 예물 명단까지 / 외부 성도 = 예물 명단·PDF 만 뺌(봉사위원은 봄) / 그 밖 = 예물·봉사위원·PDF 뺌
create or replace view public.bulletins_public as
select id, bdate, title, scripture, preacher,
       case when public.is_full_member()    then data - 'offering_amounts'
            when public.is_outside_member() then data - 'offering_amounts' - 'offering' - 'pdf_url' - 'pdf_name'
            else data - 'offering_amounts' - 'offering' - 'committee' - 'pdf_url' - 'pdf_name'
       end as data,
       updated_at
from public.bulletins
where published = true;

-- 첫 화면 수요 말씀 제목·본문
create or replace function public.wed_note_now() returns json
language sql stable security definer set search_path = public as $$
  select coalesce((
    select json_build_object(
      'open', true,
      'date', n.note_date,
      'title', case when public.is_viewer() then n.title end,
      'scripture', case when public.is_viewer() then n.scripture end)
    from public.sermon_notes n
    where n.status = 'approved' and n.publish_at <= now() and now() < n.close_at
    order by n.note_date desc
    limit 1), json_build_object('open', false));
$$;
revoke all on function public.wed_note_now() from public;
grant execute on function public.wed_note_now() to anon, authenticated;

-- AI 말씀 상담
create or replace function public.counsel_check_and_bump(p_limit int default 20)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid; cur int;
begin
  uid := auth.uid();
  if uid is null or not public.is_viewer() then
    return json_build_object('allowed', false, 'count', 0, 'limit', p_limit, 'member', false);
  end if;
  select count into cur from public.counsel_usage where user_id = uid and day = current_date;
  cur := coalesce(cur, 0);
  if cur >= p_limit then
    return json_build_object('allowed', false, 'count', cur, 'limit', p_limit);
  end if;
  insert into public.counsel_usage(user_id, day, count) values (uid, current_date, 1)
  on conflict (user_id, day) do update set count = public.counsel_usage.count + 1;
  return json_build_object('allowed', true, 'count', cur + 1, 'limit', p_limit);
end $$;

-- 확인: 바뀐 읽기 규칙 수(11이면 다 바뀜)
select count(*) as "is_viewer 쓰는 읽기 규칙" from pg_policies where cmd = 'SELECT' and qual like '%is_viewer()%';
