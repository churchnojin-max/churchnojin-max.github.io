-- 기부금영수증 발급대장 (소득세법 시행규칙 별지 제45호의2서식 발급 이력)
-- 재정 권한자만 조회/발급/취소 가능. is_finance() 는 offerings.sql 에서 정의됨.
create table if not exists public.donation_receipts (
  id           bigint generated always as identity primary key,
  receipt_no   text not null,                 -- 일련번호 예) 2026-0001
  fy           int  not null,                  -- 회계연도(라벨연도)
  member_key   text,                           -- 대표 기부자 매칭키(이름|YYYYMMDD)
  donor_name   text not null,                  -- 기부자 성명
  donor_birth  text,                           -- 생년월일 YYYYMMDD
  donor_rrn    text,                           -- 주민등록번호(선택)
  donor_addr   text,                           -- 주소
  included_keys text[] default '{}',           -- 합산된 매칭키들(부부합산 시 본인+배우자)
  detail       text not null default 'sum',    -- 명세방식: sum(합계) | month(월별) | account(항목별)
  spouse       boolean not null default false, -- 부부합산 여부
  period_label text,                           -- 기간 라벨 예) 2026년도(2025-12-01~2026-11-30)
  amount       bigint not null default 0,      -- 기부금 합계
  cnt          int not null default 0,         -- 헌금 건수
  method       text not null default 'print',  -- 발급방식: print(출력) | pdf
  status       text not null default 'issued', -- issued | cancelled
  issued_by    text,                           -- 발급자(이메일)
  issued_at    timestamptz not null default now(),
  cancelled_at timestamptz
);

create index if not exists donation_receipts_fy_idx on public.donation_receipts (fy);
create index if not exists donation_receipts_key_idx on public.donation_receipts (member_key);

alter table public.donation_receipts enable row level security;

drop policy if exists donation_receipts_all on public.donation_receipts;
create policy donation_receipts_all on public.donation_receipts for all
  using ( public.is_finance() ) with check ( public.is_finance() );
