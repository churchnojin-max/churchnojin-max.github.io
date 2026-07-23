/* ============================================================
   ○○교회 — 계정 관리 (admin.html '내 정보')
   이메일 가입자: 이메일 변경(확인 메일), 비밀번호 변경(현재 비밀번호 재확인)
   카카오 가입자: 카카오에서 관리됨을 안내
   ============================================================ */
(function () {
  const wrap = document.getElementById("accountBox");
  const body = document.getElementById("accountBody");
  if (!wrap || !body) return;

  function init(sb) {
    sb.auth.getSession().then(({ data }) => {
      const user = data && data.session && data.session.user;
      if (!user) return;                    // 비로그인 → 섹션 숨김 유지
      wrap.hidden = false;
      const provider = (user.app_metadata && user.app_metadata.provider) || "email";
      if (provider !== "email") {
        body.innerHTML = `<p style="color:var(--ink-soft);font-size:.92rem;">카카오 계정으로 가입하셨습니다. 이메일·비밀번호는 카카오에서 관리되므로 여기서 변경할 수 없습니다.</p>`;
        return;
      }
      body.innerHTML = `
        <p style="color:var(--ink-soft);font-size:.9rem;margin-bottom:16px;">현재 이메일: <b>${user.email || ""}</b></p>

        <form id="emailForm" style="margin-bottom:26px;">
          <h4 style="font-size:.95rem;margin-bottom:10px;">이메일 변경</h4>
          <div class="form-field"><label>새 이메일</label><input type="email" name="newEmail" required placeholder="new@example.com" /></div>
          <div class="form-actions" style="margin-top:12px;display:flex;gap:10px;align-items:center;">
            <button type="submit" class="btn btn-line">확인 메일 보내기</button>
            <span class="profile-msg" id="emailMsg"></span>
          </div>
          <p style="color:var(--ink-soft);font-size:.8rem;margin-top:8px;">※ 새 이메일로 확인 메일이 발송되며, 메일의 링크를 눌러야 변경이 완료됩니다.</p>
        </form>

        <form id="pwForm">
          <h4 style="font-size:.95rem;margin-bottom:10px;">비밀번호 변경</h4>
          <div class="form-field"><label>현재 비밀번호</label><input type="password" name="cur" required autocomplete="current-password" /></div>
          <div class="form-field" style="margin-top:10px;"><label>새 비밀번호 (8자 이상)</label><input type="password" name="pw1" required minlength="8" autocomplete="new-password" /></div>
          <div class="form-field" style="margin-top:10px;"><label>새 비밀번호 확인</label><input type="password" name="pw2" required minlength="8" autocomplete="new-password" /></div>
          <div class="form-actions" style="margin-top:12px;display:flex;gap:10px;align-items:center;">
            <button type="submit" class="btn btn-line">비밀번호 변경</button>
            <span class="profile-msg" id="pwMsg"></span>
          </div>
        </form>`;

      const say = (el, text, ok) => { el.textContent = text; el.style.color = ok ? "var(--accent)" : "#c0392b"; };

      // ── 이메일 변경 ──
      const emailForm = document.getElementById("emailForm");
      const emailMsg = document.getElementById("emailMsg");
      emailForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const newEmail = (new FormData(emailForm).get("newEmail") || "").trim();
        const btn = emailForm.querySelector("button");
        btn.disabled = true; say(emailMsg, "처리 중…", true);
        try {
          const { error } = await sb.auth.updateUser({ email: newEmail });
          if (error) throw error;
          say(emailMsg, "확인 메일을 보냈습니다. 메일함을 확인해 주세요.", true);
        } catch (err) {
          const m = (err && err.message) || "";
          say(emailMsg, /already/i.test(m) ? "이미 사용 중인 이메일입니다." : "오류: " + m, false);
        } finally { btn.disabled = false; }
      });

      // ── 비밀번호 변경 (현재 비밀번호 재확인 후 진행) ──
      const pwForm = document.getElementById("pwForm");
      const pwMsg = document.getElementById("pwMsg");
      pwForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(pwForm);
        const cur = fd.get("cur"), pw1 = fd.get("pw1"), pw2 = fd.get("pw2");
        if (String(pw1).length < 8) { say(pwMsg, "새 비밀번호는 8자 이상이어야 합니다.", false); return; }
        if (pw1 !== pw2) { say(pwMsg, "새 비밀번호 두 칸이 서로 다릅니다.", false); return; }
        const btn = pwForm.querySelector("button");
        btn.disabled = true; say(pwMsg, "확인 중…", true);
        try {
          // 보안: 현재 비밀번호가 맞는지 다시 로그인으로 확인
          const { error: verifyErr } = await sb.auth.signInWithPassword({ email: user.email, password: cur });
          if (verifyErr) throw new Error("현재 비밀번호가 올바르지 않습니다.");
          const { error } = await sb.auth.updateUser({ password: pw1 });
          if (error) {
            if (/same password|different from the old/i.test(error.message)) throw new Error("이전과 다른 비밀번호를 입력해 주세요.");
            throw error;
          }
          pwForm.reset();
          say(pwMsg, "비밀번호가 변경되었습니다.", true);
        } catch (err) {
          say(pwMsg, err.message || "다시 시도해 주세요.", false);
        } finally { btn.disabled = false; }
      });
    });
  }

  if (window.__sb) init(window.__sb);
  else window.addEventListener("sb-ready", (e) => init(e.detail.sb), { once: true });
})();
