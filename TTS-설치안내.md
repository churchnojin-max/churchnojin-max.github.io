# 🔊 글 읽어주기(AI 음성) 설치 안내

홈 QT 등의 **🔊 들어주기** 버튼을, 기계음 대신 **구글 Gemini 신경망 음성(자연스러운 한국어)** 으로 바꿉니다.
주보 AI에 쓰는 **같은 Gemini 키를 그대로 재사용**하므로 새 가입/새 키가 필요 없습니다.

> 배포 전에도 버튼은 **기본(브라우저) 음성**으로 동작합니다. 아래 배포를 마치면 자동으로 AI 음성으로 올라갑니다.

## 배포 (1회)
**① 음성 캐시 버킷 만들기** — Supabase ▸ SQL Editor 에서 `supabase/tts_cache_bucket.sql` 실행
(한 번 만든 음성을 저장해 재사용 → 이후 재생 사실상 무료. 안 해도 재생은 되지만 매번 새로 생성됨.)

**② 함수 배포** — Supabase CLI가 있으면 (상담 AI 배포하셨던 것과 동일):

```bash
supabase functions deploy tts --project-ref YOUR-PROJECT
```

- `GEMINI_API_KEY`는 이미 주보 AI에 설정돼 있으면 그대로 쓰입니다.
  혹시 없으면 한 번만:
  ```bash
  supabase secrets set GEMINI_API_KEY=AIza...   --project-ref YOUR-PROJECT
  ```
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 는 Edge Function에 자동 주입되어 별도 설정이 필요 없습니다.

CLI 없이 대시보드로 하려면: Supabase → **Edge Functions → Deploy new function** →
이름 `tts`, 코드는 `supabase/functions/tts/index.ts` 내용을 붙여넣고 Deploy.

## 확인
홈 → 오늘의 말씀 → 묵상 전문 → **🔊 들어주기**. "⏳ 준비 중…" 잠깐 뒤 AI 음성으로 낭독되면 성공입니다.

## 참고
- **목소리 변경**: `index.ts`의 `DEFAULT_VOICE`를 바꾸면 됩니다. (여성: Kore·Leda·Aoede, 남성: Charon·Puck 등 30종)
- **비용**: 각 글은 **처음 한 번만** 생성되고 `tts-cache` 버킷에 저장됩니다. 그 뒤로는 **모든 성도·모든 재생이 저장본**을 쓰므로 추가 비용이 없습니다(사실상 무료 재생).
  (원하시면: QT 발행 시 미리 생성해 두어 첫 청취자도 대기 없이 듣게 하는 것도 붙일 수 있습니다.)
- 배포/키에 문제가 있으면 버튼은 자동으로 기본 음성으로 대체되어 **끊기지 않습니다.**
