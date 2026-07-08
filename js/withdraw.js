/* ============================================================
   ○○교회 — 회원 탈퇴
   본인 프로필/연말정산 신청 데이터를 삭제하고 로그아웃합니다.
   (REST 직접 호출 — getSession 잠금 회피)
   ============================================================ */
(function () {
  const box = document.getElementById("withdrawBox");
  if (!box) return;

  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    box.innerHTML = '<p class="qt-loading">로그인 기능이 아직 연결되지 않았습니다.</p>';
    return;
  }

  function localSession() {
    try {
      const ref = new URL(window.SUPABASE_URL).hostname.split(".")[0];
      const raw = localStorage.getItem(`sb-${ref}-auth-token`);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.currentSession ? s.currentSession : s;
    } catch (e) { return null; }
  }
  function clearTokens() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.indexOf("sb-") === 0 && k.indexOf("-auth-token") !== -1) localStorage.removeItem(k);
      }
    } catch (e) {}
  }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("응답이 지연됩니다")), ms))]);
  async function api(method, path) {
    const sess = localSession();
    const token = sess && sess.access_token;
    const headers = { apikey: window.SUPABASE_ANON_KEY };
    if (token) headers.Authorization = "Bearer " + token;
    return withTimeout((async () => {
      const res = await fetch(window.SUPABASE_URL + "/rest/v1/" + path, { method, headers });
      if (!res.ok && res.status !== 404 && res.status !== 406) {
        let msg = "HTTP " + res.status;
        try { const j = JSON.parse(await res.text()); msg = j.message || j.hint || msg; } catch (e) {}
        const err = new Error(msg); err.status = res.status; throw err;
      }
      return true;
    })(), 8000);
  }

  function render() {
    const sess = localSession();
    const me = sess && sess.user;
    if (!me || !me.id) {
      box.innerHTML = `<div class="member-lock"><div class="lock-icon">🔒</div><h3>로그인이 필요합니다</h3>
        <p>회원 탈퇴는 로그인 후 이용할 수 있습니다. 우측 상단 "로그인"을 눌러 주세요.</p></div>`;
      return;
    }
    const name = (me.user_metadata && (me.user_metadata.name || me.user_metadata.full_name)) || (me.email ? me.email.split("@")[0] : "회원");
    box.innerHTML = `
      <div class="form-card">
        <h3 class="sub-title" style="text-align:left;margin-bottom:14px;">정말 탈퇴하시겠어요?</h3>
        <div class="withdraw-warn">
          <strong>${name}</strong>님, 탈퇴 시 아래 정보가 삭제됩니다.<br>
          · 내 프로필(직분·연락처·생년월일·주소 등)<br>
          · 내가 신청한 연말정산 내역<br><br>
          삭제된 정보는 복구할 수 없습니다. 게시판에 쓰신 글은 남을 수 있습니다.
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <button type="button" class="btn btn-danger" id="wdGo">회원 탈퇴하기</button>
          <a class="btn btn-line" href="index.html">취소</a>
          <span class="profile-msg" id="wdMsg"></span>
        </div>
      </div>`;
    const goBtn = document.getElementById("wdGo");
    const wdMsg = document.getElementById("wdMsg");
    goBtn.addEventListener("click", async () => {
      if (!confirm("회원 탈퇴를 진행할까요? 삭제된 정보는 복구할 수 없습니다.")) return;
      goBtn.disabled = true;
      wdMsg.textContent = "탈퇴 처리 중…";
      wdMsg.style.color = "var(--ink-soft)";
      try {
        // 본인 데이터 삭제(연말정산 → 프로필 순)
        try { await api("DELETE", `tax_requests?user_id=eq.${me.id}`); } catch (e) {}
        await api("DELETE", `profiles?id=eq.${me.id}`);
      } catch (err) {
        goBtn.disabled = false;
        wdMsg.textContent = "오류: " + err.message;
        wdMsg.style.color = "#c0392b";
        return;
      }
      // 로그아웃 처리
      clearTokens();
      if (window.__sb) { try { window.__sb.auth.signOut().catch(() => {}); } catch (e) {} }
      try { sessionStorage.setItem("flashMsg", "회원 탈퇴가 완료되었습니다. 그동안 함께해 주셔서 감사합니다."); } catch (e) {}
      location.href = "index.html";
    });
  }

  render();
})();
