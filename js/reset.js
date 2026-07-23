/* ============================================================
   ○○교회 — 비밀번호 재설정 (reset.html)
   이메일의 재설정 링크(1회용)로 진입하면 Supabase가 임시 세션을 만들고,
   여기서 새 비밀번호(8자 이상)를 저장합니다.
   ============================================================ */
(function () {
  const box = document.getElementById("resetBox");
  if (!box) return;

  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    box.innerHTML = '<p class="qt-loading">로그인 기능이 아직 연결되지 않았습니다.</p>';
    return;
  }

  // 링크가 만료/재사용된 경우 주소 해시에 error가 담겨 온다
  function hashError() {
    const h = new URLSearchParams((location.hash || "").replace(/^#/, ""));
    if (h.get("error")) {
      const d = h.get("error_description") || "";
      if (/expired|invalid/i.test(d) || /otp_expired/i.test(h.get("error_code") || "")) return "재설정 링크가 만료되었거나 이미 사용되었습니다.";
      return "재설정 링크가 올바르지 않습니다.";
    }
    return null;
  }

  function renderError(text) {
    box.innerHTML = `<div class="member-lock"><div class="lock-icon">⏱️</div><h3>${text}</h3>
      <p>홈으로 이동해 로그인 창의 "비밀번호를 잊으셨나요?"를 눌러 재설정 메일을 다시 받아 주세요.<br>링크는 받은 뒤 30분 동안 1회만 사용할 수 있습니다.</p>
      <a class="btn btn-solid" href="index.html" style="margin-top:14px;">홈으로</a></div>`;
  }

  function renderForm(sb) {
    box.innerHTML = `
      <form class="form-card" id="resetForm" style="max-width:480px;">
        <h3 class="sub-title" style="text-align:left;margin-bottom:14px;">새 비밀번호 설정</h3>
        <div class="form-field"><label>새 비밀번호 (8자 이상)</label><input type="password" name="pw1" required minlength="8" autocomplete="new-password" /></div>
        <div class="form-field" style="margin-top:12px;"><label>새 비밀번호 확인</label><input type="password" name="pw2" required minlength="8" autocomplete="new-password" /></div>
        <div class="form-actions" style="margin-top:18px;display:flex;gap:10px;align-items:center;">
          <button type="submit" class="btn btn-solid" id="resetGo">비밀번호 변경</button>
          <span class="profile-msg" id="resetMsg"></span>
        </div>
      </form>`;
    const form = document.getElementById("resetForm");
    const msg = document.getElementById("resetMsg");
    const go = document.getElementById("resetGo");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const pw1 = fd.get("pw1"), pw2 = fd.get("pw2");
      if (String(pw1).length < 8) { msg.textContent = "비밀번호는 8자 이상이어야 합니다."; msg.style.color = "#c0392b"; return; }
      if (pw1 !== pw2) { msg.textContent = "두 비밀번호가 서로 다릅니다."; msg.style.color = "#c0392b"; return; }
      go.disabled = true; msg.textContent = "변경 중…"; msg.style.color = "var(--ink-soft)";
      try {
        const { error } = await sb.auth.updateUser({ password: pw1 });
        if (error) throw error;
        msg.textContent = "";
        box.innerHTML = `<div class="member-lock"><div class="lock-icon">✅</div><h3>비밀번호가 변경되었습니다</h3>
          <p>새 비밀번호로 로그인된 상태입니다. 홈으로 이동해 이용해 주세요.</p>
          <a class="btn btn-solid" href="index.html" style="margin-top:14px;">홈으로</a></div>`;
      } catch (err) {
        go.disabled = false;
        const m = (err && err.message) || "";
        msg.textContent = /same password|different from the old/i.test(m) ? "이전과 다른 비밀번호를 입력해 주세요." : ("오류: " + (m || "다시 시도해 주세요."));
        msg.style.color = "#c0392b";
      }
    });
  }

  async function init(sb) {
    const he = hashError();
    if (he) { renderError(he); return; }
    // 재설정 링크로 들어오면 Supabase가 주소의 토큰을 세션으로 교환한다(잠깐 걸릴 수 있음)
    for (let i = 0; i < 20; i++) {
      const { data } = await sb.auth.getSession();
      if (data && data.session) { renderForm(sb); return; }
      await new Promise((r) => setTimeout(r, 300));
    }
    renderError("재설정 링크가 만료되었거나 이미 사용되었습니다.");
  }

  if (window.__sb) init(window.__sb);
  else window.addEventListener("sb-ready", (e) => init(e.detail.sb), { once: true });
})();
