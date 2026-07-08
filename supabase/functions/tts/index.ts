// Supabase Edge Function: tts — 글을 자연스러운 한국어 음성으로 (Google Gemini TTS)
// 주보 AI와 같은 GEMINI_API_KEY 를 그대로 재사용합니다.
//
// ✅ 캐시: 한 번 만든 음성은 Supabase Storage(tts-cache 버킷)에 저장해 두고,
//    같은 글은 다시 생성하지 않고 저장본을 돌려줍니다(모든 성도·모든 재생에 적용 → 사실상 무료 재생).
//
// 배포(1회):
//   1) 버킷 생성:   Supabase ▸ SQL Editor 에서 supabase/tts_cache_bucket.sql 실행
//   2) 함수 배포:   supabase functions deploy tts --project-ref YOUR-PROJECT
//   3) 시크릿:      GEMINI_API_KEY (주보 AI에 이미 있으면 생략). SUPABASE_URL/SERVICE_ROLE_KEY는 자동 주입.

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MODEL = "gemini-2.5-flash-preview-tts";
const DEFAULT_VOICE = "Kore"; // 40대 여성 느낌의 차분·또렷한 성인 여성(정상 작동 확인). 후보: Aoede·Leda. ※Autonoe·Gacrux·Sulafat·Vindemiatrix는 빈응답 버그로 금지
const CACHE_BUCKET = "tts-cache";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const wavHeaders = { ...cors, "Content-Type": "audio/wav", "Cache-Control": "public, max-age=604800" };

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
// PCM(16-bit LE, mono) → WAV (브라우저 <audio> 재생용)
function pcmToWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const numCh = 1, bps = 16;
  const blockAlign = (numCh * bps) / 8;
  const byteRate = sampleRate * blockAlign;
  const buf = new ArrayBuffer(44 + pcm.length);
  const dv = new DataView(buf);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); dv.setUint32(4, 36 + pcm.length, true); ws(8, "WAVE");
  ws(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, numCh, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, byteRate, true); dv.setUint16(32, blockAlign, true); dv.setUint16(34, bps, true);
  ws(36, "data"); dv.setUint32(40, pcm.length, true);
  new Uint8Array(buf, 44).set(pcm);
  return new Uint8Array(buf);
}
async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function cacheGet(path: string): Promise<Uint8Array | null> {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${CACHE_BUCKET}/${path}`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch { return null; }
}
async function cachePut(path: string, wav: Uint8Array): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${CACHE_BUCKET}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "audio/wav", "x-upsert": "true" },
      body: wav,
    });
  } catch { /* 캐시 저장 실패는 무시(재생은 정상) */ }
}
// 생성 기록(관리자 대시보드 열람용). 실패해도 재생엔 영향 없음.
async function logGen(row: Record<string, unknown>) {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/tts_log`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
  } catch { /* 로그 실패 무시 */ }
}

// 요청자가 관리자(admins 테이블)인지 확인 — 목록/삭제 같은 관리 액션 전용
async function isAdminCaller(req: Request): Promise<boolean> {
  try {
    const auth = req.headers.get("authorization") || "";
    if (!auth) return false;
    const ur = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey: SERVICE_KEY } });
    if (!ur.ok) return false;
    const uid = (await ur.json())?.id;
    if (!uid) return false;
    const ar = await fetch(`${SUPABASE_URL}/rest/v1/admins?uid=eq.${uid}&select=uid&limit=1`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    return ar.ok && (((await ar.json()) || []).length > 0);
  } catch { return false; }
}

// 낭독 지침(모든 조각에 동일 적용). 지침 줄은 소리 내지 않고 스타일로만 반영됨.
const RULES =
  "다음 글을, 40대 중후반 여성의 따뜻하고 차분한 목소리로 또렷하게 낭독해 주세요.\n" +
  "낭독 규칙:\n" +
  "1) 성경 본문에서 각 절 앞의 절 번호(1, 2, 3 같은 숫자)는 소리 내어 읽지 말고, 내용만 매끄럽게 이어서 읽으세요.\n" +
  "2) '마5:1-11'이나 '시편 110:1-7'처럼 나오는 성경 구절 표기는 책 이름을 풀어서, 콜론(:)은 '장'으로(단, 시편은 '편'으로), 붙임표(-)는 '에서'로 읽으세요. 예: '마5:1-11' → '마태복음 5장 1절에서 11절'.\n" +
  "3) 문장 부호에 맞춰 자연스럽게 쉬세요.\n\n";

// 긴 본문을 문단·문장 경계로 ~max자씩 나눈다(짧은 조각일수록 생성이 빠르고 빈응답 버그도 드묾).
// ※ 조각이 너무 잘면 이음새(목소리 톤 변화)가 늘어남 → 1600자 정도로 크게 잘라 이음새를 최소화.
function chunkText(s: string, max = 1600): string[] {
  const paras = String(s).split(/\n{2,}/);
  const chunks: string[] = [];
  let buf = "";
  const push = () => { const t = buf.trim(); if (t) chunks.push(t); buf = ""; };
  for (const para of paras) {
    if (buf && (buf.length + 2 + para.length) > max) push();
    if (para.length > max) {
      const sents = para.match(/[^.!?。…\n]+[.!?。…]?/g) || [para];
      for (const sent of sents) { if (buf && (buf.length + 1 + sent.length) > max) push(); buf = buf ? buf + " " + sent : sent; }
    } else {
      buf = buf ? buf + "\n\n" + para : para;
    }
  }
  push();
  return chunks.length ? chunks : [String(s)];
}

// 한 조각을 음성(PCM)으로 생성. 빈응답(finishReason OTHER) 버그는 최대 5회 재시도.
async function genChunkPcm(chunk: string, voiceName: string): Promise<{ pcm: Uint8Array; rate: number }> {
  const body = {
    contents: [{ parts: [{ text: RULES + chunk }] }],
    // temperature 0: 낭독 스타일의 무작위성을 제거 — 조각마다 톤·속도가 달라져
    // 이어붙였을 때 '다른 목소리'처럼 들리던 문제를 막는다(같은 Kore라도 기본값은 매번 달리 읽음).
    generationConfig: { temperature: 0, responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } },
  };
  let lastDetail = "";
  // 재시도는 3회로 축소(요청 수 절약). 429(일일 할당량 초과)는 몇 초 뒤에도 회복되지 않으므로
  // 재시도로 요청을 낭비하지 않고 즉시 중단한다 — quota 초과 시 폭주 방지.
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      { method: "POST", headers: { "x-goog-api-key": GEMINI_API_KEY, "content-type": "application/json" }, body: JSON.stringify(body) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      lastDetail = j?.error?.message || ("HTTP " + r.status);
      if (r.status === 429) { const e: any = new Error(lastDetail); e.quota = true; throw e; }   // 할당량 초과 → 재시도 안 함
      if (r.status >= 500) continue;   // 서버 일시 오류만 재시도
      throw new Error(lastDetail);
    }
    const part = (j?.candidates?.[0]?.content?.parts || []).find((p: any) => p?.inlineData?.data);
    if (part?.inlineData?.data) {
      const rate = Number((String(part.inlineData.mimeType || "").match(/rate=(\d+)/) || [])[1]) || 24000;
      return { pcm: b64ToBytes(part.inlineData.data), rate };
    }
    lastDetail = "빈 응답(finishReason OTHER)";
  }
  throw new Error(lastDetail || "빈 응답");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    if (!GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY 미설정 — Supabase 시크릿에 추가하세요." }, 500);
    const { text, voice, date, sig, action, path: reqPath } = await req.json().catch(() => ({} as any));

    // ── 관리 액션(관리자 전용): 저장 음원 목록 / 삭제 ──
    //    브라우저에서 storage를 직접 지우려면 storage.objects RLS 정책이 필요한데, SQL Editor에서
    //    정책 생성이 막힌 프로젝트가 있어 삭제가 조용히 실패했음 → 서비스 키를 가진 이 함수가 대신 처리한다.
    if (action === "list" || action === "delete") {
      if (!(await isAdminCaller(req))) return json({ error: "관리자 전용" }, 403);
      if (action === "list") {
        const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${CACHE_BUCKET}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ prefix: "", limit: 500, sortBy: { column: "created_at", order: "desc" } }),
        });
        const rows: any[] = r.ok ? await r.json() : [];
        const files = (rows || [])
          .filter((x) => x?.name && /\.(wav|mp3)$/i.test(x.name))   // 음원만(쿨다운 마커 cool-*.txt 제외)
          .map((x) => ({ name: x.name, size: x?.metadata?.size ?? null, created_at: x.created_at ?? null }));
        return json({ ok: true, files });
      }
      const p = String(reqPath || "");
      if (!/^[A-Za-z0-9._-]{1,120}\.(wav|mp3)$/.test(p)) return json({ error: "잘못된 경로" }, 400);
      const dr = await fetch(`${SUPABASE_URL}/storage/v1/object/${CACHE_BUCKET}/${p}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
      });
      if (!dr.ok && dr.status !== 404) return json({ error: "파일 삭제 실패", status: dr.status }, 502);
      // 같은 파일을 가리키는 생성 기록도 함께 정리
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/tts_log?url=like.${encodeURIComponent("*" + p)}`, {
          method: "DELETE",
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        });
      } catch { /* 기록 정리 실패는 무시 */ }
      return json({ ok: true });
    }
    const clean = String(text ?? "").trim();
    if (!clean) return json({ error: "text 없음" }, 400);
    const capped = clean.slice(0, 12000); // 사실상 제한 없음(QT는 최대 ~4천 자). 폭주 방지용 안전 상한만.
    const voiceName = String(voice || DEFAULT_VOICE);

    // 1) 캐시 확인 — 날짜(+내용지문 sig)가 오면 qt-<날짜>-<sig>.wav(프런트가 이 경로로 스트리밍).
    //    sig가 내용에 따라 바뀌므로 QT를 수정하면 새 파일이 만들어져 옛 음성을 재사용하지 않는다.
    const dateOk = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date);
    const sigOk = typeof sig === "string" && /^[a-z0-9]{1,12}$/.test(sig);
    const path = dateOk
      ? (sigOk ? `qt-${date}-${sig}.wav` : `qt-${date}.wav`)
      : (await sha256hex(voiceName + "|" + capped)) + ".wav";
    const cached = await cacheGet(path);
    if (cached) return new Response(cached, { headers: { ...wavHeaders, "X-TTS-Cache": "hit" } });

    // 2) 없으면 Gemini로 생성 — 긴 본문은 문장 단위로 나눠 '병렬'로 생성(속도·안정성↑) 후 이어붙인다.
    //    (한 번에 긴 본문을 요청하면 느리고 빈응답 버그가 잦음 → 짧은 조각 여러 개를 동시에 생성)
    const chunks = chunkText(capped, 800);
    const results: ({ pcm: Uint8Array; rate: number } | null)[] = new Array(chunks.length).fill(null);
    const CONC = 4;                    // 동시 생성 개수(과도한 동시요청→429 방지)
    let next = 0, failDetail = "";
    async function worker() {
      while (next < chunks.length) {
        const my = next++;
        results[my] = await genChunkPcm(chunks[my], voiceName);
      }
    }
    try {
      await Promise.all(Array.from({ length: Math.min(CONC, chunks.length) }, () => worker()));
    } catch (e) {
      failDetail = String((e as any)?.message || e);
      return json({ error: "오디오 생성 실패(재시도 후에도 빈 응답)", detail: failDetail }, 502);
    }
    const rate = results[0]?.rate || 24000;
    // 조각 사이에 0.3초 무음을 넣어 문단 전환이 뚝 끊기지 않고 자연스러운 쉼으로 이어지게 한다
    const gap = new Uint8Array(Math.floor(rate * 0.3) * 2);   // 16bit 모노 = 샘플당 2바이트(0 = 무음)
    const parts: Uint8Array[] = [];
    for (const r of results) { if (r && r.pcm.length) { if (parts.length) parts.push(gap); parts.push(r.pcm); } }
    let total = 0; for (const p of parts) total += p.length;
    if (!total) return json({ error: "오디오 생성 실패(빈 응답)", detail: "empty" }, 502);
    const pcm = new Uint8Array(total);
    let off = 0; for (const p of parts) { pcm.set(p, off); off += p.length; }
    const wav = pcmToWav(pcm, rate);

    // 3) 캐시에 저장(다음부터는 공짜 재생) — 저장 실패해도 이번 재생은 정상
    await cachePut(path, wav);
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${CACHE_BUCKET}/${path}`;
    await logGen({ qt_date: (typeof date === "string" && date) ? date : null, label: capped.slice(0, 60), url: publicUrl, bytes: wav.length, voice: voiceName });
    return new Response(wav, { headers: { ...wavHeaders, "X-TTS-Cache": "miss" } });
  } catch (e) {
    return json({ error: "오류", detail: String((e as any)?.message || e) }, 500);
  }
});
