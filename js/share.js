/* ============================================================
   ○○교회 — 공유 대상 수신 페이지(share.html)
   - PWA 공유시트에서 '○○교회'로 보낸 사진/링크를 받아
     서비스워커가 IndexedDB(wpc-share)에 저장 → 여기서 읽어 업로드 폼 구성
   - 로그인 교인만 업로드. 사진은 ChurchUpload로 압축→R2, album_photos 기록
   ============================================================ */
(function () {
  const box = document.getElementById("shareBox");
  if (!box) return;

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
  async function api(method, path, body, extra) {
    const sess = localSession();
    const headers = { apikey: window.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
    if (sess && sess.access_token) headers.Authorization = "Bearer " + sess.access_token;
    if (extra) Object.assign(headers, extra);
    const res = await fetch(window.SUPABASE_URL + "/rest/v1/" + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const txt = await res.text();
    let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
    if (!res.ok) { const m = (data && (data.message || data.error)) || ("HTTP " + res.status); throw new Error(m); }
    return data;
  }

  /* ── IndexedDB(wpc-share)에서 공유 데이터 읽고 소비 ── */
  function idbRead() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open("wpc-share", 1);
        req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains("pending")) db.createObjectStore("pending", { keyPath: "id" }); };
        req.onsuccess = () => {
          try {
            const db = req.result;
            const tx = db.transaction("pending", "readonly");
            const g = tx.objectStore("pending").get(1);
            g.onsuccess = () => resolve(g.result || null);
            g.onerror = () => resolve(null);
          } catch (_) { resolve(null); }
        };
        req.onerror = () => resolve(null);
      } catch (_) { resolve(null); }
    });
  }
  function idbClear() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open("wpc-share", 1);
        req.onsuccess = () => {
          try { const tx = req.result.transaction("pending", "readwrite"); tx.objectStore("pending").delete(1); tx.oncomplete = resolve; tx.onerror = resolve; }
          catch (_) { resolve(); }
        };
        req.onerror = () => resolve();
      } catch (_) { resolve(); }
    });
  }

  const goHome = '<a class="btn btn-outline" href="story.html#album">우리들 소식으로</a>';

  function loginNeeded() {
    box.innerHTML = `
      <div class="share-card">
        <h3>로그인이 필요합니다</h3>
        <p class="share-note">사진을 올리려면 먼저 홈페이지에 로그인해 주세요. 로그인 후 다시 공유하시면 됩니다.</p>
        <a class="btn btn-solid" href="story.html">로그인하러 가기</a>
      </div>`;
  }

  function noData() {
    box.innerHTML = `
      <div class="share-card">
        <h3>공유된 사진이 없습니다</h3>
        <p class="share-note">사진 앱이나 인스타그램에서 <b>공유 → ○○교회</b> 를 선택하면 이 화면으로 사진이 전달됩니다.
        (안드로이드에서 홈 화면에 설치된 앱으로 이용해 주세요.)</p>
        ${goHome}
      </div>`;
  }

  function renderForm(payload) {
    const files = (payload.files || []).filter((f) => f && f.type && /^image\//.test(f.type));
    const sharedLink = (payload.url || payload.text || "").trim();

    if (!files.length) {
      // 사진 없이 링크/텍스트만 공유된 경우(인스타 게시물 링크 등)
      box.innerHTML = `
        <div class="share-card">
          <h3>사진이 함께 오지 않았어요</h3>
          <p class="share-note">앨범에는 <b>사진</b>이 필요합니다. 인스타그램에서 사진을 <b>길게 눌러 ‘이미지 공유’</b>로 보내면 여기로 올릴 수 있어요.</p>
          ${sharedLink ? `<p class="share-note">공유된 링크: <a href="${esc(sharedLink)}" target="_blank" rel="noopener">${esc(sharedLink)}</a></p>` : ""}
          ${goHome}
        </div>`;
      idbClear();
      return;
    }

    const previews = files.map((f) => `<img src="${URL.createObjectURL(f)}" alt="공유 사진" />`).join("");
    const opts = cats().map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    box.innerHTML = `
      <div class="share-card">
        <h3>우리들 소식에 올리기</h3>
        <p class="share-note">${files.length}장의 사진을 앨범에 올립니다.</p>
        <div class="share-previews">${previews}</div>
        <label class="share-field"><span>카테고리</span>
          <select id="shareCat">${opts}</select>
        </label>
        <label class="share-field"><span>한 줄 소식(선택)</span>
          <textarea id="shareCap" rows="2" maxlength="300" placeholder="어떤 순간인가요?">${esc(sharedLink)}</textarea>
        </label>
        <button type="button" class="btn btn-solid share-go" id="shareGo">앨범에 올리기</button>
        <div class="share-status" id="shareStatus" hidden></div>
      </div>`;

    document.getElementById("shareGo").addEventListener("click", () => doUpload(files));
  }

  async function doUpload(files) {
    const me = currentUser();
    if (!me) { loginNeeded(); return; }
    if (!(window.ChurchUpload && window.ChurchUpload.isReady())) { alert("업로드 서버가 아직 설정되지 않았습니다."); return; }
    const cat = document.getElementById("shareCat").value;
    const cap = (document.getElementById("shareCap").value || "").trim();
    const btn = document.getElementById("shareGo");
    const status = document.getElementById("shareStatus");
    btn.disabled = true; status.hidden = false;
    for (let i = 0; i < files.length; i++) {
      status.textContent = `올리는 중… ${i + 1}/${files.length}`;
      try {
        const r = await window.ChurchUpload.upload(files[i], { folder: "album" });
        await api("POST", "album_photos",
          { category: cat, url: r.url, key: r.key, caption: i === 0 ? (cap || null) : null, user_id: me.id, author_name: displayName(me) },
          { Prefer: "return=minimal" });
      } catch (e) {
        status.textContent = "";
        btn.disabled = false;
        alert("업로드 오류: " + e.message);
        return;
      }
    }
    await idbClear();
    box.innerHTML = `
      <div class="share-card">
        <h3>올렸습니다 🎉</h3>
        <p class="share-note">‘${esc(cat)}’ 앨범에 사진 ${files.length}장을 올렸어요.</p>
        ${goHome}
      </div>`;
  }

  async function start() {
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) { noData(); return; }
    if (!currentUser()) { loginNeeded(); return; }
    if (window.ChurchCategories) { try { await window.ChurchCategories.load(); } catch (e) {} }
    const payload = await idbRead();
    if (!payload) { noData(); return; }
    renderForm(payload);
  }

  start();
})();
