-- ============================================================
--  ○○교회 — TTS 음성 캐시 버킷(tts-cache)
--  글→음성을 한 번만 만들고 저장해 두고 재사용(재생은 사실상 무료).
--  Supabase ▸ SQL Editor 에 1회 실행. (tts Edge Function 배포 전/후 아무 때나)
-- ============================================================

-- 공개 버킷: 읽기는 누구나(그냥 QT 음성), 쓰기는 Edge Function이 서비스 키로만 함
insert into storage.buckets (id, name, public)
values ('tts-cache', 'tts-cache', true)
on conflict (id) do update set public = true;
