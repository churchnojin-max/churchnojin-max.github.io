-- 분가 세대 연결: 세대주가 어느 부모 가정에서 분가했는지(출신 세대주 이름)
-- 세대를 합치지 않고 가계도에서 부모→분가 가정을 가지로 표시하기 위함.
alter table public.gyojeok add column if not exists origin_head text;
