/* ============================================================
   ○○교회 — 회원 관리(관리자) + 내 정보 + 연말정산
   ※ supabase-js SDK의 getSession() 잠금(navigator lock)으로 인한
     "확인 중" 무한 대기를 피하기 위해, localStorage의 로그인 토큰으로
     Supabase REST API를 직접 호출합니다. (모든 요청에 타임아웃 적용)
   ============================================================ */
(function () {
  const box = document.getElementById("memberList");
  if (!box) return;
  const notice = document.getElementById("adminNotice");
  const countEl = document.getElementById("memberCount");

  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    if (notice) notice.hidden = false;
    box.innerHTML = "";
    return;
  }

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  const fmt = (iso) => { try { const d = new Date(iso); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`; } catch (e) { return ""; } };
  const fmtT = (iso) => { try { const d = new Date(iso); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; } catch (e) { return ""; } };
  const provLabel = (p) => (p === "kakao" ? "카카오" : p === "email" ? "이메일" : p || "-");

  // 직분 목록
  const ROLES = ["담임목사", "원로목사", "사모", "장로", "원로장로", "안수집사", "권사", "명예권사", "은퇴권사", "집사", "성도", "청년", "학생", "어린이"];
  const roleOptions = (sel) =>
    `<option value="">선택</option>` + ROLES.map((r) => `<option${r === sel ? " selected" : ""}>${r}</option>`).join("");

  // ── 도로명 주소 검색(다음 우편번호 서비스) ──
  function loadDaumPostcode() {
    return new Promise((res, rej) => {
      if (window.daum && window.daum.Postcode) return res();
      const s = document.createElement("script");
      s.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
      s.onload = () => res();
      s.onerror = () => rej(new Error("우편번호 스크립트 로드 실패"));
      document.head.appendChild(s);
    });
  }
  function openPostcode(onPick) {
    if (document.querySelector(".postcode-overlay")) return; // 중복 열림 방지(focus+click)
    loadDaumPostcode().then(() => {
      const ov = document.createElement("div");
      ov.className = "postcode-overlay";
      ov.innerHTML = `<div class="postcode-box"><div class="postcode-head"><strong>도로명 주소 검색</strong><button type="button" class="postcode-close" aria-label="닫기">&times;</button></div><div class="postcode-embed"></div></div>`;
      document.body.appendChild(ov);
      const close = () => ov.remove();
      ov.querySelector(".postcode-close").onclick = close;
      ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
      new window.daum.Postcode({
        oncomplete: (data) => { onPick(data.roadAddress || data.jibunAddress || data.address || ""); close(); },
        width: "100%",
        height: "100%",
      }).embed(ov.querySelector(".postcode-embed"));
    }).catch(() => alert("주소 검색 도구를 불러오지 못했습니다. 네트워크 상태를 확인해 주세요."));
  }
  // 읽기전용 주소칸 클릭 시 검색창 열기 → 선택 후 상세주소로 포커스 이동
  function wireAddressSearch(addrInput, detailInput) {
    if (!addrInput) return;
    const open = () => openPostcode((addr) => { addrInput.value = addr; if (detailInput) detailInput.focus(); });
    addrInput.addEventListener("click", open);
    addrInput.addEventListener("focus", open);
  }
  // 주소 + 상세주소를 한 문자열로 합치기
  const joinAddr = (addr, detail) => [(addr || "").trim(), (detail || "").trim()].filter(Boolean).join(" ");

  function lock(msg) {
    box.innerHTML = `<div class="member-lock"><div class="lock-icon">🔒</div><h3>관리자 전용</h3><p>${msg}</p></div>`;
  }

  // ── localStorage에 저장된 Supabase 세션 읽기(getSession 미사용) ──
  function localSession() {
    try {
      const ref = new URL(window.SUPABASE_URL).hostname.split(".")[0];
      const raw = localStorage.getItem(`sb-${ref}-auth-token`);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.currentSession ? s.currentSession : s;
    } catch (e) { return null; }
  }

  const withTimeout = (p, ms, label) =>
    Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error((label || "요청") + " 응답이 지연됩니다")), ms)),
    ]);

  // ── Supabase REST 직접 호출 (요청 전체에 타임아웃) ──
  async function api(method, path, body, extraHeaders) {
    const sess = localSession();
    const token = sess && sess.access_token;
    const headers = { apikey: window.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    if (extraHeaders) Object.assign(headers, extraHeaders);
    return withTimeout((async () => {
      const res = await fetch(window.SUPABASE_URL + "/rest/v1/" + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const txt = await res.text();
      let data = null;
      try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
      if (!res.ok) {
        const msg = (data && (data.message || data.hint || data.error)) || ("HTTP " + res.status);
        const err = new Error(msg); err.status = res.status; throw err;
      }
      return data;
    })(), 8000, "서버");
  }
  const first = (arr) => (Array.isArray(arr) && arr.length ? arr[0] : null);

  function retryBox(html) {
    box.innerHTML = html + `<p style="text-align:center;margin-top:14px;"><button type="button" class="btn btn-line" id="adminRetry">다시 시도</button></p>`;
    const rb = document.getElementById("adminRetry");
    if (rb) rb.addEventListener("click", () => { box.innerHTML = '<p class="qt-loading">확인 중입니다…</p>'; start(); });
  }

  async function start() {
    console.log("[admin.js] v20260628s REST");
    // 어떤 경우에도 무한 "확인 중"이 남지 않도록 감시(캐시된 옛 코드/지연 대비)
    const watchdog = setTimeout(() => {
      if (/확인 중/.test(box.textContent || "")) retryBox('<p class="qt-loading">응답이 지연되고 있습니다.</p>');
    }, 11000);
    try {
      await run();
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (e && e.status === 401) {
        box.innerHTML = `<div class="member-lock"><div class="lock-icon">🔑</div><h3>다시 로그인이 필요합니다</h3><p>로그인 정보가 만료되었습니다. 우측 상단 "로그아웃" 후 다시 로그인해 주세요.</p></div>`;
      } else if (/profiles|schema cache|does not exist|relation/i.test(msg)) {
        box.innerHTML = `<div class="member-lock"><div class="lock-icon">🛠️</div><h3>회원 정보 테이블 준비 필요</h3><p>관리자가 Supabase에서 회원 프로필 테이블(profiles)을 생성하면 이용할 수 있습니다.</p></div>`;
      } else {
        retryBox(`<p class="qt-loading">불러오기 오류: ${esc(msg)}</p>`);
      }
    } finally {
      clearTimeout(watchdog);
    }
  }

  async function run() {
    const sess = localSession();
    const me = sess && sess.user;
    if (!me || !me.id) {
      lock('로그인 후 이용할 수 있습니다. 우측 상단 "로그인"을 눌러 주세요.');
      return;
    }

    // ===== 내 정보 수정 폼 =====
    const pForm = document.getElementById("profileForm");
    const pMsg = document.getElementById("profileMsg");
    let mineRow = null;
    if (pForm) {
      mineRow = first(await api("GET", `profiles?id=eq.${me.id}&select=*`));
      pForm.elements.name.value =
        (mineRow && mineRow.name) ||
        (me.user_metadata && (me.user_metadata.name || me.user_metadata.full_name)) ||
        (me.email ? me.email.split("@")[0] : "");
      if (pForm.elements.role) pForm.elements.role.value = (mineRow && mineRow.role) || "";
      if (mineRow && mineRow.phone) pForm.elements.phone.value = mineRow.phone;
      if (pForm.elements.birth && mineRow && mineRow.birth) pForm.elements.birth.value = mineRow.birth;
      if (pForm.elements.address && mineRow && mineRow.address) pForm.elements.address.value = mineRow.address;
      if (mineRow && mineRow.bio) pForm.elements.bio.value = mineRow.bio;
      wireAddressSearch(pForm.elements.address, pForm.elements.address_detail);

      // ── 가족(관계 선택 + 이름, ＋로 행 추가) ──
      const REL_OPTS = ["배우자", "부", "모", "장남", "차남", "삼남", "아들", "장녀", "차녀", "삼녀", "딸", "형", "오빠", "누나", "언니", "남동생", "여동생", "동생", "조부", "조모", "손자", "손녀", "사위", "며느리", "기타"];
      const famRows = document.getElementById("familyRows");
      const famAdd = document.getElementById("familyAdd");
      function addFamRow(rel, nm) {
        const row = document.createElement("div");
        row.className = "fam-row";
        row.style.cssText = "display:flex;gap:8px;margin-bottom:8px;align-items:center;";
        const sel = document.createElement("select");
        sel.className = "fam-rel";
        sel.style.cssText = "flex:0 0 130px;padding:9px;border:1px solid #dfe5ee;border-radius:8px;font:inherit;background:#fff;";
        sel.innerHTML = '<option value="">관계 선택</option>' + REL_OPTS.map((o) => "<option" + (o === rel ? " selected" : "") + ">" + o + "</option>").join("");
        const inp = document.createElement("input");
        inp.type = "text"; inp.className = "fam-name"; inp.maxLength = 40; inp.placeholder = "이름";
        inp.value = nm || ""; inp.style.cssText = "flex:1;min-width:0;padding:9px;border:1px solid #dfe5ee;border-radius:8px;font:inherit;";
        const del = document.createElement("button");
        del.type = "button"; del.className = "btn btn-line"; del.textContent = "✕";
        del.style.cssText = "flex:0 0 auto;padding:8px 12px;";
        del.onclick = () => row.remove();
        row.appendChild(sel); row.appendChild(inp); row.appendChild(del);
        famRows.appendChild(row);
        return row;
      }
      if (famRows && famAdd) {
        let fam0 = [];
        try { fam0 = mineRow && mineRow.family ? JSON.parse(mineRow.family) : []; } catch (e) { fam0 = []; }
        if (!Array.isArray(fam0)) fam0 = [];
        fam0.forEach((f) => addFamRow(f.rel, f.name));
        famAdd.onclick = () => { const r = addFamRow("", ""); const nm = r.querySelector(".fam-name"); if (nm) nm.focus(); };
      }

      pForm.hidden = false;
      pForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = pForm.elements.name.value.trim();
        const role = pForm.elements.role ? pForm.elements.role.value : "";
        const phone = pForm.elements.phone.value.trim();
        const birth = pForm.elements.birth ? pForm.elements.birth.value.trim() : "";
        const address = joinAddr(
          pForm.elements.address ? pForm.elements.address.value : "",
          pForm.elements.address_detail ? pForm.elements.address_detail.value : ""
        );
        const bio = pForm.elements.bio.value.trim();
        const payload = { id: me.id, name: name || null, email: me.email || null, role: role || null };
        if (phone) payload.phone = phone;
        if (birth) payload.birth = birth;
        if (address) payload.address = address;
        if (bio) payload.bio = bio;
        if (famRows) {
          const fam = [];
          famRows.querySelectorAll(".fam-row").forEach((r) => {
            const rel = r.querySelector(".fam-rel").value;
            const nm = r.querySelector(".fam-name").value.trim();
            if (rel || nm) fam.push({ rel: rel, name: nm });
          });
          payload.family = fam.length ? JSON.stringify(fam) : null;
        }
        try {
          await api("POST", "profiles?on_conflict=id", payload, { Prefer: "resolution=merge-duplicates,return=minimal" });
          pMsg.textContent = "저장되었습니다 ✓";
          pMsg.style.color = "var(--accent)";
          const slotName = document.querySelector(".auth-name");
          if (slotName && name) slotName.textContent = name + (role ? " " + role : "") + "님 ▾";
        } catch (err) {
          pMsg.textContent = "오류: " + err.message;
          pMsg.style.color = "#c0392b";
        }
        setTimeout(() => { pMsg.textContent = ""; }, 3000);
      };
    }

    // (비밀번호·이메일 변경은 js/account.js 의 '계정 관리' 섹션이 담당합니다)

    const adminRows = await api("GET", `admins?uid=eq.${me.id}&select=uid`);
    const isAdmin = Array.isArray(adminRows) && adminRows.length > 0;

    // ===== 연말정산 신청 폼 =====
    setupTaxForm(me, mineRow);

    // RLS: 관리자는 전체, 일반 회원은 본인 행만 반환됩니다.
    const rows = (await api("GET", "profiles?select=*&order=created_at.desc")) || [];

    if (isAdmin) {
      renderAdminTable(rows, me.id);
      if (countEl) countEl.textContent = `(${rows.length}명)`;
      loadTaxAdmin();
    } else {
      if (countEl) countEl.textContent = "";
      const mine = rows.filter((r) => r.id === me.id);
      box.innerHTML = `<p class="member-role-note">내 정보입니다.</p>` + memberTable(mine.length ? mine : [{ name: (me.user_metadata && me.user_metadata.name) || (me.email ? me.email.split("@")[0] : "성도"), provider: (me.app_metadata && me.app_metadata.provider) || "email", email: me.email, created_at: me.created_at }], false);
    }
  }

  // ===== 회원 목록 테이블 =====
  // 상태 표시: 정상 / 정지(사유 메모) / 탈퇴
  function statTag(r) {
    if (r.withdrawn_at) return `<span class="prov-tag" style="background:#ececec;color:#666">탈퇴</span>`;
    if (r.suspended_at) return `<span class="prov-tag" style="background:#fdecea;color:#c0392b">정지</span>`;
    return `<span class="prov-tag" style="background:#e8f3ec;color:#2f7d46">정상</span>`;
  }
  function suspendBtn(r, meId) {
    if (r.withdrawn_at || r.id === meId) return "";
    return r.suspended_at
      ? `<button type="button" class="btn btn-line susp-btn" data-act="unsuspend" style="padding:4px 12px;font-size:.8rem;">정지 해제</button>`
      : `<button type="button" class="btn btn-line susp-btn" data-act="suspend" style="padding:4px 12px;font-size:.8rem;color:#c0392b;border-color:#e4b6b0;">정지</button>`;
  }
  function memberTable(list, admin, meId) {
    return `
      <div class="member-table-wrap">
        <table class="member-table">
          <thead><tr><th>이름/닉네임</th><th>직분</th><th>가입 방식</th><th>이메일</th><th>가입일</th><th>상태</th>${admin ? "<th></th>" : ""}</tr></thead>
          <tbody>
            ${list.map((r) => `<tr data-uid="${esc(r.id)}" data-search="${esc(((r.name || "") + " " + (r.email || "")).toLowerCase())}">
              <td>${esc(r.name) || "-"}</td>
              <td>${admin && !r.withdrawn_at
                ? `<select class="role-input role-select">${roleOptions(r.role)}</select>`
                : (esc(r.role) || "-")}</td>
              <td><span class="prov-tag prov-${esc(r.provider)}">${provLabel(r.provider)}</span></td>
              <td>${esc(r.email) || "-"}</td>
              <td>${fmt(r.created_at)}</td>
              <td>${statTag(r)}${admin && r.suspended_at ? `<div style="font-size:.75rem;color:var(--ink-soft);margin-top:3px;">${r.suspend_note ? "사유: " + esc(r.suspend_note) : ""}${r.suspend_note ? " · " : ""}${fmt(r.suspended_at)}</div>` : ""}${admin && r.withdrawn_at ? `<div style="font-size:.75rem;color:var(--ink-soft);margin-top:3px;">${fmt(r.withdrawn_at)}</div>` : ""}</td>
              ${admin ? `<td style="white-space:nowrap;">${r.withdrawn_at ? "" : `<button type="button" class="btn btn-line role-save" style="padding:4px 12px;font-size:.8rem;">직분 저장</button> `}${suspendBtn(r, meId)}</td>` : ""}
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderAdminTable(rows, meId) {
    box.innerHTML = `<p class="member-role-note">관리자 모드 — 전체 회원을 보고, 직분 수정과 계정 정지를 할 수 있습니다.</p>
      <div style="margin:10px 0 14px;max-width:420px;"><input type="search" id="memberSearch" placeholder="🔍 이름·이메일 검색 (일부만 입력해도 됩니다)" style="width:100%;padding:10px 14px;border:1px solid #dfe5ee;border-radius:10px;font:inherit;" /></div>`
      + memberTable(rows, true, meId);

    // 이름·이메일 부분 일치 검색
    const search = box.querySelector("#memberSearch");
    if (search) search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      box.querySelectorAll("tr[data-uid]").forEach((tr) => {
        const hit = !q || (tr.getAttribute("data-search") || "").indexOf(q) >= 0;
        tr.style.display = hit ? "" : "none";
        if (hit) shown++;
      });
      if (countEl) countEl.textContent = q ? `(${shown}/${rows.length}명)` : `(${rows.length}명)`;
    });

    box.querySelectorAll("tr[data-uid]").forEach((tr) => {
      const uid = tr.getAttribute("data-uid");
      const input = tr.querySelector(".role-input");
      const btn = tr.querySelector(".role-save");
      if (uid && input && btn) btn.addEventListener("click", async () => {
        const role = input.value.trim();
        btn.disabled = true;
        const old = btn.textContent;
        btn.textContent = "저장 중…";
        try {
          await api("PATCH", `profiles?id=eq.${uid}`, { role: role || null }, { Prefer: "return=minimal" });
          btn.textContent = "저장됨 ✓";
          setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 2000);
        } catch (err) {
          btn.textContent = "오류";
          btn.style.color = "#c0392b";
          setTimeout(() => { btn.textContent = old; btn.style.color = ""; btn.disabled = false; }, 2500);
        }
      });

      // 계정 정지 / 정지 해제 (supabase/suspend.sql 의 admin_set_suspend 호출)
      const sbtn = tr.querySelector(".susp-btn");
      if (uid && sbtn) sbtn.addEventListener("click", async () => {
        const suspend = sbtn.getAttribute("data-act") === "suspend";
        let note = null;
        if (suspend) {
          note = prompt("정지 사유를 입력해 주세요 (관리자만 볼 수 있습니다):", "");
          if (note === null) return;
          if (!confirm("이 회원을 정지시킬까요?\n정지되면 즉시 로그아웃되고 다시 로그인할 수 없습니다.")) return;
        } else {
          if (!confirm("정지를 해제할까요? 다시 로그인할 수 있게 됩니다.")) return;
        }
        sbtn.disabled = true;
        sbtn.textContent = "처리 중…";
        try {
          await api("POST", "rpc/admin_set_suspend", { target: uid, suspend: suspend, note: note || null }, { Prefer: "return=minimal" });
        } catch (err) {
          alert(/could not find the function|schema cache/i.test(err.message)
            ? "정지 기능 준비가 필요합니다. 관리자가 Supabase ▸ SQL Editor 에서 supabase/suspend.sql 을 1회 실행해 주세요."
            : "오류: " + err.message);
        }
        start(); // 목록 새로고침
      });
    });
  }

  // ===== 연말정산 신청 폼 =====
  function setupTaxForm(me, mineRow) {
    const taxBox = document.getElementById("taxBox");
    const openBtn = document.getElementById("taxOpenBtn");
    const taxForm = document.getElementById("taxForm");
    const cancelBtn = document.getElementById("taxCancelBtn");
    const taxMsg = document.getElementById("taxMsg");
    if (!taxBox || !openBtn || !taxForm) return;
    taxBox.hidden = false;

    const meta = me.user_metadata || {};
    taxForm.elements.name.value = (mineRow && mineRow.name) || meta.name || meta.full_name || "";
    if (mineRow && mineRow.phone) taxForm.elements.phone.value = mineRow.phone;
    if (mineRow && mineRow.birth) taxForm.elements.birth.value = mineRow.birth;
    if (mineRow && mineRow.address) taxForm.elements.address.value = mineRow.address;
    wireAddressSearch(taxForm.elements.address, taxForm.elements.address_detail);

    // 주민번호 뒤 첫자리: 숫자 1개만 입력 허용
    const rrnEl = taxForm.elements.rrn_front;
    if (rrnEl) rrnEl.addEventListener("input", () => { rrnEl.value = rrnEl.value.replace(/\D/g, "").slice(0, 1); });

    openBtn.onclick = () => {
      taxForm.hidden = !taxForm.hidden;
      openBtn.textContent = taxForm.hidden ? "연말정산 신청하기" : "신청서 닫기";
    };
    if (cancelBtn) cancelBtn.onclick = () => {
      taxForm.hidden = true;
      openBtn.textContent = "연말정산 신청하기";
    };

    // 상단 메뉴 '연말정산'(admin.html#tax)으로 들어오면 신청서 자동 열기
    if (location.hash === "#tax") {
      taxForm.hidden = false;
      openBtn.textContent = "신청서 닫기";
      try { taxBox.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
    }

    taxForm.onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        user_id: me.id,
        name: taxForm.elements.name.value.trim(),
        phone: taxForm.elements.phone.value.trim(),
        birth: taxForm.elements.birth.value.trim(),
        rrn_front: (function () { const d = taxForm.elements.rrn_front.value.trim(); return d ? d + "******" : ""; })(),
        address: joinAddr(
          taxForm.elements.address.value,
          taxForm.elements.address_detail ? taxForm.elements.address_detail.value : ""
        ),
      };
      if (!payload.name || !payload.phone || !payload.birth || !payload.rrn_front || !payload.address) {
        taxMsg.textContent = "모든 항목을 입력해 주세요.";
        taxMsg.style.color = "#c0392b";
        return;
      }
      taxMsg.textContent = "제출 중…";
      taxMsg.style.color = "var(--ink-soft)";
      try {
        await api("POST", "tax_requests", payload, { Prefer: "return=minimal" });
      } catch (err) {
        taxMsg.textContent = /tax_requests|does not exist|relation|schema cache/i.test(err.message)
          ? "신청 테이블이 아직 준비되지 않았습니다. 관리자에게 문의해 주세요."
          : "오류: " + err.message;
        taxMsg.style.color = "#c0392b";
        return;
      }
      notifyAdminEmail(payload.name);
      taxMsg.textContent = "신청이 접수되었습니다. 감사합니다 🙏";
      taxMsg.style.color = "var(--accent)";
      taxForm.reset();
      setTimeout(() => {
        taxForm.hidden = true;
        openBtn.textContent = "연말정산 신청하기";
        taxMsg.textContent = "";
      }, 2500);
    };
  }

  // ===== 관리자 이메일 알림(FormSubmit) — 민감정보는 보내지 않음 =====
  function notifyAdminEmail(name) {
    const to = window.FORMSUBMIT_EMAIL;
    if (!to) return;
    const when = fmtT(new Date().toISOString());
    const body = {
      _subject: "[○○교회] 새 연말정산 신청 접수",
      _template: "table",
      _captcha: "false",
      신청자: name || "(이름 미상)",
      접수시각: when,
      안내: "전화·주소·주민번호 등 자세한 내용은 홈페이지 '내 정보 · 회원 관리' 페이지의 [연말정산 신청 내역]에서 확인해 주세요. (민감정보 보호를 위해 이메일에는 포함하지 않습니다.)",
    };
    try {
      fetch("https://formsubmit.co/ajax/" + encodeURIComponent(to), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
    } catch (e) {}
  }

  // ===== 관리자: 연말정산 신청 내역 =====
  async function loadTaxAdmin() {
    const wrap = document.getElementById("taxAdmin");
    const listEl = document.getElementById("taxList");
    const cntEl = document.getElementById("taxCount");
    if (!wrap || !listEl) return;
    wrap.hidden = false;
    let reqs;
    try {
      reqs = (await api("GET", "tax_requests?select=*&order=created_at.desc")) || [];
    } catch (err) {
      listEl.innerHTML = /tax_requests|does not exist|relation|schema cache/i.test(err.message)
        ? `<p class="member-role-note">연말정산 테이블(tax_requests)이 아직 생성되지 않았습니다.</p>`
        : `<p class="qt-loading">불러오기 오류: ${esc(err.message)}</p>`;
      return;
    }
    if (cntEl) cntEl.textContent = `(${reqs.length}건)`;
    if (!reqs.length) {
      listEl.innerHTML = `<p class="member-role-note">아직 접수된 신청이 없습니다.</p>`;
      return;
    }
    listEl.innerHTML = `
      <div class="member-table-wrap">
        <table class="member-table">
          <thead><tr><th>신청일</th><th>이름</th><th>전화번호</th><th>생년월일</th><th>주민번호 뒤</th><th>주소</th><th></th></tr></thead>
          <tbody>
            ${reqs.map((r) => `<tr data-id="${r.id}">
              <td>${fmtT(r.created_at)}</td>
              <td>${esc(r.name)}</td>
              <td>${esc(r.phone)}</td>
              <td>${esc(r.birth)}</td>
              <td>${esc(r.rrn_front)}</td>
              <td>${esc(r.address)}</td>
              <td><button type="button" class="btn btn-line tax-del" style="padding:4px 12px;font-size:.8rem;">삭제</button></td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p class="member-role-note" style="margin-top:10px;">🔒 민감정보입니다. 처리 후에는 삭제해 주세요.</p>`;
    listEl.querySelectorAll("tr[data-id]").forEach((tr) => {
      const id = tr.getAttribute("data-id");
      const btn = tr.querySelector(".tax-del");
      if (!id || !btn) return;
      btn.addEventListener("click", async () => {
        if (!confirm("이 신청 내역을 삭제할까요?")) return;
        btn.disabled = true;
        try {
          await api("DELETE", `tax_requests?id=eq.${id}`, null, { Prefer: "return=minimal" });
          tr.remove();
          if (cntEl) cntEl.textContent = `(${listEl.querySelectorAll("tr[data-id]").length}건)`;
        } catch (err) {
          btn.disabled = false;
          btn.textContent = "오류";
        }
      });
    });
  }

  start();
})();
