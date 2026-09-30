/* ============================================================
   선교와 사역 › 선교 — 선교사님 카드와 상세 창
   - 카드를 누르면 그 선교사님의 사역 소개 · 사진 · 사역 보고를 보는 창이 열린다.
   - 카드 오른쪽 빈자리에는 대표 사진이 들어간다.
   - 관리자(또는 '홈페이지' 권한을 받은 분)가 로그인하면 창 안에
     [대표 사진 바꾸기] [사역 소개 고치기] [사진 올리기] [사역 보고 쓰기] 단추가 보여
     목사님이 직접 골라서 넣을 수 있다.
   - 저장 위치: church_settings 의 key='missions'
       data = { items: { <카드 data-mission>: { photo:{url,key}, intro, photos:[{url,key,caption}],
                                               reports:[{id,date,title,body,photos:[{url,key}]}] } } }
     방문자가 읽으려면 supabase/missions.sql 을 한 번 실행해야 한다(실행 전에는 관리자만 보임).
   - 사진 파일은 공용 업로드(js/upload.js, 'uploads' 버킷 missions/ 폴더)
   ============================================================ */
(function () {
  const grid = document.querySelector("[data-missions]");
  if (!grid) return;
  const cards = Array.prototype.slice.call(grid.querySelectorAll(".mission-card[data-mission]"));
  const KEY = "missions";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nl2br = (s) => esc(s).replace(/\n/g, "<br />");
  const hasSB = () => !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY);

  function session() {
    try {
      const ref = new URL(window.SUPABASE_URL).hostname.split(".")[0];
      const raw = sessionStorage.getItem(`sb-${ref}-auth-token`);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.currentSession ? s.currentSession : s;
    } catch (e) { return null; }
  }
  async function api(method, path, body, prefer) {
    const s = session();
    const headers = { apikey: window.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
    if (s && s.access_token) headers.Authorization = "Bearer " + s.access_token;
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(window.SUPABASE_URL + "/rest/v1/" + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const txt = await res.text();
    let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
    if (!res.ok) throw new Error((data && (data.message || data.hint)) || "HTTP " + res.status);
    return data;
  }

  // ---------- 자료 ----------
  let DATA = { items: {} };
  const item = (id) => (DATA.items[id] = DATA.items[id] || { photo: null, intro: "", photos: [], reports: [] });
  async function load() {
    if (!hasSB()) return;
    try {
      const rows = await api("GET", `church_settings?key=eq.${KEY}&select=data`);
      DATA = (rows && rows[0] && rows[0].data) || { items: {} };
      if (!DATA.items) DATA.items = {};
    } catch (e) { /* 공개 읽기 준비 전: 비어 있는 채로 */ }
  }
  async function save(change) {
    // 저장 직전에 최신 자료를 다시 읽고, 바꿀 것만 적용해서 저장(두 사람이 동시에 고쳐도 덜 꼬이게)
    await load();
    change();
    await api("POST", "church_settings?on_conflict=key", { key: KEY, data: DATA, updated_at: new Date().toISOString() }, "resolution=merge-duplicates,return=minimal");
    paintCards();
  }

  // ---------- 고칠 수 있는 사람인지(관리자 · 홈페이지 권한) ----------
  let canEdit = false;
  async function checkPerm() {
    const s = session();
    if (!hasSB() || !s || !s.access_token) return false;
    try {
      const p = await api("POST", "rpc/my_perms", {});
      if (p && typeof p === "object" && !Array.isArray(p)) return !!(p.isAdmin || p.canHomepage);
    } catch (e) {}
    try {
      const uid = s.user && s.user.id;
      const rows = uid ? await api("GET", `admins?uid=eq.${uid}&select=uid`) : [];
      return Array.isArray(rows) && rows.length > 0;
    } catch (e) { return false; }
  }

  // ---------- 카드 ----------
  const GLOBE = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-width="1.6"/><ellipse cx="24" cy="24" rx="8" ry="18" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7 18h34M7 30h34" stroke="currentColor" stroke-width="1.4"/></svg>';
  function paintCards() {
    cards.forEach((c) => {
      const it = DATA.items[c.dataset.mission] || {};
      let ph = c.querySelector(".mc-photo");
      if (!ph) {
        ph = document.createElement("span");
        ph.className = "mc-photo";
        c.appendChild(ph);
        const more = document.createElement("span");
        more.className = "mc-more";
        more.textContent = "자세히 보기 ›";
        c.appendChild(more);
        c.setAttribute("role", "button");
        c.setAttribute("tabindex", "0");
        c.setAttribute("aria-label", `${c.querySelector("h4").textContent} ${c.querySelector(".m-name").textContent} — 사역 소개와 보고 보기`);
      }
      ph.classList.toggle("is-empty", !(it.photo && it.photo.url));
      ph.innerHTML = it.photo && it.photo.url ? `<img src="${esc(it.photo.url)}" alt="" loading="lazy" />` : GLOBE;
    });
  }

  // ---------- 상세 창 ----------
  const modal = document.createElement("div");
  modal.className = "modal ms-modal";
  modal.hidden = true;
  modal.innerHTML = `<div class="modal-backdrop" data-close></div>
    <div class="modal-box ms-box" role="dialog" aria-modal="true" aria-label="선교사님 소개">
      <button class="modal-close" data-close aria-label="닫기">&times;</button>
      <div class="ms-body"></div>
    </div>`;
  document.body.appendChild(modal);
  const body = modal.querySelector(".ms-body");
  let curId = null;

  function open(id) {
    curId = id;
    render();
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    modal.querySelector(".ms-box").scrollTop = 0;
  }
  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
    curId = null;
  }
  modal.addEventListener("click", (e) => { if (e.target.hasAttribute("data-close")) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });

  function fmtDate(d) { const m = String(d || "").match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[1]}. ${+m[2]}. ${+m[3]}.` : ""; }

  function render(msg) {
    const card = cards.find((c) => c.dataset.mission === curId);
    if (!card) return;
    const it = DATA.items[curId] || {};
    const country = card.querySelector("h4").textContent, name = card.querySelector(".m-name").textContent;
    const photos = it.photos || [];
    const reports = (it.reports || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const empty = !it.intro && !photos.length && !reports.length;
    const ed = canEdit;
    body.innerHTML = `
      <div class="ms-top">
        <div class="ms-hero${it.photo && it.photo.url ? "" : " is-empty"}">${it.photo && it.photo.url ? `<img src="${esc(it.photo.url)}" alt="${esc(name)}" />` : GLOBE}</div>
        <div class="ms-who">
          <span class="ms-country">${esc(country)}</span>
          <h3 class="ms-name">${esc(name)}</h3>
          ${ed ? `<label class="ms-btn ms-btn-sm">대표 사진 ${it.photo ? "바꾸기" : "넣기"}<input type="file" accept="image/*" data-act="photo" hidden /></label>` : ""}
        </div>
      </div>
      ${msg ? `<p class="ms-msg">${esc(msg)}</p>` : ""}
      <section class="ms-sec">
        <h4>사역 소개</h4>
        ${it.intro ? `<p class="ms-intro">${nl2br(it.intro)}</p>` : `<p class="ms-wait">${empty ? "선교사님의 사역 소개와 보고를 준비하고 있습니다. 함께 기도해 주세요." : "사역 소개를 준비하고 있습니다."}</p>`}
        ${ed ? `<div class="ms-edit" data-edit="intro" hidden><textarea rows="6" placeholder="사역하는 곳, 하시는 일, 기도 제목 등을 적어 주세요.">${esc(it.intro || "")}</textarea>
          <div class="ms-row"><button type="button" class="ms-btn" data-act="save-intro">저장</button><button type="button" class="ms-btn ms-btn-line" data-act="cancel">취소</button></div></div>
          <button type="button" class="ms-btn ms-btn-line ms-btn-sm" data-act="edit-intro">사역 소개 ${it.intro ? "고치기" : "쓰기"}</button>` : ""}
      </section>
      ${photos.length || ed ? `<section class="ms-sec">
        <h4>사역 사진</h4>
        ${photos.length ? `<div class="ms-gallery">${photos.map((p, i) => `<figure>
            <a href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="${esc(p.caption || "")}" loading="lazy" /></a>
            ${ed ? `<div class="ms-ph-tools"><button type="button" data-act="cover" data-i="${i}" title="대표 사진으로">★</button><button type="button" data-act="del-photo" data-i="${i}" title="사진 지우기">×</button></div>` : ""}
          </figure>`).join("")}</div>` : `<p class="ms-wait">아직 올린 사진이 없습니다.</p>`}
        ${ed ? `<label class="ms-btn ms-btn-line ms-btn-sm">사진 올리기(여러 장 가능)<input type="file" accept="image/*" multiple data-act="photos" hidden /></label>` : ""}
      </section>` : ""}
      <section class="ms-sec">
        <h4>사역 보고</h4>
        ${reports.length ? `<div class="ms-reports">${reports.map((r) => `<details class="ms-report">
            <summary><span class="ms-rdate">${esc(fmtDate(r.date))}</span><span class="ms-rtitle">${esc(r.title || "사역 보고")}</span></summary>
            <div class="ms-rbody">${nl2br(r.body || "")}
              ${(r.photos || []).length ? `<div class="ms-gallery ms-gallery-sm">${r.photos.map((p) => `<a href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="" loading="lazy" /></a>`).join("")}</div>` : ""}
              ${ed ? `<div class="ms-row"><button type="button" class="ms-btn ms-btn-line ms-btn-sm" data-act="edit-report" data-rid="${esc(r.id)}">고치기</button><button type="button" class="ms-btn ms-btn-line ms-btn-sm ms-danger" data-act="del-report" data-rid="${esc(r.id)}">지우기</button></div>` : ""}
            </div></details>`).join("")}</div>` : `<p class="ms-wait">아직 올라온 사역 보고가 없습니다.</p>`}
        ${ed ? `<div class="ms-edit" data-edit="report" hidden>
            <input type="hidden" name="rid" />
            <div class="ms-row"><input type="date" name="date" /><input type="text" name="title" placeholder="제목 (예: 2026년 9월 사역 보고)" /></div>
            <textarea name="body" rows="7" placeholder="보고 내용을 적거나 받은 편지를 붙여 넣어 주세요."></textarea>
            <label class="ms-file">함께 올릴 사진(선택)<input type="file" accept="image/*" multiple name="files" /></label>
            <div class="ms-row"><button type="button" class="ms-btn" data-act="save-report">저장</button><button type="button" class="ms-btn ms-btn-line" data-act="cancel">취소</button></div></div>
          <button type="button" class="ms-btn ms-btn-line ms-btn-sm" data-act="new-report">사역 보고 쓰기</button>` : ""}
      </section>
      ${ed ? `<p class="ms-note">이 단추들은 관리자·홈페이지 권한이 있는 분께만 보입니다.</p>` : ""}`;
  }

  async function uploadAll(files, busyLabel) {
    if (!window.ChurchUpload || !window.ChurchUpload.isReady()) throw new Error("사진 올리기 준비가 안 되어 있습니다.");
    const out = [];
    let n = 0;
    for (const f of files) {
      n++;
      render(`${busyLabel} ${n} / ${files.length} …`);
      const small = await window.ChurchUpload.compressImage(f, 1800, 0.84);
      out.push(await window.ChurchUpload.upload(small, { folder: "missions/" + curId }));
    }
    return out;
  }
  async function act(fn, doneMsg) {
    try { await fn(); render(doneMsg); }
    catch (e) { render("저장하지 못했습니다: " + (e.message || e)); }
  }

  body.addEventListener("change", (e) => {
    const t = e.target;
    const a = t.getAttribute("data-act");
    if (!a || !t.files || !t.files.length) return;
    const files = Array.prototype.slice.call(t.files);
    if (a === "photo") {
      act(async () => { const [up] = await uploadAll(files.slice(0, 1), "사진 올리는 중"); await save(() => { item(curId).photo = up; }); }, "대표 사진을 바꿨습니다.");
    } else if (a === "photos") {
      act(async () => {
        const ups = await uploadAll(files, "사진 올리는 중");
        await save(() => { const it = item(curId); it.photos = (it.photos || []).concat(ups.map((u) => ({ url: u.url, key: u.key, caption: "" }))); if (!it.photo) it.photo = ups[0]; });
      }, `사진 ${files.length}장을 올렸습니다.`);
    }
  });

  body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || b.tagName === "INPUT") return;
    const a = b.getAttribute("data-act");
    const showEdit = (name) => { body.querySelectorAll(".ms-edit").forEach((x) => { x.hidden = x.getAttribute("data-edit") !== name; }); };
    if (a === "edit-intro") { showEdit("intro"); b.hidden = true; body.querySelector('[data-edit="intro"] textarea').focus(); }
    else if (a === "cancel") render();
    else if (a === "save-intro") {
      const v = body.querySelector('[data-edit="intro"] textarea').value.trim();
      act(() => save(() => { item(curId).intro = v; }), "사역 소개를 저장했습니다.");
    } else if (a === "cover") {
      const i = +b.dataset.i;
      act(() => save(() => { const it = item(curId); if (it.photos[i]) it.photo = { url: it.photos[i].url, key: it.photos[i].key }; }), "대표 사진으로 정했습니다.");
    } else if (a === "del-photo") {
      if (!confirm("이 사진을 지울까요?")) return;
      const i = +b.dataset.i;
      act(async () => {
        let key = null;
        await save(() => { const it = item(curId); const p = it.photos.splice(i, 1)[0]; key = p && p.key; if (p && it.photo && it.photo.url === p.url) it.photo = it.photos[0] ? { url: it.photos[0].url, key: it.photos[0].key } : null; });
        if (key && window.ChurchUpload) window.ChurchUpload.remove(key);
      }, "사진을 지웠습니다.");
    } else if (a === "new-report" || a === "edit-report") {
      showEdit("report");
      body.querySelector('[data-act="new-report"]').hidden = true;
      const f = body.querySelector('[data-edit="report"]');
      const r = a === "edit-report" ? (item(curId).reports || []).find((x) => x.id === b.dataset.rid) : null;
      f.querySelector('[name="rid"]').value = r ? r.id : "";
      f.querySelector('[name="date"]').value = r ? r.date : new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
      f.querySelector('[name="title"]').value = r ? r.title : "";
      f.querySelector('[name="body"]').value = r ? r.body : "";
      f.scrollIntoView({ block: "center", behavior: "smooth" });
    } else if (a === "save-report") {
      const f = body.querySelector('[data-edit="report"]');
      const rid = f.querySelector('[name="rid"]').value;
      const v = { date: f.querySelector('[name="date"]').value, title: f.querySelector('[name="title"]').value.trim(), body: f.querySelector('[name="body"]').value.trim() };
      if (!v.title && !v.body) { alert("제목이나 내용을 적어 주세요."); return; }
      const files = Array.prototype.slice.call(f.querySelector('[name="files"]').files || []);
      act(async () => {
        const ups = files.length ? await uploadAll(files, "사진 올리는 중") : [];
        await save(() => {
          const it = item(curId);
          it.reports = it.reports || [];
          const old = rid ? it.reports.find((x) => x.id === rid) : null;
          if (old) { Object.assign(old, v); old.photos = (old.photos || []).concat(ups); }
          else it.reports.push(Object.assign({ id: "r" + Date.now().toString(36), photos: ups }, v));
        });
      }, "사역 보고를 저장했습니다.");
    } else if (a === "del-report") {
      if (!confirm("이 사역 보고를 지울까요?")) return;
      act(() => save(() => { const it = item(curId); it.reports = (it.reports || []).filter((x) => x.id !== b.dataset.rid); }), "사역 보고를 지웠습니다.");
    }
  });

  // ---------- 시작 ----------
  cards.forEach((c) => {
    c.addEventListener("click", () => open(c.dataset.mission));
    c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(c.dataset.mission); } });
  });
  paintCards();
  load().then(paintCards);
  checkPerm().then((ok) => { canEdit = ok; grid.classList.toggle("can-edit", ok); if (!modal.hidden) render(); });
  window.addEventListener("church:auth", () => { checkPerm().then((ok) => { canEdit = ok; load().then(() => { paintCards(); if (!modal.hidden) render(); }); }); });
})();
