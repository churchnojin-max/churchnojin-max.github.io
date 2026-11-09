-- ============================================================
--  노진교회 — 발급 문서(증명서·기부금영수증)를 교인 대시보드에서 내려받기 (2026-11-09)
--  Supabase ▸ SQL Editor 에서 실행. 여러 번 실행해도 안전하다.
--
--  흐름: 목회 작업실 › 공문서 제작이 PDF 를 교회 폴더(D:\교회\노진교회\행정\발급문서\<연도>)에 저장
--        → 관리자가 홈페이지 목회행정 › 자료실 › 「발급 문서 올리기」로 그 PDF 들을 올림(비공개 보관함 archive/)
--        → 그 교인(정회원, 교적과 이어진 회원)이 대시보드 「나의 문서 › 내 발급 문서」에서 내려받음.
--
--  이미 있던 것: member_files(자료실) + 본인 열람 규칙(member_files_select_own, my_member_keys())
--               + 비공개 보관함 private_files 의 archive/ 읽기 규칙(그 파일을 가리키는 member_files 행이 본인 것일 때).
--  여기서 더하는 것:
--    ① issued(발급 문서인가) · doc_no(문서번호 — 중복 올리기 방지) · visible(교인에게 보이는가, 기본 보임)
--    ② 본인 열람 규칙과 보관함 읽기 규칙에 visible 조건을 더해, 관리자가 「숨김」으로 바꾼 파일은 교인에게 안 보이게.
--  없애는 것 없음. 기존 자료는 visible=true 라 지금과 똑같이 보인다.
-- ============================================================
begin;

alter table public.member_files add column if not exists issued  boolean not null default false;   -- 발급 문서(증명서·영수증)
alter table public.member_files add column if not exists doc_no  text;                              -- 문서번호: 노진 제2026-01호 / 2026-0001
alter table public.member_files add column if not exists visible boolean not null default true;    -- 교인 본인에게 보이는가
create index if not exists member_files_docno_idx on public.member_files(doc_no);

-- ① 본인(+배우자) 열람: 숨김(visible=false)은 빼고
drop policy if exists "member_files_select_own" on public.member_files;
create policy "member_files_select_own" on public.member_files for select
  using ( coalesce(visible, true) and member_key in (select public.my_member_keys()) );

-- ② 비공개 보관함 읽기 규칙 — private_files_bucket.sql 의 것과 같되 archive/ 에 visible 조건만 더함
drop policy if exists "private_files read" on storage.objects;
create policy "private_files read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'private_files' and (
      public.private_file_staff(name)
      or (name like 'gyojeok/%'   and public.is_finance())
      or (name like 'resources/%' and public.is_full_member())
      or (name like 'archive/%'   and exists (
            select 1 from public.member_files f
             where f.file_key = storage.objects.name
               and coalesce(f.visible, true)
               and f.member_key in (select public.my_member_keys())))
    )
  );

commit;

-- 확인: 칸이 생겼는지
-- select column_name from information_schema.columns where table_name = 'member_files' and column_name in ('issued','doc_no','visible');
