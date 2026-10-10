-- 2026-10-10 목사님: "승인 전에는 비회원 로그인과 동일한 수준으로 낮춰 버려"
--   가입만 하고 정회원 승인 전인 분(준회원·승인 대기)은 로그인하지 않은 분과 같은 것만 보고 쓸 수 있게 한다.
--   기준: public.is_full_member() = 관리자이거나 member_links.member_status = '정회원'
--   (특별 승인한 다른 교회 성도도 정회원으로 들어가므로 그대로 본다. 직원 권한(can_*)이 있는데 정회원이 아닌 분은 0명 — 확인함)
--
--   읽기: 사진첩(사진·댓글·좋아요), 이 달의 봉사위원, 자료실(목록·파일), 수요 말씀 자료·콘티(파일 포함),
--         주보의 향기로운 예물 명단·봉사위원·PDF(bulletins_public), 첫 화면 수요 말씀 제목(wed_note_now)
--   쓰기: 게시판 글·댓글·반응, 사진첩 사진·댓글·좋아요, 공개 보관함(uploads) 파일 올리기, AI 말씀 상담
--   그대로 두는 것: 교회에 메시지 보내기(승인 문의용), 교적 인증·특별 승인 신청, 내 성경 읽기·QT 체크(내 것만)

-- ── 읽기 ──
drop policy if exists "album_select_signed_in" on public.album_photos;
create policy "album_select_signed_in" on public.album_photos
  for select to authenticated using (public.is_full_member());
drop policy if exists "album_comments_select_signed_in" on public.album_comments;
create policy "album_comments_select_signed_in" on public.album_comments
  for select to authenticated using (public.is_full_member());
drop policy if exists "album_likes_select_signed_in" on public.album_likes;
create policy "album_likes_select_signed_in" on public.album_likes
  for select to authenticated using (public.is_full_member());

drop policy if exists "signed-in read committees" on public.church_settings;
create policy "signed-in read committees" on public.church_settings
  for select to authenticated using (key = 'committees' and public.is_full_member());

drop policy if exists "resources_tbl_read" on public.resources;
create policy "resources_tbl_read" on public.resources
  for select to authenticated using (public.is_full_member());
drop policy if exists "resources_read_authenticated" on storage.objects;
create policy "resources_read_authenticated" on storage.objects
  for select to authenticated using (bucket_id = 'resources' and public.is_full_member());

drop policy if exists "sermon notes members read" on public.sermon_notes;
create policy "sermon notes members read" on public.sermon_notes
  for select to authenticated
  using (status = 'approved' and publish_at <= now() and now() < close_at and public.is_full_member());
drop policy if exists "sermon conti members read" on public.sermon_conti;
create policy "sermon conti members read" on public.sermon_conti
  for select to authenticated
  using (now() >= open_at and now() < close_at and public.is_full_member());
drop policy if exists "private_files conti read" on storage.objects;
create policy "private_files conti read" on storage.objects
  for select to authenticated
  using (bucket_id = 'private_files' and name like 'conti/%' and public.is_full_member()
         and exists (select 1 from public.sermon_conti c
                      where now() >= c.open_at and now() < c.close_at
                        and c.files @> jsonb_build_array(jsonb_build_object('path', objects.name))));

-- 주보: 정회원이 아니면 로그인하지 않은 분과 똑같이 예물 명단·봉사위원·PDF 를 뺀다
create or replace view public.bulletins_public as
select id, bdate, title, scripture, preacher,
       case when not public.is_full_member()
            then data - 'offering_amounts' - 'offering' - 'committee' - 'pdf_url' - 'pdf_name'
            else data - 'offering_amounts'
       end as data,
       updated_at
from public.bulletins
where published = true;

-- 첫 화면 수요 말씀: 제목·본문은 정회원에게만(아니면 '열렸다'는 것만)
create or replace function public.wed_note_now() returns json
language sql stable security definer set search_path = public as $$
  select coalesce((
    select json_build_object(
      'open', true,
      'date', n.note_date,
      'title', case when public.is_full_member() then n.title end,
      'scripture', case when public.is_full_member() then n.scripture end)
    from public.sermon_notes n
    where n.status = 'approved' and n.publish_at <= now() and now() < n.close_at
    order by n.note_date desc
    limit 1), json_build_object('open', false));
$$;
revoke all on function public.wed_note_now() from public;
grant execute on function public.wed_note_now() to anon, authenticated;

-- ── 쓰기 ──
drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own" on public.posts
  for insert with check (auth.uid() = user_id and public.is_full_member());
drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own" on public.comments
  for insert with check (auth.uid() = user_id and public.is_full_member());
drop policy if exists "reactions_insert_own" on public.post_reactions;
create policy "reactions_insert_own" on public.post_reactions
  for insert to authenticated with check (auth.uid() = user_id and public.is_full_member());
drop policy if exists "album_insert_own" on public.album_photos;
create policy "album_insert_own" on public.album_photos
  for insert with check (auth.uid() = user_id and public.is_full_member());
drop policy if exists "album_comments_insert_own" on public.album_comments;
create policy "album_comments_insert_own" on public.album_comments
  for insert with check (auth.uid() = user_id and public.is_full_member());
drop policy if exists "album_likes_insert_own" on public.album_likes;
create policy "album_likes_insert_own" on public.album_likes
  for insert with check (auth.uid() = user_id and public.is_full_member());

drop policy if exists "uploads auth insert" on storage.objects;
create policy "uploads auth insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'uploads' and public.is_full_member()
    and (name like 'sermons/img/%'
         or split_part(name, '/', 1) not in ('archive', 'affairs', 'gyojeok', 'finance', 'sermons', 'resources', 'conti'))
  );

-- AI 말씀 상담: 정회원만(아니면 한도 0 으로 막는다 — 'member' 표시)
create or replace function public.counsel_check_and_bump(p_limit int default 20)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid; cur int;
begin
  uid := auth.uid();
  if uid is null or not public.is_full_member() then
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

-- 화면에서 '승인 대기'인지 알 수 있게(내 상태만)
create or replace function public.am_full_member() returns boolean
language sql stable security definer set search_path = public as $$ select public.is_full_member() $$;
revoke all on function public.am_full_member() from public, anon;
grant execute on function public.am_full_member() to authenticated;

-- 교인·비교인 구분(관리자 화면): 교적과 연결됐는지('linked')를 함께 내보낸다
create or replace function public.list_access()
returns json language sql security definer set search_path to 'public' as $function$
  select coalesce(json_agg(row), '[]'::json) from (
    select json_build_object(
      'uid', p.id, 'name', coalesce(l.member_name, p.name, ''), 'email', coalesce(p.email,''),
      'status',         coalesce(l.member_status,'준회원'),
      'special',        (coalesce(l.member_status,'') = '정회원' and coalesce(l.special_note,'') <> ''),
      'specialExpired', (coalesce(l.member_status,'') <> '정회원' and coalesce(l.special_note,'') <> ''),
      'specialNote',    coalesce(l.special_note, ''),
      'specialAt',      l.special_at,
      'specialUntil',   l.special_until,
      'lastSignIn',     u.last_sign_in_at,
      'isAdmin',        exists(select 1 from public.admins a where a.uid = p.id),
      'canFinance',     coalesce(l.can_finance,false),
      'canGyojeok',     coalesce(l.can_gyojeok,false),
      'canHomepage',    coalesce(l.can_homepage,false),
      'canWorship',     coalesce(l.can_worship,false),
      'canAffairs',     coalesce(l.can_affairs,false),
      'canBoard',       coalesce(l.can_board,false),
      'canDistrict',    coalesce(l.can_district,false),
      'canDistrictAll', coalesce(l.can_district_all,false),
      'joinedAt',       p.created_at,
      'provider',       coalesce(u.raw_app_meta_data->>'provider', 'email'),
      'joinVia',        coalesce(u.raw_user_meta_data->>'join_via', ''),
      'realName',       coalesce(u.raw_user_meta_data->>'real_name', ''),
      'signup',         coalesce(u.raw_user_meta_data->'signup', 'null'::jsonb),
      'linked',         (l.member_key is not null or l.member_id is not null),
      'claimName',      coalesce(r.claim_name, ''),
      'claimBirth',     coalesce(r.claim_birth, ''),
      'claimMatched',   coalesce(r.matched, false),
      'claimAt',        r.requested_at
    ) as row
    from public.profiles p
    left join public.member_links l on l.user_id = p.id
    left join auth.users u on u.id = p.id
    left join public.member_match_requests r on r.user_id = p.id
    where exists(select 1 from public.admins where uid = auth.uid())
      and p.merged_into is null
    order by exists(select 1 from public.admins a where a.uid = p.id) desc, coalesce(l.member_name, p.name)
  ) t;
$function$;
