/* ============================================================
   ○○교회 — 홈 '우리들 소식'
   - 최신 사진 자동 슬라이드 캐러셀(박스)
   - '소식 더 보기' → 통합 최신 인스타 피드 + 전체화면 뷰어
   - '＋ 사진 올리기' → 업로드 모달(데스크톱 드래그&드롭 / 모바일 파일·카메라),
     제목·날짜 지정 가능(미지정 시 오늘 날짜). 날짜 상자의 '사진 수정하기'도 같은 창(더하기·지우기·고치기)
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
      const raw = sessionStorage.getItem(`sb-${ref}-auth-token`);
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
  // 제목 앞에 붙은 날짜('5월31일 …', '2026.5.31 …')는 날짜 칸에 이미 나오므로 떼고 보여 준다
  const noDate = (t) => String(t || "").trim().replace(/^(?:(?:\d{4}\s*년\s*)?\d{1,2}\s*월\s*\d{1,2}\s*일|(?:\d{4}\s*[.\-/]\s*)?\d{1,2}\s*[.\-/]\s*\d{1,2}\.?(?=\s))\s*/, "").trim();
  const titleOf = (p) => noDate(p.title) || noDate(p.caption) || p.category || "우리들 소식";
  // 날짜 상자와 '사진 수정하기' 창이 같은 날을 가리키게: 정한 날짜(event_date), 없으면 올린 날
  const dayOf = (p) => String(p.event_date || p.created_at || "").slice(0, 10);
  const dayLabel = (d) => { const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${+m[2]}월 ${+m[3]}일` : String(d || ""); };

  // 남의 사진도 고치고 지울 수 있는 분: 관리자, 또는 '게시판' 권한(공지·앨범·나눔터 관리)이 있는 분(2026-10-04)
  let _isAdmin = null;
  async function isAdminUser() {
    if (_isAdmin !== null) return _isAdmin;
    const me = currentUser();
    if (!me || !me.id) { _isAdmin = false; return false; }
    try {
      const p = await api("POST", "rpc/my_perms", {});
      _isAdmin = !!(p && (p.isAdmin || p.canBoard));
    } catch (e) {
      try { const rows = await api("GET", `admins?uid=eq.${me.id}&select=uid`); _isAdmin = Array.isArray(rows) && rows.length > 0; }
      catch (e2) { _isAdmin = false; }
    }
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
    // 우리들 소식 사진에는 성도님 얼굴이 담겨 있어 가입하고 로그인한 분께만(2026-10-05 목사님, supabase/member_only_20261005.sql)
    if (!currentUser()) { photos = []; renderLocked(); renderActions(); return; }
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
  function renderLocked() {
    stop();
    carEl.classList.remove("hn-days");
    carEl.innerHTML = `<div class="hn-empty hn-locked"><span>🔒</span><p>우리들 소식 사진에는 성도님들의 얼굴이 담겨 있어<br />가입하고 로그인하신 분께만 보여 드립니다.</p><div class="member-only-btns"><button type="button" class="btn btn-solid" data-mo="join">가입하기</button><button type="button" class="btn btn-line" data-mo="login">로그인</button></div></div>`;
  }
  function renderCarousel() {
    if (loadError) {   // 불러오기 실패 → '소식 없음'과 헷갈리지 않게 오류+다시 시도 안내
      stop();
      carEl.innerHTML = `<div class="hn-empty"><span>⚠️</span><p>소식을 불러오지 못했어요.<br>잠시 후 다시 시도해 주세요.</p><button type="button" class="hn-retry" style="margin-top:14px;padding:9px 22px;border:0;background:#2f5d3a;color:#fff;border-radius:999px;font-weight:700;cursor:pointer">🔄 다시 불러오기</button></div>`;
      const rb = carEl.querySelector(".hn-retry");
      if (rb) rb.addEventListener("click", () => { rb.textContent = "불러오는 중…"; rb.disabled = true; _autoReloads = 0; load(); });
      return;
    }
    // 2026-10-01: 옆으로 넘기는 사진 대신 '날짜별 상자'로 — 같은 날 올린 사진을 한 상자에 묶는다.
    stop();
    const groups = [];
    photos.forEach((p) => {
      const key = fmtDate(p) || "날짜 없음";
      let g = groups.find((x) => x.key === key);
      if (!g) { g = { key, list: [] }; groups.push(g); }
      g.list.push(p);
    });
    groups.sort((x, y) => (x.key < y.key ? 1 : -1));
    slides = groups.slice(0, 4);
    if (!slides.length) {
      carEl.innerHTML = `<div class="hn-empty"><span>📷</span><p>아직 올라온 소식이 없어요.${currentUser() ? " 첫 사진을 올려보세요!" : " 로그인 후 올릴 수 있어요."}</p></div>`;
      return;
    }
    carEl.classList.add("hn-days");
    carEl.innerHTML = slides.map((g, i) => {
      const p = g.list[0];
      const m = g.key.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
      const dayLabel = m ? `${+m[2]}월 ${+m[3]}일` : g.key;
      const cap = (noDate(p.caption) && noDate(p.caption) !== titleOf(p)) ? noDate(p.caption) : "";
      return `
        <button type="button" class="hn-day" data-g="${i}">
          <span class="hn-day-img"><img src="${esc(p.url)}" alt="${esc(titleOf(p))}" loading="lazy" draggable="false" />
            ${g.list.length > 1 ? `<em class="hn-day-count">사진 ${g.list.length}장</em>` : ""}</span>
          <span class="hn-day-text">
            <span class="hn-day-date">${esc(dayLabel)}${m ? ` <small>${m[1]}</small>` : ""}</span>
            <b>${esc(titleOf(p))}</b>
            ${cap ? `<span class="hn-day-cap">${esc(cap)}</span>` : ""}
            ${p.category && titleOf(p) !== p.category ? `<span class="hn-day-cat">${esc(p.category)}</span>` : ""}
          </span>
        </button>`;
    }).join("");
    carEl.querySelectorAll(".hn-day").forEach((el) => el.addEventListener("click", () => {
      const g = slides[Number(el.dataset.g)];
      openViewer(g.list, 0, /^\d{4}\.\d{2}\.\d{2}$/.test(g.key) ? g.key.replace(/\./g, "-") : null);
    }));
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
    const more = document.getElementById("hnMore");
    if (more) more.hidden = !currentUser();               // 로그인하지 않은 분께는 '소식 더 보기'도 숨김
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
    const canEdit = !!(me && p.user_id && me.id === p.user_id) || feedAdmin;   // 올린 본인·관리자·게시판 담당
    return `<article class="ig-card" data-id="${p.id}" data-idx="${i}">
      <header class="ig-head">
        <span class="ig-avatar">${esc(initial(p.author_name))}</span>
        <div class="ig-who"><b>${esc(p.author_name || "성도")}</b><span>${esc(fmtDate(p))} · ${esc(timeAgo(p.created_at))}</span></div>
        ${canEdit ? `<span style="margin-left:auto;display:inline-flex;gap:2px"><button type="button" class="ig-menu" data-act="editphoto" title="이 날 사진 수정하기" style="margin-left:0;color:var(--accent,#1A3A2F)">수정</button><button type="button" class="ig-menu" data-act="delphoto" title="삭제" style="margin-left:0">삭제</button></span>` : ""}
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
      if (editPhoto) editPhoto.addEventListener("click", () => openDay(dayOf(p), p.id));   // 그 날 사진을 고치는 창(사진 올리기와 같은 창)
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
      // 허락이 없으면 오류 없이 0장이 지워지므로, 지워진 줄을 돌려받아 확인한다
      const gone = await api("DELETE", `album_photos?id=eq.${p.id}`, null, { Prefer: "return=representation" });
      if (!Array.isArray(gone) || !gone.length) throw new Error("지울 권한이 없습니다. (올린 분·관리자·게시판 담당만 지울 수 있어요)");
      if (p.key && window.ChurchUpload) window.ChurchUpload.remove(p.key);
    } catch (e) { alert("삭제 오류: " + e.message); return; }
    await load();
    if (feedModal && !feedModal.hidden) openFeed();
  }

  /* ===================== 전체화면 뷰어 ===================== */
  const viewer = document.createElement("div");
  viewer.className = "ig-viewer"; viewer.hidden = true;
  viewer.innerHTML = `
    <button type="button" class="igv-close" aria-label="닫기">&times;</button>
    <button type="button" class="igv-edit" hidden>✎ 사진 수정하기</button>
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
  let vList = [], vIdx = 0, vDay = null;
  // day: 날짜 상자에서 열었으면 그 날(YYYY-MM-DD) — 올린 본인·관리자·게시판 담당에게 '사진 수정하기'를 보여 준다
  function openViewer(list, idx, day) {
    vList = list; vIdx = idx || 0; vDay = day || null;
    renderViewer(); viewer.hidden = false; document.body.style.overflow = "hidden";
    if (window.ModalNav) window.ModalNav.open(closeViewerDom);
    const eb = viewer.querySelector(".igv-edit"), me = currentUser();
    eb.hidden = true;
    if (vDay && me) isAdminUser().then((mgr) => { if (!viewer.hidden && vDay === day) eb.hidden = !(mgr || list.some((p) => p.user_id === me.id)); });
  }
  // 크게 보기를 닫고 '뒤로 가기' 기록까지 정리된 뒤에 다음 창을 연다(바로 열면 뒤로 가기가 새 창을 닫아 버린다)
  function afterViewerClosed(fn) {
    if (!(window.ModalNav && window.ModalNav.count && window.ModalNav.count())) { closeViewerDom(); fn(); return; }
    let done = false;
    const go = () => { if (done) return; done = true; window.removeEventListener("popstate", go); if (!viewer.hidden) closeViewerDom(); setTimeout(fn, 0); };
    window.addEventListener("popstate", go);
    setTimeout(go, 700);
    closeViewer();
  }
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
  viewer.querySelector(".igv-edit").addEventListener("click", () => { const d = vDay; if (d) afterViewerClosed(() => openDay(d)); });
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

  /* ===================== 사진 올리기 · 고치기 (한 창) =====================
     2026-10-04 목사님: "소식 더 보기에 있던 수정·삭제를 올리기 쪽으로 통합"
     · '＋ 사진 올리기' — 새 사진을 올린다. 고른 날에 이미 올린 사진이 있으면 함께 보여 주고, 빨간 × 로 지울 수 있다.
     · 날짜 상자를 열어 '사진 수정하기'(소식 더 보기의 '수정'도 같은 창) — 그 날 사진을 고친다:
         × 로 지우기 · 사진 더하기 · 제목/카테고리/한 줄 소식(바꾼 칸만 그 날 사진 모두에) ·
         날짜를 바꾸면 그 날 사진이 모두 그 날짜로 옮겨진다.
     · 남의 사진을 지우고 고치는 것은 관리자·'게시판' 담당만(album_photos RLS, supabase/board_and_one_account_20261004.sql).
  ===================== */
  let upModal = null;
  let upMode = "new";        // "new" = 새 사진 올리기, "day" = 그 날 사진 고치기
  let upDay0 = "";           // 고치러 들어온 날(날짜를 바꾸면 그 날 사진을 옮긴다)
  let upOld = [];            // 고른 날에 이미 올린 사진
  let upInit = { title: "", caption: "", category: "" };   // 처음 채운 값 — 바꾼 칸만 고친다
  let upAuto = {};           // 새 사진 올리기: 그 날 소식에서 자동으로 채운 칸
  let upCatTouched = false;
  let upFocus = null;        // 소식 더 보기에서 '수정'을 누른 사진
  let upChanged = false;     // 지우거나 올렸으면 창을 닫을 때 소식을 새로 읽는다
  let upSeq = 0;             // 날짜를 빨리 바꿀 때 늦게 온 응답은 버린다
  let picked = [];           // 새로 올릴 사진(File)
  let pickedUrls = [];
  const upQ = (id) => upModal.querySelector("#" + id);
  const canEditPhoto = (p) => { const me = currentUser(); return !!(me && (me.id === p.user_id || _isAdmin === true)); };
  function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
  function nextDay(d) { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); }
  // 그 날 사진 모두(첫 화면이 읽는 최신 40장 밖의 사진까지). 날짜를 안 정한 옛 사진은 올린 날로 본다(dayOf 와 같게).
  async function fetchDay(d) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return [];
    const q = `?select=*&or=(event_date.eq.${d},and(event_date.is.null,created_at.gte.${d},created_at.lt.${nextDay(d)}))&order=created_at.desc`;
    try { return (await api("GET", "album_feed" + q)) || []; }
    catch (e) {
      try { return (await api("GET", "album_photos" + q)) || []; }
      catch (e2) { return photos.filter((p) => dayOf(p) === d); }
    }
  }

  function buildUpModal() {
    upModal = document.createElement("div");
    upModal.className = "modal up-modal"; upModal.hidden = true;
    upModal.innerHTML = `
      <div class="modal-backdrop" data-upclose></div>
      <div class="modal-box modal-box-upload" role="dialog" aria-modal="true" aria-labelledby="upHead">
        <button class="modal-close" data-upclose aria-label="닫기">&times;</button>
        <h3 class="m-title" id="upHead">사진 올리기</h3>
        <p class="up-sub" id="upSub" hidden></p>
        <div class="up-old" id="upOldBox" hidden>
          <p class="up-old-h" id="upOldH"></p>
          <div class="up-thumbs" id="upOld"></div>
        </div>
        <div class="up-drop" id="upDrop">
          <div class="up-drop-in">
            <span class="up-drop-ic">🖼️</span>
            <p class="up-drop-t" id="upDropT">여기로 사진을 끌어다 놓거나</p>
            <button type="button" class="btn btn-solid up-pick" id="upPick">사진 선택</button>
            <button type="button" class="btn btn-line up-cam" id="upCam" style="margin-top:8px">📷 카메라로 찍기</button>
            <p class="up-drop-s">여러 장을 한 번에 올릴 수 있어요</p>
          </div>
          <input type="file" id="upInput" accept="image/*" multiple hidden />
          <input type="file" id="upCamera" accept="image/*" capture="environment" hidden />
        </div>
        <p class="up-old-h up-new-h" id="upNewH" hidden></p>
        <div class="up-thumbs" id="upThumbs"></div>
        <div class="up-fields">
          <label class="up-f"><span>제목 <em>(선택)</em></span><input type="text" id="upTitle" maxlength="60" placeholder="예: 여름성경학교 첫째 날" /></label>
          <p class="up-note" id="upTitleNote" hidden>이 날 사진들의 제목이 서로 달라요. 제목을 고치면 모두 같은 제목이 됩니다.</p>
          <div class="up-row">
            <label class="up-f"><span>날짜</span><input type="date" id="upDate" /></label>
            <label class="up-f"><span>카테고리 <button type="button" class="up-catmgr" id="upCatManage" hidden>＋ 카테고리 관리</button></span><select id="upCat"></select></label>
          </div>
          <p class="up-note" id="upDateNote" hidden></p>
          <label class="up-f"><span>한 줄 소식 <em>(선택)</em></span><textarea id="upCap" rows="2" maxlength="300" placeholder="어떤 순간인가요?"></textarea></label>
        </div>
        <button type="button" class="btn btn-solid up-go" id="upGo" disabled>올리기</button>
        <div class="up-status" id="upStatus" hidden></div>
      </div>`;
    document.body.appendChild(upModal);
    upModal.addEventListener("click", (e) => { if (e.target.hasAttribute("data-upclose")) closeUp(); });

    // 관리자·게시판 담당용 카테고리 관리 버튼 + 카테고리 변경 시 select 갱신
    const catMgrBtn = upQ("upCatManage");
    if (catMgrBtn && window.ChurchCategories) {
      window.ChurchCategories.isAdmin().then((ok) => { if (ok) catMgrBtn.hidden = false; });
      catMgrBtn.addEventListener("click", () => window.ChurchCategories.openManager());
    }
    window.addEventListener("church:categories-changed", () => {
      const sel = upQ("upCat"), cur = sel.value;
      sel.innerHTML = cats().map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
      if (cur) setCat(cur);
    });

    const drop = upQ("upDrop");
    const input = upQ("upInput");
    function addFiles(fl) {
      const imgs = Array.from(fl || []).filter((f) => /^image\//.test(f.type));
      if (!imgs.length) { if (fl && fl.length) alert("이미지 파일만 올릴 수 있습니다."); return; }
      picked = picked.concat(imgs); refreshThumbs();
    }
    upQ("upPick").addEventListener("click", () => input.click());
    drop.addEventListener("click", (e) => { if (e.target === drop || e.target.closest(".up-drop-in") && !e.target.closest("button")) input.click(); });
    input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });
    // 📷 카메라로 찍기 — 기기가 capture를 무시하고 갤러리로 새는 문제 대응:
    // 웹 자체 카메라(getUserMedia)를 팝업으로 띄워 실제 촬영. (미지원 기기는 capture 입력으로 폴백)
    const camInput = upQ("upCamera");
    camInput.addEventListener("change", () => { addFiles(camInput.files); camInput.value = ""; });
    let camStream = null, camFacing = "environment", camPop = null, camVideo = null;
    function stopCamStream() { if (camStream) { camStream.getTracks().forEach((t) => t.stop()); camStream = null; } }
    function closeCamera() { stopCamStream(); if (camPop) camPop.style.display = "none"; }
    upModal._closeCamera = closeCamera;
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
    upQ("upCam").addEventListener("click", openCamera);
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); if (ev === "dragleave" && drop.contains(e.relatedTarget)) return; drop.classList.remove("drag"); }));
    drop.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });

    upQ("upOld").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (b) delOld(b.getAttribute("data-del")); });
    upQ("upThumbs").addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) { picked.splice(Number(b.getAttribute("data-i")), 1); refreshThumbs(); } });
    // 새 사진 올리기: 날짜를 고르면 그 날 이미 올린 사진을 보여 준다 / 그 날 사진 고치기: 날짜를 바꾸면 저장할 때 옮긴다
    upQ("upDate").addEventListener("change", () => { if (upMode === "day") refreshGo(); else loadOld(upQ("upDate").value, false); });
    upQ("upTitle").addEventListener("input", () => { upAuto.upTitle = false; });
    upQ("upCap").addEventListener("input", () => { upAuto.upCap = false; });
    upQ("upCat").addEventListener("change", () => { upCatTouched = true; });
    upQ("upGo").addEventListener("click", saveUp);
  }

  function setCat(c) {
    const sel = upQ("upCat");
    if (c && !Array.from(sel.options).some((o) => o.value === c)) sel.insertAdjacentHTML("afterbegin", `<option value="${esc(c)}">${esc(c)}</option>`);
    sel.value = c || "";
  }
  // 새 사진 올리기: 그 날 소식의 제목·한 줄 소식·카테고리를 빈 칸에 채워 둔다(손으로 쓴 칸은 그대로)
  function autofill(src) {
    [["upTitle", "title"], ["upCap", "caption"]].forEach(([id, k]) => {
      const el = upQ(id);
      if (el.value.trim() && !upAuto[id]) return;
      el.value = (src && src[k]) || "";
      upAuto[id] = !!el.value;
    });
    if (!upCatTouched) setCat((src && src.category) || cats()[0] || "");
  }
  function oldThumb(p) {
    const ok = canEditPhoto(p);
    const focus = upFocus && String(p.id) === String(upFocus);
    return `<div class="up-th${ok ? "" : " up-th-lock"}${focus ? " up-th-focus" : ""}" data-id="${p.id}">
      <img src="${esc(p.url)}" alt="" loading="lazy" />
      ${ok ? `<button type="button" class="up-th-x" data-del="${p.id}" aria-label="이 사진 지우기" title="지우기">×</button>` : ""}
    </div>`;
  }
  function renderOld() {
    const box = upQ("upOldBox"), grid = upQ("upOld");
    if (!upOld.length) { box.hidden = true; grid.innerHTML = ""; return; }
    box.hidden = false;
    const nDel = upOld.filter(canEditPhoto).length;
    const lead = upMode === "day" ? `이 날 올린 사진 ${upOld.length}장` : `${dayLabel(upQ("upDate").value)}에 이미 올린 사진 ${upOld.length}장`;
    const tail = upMode === "day" ? (nDel ? " — 지울 사진은 빨간 × 를 누르세요" : "") : " — 새 사진은 여기에 더해져요" + (nDel ? " · 지우려면 ×" : "");
    upQ("upOldH").innerHTML = `<b>${esc(lead)}</b>${esc(tail)}`;
    grid.innerHTML = upOld.map(oldThumb).join("");
    const f = grid.querySelector(".up-th-focus");
    if (f) setTimeout(() => { try { f.scrollIntoView({ block: "nearest" }); } catch (e) {} }, 80);
  }
  function refreshThumbs() {
    pickedUrls.forEach((u) => URL.revokeObjectURL(u));
    pickedUrls = picked.map((f) => URL.createObjectURL(f));
    upQ("upThumbs").innerHTML = picked.map((f, i) => `<div class="up-th up-th-new"><img src="${pickedUrls[i]}" alt="" /><button type="button" class="up-th-x" data-i="${i}" aria-label="빼기" title="빼기">×</button></div>`).join("");
    const h = upQ("upNewH");
    h.hidden = !picked.length;
    h.innerHTML = picked.length ? `<b>새로 올릴 사진 ${picked.length}장</b>` : "";
    refreshGo();
  }
  function refreshGo() {
    const go = upQ("upGo"), n = picked.length;
    if (upMode === "day") { go.disabled = false; go.textContent = n ? `저장하기 (새 사진 ${n}장 올리기)` : "저장하기"; }
    else { go.disabled = n === 0; go.textContent = n ? `사진 ${n}장 올리기` : "올리기"; }
    const note = upQ("upDateNote"), d = upQ("upDate").value, mv = upOld.filter(canEditPhoto).length;
    if (upMode === "day" && d && d !== upDay0 && mv) {
      const stay = upOld.length - mv;
      note.hidden = false;
      note.textContent = `저장하면 이 날 사진 ${mv}장이 ${dayLabel(d)}로 옮겨집니다.` + (stay ? ` (다른 분이 올린 ${stay}장은 그대로 남아요)` : "");
    } else note.hidden = true;
  }
  async function loadOld(d, editing) {
    const seq = ++upSeq;
    if (editing) { upQ("upOldBox").hidden = false; upQ("upOldH").textContent = "사진을 불러오는 중…"; upQ("upOld").innerHTML = ""; upQ("upGo").disabled = true; }
    const list = await fetchDay(d);
    if (seq !== upSeq || !upModal || upModal.hidden) return;
    upOld = list;
    const cover = list[0] || null;
    if (editing) {
      upQ("upTitle").value = (cover && cover.title) || "";
      upQ("upCap").value = (cover && cover.caption) || "";
      setCat((cover && cover.category) || cats()[0] || "");
      upInit = { title: upQ("upTitle").value.trim(), caption: upQ("upCap").value.trim(), category: upQ("upCat").value };
      upQ("upTitleNote").hidden = new Set(list.map((p) => String(p.title || "").trim())).size < 2;
    } else autofill(cover);
    renderOld(); refreshGo();
  }
  async function delOld(id) {
    const p = upOld.find((x) => String(x.id) === String(id));
    if (!p || !canEditPhoto(p)) return;
    if (!confirm("이 사진을 지울까요?\n지우면 되돌릴 수 없어요.")) return;
    const th = upQ("upOld").querySelector(`.up-th[data-id="${p.id}"]`);
    if (th) th.classList.add("up-th-busy");
    try {
      const gone = await api("DELETE", `album_photos?id=eq.${p.id}`, null, { Prefer: "return=representation" });
      if (!Array.isArray(gone) || !gone.length) throw new Error("지울 권한이 없어요. (올린 분·관리자·게시판 담당만 지울 수 있어요)");
    } catch (e) { if (th) th.classList.remove("up-th-busy"); alert("지우기 오류: " + e.message); return; }
    if (p.key && window.ChurchUpload) window.ChurchUpload.remove(p.key);
    upOld = upOld.filter((x) => x !== p);
    upChanged = true;
    renderOld(); refreshGo();
  }
  async function saveUp() {
    const me = currentUser();
    if (!me) { alert("로그인해 주세요."); openLogin(); return; }
    if (upMode === "new" && !picked.length) return;
    if (picked.length && !uploadReady()) { alert("업로드 서버가 아직 설정되지 않았습니다."); return; }
    const title = upQ("upTitle").value.trim(), cap = upQ("upCap").value.trim(), cat = upQ("upCat").value;
    const date = upQ("upDate").value || todayISO();
    const go = upQ("upGo"), st = upQ("upStatus");
    go.disabled = true; st.hidden = false;
    // 1) 새 사진 올리기
    for (let i = 0; i < picked.length; i++) {
      st.textContent = `올리는 중… ${i + 1}/${picked.length}`;
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
        upChanged = true;
      } catch (e) {
        picked = picked.slice(i); refreshThumbs();         // 올라간 사진은 빼고 남은 것만 다시 올리게
        st.textContent = ""; st.hidden = true;
        alert("업로드 오류: " + e.message + (i ? `\n(${i}장은 올라갔어요. 남은 사진은 다시 눌러 올려 주세요.)` : ""));
        return;
      }
    }
    // 2) 그 날 사진 고치기 — 바꾼 칸만, 고칠 수 있는 사진만
    if (upMode === "day") {
      const patch = {};
      if (title !== upInit.title) patch.title = title || null;
      if (cap !== upInit.caption) patch.caption = cap || null;
      if (cat && cat !== upInit.category) patch.category = cat;
      if (date !== upDay0) patch.event_date = date;
      const ids = upOld.filter(canEditPhoto).map((p) => p.id);
      if (ids.length && Object.keys(patch).length) {
        st.textContent = "고치는 중…";
        try {
          const rows = await api("PATCH", `album_photos?id=in.(${ids.join(",")})`, patch, { Prefer: "return=representation" });
          const n = Array.isArray(rows) ? rows.length : 0;
          if (n) upChanged = true;
          if (n < ids.length) alert(n ? `${ids.length}장 가운데 ${n}장만 고쳐졌어요. (고칠 권한이 없는 사진은 그대로예요)` : "고칠 권한이 없어 바뀌지 않았어요.");
        } catch (e) { st.textContent = ""; st.hidden = true; refreshGo(); alert("고치기 오류: " + e.message); return; }
      }
    }
    picked = []; refreshThumbs();
    closeUp();
  }

  function resetUp() {
    picked = []; refreshThumbs();
    upOld = []; upInit = { title: "", caption: "", category: "" }; upAuto = {}; upCatTouched = false; upChanged = false; upSeq++;
    const day = upMode === "day";
    upQ("upTitle").value = ""; upQ("upCap").value = "";
    upQ("upDate").value = day ? upDay0 : todayISO();
    upQ("upCat").innerHTML = cats().map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    upQ("upCat").value = cats()[0] || "";
    upQ("upStatus").hidden = true; upQ("upStatus").textContent = "";
    upQ("upOldBox").hidden = true; upQ("upOld").innerHTML = "";
    upQ("upTitleNote").hidden = true; upQ("upDateNote").hidden = true;
    upQ("upHead").textContent = day ? `${dayLabel(upDay0)} 사진 수정하기` : "사진 올리기";
    upQ("upSub").hidden = !day;
    upQ("upSub").textContent = day ? "빨간 × 를 누르면 그 사진이 지워지고, 아래에서 사진을 더할 수 있어요." : "";
    upQ("upDropT").textContent = day ? "더할 사진을 여기로 끌어다 놓거나" : "여기로 사진을 끌어다 놓거나";
    upQ("upPick").textContent = day ? "사진 더하기" : "사진 선택";
    refreshGo();
  }
  function showUp() {
    upModal.hidden = false; document.body.style.overflow = "hidden";
    if (window.ModalNav) window.ModalNav.open(closeUpDom);   // 휴대폰 '뒤로 가기'로 이 창만 닫히게
  }
  async function openUp() {
    const me = currentUser();
    if (!me) { alert("사진을 올리려면 로그인해 주세요."); openLogin(); return; }
    if (!uploadReady()) { alert("업로드 서버가 아직 설정되지 않았습니다."); return; }
    await isAdminUser();
    if (!upModal) buildUpModal();
    upMode = "new"; upDay0 = ""; upFocus = null;
    resetUp(); showUp();
    loadOld(upQ("upDate").value, false);      // 오늘 이미 올린 사진이 있으면 함께 보여 준다
  }
  // 그 날(YYYY-MM-DD) 사진 고치기 — 날짜 상자의 '사진 수정하기', 소식 더 보기의 '수정'
  async function openDay(d, focusId) {
    const me = currentUser();
    if (!me) { alert("사진을 고치려면 로그인해 주세요."); openLogin(); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) { alert("날짜를 알 수 없는 사진입니다. '소식 더 보기'에서 지워 주세요."); return; }
    await isAdminUser();
    if (!upModal) buildUpModal();
    upMode = "day"; upDay0 = d; upFocus = focusId || null;
    resetUp(); showUp();
    loadOld(d, true);
  }
  function closeUpDom() {
    if (!upModal || upModal.hidden) return;
    upModal.hidden = true;
    upSeq++;
    if (upModal._closeCamera) upModal._closeCamera();
    if ((!feedModal || feedModal.hidden) && viewer.hidden) document.body.style.overflow = "";
    if (upChanged) { upChanged = false; load().then(() => { if (feedModal && !feedModal.hidden) openFeed(); }); }
  }
  function closeUp() { if (window.ModalNav && window.ModalNav.close()) return; closeUpDom(); }

  /* ===================== 배선 ===================== */
  document.getElementById("hnMore").addEventListener("click", openFeed);
  const addBtn = document.getElementById("hnAdd");
  if (addBtn) addBtn.addEventListener("click", openUp);

  load();
  window.addEventListener("church:auth", () => { _isAdmin = null; load(); });
})();
