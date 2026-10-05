-- 수요기도회 말씀 자료(인용 구절·설교 요약) — 2026-10-05 목사님 요청
--   "수요예배 때 성도들이 참고할 수 있도록 인용 구절과 설교 요약을 홈페이지에"
--   목사님 결정: 예배와 말씀 + 수요일 첫 화면 / 저녁 8시에 한꺼번에 / 로그인한 회원만 / 목사님 확인 뒤 올림
--
-- 원고(sermons, 관리자만)는 그대로 두고, 성도님께 보여 줄 자료만 여기에 따로 담는다.
--   · 만들기: tools/wed_notes.py (수요일 예약 작업의 클로드가 원고를 읽고 요약, 구절 본문은 bible-verse 자료에서) → status 'draft'
--   · 올리기: 텔레그램 [올리기] 단추(비서봇, service_role) 또는 홈페이지 미리보기의 [올리기](관리자) → status 'approved'
--   · 보이기: 올린 것만, 그날 저녁 8시(publish_at, 트리거가 정함)부터, 로그인한 분께만. 관리자는 확인 전 것도 미리 본다.
-- Supabase → SQL Editor 에 1회 실행.

create table if not exists public.sermon_notes (
  id          uuid primary key default gen_random_uuid(),
  sermon_id   uuid references public.sermons(id) on delete set null,
  service     text not null default '수요기도회',
  note_date   date not null,
  title       text,
  scripture   text,                                   -- 본문 장절(예: 에베소서 3:7~9)
  preacher    text,
  series      text,                                   -- 예: 에베소서 강해 21강
  passage     jsonb not null default '[]'::jsonb,     -- 본문 [{"v":7,"t":"…"}]
  verses      jsonb not null default '[]'::jsonb,     -- 인용 구절(설교에서 읽는 순서) [{"ref":"에베소서 1:20","lines":[{"v":20,"t":"…"}]}]
  mentions    jsonb not null default '[]'::jsonb,     -- 말씀 중에 이름만 나온 구절(같은 모양)
  summary     jsonb,                                  -- {"question","points":[{"label","text"}],"one_line","prayers":[{"label","text"}],"next"}
  status      text not null default 'draft' check (status in ('draft', 'approved')),
  publish_at  timestamptz,                            -- 그날 저녁 8시(한국 시각) — 트리거가 채움
  approved_at timestamptz,
  approved_by uuid,
  source_hash text,                                   -- 만들 때 원고의 지문(원고가 바뀌었는지 보려고)
  made_by     text,                                   -- claude / pastor
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (service, note_date)
);

-- 저녁 8시 공개 시각·올린 때·고친 때를 늘 같은 규칙으로
create or replace function public.sermon_notes_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.publish_at := (new.note_date + time '20:00') at time zone 'Asia/Seoul';
  if new.status = 'approved' then
    if tg_op = 'INSERT' or old.status is distinct from 'approved' then
      new.approved_at := now();
      new.approved_by := auth.uid();
    end if;
  else
    new.approved_at := null;
    new.approved_by := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_sermon_notes_touch on public.sermon_notes;
create trigger trg_sermon_notes_touch before insert or update on public.sermon_notes
  for each row execute function public.sermon_notes_touch();

alter table public.sermon_notes enable row level security;

-- 성도(로그인한 분): 목사님이 올린 것만, 저녁 8시부터
drop policy if exists "sermon notes members read" on public.sermon_notes;
create policy "sermon notes members read" on public.sermon_notes for select to authenticated
  using (status = 'approved' and publish_at <= now());

-- 관리자(목사님): 확인 전 것도 미리 보고, 고치고, 올리고 내린다(새로 만들기·지우기는 도구만)
drop policy if exists "sermon notes admin read" on public.sermon_notes;
create policy "sermon notes admin read" on public.sermon_notes for select to authenticated
  using (public.is_admin());
drop policy if exists "sermon notes admin update" on public.sermon_notes;
create policy "sermon notes admin update" on public.sermon_notes for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.sermon_notes from anon;
revoke all on public.sermon_notes from authenticated;
grant select, update on public.sermon_notes to authenticated;

-- 첫 화면 띠(수요일 저녁 8시 ~ 목요일 낮 12시): 열린 자료가 있는지. 제목은 로그인한 분께만 알려 준다.
create or replace function public.wed_note_now() returns json
language sql stable security definer set search_path = public as $$
  select coalesce((
    select json_build_object(
      'open', true,
      'date', n.note_date,
      'title', case when auth.uid() is not null then n.title end,
      'scripture', case when auth.uid() is not null then n.scripture end)
    from public.sermon_notes n
    where n.status = 'approved' and n.publish_at <= now() and now() < n.publish_at + interval '16 hours'
    order by n.note_date desc
    limit 1), json_build_object('open', false));
$$;
revoke all on function public.wed_note_now() from public;
grant execute on function public.wed_note_now() to anon, authenticated;
