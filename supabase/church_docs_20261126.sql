-- 교회 서류 보관함 (2026-11-26 목사님: 고유번호증·통장 사본 같은 교회 서류를 목회 작업실에서 홈페이지에 올리고,
-- 목사님이 지정한 사람만 언제든 보게. 보안 유지)
--
--   올리기   : 목회 작업실 → 사무실 PC 작업실 도우미가 service_role 열쇠(%APPDATA%\nojin\supabase_service.key)로만 올린다.
--              홈페이지(로그인한 누구라도)에서는 올리기·고치기·지우기가 모두 막혀 있다(정책 없음).
--   보기     : 최고 운영자(site_owners) + 최고 운영자가 지정한 사람(church_doc_viewers)만. 정지된 계정은 못 봄.
--   파일     : 비공개 저장소 church-docs. 볼 수 있는 사람만 잠깐(5분) 쓰는 열람 주소를 받는다.
--   기록     : 누가 언제 어떤 서류를 열었는지, 열람자를 누가 넣고 뺐는지 church_doc_log 에 남는다(최고 운영자만 읽음).
-- 이 파일은 여러 번 실행해도 됩니다.

-- ① 서류 표 (판마다 한 줄. current = 지금 판)
create table if not exists public.church_docs (
  id            bigint generated always as identity primary key,
  doc_key       text not null,                 -- 작업실 보관함 칸 id (bizno · bank · rule · presb …)
  name          text not null,                 -- 고유번호증 …
  issued        date,                          -- 발급일
  note          text,
  file_key      text not null,                 -- 저장소 church-docs 안 경로
  file_name     text,
  mime          text,
  size          integer,
  sha256        text,
  current       boolean not null default true,
  uploaded_at   timestamptz not null default now(),
  uploaded_from text
);
create index if not exists church_docs_key_idx on public.church_docs (doc_key, uploaded_at desc);
alter table public.church_docs enable row level security;
revoke all on public.church_docs from anon;
revoke insert, update, delete on public.church_docs from authenticated;

-- ② 열람자 표 (최고 운영자가 지정) — 홈페이지에서 직접 읽고 쓰지 못하고 아래 함수로만
create table if not exists public.church_doc_viewers (
  uid       uuid primary key references auth.users(id) on delete cascade,
  added_at  timestamptz not null default now(),
  added_by  uuid
);
alter table public.church_doc_viewers enable row level security;
revoke all on public.church_doc_viewers from anon, authenticated;

-- ③ 기록 표
create table if not exists public.church_doc_log (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  uid     uuid,
  action  text not null,          -- 열람 · 열람자 지정 · 열람자 해제
  doc_id  bigint,
  target  uuid,
  detail  text
);
alter table public.church_doc_log enable row level security;
revoke all on public.church_doc_log from anon, authenticated;

-- ④ 볼 수 있나
create or replace function public.church_docs_can_view()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.suspended_at is not null)
     and (exists (select 1 from public.site_owners o where o.uid = auth.uid())
          or exists (select 1 from public.church_doc_viewers v where v.uid = auth.uid()));
$$;
revoke all on function public.church_docs_can_view() from public, anon;
grant execute on function public.church_docs_can_view() to authenticated;

drop policy if exists church_docs_select on public.church_docs;
create policy church_docs_select on public.church_docs for select to authenticated using (public.church_docs_can_view());

-- ⑤ 비공개 저장소 — 읽기(열람 주소 받기)만 열람자에게. 올리기·지우기 정책은 두지 않음(service_role 만)
insert into storage.buckets (id, name, public, file_size_limit)
values ('church-docs', 'church-docs', false, 20971520)
on conflict (id) do update set public = false;
drop policy if exists church_docs_read on storage.objects;
create policy church_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'church-docs' and public.church_docs_can_view());

-- ⑥ 화면이 부르는 함수들
-- 내 처지: {view: 볼 수 있음, owner: 열람자를 지정할 수 있음}
create or replace function public.church_docs_me()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('view', public.church_docs_can_view(),
                           'owner', exists (select 1 from public.site_owners o where o.uid = auth.uid()));
$$;
revoke all on function public.church_docs_me() from public, anon;
grant execute on function public.church_docs_me() to authenticated;

-- 열람 기록 남기기 (열기 단추를 누를 때)
create or replace function public.church_doc_opened(p_doc bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.church_docs_can_view() then raise exception '열람 권한이 없습니다'; end if;
  insert into public.church_doc_log (uid, action, doc_id, detail)
  select auth.uid(), '열람', d.id, d.name from public.church_docs d where d.id = p_doc;
end $$;
revoke all on function public.church_doc_opened(bigint) from public, anon;
grant execute on function public.church_doc_opened(bigint) to authenticated;

-- 열람자 목록 (최고 운영자만)
create or replace function public.church_doc_viewers_list()
returns table (uid uuid, name text, role text, email text, added_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.site_owners o where o.uid = auth.uid()) then raise exception '최고 운영자만 볼 수 있습니다'; end if;
  return query
    select v.uid, coalesce(p.name, '')::text, coalesce(p.role, '')::text, coalesce(u.email, '')::text, v.added_at
    from public.church_doc_viewers v left join public.profiles p on p.id = v.uid left join auth.users u on u.id = v.uid
    order by v.added_at;
end $$;
revoke all on function public.church_doc_viewers_list() from public, anon;
grant execute on function public.church_doc_viewers_list() to authenticated;

-- 지정할 사람 찾기 (최고 운영자만, 이름 두 글자 이상)
create or replace function public.church_doc_people(q text)
returns table (uid uuid, name text, role text, email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.site_owners o where o.uid = auth.uid()) then raise exception '최고 운영자만 쓸 수 있습니다'; end if;
  if length(coalesce(trim(q), '')) < 2 then return; end if;
  return query
    select p.id, coalesce(p.name, '')::text, coalesce(p.role, '')::text, coalesce(u.email, '')::text
    from public.profiles p join auth.users u on u.id = p.id
    where p.suspended_at is null and (p.name ilike '%' || trim(q) || '%' or u.email ilike '%' || trim(q) || '%')
    order by p.name limit 20;
end $$;
revoke all on function public.church_doc_people(text) from public, anon;
grant execute on function public.church_doc_people(text) to authenticated;

-- 열람자 지정·해제 (최고 운영자만, 기록 남김)
create or replace function public.church_doc_viewer_set(p_uid uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.site_owners o where o.uid = auth.uid()) then raise exception '최고 운영자만 지정할 수 있습니다'; end if;
  if p_on then
    insert into public.church_doc_viewers (uid, added_by) values (p_uid, auth.uid()) on conflict (uid) do nothing;
    insert into public.church_doc_log (uid, action, target) values (auth.uid(), '열람자 지정', p_uid);
  else
    delete from public.church_doc_viewers where uid = p_uid;
    insert into public.church_doc_log (uid, action, target) values (auth.uid(), '열람자 해제', p_uid);
  end if;
end $$;
revoke all on function public.church_doc_viewer_set(uuid, boolean) from public, anon;
grant execute on function public.church_doc_viewer_set(uuid, boolean) to authenticated;

-- 기록 보기 (최고 운영자만, 최근 100건)
create or replace function public.church_doc_log_list()
returns table (at timestamptz, who text, action text, what text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.site_owners o where o.uid = auth.uid()) then raise exception '최고 운영자만 볼 수 있습니다'; end if;
  return query
    select l.at, coalesce(p.name, u.email, '')::text, l.action,
           coalesce(l.detail, tp.name, tu.email, '')::text
    from public.church_doc_log l
    left join public.profiles p on p.id = l.uid left join auth.users u on u.id = l.uid
    left join public.profiles tp on tp.id = l.target left join auth.users tu on tu.id = l.target
    order by l.at desc limit 100;
end $$;
revoke all on function public.church_doc_log_list() from public, anon;
grant execute on function public.church_doc_log_list() to authenticated;

-- 확인: 표 3개 · 저장소 1개 · 최고 운영자 수
select (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('church_docs', 'church_doc_viewers', 'church_doc_log')) as tables,
       (select count(*) from storage.buckets where id = 'church-docs' and not public) as private_bucket,
       (select count(*) from public.site_owners) as owners;
