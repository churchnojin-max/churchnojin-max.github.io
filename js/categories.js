/* ============================================================
   ○○교회 — 앨범 카테고리 공유 모듈
   window.ChurchCategories
     .DEFAULT           기본 목록(테이블 없거나 비었을 때 폴백)
     .list()            현재 카테고리 배열(동기, 캐시)
     .load()            DB(album_categories)에서 불러와 캐시 → Promise<array>
     .isAdmin()         현재 사용자가 관리자인지 Promise<bool>
     .add(name) / .remove(name)   관리자만(DB 반영 후 캐시 갱신)
     .openManager()     관리자용 카테고리 추가/삭제 모달
   변경 시 window에 'church:categories-changed' 이벤트 발생 → 각 화면 재렌더
   ============================================================ */
window.ChurchCategories = (function () {
  const DEFAULT = [
    "주일 예배", "여름성경학교", "수련회", "지역 섬김", "전 성도 식사", "연합예배",
    "일상", "여행", "맛집", "정보", "취미", "건강", "감사", "축하",
    "반려동물", "문화·나들이", "봉사",
  ];

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

  let cache = null;
  let _admin = null;

  async function isAdmin() {
    if (_admin !== null) return _admin;
    const me = currentUser();
    if (!me || !me.id || !ready()) { _admin = false; return false; }
    try { const r = await api("GET", `admins?uid=eq.${me.id}&select=uid`); _admin = Array.isArray(r) && r.length > 0; }
    catch (e) { _admin = false; }
    return _admin;
  }

  async function load() {
    if (!ready()) { cache = DEFAULT.slice(); return cache; }
    try {
      const rows = await api("GET", "album_categories?select=name&order=sort.asc,name.asc");
      const names = (rows || []).map((r) => r.name).filter(Boolean);
      cache = names.length ? names : DEFAULT.slice();  // 테이블 비었으면 기본
    } catch (e) {
      cache = DEFAULT.slice();  // 테이블 미생성 시 기본
    }
    return cache;
  }
  function list() { return cache || DEFAULT.slice(); }

  function fire() { try { window.dispatchEvent(new CustomEvent("church:categories-changed")); } catch (e) {} }

  async function add(name) {
    name = String(name || "").trim();
    if (!name) return false;
    if (list().indexOf(name) >= 0) return true;   // 이미 있음
    await api("POST", "album_categories", { name, sort: 200 }, { Prefer: "return=minimal" });
    await load(); fire();
    return true;
  }
  async function remove(name) {
    await api("DELETE", `album_categories?name=eq.${encodeURIComponent(name)}`, null, { Prefer: "return=minimal" });
    await load(); fire();
    return true;
  }

  /* ── 관리자 카테고리 관리 모달 ── */
  let mgr = null;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function buildMgr() {
    mgr = document.createElement("div");
    mgr.className = "modal"; mgr.hidden = true;
    mgr.innerHTML = `
      <div class="modal-backdrop" data-catclose></div>
      <div class="modal-box modal-box-cat" role="dialog" aria-modal="true" aria-label="카테고리 관리">
        <button class="modal-close" data-catclose aria-label="닫기">&times;</button>
        <h3 class="m-title">카테고리 관리</h3>
        <p class="cat-note">앨범 사진을 분류하는 카테고리를 추가하거나 삭제할 수 있어요. (관리자 전용)</p>
        <form class="cat-add" id="catAddForm">
          <input type="text" id="catAddInput" maxlength="20" placeholder="새 카테고리 이름" autocomplete="off" />
          <button type="submit" class="btn btn-solid">추가</button>
        </form>
        <div class="cat-list" id="catList"></div>
      </div>`;
    document.body.appendChild(mgr);
    mgr.addEventListener("click", (e) => { if (e.target.hasAttribute("data-catclose")) closeMgr(); });
    mgr.querySelector("#catAddForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const inp = mgr.querySelector("#catAddInput");
      const v = inp.value.trim(); if (!v) return;
      inp.disabled = true;
      try { await add(v); inp.value = ""; renderMgrList(); }
      catch (er) { alert("추가 오류: " + er.message); }
      inp.disabled = false; inp.focus();
    });
  }
  function renderMgrList() {
    const box = mgr.querySelector("#catList");
    box.innerHTML = list().map((c) => `
      <div class="cat-row">
        <span>${esc(c)}</span>
        <button type="button" class="cat-del" data-name="${esc(c)}" aria-label="삭제">삭제</button>
      </div>`).join("");
    box.querySelectorAll(".cat-del").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm(`'${b.dataset.name}' 카테고리를 삭제할까요?\n(이미 이 카테고리로 올린 사진은 그대로 남습니다.)`)) return;
      b.disabled = true;
      try { await remove(b.dataset.name); renderMgrList(); }
      catch (er) { b.disabled = false; alert("삭제 오류: " + er.message); }
    }));
  }
  async function openManager() {
    if (!(await isAdmin())) { alert("카테고리 관리는 관리자만 할 수 있어요."); return; }
    if (!mgr) buildMgr();
    if (!cache) await load();
    renderMgrList();
    mgr.hidden = false; document.body.style.overflow = "hidden";
  }
  function closeMgr() { if (mgr) { mgr.hidden = true; document.body.style.overflow = ""; } }

  // 로그인/로그아웃 시 관리자 캐시 초기화
  window.addEventListener("church:auth", () => { _admin = null; });

  return { DEFAULT, list, load, isAdmin, add, remove, openManager };
})();
