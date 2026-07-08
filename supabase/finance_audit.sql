-- 재정 전표 감사추적: 입력자/입력일시·수정자/수정일시 + 전체 변경 로그
-- offerings(수입), expenses(지출) 공통. is_finance() 는 offerings.sql 에서 정의됨.

-- 1) 감사 컬럼
alter table public.offerings add column if not exists created_by text;
alter table public.offerings add column if not exists created_at timestamptz default now();
alter table public.offerings add column if not exists updated_by text;
alter table public.offerings add column if not exists updated_at timestamptz;
alter table public.expenses add column if not exists created_by text;
alter table public.expenses add column if not exists created_at timestamptz default now();
alter table public.expenses add column if not exists updated_by text;
alter table public.expenses add column if not exists updated_at timestamptz;

-- 2) 현재 사용자 표기(이름 우선, 없으면 이메일)
create or replace function public.actor_label() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'name', ''),
    nullif(current_setting('request.jwt.claims', true)::json ->> 'email', ''),
    auth.uid()::text
  )
$$;

-- 3) 입력/수정 스탬프 트리거
create or replace function public.stamp_voucher() returns trigger language plpgsql as $$
begin
  if (TG_OP = 'INSERT') then
    if new.created_by is null then new.created_by := public.actor_label(); end if;
    if new.created_at is null then new.created_at := now(); end if;
  elsif (TG_OP = 'UPDATE') then
    new.created_by := old.created_by;     -- 입력자 보존
    new.created_at := old.created_at;
    new.updated_by := public.actor_label();
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_stamp on public.offerings;
create trigger trg_stamp before insert or update on public.offerings for each row execute function public.stamp_voucher();
drop trigger if exists trg_stamp on public.expenses;
create trigger trg_stamp before insert or update on public.expenses for each row execute function public.stamp_voucher();

-- 4) 전체 변경 로그(추가·수정·삭제 모두 기록)
create table if not exists public.finance_audit (
  id       bigint generated always as identity primary key,
  tbl      text not null,            -- 'offerings' | 'expenses'
  row_id   bigint,
  action   text not null,            -- INSERT | UPDATE | DELETE
  actor    text,
  at       timestamptz not null default now(),
  amount   bigint,
  account  text,
  party    text,                     -- giver(헌금자) / payee(수령인)
  snapshot jsonb
);
create index if not exists finance_audit_at_idx on public.finance_audit (at desc);

alter table public.finance_audit enable row level security;
drop policy if exists finance_audit_sel on public.finance_audit;
create policy finance_audit_sel on public.finance_audit for select using ( public.is_finance() );
-- INSERT 정책 없음: 아래 트리거(security definer)만 기록 가능 → 위변조 방지

create or replace function public.log_voucher_audit() returns trigger language plpgsql security definer as $$
declare r record; acct text; pty text;
begin
  if (TG_OP = 'DELETE') then r := old; else r := new; end if;
  if (TG_TABLE_NAME = 'offerings') then acct := r.category; pty := r.giver; else acct := r.account; pty := r.payee; end if;
  insert into public.finance_audit(tbl, row_id, action, actor, amount, account, party, snapshot)
    values (TG_TABLE_NAME, r.id, TG_OP, public.actor_label(), r.amount, acct, pty, to_jsonb(r));
  return null;
end $$;

drop trigger if exists trg_audit on public.offerings;
create trigger trg_audit after insert or update or delete on public.offerings for each row execute function public.log_voucher_audit();
drop trigger if exists trg_audit on public.expenses;
create trigger trg_audit after insert or update or delete on public.expenses for each row execute function public.log_voucher_audit();
