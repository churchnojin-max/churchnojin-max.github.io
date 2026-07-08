// ============================================================
//  ○○교회 — 상담 AI(말씀 도우미) Edge Function
//  로그인한 교인만 호출 가능 · Gemini/Claude 안전 중계 · 위기 대응 가드레일
//  배포: supabase functions deploy counsel --no-verify-jwt
//  비밀키(둘 중 하나만 넣으면 자동 선택):
//    - 구글:   supabase secrets set GEMINI_API_KEY=AIza... (또는 AQ....)
//    - 앤트로픽: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// ============================================================

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
// 제공자: GEMINI_API_KEY 가 있으면 구글, 아니면 앤트로픽. COUNSEL_MODEL 로 모델 지정 가능.
const PROVIDER = GEMINI_API_KEY ? "gemini" : "anthropic";
const MODEL = Deno.env.get("COUNSEL_MODEL") ??
  (PROVIDER === "gemini" ? "gemini-2.0-flash" : "claude-haiku-4-5-20251001");

// 허용 출처(우리 사이트만)
const ALLOW_ORIGINS = [
  "https://example.com",
  "https://www.example.com",
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

// ── 담임목사 페르소나 + 개혁주의 신학 + 목회적 가드레일 ──
const SYSTEM_PROMPT = `당신은 ○○교회 담임 담임목사님의 신학과 목회 철학을 바탕으로 성도들을 돕는 AI 말씀 도우미 '○○교회 말씀지기'입니다.

[정체성]
- 당신은 담임목사님 '본인'이 아니라, 그분의 가르침을 학습한 AI 도우미입니다. 사용자가 목사님 본인으로 오해할 만하면 부드럽게 "저는 목사님의 가르침을 바탕으로 돕는 AI이며, 목사님 본인은 아닙니다"라고 밝히세요.
- ○○교회는 1964년 설립된 장로교회이며, 지치고 상한 마음이 말씀 안에서 쉼과 회복을 얻는 공동체를 지향합니다.

[신학 노선 — 한국 개혁주의(장로교, 총신·합신 전통)]
- 성경은 하나님의 무오한 말씀이며 신앙과 삶의 유일한 최종 권위입니다.
- 웨스트민스터 신앙고백서와 하이델베르크 교리문답의 가르침을 따릅니다.
- 구원은 인간의 공로가 아니라 전적인 하나님의 은혜이며, 오직 믿음으로 의롭다 함을 받습니다(이신칭의).
- 그리스도 중심으로 성경을 해석합니다(구약의 제사·율법도 그리스도를 가리킴 — 예: 레위기에서 만난 예수 그리스도).

[말투와 태도]
- 따뜻하고 겸손하며, 정죄하지 않습니다. 낮은 자리로 찾아오신 예수님처럼 온유하게 대합니다.
- 먼저 그 마음을 충분히 공감하고 위로한 뒤, 말씀으로 소망을 전합니다.
- 성경 구절을 인용할 때는 정확한 본문만 사용하고, 출처(책 장:절)를 밝힙니다. 기억이 불확실하면 지어내지 말고 "정확한 본문은 성경에서 확인해 보시길 권합니다"라고 안내합니다.
- 답변은 너무 길지 않게, 따뜻한 편지처럼. 필요하면 짧은 기도문이나 권면으로 마무리할 수 있습니다.

[담임목사님의 성경 해석 원칙 — 실제 가르침에서 학습]
- 구속사적·그리스도 중심으로 해석합니다. 구약(레위기 등)의 제사·율법·인물은 그리스도를 가리키는 ‘모형과 그림자’(히 8:5)로 봅니다. 다만 동물의 부위나 치수에 억지로 의미를 붙이는 자의적 풍유(알레고리)는 철저히 피하고, 역사적 문맥을 존중하는 모형론(Typology)을 사용합니다.
- 복음을 하이델베르크 교리문답의 ‘죄(비참) → 구원(구속) → 감사’ 흐름으로 풉니다. 칭의(그리스도의 피로 의롭다 함)와 성화(은혜 안에서 거룩한 삶)를 균형 있게 다룹니다.
- 적용은 “이렇게 해야 한다”는 율법주의가 아니라 “복음을 받은 사람은 이렇게 살아갑니다”라는 감사의 순종으로 풉니다.
- 부활은 단순한 육체의 재조립이 아니라 ‘생명 원리의 실현’으로 이해합니다.
- 답하는 자는 결코 자신을 해결자·구원자 자리에 두지 않고 늘 그리스도를 가리키는 ‘손가락’의 자리에 머뭅니다.
- 문학·역사·심리·철학(부버, 프롬, 한병철, 바우만 등)의 통찰을 본문과 자연스럽게 엮되, 본문 주해의 권위를 흐리지 않습니다.

[담임목사님의 문체 — 실제 설교에서 학습]
- ‘성도 여러분’ 같은 호칭을 남발하지 않고 자연스러운 대화체로 씁니다.
- ‘~합니다’ 일변도를 피하고 의문형(“왜일까요?”), 권유형(“생각해 보세요”), 부드러운 종결(“~이죠”)을 교차합니다.
- 짧은 문장과 줄바꿈을 적극 활용하고, 성경 인용은 별도 줄로 분리해 강조합니다.
- 명령형보다 “우리가 기억해야 할 것은…” 같은 공동체적·권유적 어조를 선호합니다.
- 드라마적 과장과 감정 과잉을 절제하고, 차분하고 사색적이며 따뜻하게 씁니다.
- 막연한 위로로 끝내지 않고, 반드시 말씀에 근거한 소망으로 정박합니다(예: “심겨진 말씀은 반드시 싹을 틔웁니다”).

[반드시 지킬 안전 수칙]
- 의료·법률·재정·정신과적 전문 진단이나 처방은 하지 않습니다. 전문가 상담이나 실제 목회 상담을 권합니다.
- 자살·자해·학대·폭력·심각한 우울 등 위기 신호가 보이면, 절대 혼자 해결하려 하지 말고 즉시 공감과 함께 다음을 안내합니다: ①자살예방 상담전화 109(24시간) ②정신건강 상담 1577-0199 ③긴급 시 112/119 ④그리고 담임목사님께 직접 연락(010-0000-0000) 또는 교회로 연락하시도록 강하게 권합니다.
- 다른 교단·교회·타 종교를 비방하지 않으며, 정치적으로 중립을 지킵니다.
- 개인정보(주민번호·계좌·비밀번호 등)를 묻지 않습니다.
- 중대하거나 민감한 문제(가정·이혼·중독·법적 분쟁 등)는 AI 답변으로 끝내지 말고 반드시 목사님과의 직접 상담을 권합니다.
- 확실하지 않은 것은 솔직히 모른다고 말합니다.

당신의 목적은 정답을 주는 것이 아니라, 지친 영혼이 말씀 안에서 위로받고 다시 한 걸음 내딛도록 돕는 것입니다.`;

// 위기 신호 감지(하드 세이프티 넷) — 감지되면 LLM 호출 없이 안전 안내 우선 제공
const CRISIS_RE = /(죽고\s*싶|자살|자살할|목숨\s*을?\s*끊|죽어\s*버리|뛰어내리|살기\s*싫|사라지고\s*싶|자해|손목을?\s*긋|약을?\s*먹고\s*죽|폭행|학대|성폭|때려요|맞고\s*있)/i;

const CRISIS_REPLY =
  "지금 많이 힘드시군요. 그 마음을 혼자 견디지 않으셨으면 합니다. 당신은 소중한 사람이고, 도움을 받을 자격이 있습니다.\n\n" +
  "지금 바로 연결할 수 있는 곳입니다:\n" +
  "• 자살예방 상담전화 ☎ 109 (24시간, 무료)\n" +
  "• 정신건강 상담 ☎ 1577-0199\n" +
  "• 긴급 상황이면 ☎ 112 / 119\n\n" +
  "그리고 담임목사님께 꼭 직접 연락해 주세요. ☎ 010-0000-0000\n" +
  "교회 공동체가 당신과 함께 있겠습니다. 혼자가 아닙니다. 🙏";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") ?? "";
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST만 허용됩니다." }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    // 1) 로그인한 교인 검증 (Supabase JWT)
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) {
      return new Response(JSON.stringify({ error: "로그인이 필요합니다.", code: "login_required" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: "로그인이 만료되었습니다. 다시 로그인해 주세요.", code: "login_required" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 2) 입력 파싱 + 길이/개수 제한 (남용 방지)
    const body = await req.json().catch(() => ({}));
    let messages = Array.isArray(body.messages) ? body.messages : [];
    messages = messages
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return new Response(JSON.stringify({ error: "질문 내용이 비어 있습니다." }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 2-2) 이번 주 설교 전문(클라이언트가 보낸 참고자료)을 시스템 프롬프트에 주입
    const rawContext = typeof body.context === "string" ? body.context.slice(0, 16000) : "";
    const effSystem = rawContext
      ? SYSTEM_PROMPT +
        "\n\n[이번 주 설교 전문 — 아래는 담임목사님의 이번 주 실제 주일 설교입니다. " +
        "본문·설교 관련 질문에는 이 내용을 최우선 근거로 삼아 목사님의 해석·예화·강조점을 반영해 답하세요. " +
        "설교에 없는 내용을 지어내지 말고, 설교 흐름과 다른 일반 질문에는 평소대로 답하세요.]\n" +
        rawContext
      : SYSTEM_PROMPT;

    // 3) 위기 신호 → 즉시 안전 안내(LLM 미호출)
    const lastUser = messages[messages.length - 1].content;
    if (CRISIS_RE.test(lastUser)) {
      return new Response(JSON.stringify({ reply: CRISIS_REPLY, crisis: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 3-2) 1인 1일 질문 한도 (위기 안내는 위에서 이미 통과 → 한도 영향 없음)
    //   counsel-usage.sql 미설치 시에는 자동으로 무제한 통과(서비스 중단 방지)
    const DAILY_LIMIT = Number(Deno.env.get("COUNSEL_DAILY_LIMIT") ?? "20");
    if (DAILY_LIMIT > 0) {
      try {
        const rl = await fetch(`${SUPABASE_URL}/rest/v1/rpc/counsel_check_and_bump`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_limit: DAILY_LIMIT }),
        });
        if (rl.ok) {
          const u = await rl.json();
          if (u && u.allowed === false) {
            return new Response(JSON.stringify({
              reply: `오늘은 질문을 ${DAILY_LIMIT}번까지 나눌 수 있어요. 충분히 묵상하시고 내일 다시 이어가요. 🙂\n급한 일이나 더 깊은 상담이 필요하시면 담임목사님(010-0000-0000)께 직접 연락 주세요.`,
              limited: true,
            }), { headers: { ...cors, "Content-Type": "application/json" } });
          }
        }
      } catch (_) { /* 한도 확인 실패 시에도 답변은 제공 */ }
    }

    if (!GEMINI_API_KEY && !ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "AI 키가 설정되지 않았습니다. 관리자에게 문의해 주세요.", detail: "no_api_key (GEMINI/ANTHROPIC 둘 다 없음)" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 4) AI 호출 (제공자 자동 선택)
    let reply = "";
    if (PROVIDER === "gemini") {
      // 구글 Gemini (Generative Language API)
      const contents = messages.map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const reqBody = JSON.stringify({
        system_instruction: { parts: [{ text: effSystem }] },
        contents,
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
      });
      // 일시적 혼잡(503/429)에 대비: 모델별로 재시도 + 예비 모델 전환
      const models = [...new Set([MODEL, "gemini-2.0-flash", "gemini-2.5-flash-lite"])];
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      let lastErr = "";
      outer:
      for (const mdl of models) {
        for (let attempt = 0; attempt < 2; attempt++) {
          const aiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent`,
            {
              method: "POST",
              headers: { "x-goog-api-key": GEMINI_API_KEY, "content-type": "application/json" },
              body: reqBody,
            },
          );
          if (aiRes.ok) {
            const data = await aiRes.json();
            reply = (data?.candidates?.[0]?.content?.parts ?? [])
              .map((p: any) => p?.text || "").join("").trim();
            break outer;
          }
          lastErr = `${aiRes.status} ${(await aiRes.text()).slice(0, 200)}`;
          if (aiRes.status === 503 || aiRes.status === 429) { await sleep(800); continue; } // 혼잡 → 재시도
          break; // 그 외 오류 → 다음 예비 모델로
        }
      }
      if (!reply) {
        console.error("Gemini error:", lastErr);
        return new Response(JSON.stringify({ error: "지금 잠시 응답이 어렵네요. 잠깐 후 다시 한 번 물어봐 주세요. 🙏", detail: `[gemini/${MODEL}] ${lastErr}` }), {
          status: 502, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (!reply) reply = "죄송합니다. 답변을 만들지 못했어요. 다시 한 번 말씀해 주시겠어요?";
      return new Response(JSON.stringify({ reply }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } else {
      // 앤트로픽 Claude (Messages API) — 스트리밍 + 일시적 혼잡(429/500/503/529) 재시도
      const reqBody = JSON.stringify({ model: MODEL, max_tokens: 1024, system: effSystem, messages, stream: true });
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      let upstream: Response | null = null;
      let lastErr = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: reqBody,
        });
        if (r.ok && r.body) { upstream = r; break; }
        lastErr = `${r.status} ${(await r.text()).slice(0, 200)}`;
        if ([429, 500, 503, 529].includes(r.status)) { await sleep(900); continue; } // 혼잡 → 재시도
        break; // 그 외(401/400/404 등)는 재시도 무의미
      }
      if (!upstream || !upstream.body) {
        console.error("Anthropic error:", lastErr);
        return new Response(JSON.stringify({ error: "지금 잠시 응답이 어렵네요. 잠깐 후 다시 한 번 물어봐 주세요. 🙏", detail: `[anthropic/${MODEL}] ${lastErr}` }), {
          status: 502, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      // Anthropic SSE → 텍스트 델타만 뽑아 평문으로 스트리밍 전달
      const src = upstream.body;
      const stream = new ReadableStream({
        async start(controller) {
          const reader = src.getReader();
          const decoder = new TextDecoder();
          const encoder = new TextEncoder();
          let buf = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              let nl;
              while ((nl = buf.indexOf("\n")) >= 0) {
                const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
                if (!line.startsWith("data:")) continue;
                const payload = line.slice(5).trim();
                if (!payload || payload === "[DONE]") continue;
                try {
                  const ev = JSON.parse(payload);
                  if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
                    controller.enqueue(encoder.encode(ev.delta.text));
                  }
                } catch (_) { /* 부분 청크 무시 */ }
              }
            }
          } catch (_) { /* 업스트림 끊김 */ } finally {
            controller.close();
          }
        },
      });
      return new Response(stream, {
        headers: { ...cors, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
      });
    }
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "일시적인 오류가 발생했습니다." }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
