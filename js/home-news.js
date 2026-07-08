/* ============================================================
   ○○교회 — 홈 '우리들 소식'
   - 최신 사진 자동 슬라이드 캐러셀(박스)
   - '소식 더 보기' → 통합 최신 인스타 피드 + 전체화면 뷰어
   - '＋ 사진 올리기' → 업로드 모달(데스크톱 드래그&드롭 / 모바일 파일·카메라),
     제목·날짜 지정 가능(미지정 시 오늘 날짜)
   - 데이터: album_feed(뷰)/album_photos, 좋아요 album_likes, 댓글 album_comments
   ============================================================ */
(function () {
  const box = document.getElementById("hnBox");
  const carEl = document.getElementById("hnCarousel");
  if (!box || !carEl) return;
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    carEl.innerHTML = '<p class="placeholder-note">로그인 기능 연결 후 이용할 수 있습니다.</p>';
    return;
  }

  const cats = () => (window.ChurchCategories ? window.ChurchCategories.list() : []);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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
  const displayName = (u) => (u && u.user_metadata && (u.user_metadata.name || u.user_metadata.full_name)) || (u && u.email ? u.email.split("@")[0] : "성도");
  function openLogin() { const m = document.getElementById("authModal"); if (m) { m.hidden = false; document.body.style.overflow = "hidden"; } }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("서버 응답 지연")), ms))]);
  async function api(method, path, body, extra) {
    const sess = localSession();
    const headers = { apikey: window.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
    if (sess && sess.access_token) headers.Authorization = "Bearer " + sess.access_token;
    if (extra) Object.assign(headers, extra);
    return withTimeout((async () => {
      const res = await fetch(window.SUPABASE_URL + "/rest/v1/" + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const txt = await res.text();
      let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
      if (!res.ok) { const m = (data && (data.message || data.hint || data.error)) || ("HTTP " + res.status); const err = new Error(m); err.status = res.status; throw err; }
      return data;
    })(), 10000);
  }
  // 일시적 네트워크/타임아웃 오류로 소식이 안 뜨는 것을 막기 위해 몇 번 재시도한다.
  async function apiRetry(method, path, tries) {
    var n = tries || 3, last;
    for (var i = 0; i < n; i++) {
      try { return await api(method, path); }
      catch (e) { last = e; if (i < n - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1))); }
    }
    throw last;
  }
  const uploadReady = () => !!(window.ChurchUpload && window.ChurchUpload.isReady());
  const initial = (name) => (String(name || "성").trim()[0] || "성").toUpperCase();

  function fmtDate(p) {
    const d = (p.event_date || (p.created_at || "")).slice(0, 10);
    const m = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}.${m[2]}.${m[3]}` : "";
  }
  function timeAgo(iso) {
    const t = new Date(iso).getTime(); if (isNaN(t)) return "";
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return "방금 전";
    const m = Math.floor(s / 60); if (m < 60) return m + "분 전";
    const h = Math.floor(m / 60); if (h < 24) return h + "시간 전";
    const d = Math.floor(h / 24); if (d < 7) return d + "일 전";
    const dt = new Date(t); return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
  }
  const titleOf = (p) => (p.title && p.title.trim()) || (p.caption && p.caption.trim()) || p.category || "우리들 소식";

  let _isAdmin = null;
  async function isAdminUser() {
    if (_isAdmin !== null) return _isAdmin;
    const me = currentUser();
    if (!me || !me.id) { _isAdmin = false; return false; }
    try { const rows = await api("GET", `admins?uid=eq.${me.id}&select=uid`); _isAdmin = Array.isArray(rows) && rows.length > 0; }
    catch (e) { _isAdmin = false; }
    return _isAdmin;
  }

  let photos = [];            // 최신순
  let social = true;
  let loadError = false;      // true = 불러오기 실패(빈 소식과 구분) → 재시도 안내 표시
  let _autoReloads = 0;       // 실패 시 자동 재시도 횟수(무한루프 방지)
  const myLikes = new Set();
  const commentCache = {};
  const photoById = (id) => photos.find((p) => String(p.id) === String(id));

  async function load() {
    if (window.ChurchCategories) { try { await window.ChurchCategories.load(); } catch (e) {} }
    loadError = false;
    try {
      photos = await apiRetry("GET", "album_feed?select=*&order=created_at.desc&limit=40") || [];
      social = true;
    } catch (e) {
      social = false;
      try { photos = await apiRetry("GET", "album_photos?select=*&order=created_at.desc&limit=40") || []; }
      catch (e2) { photos = []; loadError = true; }   // 두 경로 모두 실패 = 진짜 오류(소식 없음과 구분)
      photos = photos.map((p) => ({ ...p, like_count: 0, comment_count: 0 }));
    }
    myLikes.clear();
    const me = currentUser();
    if (social && me && me.id && photos.length) {
      try { (await api("GET", `album_likes?user_id=eq.${me.id}&select=photo_id`) || []).forEach((r) => myLikes.add(String(r.photo_id))); }
      catch (e) { /* 좋아요 테이블 없음 */ }
    }
    renderCarousel();
    renderActions();
    // 불러오기 실패 시 잠시 뒤 자동으로 한두 번 더 시도(일시적 오류 자가 복구). 성공하면 카운터 초기화.
    if (loadError) { if (_autoReloads < 2) { _autoReloads++; setTimeout(load, 2500); } }
    else { _autoReloads = 0; }
  }

  /* ===================== 캐러셀 ===================== */
  let slides = [], curSlide = 0, timer = null;
  function renderCarousel() {
    if (loadError) {   // 불러오기 실패 → '소식 없음'과 헷갈리지 않게 오류+다시 시도 안내
      stop();
      carEl.innerHTML = `<div class="hn-empty"><span>⚠️</span><p>소식을 불러오지 못했어요.<br>잠시 후 다시 시도해 주세요.</p><button type="button" class="hn-retry" style="margin-top:14px;padding:9px 22px;border:0;background:#2f5d3a;color:#fff;border-radius:999px;font-weight:700;cursor:pointer">🔄 다시 불러오기</button></div>`;
      const rb = carEl.querySelector(".hn-retry");
      if (rb) rb.addEventListener("click", () => { rb.textContent = "불러오는 중…"; rb.disabled = true; _autoReloads = 0; load(); });
      return;
    }
    slides = photos.slice(0, 10);
    if (!slides.length) {
      carEl.innerHTML = `<div class="hn-empty"><span>📷</span><p>아직 올라온 소식이 없어요.${currentUser() ? " 첫 사진을 올려보세요!" : " 로그인 후 올릴 수 있어요."}</p></div>`;
      return;
    }
    carEl.innerHTML = `
      <div class="hn-track">${slides.map((p, i) => `
        <figure class="hn-slide${i === 0 ? " on" : ""}" data-idx="${i}">
          <img src="${esc(p.url)}" alt="${esc(titleOf(p))}" loading="${i === 0 ? "eager" : "lazy"}" draggable="false" />
          <figcaption class="hn-cap">
            <b>${esc(titleOf(p))}</b>
            <span>${esc(fmtDate(p))}${p.category && titleOf(p) !== p.category ? " · " + esc(p.category) : ""}</span>
          </figcaption>
        </figure>`).join("")}</div>
      <button type="button" class="hn-arrow hn-a-prev" aria-label="이전">‹</button>
      <button type="button" class="hn-arrow hn-a-next" aria-label="다음">›</button>
      <div class="hn-dots">${slides.map((_, i) => `<span class="hn-dot${i === 0 ? " on" : ""}" data-idx="${i}"></span>`).join("")}</div>`;
    curSlide = 0;
    carEl.querySelector(".hn-a-prev").addEventListener("click", (e) => { e.stopPropagation(); go(curSlide - 1); rearm(); });
    carEl.querySelector(".hn-a-next").addEventListener("click", (e) => { e.stopPropagation(); go(curSlide + 1); rearm(); });
    carEl.querySelectorAll(".hn-dot").forEach((d) => d.addEventListener("click", (e) => { e.stopPropagation(); go(Number(d.dataset.idx)); rearm(); }));
    carEl.querySelectorAll(".hn-slide").forEach((s) => s.addEventListener("click", () => openViewer(slides, Number(s.dataset.idx))));
    // 스와이프(모바일)
    let sx = null;
    carEl.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
    carEl.addEventListener("touchend", (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 45) { go(curSlide + (dx < 0 ? 1 : -1)); rearm(); } sx = null; });
    carEl.addEventListener("mouseenter", stop);
    carEl.addEventListener("mouseleave", rearm);
    rearm();
  }
  function go(n) {
    if (!slides.length) return;
    curSlide = (n + slides.length) % slides.length;
    carEl.querySelectorAll(".hn-slide").forEach((s, i) => s.classList.toggle("on", i === curSlide));
    carEl.querySelectorAll(".hn-dot").forEach((d, i) => d.classList.toggle("on", i === curSlide));
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function rearm() { stop(); if (slides.length > 1) timer = setInterval(() => go(curSlide + 1), 3800); }

  /* ===================== 액션 버튼(＋) ===================== */
  function renderActions() {
    const addBtn = document.getElementById("hnAdd");
    if (!addBtn) return;
    const show = !!currentUser() && uploadReady();
    addBtn.hidden = !show;
  }

  /* ===================== 좋아요 / 댓글 ===================== */
  async function toggleLike(p) {
    const me = currentUser();
    if (!me) { alert("좋아요를 누르려면 로그인해 주세요."); openLogin(); return null; }
    if (!social) return null;
    const id = String(p.id), liked = myLikes.has(id);
    if (liked) { myLikes.delete(id); p.like_count = Math.max(0, (p.like_count || 0) - 1); }
    else { myLikes.add(id); p.like_count = (p.like_count || 0) + 1; }
    try {
      if (liked) await api("DELETE", `album_likes?photo_id=eq.${p.id}&user_id=eq.${me.id}`, null, { Prefer: "return=minimal" });
      else await api("POST", "album_likes", { photo_id: p.id, user_id: me.id }, { Prefer: "resolution=merge-duplicates,return=minimal" });
    } catch (e) {
      if (liked) { myLikes.add(id); p.like_count = (p.like_count || 0) + 1; }
      else { myLikes.delete(id); p.like_count = Math.max(0, (p.like_count || 0) - 1); }
      alert("좋아요 오류: " + e.message);
    }
    return myLikes.has(id);
  }
  async function loadComments(id) {
    if (!social) return [];
    if (commentCache[id]) return commentCache[id];
    try { commentCache[id] = await api("GET", `album_comments?photo_id=eq.${id}&order=created_at.asc&select=*`) || []; }
    catch (e) { commentCache[id] = []; }
    return commentCache[id];
  }
  async function addComment(id, body) {
    const me = currentUser();
    if (!me) { alert("댓글을 쓰려면 로그인해 주세요."); openLogin(); return null; }
    const text = String(body || "").trim(); if (!text) return null;
    const row = { photo_id: id, user_id: me.id, author_name: displayName(me), body: text };
    try {
      const saved = await api("POST", "album_comments", row, { Prefer: "return=representation" });
      const c = Array.isArray(saved) ? saved[0] : saved;
      (commentCache[id] = commentCache[id] || []).push(c || { ...row, created_at: new Date().toISOString() });
      const p = photoById(id); if (p) p.comment_count = (p.comment_count || 0) + 1;
      return c;
    } catch (e) { alert("댓글 오류: " + e.message); return null; }
  }

  /* ===================== 더보기: 인스타 피드 모달 ===================== */
  const heartSvg = (f) => `<svg viewBox="0 0 24 24" class="ig-ic${f ? " liked" : ""}" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="${f ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  const bubbleSvg = `<svg viewBox="0 0 24 24" class="ig-ic" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

  let feedModal = null, feedList = null;
  function buildFeedModal() {
    feedModal = document.createElement("div");
    feedModal.className = "modal";
    feedModal.hidden = true;
    feedModal.innerHTML = `
      <div class="modal-backdrop" data-close></div>
      <div class="modal-box modal-box-album" role="dialog" aria-modal="true" aria-label="우리들 소식">
        <button class="modal-close" data-close aria-label="닫기">&times;</button>
        <h3 class="m-title">우리들 소식</h3>
        <div class="album-feed" id="hnFeed"></div>
      </div>`;
    document.body.appendChild(feedModal);
    feedList = feedModal.querySelector("#hnFeed");
    feedModal.addEventListener("click", (e) => { if (e.target.hasAttribute("data-close")) closeFeed(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && feedModal && !feedModal.hidden && viewer.hidden) closeFeed(); });
  }
  function closeFeedDom() { if (feedModal) { feedModal.hidden = true; if (viewer.hidden) document.body.style.overflow = ""; } }
  function closeFeed() { if (window.ModalNav && window.ModalNav.close()) return; closeFeedDom(); }

  let feedAdmin = false;
  async function openFeed() {
    const wasOpen = feedModal && !feedModal.hidden;
    if (!feedModal) buildFeedModal();
    feedAdmin = await isAdminUser();
    if (loadError) {
      feedList.className = "album-feed empty";
      feedList.innerHTML = `<p class="placeholder-note">소식을 불러오지 못했어요. <button type="button" class="hn-retry2" style="margin-left:6px;padding:5px 14px;border:0;background:#2f5d3a;color:#fff;border-radius:999px;font-weight:600;cursor:pointer">🔄 다시</button></p>`;
      const rb = feedList.querySelector(".hn-retry2");
      if (rb) rb.addEventListener("click", async () => { rb.textContent = "…"; rb.disabled = true; _autoReloads = 0; await load(); openFeed(); });
    } else if (!photos.length) {
      feedList.className = "album-feed empty";
      feedList.innerHTML = `<p class="placeholder-note">아직 올라온 소식이 없어요.</p>`;
    } else {
      feedList.className = "album-feed";
      feedList.innerHTML = photos.map((p, i) => cardHtml(p, i)).join("");
      photos.forEach((p) => loadComments(p.id).then(() => refreshComments(p.id)));
      wireFeed();
    }
    feedModal.hidden = false; document.body.style.overflow = "hidden";
    if (!wasOpen && window.ModalNav) window.ModalNav.open(closeFeedDom);
  }

  function cardHtml(p, i) {
    const liked = myLikes.has(String(p.id));
    const me = currentUser();
    const mine = !!(me && p.user_id && me.id === p.user_id);
    const canDel = mine || feedAdmin;
    return `<article class="ig-card" data-id="${p.id}" data-idx="${i}">
      <header class="ig-head">
        <span class="ig-avatar">${esc(initial(p.author_name))}</span>
        <div class="ig-who"><b>${esc(p.author_name || "성도")}</b><span>${esc(fmtDate(p))} · ${esc(timeAgo(p.created_at))}</span></div>
        ${(mine || canDel) ? `<span style="margin-left:auto;display:inline-flex;gap:2px">${mine ? `<button type="button" class="ig-menu" data-act="editphoto" title="수정" style="margin-left:0;color:var(--accent,#223350)">수정</button>` : ""}${canDel ? `<button type="button" class="ig-menu" data-act="delphoto" title="삭제" style="margin-left:0">삭제</button>` : ""}</span>` : ""}
      </header>
      <div class="ig-media" data-act="open" data-idx="${i}" role="button" tabindex="0" aria-label="사진 크게 보기">
        <img src="${esc(p.url)}" alt="${esc(titleOf(p))}" loading="lazy" draggable="false" />
      </div>
      <div class="ig-actions">
        <button type="button" class="ig-btn ig-like${liked ? " on" : ""}" data-act="like" aria-pressed="${liked}" aria-label="좋아요">${heartSvg(liked)}</button>
        <button type="button" class="ig-btn" data-act="focuscmt" aria-label="댓글">${bubbleSvg}</button>
      </div>
      <div class="ig-likecount" data-role="likecount">${(p.like_count || 0) > 0 ? `좋아요 ${p.like_count}개` : "가장 먼저 좋아요를 눌러보세요"}</div>
      ${(p.title && p.title.trim()) ? `<div class="ig-caption"><b>${esc(p.author_name || "성도")}</b> ${esc(p.title)}</div>` : ""}
      ${(p.caption && p.caption.trim()) ? `<div class="ig-caption">${esc(p.caption)}</div>` : ""}
      <div class="ig-comments" data-role="comments"></div>
      ${social ? `<form class="ig-addcmt" data-role="addcmt"><input type="text" name="c" maxlength="500" placeholder="따뜻한 댓글 달기…" autocomplete="off" /><button type="submit">게시</button></form>` : ""}
    </article>`;
  }
  function commentLineHtml(c) {
    const me = currentUser();
    const canDel = (me && me.id === c.user_id) || feedAdmin;
    return `<div class="ig-cmt" data-cid="${c.id || ""}"><b>${esc(c.author_name || "성도")}</b> ${esc(c.body)}${canDel && c.id ? ` <button type="button" class="ig-cmt-del" data-act="delcmt" data-cid="${c.id}" aria-label="삭제">×</button>` : ""}</div>`;
  }
  function refreshComments(id) {
    const card = feedList.querySelector(`.ig-card[data-id="${id}"]`); if (!card) return;
    const boxc = card.querySelector('[data-role="comments"]');
    const list = commentCache[id] || [];
    const p = photoById(id);
    const total = p ? (p.comment_count || list.length) : list.length;
    const shown = list.slice(-2);
    let html = "";
    if (total > shown.length) html += `<button type="button" class="ig-morecmt" data-act="allcmt">댓글 ${total}개 모두 보기</button>`;
    html += shown.map(commentLineHtml).join("");
    boxc.innerHTML = html;
  }
  function syncLike(card, p) {
    const liked = myLikes.has(String(p.id));
    const btn = card.querySelector('[data-act="like"]');
    if (btn) { btn.classList.toggle("on", liked); btn.setAttribute("aria-pressed", liked); btn.innerHTML = heartSvg(liked); }
    const lc = card.querySelector('[data-role="likecount"]');
    if (lc) lc.textContent = (p.like_count || 0) > 0 ? `좋아요 ${p.like_count}개` : "가장 먼저 좋아요를 눌러보세요";
  }
  function wireFeed() {
    feedList.querySelectorAll(".ig-card").forEach((card) => {
      const id = card.getAttribute("data-id");
      const p = photoById(id); if (!p) return;
      card.querySelectorAll('[data-act="open"]').forEach((m) => {
        m.addEventListener("click", () => openViewer(photos, Number(card.getAttribute("data-idx"))));
        m.addEventListener("keydown", (e) => { if (e.key === "Enter") openViewer(photos, Number(card.getAttribute("data-idx"))); });
      });
      const likeBtn = card.querySelector('[data-act="like"]');
      if (likeBtn) likeBtn.addEventListener("click", async () => { const r = await toggleLike(p); if (r !== null) syncLike(card, p); });
      const focusBtn = card.querySelector('[data-act="focuscmt"]');
      if (focusBtn) focusBtn.addEventListener("click", () => { const inp = card.querySelector(".ig-addcmt input"); if (inp) inp.focus(); });
      const delPhoto = card.querySelector('[data-act="delphoto"]');
      if (delPhoto) delPhoto.addEventListener("click", () => removePhoto(p));
      const editPhoto = card.querySelector('[data-act="editphoto"]');
      if (editPhoto) editPhoto.addEventListener("click", () => openEdit(p));
      const form = card.querySelector('[data-role="addcmt"]');
      if (form) form.addEventListener("submit", async (e) => { e.preventDefault(); const inp = form.querySelector("input"); const v = inp.value; inp.value = ""; if (await addComment(id, v)) refreshComments(id); });
      const cbox = card.querySelector('[data-role="comments"]');
      if (cbox) cbox.addEventListener("click", async (e) => {
        if (e.target.closest('[data-act="allcmt"]')) { cbox.innerHTML = (commentCache[id] || []).map(commentLineHtml).join(""); return; }
        const del = e.target.closest('[data-act="delcmt"]');
        if (del && confirm("이 댓글을 삭제할까요?")) { try { await api("DELETE", `album_comments?id=eq.${del.dataset.cid}`, null, { Prefer: "return=minimal" }); commentCache[id] = (commentCache[id] || []).filter((c) => String(c.id) !== String(del.dataset.cid)); const pp = photoById(id); if (pp) pp.comment_count = Math.max(0, (pp.comment_count || 0) - 1); refreshComments(id); } catch (er) { alert("삭제 오류: " + er.message); } }
      });
    });
  }
  async function removePhoto(p) {
    if (!confirm("이 사진을 삭제할까요?")) return;
    try {
      await api("DELETE", `album_photos?id=eq.${p.id}`, null, { Prefer: "return=minimal" });
      if (p.key && window.ChurchUpload) window.ChurchUpload.remove(p.key);
    } catch (e) { alert("삭제 오류: " + e.message); return; }
    await load();
    if (feedModal && !feedModal.hidden) openFeed();
  }

  /* ===================== 소식 수정 모달 (본인 글만) ===================== */
  let editModal = null, editingPhoto = null;
  function buildEditModal() {
    editModal = document.createElement("div");
    editModal.className = "modal"; editModal.hidden = true;
    editModal.innerHTML = `
      <div class="modal-backdrop" data-edclose></div>
      <div class="modal-box modal-box-upload" role="dialog" aria-modal="true" aria-label="소식 수정">
        <button class="modal-close" data-edclose aria-label="닫기">&times;</button>
        <h3 class="m-title">소식 수정</h3>
        <div class="up-fields">
          <label class="up-f"><span>제목 <em>(선택)</em></span><input type="text" id="edTitle" maxlength="60" placeholder="예: 여름성경학교 첫째 날" /></label>
          <div class="up-row">
            <label class="up-f"><span>날짜</span><input type="date" id="edDate" /></label>
            <label class="up-f"><span>카테고리</span><select id="edCat"></select></label>
          </div>
          <label class="up-f"><span>한 줄 소식 <em>(선택)</em></span><textarea id="edCap" rows="2" maxlength="300" placeholder="어떤 순간인가요?"></textarea></label>
        </div>
        <button type="button" class="btn btn-solid up-go" id="edGo">저장</button>
        <div class="up-status" id="edStatus" hidden></div>
      </div>`;
    document.body.appendChild(editModal);
    editModal.addEventListener("click", (e) => { if (e.target.hasAttribute("data-edclose")) closeEdit(); });
    editModal.querySelector("#edGo").addEventListener("click", saveEdit);
  }
  function closeEdit() { if (editModal) editModal.hidden = true; document.body.style.overflow = ""; editingPhoto = null; }
  function openEdit(p) {
    const me = currentUser();
    if (!me || me.id !== p.user_id) { alert("본인이 올린 소식만 수정할 수 있어요."); return; }
    if (!editModal) buildEditModal();
    editingPhoto = p;
    const catSel = editModal.querySelector("#edCat"), list = cats();
    catSel.innerHTML = list.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    if (p.category && list.indexOf(p.category) < 0) catSel.insertAdjacentHTML("afterbegin", `<option value="${esc(p.category)}">${esc(p.category)}</option>`);
    catSel.value = p.category || list[0] || "";
    editModal.querySelector("#edTitle").value = p.title || "";
    editModal.querySelector("#edCap").value = p.caption || "";
    editModal.querySelector("#edDate").value = String(p.event_date || "").slice(0, 10) || todayISO();
    const st = editModal.querySelector("#edStatus"); st.hidden = true; st.textContent = "";
    editModal.querySelector("#edGo").disabled = false;
    editModal.hidden = false; document.body.style.overflow = "hidden";
  }
  async function saveEdit() {
    if (!editingPhoto) return;
    const p = editingPhoto;
    const title = (editModal.querySelector("#edTitle").value || "").trim();
    const cap = (editModal.querySelector("#edCap").value || "").trim();
    const cat = editModal.querySelector("#edCat").value;
    const date = editModal.querySelector("#edDate").value || null;
    const go = editModal.querySelector("#edGo"), st = editModal.querySelector("#edStatus");
    go.disabled = true; st.hidden = false; st.textContent = "저장 중…";
    const patch = (payload) => api("PATCH", `album_photos?id=eq.${p.id}`, payload, { Prefer: "return=representation" });
    try {
      let rows;
      try { rows = await patch({ title: title || null, caption: cap || null, category: cat || null, event_date: date }); }
      catch (colErr) { if (/column|event_date|title|schema cache/i.test(colErr.message)) rows = await patch({ caption: cap || null, category: cat || null }); else throw colErr; }
      if (!rows || !rows.length) {
        st.textContent = ""; go.disabled = false;
        alert("수정이 저장되지 않았습니다.\n관리자는 Supabase ▸ SQL Editor 에서 supabase/album_edit.sql 을 1회 실행해 '본인 글 수정' 권한을 켜 주세요.");
        return;
      }
    } catch (e) { st.textContent = ""; go.disabled = false; alert("수정 오류: " + e.message); return; }
    closeEdit();
    await load();
    if (feedModal && !feedModal.hidden) openFeed();
  }

  /* ===================== 전체화면 뷰어 ===================== */
  const viewer = document.createElement("div");
  viewer.className = "ig-viewer"; viewer.hidden = true;
  viewer.innerHTML = `
    <button type="button" class="igv-close" aria-label="닫기">&times;</button>
    <button type="button" class="igv-nav igv-prev" aria-label="이전">‹</button>
    <button type="button" class="igv-nav igv-next" aria-label="다음">›</button>
    <div class="igv-stage" data-role="stage"></div>
    <div class="igv-bottom">
      <div class="igv-acts"><button type="button" class="igv-like" data-act="like" aria-label="좋아요"></button><span class="igv-likecount" data-role="vlike"></span></div>
      <div class="igv-cap" data-role="vcap"></div>
      <div class="igv-dots" data-role="dots"></div>
    </div>`;
  document.body.appendChild(viewer);
  const vStage = viewer.querySelector('[data-role="stage"]');
  let vList = [], vIdx = 0;
  function openViewer(list, idx) { vList = list; vIdx = idx || 0; renderViewer(); viewer.hidden = false; document.body.style.overflow = "hidden"; if (window.ModalNav) window.ModalNav.open(closeViewerDom); }
  function closeViewerDom() { viewer.hidden = true; if (!feedModal || feedModal.hidden) document.body.style.overflow = ""; else document.body.style.overflow = "hidden"; }
  function closeViewer() { if (window.ModalNav && window.ModalNav.close()) return; closeViewerDom(); }
  function renderViewer() {
    const p = vList[vIdx]; if (!p) return;
    vStage.innerHTML = `<img src="${esc(p.url)}" alt="${esc(titleOf(p))}" draggable="false" /><span class="igv-heartburst" aria-hidden="true">${heartSvg(true)}</span>`;
    const liked = myLikes.has(String(p.id));
    const lb = viewer.querySelector('[data-act="like"]'); lb.innerHTML = heartSvg(liked); lb.classList.toggle("on", liked);
    viewer.querySelector('[data-role="vlike"]').textContent = (p.like_count || 0) > 0 ? `좋아요 ${p.like_count}개` : "";
    viewer.querySelector('[data-role="vcap"]').innerHTML = `<b>${esc(titleOf(p))}</b> <span class="igv-date">${esc(fmtDate(p))}</span>` + (p.caption && p.caption.trim() ? `<br>${esc(p.caption)}` : "");
    viewer.querySelector('[data-role="dots"]').innerHTML = vList.length > 1 ? vList.map((_, i) => `<span class="igv-dot${i === vIdx ? " on" : ""}"></span>`).join("") : "";
    viewer.querySelector(".igv-prev").style.visibility = vIdx > 0 ? "visible" : "hidden";
    viewer.querySelector(".igv-next").style.visibility = vIdx < vList.length - 1 ? "visible" : "hidden";
  }
  function vGo(d) { const n = vIdx + d; if (n < 0 || n >= vList.length) return; vIdx = n; renderViewer(); }
  async function vLike() {
    const p = vList[vIdx]; if (!p) return;
    const r = await toggleLike(p); if (r === null) return;
    renderViewer();
    if (feedList) { const card = feedList.querySelector(`.ig-card[data-id="${p.id}"]`); if (card) syncLike(card, p); }
  }
  function heartBurst() { const b = vStage.querySelector(".igv-heartburst"); if (!b) return; b.classList.remove("go"); void b.offsetWidth; b.classList.add("go"); }
  viewer.querySelector(".igv-close").addEventListener("click", closeViewer);
  viewer.querySelector(".igv-prev").addEventListener("click", () => vGo(-1));
  viewer.querySelector(".igv-next").addEventListener("click", () => vGo(1));
  viewer.querySelector('[data-act="like"]').addEventListener("click", vLike);
  viewer.addEventListener("click", (e) => { if (e.target === viewer) closeViewer(); });
  document.addEventListener("keydown", (e) => { if (viewer.hidden) return; if (e.key === "Escape") closeViewer(); else if (e.key === "ArrowLeft") vGo(-1); else if (e.key === "ArrowRight") vGo(1); });
  let lastTap = 0, tX = null, tY = null, drag = false;
  vStage.addEventListener("click", () => { const now = Date.now(); if (now - lastTap < 300) { if (!myLikes.has(String(vList[vIdx].id))) vLike(); heartBurst(); lastTap = 0; } else lastTap = now; });
  vStage.addEventListener("touchstart", (e) => { if (e.touches.length !== 1) return; tX = e.touches[0].clientX; tY = e.touches[0].clientY; drag = true; }, { passive: true });
  vStage.addEventListener("touchmove", (e) => { if (!drag) return; const dx = e.touches[0].clientX - tX, dy = e.touches[0].clientY - tY; if (Math.abs(dx) > Math.abs(dy)) { const img = vStage.querySelector("img"); if (img) img.style.transform = `translateX(${dx}px)`; } }, { passive: true });
  vStage.addEventListener("touchend", (e) => { if (!drag) return; drag = false; const dx = e.changedTouches[0].clientX - tX; const img = vStage.querySelector("img"); if (img) img.style.transform = ""; if (Math.abs(dx) > 60) vGo(dx < 0 ? 1 : -1); tX = tY = null; });

  /* ===================== 업로드 모달(＋) ===================== */
  let upModal = null;
  function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
  function buildUpModal() {
    upModal = document.createElement("div");
    upModal.className = "modal"; upModal.hidden = true;
    upModal.innerHTML = `
      <div class="modal-backdrop" data-upclose></div>
      <div class="modal-box modal-box-upload" role="dialog" aria-modal="true" aria-label="사진 올리기">
        <button class="modal-close" data-upclose aria-label="닫기">&times;</button>
        <h3 class="m-title">사진 올리기</h3>
        <div class="up-drop" id="upDrop">
          <div class="up-drop-in">
            <span class="up-drop-ic">🖼️</span>
            <p class="up-drop-t">여기로 사진을 끌어다 놓거나</p>
            <button type="button" class="btn btn-solid up-pick" id="upPick">사진 선택</button>
            <button type="button" class="btn btn-line up-cam" id="upCam" style="margin-top:8px">📷 카메라로 찍기</button>
            <p class="up-drop-s">여러 장을 한 번에 올릴 수 있어요</p>
          </div>
          <input type="file" id="upInput" accept="image/*" multiple hidden />
          <input type="file" id="upCamera" accept="image/*" capture="environment" hidden />
        </div>
        <div class="up-thumbs" id="upThumbs"></div>
        <div class="up-fields">
          <label class="up-f"><span>제목 <em>(선택)</em></span><input type="text" id="upTitle" maxlength="60" placeholder="예: 여름성경학교 첫째 날" /></label>
          <div class="up-row">
            <label class="up-f"><span>날짜</span><input type="date" id="upDate" /></label>
            <label class="up-f"><span>카테고리 <button type="button" class="up-catmgr" id="upCatManage" hidden>＋ 카테고리 관리</button></span><select id="upCat">${cats().map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}</select></label>
          </div>
          <label class="up-f"><span>한 줄 소식 <em>(선택)</em></span><textarea id="upCap" rows="2" maxlength="300" placeholder="어떤 순간인가요?"></textarea></label>
        </div>
        <button type="button" class="btn btn-solid up-go" id="upGo" disabled>올리기</button>
        <div class="up-status" id="upStatus" hidden></div>
      </div>`;
    document.body.appendChild(upModal);
    upModal.addEventListener("click", (e) => { if (e.target.hasAttribute("data-upclose")) closeUp(); });

    // 관리자용 카테고리 관리 버튼 + 카테고리 변경 시 select 갱신
    const catMgrBtn = upModal.querySelector("#upCatManage");
    if (catMgrBtn && window.ChurchCategories) {
      window.ChurchCategories.isAdmin().then((ok) => { if (ok) catMgrBtn.hidden = false; });
      catMgrBtn.addEventListener("click", () => window.ChurchCategories.openManager());
    }
    function rebuildCatSelect() {
      const sel = upModal.querySelector("#upCat"); if (!sel) return;
      const cur = sel.value;
      sel.innerHTML = cats().map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
      if (cats().indexOf(cur) >= 0) sel.value = cur;
    }
    window.addEventListener("church:categories-changed", rebuildCatSelect);

    const drop = upModal.querySelector("#upDrop");
    const input = upModal.querySelector("#upInput");
    const thumbs = upModal.querySelector("#upThumbs");
    const goBtn = upModal.querySelector("#upGo");
    let picked = [];

    function refreshThumbs() {
      thumbs.innerHTML = picked.map((f, i) => `<div class="up-th"><img src="${URL.createObjectURL(f)}" alt="" /><button type="button" class="up-th-x" data-i="${i}" aria-label="제거">×</button></div>`).join("");
      thumbs.querySelectorAll(".up-th-x").forEach((b) => b.addEventListener("click", () => { picked.splice(Number(b.dataset.i), 1); refreshThumbs(); }));
      goBtn.disabled = picked.length === 0;
    }
    function addFiles(fl) {
      const imgs = Array.from(fl || []).filter((f) => /^image\//.test(f.type));
      if (!imgs.length) { if (fl && fl.length) alert("이미지 파일만 올릴 수 있습니다."); return; }
      picked = picked.concat(imgs); refreshThumbs();
    }
    upModal._reset = function () { picked = []; thumbs.innerHTML = ""; goBtn.disabled = true; upModal.querySelector("#upTitle").value = ""; upModal.querySelector("#upCap").value = ""; upModal.querySelector("#upDate").value = todayISO(); upModal.querySelector("#upStatus").hidden = true; upModal.querySelector("#upStatus").textContent = ""; goBtn.disabled = true; };

    upModal.querySelector("#upPick").addEventListener("click", () => input.click());
    drop.addEventListener("click", (e) => { if (e.target === drop || e.target.closest(".up-drop-in") && !e.target.closest("button")) input.click(); });
    input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });
    // 📷 카메라로 찍기 — 기기가 capture를 무시하고 갤러리로 새는 문제 대응:
    // 웹 자체 카메라(getUserMedia)를 팝업으로 띄워 실제 촬영. (미지원 기기는 capture 입력으로 폴백)
    const camInput = upModal.querySelector("#upCamera");
    camInput.addEventListener("change", () => { addFiles(camInput.files); camInput.value = ""; });
    let camStream = null, camFacing = "environment", camPop = null, camVideo = null;
    function stopCamStream() { if (camStream) { camStream.getTracks().forEach((t) => t.stop()); camStream = null; } }
    function closeCamera() { stopCamStream(); if (camPop) camPop.style.display = "none"; }
    async function startCam() {
      stopCamStream();
      try {
        camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: camFacing } }, audio: false });
        camVideo.srcObject = camStream;
      } catch (e) { closeCamera(); alert("카메라를 열 수 없습니다: " + ((e && e.name) || e) + "\n브라우저에서 카메라 권한을 허용하거나, ‘사진 선택’으로 갤러리에서 올려 주세요."); }
    }
    function shootPhoto() {
      if (!camVideo || !camVideo.videoWidth) return;
      const c = document.createElement("canvas"); c.width = camVideo.videoWidth; c.height = camVideo.videoHeight;
      c.getContext("2d").drawImage(camVideo, 0, 0);
      c.toBlob((blob) => { if (blob) addFiles([new File([blob], "photo-" + Date.now() + ".jpg", { type: "image/jpeg" })]); closeCamera(); }, "image/jpeg", 0.92);
    }
    function buildCamPop() {
      camPop = document.createElement("div");
      camPop.style.cssText = "position:fixed;inset:0;z-index:12000;background:#000;display:none;flex-direction:column;align-items:center;justify-content:center";
      camPop.innerHTML =
        '<video playsinline autoplay muted style="max-width:100%;max-height:100%;object-fit:contain"></video>' +
        '<button type="button" data-cam="close" aria-label="닫기" style="position:absolute;top:16px;right:16px;width:46px;height:46px;border:0;border-radius:50%;background:rgba(255,255,255,.22);color:#fff;font-size:1.4rem;cursor:pointer">✕</button>' +
        '<button type="button" data-cam="flip" aria-label="앞뒤 전환" style="position:absolute;top:16px;left:16px;width:46px;height:46px;border:0;border-radius:50%;background:rgba(255,255,255,.22);color:#fff;font-size:1.2rem;cursor:pointer">🔄</button>' +
        '<button type="button" data-cam="shoot" aria-label="촬영" style="position:absolute;bottom:34px;left:50%;transform:translateX(-50%);width:76px;height:76px;border:5px solid #fff;border-radius:50%;background:rgba(255,255,255,.35);cursor:pointer"></button>';
      document.body.appendChild(camPop);
      camVideo = camPop.querySelector("video");
      camPop.addEventListener("click", (e) => {
        const act = e.target.getAttribute("data-cam");
        if (act === "close") closeCamera();
        else if (act === "flip") { camFacing = camFacing === "environment" ? "user" : "environment"; startCam(); }
        else if (act === "shoot") shootPhoto();
      });
    }
    function openCamera() {
      if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { camInput.click(); return; }  // 미지원 → capture 폴백
      if (!camPop) buildCamPop();
      camPop.style.display = "flex";
      startCam();
    }
    upModal.querySelector("#upCam").addEventListener("click", openCamera);
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); if (ev === "dragleave" && drop.contains(e.relatedTarget)) return; drop.classList.remove("drag"); }));
    drop.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });

    goBtn.addEventListener("click", async () => {
      const me = currentUser();
      if (!me) { alert("사진을 올리려면 로그인해 주세요."); openLogin(); return; }
      if (!uploadReady()) { alert("업로드 서버가 아직 설정되지 않았습니다."); return; }
      if (!picked.length) return;
      const title = (upModal.querySelector("#upTitle").value || "").trim();
      const cap = (upModal.querySelector("#upCap").value || "").trim();
      const cat = upModal.querySelector("#upCat").value;
      const date = upModal.querySelector("#upDate").value || todayISO();
      const status = upModal.querySelector("#upStatus");
      goBtn.disabled = true; status.hidden = false;
      for (let i = 0; i < picked.length; i++) {
        status.textContent = `올리는 중… ${i + 1}/${picked.length}`;
        try {
          const r = await window.ChurchUpload.upload(picked[i], { folder: "album" });
          const base = { category: cat, url: r.url, key: r.key, caption: cap || null, user_id: me.id, author_name: displayName(me) };
          try {
            await api("POST", "album_photos", Object.assign({ title: title || null, event_date: date }, base), { Prefer: "return=minimal" });
          } catch (colErr) {
            // title/event_date 컬럼 미생성(album-social.sql 미실행) 시 제목·날짜 없이 업로드
            if (/column|event_date|title|schema cache/i.test(colErr.message)) await api("POST", "album_photos", base, { Prefer: "return=minimal" });
            else throw colErr;
          }
        } catch (e) { status.textContent = ""; goBtn.disabled = false; alert("업로드 오류: " + e.message); return; }
      }
      closeUp();
      await load();
    });
  }
  function openUp() {
    const me = currentUser();
    if (!me) { alert("사진을 올리려면 로그인해 주세요."); openLogin(); return; }
    if (!uploadReady()) { alert("업로드 서버가 아직 설정되지 않았습니다."); return; }
    if (!upModal) buildUpModal();
    upModal._reset();
    upModal.hidden = false; document.body.style.overflow = "hidden";
  }
  function closeUp() { if (upModal) { upModal.hidden = true; document.body.style.overflow = ""; } }

  /* ===================== 배선 ===================== */
  document.getElementById("hnMore").addEventListener("click", openFeed);
  const addBtn = document.getElementById("hnAdd");
  if (addBtn) addBtn.addEventListener("click", openUp);

  load();
  window.addEventListener("church:auth", () => { _isAdmin = null; load(); });
})();
