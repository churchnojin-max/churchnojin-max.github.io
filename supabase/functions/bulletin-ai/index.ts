// ============================================================
//  ○○교회 — 주보 검수 AI Edge Function (관리자 전용)
//  주보 초안을 받아 ①1면 헤드라인 제안 ②실수·누락 점검 ③철자·맞춤법
//  ④특수 상황(절기/특별헌금 등) 조언 을 한 번에 점검.
//  배포: supabase functions deploy bulletin-ai --no-verify-jwt
//  비밀키(counsel과 동일한 것 재사용 — 추가 설정 불필요):
//    - 구글:   GEMINI_API_KEY=AIza...
//    - 앤트로픽: ANTHROPIC_API_KEY=sk-ant-...
//    - (선택) 모델: COUNSEL_MODEL
// ============================================================

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const PROVIDER = GEMINI_API_KEY ? "gemini" : "anthropic";
const MODEL = Deno.env.get("COUNSEL_MODEL") ??
  (PROVIDER === "gemini" ? "gemini-3.5-flash-lite" : "claude-haiku-4-5-20251001");

const ALLOW_ORIGINS = [
  "https://churchnojin-max.github.io",
  "https://www.churchnojin-max.github.io",
  "http://localhost:8099",
  "http://127.0.0.1:8099",
];
function corsHeaders(origin: string) {
  const allow = ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const SYSTEM_PROMPT = `당신은 ○○교회의 '주보 편집 도우미'입니다.
담임 담임목사님이 만든 한 주 주보 초안(아래 텍스트)을 받아, 출판 전에 다음 네 가지를 점검·제안합니다.
반드시 한국어로, 아래 4개 제목을 그대로 사용해 항목별로 간결하게 정리하세요.

## ✨ 1면 헤드라인 제안
- 그 주 설교 제목·본문 분위기에 어울리는 표지 헤드라인(짧은 문구) 2~3개를 제안합니다.
- 너무 길지 않고 은혜로우며 교회 표지에 어울리게.

## ⚠️ 실수·누락·불일치
- 빈 항목(설교 제목/본문/설교자 누락 등), 날짜 불일치(주일·수요일·호수·주차가 서로 안 맞음), 예배 순서에 빠진 것, 본문 표기 오류 등을 짚습니다.
- 문제가 없으면 "이상 없음".

## 🔤 철자·맞춤법
- 오타·띄어쓰기·맞춤법이 틀린 곳을 '틀린 표현 → 고친 표현' 형식으로 알려줍니다(성경 인명·지명 표기 포함).
- 문제가 없으면 "이상 없음".

## 💡 특수 상황 조언
- 절기/특별 상황(맥추감사·추수감사·성탄·신년·송구영신·총회세례의무금 등 특별헌금, 성찬·학습세례·임직 등)이 보이면 주보에 반영하면 좋을 점을 알려줍니다.
- 해당 없으면 "특이사항 없음".

[규칙]
- 사실을 지어내지 마세요. 성경 본문·이름·날짜는 주어진 데이터만 사용합니다. 불확실하면 "확인 필요"라고만 표시합니다.
- 헌금 금액·명단은 점검 목적의 내부 자료입니다. 외부 공개를 권하거나 금액을 강조하지 마세요.
- 마지막에 "총평:" 한 줄로 마무리합니다.`;

const HEADLINE_PROMPT = `당신은 ○○교회 주보 1면(표지)의 '말씀 헤드라인'을 만드는 도우미입니다.
입력으로 그 주 주일 설교의 제목·본문(성경 장절)·성경 본문 원문·요약이 주어집니다.

[해야 할 일]
- 표지에 크게 넣을 '대표 말씀'을 정합니다. 가능하면 제공된 '성경 본문 원문' 중에서 그 설교의 핵심을 가장 잘 드러내는 한두 구절을 그대로 발췌하고, 끝에 출처(예: 나훔 2:13)를 붙입니다.
- 그 아래 한 줄로, 본문을 함축하는 짧고 은혜로운 헤드라인 문구(설교 제목 같은 여운)를 제안합니다.

[엄격한 규칙]
- 성경 구절은 절대 지어내지 마세요. 제공된 '성경 본문 원문'에 있는 문장만 사용합니다. 원문이 없으면 구절 없이 헤드라인 한 줄만 만들고 "(성경 본문을 설교에 입력하면 원문 구절도 자동으로 넣어드립니다)"라고 덧붙입니다.
- 출력은 군더더기 설명 없이 아래 형식만:

말씀: <성경 구절 원문> (<출처>)
헤드라인: <짧은 문구>`;

const PRAYER_PROMPT = `당신은 ○○교회 설교 매니저의 '마침 기도문 도우미'입니다.
입력으로 설교 제목·본문(성경 장절)·설교 원고가 주어집니다.
그 설교의 핵심 메시지를 담아, 예배를 마치며 회중과 함께 드릴 '마침 기도문'을 한국어로 작성하세요.

[규칙]
- 반드시 공백 포함 300자 미만의 한 단락 기도문으로 작성합니다. (분량을 꼭 지키세요)
- 하나님을 부르는 호칭으로 시작하고, '예수님의 이름으로 기도합니다. 아멘.'으로 끝맺습니다.
- 설교의 핵심을 1~2가지로 압축해 결단·적용·간구를 담되, 설교에 없는 사실(이름·사건·숫자)은 지어내지 않습니다.
- 경어체(하옵소서/주옵소서 등)의 자연스러운 기도 문체로 씁니다.
- 군더더기 설명·제목·머리말 없이 기도문 본문만 출력합니다.`;

const EXTRACT_PROMPT = `당신은 ○○교회 주보 PDF에서 핵심 정보를 뽑아내는 도우미입니다.
아래는 이미 만들어진 주보 PDF에서 추출한 원문 텍스트입니다(줄바꿈·정렬이 깨져 있을 수 있습니다).
여기서 아래 항목을 찾아 반드시 JSON 하나만 출력하세요. 설명·인사말·코드블록 표시(\`\`\`) 없이 순수 JSON 객체 하나만 출력합니다.

{
  "bdate": "그 주보의 주일(예배) 날짜, YYYY-MM-DD 형식(예: 2026-08-02). 못 찾으면 빈 문자열",
  "title": "주일 낮 예배 설교 제목. 못 찾으면 빈 문자열",
  "scripture": "설교 본문(성경 장절). 예: 나훔 2:8-13. 못 찾으면 빈 문자열",
  "preacher": "설교자 이름(직함 포함, 예: 손병민 담임목사). 못 찾으면 빈 문자열",
  "headline": "1면 표지에 어울리는 대표 말씀 구절이 텍스트 안에 그대로 있으면 옮겨 적기. 없으면 빈 문자열",
  "summary": "설교 요약이나 목회 칼럼처럼 보이는 문단이 있으면 그 내용을 3~5문장으로 정리. 없으면 빈 문자열"
}

[규칙]
- 텍스트에 없는 내용은 절대 지어내지 마세요. 확실하지 않으면 해당 값은 빈 문자열("")로 둡니다.
- 날짜는 반드시 YYYY-MM-DD 형식으로만 출력합니다(다른 형식이면 변환하세요).
- JSON 문법을 반드시 지키세요(큰따옴표, 쉼표 등). 그 외 텍스트는 절대 출력하지 않습니다.`;

/** 구글이 모델 이름을 바꿔도 스스로 살아 있는 모델을 찾아 쓴다 */
async function discoverGeminiModel(): Promise<string> {
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
      headers: { "x-goog-api-key": GEMINI_API_KEY },
    });
    if (!r.ok) return "";
    const d = await r.json();
    const usable = (d?.models ?? [])
      .filter((m: any) => (m?.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m: any) => String(m?.name ?? "").replace(/^models\//, ""))
      .filter((n: string) => n.startsWith("gemini-") && !/embedding|aqa|vision|image|tts|live/i.test(n));
    // 가볍고 빠른 flash 계열을 먼저 쓴다
    const flash = usable.filter((n: string) => n.includes("flash"));
    return (flash[0] ?? usable[0] ?? "");
  } catch (_) {
    return "";
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") ?? "";
  const cors = corsHeaders(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST만 허용됩니다." }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  }
  try {
    // 1) 로그인 검증
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY } });
    if (!userRes.ok) return new Response(JSON.stringify({ error: "로그인이 만료되었습니다. 다시 로그인해 주세요." }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    const user = await userRes.json().catch(() => ({}));
    const uid = user?.id ?? "";

    // 2) 관리자 검증(admins 테이블)
    const adminRes = await fetch(`${SUPABASE_URL}/rest/v1/admins?uid=eq.${uid}&select=uid`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
    const admins = adminRes.ok ? await adminRes.json().catch(() => []) : [];
    if (!Array.isArray(admins) || admins.length === 0) {
      return new Response(JSON.stringify({ error: "주보 검수는 관리자만 이용할 수 있습니다." }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 3) 입력(주보 직렬화 텍스트) + 모드
    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "headline" ? "headline" : (body.mode === "prayer" ? "prayer" : (body.mode === "extract" ? "extract" : "review"));
    const content = (typeof body.content === "string" ? body.content : "").slice(0, 16000);
    if (!content.trim()) return new Response(JSON.stringify({ error: "내용이 비어 있습니다." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    if (!GEMINI_API_KEY && !ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "AI 키가 설정되지 않았습니다.", detail: "no_api_key" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const sysPrompt = mode === "headline" ? HEADLINE_PROMPT : (mode === "prayer" ? PRAYER_PROMPT : (mode === "extract" ? EXTRACT_PROMPT : SYSTEM_PROMPT));
    const userMsg = mode === "headline"
      ? ("아래는 이번 주 주일 설교 자료입니다. 1면 표지 말씀 헤드라인을 만들어 주세요.\n\n" + content)
      : mode === "prayer"
      ? ("아래 설교 자료를 바탕으로 공백 포함 300자 미만의 마침 기도문을 작성해 주세요.\n\n" + content)
      : mode === "extract"
      ? ("아래는 주보 PDF에서 추출한 텍스트입니다. 위 JSON 형식으로 정보를 뽑아 주세요.\n\n" + content)
      : ("다음은 이번 주 주보 초안입니다. 위 4가지를 점검해 주세요.\n\n" + content);
    const maxTok = mode === "headline" ? 300 : (mode === "prayer" ? 512 : (mode === "extract" ? 800 : 2048));
    let reply = "";

    if (PROVIDER === "gemini") {
      const reqBody = JSON.stringify({
        system_instruction: { parts: [{ text: sysPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMsg }] }],
        generationConfig: { maxOutputTokens: maxTok, temperature: 0.5 },
      });
      const models = [...new Set([MODEL, "gemini-3.5-flash-lite", "gemini-3.5-flash"])];
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      let lastErr = "";
      outer:
      for (const mdl of models) {
        for (let attempt = 0; attempt < 2; attempt++) {
          const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent`, {
            method: "POST", headers: { "x-goog-api-key": GEMINI_API_KEY, "content-type": "application/json" }, body: reqBody,
          });
          if (aiRes.ok) {
            const data = await aiRes.json();
            reply = (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text || "").join("").trim();
            break outer;
          }
          lastErr = `${aiRes.status} ${(await aiRes.text()).slice(0, 200)}`;
          if (aiRes.status === 503 || aiRes.status === 429) { await sleep(800); continue; }
          break;
        }
      }
      if (!reply) {                       // 이름이 모두 막혔다 — 쓸 수 있는 모델을 물어보고 한 번 더
        const found = await discoverGeminiModel();
        if (found && !models.includes(found)) {
          const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${found}:generateContent`, {
            method: "POST", headers: { "x-goog-api-key": GEMINI_API_KEY, "content-type": "application/json" }, body: reqBody,
          });
          if (aiRes.ok) {
            const data = await aiRes.json();
            reply = (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text || "").join("").trim();
          } else {
            lastErr = `${aiRes.status} ${(await aiRes.text()).slice(0, 200)} (자동탐색: ${found})`;
          }
        } else if (!found) {
          lastErr += " / 사용 가능한 모델을 찾지 못했습니다";
        }
      }
      if (!reply) return new Response(JSON.stringify({ error: "지금 잠시 응답이 어렵습니다. 잠시 후 다시 시도해 주세요.", detail: `[gemini/${MODEL}] ${lastErr}` }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    } else {
      const reqBody = JSON.stringify({ model: MODEL, max_tokens: maxTok, system: sysPrompt, messages: [{ role: "user", content: userMsg }] });
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      let lastErr = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: reqBody,
        });
        if (r.ok) { const data = await r.json(); reply = (data?.content ?? []).map((b: any) => b?.text || "").join("").trim(); break; }
        lastErr = `${r.status} ${(await r.text()).slice(0, 200)}`;
        if ([429, 500, 503, 529].includes(r.status)) { await sleep(900); continue; }
        break;
      }
      if (!reply) return new Response(JSON.stringify({ error: "지금 잠시 응답이 어렵습니다. 잠시 후 다시 시도해 주세요.", detail: `[anthropic/${MODEL}] ${lastErr}` }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ result: reply }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "일시적인 오류가 발생했습니다." }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
