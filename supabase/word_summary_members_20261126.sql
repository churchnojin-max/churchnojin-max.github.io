-- 2026-11-26 목사님: "로그인 안 해도 말씀 자료를 다 볼 수 있게 되어 있네… 이것도 수정하고"
-- 주보의 설교 요약·말씀 자료(data.summary)를 로그인 안 한 분(과 승인 전 회원)에게서 뺀다.
-- 제목·본문·설교자·본문 말씀(headline)은 그대로 보인다.
-- 정회원·외부 성도는 지금처럼 본다(outside_member_20261020.sql 의 나머지 규칙은 그대로).
create or replace view public.bulletins_public as
select id, bdate, title, scripture, preacher,
       case when public.is_full_member()    then data - 'offering_amounts'
            when public.is_outside_member() then data - 'offering_amounts' - 'offering' - 'pdf_url' - 'pdf_name'
            else data - 'offering_amounts' - 'offering' - 'committee' - 'pdf_url' - 'pdf_name' - 'summary'
       end as data,
       updated_at
from public.bulletins
where published = true;
