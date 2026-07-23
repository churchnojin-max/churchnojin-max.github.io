-- 찬양곡 라이브러리(worship_songs): 예배 찬양을 체계적으로 모아 두고 검색·필터·순환 관리하는 관리자 전용 DB.
-- 노션 「찬양곡 라이브러리」를 앱으로 옮긴 것. 관리자(admins 테이블 등록자)만 읽기/쓰기 가능.
-- Supabase → SQL Editor 에 붙여넣고 1회 실행하세요.

create table if not exists public.worship_songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,            -- 곡명
  type text,                      -- 유형: CCM · 찬송가 · 성가대곡 · 복음성가
  theme_tags text[] default '{}', -- 주제태그(여러 개): 은혜·감사·회개·치유·부활·성탄·찬양·기도·성령·십자가·소망·평안·믿음·인도
  use_tags text[] default '{}',   -- 추천용도(여러 개): 예배전찬양·성가대특송·응답찬양·새벽기도·수요예배
  difficulty text,                -- 난이도: 쉬움 · 보통 · 어려움
  familiarity text,               -- 회중숙지도: 매우 익숙 · 보통 · 새로운 곡
  hymn_no int,                    -- 기쁨으로찬양(찬송가) 번호
  transpose text,                 -- 조옮김 코드(예: G→A)
  youtube_url text,               -- 유튜브 링크
  lyrics_url text,                -- 가사 링크
  note text,                      -- 비고
  created_by uuid default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists worship_songs_title_idx on public.worship_songs (title);

alter table public.worship_songs enable row level security;

drop policy if exists "admin all worship_songs" on public.worship_songs;
create policy "admin all worship_songs" on public.worship_songs for all
  using (exists (select 1 from public.admins a where a.uid = auth.uid()))
  with check (exists (select 1 from public.admins a where a.uid = auth.uid()));
