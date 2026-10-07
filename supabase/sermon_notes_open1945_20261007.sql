-- 수요기도회 말씀 자료 여는 시각: 저녁 8시 → 7시 45분 (2026-10-07 목사님)
--   "설교 참고자료 올리는 시간을 8시로 했는데 내가 미리 줄테니 7시 45분쯤에 팝업이 뜨거나
--    또는 그때 열려져서 자료가 보일 수 있도록"
--   닫는 때(밤 10시 30분)·악보(그날 0시부터)는 그대로. 첫 화면 알림 창은 js/wed-notes.js 가 띄운다.
-- 앞의 sermon_notes_20261005.sql, sermon_notes_short_conti_20261005.sql 다음에 1회 실행. 여러 번 실행해도 안전하다.

create or replace function public.sermon_notes_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.publish_at := (new.note_date + time '19:45') at time zone 'Asia/Seoul';
  new.close_at   := (new.note_date + time '22:30') at time zone 'Asia/Seoul';
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

-- 오늘 이후 자료도 새 시각으로(트리거가 다시 정한다 — 올린 때·올린 사람은 그대로)
update public.sermon_notes set note_date = note_date
 where note_date >= (now() at time zone 'Asia/Seoul')::date;
