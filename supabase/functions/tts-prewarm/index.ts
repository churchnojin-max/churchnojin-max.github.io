// Supabase Edge Function: tts-prewarm
// QT가 발행/수정되면 성도들이 첫 재생 때 기다리지 않도록, '오늘·내일' QT 음성을 미리 생성(캐시)해 둔다.
// - cron(예: 30분마다)이 이 함수를 호출 → qt_published에서 대상 날짜의 QT를 읽어 tts 함수로 생성.
// - 이미 만들어진(내용 지문 sig 동일) 음성이 있으면 건너뛴다(추가 비용 없음).
//
// ⚠ 중요: readText/sig 계산 로직은 js/main.js(홈 QT 모달)와 '동일'해야 파일명이 일치한다.
//   main.js의 rowToQtContent/qtHtmlToText/parseQt/parts/textSig 를 바꾸면 아래도 같이 맞출 것.
//
// 배포(1회): Supabase ▸ Edge Functions ▸ tts-prewarm ▸ Deploy
//   그리고 supabase/tts_prewarm_cron.sql 을 SQL Editor에서 1회 실행(예약 등록).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── main.js와 동일한 텍스트/지문 계산 (검증됨) ──
function fmtKakaoDateFromIso(iso: string): string {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const dow = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][d.getDay()];
  return `${m[1]}.${m[2]}.${m[3]} ${dow}`;
}
function qtHtmlToText(html: unknown): string {
  if (html == null) return "";
  const s = String(html);
  if (!/<[a-z!][\s\S]*>/i.test(s)) return s;
  let x = s.replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, "$&\n").replace(/<br\s*\/?>/gi, "\n");
  x = x.replace(/<[^>]+>/g, "");
  x = x.replace(/&nbsp;/g, " ")  /* 브라우저 textContent와 동일: 일반 공백이면 sig 불일치 */.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
  return x.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
}
function rowToQtContent(r: any): string {
  const out: string[] = [];
  out.push("📖 샬롬! 오늘의 QT입니다.");
  out.push("");
  out.push(`📅 날짜: ${fmtKakaoDateFromIso(r.sermon_date)}`);
  out.push("");
  if (r.title) out.push(r.title);
  if (r.scripture) out.push(r.scripture);
  out.push("");
  out.push("📖 성경 본문 (우리말 성경)");
  out.push((r.qt_bible_text || "").trim());
  out.push("");
  out.push("📝 묵상");
  out.push("");
  out.push(qtHtmlToText(r.content).trim());
  const prayer = qtHtmlToText(r.prayer).trim();
  if (prayer) { out.push(""); out.push("🙏 기도"); out.push(""); out.push(prayer); }
  return out.join("\n");
}
function parseQt(raw: string) {
  const lines = (raw || "").split("\n").map((s) => s.replace(/\s+$/g, ""));
  let title = "", ref = "";
  const sections: { head: string; body: string[] }[] = []; let cur: { head: string; body: string[] } | null = null;
  for (const ln of lines) {
    const t = ln.trim();
    if (!t) { if (cur) cur.body.push(""); continue; }
    if (/^📖/.test(t) && /(샬롬|오늘의\s*QT)/.test(t)) continue;
    if (/^📅\s*날짜\s*[:：]?\s*(.+)$/.test(t)) continue;
    const hm = t.match(/^(?:📖|📝|🙏|💡|✏️|🕊️|✨|🌱|📌|✝️?)\s*(.+)$/);
    if (hm) { cur = { head: hm[1].trim(), body: [] }; sections.push(cur); continue; }
    if (!cur) {
      if (!title) { title = t; continue; }
      if (!ref && /\d/.test(t) && /[:：~∼\-장절,\s]/.test(t) && t.length <= 32) { ref = t; continue; }
      title += " " + t; continue;
    }
    cur.body.push(t);
  }
  return { title, ref, sections };
}
function buildReadText(row: any): string {
  const p = parseQt(rowToQtContent(row));
  const parts: any[] = [];
  if (p.title) parts.push(p.title);
  if (p.ref) parts.push(p.ref);
  (p.sections || []).forEach((s) => { const h = String(s.head || "").replace(/[^가-힣A-Za-z0-9\s]/g, " ").trim(); if (h) parts.push(h); if (s.body) parts.push(s.body); });
  let readText = parts.join(". ");
  if (!readText.trim()) readText = rowToQtContent(row);
  return readText;
}
function textSig(s: string): string {
  let h = 2166136261 >>> 0; s = String(s || "");
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
}
function kstDate(offsetDays = 0): string {
  const d = new Date(Date.now() + 9 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

// ── 오래된 음원 자동 삭제 ──
// WAV는 무압축이라 QT 1편 ≈ 17MB → 무료 저장 1GB가 약 2달이면 가득 참.
// KEEP_DAYS 일이 지난 파일을 지워 상시 사용량을 ~240MB 수준으로 유지한다.
// (지난 QT를 다시 들으면 그때 새로 생성되므로 기능 손실 없음)
const KEEP_DAYS = 14;
async function cleanupOld() {
  const cutoff = kstDate(-KEEP_DAYS);   // 이 날짜(YYYY-MM-DD) 이전 파일 삭제
  const out = { cutoff, checked: 0, deleted: 0, names: [] as string[] };
  try {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/tts-cache`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "", limit: 1000, sortBy: { column: "created_at", order: "asc" } }),
    });
    const rows: any[] = r.ok ? await r.json() : [];
    for (const x of rows) {
      const name = String(x?.name || "");
      if (!name || name === ".emptyFolderPlaceholder") continue;
      out.checked++;
      // 파일명의 QT 날짜(qt-YYYY-MM-DD…) 우선, 없으면(해시명 등) 업로드 시각 기준
      const m = name.match(/^qt-(\d{4}-\d{2}-\d{2})/);
      const stamp = m ? m[1] : String(x?.created_at || "").slice(0, 10);
      if (!stamp || stamp >= cutoff) continue;
      const dr = await fetch(`${SUPABASE_URL}/storage/v1/object/tts-cache/${name}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
      });
      if (dr.ok || dr.status === 404) {
        out.deleted++; if (out.names.length < 30) out.names.push(name);
        try {   // 같은 파일을 가리키는 생성 기록도 정리
          await fetch(`${SUPABASE_URL}/rest/v1/tts_log?url=like.${encodeURIComponent("*" + name)}`, {
            method: "DELETE",
            headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
          });
        } catch { /* 무시 */ }
      }
    }
  } catch { /* 청소 실패는 다음 회차에 재시도 */ }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "env 미설정" }, 500);

  // 대상 날짜: 요청에 date가 오면 그 날짜, 아니면 오늘·내일(KST)
  let dates: string[] = [kstDate(0), kstDate(1)];
  try { const b = await req.json(); if (b && typeof b.date === "string") dates = [b.date]; } catch { /* 본문 없음 = 기본 */ }

  // 실패한 생성을 30분마다 재시도하며 Gemini 할당량을 태우는 '폭주'를 막는 쿨다운.
  //   마커 파일(cool-<날짜>-<sig>.txt)에 '다시 시도 가능 시각(ms)'을 저장 → 그 전까진 생성 건너뜀.
  const COOLDOWN_MS = 3 * 3600 * 1000;         // 일반 실패: 3시간 쉼
  const QUOTA_COOLDOWN_MS = 12 * 3600 * 1000;  // 할당량 초과: 12시간 쉼(하루 리셋 대기)
  async function coolGet(name: string): Promise<number> {
    try {
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/tts-cache/${name}`, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
      if (!r.ok) return 0;
      const n = Number((await r.text()).trim()); return isFinite(n) ? n : 0;
    } catch { return 0; }
  }
  async function coolPut(name: string, untilMs: number) {
    try {
      await fetch(`${SUPABASE_URL}/storage/v1/object/tts-cache/${name}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "text/plain", "x-upsert": "true" },
        body: String(untilMs),
      });
    } catch { /* 무시 */ }
  }

  const results: any[] = [];
  for (const date of dates) {
    try {
      const u = `${SUPABASE_URL}/rest/v1/qt_published?select=sermon_date,title,scripture,qt_bible_text,content,prayer&sermon_date=eq.${date}&limit=1`;
      const rr = await fetch(u, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
      const rows = rr.ok ? await rr.json() : [];
      if (!rows || !rows.length) { results.push({ date, status: "no-qt" }); continue; }
      const row = rows[0];
      const readText = buildReadText(row);
      const sig = textSig(readText);
      const path = `qt-${date}-${sig}.wav`;
      // 이미 캐시돼 있으면 생성 안 함
      const head = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${"tts-cache"}/${path}`, { method: "GET", headers: { Range: "bytes=0-1" } });
      if (head.ok || head.status === 206) { results.push({ date, sig, status: "cached" }); continue; }
      // 최근에 실패했으면(쿨다운) 재시도하지 않음 — 할당량 폭주 방지
      const coolName = `cool-${date}-${sig}.txt`;
      const until = await coolGet(coolName);
      if (Date.now() < until) { results.push({ date, sig, status: "cooldown", retryInMin: Math.round((until - Date.now()) / 60000) }); continue; }
      // 없으면 tts 함수로 생성(청크 병렬 생성 → 캐시 저장)
      const gen = await fetch(`${SUPABASE_URL}/functions/v1/tts`, {
        method: "POST",
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: readText, date, sig }),
      });
      if (gen.ok) { results.push({ date, sig, status: "generated" }); continue; }
      const errText = await gen.text().catch(() => "");
      const quota = /quota|rate.?limit|exceeded|429/i.test(errText);
      await coolPut(coolName, Date.now() + (quota ? QUOTA_COOLDOWN_MS : COOLDOWN_MS));
      results.push({ date, sig, status: quota ? "quota-cooldown" : "gen-failed", http: gen.status });
    } catch (e) {
      results.push({ date, status: "error", detail: String((e as any)?.message || e) });
    }
  }
  // 미리 생성 후, 보관 기간(KEEP_DAYS)이 지난 음원을 자동 삭제
  const cleanup = await cleanupOld();
  return json({ ok: true, results, cleanup });
});
