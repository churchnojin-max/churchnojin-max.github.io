-- ============================================================
--  노진교회 — 백업에서 되살리기 도구 (2026-10-03 되살리기 연습에서 만듦)
--  Supabase ▸ SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다. owner_guard_20261003.sql 다음에.
-- ------------------------------------------------------------
--  왜: 연습해 보니 표 24개(헌금·지출·교적·공지 등)는 id 를 DB가 직접 매기는 방식(identity always)이라,
--      홈페이지 API(REST)로 백업 줄을 그냥 넣으면 "id 를 넣을 수 없다"는 오류가 난다.
--      → 원래 번호 그대로 넣으려면 SQL 의 'overriding system value' 가 필요해서 함수로 만든다.
--  둘 다 사무실 PC 비상 복구 도구(service_role 열쇠)만 부를 수 있다. 홈페이지에서는 못 부른다.
--
--  restore_drill(표, 백업 줄들) : 연습. 같은 꼴의 임시 복사본(이 요청이 끝나면 사라짐)에 백업 줄을 실제로 넣어 보고
--                                지금 자료와 줄마다 비교한다. 실제 표는 건드리지 않는다.
--  restore_rows(표, 백업 줄들)  : 실제 되살리기. 지금 없는 줄(지워진 줄)만 원래 번호 그대로 넣는다(있는 줄은 그대로 둠).
--                                되살린 일은 access_log 에 '백업에서 되살림'으로 남는다.
--  ※ 표끼리 이어진 것(외래 열쇠)이 있으면 부모 표부터: edu_records→edu_materials, album_photos→album_likes·album_comments,
--     posts→comments·post_reactions, sermons·worship_songs→sermon_songs. auth.users 를 가리키는 줄은 그 계정이 있어야 들어간다.
-- ============================================================

create or replace function public.restore_drill(p_table text, p_rows jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  rel regclass := to_regclass(format('public.%I', p_table));
  cols text; pkjoin text; pk1 text; has_ident boolean;
  n_ins int; n_same int; n_changed int; n_only_backup int; n_live int;
begin
  if public._from_web() then
    raise exception '홈페이지에서는 쓸 수 없습니다.';
  end if;
  if rel is null then
    return json_build_object('table', p_table, 'error', '지금 DB에 없는 표');
  end if;
  select string_agg(format('%I', attname), ',' order by attnum), bool_or(attidentity = 'a')
    into cols, has_ident
    from pg_attribute where attrelid = rel and attnum > 0 and not attisdropped and attgenerated = '';
  select string_agg(format('d.%1$I = l.%1$I', a.attname), ' and '), min(format('%I', a.attname))
    into pkjoin, pk1
    from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
   where i.indrelid = rel and i.indisprimary;
  if pkjoin is null then
    return json_build_object('table', p_table, 'error', '기본 열쇠(primary key)가 없는 표');
  end if;

  -- 같은 꼴(칸·기본값·검사 규칙·번호 매김)의 임시 복사본. 트리거·외래 열쇠는 따라오지 않는다
  drop table if exists pg_temp._drill;
  execute format('create temp table _drill (like public.%I including all) on commit drop', p_table);
  -- 실제 되살리기(restore_rows)와 같은 꼴로 넣어 본다
  execute format('insert into _drill (%s) %s select %s from jsonb_populate_recordset(null::public.%I, $1)',
                 cols, case when has_ident then 'overriding system value' else '' end, cols, p_table) using p_rows;
  get diagnostics n_ins = row_count;
  execute format('select count(*) from public.%I', p_table) into n_live;
  execute format('select count(*) filter (where l.%1$s is not null and to_jsonb(d) = to_jsonb(l)),
                         count(*) filter (where l.%1$s is not null and to_jsonb(d) <> to_jsonb(l)),
                         count(*) filter (where l.%1$s is null)
                    from _drill d left join public.%2$I l on %3$s', pk1, p_table, pkjoin)
    into n_same, n_changed, n_only_backup;
  drop table _drill;
  return json_build_object('table', p_table, 'rows', jsonb_array_length(p_rows), 'inserted', n_ins,
                           'same', n_same, 'changed', n_changed, 'only_backup', n_only_backup, 'live', n_live,
                           'identity', has_ident);
end $$;
revoke all on function public.restore_drill(text, jsonb) from public, anon, authenticated;
grant execute on function public.restore_drill(text, jsonb) to service_role;

create or replace function public.restore_rows(p_table text, p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare rel regclass := to_regclass(format('public.%I', p_table)); cols text; has_ident boolean; n int;
begin
  if public._from_web() then
    raise exception '홈페이지에서는 쓸 수 없습니다.';
  end if;
  if rel is null then
    raise exception '지금 DB에 없는 표: %', p_table;
  end if;
  select string_agg(format('%I', attname), ',' order by attnum), bool_or(attidentity = 'a')
    into cols, has_ident
    from pg_attribute where attrelid = rel and attnum > 0 and not attisdropped and attgenerated = '';
  execute format('insert into public.%I (%s) %s select %s from jsonb_populate_recordset(null::public.%I, $1) on conflict do nothing',
                 p_table, cols, case when has_ident then 'overriding system value' else '' end, cols, p_table) using p_rows;
  get diagnostics n = row_count;
  if n > 0 then
    insert into public.access_log(actor, target, what, detail)
    values (null, null, '백업에서 되살림', jsonb_build_object('table', p_table, 'rows', n));
  end if;
  return n;
end $$;
revoke all on function public.restore_rows(text, jsonb) from public, anon, authenticated;
grant execute on function public.restore_rows(text, jsonb) to service_role;

-- 기록 화면: 대상이 없는 기록은 '모든 사람'(강제 로그아웃) 또는 '-'(되살림 등)
create or replace function public.list_access_log(p_limit int default 50)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.admins where uid = auth.uid()) then
    raise exception '관리자만 볼 수 있습니다.';
  end if;
  return coalesce((
    select json_agg(x order by x.at desc) from (
      select l.at, l.what, l.detail,
             coalesce(pa.name, case when l.actor is null then '관리 화면·비상 복구' else '(알 수 없음)' end) as actor_name,
             coalesce(pt.name, case when l.target is not null then '(이름 없음)'
                                    when l.what = '강제 로그아웃' then '모든 사람' else '-' end) as target_name
      from public.access_log l
      left join public.profiles pa on pa.id = l.actor
      left join public.profiles pt on pt.id = l.target
      order by l.at desc
      limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) x), '[]'::json);
end $$;
revoke all on function public.list_access_log(int) from public, anon;
grant execute on function public.list_access_log(int) to authenticated;

-- 확인: 홈페이지 사용자는 못 부르고(false) 비상 복구 열쇠는 부를 수 있어야(true)
select has_function_privilege('authenticated', 'public.restore_rows(text, jsonb)', 'execute') as web_restore,
       has_function_privilege('authenticated', 'public.restore_drill(text, jsonb)', 'execute') as web_drill,
       has_function_privilege('service_role', 'public.restore_rows(text, jsonb)', 'execute') as service_restore;
