-- ============================================================
-- ○○교회 — 회원 탈퇴(본인 프로필 삭제) 권한
-- Supabase ▸ SQL Editor 에 붙여넣고 Run 하세요. (한 번만)
-- ============================================================

-- 본인 또는 관리자가 프로필을 삭제할 수 있도록 허용
drop policy if exists "profiles_delete_self_or_admin" on public.profiles;
create policy "profiles_delete_self_or_admin" on public.profiles for delete
  using (auth.uid() = id or auth.uid() in (select uid from public.admins));

-- (참고) 연말정산 신청 본인 삭제 권한은 profile-tax.sql 에서 이미 생성됨:
--   tax_delete_self_or_admin
