-- ============================================================
--  노진교회 — ① '게시판' 권한이 실제로 쓰이게  ② 한 사람 한 계정(카카오 중심)   (2026-10-04)
--  Supabase ▸ SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.
-- ------------------------------------------------------------
--  ① 목사님: "게시판 권한을 줬는데 사진 삭제·수정을 못하고 있네?"
--     권한 관리의 '게시판'(공지·앨범·나눔터 관리 = member_links.can_board)은 저장만 되고,
--     허락 규칙(RLS)은 관리자(admins)만 보고 있었다. → can_board() 도 통과하는 규칙을 '더한다'.
--     (can_board() = 관리자이거나 게시판 권한. 기존 규칙은 그대로 둔다.)
--  ② 목사님: "양쪽 가입은 막고 하나만 — 되도록 카카오로. 2중 가입은 하나로 합치고"
--     · 같은 교인(교적 번호)에 정회원 계정은 하나만: 교적 인증 신청(match_member)·운영진 승인
--       (admin_set_member)에서 막고, 겹친 것이 없으면 고유 색인으로 못 박는다.
--     · 겹친 계정 합치기 merge_account(옛 계정, 남길 계정, 메모) — SQL Editor 에서만 부를 수 있다.
--       옛 계정의 글·사진·댓글을 남길 계정으로 옮기고, 남길 계정의 빈 '내 정보' 칸을 채우고,
--       교적 연결·권한을 남길 계정으로 모은 뒤, 옛 계정은 지우지 않고 잠근다
--       (로그인 막음 · 목록에서 숨김 · account_merge_log 에 전 상태 보관 → 되돌릴 수 있다).
--  ③ 회원 정지(admin_set_suspend)가 없는 칸(profiles.withdrawn_at)을 찾다가 오류 나던 것 고침.
-- ============================================================


-- ── ① 게시판 권한(can_board) ─────────────────────────────────
-- 우리들 소식(앨범) 사진: 고치기·지우기
drop policy if exists "album_update_board" on public.album_photos;
create policy "album_update_board" on public.album_photos
  for update to authenticated using (public.can_board()) with check (public.can_board());
drop policy if exists "album_delete_board" on public.album_photos;
create policy "album_delete_board" on public.album_photos
  for delete to authenticated using (public.can_board());

-- 앨범 댓글 지우기
drop policy if exists "album_comments_delete_board" on public.album_comments;
create policy "album_comments_delete_board" on public.album_comments
  for delete to authenticated using (public.can_board());

-- 앨범 카테고리 관리
drop policy if exists "album_cat_board_insert" on public.album_categories;
create policy "album_cat_board_insert" on public.album_categories
  for insert to authenticated with check (public.can_board());
drop policy if exists "album_cat_board_update" on public.album_categories;
create policy "album_cat_board_update" on public.album_categories
  for update to authenticated using (public.can_board()) with check (public.can_board());
drop policy if exists "album_cat_board_delete" on public.album_categories;
create policy "album_cat_board_delete" on public.album_categories
  for delete to authenticated using (public.can_board());

-- 공지: 쓰기·고치기·지우기
drop policy if exists "notices_board_insert" on public.notices;
create policy "notices_board_insert" on public.notices
  for insert to authenticated with check (public.can_board());
drop policy if exists "notices_board_update" on public.notices;
create policy "notices_board_update" on public.notices
  for update to authenticated using (public.can_board()) with check (public.can_board());
drop policy if exists "notices_board_delete" on public.notices;
create policy "notices_board_delete" on public.notices
  for delete to authenticated using (public.can_board());

-- 나눔터 글·댓글 지우기(관리)
drop policy if exists "posts_delete_board" on public.posts;
create policy "posts_delete_board" on public.posts
  for delete to authenticated using (public.can_board());
drop policy if exists "comments_delete_board" on public.comments;
create policy "comments_delete_board" on public.comments
  for delete to authenticated using (public.can_board());

-- 사진 파일(저장소 uploads/album/…) 지우기 — 저장소는 지울 때 읽기 권한도 함께 본다
drop policy if exists "uploads album board read" on storage.objects;
create policy "uploads album board read" on storage.objects
  for select to authenticated using (bucket_id = 'uploads' and split_part(name, '/', 1) = 'album' and public.can_board());
drop policy if exists "uploads album board delete" on storage.objects;
create policy "uploads album board delete" on storage.objects
  for delete to authenticated using (bucket_id = 'uploads' and split_part(name, '/', 1) = 'album' and public.can_board());


-- ── ② 한 사람 한 계정 ───────────────────────────────────────
-- 합쳐진(잠긴) 옛 계정 표시
alter table public.profiles add column if not exists merged_into uuid;
alter table public.profiles add column if not exists merged_at   timestamptz;
comment on column public.profiles.merged_into is '이 계정을 합쳐 넣은 계정(남긴 계정). 값이 있으면 잠긴 옛 계정 — 목록에서 숨긴다';

-- 합친 기록(되돌릴 때 쓴다). 홈페이지에서는 아무도 못 읽고 못 쓴다(정책 없음).
create table if not exists public.account_merge_log (
  id                  bigint generated always as identity primary key,
  old_uid             uuid not null,
  keep_uid            uuid not null,
  at                  timestamptz not null default now(),
  note                text,
  old_profile         jsonb,
  old_link            jsonb,
  keep_profile_before jsonb,
  keep_link_before    jsonb,
  moved               jsonb
);
alter table public.account_merge_log enable row level security;
revoke all on public.account_merge_log from anon, authenticated;

-- 겹친 계정 합치기 — SQL Editor 에서만:
--   select public.merge_account('<옛 계정 uid>', '<남길 계정 uid>', '카카오 계정으로 합침');
create or replace function public.merge_account(p_old uuid, p_keep uuid, p_note text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_old_p  public.profiles;
  v_keep_p public.profiles;
  v_old_l  public.member_links;
  v_keep_l public.member_links;
  v_moved  jsonb := '{}'::jsonb;
  v_n      int;
  v_t      text;
begin
  if p_old is null or p_keep is null or p_old = p_keep then
    raise exception '두 계정을 정확히 지정하세요';
  end if;
  if not exists (select 1 from auth.users where id = p_old) or not exists (select 1 from auth.users where id = p_keep) then
    raise exception '없는 계정입니다';
  end if;
  if exists (select 1 from public.admins where uid = p_old) or exists (select 1 from public.site_owners where uid = p_old) then
    raise exception '관리자·최고 운영자 계정은 이 도구로 합치지 않습니다';
  end if;
  select * into v_old_p  from public.profiles     where id = p_old;
  select * into v_keep_p from public.profiles     where id = p_keep;
  select * into v_old_l  from public.member_links where user_id = p_old;
  select * into v_keep_l from public.member_links where user_id = p_keep;
  if v_old_p.merged_into is not null then raise exception '이미 합쳐진 계정입니다'; end if;
  if v_keep_p.merged_into is not null then raise exception '남길 계정이 잠긴 옛 계정입니다'; end if;

  -- 1) 글·사진·댓글 등을 남길 계정으로(같은 것이 이미 있어 겹치면 그 표는 옛 계정에 그대로 둔다)
  foreach v_t in array array[
    'album_photos.user_id', 'album_comments.user_id', 'album_likes.user_id', 'posts.user_id', 'comments.user_id',
    'post_reactions.user_id', 'notices.user_id', 'tax_requests.user_id', 'bible_reading.user_id', 'qt_checks.user_id',
    'district_reports.user_id', 'counsel_usage.user_id', 'documents.created_by', 'visitations.created_by',
    'counsels.created_by', 'edu_records.created_by', 'edu_materials.created_by', 'member_files.created_by',
    'qt_imports.created_by', 'sermon_illustrations.created_by', 'sermons.created_by', 'memos.created_by',
    'worship_songs.created_by', 'sermon_songs.created_by', 'district_sheets.created_by']
  loop
    begin
      execute format('update public.%I set %I = $1 where %I = $2', split_part(v_t, '.', 1), split_part(v_t, '.', 2), split_part(v_t, '.', 2))
        using p_keep, p_old;
      get diagnostics v_n = row_count;
      if v_n > 0 then v_moved := v_moved || jsonb_build_object(v_t, v_n); end if;
    exception
      when unique_violation then v_moved := v_moved || jsonb_build_object(v_t, '겹쳐서 옛 계정에 둠');
      when undefined_table or undefined_column then null;
    end;
  end loop;
  -- 올린 파일의 주인도 남길 계정으로(그래야 나중에 본인이 지울 수 있다)
  begin
    update storage.objects set owner = p_keep, owner_id = p_keep::text where owner = p_old;
    get diagnostics v_n = row_count;
    if v_n > 0 then v_moved := v_moved || jsonb_build_object('storage.objects', v_n); end if;
  exception when others then v_moved := v_moved || jsonb_build_object('storage.objects', '못 옮김: ' || sqlerrm);
  end;

  -- 2) 남길 계정의 빈 '내 정보' 칸을 옛 계정 값으로 채운다
  update public.profiles k set
    name    = coalesce(nullif(btrim(k.name), ''),    v_old_p.name),
    phone   = coalesce(nullif(btrim(k.phone), ''),   v_old_p.phone),
    birth   = coalesce(nullif(btrim(k.birth), ''),   v_old_p.birth),
    address = coalesce(nullif(btrim(k.address), ''), v_old_p.address),
    family  = coalesce(nullif(btrim(k.family), ''),  v_old_p.family),
    bio     = coalesce(nullif(btrim(k.bio), ''),     v_old_p.bio),
    role    = coalesce(nullif(btrim(k.role), ''),    v_old_p.role)
  where k.id = p_keep;

  -- 3) 교적 연결·권한을 남길 계정으로 모은다(옛 계정 연결을 먼저 비워야 고유 색인과 부딪히지 않는다)
  if v_old_l.user_id is not null then
    update public.member_links set
      member_status = '준회원', member_key = null, member_id = null, spouse_key = null,
      can_finance = false, can_gyojeok = false, can_homepage = false, can_worship = false, can_affairs = false,
      can_board = false, can_district = false, can_district_all = false, can_score = false,
      note = concat_ws(' / ', nullif(note, ''), '합침 → ' || left(p_keep::text, 8)), updated_at = now()
    where user_id = p_old;
    if v_keep_l.user_id is null then
      insert into public.member_links (user_id, member_status, member_key, member_id, member_name, spouse_key, matched_at, note,
        can_finance, can_gyojeok, can_homepage, can_worship, can_affairs, can_board, can_district, can_district_all, can_score, updated_at)
      values (p_keep, v_old_l.member_status, v_old_l.member_key, v_old_l.member_id, v_old_l.member_name, v_old_l.spouse_key, v_old_l.matched_at, v_old_l.note,
        v_old_l.can_finance, v_old_l.can_gyojeok, v_old_l.can_homepage, v_old_l.can_worship, v_old_l.can_affairs, v_old_l.can_board,
        v_old_l.can_district, v_old_l.can_district_all, v_old_l.can_score, now());
    else
      update public.member_links k set
        member_status    = case when k.member_status = '정회원' or v_old_l.member_status = '정회원' then '정회원' else k.member_status end,
        member_key       = coalesce(nullif(k.member_key, ''),  v_old_l.member_key),
        member_id        = coalesce(k.member_id,               v_old_l.member_id),
        member_name      = coalesce(nullif(k.member_name, ''), v_old_l.member_name),
        spouse_key       = coalesce(nullif(k.spouse_key, ''),  v_old_l.spouse_key),
        matched_at       = coalesce(k.matched_at,              v_old_l.matched_at),
        can_finance      = coalesce(k.can_finance, false)      or coalesce(v_old_l.can_finance, false),
        can_gyojeok      = coalesce(k.can_gyojeok, false)      or coalesce(v_old_l.can_gyojeok, false),
        can_homepage     = coalesce(k.can_homepage, false)     or coalesce(v_old_l.can_homepage, false),
        can_worship      = coalesce(k.can_worship, false)      or coalesce(v_old_l.can_worship, false),
        can_affairs      = coalesce(k.can_affairs, false)      or coalesce(v_old_l.can_affairs, false),
        can_board        = coalesce(k.can_board, false)        or coalesce(v_old_l.can_board, false),
        can_district     = coalesce(k.can_district, false)     or coalesce(v_old_l.can_district, false),
        can_district_all = coalesce(k.can_district_all, false) or coalesce(v_old_l.can_district_all, false),
        can_score        = coalesce(k.can_score, false)        or coalesce(v_old_l.can_score, false),
        updated_at       = now()
      where k.user_id = p_keep;
    end if;
  end if;

  -- 4) 옛 계정 잠그기 — 지우지 않는다(로그인만 막고, 목록에서 숨긴다)
  update public.profiles set
    merged_into = p_keep, merged_at = now(),
    suspended_at = coalesce(suspended_at, now()),
    suspend_note = coalesce(nullif(btrim(p_note), ''), '다른 계정으로 합침')
  where id = p_old;
  update auth.users set banned_until = now() + interval '100 years' where id = p_old;
  delete from auth.sessions where user_id = p_old;                 -- 켜져 있던 기기 로그아웃
  delete from auth.refresh_tokens where user_id = p_old::text;

  -- 5) 기록
  insert into public.account_merge_log (old_uid, keep_uid, note, old_profile, old_link, keep_profile_before, keep_link_before, moved)
  values (p_old, p_keep, p_note, to_jsonb(v_old_p), to_jsonb(v_old_l), to_jsonb(v_keep_p), to_jsonb(v_keep_l), v_moved);
  return json_build_object('ok', true, 'moved', v_moved);
end $$;
revoke all on function public.merge_account(uuid, uuid, text) from public, anon, authenticated;

-- 권한·승인 목록(list_access): 잠긴 옛 계정은 빼고 보여 준다(2026-10-04 · 나머지는 그대로)
create or replace function public.list_access()
returns json language sql security definer set search_path to 'public' as $function$
  select coalesce(json_agg(row), '[]'::json) from (
    select json_build_object(
      'uid', p.id, 'name', coalesce(l.member_name, p.name, ''), 'email', coalesce(p.email,''),
      'status',         coalesce(l.member_status,'준회원'),
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

-- 교적 인증 신청: 이 교인이 이미 다른 계정으로 정회원이면 새 신청을 받지 않는다(그 계정으로 로그인 안내)
create or replace function public.match_member(p_name text, p_birth text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_name   text := left(btrim(coalesce(p_name, '')), 40);
  v_status text;
  v_found  boolean;
  v_tries  int;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', '로그인이 필요합니다.');
  end if;
  if v_name = '' or coalesce(p_birth, '') !~ '^[0-9]{8}$' then
    return json_build_object('ok', false, 'error', '이름과 생년월일(YYYYMMDD)을 정확히 입력하세요.');
  end if;

  -- 이미 승인된 정회원은 바꾸지 않는다(다른 교인으로 갈아타는 것을 막는다)
  select member_status into v_status from public.member_links where user_id = v_uid;
  if v_status = '정회원' then
    return json_build_object('ok', true, 'status', '정회원',
      'name', (select member_name from public.member_links where user_id = v_uid));
  end if;

  -- 하루 5번까지만
  select count(*) into v_tries from public.member_match_attempts
   where user_id = v_uid and at > now() - interval '24 hours';
  if v_tries >= 5 then
    return json_build_object('ok', true, 'status', '준회원',
      'message', '오늘은 더 신청할 수 없습니다. 내일 다시 하시거나 교회로 연락해 주세요.');
  end if;
  insert into public.member_match_attempts (user_id) values (v_uid);

  v_found := exists (select 1 from public.gyojeok where member_key = v_name || '|' || p_birth);

  -- 한 사람 한 계정(2026-10-04): 같은 교인이 이미 다른 계정으로 정회원이면 두 번째 계정은 받지 않는다
  if v_found and exists (select 1 from public.member_links l
                          where l.member_key = v_name || '|' || p_birth and l.member_status = '정회원' and l.user_id <> v_uid) then
    return json_build_object('ok', true, 'status', '준회원',
      'message', '이미 다른 계정으로 교인 확인(정회원)을 마치셨습니다. 처음 가입하신 계정(카카오 등)으로 로그인해 주세요. 계정을 바꾸시려면 교회 사무실에 말씀해 주세요.');
  end if;

  insert into public.member_match_requests (user_id, claim_name, claim_birth, matched, requested_at)
  values (v_uid, v_name, p_birth, v_found, now())
  on conflict (user_id) do update set
    claim_name = excluded.claim_name, claim_birth = excluded.claim_birth,
    matched = excluded.matched, requested_at = now();

  -- 연결표에는 이름만 적는다. 교적 번호(member_key)는 운영진이 승인할 때(admin_set_member) 들어간다.
  insert into public.member_links (user_id, member_status, member_key, member_name, spouse_key, updated_at)
  values (v_uid, '준회원', null, v_name, null, now())
  on conflict (user_id) do update set
    member_status = '준회원', member_key = null, spouse_key = null,
    member_name = excluded.member_name, updated_at = now();

  return json_build_object('ok', true, 'status', '준회원',
    'message', '신청이 접수되었습니다. 운영진이 확인한 뒤 정회원으로 승인해 드립니다.');
end $$;
revoke all on function public.match_member(text, text) from public, anon;
grant execute on function public.match_member(text, text) to authenticated;

-- 운영진 승인: 이 교인이 이미 다른 계정에 정회원으로 연결돼 있으면 멈추고 알려 준다
create or replace function public.admin_set_member(p_uid uuid, p_status text, p_member_key text, p_member_name text)
returns json language plpgsql security definer set search_path to 'public' as $function$
declare
  v_spousekey  text := '';
  v_other      uuid;
  v_other_name text;
  v_other_prov text;
begin
  if not exists (select 1 from public.admins where uid = auth.uid()) then
    return json_build_object('ok', false, 'error', '관리자만 가능합니다.');
  end if;
  if p_status = '정회원' and coalesce(p_member_key, '') <> '' then
    select l.user_id, coalesce(nullif(pr.name, ''), l.member_name, ''), coalesce(u.raw_app_meta_data->>'provider', 'email')
      into v_other, v_other_name, v_other_prov
      from public.member_links l
      left join public.profiles pr on pr.id = l.user_id
      left join auth.users u on u.id = l.user_id
     where l.member_key = p_member_key and l.member_status = '정회원' and l.user_id <> p_uid
     limit 1;
    if v_other is not null then
      raise exception '이 교인은 이미 다른 계정(% · % 가입)에 정회원으로 연결되어 있습니다. 한 분은 한 계정만 쓸 수 있어요 — 겹친 계정을 합친 뒤에 승인해 주세요.',
        v_other_name, case when v_other_prov = 'kakao' then '카카오' else '이메일' end;
    end if;
    select coalesce(spouse_key, '') into v_spousekey from public.gyojeok where member_key = p_member_key limit 1;
  end if;
  insert into public.member_links (user_id, member_status, member_key, member_name, spouse_key, updated_at)
  values (p_uid, p_status, nullif(p_member_key, ''), nullif(p_member_name, ''), nullif(v_spousekey, ''), now())
  on conflict (user_id) do update set
    member_status = excluded.member_status,
    member_key    = excluded.member_key,
    member_name   = coalesce(excluded.member_name, public.member_links.member_name),
    spouse_key    = excluded.spouse_key,
    updated_at    = now();
  return json_build_object('ok', true);
end $function$;

-- 겹친 정회원이 없으면 '교인 한 명 = 정회원 계정 하나'를 고유 색인으로 못 박는다(있으면 합친 뒤 다시 실행)
do $$
begin
  if not exists (select 1 from public.member_links
                  where member_status = '정회원' and member_key is not null
                  group by member_key having count(*) > 1) then
    create unique index if not exists member_links_one_account_per_member
      on public.member_links (member_key) where member_status = '정회원' and member_key is not null;
  else
    raise notice '겹친 정회원 계정이 있어 고유 색인은 아직 만들지 않았습니다 — merge_account 로 합친 뒤 이 파일을 다시 실행하세요.';
  end if;
end $$;


-- ── ③ 회원 정지: 없는 칸(withdrawn_at)을 찾다 오류 나던 것 고침(탈퇴는 계정을 익명화하므로 따로 볼 칸이 없다) ──
create or replace function public.admin_set_suspend(target uuid, suspend boolean, note text default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not exists (select 1 from public.admins a where a.uid = auth.uid()) then
    raise exception '관리자만 사용할 수 있습니다';
  end if;
  if exists (select 1 from public.admins a where a.uid = target) then
    raise exception '관리자 계정은 정지할 수 없습니다';
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
end; $function$;

-- 확인
select
  (select count(*) from pg_policies where policyname like '%board%') as board_policies,
  exists (select 1 from pg_indexes where indexname = 'member_links_one_account_per_member') as one_account_index;
