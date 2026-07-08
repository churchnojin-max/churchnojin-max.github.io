# 🔊 무료 로컬 TTS (SuperTonic) — QT 음성 만들어 올리기

기계음 대신 **무료·무제한 로컬 AI 음성**으로 QT를 낭독합니다. 비용 0원.
방식: **① SuperTonic으로 음성(WAV) 생성 → ② 업로드 스크립트로 저장소에 올림 → ③ 홈페이지가 자동 재생**
(홈페이지는 `tts-cache/qt-<날짜>.wav`가 있으면 그 음성을 먼저 재생하고, 없으면 기본 음성으로 자동 대체합니다.)

---

## 준비 (처음 1회)
1. **버킷 생성**: Supabase → SQL Editor에서 `supabase/tts_cache_bucket.sql` 실행 (음성 저장 공간)
2. **service_role 키 복사**: Supabase → Project Settings → API → **service_role**(비밀키)
3. **Python 설치**: [python.org](https://www.python.org/downloads/) 에서 3.11 (SuperTonic도 Python 3.11 사용)

## SuperTonic 설치·사용 (음성 만들기)
- 배포 페이지에서 ZIP 받아 압축 풀고, 루트의 **`실행.bat`** 더블클릭 → 브라우저에 `127.0.0.1:3093` 자동 열림
- 웹 화면에서 **대본(QT 원고) 붙여넣기 → 화자(예: F1/M1) 선택 → 생성** → **WAV** 파일이 나옵니다
- **파일 이름에 그 QT 날짜를 넣어 저장**하세요. 예: `qt-2026-07-06.wav` (또는 `2026-07-06 시편110.wav` 처럼 날짜만 들어가면 됩니다)
- 한 폴더(예: `C:\qt음성`)에 모아 두세요

## 저장소에 올리기 (업로드)
명령 프롬프트(cmd)에서 (한 번만 키 설정 후, 이후엔 마지막 줄만):
```bat
set SUPABASE_SERVICE_ROLE_KEY=여기에_service_role_키
python "C:\...\woonpyung-church\tools\tts_local.py" --from-folder "C:\qt음성"
```
- 폴더 안의 WAV들을 날짜별로 `tts-cache/qt-<날짜>.wav` 로 올립니다. 이미 있으면 건너뜁니다(`--force`로 덮어쓰기).
- 끝나면 홈페이지 새로고침 → 그 날짜 QT의 **🔊 오늘의 말씀 듣기**가 이 음성으로 재생됩니다.

## 확인
홈/대시보드 → 🔊 오늘의 말씀 듣기 → SuperTonic 음성이 나오면 성공.
(아직 안 올린 날짜는 자동으로 기본 음성으로 읽습니다 — 끊기지 않음)

---

## 참고
- **홈페이지 코드는 손댈 필요 없습니다.** 파일만 올리면 됩니다.
- **mp3로 올려도 됩니다** — 파일명 `qt-<날짜>.mp3`. 홈페이지는 mp3 → wav 순으로 찾습니다.
- (선택·고급) MeloTTS를 설치했다면 스크립트가 **직접 생성**도 합니다: `python tools/tts_local.py --generate --days 7`
- **저작권**: SuperTonic 모델은 동의 없는 음성 복제를 금합니다. 기본 제공 화자(M1~M5·F1~F5)만 쓰세요.
