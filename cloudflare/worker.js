/****************************************************************
 * 노진교회 — 파일 업로드 중계 Worker (Cloudflare Workers + R2)
 * --------------------------------------------------------------
 *  - POST   /upload        로그인 교인이 파일 업로드 → R2 저장 → { url, key } 반환
 *  - GET    /f/<key>       저장된 파일 보기/다운로드 (공개, 1년 캐시)
 *  - DELETE /f/<key>       본인이 올린 파일 삭제
 *
 *  ▼ 대시보드 설정(코드에 비밀키 안 넣음)
 *    1) R2 버킷 생성 (예: church-uploads)
 *    2) 이 Worker 생성 후 이 코드 붙여넣기
 *    3) Settings → Variables and Secrets 에 일반 변수 2개 추가
 *         SUPABASE_URL       = https://vwuzmklacdwiqyqjrxyt.supabase.co
 *         SUPABASE_ANON_KEY  = (js/config.js 의 window.SUPABASE_ANON_KEY 값)
 *    4) Settings → Bindings → R2 bucket 추가
 *         변수 이름(Variable name) = BUCKET   ← 반드시 이 이름
 *         버킷 = 위에서 만든 church-uploads
 *    5) 배포(Deploy) 후 Worker 주소(...workers.dev)를 js/config.js 의
 *       window.R2_UPLOAD_URL 에 넣기
 ****************************************************************/

// 업로드를 허용할 출처(우리 홈페이지). [0]은 미매칭 시 기본값이므로 실제 도메인을 먼저.
const ALLOW_ORIGINS = [
  "https://churchnojin-max.github.io",
  "http://localhost:8102",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];
const MAX_BYTES = 100 * 1024 * 1024; // 1건 최대 100MB (Cloudflare 무료 플랜 요청 본문 상한)

function corsHeaders(req) {
  const origin = req.headers.get("Origin") || "";
  const allow = ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, x-filename, x-folder",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(obj, status, req) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(req) },
  });
}

// Supabase 토큰으로 로그인 사용자 확인
async function verifyUser(token, env) {
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  try {
    const r = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: "Bearer " + token },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch (e) {
    return null;
  }
}

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function safeExt(name) {
  const m = String(name || "").toLowerCase().match(/\.[a-z0-9]{1,8}$/);
  return m ? m[0] : "";
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(req) });
    }

    // ----- 파일 보기/다운로드 (공개) -----
    if (req.method === "GET" && url.pathname.startsWith("/f/")) {
      const key = decodeURIComponent(url.pathname.slice(3));
      const obj = await env.BUCKET.get(key);
      if (!obj) return new Response("Not found", { status: 404, headers: corsHeaders(req) });
      const h = new Headers(corsHeaders(req));
      obj.writeHttpMetadata(h);
      h.set("etag", obj.httpEtag);
      h.set("Cache-Control", "public, max-age=31536000, immutable");
      return new Response(obj.body, { headers: h });
    }

    // ----- 여기부터는 로그인 필요 -----
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const user = await verifyUser(token, env);
    if (!user) return json({ error: "로그인이 필요합니다. 다시 로그인 후 시도해 주세요." }, 401, req);

    // ----- 업로드 -----
    if (req.method === "POST" && url.pathname === "/upload") {
      const folder = (req.headers.get("x-folder") || "uploads").replace(/[^a-zA-Z0-9_-]/g, "") || "uploads";
      let origName = req.headers.get("x-filename") || "file";
      try { origName = decodeURIComponent(origName); } catch (e) {}
      const ext = safeExt(origName);
      const ct = req.headers.get("Content-Type") || "application/octet-stream";
      const lenHeader = req.headers.get("Content-Length");
      const len = lenHeader ? parseInt(lenHeader, 10) : 0;
      const maxMB = Math.round(MAX_BYTES / 1024 / 1024);
      if (len > MAX_BYTES) return json({ error: "파일이 너무 큽니다(최대 " + maxMB + "MB)." }, 413, req);
      if (!req.body || len === 0) return json({ error: "빈 파일입니다." }, 400, req);
      const key = `${folder}/${user.id}/${Date.now()}-${rand()}${ext}`;
      // 메모리에 담지 않고 R2로 바로 스트리밍(큰 파일 안전)
      await env.BUCKET.put(key, req.body, { httpMetadata: { contentType: ct } });
      const fileUrl = `${url.origin}/f/${key.split("/").map(encodeURIComponent).join("/")}`;
      return json({ url: fileUrl, key }, 200, req);
    }

    // ----- 삭제(본인 파일만) -----
    if (req.method === "DELETE" && url.pathname.startsWith("/f/")) {
      const key = decodeURIComponent(url.pathname.slice(3));
      if (!key.includes(`/${user.id}/`)) {
        return json({ error: "본인이 올린 파일만 삭제할 수 있습니다." }, 403, req);
      }
      await env.BUCKET.delete(key);
      return json({ ok: true }, 200, req);
    }

    return json({ error: "지원하지 않는 요청입니다." }, 404, req);
  },
};
