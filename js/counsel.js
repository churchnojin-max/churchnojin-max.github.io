/* ============================================================
   ○○교회 — ○○교회 말씀지기 (페이지 내장 AI 질문창)
   #askForm 이 있는 페이지에서만 작동 · Supabase Edge Function(counsel) 호출
   추천 질문은 '이번 주 말씀'(BULLETINS)에 맞춰 자동 생성
   ============================================================ */
(function () {
  const form = document.getElementById("askForm");
  if (!form) return; // 질문창이 있는 페이지에서만
  if (!window.SUPABASE_URL) return;

  const ENDPOINT = window.SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/counsel-";
  const input = document.getElementById("askInput");
  const sendBtn = document.getElementById("askSend");
  const thread = document.getElementById("askThread");
  const suggest = document.getElementById("askSuggest");

  let sb = null;
  let history = [];
  let busy = false;

  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fmt = (s) => esc(s).replace(/\n/g, "<br/>");

  // 마크다운 기호(**굵게**, > 인용, - 목록, # 제목)를 실제 서식으로 변환
  function inlineMd(t) {
    return t
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/_([^_\n]+)_/g, "<em>$1</em>")
      .replace(/`([^`\n]+)`/g, "$1");
  }
  function mdToHtml(src) {
    const lines = esc(src).split("\n");
    let html = "", inList = false, inQuote = false;
    const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
    const closeQuote = () => { if (inQuote) { html += "</blockquote>"; inQuote = false; } };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, "");
      if (/^\s*&gt;\s?/.test(line)) { // 인용( > )
        closeList();
        if (!inQuote) { html += '<blockquote class="askai-q">'; inQuote = true; }
        html += inlineMd(line.replace(/^\s*&gt;\s?/, "")) + "<br/>";
        continue;
      }
      closeQuote();
      const li = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.+)/); // 목록( - * 1. )
      if (li) {
        if (!inList) { html += '<ul class="askai-ul">'; inList = true; }
        html += "<li>" + inlineMd(li[1]) + "</li>";
        continue;
      }
      closeList();
      const h = line.match(/^\s*#{1,6}\s+(.+)/); // 제목( # )
      if (h) { html += '<strong class="askai-h">' + inlineMd(h[1]) + "</strong>"; continue; }
      if (line.trim() === "") { html += "<br/>"; continue; }
      html += inlineMd(line) + "<br/>";
    }
    closeList(); closeQuote();
    return html;
  }

  function addMsg(role, text) {
    thread.hidden = false;
    const el = document.createElement("div");
    el.className = "askai-msg " + (role === "user" ? "me" : "ai");
    const body = role === "user" ? fmt(text) : mdToHtml(text);
    el.innerHTML = `<div class="askai-bubble">${body}</div>`;
    thread.appendChild(el);
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return el;
  }
  function addTyping() {
    thread.hidden = false;
    const el = document.createElement("div");
    el.className = "askai-msg ai";
    el.innerHTML = `<div class="askai-bubble askai-typing"><span></span><span></span><span></span></div>`;
    thread.appendChild(el);
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return el;
  }

  // ── 추천 질문: ①주일 말씀 ②오늘 큐티 ③신앙과 신학 교리 ──
  function group(no, title, items) {
    if (!items.length) return "";
    return (
      '<div class="askai-suggest-group">' +
        '<span class="askai-suggest-label"><span class="askai-grp-no">' + no + "</span>" + esc(title) + "</span>" +
        '<div class="askai-chip-row">' +
          items.map((c) => `<button type="button" class="askai-chip">${esc(c)}</button>`).join("") +
        "</div>" +
      "</div>"
    );
  }

  function buildSuggestions() {
    // ① 주일 말씀 (이번 주 설교 기반)
    const sermon = [];
    try {
      const list = (typeof BULLETINS !== "undefined") ? BULLETINS : (window.BULLETINS || null);
      const b = (list && list[0]) || null;
      if (b) {
        if (b.scripture) sermon.push(`이번 주 본문 「${b.scripture}」은 어떤 내용인가요?`);
        if (b.title) sermon.push(`설교 「${b.title}」을 쉽게 풀어 설명해 주세요`);
        if (b.scripture) sermon.push(`「${b.scripture}」에서 어려운 단어를 풀어 주세요`);
      }
    } catch (e) {}
    if (!sermon.length) sermon.push("이번 주 주일 설교 본문을 쉽게 설명해 주세요");

    // ② 오늘 큐티 (가능하면 오늘 본문 자동 반영)
    const qt = [];
    const qtRef = document.querySelector("#qtToday .qt-card-ref");
    const ref = qtRef && qtRef.textContent.trim();
    if (ref) qt.push(`오늘 QT 「${ref}」은 무슨 뜻인가요?`);
    qt.push("오늘 QT 말씀을 삶에 어떻게 적용할 수 있을까요?");
    qt.push("오늘 본문에서 하나님은 어떤 분으로 나타나나요?");

    // ③ 신앙과 신학 교리
    const doctrine = [
      "개혁주의 신앙이 무엇인지 쉽게 알려주세요",
      "구원은 어떻게 받는 건가요?",
      "하이델베르크 교리문답은 무엇인가요?",
    ];

    suggest.innerHTML =
      '<span class="askai-suggest-head">이런 걸 물어볼 수 있어요</span>' +
      group(1, "주일 말씀", sermon) +
      group(2, "오늘 큐티", qt) +
      group(3, "신앙과 신학 교리", doctrine);
    suggest.querySelectorAll(".askai-chip").forEach((btn) =>
      btn.addEventListener("click", () => { input.value = btn.textContent; ask(); })
    );
  }

  // ※ sb.auth.getSession()은 LockManager 잠금으로 멈출 수 있어 사용 금지.
  //   다른 페이지들과 동일하게 localStorage 토큰을 직접 읽습니다.
  function getToken() {
    try {
      const ref = new URL(window.SUPABASE_URL).hostname.split(".")[0];
      const raw = localStorage.getItem(`sb-${ref}-auth-token`);
      if (!raw) return null;
      const s = JSON.parse(raw);
      const sess = s && s.currentSession ? s.currentSession : s;
      return (sess && sess.access_token) || null;
    } catch (e) { return null; }
  }

  // 이번 주 설교 전문(bulletins.js의 manuscript)을 참고자료로 함께 전송
  function sermonContext() {
    try {
      const list = (typeof BULLETINS !== "undefined") ? BULLETINS : (window.BULLETINS || null);
      const b = list && list[0];
      if (b && b.manuscript) {
        return `[이번 주(${b.dateLabel || ""}) 설교 — ${b.title || ""} / ${b.scripture || ""}]\n${b.manuscript}`;
      }
    } catch (e) {}
    return "";
  }

  async function ask() {
    const msg = (input.value || "").trim();
    if (!msg || busy) return;
    busy = true; sendBtn.disabled = true;
    input.value = "";
    addMsg("user", msg);
    history.push({ role: "user", content: msg });
    const typing = addTyping();

    const token = await getToken();
    if (!token) {
      typing.remove();
      addMsg("ai", "이 기능은 로그인한 교인만 이용할 수 있어요. 우측 상단에서 로그인하신 뒤 다시 물어봐 주세요. 🙏");
      try { document.getElementById("loginBtnInit")?.click(); } catch (e) {}
      busy = false; sendBtn.disabled = false; return;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000); // 60초 지나면 무한 대기 방지
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token,
          "apikey": window.SUPABASE_ANON_KEY || "",
        },
        body: JSON.stringify({ messages: history.slice(-12), context: sermonContext() }),
        signal: ctrl.signal,
      });
      const ct = res.headers.get("content-type") || "";

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        typing.remove();
        addMsg("ai", (data.error || "잠시 후 다시 시도해 주세요.") + (data.detail ? "\n\n🔧 " + data.detail : ""));
      } else if (res.body && ct.includes("text/plain")) {
        // 스트리밍: 한 글자씩 실시간 표시
        typing.remove();
        const el = addMsg("ai", "");
        const bubble = el.querySelector(".askai-bubble");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          bubble.innerHTML = mdToHtml(full);
          el.scrollIntoView({ block: "nearest" });
        }
        full = full.trim();
        if (!full) { bubble.innerHTML = fmt("죄송해요, 답변을 만들지 못했어요. 다시 한 번 물어봐 주세요."); }
        else { history.push({ role: "assistant", content: full }); }
      } else {
        // JSON (위기 안내 / 일일 한도 / 일반 응답)
        const data = await res.json().catch(() => ({}));
        typing.remove();
        addMsg("ai", data.reply || data.error || "잠시 후 다시 시도해 주세요.");
        if (data.reply) history.push({ role: "assistant", content: data.reply });
      }
    } catch (err) {
      typing.remove();
      addMsg("ai", err && err.name === "AbortError"
        ? "응답이 평소보다 오래 걸리고 있어요. 잠시 후 다시 한 번 물어봐 주세요. 🙏"
        : "연결에 문제가 있어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      clearTimeout(timer);
      busy = false; sendBtn.disabled = false; input.focus();
    }
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); ask(); });

  buildSuggestions();
  // 오늘 QT 본문이 비동기로 로드되면 ‘오늘 큐티’ 추천을 한 번 더 갱신
  let qtTries = 0;
  const qtTimer = setInterval(() => {
    qtTries++;
    if (document.querySelector("#qtToday .qt-card-ref")) { buildSuggestions(); clearInterval(qtTimer); }
    else if (qtTries > 12) clearInterval(qtTimer);
  }, 500);

  // Supabase 클라이언트 연결(로그인 여부 확인용)
  if (window.__sb) sb = window.__sb;
  else window.addEventListener("sb-ready", (e) => { sb = (e.detail && e.detail.sb) || window.__sb; }, { once: true });
})();
