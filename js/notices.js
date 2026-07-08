/* ============================================================
   ○○교회 — 공지사항(notices)
   window.ChurchNotices.mount(containerId, { compact, limit })
     compact: true  → 홈용(제목·날짜만 간단히, '전체 보기' 링크)
     compact: false → community용(제목·본문 전체)
   - 누구나 조회 / 작성·수정·삭제는 관리자(admins 테이블)만
   - 데이터: public.notices  (supabase/notices-categories.sql)
   ============================================================ */
window.ChurchNotices = (function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nl2br = (s) => esc(s).replace(/\n/g, "<br>");

  function ready() { return !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY); }
  function localSession() {
    try {
      const ref = new URL(window.SUPABASE_URL).hostname.split(".")[0];
      const raw = localStorage.getItem(`sb-${ref}-auth-token`);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.currentSession ? s.currentSession : s;
    } catch (e) { return null; }
  }
  const currentUser = () => { const s = localSession(); return (s && s.user) || null; };
  const displayName = (u) => (u && u.user_metadata && (u.user_metadata.name || u.user_metadata.full_name)) || (u && u.email ? u.email.split("@")[0] : "관리자");
  async function api(method, path, body, extra) {
    const sess = localSession();
    const headers = { apikey: window.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
    if (sess && sess.access_token) headers.Authorization = "Bearer " + sess.access_token;
    if (extra) Object.assign(headers, extra);
    const res = await fetch(window.SUPABASE_URL + "/rest/v1/" + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const txt = await res.text();
    let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
    if (!res.ok) { const m = (data && (data.message || data.error)) || ("HTTP " + res.status); const e = new Error(m); e.status = res.status; throw e; }
    return data;
  }
  let _admin = null;
  async function isAdmin() {
    if (_admin !== null) return _admin;
    const me = currentUser();
    if (!me || !me.id || !ready()) { _admin = false; return false; }
    try { const r = await api("GET", `admins?uid=eq.${me.id}&select=uid`); _admin = Array.isArray(r) && r.length > 0; }
    catch (e) { _admin = false; }
    return _admin;
  }
  function fmtDate(iso) {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}.${m[2]}.${m[3]}` : "";
  }

  let notices = [];
  let loaded = false;
  const mounts = [];   // [{el, compact, limit}]

  async function fetchAll() {
    if (!ready()) { notices = []; return; }
    try { notices = await api("GET", "notices?select=*&order=pinned.desc,created_at.desc&limit=100") || []; loaded = true; }
    catch (e) { notices = []; loaded = true; }  // 테이블 미생성 등 → 빈 목록
  }

  function renderInto(m, admin) {
    const el = m.el; if (!el) return;
    const list = m.compact ? notices.slice(0, m.limit || 3) : notices;
    // 홈(compact): 공지가 없고 관리자도 아니면 섹션 자체를 숨김(빈 섹션 방지)
    if (m.compact) {
      const sec = el.closest("section");
      if (sec) sec.style.display = (loaded && !notices.length && !admin) ? "none" : "";
    }
    let html = "";
    if (admin) html += `<div class="nt-adminbar"><button type="button" class="btn btn-solid nt-write">＋ 공지 작성</button></div>`;
    if (!list.length) {
      html += `<p class="nt-empty">${loaded ? "등록된 공지사항이 없습니다." : "불러오는 중…"}</p>`;
    } else {
      html += `<div class="nt-list">` + list.map((n) => noticeHtml(n, m.compact, admin)).join("") + `</div>`;
      if (m.compact && notices.length > list.length) html += `<a class="nt-more" href="story.html#notice">공지 전체 보기 →</a>`;
    }
    el.innerHTML = html;

    const wbtn = el.querySelector(".nt-write");
    if (wbtn) wbtn.addEventListener("click", openCompose);
    el.querySelectorAll(".nt-del").forEach((b) => b.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("이 공지를 삭제할까요?")) return;
      b.disabled = true;
      try { await api("DELETE", `notices?id=eq.${b.dataset.id}`, null, { Prefer: "return=minimal" }); await refresh(); }
      catch (er) { b.disabled = false; alert("삭제 오류: " + er.message); }
    }));
    el.querySelectorAll(".nt-edit").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const n = notices.find((x) => String(x.id) === String(b.dataset.id));
      if (n) openEdit(n);
    }));
    // 공지 클릭 → 그 자리에서 본문 펼치기/접기 (페이지 이동 없음)
    el.querySelectorAll(".nt-toggle").forEach((t) => t.addEventListener("click", () => {
      const card = t.closest(".nt-item"); if (!card) return;
      const body = card.querySelector(".nt-body");
      if (body) { body.hidden = !body.hidden; card.classList.toggle("open", !body.hidden); }
    }));
  }

  function noticeHtml(n, compact, admin) {
    const pin = n.pinned ? `<span class="nt-pin">📌 고정</span>` : "";
    const del = admin ? `<button type="button" class="nt-del" data-id="${n.id}" aria-label="삭제">삭제</button>` : "";
    const edit = admin ? `<button type="button" class="nt-edit" data-id="${n.id}" aria-label="수정">수정</button>` : "";
    const hasBody = n.body && n.body.trim();
    if (compact) {
      return `<div class="nt-item nt-compact${n.pinned ? " pinned" : ""}">
        <button type="button" class="nt-toggle">
          <span class="nt-t">${pin}${esc(n.title)}</span>
          <span class="nt-d">${esc(fmtDate(n.created_at))}${hasBody ? ` <span class="nt-caret" aria-hidden="true">▾</span>` : ""}</span>
        </button>
        ${hasBody ? `<div class="nt-body" hidden>${nl2br(n.body)}</div>` : ""}
        ${admin ? `<div class="nt-adminrow">${edit}${del}</div>` : ""}
      </div>`;
    }
    return `<article class="nt-item${n.pinned ? " pinned" : ""}">
      <header class="nt-head">
        <h4 class="nt-t">${pin}${esc(n.title)}</h4>
        <div class="nt-meta"><span>${esc(n.author_name || "관리자")}</span><span>${esc(fmtDate(n.created_at))}</span>${edit}${del}</div>
      </header>
      ${hasBody ? `<div class="nt-body">${nl2br(n.body)}</div>` : ""}
    </article>`;
  }

  async function refresh() {
    await fetchAll();
    const admin = await isAdmin();
    mounts.forEach((m) => renderInto(m, admin));
  }

  /* ── 공지 작성/수정 모달(관리자) ── */
  let composeM = null;
  let editingId = null;
  function buildCompose() {
    composeM = document.createElement("div");
    composeM.className = "modal"; composeM.hidden = true;
    composeM.innerHTML = `
      <div class="modal-backdrop" data-ntclose></div>
      <div class="modal-box modal-box-notice" role="dialog" aria-modal="true" aria-label="공지 작성">
        <button class="modal-close" data-ntclose aria-label="닫기">&times;</button>
        <h3 class="m-title">공지 작성</h3>
        <form id="ntForm" class="nt-form">
          <label class="nt-f"><span>제목</span><input type="text" id="ntTitle" maxlength="200" required placeholder="공지 제목" /></label>
          <label class="nt-f"><span>내용</span><textarea id="ntBody" rows="6" placeholder="공지 내용을 입력하세요"></textarea></label>
          <label class="nt-check"><input type="checkbox" id="ntPin" /> <span>맨 위 고정</span></label>
          <button type="submit" class="btn btn-solid nt-submit">등록</button>
          <div class="nt-status" id="ntStatus" hidden></div>
        </form>
      </div>`;
    document.body.appendChild(composeM);
    composeM.addEventListener("click", (e) => { if (e.target.hasAttribute("data-ntclose")) closeCompose(); });
    composeM.querySelector("#ntForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const me = currentUser();
      if (!me) { alert("로그인이 필요합니다."); return; }
      const title = composeM.querySelector("#ntTitle").value.trim();
      const body = composeM.querySelector("#ntBody").value;
      const pinned = composeM.querySelector("#ntPin").checked;
      if (!title) return;
      const st = composeM.querySelector("#ntStatus"); const btn = composeM.querySelector(".nt-submit");
      btn.disabled = true; st.hidden = false; st.textContent = editingId ? "수정 중…" : "등록 중…";
      try {
        if (editingId) {
          await api("PATCH", `notices?id=eq.${editingId}`, { title, body, pinned }, { Prefer: "return=minimal" });
        } else {
          await api("POST", "notices", { title, body, pinned, user_id: me.id, author_name: displayName(me) }, { Prefer: "return=minimal" });
        }
        closeCompose();
        await refresh();
      } catch (er) { st.textContent = ""; btn.disabled = false; alert("공지 저장 오류: " + er.message); }
      btn.disabled = false;
    });
  }
  function fillCompose(n) {
    composeM.querySelector("#ntTitle").value = n ? (n.title || "") : "";
    composeM.querySelector("#ntBody").value = n ? (n.body || "") : "";
    composeM.querySelector("#ntPin").checked = n ? !!n.pinned : false;
    composeM.querySelector(".m-title").textContent = n ? "공지 수정" : "공지 작성";
    composeM.querySelector(".nt-submit").textContent = n ? "수정 저장" : "등록";
    composeM.querySelector(".nt-submit").disabled = false;
    const st = composeM.querySelector("#ntStatus"); st.hidden = true; st.textContent = "";
  }
  async function openCompose() {
    if (!(await isAdmin())) { alert("공지는 관리자만 작성할 수 있어요."); return; }
    if (!composeM) buildCompose();
    editingId = null; fillCompose(null);
    composeM.hidden = false; document.body.style.overflow = "hidden";
    composeM.querySelector("#ntTitle").focus();
  }
  async function openEdit(n) {
    if (!(await isAdmin())) { alert("공지는 관리자만 수정할 수 있어요."); return; }
    if (!composeM) buildCompose();
    editingId = n.id; fillCompose(n);
    composeM.hidden = false; document.body.style.overflow = "hidden";
    composeM.querySelector("#ntTitle").focus();
  }
  function closeCompose() { if (composeM) { composeM.hidden = true; document.body.style.overflow = ""; editingId = null; } }

  function mount(containerId, opts) {
    const el = document.getElementById(containerId);
    if (!el) return;
    opts = opts || {};
    mounts.push({ el, compact: !!opts.compact, limit: opts.limit });
    if (!loaded) refresh(); else isAdmin().then((admin) => renderInto(mounts[mounts.length - 1], admin));
  }

  window.addEventListener("church:auth", () => { _admin = null; refresh(); });

  // 페이지에 표준 컨테이너가 있으면 자동 마운트
  if (document.getElementById("homeNoticeBox")) mount("homeNoticeBox", { compact: true, limit: 3 });
  if (document.getElementById("communityNoticeBox")) mount("communityNoticeBox", { compact: false });

  return { mount, refresh };
})();
