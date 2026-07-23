-- 찬양곡 라이브러리 일괄 등록(노션 「찬양곡 라이브러리」 464곡) — Supabase ▸ SQL Editor 에서 1회 실행.
-- 선행: supabase/worship_songs.sql 로 테이블이 먼저 있어야 합니다.
-- 같은 제목이 이미 있으면 건너뜁니다(중복 방지). 여러 번 실행해도 안전합니다.

insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '부활하신 주님','CCM',ARRAY['부활','소망'],ARRAY['예배전찬양','응답찬양'],'보통','새로운 곡',NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='부활하신 주님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '할렐루야 아멘','성가대곡',ARRAY['부활','찬양'],ARRAY['성가대특송'],'어려움','보통',NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='할렐루야 아멘');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '여호와는 나의 목자시니','성가대곡',ARRAY['은혜','평안'],ARRAY['성가대특송'],'어려움','보통',NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='여호와는 나의 목자시니');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 하나님 지으신 모든 세계','찬송가',ARRAY['감사','찬양'],ARRAY['예배전찬양'],'쉬움','매우 익숙',NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 하나님 지으신 모든 세계');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주의 사랑이 나를 놀라게 하네','CCM',ARRAY['감사','은혜'],ARRAY['예배전찬양','응답찬양'],'보통','보통',NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주의 사랑이 나를 놀라게 하네');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '그 사랑 얼마나','CCM',ARRAY['십자가','은혜'],ARRAY['예배전찬양','응답찬양'],'쉬움','보통',NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='그 사랑 얼마나');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나 같은 죄인 살리신(주찬양 주찬양 내 마음다해)','찬송가',ARRAY['십자가','은혜'],ARRAY['예배전찬양','응답찬양'],'쉬움','매우 익숙',NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나 같은 죄인 살리신(주찬양 주찬양 내 마음다해)');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '감사함으로 그 문에 들어가며','CCM',ARRAY['감사','찬양'],ARRAY['예배전찬양'],'쉬움','매우 익숙',NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='감사함으로 그 문에 들어가며');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '내 영혼의 그윽히 깊은 데서','찬송가',ARRAY['은혜','평안'],ARRAY['응답찬양'],'쉬움','매우 익숙',NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='내 영혼의 그윽히 깊은 데서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수 나의 첫사랑','CCM',ARRAY['기도','은혜'],ARRAY['응답찬양'],'보통','새로운 곡',NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수 나의 첫사랑');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '내 평생에 가는 길','성가대곡',ARRAY['믿음'],ARRAY['성가대특송'],'쉬움','매우 익숙',NULL,NULL,'https://www.youtube.com/watch?v=mNwz0ttmxGI',NULL,NULL where not exists (select 1 from public.worship_songs where title='내 평생에 가는 길');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나의 힘이 되신 여호와여','CCM',ARRAY['인도'],ARRAY['예배전찬양'],'쉬움','매우 익숙',NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나의 힘이 되신 여호와여');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님 내게 오시면','CCM',ARRAY['은혜','회개'],ARRAY['예배전찬양'],'보통','보통',NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님 내게 오시면');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 하나님 크신 은혜','찬송가',ARRAY['감사','믿음','은혜','인도'],ARRAY['예배전찬양','응답찬양'],'쉬움','매우 익숙',NULL,NULL,NULL,NULL,'Great Is Thy Faithfulness / 찬송가 309장. 헤세드(하나님의 신실한 사랑) 주제에 최적.' where not exists (select 1 from public.worship_songs where title='주 하나님 크신 은혜');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '마음   속에  근심 있는 사람','CCM',ARRAY['평안'],ARRAY['성가대특송'],'쉬움','매우 익숙',NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='마음   속에  근심 있는 사람');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수 따라가며','찬송가',ARRAY['믿음','소망','인도'],ARRAY['예배전찬양','응답찬양'],'쉬움','매우 익숙',NULL,NULL,NULL,NULL,'찬송가 449장. ''예수 따라가며 복음 순종하면 어려운 일 당해도 족한 은혜 주시네''. 부르심의 자리에서 순종하는 삶을 고백하는 응답찬양. 고전 7:17,20,24 ''부르심 받은 그 자리''와 7:26 ''임박한 환난'' 속에서의 순종과 직결.' where not exists (select 1 from public.worship_songs where title='예수 따라가며');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '내 안에 부어주소서','CCM','{}'::text[],'{}'::text[],NULL,NULL,50,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='내 안에 부어주소서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나 같은 죄인 살리신','CCM','{}'::text[],'{}'::text[],NULL,NULL,28,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나 같은 죄인 살리신');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '그때 그 무리들과 함께','CCM','{}'::text[],'{}'::text[],NULL,NULL,22,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='그때 그 무리들과 함께');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '감사드립니다','CCM','{}'::text[],'{}'::text[],NULL,NULL,3,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='감사드립니다');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '내 삶의 이유','CCM','{}'::text[],'{}'::text[],NULL,NULL,48,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='내 삶의 이유');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '구원자 주 예수','CCM','{}'::text[],'{}'::text[],NULL,NULL,19,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='구원자 주 예수');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나는 주의 친구','CCM','{}'::text[],'{}'::text[],NULL,NULL,33,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나는 주의 친구');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '경배하리 주 하나님','CCM','{}'::text[],'{}'::text[],NULL,NULL,15,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='경배하리 주 하나님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나 무엇과도 주님을','CCM','{}'::text[],'{}'::text[],NULL,NULL,29,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나 무엇과도 주님을');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '거룩하신 하나님','CCM','{}'::text[],'{}'::text[],NULL,NULL,11,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='거룩하신 하나님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나는 주의 것','CCM','{}'::text[],'{}'::text[],NULL,NULL,32,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나는 주의 것');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '기쁘다 구주 오셨네','CCM','{}'::text[],'{}'::text[],NULL,NULL,25,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='기쁘다 구주 오셨네');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나의 삶을 완전히','CCM','{}'::text[],'{}'::text[],NULL,NULL,36,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나의 삶을 완전히');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나의 주 나의 하나님','CCM','{}'::text[],'{}'::text[],NULL,NULL,40,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나의 주 나의 하나님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나의 피난처','CCM','{}'::text[],'{}'::text[],NULL,NULL,41,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나의 피난처');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '경배하리 내 온 맘 다해','CCM','{}'::text[],'{}'::text[],NULL,NULL,14,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='경배하리 내 온 맘 다해');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '내 기도하는 그 시간','CCM','{}'::text[],'{}'::text[],NULL,NULL,45,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='내 기도하는 그 시간');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '가서 제자 삼으라','CCM','{}'::text[],'{}'::text[],NULL,NULL,1,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='가서 제자 삼으라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나의 영혼이 잠잠히','CCM','{}'::text[],'{}'::text[],NULL,NULL,39,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나의 영혼이 잠잠히');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '갈보리 십자가','CCM','{}'::text[],'{}'::text[],NULL,NULL,2,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='갈보리 십자가');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '거룩한 주 하나님','CCM','{}'::text[],'{}'::text[],NULL,NULL,13,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='거룩한 주 하나님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '감사해요 깨닫지','CCM','{}'::text[],'{}'::text[],NULL,NULL,5,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='감사해요 깨닫지');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '거룩한 땅에','CCM','{}'::text[],'{}'::text[],NULL,NULL,12,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='거룩한 땅에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '그래도 하나님을','CCM','{}'::text[],'{}'::text[],NULL,NULL,23,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='그래도 하나님을');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '괴로울 때 주님의','CCM','{}'::text[],'{}'::text[],NULL,NULL,18,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='괴로울 때 주님의');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '감사해','CCM','{}'::text[],'{}'::text[],NULL,NULL,4,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='감사해');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '날마다 숨쉬는 순간마다','CCM','{}'::text[],'{}'::text[],NULL,NULL,43,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='날마다 숨쉬는 순간마다');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '기억하라 아름다운','CCM','{}'::text[],'{}'::text[],NULL,NULL,26,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='기억하라 아름다운');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '거룩 거룩 거룩하신 주','CCM','{}'::text[],'{}'::text[],NULL,NULL,8,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='거룩 거룩 거룩하신 주');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나의 반석이신 하나님','CCM','{}'::text[],'{}'::text[],NULL,NULL,35,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나의 반석이신 하나님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '그 크신 하나님의 사랑','CCM','{}'::text[],'{}'::text[],NULL,NULL,21,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='그 크신 하나님의 사랑');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '고개 들어','CCM','{}'::text[],'{}'::text[],NULL,NULL,16,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='고개 들어');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '내 손을 주께 높이 들고','CCM','{}'::text[],'{}'::text[],NULL,NULL,49,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='내 손을 주께 높이 들고');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나주 없이 살 수 없네','CCM','{}'::text[],'{}'::text[],NULL,NULL,42,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나주 없이 살 수 없네');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '내 구주 예수를 더욱 사랑','CCM','{}'::text[],'{}'::text[],NULL,NULL,44,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='내 구주 예수를 더욱 사랑');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '내 눈 열어','CCM','{}'::text[],'{}'::text[],NULL,NULL,46,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='내 눈 열어');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나는 믿네','CCM','{}'::text[],'{}'::text[],NULL,NULL,31,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나는 믿네');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나의 소망이 되시는','CCM','{}'::text[],'{}'::text[],NULL,NULL,37,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나의 소망이 되시는');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '거룩하신 주님께 나오라','CCM','{}'::text[],'{}'::text[],NULL,NULL,9,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='거룩하신 주님께 나오라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '감사해요 주님의 사랑','CCM','{}'::text[],'{}'::text[],NULL,NULL,6,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='감사해요 주님의 사랑');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '갈릴리 마을','CCM','{}'::text[],'{}'::text[],NULL,NULL,1,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='갈릴리 마을');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나의 가는 길','CCM','{}'::text[],'{}'::text[],NULL,NULL,34,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나의 가는 길');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '거룩 거룩 거룩','CCM','{}'::text[],'{}'::text[],NULL,NULL,7,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='거룩 거룩 거룩');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나 주님의 기쁨 되기 원하네','CCM','{}'::text[],'{}'::text[],NULL,NULL,30,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나 주님의 기쁨 되기 원하네');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '거룩하신 주님','CCM','{}'::text[],'{}'::text[],NULL,NULL,10,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='거룩하신 주님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '깊은 곳에서 주께 부르짖어','CCM','{}'::text[],'{}'::text[],NULL,NULL,27,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='깊은 곳에서 주께 부르짖어');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '내 마음속에 강이 있어','CCM','{}'::text[],'{}'::text[],NULL,NULL,47,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='내 마음속에 강이 있어');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '기뻐하며 경배하세','CCM','{}'::text[],'{}'::text[],NULL,NULL,24,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='기뻐하며 경배하세');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나의 안에 거하라','CCM','{}'::text[],'{}'::text[],NULL,NULL,38,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나의 안에 거하라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '그 사랑 얼마나','CCM','{}'::text[],'{}'::text[],NULL,NULL,20,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='그 사랑 얼마나');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '광대하신 주','CCM','{}'::text[],'{}'::text[],NULL,NULL,17,'Bb',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='광대하신 주');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '빈들에 마른 풀 같이','CCM','{}'::text[],'{}'::text[],NULL,NULL,88,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='빈들에 마른 풀 같이');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '새 힘 얻으리','CCM','{}'::text[],'{}'::text[],NULL,NULL,92,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='새 힘 얻으리');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '높고 높은 보좌에','CCM','{}'::text[],'{}'::text[],NULL,NULL,60,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='높고 높은 보좌에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '반드시 오실 주님','CCM','{}'::text[],'{}'::text[],NULL,NULL,82,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='반드시 오실 주님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '따스한 성령의 바람','CCM','{}'::text[],'{}'::text[],NULL,NULL,69,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='따스한 성령의 바람');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '성령이 오셨네','CCM','{}'::text[],'{}'::text[],NULL,NULL,94,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='성령이 오셨네');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '손을 높이 들고 주를 찬양','CCM','{}'::text[],'{}'::text[],NULL,NULL,97,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='손을 높이 들고 주를 찬양');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '누군가 널 위해 기도하네','CCM','{}'::text[],'{}'::text[],NULL,NULL,62,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='누군가 널 위해 기도하네');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '무화과 나무가 무성치 못하며','CCM','{}'::text[],'{}'::text[],NULL,NULL,79,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='무화과 나무가 무성치 못하며');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '성령이여 임하소서','CCM','{}'::text[],'{}'::text[],NULL,NULL,95,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='성령이여 임하소서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '내 평생에 가는 길','CCM','{}'::text[],'{}'::text[],NULL,NULL,56,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='내 평생에 가는 길');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '두 손 들고 찬양합니다','CCM','{}'::text[],'{}'::text[],NULL,NULL,68,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='두 손 들고 찬양합니다');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '보혈을 지나','CCM','{}'::text[],'{}'::text[],NULL,NULL,84,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='보혈을 지나');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '바라봅니다','CCM','{}'::text[],'{}'::text[],NULL,NULL,81,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='바라봅니다');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '목마른 사슴','CCM','{}'::text[],'{}'::text[],NULL,NULL,77,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='목마른 사슴');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '모든 것 가능해','CCM','{}'::text[],'{}'::text[],NULL,NULL,74,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='모든 것 가능해');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '내 주 되신 주를 참 사랑하고','CCM','{}'::text[],'{}'::text[],NULL,NULL,54,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='내 주 되신 주를 참 사랑하고');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '너는 내 것이라','CCM','{}'::text[],'{}'::text[],NULL,NULL,57,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='너는 내 것이라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '높은 산이 무너지고','CCM','{}'::text[],'{}'::text[],NULL,NULL,61,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='높은 산이 무너지고');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '사랑하는 나의 아버지','CCM','{}'::text[],'{}'::text[],NULL,NULL,90,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='사랑하는 나의 아버지');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '생명 주께 있네','CCM','{}'::text[],'{}'::text[],NULL,NULL,93,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='생명 주께 있네');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '내 영혼이 은총 입어','CCM','{}'::text[],'{}'::text[],NULL,NULL,52,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='내 영혼이 은총 입어');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '당신은 사랑받기 위해','CCM','{}'::text[],'{}'::text[],NULL,NULL,66,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='당신은 사랑받기 위해');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '사랑하는 주님','CCM','{}'::text[],'{}'::text[],NULL,NULL,91,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='사랑하는 주님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '내 안에 사랑이 없어','CCM','{}'::text[],'{}'::text[],NULL,NULL,51,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='내 안에 사랑이 없어');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '아름다운 이 세상 아름다운 천지','CCM','{}'::text[],'{}'::text[],NULL,NULL,99,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='아름다운 이 세상 아름다운 천지');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '너는 시냇가에','CCM','{}'::text[],'{}'::text[],NULL,NULL,58,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='너는 시냇가에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '다 드리겠습니다','CCM','{}'::text[],'{}'::text[],NULL,NULL,64,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='다 드리겠습니다');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '너의 하나님 여호와가','CCM','{}'::text[],'{}'::text[],NULL,NULL,59,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='너의 하나님 여호와가');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '십자가의 길 순종의 길','CCM','{}'::text[],'{}'::text[],NULL,NULL,98,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='십자가의 길 순종의 길');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '모든 민족 모든 땅에','CCM','{}'::text[],'{}'::text[],NULL,NULL,76,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='모든 민족 모든 땅에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '내 주의 보혈은','CCM','{}'::text[],'{}'::text[],NULL,NULL,55,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='내 주의 보혈은');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '세상 어느 곳에도','CCM','{}'::text[],'{}'::text[],NULL,NULL,96,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='세상 어느 곳에도');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '다 와서 주를 찬양','CCM','{}'::text[],'{}'::text[],NULL,NULL,65,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='다 와서 주를 찬양');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '복음 들고 가리라','CCM','{}'::text[],'{}'::text[],NULL,NULL,85,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='복음 들고 가리라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '부르심 있는 곳에','CCM','{}'::text[],'{}'::text[],NULL,NULL,86,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='부르심 있는 곳에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '무릎 꿇어라','CCM','{}'::text[],'{}'::text[],NULL,NULL,78,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='무릎 꿇어라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '맡겨라 모든 것을','CCM','{}'::text[],'{}'::text[],NULL,NULL,73,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='맡겨라 모든 것을');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '아버지 하나님','CCM','{}'::text[],'{}'::text[],NULL,NULL,100,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='아버지 하나님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '부활하신 주님','CCM','{}'::text[],'{}'::text[],NULL,NULL,87,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='부활하신 주님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '만세반석 열리니','CCM','{}'::text[],'{}'::text[],NULL,NULL,72,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='만세반석 열리니');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '내 영혼의 그윽히 깊은 데서','CCM','{}'::text[],'{}'::text[],NULL,NULL,53,'Bb',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='내 영혼의 그윽히 깊은 데서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '보내소서','CCM','{}'::text[],'{}'::text[],NULL,NULL,83,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='보내소서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '모든 능력과 힘','CCM','{}'::text[],'{}'::text[],NULL,NULL,75,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='모든 능력과 힘');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '사랑합니다 나의 예수님','CCM','{}'::text[],'{}'::text[],NULL,NULL,89,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='사랑합니다 나의 예수님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '돌아와','CCM','{}'::text[],'{}'::text[],NULL,NULL,67,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='돌아와');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '믿음으로 서리라','CCM','{}'::text[],'{}'::text[],NULL,NULL,80,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='믿음으로 서리라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '만복의 근원 하나님','CCM','{}'::text[],'{}'::text[],NULL,NULL,71,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='만복의 근원 하나님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '마음이 상한 자를','CCM','{}'::text[],'{}'::text[],NULL,NULL,70,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='마음이 상한 자를');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '눈을 들어 주를 보라','CCM','{}'::text[],'{}'::text[],NULL,NULL,63,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='눈을 들어 주를 보라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '눈을 들어','CCM','{}'::text[],'{}'::text[],NULL,NULL,109,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='눈을 들어');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '모든 지각에 뛰어나신','CCM','{}'::text[],'{}'::text[],NULL,NULL,134,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='모든 지각에 뛰어나신');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '너의 하나님 여호와가','CCM','{}'::text[],'{}'::text[],NULL,NULL,104,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='너의 하나님 여호와가');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '모든 민족에게','CCM','{}'::text[],'{}'::text[],NULL,NULL,131,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='모든 민족에게');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '믿음의 형제들이여','CCM','{}'::text[],'{}'::text[],NULL,NULL,138,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='믿음의 형제들이여');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '모든 민족과 열방 향하여','CCM','{}'::text[],'{}'::text[],NULL,NULL,130,'Bb',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='모든 민족과 열방 향하여');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '모든 능력과 모든 권세','CCM','{}'::text[],'{}'::text[],NULL,NULL,128,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='모든 능력과 모든 권세');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '다 와서 찬양해','CCM','{}'::text[],'{}'::text[],NULL,NULL,112,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='다 와서 찬양해');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '보좌에 계신 하나님','CCM','{}'::text[],'{}'::text[],NULL,NULL,142,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='보좌에 계신 하나님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '매일 스치는 사람들','CCM','{}'::text[],'{}'::text[],NULL,NULL,124,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='매일 스치는 사람들');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '맑고 밝은 날','CCM','{}'::text[],'{}'::text[],NULL,NULL,123,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='맑고 밝은 날');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '마지막 날에','CCM','{}'::text[],'{}'::text[],NULL,NULL,120,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='마지막 날에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '만복의 근원 하나님','CCM','{}'::text[],'{}'::text[],NULL,NULL,121,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='만복의 근원 하나님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '당신의 그 섯김이','CCM','{}'::text[],'{}'::text[],NULL,NULL,115,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='당신의 그 섯김이');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '놀라워라','CCM','{}'::text[],'{}'::text[],NULL,NULL,106,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='놀라워라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '두 손 들고 찬양합니다','CCM','{}'::text[],'{}'::text[],NULL,NULL,116,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='두 손 들고 찬양합니다');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '다 찬양하자 주께','CCM','{}'::text[],'{}'::text[],NULL,NULL,113,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='다 찬양하자 주께');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '먼저 그 나라와','CCM','{}'::text[],'{}'::text[],NULL,NULL,125,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='먼저 그 나라와');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '물이 바다 덮음같이','CCM','{}'::text[],'{}'::text[],NULL,NULL,167,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='물이 바다 덮음같이');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '무화과 나무잎이','CCM','{}'::text[],'{}'::text[],NULL,NULL,136,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='무화과 나무잎이');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '모든 민족과 방언들','CCM','{}'::text[],'{}'::text[],NULL,NULL,129,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='모든 민족과 방언들');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '너의 이름을 새롭게','CCM','{}'::text[],'{}'::text[],NULL,NULL,103,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='너의 이름을 새롭게');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '보좌 앞에 무릇 꾸고','CCM','{}'::text[],'{}'::text[],NULL,NULL,141,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='보좌 앞에 무릇 꾸고');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '문들아 머리 들어라','CCM','{}'::text[],'{}'::text[],NULL,NULL,137,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='문들아 머리 들어라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '모든 열방 주 볼 때','CCM','{}'::text[],'{}'::text[],NULL,NULL,79,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='모든 열방 주 볼 때');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '불 속이라도 들어가서','CCM','{}'::text[],'{}'::text[],NULL,NULL,281,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='불 속이라도 들어가서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '마음이 지쳐서','CCM','{}'::text[],'{}'::text[],NULL,NULL,119,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='마음이 지쳐서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '부흥','CCM','{}'::text[],'{}'::text[],NULL,NULL,262,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='부흥');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '모든 만물 다스리시는','CCM','{}'::text[],'{}'::text[],NULL,NULL,127,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='모든 만물 다스리시는');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '빛 되신 주','CCM','{}'::text[],'{}'::text[],NULL,NULL,145,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='빛 되신 주');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '넘지 못할 산이','CCM','{}'::text[],'{}'::text[],NULL,NULL,105,'Eb',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='넘지 못할 산이');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '많은 사람들','CCM','{}'::text[],'{}'::text[],NULL,NULL,122,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='많은 사람들');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '누구든지 목마르거든','CCM','{}'::text[],'{}'::text[],NULL,NULL,107,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='누구든지 목마르거든');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '마음이 상한 자를','CCM','{}'::text[],'{}'::text[],NULL,NULL,118,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='마음이 상한 자를');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '보좌에 앉으소서','CCM','{}'::text[],'{}'::text[],NULL,NULL,143,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='보좌에 앉으소서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '눈을 들어 주를 보라','CCM','{}'::text[],'{}'::text[],NULL,NULL,110,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='눈을 들어 주를 보라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '모든 근심을 주께 맡겨','CCM','{}'::text[],'{}'::text[],NULL,NULL,126,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='모든 근심을 주께 맡겨');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '때로는 너의 앞에','CCM','{}'::text[],'{}'::text[],NULL,NULL,117,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='때로는 너의 앞에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '당신은 사랑받기 위해','CCM','{}'::text[],'{}'::text[],NULL,NULL,114,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='당신은 사랑받기 위해');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '너는 시냇가에','CCM','{}'::text[],'{}'::text[],NULL,NULL,102,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='너는 시냇가에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '반가워요 여러분','CCM','{}'::text[],'{}'::text[],NULL,NULL,140,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='반가워요 여러분');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '목마른 사슴','CCM','{}'::text[],'{}'::text[],NULL,NULL,135,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='목마른 사슴');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '능력의 이름 예수','CCM','{}'::text[],'{}'::text[],NULL,NULL,111,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='능력의 이름 예수');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '눈보다 더 희게','CCM','{}'::text[],'{}'::text[],NULL,NULL,108,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='눈보다 더 희게');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '부흥 2000','CCM','{}'::text[],'{}'::text[],NULL,NULL,223,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='부흥 2000');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '모든 이름 위에','CCM','{}'::text[],'{}'::text[],NULL,NULL,133,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='모든 이름 위에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '복음 들고 산을','CCM','{}'::text[],'{}'::text[],NULL,NULL,144,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='복음 들고 산을');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '모든 영광을 하나님께','CCM','{}'::text[],'{}'::text[],NULL,NULL,132,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='모든 영광을 하나님께');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '바다 같은 주의 사랑','CCM','{}'::text[],'{}'::text[],NULL,NULL,139,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='바다 같은 주의 사랑');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '시와 찬미와','CCM','{}'::text[],'{}'::text[],NULL,NULL,176,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='시와 찬미와');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '성령 하나님 임하소서','CCM','{}'::text[],'{}'::text[],NULL,NULL,165,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='성령 하나님 임하소서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '어린양 예수','CCM','{}'::text[],'{}'::text[],NULL,NULL,190,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='어린양 예수');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '사랑해요 목소리 높여','CCM','{}'::text[],'{}'::text[],NULL,NULL,155,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='사랑해요 목소리 높여');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '선포하라','CCM','{}'::text[],'{}'::text[],NULL,NULL,162,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='선포하라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '손 내밀어 주를 만져라','CCM','{}'::text[],'{}'::text[],NULL,NULL,172,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='손 내밀어 주를 만져라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '세상의 유혹 시험이','CCM','{}'::text[],'{}'::text[],NULL,NULL,171,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='세상의 유혹 시험이');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '손을 높이 들고','CCM','{}'::text[],'{}'::text[],NULL,NULL,173,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='손을 높이 들고');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '사랑합니다 나의 예수님','CCM','{}'::text[],'{}'::text[],NULL,NULL,154,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='사랑합니다 나의 예수님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '어찌하여야','CCM','{}'::text[],'{}'::text[],NULL,NULL,191,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='어찌하여야');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '약할 때 강함 되시네','CCM','{}'::text[],'{}'::text[],NULL,NULL,187,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='약할 때 강함 되시네');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '빛이 없어도','CCM','{}'::text[],'{}'::text[],NULL,NULL,146,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='빛이 없어도');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '선하신 목자','CCM','{}'::text[],'{}'::text[],NULL,NULL,163,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='선하신 목자');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '아버지 큰 사랑','CCM','{}'::text[],'{}'::text[],NULL,NULL,181,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='아버지 큰 사랑');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '아버지 사랑합니다','CCM','{}'::text[],'{}'::text[],NULL,NULL,180,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='아버지 사랑합니다');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '신실하신 하나님','CCM','{}'::text[],'{}'::text[],NULL,NULL,306,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='신실하신 하나님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '사랑의 주님 닮기','CCM','{}'::text[],'{}'::text[],NULL,NULL,150,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='사랑의 주님 닮기');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '사막에 샘이 넘쳐','CCM','{}'::text[],'{}'::text[],NULL,NULL,156,'Em',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='사막에 샘이 넘쳐');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '생명 주께 있네','CCM','{}'::text[],'{}'::text[],NULL,NULL,161,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='생명 주께 있네');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '어린양 되신 예수','CCM','{}'::text[],'{}'::text[],NULL,NULL,189,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='어린양 되신 예수');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '시편 40편','CCM','{}'::text[],'{}'::text[],NULL,NULL,387,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='시편 40편');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '아침 안개 눈 앞 가리듯','CCM','{}'::text[],'{}'::text[],NULL,NULL,183,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='아침 안개 눈 앞 가리듯');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '살아 계신 성령님','CCM','{}'::text[],'{}'::text[],NULL,NULL,159,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='살아 계신 성령님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '사랑의 주님이 날 사랑','CCM','{}'::text[],'{}'::text[],NULL,NULL,151,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='사랑의 주님이 날 사랑');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '어린아이처럼','CCM','{}'::text[],'{}'::text[],NULL,NULL,188,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='어린아이처럼');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '아침에 주의 인자하심을','CCM','{}'::text[],'{}'::text[],NULL,NULL,184,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='아침에 주의 인자하심을');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '세상 부귀 안일함과','CCM','{}'::text[],'{}'::text[],NULL,NULL,168,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='세상 부귀 안일함과');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '아주 먼 옛날','CCM','{}'::text[],'{}'::text[],NULL,NULL,182,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='아주 먼 옛날');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '사랑은 언제나','CCM','{}'::text[],'{}'::text[],NULL,NULL,148,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='사랑은 언제나');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '아버지 주 나의 기업','CCM','{}'::text[],'{}'::text[],NULL,NULL,178,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='아버지 주 나의 기업');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '사랑하는 나의 아버지','CCM','{}'::text[],'{}'::text[],NULL,NULL,152,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='사랑하는 나의 아버지');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '살아 계신 성령님 (F)','CCM','{}'::text[],'{}'::text[],NULL,NULL,160,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='살아 계신 성령님 (F)');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '사랑의 나눔 있는 곳','CCM','{}'::text[],'{}'::text[],NULL,NULL,149,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='사랑의 나눔 있는 곳');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '세상 권세 멸하시러','CCM','{}'::text[],'{}'::text[],NULL,NULL,166,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='세상 권세 멸하시러');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '약한 나로 강하게','CCM','{}'::text[],'{}'::text[],NULL,NULL,186,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='약한 나로 강하게');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '세상 사람 날 부러워','CCM','{}'::text[],'{}'::text[],NULL,NULL,169,'Bb',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='세상 사람 날 부러워');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '십자가의 길','CCM','{}'::text[],'{}'::text[],NULL,NULL,80,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='십자가의 길');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '사람을 보며','CCM','{}'::text[],'{}'::text[],NULL,NULL,147,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='사람을 보며');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '세상에서 방황할 때','CCM','{}'::text[],'{}'::text[],NULL,NULL,170,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='세상에서 방황할 때');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '수고하고 무거운','CCM','{}'::text[],'{}'::text[],NULL,NULL,174,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='수고하고 무거운');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '아름다우신 주','CCM','{}'::text[],'{}'::text[],NULL,NULL,177,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='아름다우신 주');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '성령 하나님 나의 하나님','CCM','{}'::text[],'{}'::text[],NULL,NULL,164,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='성령 하나님 나의 하나님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '사모합니다','CCM','{}'::text[],'{}'::text[],NULL,NULL,158,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='사모합니다');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '사망의 그늘에 앉아','CCM','{}'::text[],'{}'::text[],NULL,NULL,157,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='사망의 그늘에 앉아');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '사랑합니다','CCM','{}'::text[],'{}'::text[],NULL,NULL,153,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='사랑합니다');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '알렐루야 전능하신','CCM','{}'::text[],'{}'::text[],NULL,NULL,185,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='알렐루야 전능하신');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '슬픔 걱정 가득 차고','CCM','{}'::text[],'{}'::text[],NULL,NULL,175,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='슬픔 걱정 가득 차고');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '시편 92편','CCM','{}'::text[],'{}'::text[],NULL,NULL,184,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='시편 92편');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '아버지 날 붙들어','CCM','{}'::text[],'{}'::text[],NULL,NULL,179,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='아버지 날 붙들어');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '세상 모든 민족이','CCM','{}'::text[],'{}'::text[],NULL,NULL,167,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='세상 모든 민족이');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '오 거룩한 밤','CCM','{}'::text[],'{}'::text[],NULL,NULL,218,'Bb',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='오 거룩한 밤');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수는 참포도나무','CCM','{}'::text[],'{}'::text[],NULL,NULL,202,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수는 참포도나무');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '왕 되신 주께 감사하세','CCM','{}'::text[],'{}'::text[],NULL,NULL,233,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='왕 되신 주께 감사하세');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '오 주 없이는 살 수 없네','CCM','{}'::text[],'{}'::text[],NULL,NULL,83,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='오 주 없이는 살 수 없네');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수님의 보혁','CCM','{}'::text[],'{}'::text[],NULL,NULL,206,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수님의 보혁');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수 이름 찬양','CCM','{}'::text[],'{}'::text[],NULL,NULL,215,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수 이름 찬양');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '오 신실하신 주','CCM','{}'::text[],'{}'::text[],NULL,NULL,389,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='오 신실하신 주');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수 이름으로','CCM','{}'::text[],'{}'::text[],NULL,NULL,213,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수 이름으로');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '왕이신 나의 하나님','CCM','{}'::text[],'{}'::text[],NULL,NULL,236,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='왕이신 나의 하나님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '오라 우리가 세상을','CCM','{}'::text[],'{}'::text[],NULL,NULL,264,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='오라 우리가 세상을');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '영원하신 변함없는','CCM','{}'::text[],'{}'::text[],NULL,NULL,198,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='영원하신 변함없는');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수의 이름으로','CCM','{}'::text[],'{}'::text[],NULL,NULL,212,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수의 이름으로');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수 안에 있는 나에게','CCM','{}'::text[],'{}'::text[],NULL,NULL,208,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수 안에 있는 나에게');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예배','CCM','{}'::text[],'{}'::text[],NULL,NULL,344,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예배');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '왕의 왕 주의 주','CCM','{}'::text[],'{}'::text[],NULL,NULL,234,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='왕의 왕 주의 주');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '오늘 피었다 지는','CCM','{}'::text[],'{}'::text[],NULL,NULL,221,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='오늘 피었다 지는');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '오묘하신 예수','CCM','{}'::text[],'{}'::text[],NULL,NULL,222,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='오묘하신 예수');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '영광의 주님 찬양하세','CCM','{}'::text[],'{}'::text[],NULL,NULL,196,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='영광의 주님 찬양하세');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '오 주님 나라 임하리','CCM','{}'::text[],'{}'::text[],NULL,NULL,226,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='오 주님 나라 임하리');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '영광을 돌리세','CCM','{}'::text[],'{}'::text[],NULL,NULL,195,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='영광을 돌리세');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '열어 주소서','CCM','{}'::text[],'{}'::text[],NULL,NULL,193,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='열어 주소서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수의 보혁 그 능력','CCM','{}'::text[],'{}'::text[],NULL,NULL,211,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수의 보혁 그 능력');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '오 예수 어린양 되신 주','CCM','{}'::text[],'{}'::text[],NULL,NULL,224,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='오 예수 어린양 되신 주');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '온 세상 들으라','CCM','{}'::text[],'{}'::text[],NULL,NULL,231,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='온 세상 들으라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '오늘 집을 나서기 전','CCM','{}'::text[],'{}'::text[],NULL,NULL,220,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='오늘 집을 나서기 전');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '왕의 왕','CCM','{}'::text[],'{}'::text[],NULL,NULL,253,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='왕의 왕');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '오직 주의 사랑에 매여','CCM','{}'::text[],'{}'::text[],NULL,NULL,228,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='오직 주의 사랑에 매여');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수 이름이 온 땅에','CCM','{}'::text[],'{}'::text[],NULL,NULL,214,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수 이름이 온 땅에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '왕의 지성소에 들어가','CCM','{}'::text[],'{}'::text[],NULL,NULL,235,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='왕의 지성소에 들어가');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '온유한 맘을 주옥소서','CCM','{}'::text[],'{}'::text[],NULL,NULL,232,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='온유한 맘을 주옥소서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '영광 높이 계신 주께','CCM','{}'::text[],'{}'::text[],NULL,NULL,194,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='영광 높이 계신 주께');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수 예수 거룩하신','CCM','{}'::text[],'{}'::text[],NULL,NULL,209,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수 예수 거룩하신');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수님 목마릅니다','CCM','{}'::text[],'{}'::text[],NULL,NULL,205,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수님 목마릅니다');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '오소서 진리의 성령님','CCM','{}'::text[],'{}'::text[],NULL,NULL,223,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='오소서 진리의 성령님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '온 땅이여 주를 찬양','CCM','{}'::text[],'{}'::text[],NULL,NULL,230,'Em',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='온 땅이여 주를 찬양');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수 하나님의 공의','CCM','{}'::text[],'{}'::text[],NULL,NULL,217,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수 하나님의 공의');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수 I','CCM','{}'::text[],'{}'::text[],NULL,NULL,199,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수 I');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수 가장 귀한','CCM','{}'::text[],'{}'::text[],NULL,NULL,200,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수 가장 귀한');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '오 주여 나의 마음이','CCM','{}'::text[],'{}'::text[],NULL,NULL,227,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='오 주여 나의 마음이');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '영광 주님께','CCM','{}'::text[],'{}'::text[],NULL,NULL,197,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='영광 주님께');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수 주 승리하싘','CCM','{}'::text[],'{}'::text[],NULL,NULL,216,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수 주 승리하싘');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '온 땅과 만민들아','CCM','{}'::text[],'{}'::text[],NULL,NULL,229,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='온 땅과 만민들아');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수님 날 위해','CCM','{}'::text[],'{}'::text[],NULL,NULL,204,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수님 날 위해');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '여기에 모인 우리','CCM','{}'::text[],'{}'::text[],NULL,NULL,192,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='여기에 모인 우리');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수 우리 왕이여','CCM','{}'::text[],'{}'::text[],NULL,NULL,210,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수 우리 왕이여');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수 사랑해요','CCM','{}'::text[],'{}'::text[],NULL,NULL,207,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수 사랑해요');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수 귀하신 이름','CCM','{}'::text[],'{}'::text[],NULL,NULL,201,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수 귀하신 이름');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '예수님 그의 희생','CCM','{}'::text[],'{}'::text[],NULL,NULL,203,'Eb',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='예수님 그의 희생');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '오 나의 자비로운 주','CCM','{}'::text[],'{}'::text[],NULL,NULL,219,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='오 나의 자비로운 주');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '우리는 주의 백성','CCM','{}'::text[],'{}'::text[],NULL,NULL,238,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='우리는 주의 백성');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '우리 보좌 앞에 모였네','CCM','{}'::text[],'{}'::text[],NULL,NULL,241,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='우리 보좌 앞에 모였네');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '유대 땅 언덕에','CCM','{}'::text[],'{}'::text[],NULL,NULL,253,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='유대 땅 언덕에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '우리 모일 때 주 성령','CCM','{}'::text[],'{}'::text[],NULL,NULL,240,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='우리 모일 때 주 성령');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '이 세상은 날이 갈수록','CCM','{}'::text[],'{}'::text[],NULL,NULL,264,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='이 세상은 날이 갈수록');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '이 땅의 황무함을','CCM','{}'::text[],'{}'::text[],NULL,NULL,262,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='이 땅의 황무함을');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '일어나 걸어라','CCM','{}'::text[],'{}'::text[],NULL,NULL,47,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='일어나 걸어라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '이 믿음 더욱 괽세라','CCM','{}'::text[],'{}'::text[],NULL,NULL,192,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='이 믿음 더욱 괽세라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '저 성벽을 향해','CCM','{}'::text[],'{}'::text[],NULL,NULL,274,'Dm',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='저 성벽을 향해');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '작은 불꽃 하나가','CCM','{}'::text[],'{}'::text[],NULL,NULL,271,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='작은 불꽃 하나가');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '우리에게 향하신','CCM','{}'::text[],'{}'::text[],NULL,NULL,244,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='우리에게 향하신');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '은혜로만','CCM','{}'::text[],'{}'::text[],NULL,NULL,256,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='은혜로만');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '왕이신 나의 하나님','CCM','{}'::text[],'{}'::text[],NULL,NULL,237,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='왕이신 나의 하나님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '임마누엘','CCM','{}'::text[],'{}'::text[],NULL,NULL,269,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='임마누엘');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '우리는 하나 되어','CCM','{}'::text[],'{}'::text[],NULL,NULL,380,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='우리는 하나 되어');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '일어나 새벽을 깨우리라','CCM','{}'::text[],'{}'::text[],NULL,NULL,358,'Ab',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='일어나 새벽을 깨우리라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '존귀 존귀하신 주','CCM','{}'::text[],'{}'::text[],NULL,NULL,278,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='존귀 존귀하신 주');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '우우- 주를 찬양하나이다','CCM','{}'::text[],'{}'::text[],NULL,NULL,251,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='우우- 주를 찬양하나이다');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '정결한 마음 주시옵소서','CCM','{}'::text[],'{}'::text[],NULL,NULL,276,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='정결한 마음 주시옵소서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '유월절 어린양의 피로','CCM','{}'::text[],'{}'::text[],NULL,NULL,254,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='유월절 어린양의 피로');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '우물가의 여인처럼','CCM','{}'::text[],'{}'::text[],NULL,NULL,250,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='우물가의 여인처럼');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '우리 빈손을 모아','CCM','{}'::text[],'{}'::text[],NULL,NULL,242,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='우리 빈손을 모아');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '우리에게 한 제단','CCM','{}'::text[],'{}'::text[],NULL,NULL,243,'Ab',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='우리에게 한 제단');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '우리 함께 기도해','CCM','{}'::text[],'{}'::text[],NULL,NULL,247,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='우리 함께 기도해');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '전쟁 중에도','CCM','{}'::text[],'{}'::text[],NULL,NULL,275,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='전쟁 중에도');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '이곳에 주님 계시네','CCM','{}'::text[],'{}'::text[],NULL,NULL,257,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='이곳에 주님 계시네');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '이끄소서','CCM','{}'::text[],'{}'::text[],NULL,NULL,258,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='이끄소서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '이와 같은 때엔','CCM','{}'::text[],'{}'::text[],NULL,NULL,266,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='이와 같은 때엔');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '있는 모습 그대로','CCM','{}'::text[],'{}'::text[],NULL,NULL,270,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='있는 모습 그대로');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '우리 오늘 눈물로','CCM','{}'::text[],'{}'::text[],NULL,NULL,245,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='우리 오늘 눈물로');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '저 높은 보좌에','CCM','{}'::text[],'{}'::text[],NULL,NULL,272,'Em',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='저 높은 보좌에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '이 땅에 오직 주밖에','CCM','{}'::text[],'{}'::text[],NULL,NULL,261,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='이 땅에 오직 주밖에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '이 험한 세상 나','CCM','{}'::text[],'{}'::text[],NULL,NULL,267,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='이 험한 세상 나');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '위대하고 강하신 주님','CCM','{}'::text[],'{}'::text[],NULL,NULL,252,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='위대하고 강하신 주님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '인생길 험하고','CCM','{}'::text[],'{}'::text[],NULL,NULL,268,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='인생길 험하고');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '이 산지를','CCM','{}'::text[],'{}'::text[],NULL,NULL,318,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='이 산지를');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '존귀 오 존귀하신 주','CCM','{}'::text[],'{}'::text[],NULL,NULL,277,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='존귀 오 존귀하신 주');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '은보다 더 귀하신 주님','CCM','{}'::text[],'{}'::text[],NULL,NULL,255,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='은보다 더 귀하신 주님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '우리 함께 기빨해','CCM','{}'::text[],'{}'::text[],NULL,NULL,248,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='우리 함께 기빨해');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '이 세상 사는 동안','CCM','{}'::text[],'{}'::text[],NULL,NULL,263,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='이 세상 사는 동안');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '우마 쉼지 않으리','CCM','{}'::text[],'{}'::text[],NULL,NULL,249,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='우마 쉼지 않으리');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '이 시간 모두','CCM','{}'::text[],'{}'::text[],NULL,NULL,265,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='이 시간 모두');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '왕샼 날 사랑하나','CCM','{}'::text[],'{}'::text[],NULL,NULL,204,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='왕샼 날 사랑하나');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '저 멀리 뽐이는 나의','CCM','{}'::text[],'{}'::text[],NULL,NULL,273,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='저 멀리 뽐이는 나의');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '우리 주의 성령이','CCM','{}'::text[],'{}'::text[],NULL,NULL,246,'Em',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='우리 주의 성령이');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '이날은 주가 지으신 날','CCM','{}'::text[],'{}'::text[],NULL,NULL,260,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='이날은 주가 지으신 날');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '잡아 주시네','CCM','{}'::text[],'{}'::text[],NULL,NULL,188,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='잡아 주시네');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '우리들의 무기는','CCM','{}'::text[],'{}'::text[],NULL,NULL,239,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='우리들의 무기는');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '이날은 이날은','CCM','{}'::text[],'{}'::text[],NULL,NULL,259,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='이날은 이날은');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님과 담대히','CCM','{}'::text[],'{}'::text[],NULL,NULL,300,'Dm',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님과 담대히');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님 내게 오시면','CCM','{}'::text[],'{}'::text[],NULL,NULL,168,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님 내게 오시면');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님의 뜻 따르렵니다','CCM','{}'::text[],'{}'::text[],NULL,NULL,311,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님의 뜻 따르렵니다');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '죄 없으신 주 독생자','CCM','{}'::text[],'{}'::text[],NULL,NULL,280,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='죄 없으신 주 독생자');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님의 사랑이','CCM','{}'::text[],'{}'::text[],NULL,NULL,312,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님의 사랑이');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님은 내 호흡','CCM','{}'::text[],'{}'::text[],NULL,NULL,308,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님은 내 호흡');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님의 영광 나타나셨네','CCM','{}'::text[],'{}'::text[],NULL,NULL,315,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님의 영광 나타나셨네');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 내 맘에 오신 후에','CCM','{}'::text[],'{}'::text[],NULL,NULL,292,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 내 맘에 오신 후에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님 나라 임하시네','CCM','{}'::text[],'{}'::text[],NULL,NULL,302,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님 나라 임하시네');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님은 너를 사랑해','CCM','{}'::text[],'{}'::text[],NULL,NULL,309,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님은 너를 사랑해');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주께 가까이','CCM','{}'::text[],'{}'::text[],NULL,NULL,284,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주께 가까이');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님 손 잡고 일어서세요','CCM','{}'::text[],'{}'::text[],NULL,NULL,237,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님 손 잡고 일어서세요');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주는 땅 위에서','CCM','{}'::text[],'{}'::text[],NULL,NULL,294,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주는 땅 위에서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님의 영광이','CCM','{}'::text[],'{}'::text[],NULL,NULL,316,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님의 영광이');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '죄악에 썭은','CCM','{}'::text[],'{}'::text[],NULL,NULL,282,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='죄악에 썭은');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '죄인들을 위하여','CCM','{}'::text[],'{}'::text[],NULL,NULL,283,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='죄인들을 위하여');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 나의 사랑','CCM','{}'::text[],'{}'::text[],NULL,NULL,291,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 나의 사랑');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님 같은 반석은','CCM','{}'::text[],'{}'::text[],NULL,NULL,296,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님 같은 반석은');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주께서 전진해 온다','CCM','{}'::text[],'{}'::text[],NULL,NULL,289,'Cm',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주께서 전진해 온다');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 너 맘에 들어가','CCM','{}'::text[],'{}'::text[],NULL,NULL,293,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 너 맘에 들어가');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 앞에 엠드려','CCM','{}'::text[],'{}'::text[],NULL,NULL,290,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 앞에 엠드려');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님 곰으로','CCM','{}'::text[],'{}'::text[],NULL,NULL,297,'Bb',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님 곰으로');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주께 감사해','CCM','{}'::text[],'{}'::text[],NULL,NULL,286,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주께 감사해');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님께 맡기세요','CCM','{}'::text[],'{}'::text[],NULL,NULL,105,'Eb',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님께 맡기세요');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님은 영광의 왕','CCM','{}'::text[],'{}'::text[],NULL,NULL,310,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님은 영광의 왕');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님 이곳에','CCM','{}'::text[],'{}'::text[],NULL,NULL,317,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님 이곳에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주를 높이기 원합니다','CCM','{}'::text[],'{}'::text[],NULL,NULL,321,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주를 높이기 원합니다');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님여 이 손을','CCM','{}'::text[],'{}'::text[],NULL,NULL,307,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님여 이 손을');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님 큰 영광 받으소서','CCM','{}'::text[],'{}'::text[],NULL,NULL,319,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님 큰 영광 받으소서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님의 손으로','CCM','{}'::text[],'{}'::text[],NULL,NULL,314,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님의 손으로');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님과 같이','CCM','{}'::text[],'{}'::text[],NULL,NULL,299,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님과 같이');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님 한 분만으로','CCM','{}'::text[],'{}'::text[],NULL,NULL,320,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님 한 분만으로');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주께 두 손 모아','CCM','{}'::text[],'{}'::text[],NULL,NULL,287,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주께 두 손 모아');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주께서 왕위에','CCM','{}'::text[],'{}'::text[],NULL,NULL,288,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주께서 왕위에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '종소리 울려라','CCM','{}'::text[],'{}'::text[],NULL,NULL,279,'Bb',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='종소리 울려라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주를 찬양하리','CCM','{}'::text[],'{}'::text[],NULL,NULL,322,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주를 찬양하리');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님께서 내 곳에','CCM','{}'::text[],'{}'::text[],NULL,NULL,301,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님께서 내 곳에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주기도문 송','CCM','{}'::text[],'{}'::text[],NULL,NULL,390,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주기도문 송');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주께 가오니','CCM',ARRAY['치유'],ARRAY['예배전찬양','응답찬양'],'보통','보통',285,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주께 가오니');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님 당신은 사랑의 빛','CCM','{}'::text[],'{}'::text[],NULL,NULL,304,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님 당신은 사랑의 빛');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님 보좌 앞에 나아가','CCM','{}'::text[],'{}'::text[],NULL,NULL,306,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님 보좌 앞에 나아가');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '죄악 된 세상을','CCM','{}'::text[],'{}'::text[],NULL,NULL,281,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='죄악 된 세상을');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님의 영광','CCM','{}'::text[],'{}'::text[],NULL,NULL,195,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님의 영광');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님 계신 곳에 나가리','CCM','{}'::text[],'{}'::text[],NULL,NULL,298,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님 계신 곳에 나가리');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님의 성령','CCM','{}'::text[],'{}'::text[],NULL,NULL,313,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님의 성령');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님 내가 여기 있사오니','CCM','{}'::text[],'{}'::text[],NULL,NULL,303,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님 내가 여기 있사오니');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님이 주신 땅으로','CCM','{}'::text[],'{}'::text[],NULL,NULL,318,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님이 주신 땅으로');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주는 평화','CCM','{}'::text[],'{}'::text[],NULL,NULL,295,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주는 평화');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주님만 주님만','CCM','{}'::text[],'{}'::text[],NULL,NULL,305,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주님만 주님만');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 여호와는 광대하시도다','CCM','{}'::text[],'{}'::text[],NULL,NULL,333,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 여호와는 광대하시도다');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 예수 기빡 찬양해','CCM','{}'::text[],'{}'::text[],NULL,NULL,335,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 예수 기빡 찬양해');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 이름에 복 있도다','CCM','{}'::text[],'{}'::text[],NULL,NULL,352,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 이름에 복 있도다');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '지금 우리는 마음을','CCM','{}'::text[],'{}'::text[],NULL,NULL,358,'Ab',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='지금 우리는 마음을');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 앞에 엠드려','CCM','{}'::text[],'{}'::text[],NULL,NULL,331,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 앞에 엠드려');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 우리 아버지','CCM','{}'::text[],'{}'::text[],NULL,NULL,338,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 우리 아버지');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '지금은 엘리야 때처럼','CCM','{}'::text[],'{}'::text[],NULL,NULL,359,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='지금은 엘리야 때처럼');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 안에 우마 하나','CCM','{}'::text[],'{}'::text[],NULL,NULL,329,'Bb',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 안에 우마 하나');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주의 거룩하싘 임할 때','CCM','{}'::text[],'{}'::text[],NULL,NULL,341,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주의 거룩하싘 임할 때');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 예수의 이름 높이세','CCM','{}'::text[],'{}'::text[],NULL,NULL,337,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 예수의 이름 높이세');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 말쓰 내 발의 등이요','CCM','{}'::text[],'{}'::text[],NULL,NULL,326,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 말쓰 내 발의 등이요');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 여호와 능력의 주','CCM','{}'::text[],'{}'::text[],NULL,NULL,334,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 여호와 능력의 주');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주의 자비가 내려와','CCM','{}'::text[],'{}'::text[],NULL,NULL,351,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주의 자비가 내려와');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주의 이름 높이며 I','CCM','{}'::text[],'{}'::text[],NULL,NULL,345,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주의 이름 높이며 I');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 보혁로 날 사싘은','CCM','{}'::text[],'{}'::text[],NULL,NULL,328,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 보혁로 날 사싘은');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주의 인자는 끝이','CCM','{}'::text[],'{}'::text[],NULL,NULL,349,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주의 인자는 끝이');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주를 향한 나의 사랑','CCM','{}'::text[],'{}'::text[],NULL,NULL,325,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주를 향한 나의 사랑');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 이름 큰 능력','CCM','{}'::text[],'{}'::text[],NULL,NULL,353,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 이름 큰 능력');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주의 이름 높이며 II','CCM','{}'::text[],'{}'::text[],NULL,NULL,346,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주의 이름 높이며 II');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주의 강가로','CCM','{}'::text[],'{}'::text[],NULL,NULL,339,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주의 강가로');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 하나님 독생자','CCM','{}'::text[],'{}'::text[],NULL,NULL,356,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 하나님 독생자');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주의 이름 송축하리','CCM','{}'::text[],'{}'::text[],NULL,NULL,347,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주의 이름 송축하리');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주여 진실하게 하소서','CCM','{}'::text[],'{}'::text[],NULL,NULL,332,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주여 진실하게 하소서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 말쓰 향하여','CCM','{}'::text[],'{}'::text[],NULL,NULL,392,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 말쓰 향하여');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 예수 나의 당신이여','CCM','{}'::text[],'{}'::text[],NULL,NULL,146,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 예수 나의 당신이여');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주의 십자가 지고','CCM','{}'::text[],'{}'::text[],NULL,NULL,344,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주의 십자가 지고');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '지존하신 하나님','CCM','{}'::text[],'{}'::text[],NULL,NULL,361,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='지존하신 하나님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주의 임재 앞에','CCM','{}'::text[],'{}'::text[],NULL,NULL,350,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주의 임재 앞에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 보좌로부터','CCM','{}'::text[],'{}'::text[],NULL,NULL,327,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 보좌로부터');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주를 찬양하며','CCM','{}'::text[],'{}'::text[],NULL,NULL,324,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주를 찬양하며');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '지금깋 내가 한 일이','CCM','{}'::text[],'{}'::text[],NULL,NULL,357,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='지금깋 내가 한 일이');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 찬양해','CCM','{}'::text[],'{}'::text[],NULL,NULL,355,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 찬양해');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주의 이름 안에서','CCM','{}'::text[],'{}'::text[],NULL,NULL,348,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주의 이름 안에서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주의 만찬 앞에 나와','CCM','{}'::text[],'{}'::text[],NULL,NULL,342,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주의 만찬 앞에 나와');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주여 이 죄인이','CCM','{}'::text[],'{}'::text[],NULL,NULL,170,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주여 이 죄인이');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '지치고 상한','CCM','{}'::text[],'{}'::text[],NULL,NULL,362,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='지치고 상한');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 찬양합니다','CCM','{}'::text[],'{}'::text[],NULL,NULL,354,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 찬양합니다');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주의 사랑을','CCM','{}'::text[],'{}'::text[],NULL,NULL,343,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주의 사랑을');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 예수 오소서','CCM','{}'::text[],'{}'::text[],NULL,NULL,336,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 예수 오소서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주의 거룩하싘 생각할 때','CCM','{}'::text[],'{}'::text[],NULL,NULL,340,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주의 거룩하싘 생각할 때');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 앞에 다 엠드려','CCM','{}'::text[],'{}'::text[],NULL,NULL,330,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 앞에 다 엠드려');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주를 경배해','CCM','{}'::text[],'{}'::text[],NULL,NULL,323,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주를 경배해');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '지존하신 주님','CCM','{}'::text[],'{}'::text[],NULL,NULL,360,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='지존하신 주님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주의 위엄 이곳에','CCM','{}'::text[],'{}'::text[],NULL,NULL,298,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주의 위엄 이곳에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주만 바라볼지라','CCM','{}'::text[],'{}'::text[],NULL,NULL,386,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주만 바라볼지라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '형제가 연합해','CCM','{}'::text[],'{}'::text[],NULL,NULL,401,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='형제가 연합해');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '하나님은 영이시니','CCM','{}'::text[],'{}'::text[],NULL,NULL,384,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='하나님은 영이시니');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '형제의 모습 속에','CCM','{}'::text[],'{}'::text[],NULL,NULL,402,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='형제의 모습 속에');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '평안을 너에게','CCM','{}'::text[],'{}'::text[],NULL,NULL,377,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='평안을 너에게');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '하나님은 우리의 피난처','CCM','{}'::text[],'{}'::text[],NULL,NULL,385,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='하나님은 우리의 피난처');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '하늘 위에 주님','CCM','{}'::text[],'{}'::text[],NULL,NULL,391,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='하늘 위에 주님');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '찬양해 주를 찬양해','CCM','{}'::text[],'{}'::text[],NULL,NULL,371,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='찬양해 주를 찬양해');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '찬양해 주님의 종들아','CCM','{}'::text[],'{}'::text[],NULL,NULL,370,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='찬양해 주님의 종들아');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '축복송','CCM','{}'::text[],'{}'::text[],NULL,NULL,117,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='축복송');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '창조의 아버지','CCM','{}'::text[],'{}'::text[],NULL,NULL,372,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='창조의 아버지');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '찬양하세','CCM','{}'::text[],'{}'::text[],NULL,NULL,369,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='찬양하세');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '평화의 도구로','CCM','{}'::text[],'{}'::text[],NULL,NULL,378,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='평화의 도구로');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '하늘의 나는 새도','CCM','{}'::text[],'{}'::text[],NULL,NULL,392,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='하늘의 나는 새도');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '하나님 나 여기','CCM','{}'::text[],'{}'::text[],NULL,NULL,381,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='하나님 나 여기');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '할렜루야 주가 다스리네','CCM','{}'::text[],'{}'::text[],NULL,NULL,394,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='할렜루야 주가 다스리네');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '축복하소서','CCM','{}'::text[],'{}'::text[],NULL,NULL,374,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='축복하소서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '하나님의 선하싘과','CCM','{}'::text[],'{}'::text[],NULL,NULL,355,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='하나님의 선하싘과');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '찬양하라 내 영혼아','CCM','{}'::text[],'{}'::text[],NULL,NULL,367,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='찬양하라 내 영혼아');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '찬양하라 주님을','CCM','{}'::text[],'{}'::text[],NULL,NULL,368,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='찬양하라 주님을');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '하나님 어린양','CCM','{}'::text[],'{}'::text[],NULL,NULL,382,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='하나님 어린양');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '한 아기가 우리에게','CCM','{}'::text[],'{}'::text[],NULL,NULL,393,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='한 아기가 우리에게');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '찬양 찬양','CCM','{}'::text[],'{}'::text[],NULL,NULL,366,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='찬양 찬양');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '흘으로 사람을','CCM','{}'::text[],'{}'::text[],NULL,NULL,404,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='흘으로 사람을');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '하나님은 너를 지키시는','CCM','{}'::text[],'{}'::text[],NULL,NULL,383,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='하나님은 너를 지키시는');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '하나님의 음성을','CCM','{}'::text[],'{}'::text[],NULL,NULL,387,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='하나님의 음성을');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '하나님께로 더 가까이','CCM','{}'::text[],'{}'::text[],NULL,NULL,379,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='하나님께로 더 가까이');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '하나님 한 번도 나를','CCM','{}'::text[],'{}'::text[],NULL,NULL,389,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='하나님 한 번도 나를');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '축복합니다','CCM','{}'::text[],'{}'::text[],NULL,NULL,375,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='축복합니다');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '할렜루야 전능의 주','CCM','{}'::text[],'{}'::text[],NULL,NULL,395,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='할렜루야 전능의 주');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '항상 진실케','CCM','{}'::text[],'{}'::text[],NULL,NULL,397,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='항상 진실케');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '찬양의 제사 드리네','CCM','{}'::text[],'{}'::text[],NULL,NULL,348,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='찬양의 제사 드리네');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '찬양하라','CCM','{}'::text[],'{}'::text[],NULL,NULL,364,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='찬양하라');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '하늘에 계신 아버지','CCM','{}'::text[],'{}'::text[],NULL,NULL,390,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='하늘에 계신 아버지');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '하나님이 선택하셨고','CCM','{}'::text[],'{}'::text[],NULL,NULL,388,'E',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='하나님이 선택하셨고');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '호산나','CCM','{}'::text[],'{}'::text[],NULL,NULL,403,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='호산나');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '평강의 왕이요','CCM','{}'::text[],'{}'::text[],NULL,NULL,376,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='평강의 왕이요');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '해 아래 새것이','CCM','{}'::text[],'{}'::text[],NULL,NULL,398,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='해 아래 새것이');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '찬양을 드리며','CCM','{}'::text[],'{}'::text[],NULL,NULL,365,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='찬양을 드리며');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '짐이 무거우났','CCM','{}'::text[],'{}'::text[],NULL,NULL,363,'F',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='짐이 무거우났');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '험한 십자가 능력','CCM','{}'::text[],'{}'::text[],NULL,NULL,400,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='험한 십자가 능력');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '하나님의 사랑을','CCM','{}'::text[],'{}'::text[],NULL,NULL,386,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='하나님의 사랑을');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '하나님께서는','CCM','{}'::text[],'{}'::text[],NULL,NULL,380,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='하나님께서는');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '천사의 말을','CCM','{}'::text[],'{}'::text[],NULL,NULL,373,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='천사의 말을');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '해같이 빛나리','CCM','{}'::text[],'{}'::text[],NULL,NULL,115,'A',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='해같이 빛나리');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '험한 세상 나그네 길','CCM','{}'::text[],'{}'::text[],NULL,NULL,399,'D',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='험한 세상 나그네 길');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '할 수 있다 하신 이는','CCM','{}'::text[],'{}'::text[],NULL,NULL,396,'C',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='할 수 있다 하신 이는');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '은혜(손경민)',NULL,'{}'::text[],'{}'::text[],NULL,NULL,NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='은혜(손경민)');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나의 갈 길 다가로독',NULL,'{}'::text[],'{}'::text[],NULL,NULL,NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나의 갈 길 다가로독');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '384장 나의 갈 길 다가로독','찬송가',ARRAY['인도'],'{}'::text[],'보통',NULL,NULL,'G',NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='384장 나의 갈 길 다가로독');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '주 사랑이 나를 숨쉬게해',NULL,'{}'::text[],'{}'::text[],NULL,NULL,NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='주 사랑이 나를 숨쉬게해');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '낮엔 해처럼 밤엔 달처럼',NULL,'{}'::text[],'{}'::text[],NULL,NULL,NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='낮엔 해처럼 밤엔 달처럼');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '그 사랑',NULL,'{}'::text[],'{}'::text[],'보통',NULL,NULL,NULL,'https://youtu.be/_NAzXDrSJGI?si=Bs0oFeC5SvEywm2P',NULL,NULL where not exists (select 1 from public.worship_songs where title='그 사랑');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '은혜 아니면',NULL,'{}'::text[],'{}'::text[],NULL,NULL,NULL,NULL,'https://youtu.be/qFPnSuxzngo?si=6yx8RIw4n-tNBIDd',NULL,NULL where not exists (select 1 from public.worship_songs where title='은혜 아니면');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '나는 구원 열차 올라타고서',NULL,'{}'::text[],'{}'::text[],NULL,NULL,NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='나는 구원 열차 올라타고서');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '왜 나만 겪는 고난이냐고',NULL,'{}'::text[],'{}'::text[],NULL,NULL,NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='왜 나만 겪는 고난이냐고');
insert into public.worship_songs (title,type,theme_tags,use_tags,difficulty,familiarity,hymn_no,transpose,youtube_url,lyrics_url,note)
select '내 안에 주여 소망 되소서',NULL,'{}'::text[],'{}'::text[],NULL,NULL,NULL,NULL,NULL,NULL,NULL where not exists (select 1 from public.worship_songs where title='내 안에 주여 소망 되소서');
