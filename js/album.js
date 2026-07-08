/* ============================================================
   ○○교회 — 우리들 소식 (인스타그램형 갤러리)
   - 카테고리별 카드: 대표 사진(최근) + 장수 표시
   - 로그인 교인: 카드에 사진을 끌어다 놓거나 '＋ 사진'으로 업로드
   - 카드 클릭 → 인스타 피드형 모달(작성자·좋아요·댓글)
   - 사진 탭 → 전체화면 스와이프 뷰어(좌우 스와이프 / 더블탭 좋아요)
   - 사진은 업로드 전 자동 압축(ChurchUpload) 후 R2에 저장,
     메타데이터는 album_photos, 좋아요·댓글은 album_likes / album_comments
   ============================================================ */
(function () {
  const grid = document.getElementById("albumGrid");
  if (!grid) return;
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    grid.innerHTML = '<p class="placeholder-note">로그인 기능 연결 후 이용할 수 있습니다.</p>';
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
  function currentUser() { const s = localSession(); return (s && s.user) || null; }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("서버 응답이 지연됩니다")), ms))]);
  async function api(method, path, body, extra) {
    const sess = localSession();
    const token = sess && sess.access_token;
    const headers = { apikey: window.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    if (extra) Object.assign(headers, extra);
    return withTimeout((async () => {
      const res = await fetch(window.SUPABASE_URL + "/rest/v1/" + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const txt = await res.text();
      let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
      if (!res.ok) { const m = (data && (data.message || data.hint || data.error)) || ("HTTP " + res.status); const err = new Error(m); err.status = res.status; throw err; }
      return data;
    })(), 10000);
  }
  const displayName = (u) => (u && u.user_metadata && (u.user_metadata.name || u.user_metadata.full_name)) || (u && u.email ? u.email.split("@")[0] : "성도");
  function openLogin() { const m = document.getElementById("authModal"); if (m) { m.hidden = false; document.body.style.overflow = "hidden"; } }

  // 상대 시간 표시("3분 전", "2일 전", 오래되면 날짜)
  function timeAgo(iso) {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    if (isNaN(t)) return "";
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return "방금 전";
    const m = Math.floor(s / 60); if (m < 60) return m + "분 전";
    const h = Math.floor(m / 60); if (h < 24) return h + "시간 전";
    const d = Math.floor(h / 24); if (d < 7) return d + "일 전";
    const dt = new Date(t);
    return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
  }
  const initial = (name) => (String(name || "성").trim()[0] || "성").toUpperCase();

  let _isAdmin = null;
  async function isAdminUser() {
    if (_isAdmin !== null) return _isAdmin;
    const me = currentUser();
    if (!me || !me.id) { _isAdmin = false; return false; }
    try { const rows = await api("GET", `admins?uid=eq.${me.id}&select=uid`); _isAdmin = Array.isArray(rows) && rows.length > 0; }
    catch (e) { _isAdmin = false; }
    return _isAdmin;
  }
  const uploadReady = () => !!(window.ChurchUpload && window.ChurchUpload.isReady());

  let photos = [];             // 전체 사진(집계 포함: like_count, comment_count)
  let social = true;           // 좋아요/댓글 테이블 사용 가능 여부
  const myLikes = new Set();   // 내가 좋아요한 photo_id
  const commentCache = {};     // photo_id → [{...comment}]
  const byCat = (cat) => photos.filter((p) => p.category === cat).sort((a, b) => b.id - a.id);
  const photoById = (id) => photos.find((p) => String(p.id) === String(id));

  async function load() {
    if (window.ChurchCategories) { try { await window.ChurchCategories.load(); } catch (e) {} }
    // 집계 뷰(album_feed) 우선, 없으면 album_photos 로 폴백
    try {
      photos = await api("GET", "album_feed?select=*&order=created_at.desc") || [];
      social = true;
    } catch (e) {
      social = false;
      try { photos = await api("GET", "album_photos?select=*&order=created_at.desc") || []; }
      catch (e2) { photos = []; }
      photos = photos.map((p) => ({ ...p, like_count: 0, comment_count: 0 }));
    }
    myLikes.clear();
    const me = currentUser();
    if (social && me && me.id && photos.length) {
      try {
        const rows = await api("GET", `album_likes?user_id=eq.${me.id}&select=photo_id`);
        (rows || []).forEach((r) => myLikes.add(String(r.photo_id)));
      } catch (e) { /* 좋아요 테이블 아직 없음 → 무시 */ }
    }
    render();
  }

  function render() {
    const loggedIn = !!currentUser();
    grid.innerHTML = cats().map((cat) => {
      const list = byCat(cat);
      const cover = list[0];
      const coverStyle = cover ? `style="background-image:url('${esc(cover.url)}')"` : "";
      return `<div class="album-card${cover ? " has-photo" : ""}" data-cat="${esc(cat)}">
        <div class="album-thumb" ${coverStyle}>${cover ? "" : "📷"}</div>
        <div class="album-cap"><span class="ac-name">${esc(cat)}</span><span class="album-count">${list.length}</span></div>
        ${loggedIn && uploadReady() ? `
          <button type="button" class="album-add" data-cat="${esc(cat)}" title="사진 올리기">＋ 사진</button>
          <input type="file" class="album-input" accept="image/*" multiple hidden />
          <div class="album-droplay"><span>여기에 사진을 놓으세요</span></div>` : ""}
      </div>`;
    }).join("");

    grid.querySelectorAll(".album-card").forEach((card) => {
      const cat = card.getAttribute("data-cat");
      const input = card.querySelector(".album-input");
      const addBtn = card.querySelector(".album-add");

      card.addEventListener("click", (e) => {
        if (e.target.closest(".album-add") || e.target.closest(".album-input")) return;
        openGallery(cat);
      });

      if (addBtn && input) {
        addBtn.addEventListener("click", (e) => { e.stopPropagation(); input.click(); });
        input.addEventListener("change", () => handleFiles(card, cat, input.files));
        ["dragenter", "dragover"].forEach((ev) => card.addEventListener(ev, (e) => { e.preventDefault(); card.classList.add("drag"); }));
        ["dragleave", "drop"].forEach((ev) => card.addEventListener(ev, (e) => { e.preventDefault(); if (ev === "dragleave" && card.contains(e.relatedTarget)) return; card.classList.remove("drag"); }));
        card.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files) handleFiles(card, cat, e.dataTransfer.files); });
      }
    });
  }

  async function handleFiles(card, cat, fileList) {
    const me = currentUser();
    if (!me) { alert("사진을 올리려면 로그인해 주세요."); openLogin(); return; }
    if (!uploadReady()) { alert("업로드 서버가 아직 설정되지 않았습니다."); return; }
    const files = Array.from(fileList || []).filter((f) => /^image\//.test(f.type));
    if (!files.length) { alert("이미지 파일만 올릴 수 있습니다."); return; }
    const cap = card.querySelector(".album-count");
    const orig = cap ? cap.textContent : "";
    for (let i = 0; i < files.length; i++) {
      if (cap) cap.textContent = `올리는 중 ${i + 1}/${files.length}`;
      try {
        const r = await window.ChurchUpload.upload(files[i], { folder: "album" });
        await api("POST", "album_photos", { category: cat, url: r.url, key: r.key, user_id: me.id, author_name: displayName(me) }, { Prefer: "return=minimal" });
      } catch (e) { if (cap) cap.textContent = orig; alert("업로드 오류: " + e.message); return; }
    }
    await load();
  }

  /* ===================== 좋아요 ===================== */
  async function toggleLike(photo) {
    const me = currentUser();
    if (!me) { alert("좋아요를 누르려면 로그인해 주세요."); openLogin(); return null; }
    if (!social) return null;
    const id = String(photo.id);
    const liked = myLikes.has(id);
    // 낙관적 업데이트
    if (liked) { myLikes.delete(id); photo.like_count = Math.max(0, (photo.like_count || 0) - 1); }
    else { myLikes.add(id); photo.like_count = (photo.like_count || 0) + 1; }
    try {
      if (liked) await api("DELETE", `album_likes?photo_id=eq.${photo.id}&user_id=eq.${me.id}`, null, { Prefer: "return=minimal" });
      else await api("POST", "album_likes", { photo_id: photo.id, user_id: me.id }, { Prefer: "resolution=merge-duplicates,return=minimal" });
    } catch (e) {
      // 롤백
      if (liked) { myLikes.add(id); photo.like_count = (photo.like_count || 0) + 1; }
      else { myLikes.delete(id); photo.like_count = Math.max(0, (photo.like_count || 0) - 1); }
      alert("좋아요 처리 중 오류: " + e.message);
    }
    return myLikes.has(id);
  }

  /* ===================== 댓글 ===================== */
  async function loadComments(photoId) {
    if (!social) return [];
    if (commentCache[photoId]) return commentCache[photoId];
    try {
      const rows = await api("GET", `album_comments?photo_id=eq.${photoId}&order=created_at.asc&select=*`);
      commentCache[photoId] = rows || [];
    } catch (e) { commentCache[photoId] = []; }
    return commentCache[photoId];
  }
  async function addComment(photoId, body) {
    const me = currentUser();
    if (!me) { alert("댓글을 쓰려면 로그인해 주세요."); openLogin(); return null; }
    const text = String(body || "").trim();
    if (!text) return null;
    const row = { photo_id: photoId, user_id: me.id, author_name: displayName(me), body: text };
    try {
      const saved = await api("POST", "album_comments", row, { Prefer: "return=representation" });
      const c = Array.isArray(saved) ? saved[0] : saved;
      (commentCache[photoId] = commentCache[photoId] || []).push(c || { ...row, created_at: new Date().toISOString() });
      const p = photoById(photoId); if (p) p.comment_count = (p.comment_count || 0) + 1;
      return c;
    } catch (e) { alert("댓글 등록 오류: " + e.message); return null; }
  }
  async function delComment(photoId, commentId) {
    try {
      await api("DELETE", `album_comments?id=eq.${commentId}`, null, { Prefer: "return=minimal" });
      commentCache[photoId] = (commentCache[photoId] || []).filter((c) => String(c.id) !== String(commentId));
      const p = photoById(photoId); if (p) p.comment_count = Math.max(0, (p.comment_count || 0) - 1);
    } catch (e) { alert("댓글 삭제 오류: " + e.message); }
  }

  /* ===================== 피드 모달 ===================== */
  const modal = document.getElementById("albumModal");
  const galTitle = document.getElementById("albumModalTitle");
  const gal = document.getElementById("albumGallery");
  let curCat = "";
  let curAdmin = false;

  function closeGalleryDom() { if (modal) { modal.hidden = true; document.body.style.overflow = ""; } }
  function closeGallery() { if (window.ModalNav && window.ModalNav.close()) return; closeGalleryDom(); }
  if (modal) {
    modal.addEventListener("click", (e) => { if (e.target.hasAttribute("data-close")) closeGallery(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden && viewer.hidden) closeGallery(); });
  }

  async function openGallery(cat) {
    if (!modal) return;
    const wasOpen = !modal.hidden;
    curCat = cat;
    const list = byCat(cat);
    curAdmin = await isAdminUser();
    galTitle.textContent = cat;
    if (!list.length) {
      gal.className = "album-feed empty";
      gal.innerHTML = `<p class="placeholder-note">아직 사진이 없습니다.${currentUser() ? " 카드에 사진을 끌어다 놓아 올려보세요." : " 로그인 후 올릴 수 있어요."}</p>`;
    } else {
      gal.className = "album-feed";
      gal.innerHTML = list.map((p, i) => cardHtml(p, i)).join("");
      // 댓글 미리 로드(각 카드 최신 2개 표시)
      list.forEach((p) => loadComments(p.id).then(() => refreshCardComments(p.id)));
      wireFeed(list);
    }
    modal.hidden = false; document.body.style.overflow = "hidden";
    if (!wasOpen && window.ModalNav) window.ModalNav.open(closeGalleryDom);
  }

  function heartSvg(filled) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" class="ig-ic${filled ? " liked" : ""}">
      <path d="M12 21s-7.5-4.6-10-9.2C.6 8.7 2 5.5 5 5.5c1.9 0 3.2 1.1 4 2.3.8-1.2 2.1-2.3 4-2.3 3 0 4.4 3.2 3 6.3C19.5 16.4 12 21 12 21z"
        fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  }
  const bubbleSvg = `<svg viewBox="0 0 24 24" aria-hidden="true" class="ig-ic"><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

  function cardHtml(p, i) {
    const liked = myLikes.has(String(p.id));
    const me = currentUser();
    const canDel = (me && me.id === p.user_id) || curAdmin;
    return `<article class="ig-card" data-id="${p.id}" data-idx="${i}">
      <header class="ig-head">
        <span class="ig-avatar">${esc(initial(p.author_name))}</span>
        <div class="ig-who"><b>${esc(p.author_name || "성도")}</b><span>${esc(timeAgo(p.created_at))}</span></div>
        ${canDel ? `<button type="button" class="ig-menu" data-act="delphoto" title="삭제">삭제</button>` : ""}
      </header>
      <div class="ig-media" data-act="open" data-idx="${i}" role="button" tabindex="0" aria-label="사진 크게 보기">
        <img src="${esc(p.url)}" alt="${esc(curCat)}" loading="lazy" draggable="false" />
        <span class="ig-heartburst" aria-hidden="true">${heartSvg(true)}</span>
      </div>
      <div class="ig-actions">
        <button type="button" class="ig-btn ig-like${liked ? " on" : ""}" data-act="like" aria-pressed="${liked}" aria-label="좋아요">${heartSvg(liked)}</button>
        <button type="button" class="ig-btn" data-act="focuscmt" aria-label="댓글">${bubbleSvg}</button>
      </div>
      <div class="ig-likecount" data-role="likecount">${(p.like_count || 0) > 0 ? `좋아요 ${p.like_count}개` : "가장 먼저 좋아요를 눌러보세요"}</div>
      ${p.caption ? `<div class="ig-caption"><b>${esc(p.author_name || "성도")}</b> ${esc(p.caption)}</div>` : ""}
      <div class="ig-comments" data-role="comments"></div>
      ${social ? `<form class="ig-addcmt" data-role="addcmt">
        <input type="text" name="c" maxlength="500" placeholder="따뜻한 댓글 달기…" autocomplete="off" />
        <button type="submit">게시</button>
      </form>` : ""}
    </article>`;
  }

  function commentLineHtml(c) {
    const me = currentUser();
    const canDel = (me && me.id === c.user_id) || curAdmin;
    return `<div class="ig-cmt" data-cid="${c.id || ""}"><b>${esc(c.author_name || "성도")}</b> ${esc(c.body)}${canDel && c.id ? ` <button type="button" class="ig-cmt-del" data-act="delcmt" data-cid="${c.id}" aria-label="댓글 삭제">×</button>` : ""}</div>`;
  }

  function refreshCardComments(photoId) {
    const card = gal.querySelector(`.ig-card[data-id="${photoId}"]`);
    if (!card) return;
    const box = card.querySelector('[data-role="comments"]');
    const list = commentCache[photoId] || [];
    const p = photoById(photoId);
    const total = p ? (p.comment_count || list.length) : list.length;
    const shown = list.slice(-2);
    let html = "";
    if (total > shown.length) html += `<button type="button" class="ig-morecmt" data-act="allcmt">댓글 ${total}개 모두 보기</button>`;
    html += shown.map(commentLineHtml).join("");
    box.innerHTML = html;
  }

  function wireFeed(list) {
    gal.querySelectorAll(".ig-card").forEach((card) => {
      const id = card.getAttribute("data-id");
      const p = photoById(id);
      if (!p) return;

      card.querySelectorAll('[data-act="open"]').forEach((m) => {
        m.addEventListener("click", () => openViewer(list, Number(card.getAttribute("data-idx"))));
        m.addEventListener("keydown", (e) => { if (e.key === "Enter") openViewer(list, Number(card.getAttribute("data-idx"))); });
      });

      const likeBtn = card.querySelector('[data-act="like"]');
      if (likeBtn) likeBtn.addEventListener("click", async () => {
        const r = await toggleLike(p);
        if (r === null) return;
        syncLikeUI(card, p);
      });

      const focusBtn = card.querySelector('[data-act="focuscmt"]');
      if (focusBtn) focusBtn.addEventListener("click", () => { const inp = card.querySelector('.ig-addcmt input'); if (inp) inp.focus(); });

      const delPhoto = card.querySelector('[data-act="delphoto"]');
      if (delPhoto) delPhoto.addEventListener("click", () => removePhoto(p));

      const form = card.querySelector('[data-role="addcmt"]');
      if (form) form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const inp = form.querySelector("input");
        const val = inp.value;
        inp.value = "";
        const c = await addComment(id, val);
        if (c) refreshCardComments(id);
      });

      // 댓글 영역 위임(모두 보기 / 삭제)
      const cbox = card.querySelector('[data-role="comments"]');
      if (cbox) cbox.addEventListener("click", async (e) => {
        const all = e.target.closest('[data-act="allcmt"]');
        if (all) { renderAllComments(card, id); return; }
        const del = e.target.closest('[data-act="delcmt"]');
        if (del) { if (confirm("이 댓글을 삭제할까요?")) { await delComment(id, del.dataset.cid); refreshCardComments(id); } }
      });
    });
  }

  function renderAllComments(card, id) {
    const box = card.querySelector('[data-role="comments"]');
    const list = commentCache[id] || [];
    box.innerHTML = list.map(commentLineHtml).join("");
  }

  function syncLikeUI(card, p) {
    const liked = myLikes.has(String(p.id));
    const btn = card.querySelector('[data-act="like"]');
    if (btn) { btn.classList.toggle("on", liked); btn.setAttribute("aria-pressed", liked); btn.innerHTML = heartSvg(liked); }
    const lc = card.querySelector('[data-role="likecount"]');
    if (lc) lc.textContent = (p.like_count || 0) > 0 ? `좋아요 ${p.like_count}개` : "가장 먼저 좋아요를 눌러보세요";
  }

  async function removePhoto(p) {
    if (!confirm("이 사진을 삭제할까요?")) return;
    try {
      await api("DELETE", `album_photos?id=eq.${p.id}`, null, { Prefer: "return=minimal" });
      if (p.key && window.ChurchUpload) window.ChurchUpload.remove(p.key);
    } catch (e) { alert("삭제 오류: " + e.message); return; }
    await load();
    if (byCat(curCat).length) openGallery(curCat); else closeGallery();
  }

  /* ===================== 전체화면 뷰어 ===================== */
  const viewer = document.createElement("div");
  viewer.className = "ig-viewer";
  viewer.hidden = true;
  viewer.innerHTML = `
    <button type="button" class="igv-close" aria-label="닫기">&times;</button>
    <button type="button" class="igv-nav igv-prev" aria-label="이전">‹</button>
    <button type="button" class="igv-nav igv-next" aria-label="다음">›</button>
    <div class="igv-stage" data-role="stage"></div>
    <div class="igv-bottom">
      <div class="igv-acts">
        <button type="button" class="igv-like" data-act="like" aria-label="좋아요"></button>
        <span class="igv-likecount" data-role="vlike"></span>
      </div>
      <div class="igv-cap" data-role="vcap"></div>
      <div class="igv-dots" data-role="dots"></div>
    </div>`;
  document.body.appendChild(viewer);
  const vStage = viewer.querySelector('[data-role="stage"]');
  let vList = [], vIdx = 0;

  function openViewer(list, idx) {
    vList = list; vIdx = idx || 0;
    renderViewer();
    viewer.hidden = false;
    document.body.style.overflow = "hidden";
    if (window.ModalNav) window.ModalNav.open(closeViewerDom);
  }
  function closeViewerDom() { viewer.hidden = true; if (!modal.hidden) document.body.style.overflow = "hidden"; }
  function closeViewer() { if (window.ModalNav && window.ModalNav.close()) return; closeViewerDom(); }

  function renderViewer() {
    const p = vList[vIdx]; if (!p) return;
    vStage.innerHTML = `<img src="${esc(p.url)}" alt="${esc(curCat)}" draggable="false" />
      <span class="igv-heartburst" aria-hidden="true">${heartSvg(true)}</span>`;
    const liked = myLikes.has(String(p.id));
    const likeBtn = viewer.querySelector('[data-act="like"]');
    likeBtn.innerHTML = heartSvg(liked); likeBtn.classList.toggle("on", liked);
    viewer.querySelector('[data-role="vlike"]').textContent = (p.like_count || 0) > 0 ? `좋아요 ${p.like_count}개` : "";
    viewer.querySelector('[data-role="vcap"]').innerHTML = p.caption ? `<b>${esc(p.author_name || "성도")}</b> ${esc(p.caption)}` : "";
    viewer.querySelector('[data-role="dots"]').innerHTML = vList.length > 1
      ? vList.map((_, i) => `<span class="igv-dot${i === vIdx ? " on" : ""}"></span>`).join("") : "";
    viewer.querySelector(".igv-prev").style.visibility = vIdx > 0 ? "visible" : "hidden";
    viewer.querySelector(".igv-next").style.visibility = vIdx < vList.length - 1 ? "visible" : "hidden";
  }
  function vGo(d) { const n = vIdx + d; if (n < 0 || n >= vList.length) return; vIdx = n; renderViewer(); }

  async function vLike() {
    const p = vList[vIdx]; if (!p) return;
    const r = await toggleLike(p);
    if (r === null) return;
    renderViewer();
    // 피드 카드도 동기화
    const card = gal.querySelector(`.ig-card[data-id="${p.id}"]`);
    if (card) syncLikeUI(card, p);
  }
  function heartBurst() {
    const b = vStage.querySelector(".igv-heartburst");
    if (!b) return; b.classList.remove("go"); void b.offsetWidth; b.classList.add("go");
  }

  viewer.querySelector(".igv-close").addEventListener("click", closeViewer);
  viewer.querySelector(".igv-prev").addEventListener("click", () => vGo(-1));
  viewer.querySelector(".igv-next").addEventListener("click", () => vGo(1));
  viewer.querySelector('[data-act="like"]').addEventListener("click", vLike);
  viewer.addEventListener("click", (e) => { if (e.target === viewer) closeViewer(); });
  document.addEventListener("keydown", (e) => {
    if (viewer.hidden) return;
    if (e.key === "Escape") closeViewer();
    else if (e.key === "ArrowLeft") vGo(-1);
    else if (e.key === "ArrowRight") vGo(1);
  });

  // 더블탭 좋아요 + 스와이프
  let lastTap = 0, touchX = null, touchY = null, dragging = false;
  vStage.addEventListener("click", () => {
    const now = Date.now();
    if (now - lastTap < 300) { if (!myLikes.has(String(vList[vIdx].id))) vLike(); heartBurst(); lastTap = 0; }
    else lastTap = now;
  });
  vStage.addEventListener("dblclick", (e) => e.preventDefault());
  vStage.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; dragging = true;
  }, { passive: true });
  vStage.addEventListener("touchmove", (e) => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - touchX;
    const dy = e.touches[0].clientY - touchY;
    if (Math.abs(dx) > Math.abs(dy)) { const img = vStage.querySelector("img"); if (img) img.style.transform = `translateX(${dx}px)`; }
  }, { passive: true });
  vStage.addEventListener("touchend", (e) => {
    if (!dragging) return; dragging = false;
    const dx = (e.changedTouches[0].clientX) - touchX;
    const img = vStage.querySelector("img"); if (img) img.style.transform = "";
    if (Math.abs(dx) > 60) vGo(dx < 0 ? 1 : -1);
    touchX = touchY = null;
  });

  // 관리자용 '카테고리 관리' 버튼(community.html의 #albumCatManage)
  const catBtn = document.getElementById("albumCatManage");
  if (catBtn && window.ChurchCategories) {
    catBtn.addEventListener("click", () => window.ChurchCategories.openManager());
    isAdminUser().then((ok) => { if (ok) catBtn.hidden = false; });
  }
  // 카테고리 변경 시 카드 다시 그리기
  window.addEventListener("church:categories-changed", () => render());

  load();

  // 로그인/로그아웃 후 갱신(다른 스크립트가 발생시키는 이벤트에 대응)
  window.addEventListener("church:auth", () => { _isAdmin = null; if (window.ChurchCategories) window.ChurchCategories.isAdmin().then(() => {}); load(); });
})();
