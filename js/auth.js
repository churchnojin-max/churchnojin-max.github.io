/* ============================================================
   ○○교회 — 인증 (Supabase Auth: 이메일 + 카카오)
   layout.js가 SUPABASE 키 설정 시에만 이 파일을 로드합니다.
   window.__sb (Supabase 클라이언트)를 노출하고 'sb-ready' 이벤트를 발생시켜
   게시판(community.js)이 재사용할 수 있게 합니다.
   ============================================================ */
(function () {
  if (!window.supabase || !window.SUPABASE_URL) return;
  const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  window.__sb = sb;

  const slot = document.getElementById("authSlot");
  const modal = document.getElementById("authModal");
  const form = document.getElementById("authForm");
  const msg = document.getElementById("authMsg");
  const titleEl = document.getElementById("authTitle");
  const subEl = document.getElementById("authSubtitle");
  const nameField = document.getElementById("nameField");
  const emailField = document.getElementById("emailField");
  const passwordField = document.getElementById("passwordField");
  const passwordInput = passwordField ? passwordField.querySelector("input") : null;
  const passwordLabel = document.getElementById("passwordLabel");
  const emailInput = form ? form.querySelector('input[name="email"]') : null;
  const channelField = document.getElementById("channelField");
  const authOptions = document.getElementById("authOptions");
  const authSwitch = document.querySelector(".auth-switch");
  const rememberChk = document.getElementById("rememberEmail");
  const forgotBtn = document.getElementById("authForgot");
  const submitBtn = document.getElementById("authSubmit");
  const toggleBtn = document.getElementById("authToggle");
  const kakaoBtn = document.getElementById("kakaoLogin"); // 이메일 전용이면 없음(null)

  const REMEMBER_KEY = "nojin_saved_email";

  let mode = "login"; // 'login' | 'signup' | 'reset'(새 비밀번호 설정)

  function openModal() { modal.hidden = false; document.body.style.overflow = "hidden"; }
  function closeModal() { modal.hidden = true; document.body.style.overflow = ""; if (msg) msg.hidden = true; }

  function setMode(m) {
    mode = m;
    const isReset = m === "reset";
    titleEl.textContent = isReset ? "새 비밀번호 설정" : m === "login" ? "로그인" : "회원가입";
    submitBtn.textContent = isReset ? "비밀번호 변경" : m === "login" ? "로그인" : "회원가입";
    nameField.hidden = m !== "signup";
    if (channelField) channelField.hidden = m !== "signup";
    // 재설정 모드: 이메일 숨기고 비밀번호만 새로 입력
    if (emailField) emailField.hidden = isReset;
    if (emailInput) emailInput.required = !isReset;
    if (passwordLabel) passwordLabel.textContent = isReset ? "새 비밀번호" : "비밀번호";
    if (passwordInput) passwordInput.setAttribute("autocomplete", m === "login" ? "current-password" : "new-password");
    if (authOptions) authOptions.hidden = m !== "login";
    if (authSwitch) authSwitch.hidden = isReset;
    if (toggleBtn) toggleBtn.textContent = m === "login" ? "회원가입" : "로그인하기";
    if (authSwitch && authSwitch.firstChild)
      authSwitch.firstChild.textContent = m === "login" ? "처음이신가요? " : "이미 회원이신가요? ";
    msg.hidden = true;
  }

  function showMsg(text, ok) {
    msg.hidden = false;
    msg.textContent = text;
    msg.className = "auth-msg" + (ok ? " ok" : " err");
  }

  // 헤더 로그인 상태 표시
  async function renderAuth() {
    const { data } = await sb.auth.getSession();
    const user = data && data.session && data.session.user;
    if (!slot) return;
    if (user) {
      const meta = user.user_metadata || {};
      const name = meta.name || meta.full_name || meta.nickname || (user.email ? user.email.split("@")[0] : "성도");
      const email = user.email || "";
      const provider = (user.app_metadata && user.app_metadata.provider) || "email";
      const providerLabel = provider === "kakao" ? "카카오" : provider === "email" ? "이메일" : provider;
      const created = user.created_at ? new Date(user.created_at) : null;
      const joined = created ? `${created.getFullYear()}.${String(created.getMonth() + 1).padStart(2, "0")}.${String(created.getDate()).padStart(2, "0")}` : "";
      const avatar = meta.avatar_url || meta.picture || "";
      slot.innerHTML = `
        <div class="auth-wrap">
          <a class="auth-name" href="admin.html" title="내 정보 보기">${name}님 ▾</a>
          <div class="auth-card" role="menu">
            <div class="ac-head">
              ${avatar ? `<img class="ac-avatar" src="${avatar}" alt="" />` : '<div class="ac-avatar ac-avatar-default">👤</div>'}
              <div class="ac-meta">
                <div class="ac-name">${name}</div>
                ${email ? `<div class="ac-email">${email}</div>` : ""}
              </div>
            </div>
            <div class="ac-rows">
              <div class="ac-row"><span>가입 방식</span><strong class="prov-tag prov-${provider}">${providerLabel}</strong></div>
              ${joined ? `<div class="ac-row"><span>가입일</span><strong>${joined}</strong></div>` : ""}
            </div>
            <a class="btn btn-line ac-go" href="admin.html">내 정보 · 수정</a>
          </div>
        </div>
        <button class="auth-btn" id="logoutBtn">로그아웃</button>`;
      document.getElementById("logoutBtn").addEventListener("click", async () => {
        await sb.auth.signOut();
        location.reload();
      });
      // 직분이 지정돼 있으면 이름 옆에 붙여 표시(레이아웃의 헬퍼 재사용)
      if (window.__enhanceHeaderRole) window.__enhanceHeaderRole(user.id, name);
    } else {
      slot.innerHTML = `<button class="auth-btn" id="loginBtn">로그인</button>`;
      document.getElementById("loginBtn").addEventListener("click", () => { setMode("login"); openModal(); });
    }
  }

  // 저장된 이메일 미리 채우기
  if (emailInput) {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) { emailInput.value = saved; if (rememberChk) rememberChk.checked = true; }
    } catch (_) {}
  }

  // 모달 동작
  if (modal) {
    modal.addEventListener("click", (e) => { if (e.target.hasAttribute("data-close")) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });
    toggleBtn.addEventListener("click", () => setMode(mode === "signup" ? "login" : "signup"));

    // 비밀번호 찾기: 입력한 이메일로 재설정 메일 발송
    if (forgotBtn) {
      forgotBtn.addEventListener("click", async () => {
        const email = (emailInput && emailInput.value || "").trim();
        if (!email) { showMsg("먼저 이메일을 입력해 주세요.", false); if (emailInput) emailInput.focus(); return; }
        forgotBtn.disabled = true;
        try {
          const { error } = await sb.auth.resetPasswordForEmail(email, {
            redirectTo: location.origin + location.pathname,
          });
          if (error) throw error;
          showMsg("비밀번호 재설정 메일을 보냈습니다. 메일의 링크를 눌러 새 비밀번호를 설정해 주세요.", true);
        } catch (err) {
          showMsg("오류: " + (err.message || "다시 시도해 주세요."), false);
        } finally {
          forgotBtn.disabled = false;
        }
      });
    }

    if (kakaoBtn) {
      kakaoBtn.addEventListener("click", async () => {
        const { error } = await sb.auth.signInWithOAuth({
          provider: "kakao",
          options: { redirectTo: location.origin + location.pathname, scopes: "profile_nickname" },
        });
        if (error) showMsg("카카오 로그인 오류: " + error.message, false);
      });
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const email = fd.get("email"), password = fd.get("password"), name = (fd.get("name") || "").trim();
      submitBtn.disabled = true;
      try {
        if (mode === "reset") {
          // 메일 링크로 진입한 상태(복구 세션)에서 새 비밀번호 저장
          const { error } = await sb.auth.updateUser({ password });
          if (error) throw error;
          showMsg("비밀번호가 변경되었습니다. 이제 로그인됩니다.", true);
          setTimeout(() => { closeModal(); location.reload(); }, 1200);
        } else if (mode === "signup") {
          const { error } = await sb.auth.signUp({
            email, password, options: { data: { name: name || email.split("@")[0] } },
          });
          if (error) throw error;
          showMsg("가입 확인 메일을 보냈습니다. 메일의 링크를 눌러 인증해 주세요.", true);
        } else {
          const { error } = await sb.auth.signInWithPassword({ email, password });
          if (error) throw error;
          // 이메일 기억하기
          try {
            if (rememberChk && rememberChk.checked) localStorage.setItem(REMEMBER_KEY, email);
            else localStorage.removeItem(REMEMBER_KEY);
          } catch (_) {}
          closeModal();
          location.reload();
        }
      } catch (err) {
        showMsg("오류: " + (err.message || "다시 시도해 주세요."), false);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  sb.auth.onAuthStateChange((event) => {
    // 비밀번호 재설정 메일 링크로 돌아오면 새 비밀번호 입력 폼을 띄운다
    if (event === "PASSWORD_RECOVERY" && modal) {
      setMode("reset");
      openModal();
      if (passwordInput) passwordInput.focus();
    }
    renderAuth();
  });
  renderAuth();
  window.dispatchEvent(new CustomEvent("sb-ready", { detail: { sb } }));
})();
