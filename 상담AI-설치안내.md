# 상담 AI(○○교회 말씀지기) 설치 안내

홈페이지 코드(채팅 위젯 + 백엔드 함수)는 모두 준비되어 배포되었습니다.
**실제로 작동시키려면 아래 3가지를 한 번만 설정**하시면 됩니다. (보안상 AI 열쇠는 코드에 넣지 않습니다.)

현재 상태: 설정 전에는 채팅창에서 "AI 키가 설정되지 않았습니다" 안내가 뜨고, 사이트는 정상 동작합니다. 위젯은 **로그인한 회원에게만** 우측 하단에 보입니다.

---

## 1단계 — AI API 키 발급 (둘 중 하나만 선택)

함수는 **구글 Gemini**와 **앤트로픽 Claude** 둘 다 지원합니다. 넣은 키에 따라 자동으로 선택됩니다.

**(가) 구글 Gemini — 무료 한도 넉넉, 권장**
1. https://aistudio.google.com/apikey 접속
2. **API 키 만들기** → 생성된 키 복사 (`AIza...` 또는 `AQ....`)
3. 비용: 무료 한도가 큼. ⚠️ 단 **무료 등급은 구글이 데이터를 서비스 개선에 사용**할 수 있으니, 운영 본격화 시 유료 등급(데이터 미사용) 권장.

**(나) 앤트로픽 Claude**
1. https://console.anthropic.com → Billing 결제수단 등록 + 소액 충전
2. **API Keys → Create Key** → `sk-ant-...` 복사

> ⚠️ 키는 절대 화면 캡처·채팅에 통째로 올리지 마세요. 노출되면 즉시 삭제 후 재발급하세요.
> 콘솔에서 **사용 한도(usage limit)** 를 걸어두면 과금/남용 폭주를 막을 수 있습니다.

## 2단계 — Supabase에 함수 배포 (웹 대시보드, CLI 불필요) ★권장

1. https://supabase.com 로그인 → 프로젝트 **YOUR-PROJECT** 선택
2. 왼쪽 메뉴 **Edge Functions** → **Deploy a new function** → **Via Editor**(에디터로 작성) 선택
3. 함수 이름(Name)에 정확히 **`counsel`** 입력 (※ 반드시 소문자 counsel)
4. 에디터의 기본 코드를 모두 지우고, 아래 파일 내용을 **전체 복사해 붙여넣기**:
   `https://github.com/kds08200820-del/woonpyung-church/blob/main/supabase/functions/counsel/index.ts`
   (위 링크에서 우측 **Copy raw file** 아이콘으로 전체 복사)
5. **Verify JWT** 옵션을 **끄기(OFF)** — 함수가 자체적으로 회원 로그인을 검증하기 때문입니다.
6. **Deploy** 클릭

### 2-2. AI 키(비밀값) 등록
1. **Edge Functions → (좌측) Secrets** (또는 Project Settings → Edge Functions → Secrets)
2. **Add new secret** → 1단계에서 고른 것에 맞춰 **하나만** 등록:
   - 구글 Gemini: Name `GEMINI_API_KEY` / Value `AIza...`(또는 `AQ....`)
   - 또는 Claude: Name `ANTHROPIC_API_KEY` / Value `sk-ant-...`
3. 저장. (※ `SUPABASE_URL`, `SUPABASE_ANON_KEY`는 자동 제공되어 따로 넣지 않아도 됩니다.)
4. (선택) 모델 지정 Secret: Name `COUNSEL_MODEL` /
   Value `gemini-2.5-flash`(구글, 기본) 또는 `gemini-2.5-pro`(더 똑똑) / Claude면 `claude-haiku-4-5-20251001` 등

> CLI에 익숙하시면 대신 이렇게도 됩니다:
> ```bash
> supabase login && supabase link --project-ref YOUR-PROJECT
> supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
> supabase functions deploy counsel --no-verify-jwt
> ```

## 3단계 — 확인
1. 홈페이지에서 **로그인**
2. **오늘의 말씀(QT)** 아래 **‘말씀, 더 궁금한 점이 있나요?’** 칸에 질문 입력 (또는 추천 질문 클릭)
3. 답변이 오면 성공 🎉  (안 되면 화면을 캡처해 알려주세요)

---

## 안전장치(이미 포함됨)
- 화면·답변에 "**AI이며 목사님 본인이 아님**" 명시
- **위기 신호**(자살·자해·학대 등) 감지 시 → AI 답변 대신 **상담전화 109 / 1577-0199 / 112·119 / 목사님 직통 010-0000-0000** 즉시 안내
- 의료·법률·재정 전문 조언 회피, 중대·민감 사안은 **목사님 직접 상담** 권유
- **로그인한 회원만** 사용(남용·비용 통제), 메시지 길이/개수 제한

## 바꾸고 싶을 때
- **말투·신학·답변 성향**: `supabase/functions/counsel/index.ts` 의 `SYSTEM_PROMPT` 수정 후 재배포
- **더 저렴한 모델**: 같은 파일 상단 `MODEL` 기본값을 `claude-haiku-4-5-20251001` 로 (또는 배포 시 `supabase secrets set COUNSEL_MODEL=...`)
- **자료 학습 강화(RAG)**: 설교문·칼럼 전체를 검색해 인용하도록 확장 가능 — 원하시면 다음 단계로 작업합니다.
