/* ============================================================
   ○○교회 — 인증 (Supabase Auth: 이메일 + 카카오)
   layout.js가 SUPABASE 키 설정 시에만 이 파일을 로드합니다.
   window.__sb (Supabase 클라이언트)를 노출하고 'sb-ready' 이벤트를 발생시켜
   게시판(community.js)이 재사용할 수 있게 합니다.
   ============================================================ */
(function () {
  if (!window.supabase || !window.SUPABASE_URL) return;
  // 브라우저 창을 완전히 닫으면 로그인이 풀리도록 세션을 localStorage가 아닌
  // sessionStorage에 저장한다(sessionStorage는 탭/창을 닫으면 자동으로 사라짐).
  const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: { storage: window.sessionStorage },
  });
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
  const kakaoField = document.getElementById("kakaoField");

  const REMEMBER_KEY = "nojin_saved_email";
  const JOIN_KEY = "nojin_join_via";   // 교회 QR 코드(?join=qr)로 들어온 분 표시

  let mode = "login"; // 'login' | 'signup' | 'reset'(새 비밀번호 설정)

  // 카카오 버튼은 Supabase 에서 카카오 로그인이 켜져 있을 때만 보인다(켜기 전엔 눌러도 오류라 숨김).
  // 목사님이 Supabase ▸ Authentication ▸ Providers ▸ Kakao 를 켜면 코드 수정 없이 자동으로 나타난다.
  let KAKAO_ON = false;
  fetch(window.SUPABASE_URL + "/auth/v1/settings", { headers: { apikey: window.SUPABASE_ANON_KEY } })
    .then((r) => (r.ok ? r.json() : null))
    .then((s) => {
      KAKAO_ON = !!(s && s.external && s.external.kakao);
      if (kakaoField) kakaoField.hidden = !KAKAO_ON || mode === "reset";
      if (joinGuide) joinGuide.querySelector(".jg-kakao").hidden = !KAKAO_ON;
    })
    .catch(() => {});

  // QR 코드 주소(…/?join=qr)로 들어오면: 표시를 남기고 가입 창을 바로 연다
  try {
    const jp = new URLSearchParams(location.search).get("join");
    if (jp) {
      localStorage.setItem(JOIN_KEY, JSON.stringify({ via: jp === "1" ? "qr" : jp.slice(0, 20), at: Date.now() }));
      history.replaceState(null, "", location.pathname + location.hash);
      window.__joinFromQR = true;
    }
  } catch (_) {}
  function joinVia() {
    try {
      const j = JSON.parse(localStorage.getItem(JOIN_KEY) || "null");
      return j && Date.now() - j.at < 7 * 86400000 ? j.via : "";   // 7일 안에 가입하면 QR 가입으로 본다
    } catch (_) { return ""; }
  }

  // ── 가입 기본 정보(2026-10-10 목사님): 이메일 가입도 실명·휴대폰·생년월일·교회와의 관계·확인해 줄 내용을 받는다.
  //    user_metadata.signup 에 저장 → 승인 대기 목록(list_access 'signup')에서 관리자가 보고 판단한다.
  //    정보를 안 적으면 승인이 거절될 수 있다고 미리 알린다.
  const CH = (window.CHURCH && window.CHURCH.name) || "우리 교회";
  const RELATIONS = [CH + " 성도", CH + " 성도의 가족", "새로 오신 분(등록 전)", "다른 교회 성도"];
  const escA = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function signupFieldsHtml(v) {
    v = v || {};
    return `<div class="form-field"><label>휴대폰 번호 <b class="su-req">*</b></label><input type="tel" name="su_phone" inputmode="tel" autocomplete="tel" maxlength="13" placeholder="010-1234-5678" value="${escA(v.phone)}" /></div>
      <div class="form-field"><label>생년월일 <b class="su-req">*</b></label><input type="text" name="su_birth" inputmode="numeric" maxlength="10" placeholder="예: 1975-03-21" value="${escA(v.birth)}" /></div>
      <div class="form-field"><label>교회와의 관계 <b class="su-req">*</b></label><select name="su_relation"><option value="">골라 주세요</option>${RELATIONS.map((r) => `<option${v.relation === r ? " selected" : ""}>${escA(r)}</option>`).join("")}</select></div>
      <div class="form-field"><label>확인해 줄 수 있는 내용 <b class="su-req">*</b></label><input type="text" name="su_intro" maxlength="80" placeholder="예: 3구역 / 김○○ 권사 딸 / ○○교회 집사" value="${escA(v.intro)}" />
        <small class="su-hint">구역, 소개해 준 분, 가족 이름, 다니는 교회처럼 담당자가 누구신지 알 수 있는 내용</small></div>
      <div class="su-warn">⚠️ <b>기본 정보를 적지 않거나 사실과 다르면 승인이 거절될 수 있습니다.</b><br />적어 주신 정보는 담당자가 교인이신지 확인하는 데만 씁니다.</div>
      <label class="su-agree"><input type="checkbox" name="su_agree"${v.agreedAt ? " checked" : ""} /> 위 안내를 읽었고, 정보를 사실대로 적었습니다.</label>`;
  }
  // 입력값을 읽어 확인한다. 잘못되면 { err }, 맞으면 { info }
  function readSignupInfo(root, name) {
    const val = (n) => { const el = root.querySelector(`[name="${n}"]`); return el ? String(el.value || "").trim() : ""; };
    if (!/^[가-힣]{2,10}$|^[A-Za-z][A-Za-z .'-]{1,39}$/.test(name || "")) return { err: "이름은 실명으로 적어 주세요(예: 홍길동)." };
    const digits = val("su_phone").replace(/\D/g, "");
    if (!/^01[016789]\d{7,8}$/.test(digits)) return { err: "휴대폰 번호를 정확히 적어 주세요(예: 010-1234-5678)." };
    const phone = digits.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
    const bp = val("su_birth").split(/\D+/).filter(Boolean);       // 1980.5.6 · 1980-05-06 · 19800506 모두 받음
    const bd = bp.length === 3 ? bp[0] + bp[1].padStart(2, "0") + bp[2].padStart(2, "0") : bp.join("");
    const by = +bd.slice(0, 4), bm = +bd.slice(4, 6), bdd = +bd.slice(6, 8);
    const bDate = new Date(by, bm - 1, bdd);
    if (bd.length !== 8 || by < 1900 || bDate.getMonth() !== bm - 1 || bDate.getDate() !== bdd || bDate > new Date())
      return { err: "생년월일을 정확히 적어 주세요(예: 1975-03-21)." };
    const birth = `${bd.slice(0, 4)}-${bd.slice(4, 6)}-${bd.slice(6, 8)}`;
    const relation = val("su_relation");
    if (!RELATIONS.includes(relation)) return { err: "교회와의 관계를 골라 주세요." };
    const intro = val("su_intro");
    if (intro.length < 2) return { err: "담당자가 확인할 수 있는 내용(구역·소개해 준 분·다니는 교회 등)을 적어 주세요." };
    const agree = root.querySelector('[name="su_agree"]');
    if (!agree || !agree.checked) return { err: "안내를 읽고 '사실대로 적었습니다'에 체크해 주세요." };
    return { info: { phone, birth, relation, intro, agreedAt: new Date().toISOString() } };
  }
  // 회원가입 창에 기본 정보 칸을 붙인다(이름 칸 바로 아래, 가입 모드에서만 보임)
  let signupExtra = null;
  if (nameField) {
    signupExtra = document.createElement("div");
    signupExtra.className = "su-extra";
    signupExtra.hidden = true;
    signupExtra.innerHTML = signupFieldsHtml();
    const nl = nameField.querySelector("label"); if (nl) nl.innerHTML = '이름(실명) <b class="su-req">*</b>';
    const pf = document.getElementById("passwordField");
    if (pf) pf.after(signupExtra); else nameField.after(signupExtra);
  }

  function openModal() { modal.hidden = false; document.body.style.overflow = "hidden"; }

  async function startKakao() {
    const { error } = await sb.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: location.origin + location.pathname, scopes: "profile_nickname" },
    });
    if (error) { if (joinGuide) joinGuide.hidden = true; setMode("login"); openModal(); showMsg("카카오 로그인 오류: " + error.message, false); }
  }

  // 가입 안내(2026-10-04 목사님): 한 분은 계정 하나만 — 되도록 카카오로, 카카오톡을 쓰지 않으면 이메일(일반 가입)로.
  // 두 가지로 가입하면 카카오 계정 하나로 합친다는 것도 미리 알린다(2026-10-05 목사님).
  // '가입하기'를 누르면 이 창이 먼저 뜬다(헤더·QR 가입·로그인 창의 '회원가입' 모두).
  let joinGuide = null;
  function openJoinGuide() {
    if (!joinGuide) {
      joinGuide = document.createElement("div");
      joinGuide.className = "modal join-guide";
      joinGuide.hidden = true;
      joinGuide.innerHTML = `<div class="modal-backdrop" data-jg="close"></div>
        <div class="modal-box modal-box-auth" role="dialog" aria-modal="true" aria-labelledby="jgTitle">
          <button class="modal-close" data-jg="close" aria-label="닫기">&times;</button>
          <div class="auth-head">
            <img src="images/icon-192.png?v=20260926icon2" alt="" class="auth-logo" />
            <h3 id="jgTitle">가입 안내</h3>
            <p>한 분은 <b>계정 하나만</b> 만들어 주세요.</p>
          </div>
          <div class="jg-kakao">
            <button type="button" class="kakao-btn" data-jg="kakao">💬 카카오로 가입하기 <span class="jg-rec">추천</span></button>
            <p class="jg-note"><b>카카오톡을 쓰시면 카카오로 가입해 주세요.</b><br />버튼 한 번이면 끝나고, 비밀번호도 필요 없어요.</p>
            <div class="auth-divider">카카오톡을 쓰지 않으시면</div>
          </div>
          <button type="button" class="btn btn-line jg-email" data-jg="email">✉️ 이메일로 가입하기 (일반 가입)</button>
          <ul class="jg-warn">
            <li>카카오와 이메일로 <b>두 번 가입하시면 카카오 계정 하나로 합쳐 드립니다.</b> 그 뒤에는 이메일 계정으로 로그인할 수 없어요.</li>
            <li>이미 가입하셨다면 다시 가입하지 마시고 <button type="button" data-jg="login">로그인</button>해 주세요.</li>
          </ul>
        </div>`;
      document.body.appendChild(joinGuide);
      joinGuide.addEventListener("click", (e) => {
        const b = e.target.closest("[data-jg]");
        if (!b) return;
        const act = b.getAttribute("data-jg");
        if (act === "kakao") { startKakao(); return; }
        joinGuide.hidden = true;
        if (act === "email") { setMode("signup"); openModal(); }
        else if (act === "login") { setMode("login"); openModal(); }
        else document.body.style.overflow = "";
      });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !joinGuide.hidden) { joinGuide.hidden = true; document.body.style.overflow = ""; } });
    }
    joinGuide.querySelector(".jg-kakao").hidden = !KAKAO_ON;
    if (modal) modal.hidden = true;
    joinGuide.hidden = false; document.body.style.overflow = "hidden";
  }
  window.__openJoinGuide = openJoinGuide;

  // 첫 화면 환영 안내(2026-10-05 목사님): 가입하지 않은 분께 '가입 후 이용' 안내와 가입하기 단추.
  //  · 첫 화면(index)에서, 로그인하지 않았을 때만, 브라우저를 열 때마다 한 번.
  //  · 이 기기에서 한 번이라도 로그인한 분(이미 회원)에게는 띄우지 않는다(KNOWN_KEY).
  //  · 처음 오신 분은 '먼저 둘러볼게요'로 바로 닫고 볼 수 있다.
  const KNOWN_KEY = "nojin_known_member";
  let signedIn = false, welcomeChecked = false, welcomePop = null;
  let currentUid = null, msgBox = null;      // 메시지 보내기(⑤)
  function maybeWelcome() {
    if (welcomeChecked) return;
    welcomeChecked = true;
    if (!/(^|\/)(index\.html)?$/.test(location.pathname)) return;
    try { if (localStorage.getItem(KNOWN_KEY) || sessionStorage.getItem("nojin_welcome_shown")) return; } catch (_) { return; }
    setTimeout(() => {
      // 그사이 로그인했거나 다른 창(로그인·주보 등)이 떠 있으면 띄우지 않는다
      if (signedIn || document.querySelector(".modal:not([hidden]), .pop-modal:not([hidden])") || document.documentElement.classList.contains("pop-open")) return;
      try { sessionStorage.setItem("nojin_welcome_shown", "1"); } catch (_) {}
      openWelcome();
    }, 1200);
  }
  function closeWelcome() {
    if (!welcomePop || welcomePop.hidden) return;
    welcomePop.hidden = true;
    document.documentElement.classList.remove("pop-open");
    document.body.style.overflow = "";
  }
  function openWelcome() {
    if (!welcomePop) {
      const church = (window.CHURCH && window.CHURCH.name) || "우리 교회";
      welcomePop = document.createElement("div");
      welcomePop.className = "modal welcome-pop";
      welcomePop.hidden = true;
      welcomePop.innerHTML = `<div class="modal-backdrop" data-wp="close"></div>
        <div class="modal-box modal-box-auth" role="dialog" aria-modal="true" aria-labelledby="wpTitle">
          <button class="modal-close" data-wp="close" aria-label="닫기">&times;</button>
          <div class="auth-head">
            <img src="images/icon-192.png?v=20260926icon2" alt="" class="auth-logo" />
            <h3 id="wpTitle">환영합니다</h3>
          </div>
          <p class="wp-text">홈페이지를 원활하게 이용하시기 위해서는<br />가입 절차가 필요합니다.</p>
          <p class="wp-text wp-strong">${church} 성도님들께서는<br />회원가입 후 이용해 주세요.</p>
          <button type="button" class="btn btn-solid wp-join" data-wp="join">가입하기</button>
          <button type="button" class="btn btn-line wp-later" data-wp="close">먼저 둘러볼게요</button>
          <p class="wp-login">이미 가입하셨나요? <button type="button" data-wp="login">로그인</button></p>
        </div>`;
      document.body.appendChild(welcomePop);
      welcomePop.addEventListener("click", (e) => {
        const b = e.target.closest("[data-wp]");
        if (!b) return;
        const act = b.getAttribute("data-wp");
        closeWelcome();
        if (act === "join") openJoinGuide();
        else if (act === "login") { setMode("login"); openModal(); }
      });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeWelcome(); });
    }
    welcomePop.hidden = false;
    document.documentElement.classList.add("pop-open");   // 옆으로 밀기·밀기 안내가 이 창과 겹치지 않게
    document.body.style.overflow = "hidden";
  }
  // layout.js 가 먼저 그린 헤더 버튼은 auth.js 로드 전에도 눌릴 수 있다.
  // 그때 '가입하기'를 눌렀으면 __authPendingMode 에 남겨 두고, 여기서 이어받는다.
  window.__authSetMode = function (m) { setMode(m); };
  function closeModal() { modal.hidden = true; document.body.style.overflow = ""; if (msg) msg.hidden = true; }

  const SUB0 = subEl ? subEl.textContent : "";
  function setMode(m) {
    mode = m;
    const isReset = m === "reset";
    titleEl.textContent = isReset ? "새 비밀번호 설정" : m === "login" ? "로그인" : "회원가입";
    if (subEl) subEl.textContent = m === "signup" ? "카카오톡을 쓰지 않으시는 분의 일반 가입입니다. 카카오로도 가입하시면 카카오 계정 하나로 합쳐집니다." : SUB0;
    submitBtn.textContent = isReset ? "비밀번호 변경" : m === "login" ? "로그인" : "회원가입";
    nameField.hidden = m !== "signup";
    if (signupExtra) signupExtra.hidden = m !== "signup";
    if (channelField) channelField.hidden = m !== "signup";
    // 재설정 모드: 이메일 숨기고 비밀번호만 새로 입력
    if (emailField) emailField.hidden = isReset;
    if (emailInput) emailInput.required = !isReset;
    if (passwordLabel) passwordLabel.textContent = isReset ? "새 비밀번호" : "비밀번호";
    if (passwordInput) passwordInput.setAttribute("autocomplete", m === "login" ? "current-password" : "new-password");
    if (authOptions) authOptions.hidden = m !== "login";
    if (kakaoField) kakaoField.hidden = isReset || !KAKAO_ON;
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

  // Supabase 오류를 성도님들이 이해할 수 있는 말로 바꿔 보여준다
  // (탈퇴 계정은 이메일이 익명화되어 '없는 계정'이 되므로, banned 오류 = 정지된 계정)
  function contactSuffix() {
    const p = window.CHURCH && window.CHURCH.phone;
    return p && !/^010-0000/.test(p) ? ` (${p})` : "";
  }
  // 로그인이 막힌 계정: 정지된 계정이거나, 카카오 계정으로 합쳐 잠근 옛 이메일 계정(2026-10-04)
  const BLOCKED_TEXT = () => "이 계정으로는 지금 로그인할 수 없습니다(정지되었거나 다른 계정으로 합쳐진 계정). 카카오로 가입하신 분은 '카카오로 시작하기'를 눌러 주세요. 문의는 교회로 부탁드립니다" + contactSuffix() + ".";
  function friendlyError(err) {
    const m = (err && err.message) || "";
    if (/banned/i.test(m)) return BLOCKED_TEXT();
    if (/invalid login credentials/i.test(m)) return "이메일 또는 비밀번호가 올바르지 않습니다.";
    if (/email not confirmed/i.test(m)) return "이메일 인증이 완료되지 않았습니다. 가입 확인 메일을 확인해 주세요.";
    return "오류: " + (m || "다시 시도해 주세요.");
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
            <button type="button" class="btn btn-line ac-go ac-msg" data-sitemsg>✉ 교회에 메시지 보내기</button>
          </div>
        </div>
        <button class="auth-btn auth-msg-m" type="button" data-sitemsg>✉ 교회에 메시지 보내기</button>
        <button class="auth-btn" id="logoutBtn">로그아웃</button>`;
      slot.querySelectorAll("[data-sitemsg]").forEach((b) => { b.addEventListener("click", () => openMessage()); });
      currentUid = user.id;
      document.getElementById("logoutBtn").addEventListener("click", async () => {
        await sb.auth.signOut();
        location.reload();
      });
      // 직분이 지정돼 있으면 이름 옆에 붙여 표시(레이아웃의 헬퍼 재사용)
      if (window.__enhanceHeaderRole) window.__enhanceHeaderRole(user.id, name);
      signedIn = true;
      try { localStorage.setItem(KNOWN_KEY, "1"); } catch (_) {}   // 이 기기는 회원이 쓰는 기기 — 첫 화면 환영 안내를 띄우지 않는다
      closeWelcome();
      afterLogin(user);
    } else {
      signedIn = false;
      currentUid = null;
      if (window.__joinFromQR) { window.__joinFromQR = false; setTimeout(openJoinGuide, 300); }
      else maybeWelcome();
      // 로그인 + 가입하기를 나란히 — 처음 오신 분이 '로그인'만 보고 막히지 않도록
      slot.innerHTML = `<span class="auth-wrap-out"><button class="auth-btn" id="loginBtn">로그인</button><button class="auth-btn auth-btn-join" id="joinBtn">가입하기</button></span>`;
      document.getElementById("loginBtn").addEventListener("click", () => { setMode("login"); openModal(); });
      document.getElementById("joinBtn").addEventListener("click", openJoinGuide);
    }
  }

  // 로그인한 뒤 한 번씩 챙기는 일
  //  ① QR 코드로 들어와 가입했으면 '교회 QR 가입' 표시를 계정에 남긴다(담당자 승인 목록에 보임)
  //  ② 카카오로 가입하면 이름 자리에 카카오 별명이 들어가므로, 실명을 한 번 여쭤 저장한다
  // 화면이 로그인 표시를 여러 번 새로 그려도 이 순서(QR 표시 → 성함 → 승인 안내)는 한 번만 차례대로
  let afterLoginRun = null;
  function afterLogin(user) {
    if (!afterLoginRun) afterLoginRun = afterLoginOnce(user).catch(() => {});
    return afterLoginRun;
  }
  async function afterLoginOnce(user) {
    const meta = user.user_metadata || {};
    const via = joinVia();
    if (via) { try { localStorage.removeItem(JOIN_KEY); } catch (_) {} }   // 먼저 지워서 여러 번 보내지 않게
    if (via && !meta.join_via) {
      try { await sb.auth.updateUser({ data: { join_via: via } }); } catch (_) {}
    }
    const provider = (user.app_metadata && user.app_metadata.provider) || "email";
    let asked = false, infoAsked = false;
    try { asked = !!sessionStorage.getItem("nojin_name_asked"); infoAsked = !!sessionStorage.getItem("nojin_info_asked"); } catch (_) {}
    // 승인 대기 중인데 기본 정보가 없으면(예전 가입자·카카오 가입자) 기본 정보 창을 띄운다 — 성함도 함께 받는다
    if (!meta.signup && !infoAsked && (await isPending(user))) { await askSignupInfo(user, meta); return; }
    if (provider !== "email" && !meta.real_name && !asked) await askRealName(meta.name || meta.nickname || "");
    showPendingNotice(user);
    showGyojeokCheck(user);
  }

  // 정회원 승인 전인지(운영진 제외). 확인이 안 되면 false
  let pendingVal = null;
  async function isPending(user) {
    if (pendingVal !== null) return pendingVal;
    try {
      const { data } = await sb.from("member_links").select("member_status").eq("user_id", user.id).maybeSingle();
      if (data && data.member_status === "정회원") return (pendingVal = false);
      const perm = await sb.rpc("my_perms");
      if (!perm || perm.error || (perm.data && perm.data.isAdmin)) return (pendingVal = false);
      return (pendingVal = true);
    } catch (_) { return false; }
  }

  // 승인 대기 중인 분께: 기본 정보를 적어 달라는 창(적지 않으면 승인이 거절될 수 있음)
  function askSignupInfo(user, meta) {
    return new Promise((done) => {
      try { sessionStorage.setItem("nojin_info_asked", "1"); sessionStorage.setItem("nojin_pending_shown", "1"); } catch (_) {}
      const nick = meta.real_name || meta.name || meta.full_name || "";
      const box = document.createElement("div");
      box.className = "modal su-pop";
      box.innerHTML = `<div class="modal-backdrop"></div>
        <div class="modal-box" role="dialog" aria-modal="true" aria-label="기본 정보 적기" style="max-width:460px">
          <div style="text-align:center;font-size:2.2rem;line-height:1;margin-bottom:8px" aria-hidden="true">📝</div>
          <h3 style="font-family:'Noto Serif KR',serif;color:var(--accent);margin-bottom:8px;text-align:center">기본 정보를 적어 주세요</h3>
          <p style="color:var(--ink-soft);line-height:1.7;margin-bottom:14px;text-align:center;font-size:.95rem">가입해 주셔서 감사합니다. 지금은 <b>정회원 승인 대기 중</b>입니다.<br />담당자가 누구신지 확인할 수 있도록 아래 정보를 적어 주세요.</p>
          <form class="auth-form su-form">
            <div class="form-field"><label>이름(실명) <b class="su-req">*</b></label><input type="text" name="su_name" maxlength="30" autocomplete="name" placeholder="예: 홍길동" value="${escA(/^[가-힣]{2,10}$/.test(nick) ? nick : "")}" /></div>
            ${signupFieldsHtml()}
            <p class="auth-msg err su-msg" hidden></p>
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button type="button" class="btn btn-line" data-later>나중에</button>
              <button type="submit" class="btn btn-solid">저장</button>
            </div>
          </form>
        </div>`;
      document.body.appendChild(box);
      document.body.style.overflow = "hidden";
      const f = box.querySelector("form"), m = box.querySelector(".su-msg");
      const close = () => { box.remove(); document.body.style.overflow = ""; done(); };
      box.querySelector("[data-later]").onclick = () => {
        if (confirm("기본 정보를 적지 않으시면 승인이 늦어지거나 거절될 수 있습니다.\n다음에 로그인할 때 다시 여쭙겠습니다. 닫을까요?")) close();
      };
      f.onsubmit = async (e) => {
        e.preventDefault();
        const name = f.querySelector('[name="su_name"]').value.trim();
        const chk = readSignupInfo(f, name);
        if (chk.err) { m.hidden = false; m.textContent = chk.err; return; }
        const btn = f.querySelector('[type="submit"]'); btn.disabled = true;
        try {
          const { error } = await sb.auth.updateUser({ data: { real_name: name, name, signup: chk.info } });
          if (error) throw error;
          try { await sb.rpc("set_my_name", { p_name: name }); } catch (_) {}
          box.querySelector(".modal-box").innerHTML = `<div style="text-align:center">
            <div style="font-size:2.2rem;line-height:1;margin-bottom:10px" aria-hidden="true">✅</div>
            <h3 style="font-family:'Noto Serif KR',serif;color:var(--accent);margin-bottom:10px">저장했습니다</h3>
            <p style="color:var(--ink-soft);line-height:1.8;margin-bottom:18px">담당자가 확인한 뒤 승인해 드립니다.<br />승인되면 주보·사진 등 교회 정보를 보실 수 있습니다.</p>
            <button type="button" class="btn btn-solid" data-ok style="min-width:140px">확인</button></div>`;
          box.querySelector("[data-ok]").onclick = () => { close(); renderAuth(); };
        } catch (err) {
          btn.disabled = false; m.hidden = false; m.textContent = "저장하지 못했습니다: " + ((err && err.message) || err);
        }
      };
    });
  }

  // ④ 정회원이 되어 교적과 연결된 뒤 처음 로그인하면, 교적부를 확인해 달라고 한 번 안내한다.
  //    (이 기기에서 한 번 — 대시보드의 '내 교적' 카드는 늘 남아 있으므로 거듭 띄우지 않는다)
  async function showGyojeokCheck(user) {
    const key = "nojin_gj_check_" + user.id;
    try { if (localStorage.getItem(key)) return; } catch (_) { return; }
    let row = null;
    try {
      const r = await sb.rpc("my_gyojeok");
      row = r && !r.error && Array.isArray(r.data) ? r.data[0] : null;
    } catch (_) { return; }
    if (!row) return;                       // 아직 교적과 연결 전(준회원) → 승인 대기 안내가 대신 뜬다
    const waitFree = () => new Promise((res) => {
      let n = 0;
      (function tick() {
        if (!document.querySelector(".modal:not([hidden])") || n++ > 40) return res();
        setTimeout(tick, 500);
      })();
    });
    await waitFree();                       // 실명 확인 같은 다른 창이 떠 있으면 닫힐 때까지
    try { localStorage.setItem(key, "1"); } catch (_) {}
    const onDash = /dashboard\.html$/.test(location.pathname);
    const box = document.createElement("div");
    box.className = "modal";
    box.innerHTML = `<div class="modal-backdrop" data-close></div>
      <div class="modal-box" role="dialog" aria-modal="true" aria-label="교적부 확인 안내" style="max-width:460px;text-align:center">
        <div style="font-size:2.4rem;line-height:1;margin-bottom:10px" aria-hidden="true">📋</div>
        <h3 style="font-family:'Noto Serif KR',serif;color:var(--accent);margin-bottom:12px">교적부를 확인해 주세요</h3>
        <p style="color:var(--ink-soft);line-height:1.85;margin-bottom:18px">교적부를 확인하시어 잘못된 곳이 있다면<br /><b>교역자에게 말씀해 주시길 바랍니다.</b></p>
        <button type="button" class="btn btn-solid" data-go style="min-width:170px;margin-bottom:8px">내 교적 확인하기</button><br />
        <button type="button" class="btn btn-line" data-close style="min-width:170px">나중에</button>
      </div>`;
    document.body.appendChild(box);
    box.querySelectorAll("[data-close]").forEach((b) => { b.onclick = () => box.remove(); });
    box.querySelector("[data-go]").onclick = () => {
      box.remove();
      if (onDash) { const t = document.getElementById("myGyojeok"); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }
      else location.href = "dashboard.html#myGyojeok";
    };
  }

  // ══════════ ⑤ 교회에 메시지 보내기 (2026-10-07) ══════════
  // 받는 사람은 목사님(최고 운영자)뿐. 목사님이 확인하면 보낸 분 목록에 '확인하였습니다'가 뜬다.
  // 저장·권한은 DB(site_messages, RLS)가 맡고, 텔레그램 알림은 사무실 PC 의 login_watch.py 가 보낸다.
  const MSG_KIND = { "일반": "일반 문의", "교적수정": "교적 수정 요청" };
  const escM = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const whenM = (t) => { const d = new Date(t); return isNaN(d) ? "" : `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

  async function loadMyMessages() {
    const list = msgBox.querySelector("#smList");
    list.innerHTML = '<p class="sm-empty">불러오는 중…</p>';
    const { data, error } = await sb.from("site_messages")
      .select("id,kind,body,created_at,checked_at")
      .eq("user_id", currentUid)
      .order("created_at", { ascending: false }).limit(10);
    if (error) { list.innerHTML = '<p class="sm-empty">아직 준비 중입니다. 잠시 후 다시 열어 주세요.</p>'; return; }
    if (!data || !data.length) { list.innerHTML = '<p class="sm-empty">아직 보낸 메시지가 없습니다.</p>'; return; }
    list.innerHTML = data.map((m) => `<div class="sm-item">
        <div class="sm-top"><span class="sm-kind">${escM(MSG_KIND[m.kind] || m.kind)}</span><span class="sm-when">${escM(whenM(m.created_at))}</span></div>
        <div class="sm-body">${escM(m.body)}</div>
        ${m.checked_at
          ? `<div class="sm-state done">✓ 확인하였습니다 <small>${escM(whenM(m.checked_at))}</small></div>`
          : '<div class="sm-state">전달됨 · 확인 전</div>'}
      </div>`).join("");
  }

  function openMessage(opts) {
    opts = opts || {};
    if (!signedIn || !currentUid) { setMode("login"); openModal(); return; }
    if (!msgBox) {
      msgBox = document.createElement("div");
      msgBox.className = "modal site-msg";
      msgBox.hidden = true;
      msgBox.innerHTML = `<div class="modal-backdrop" data-smclose></div>
        <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="smTitle" style="max-width:520px">
          <button class="modal-close" data-smclose aria-label="닫기">&times;</button>
          <h3 id="smTitle" style="font-family:'Noto Serif KR',serif;color:var(--accent);margin-bottom:6px">✉ 교회에 메시지 보내기</h3>
          <p class="sm-note">목사님께 전달됩니다. 확인하시면 아래 목록에 <b>‘확인하였습니다’</b>가 표시됩니다.</p>
          <label class="sm-lab" for="smKind">종류</label>
          <select id="smKind" class="sm-input">
            <option value="일반">일반 문의</option>
            <option value="교적수정">교적 수정 요청</option>
          </select>
          <label class="sm-lab" for="smBody">내용</label>
          <textarea id="smBody" class="sm-input" rows="5" maxlength="2000" placeholder="전하실 말씀을 적어 주세요."></textarea>
          <div class="sm-actions"><button type="button" class="btn btn-solid" id="smSend">보내기</button><span id="smMsg" class="sm-msg"></span></div>
          <h4 class="sm-h4">내가 보낸 메시지</h4>
          <div id="smList"></div>
        </div>`;
      document.body.appendChild(msgBox);
      const close = () => { msgBox.hidden = true; document.body.style.overflow = ""; };
      msgBox.querySelectorAll("[data-smclose]").forEach((b) => { b.onclick = close; });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && msgBox && !msgBox.hidden) close(); });
      msgBox.querySelector("#smSend").onclick = async () => {
        const btn = msgBox.querySelector("#smSend"), out = msgBox.querySelector("#smMsg");
        const body = msgBox.querySelector("#smBody").value.trim();
        const kind = msgBox.querySelector("#smKind").value;
        if (!body) { out.className = "sm-msg err"; out.textContent = "내용을 적어 주세요."; return; }
        btn.disabled = true; out.className = "sm-msg"; out.textContent = "보내는 중…";
        const { error } = await sb.from("site_messages").insert({ kind, body });
        btn.disabled = false;
        if (error) {
          out.className = "sm-msg err";
          out.textContent = /10건/.test(error.message || "") ? error.message : "보내지 못했습니다. 잠시 후 다시 시도해 주세요.";
          return;
        }
        msgBox.querySelector("#smBody").value = "";
        out.className = "sm-msg ok"; out.textContent = "✓ 보냈습니다. 목사님께 전달됩니다.";
        loadMyMessages();
      };
    }
    msgBox.querySelector("#smKind").value = opts.kind === "교적수정" ? "교적수정" : "일반";
    msgBox.querySelector("#smMsg").textContent = "";
    if (opts.text) msgBox.querySelector("#smBody").value = opts.text;
    msgBox.hidden = false;
    document.body.style.overflow = "hidden";
    loadMyMessages();
    setTimeout(() => { const t = msgBox.querySelector("#smBody"); if (t) t.focus(); }, 50);
  }
  window.SiteMessage = { open: openMessage };

  // ③ 아직 정회원 승인 전이면 안내 창을 (이 창을 닫을 때까지) 한 번 띄운다
  let pendingChecked = false;
  async function showPendingNotice(user) {
    if (pendingChecked) return;
    pendingChecked = true;
    try { if (sessionStorage.getItem("nojin_pending_shown")) return; } catch (_) {}
    try {
      const { data } = await sb.from("member_links").select("member_status").eq("user_id", user.id).maybeSingle();
      if (data && data.member_status === "정회원") return;
      const perm = await sb.rpc("my_perms");                        // 운영진(관리자)은 안내하지 않음
      if (perm && perm.data && perm.data.isAdmin) return;
    } catch (_) { return; }                                          // 확인이 안 되면 띄우지 않음
    try { sessionStorage.setItem("nojin_pending_shown", "1"); } catch (_) {}
    const box = document.createElement("div");
    box.className = "modal";
    box.innerHTML = `<div class="modal-backdrop" data-ok></div>
      <div class="modal-box" role="dialog" aria-modal="true" aria-label="정회원 승인 대기 안내" style="max-width:460px;text-align:center">
        <div style="font-size:2.4rem;line-height:1;margin-bottom:10px" aria-hidden="true">⏳</div>
        <h3 style="font-family:'Noto Serif KR',serif;color:var(--accent);margin-bottom:10px">정회원 승인 대기 중입니다</h3>
        <p style="color:var(--ink-soft);line-height:1.8;margin-bottom:6px">가입해 주셔서 감사합니다.<br /><b>운영진의 승인이 필요합니다.</b></p>
        <p style="color:var(--ink-soft);line-height:1.8;font-size:.95rem;margin-bottom:18px">교인이심이 확인되면 주보·헌금 내역 등<br />교회 정보를 보실 수 있습니다.</p>
        <button type="button" class="btn btn-solid" data-ok style="min-width:140px">확인</button>
      </div>`;
    document.body.appendChild(box);
    box.querySelectorAll("[data-ok]").forEach((b) => { b.onclick = () => box.remove(); });
  }

  function askRealName(nick) {
    return new Promise((resolveName) => {
    try { sessionStorage.setItem("nojin_name_asked", "1"); } catch (_) {}
    const box = document.createElement("div");
    box.className = "modal";
    box.innerHTML = `<div class="modal-backdrop"></div>
      <div class="modal-box" role="dialog" aria-modal="true" aria-label="성함 알려 주기" style="max-width:440px">
        <h3 style="font-family:'Noto Serif KR',serif;color:var(--accent);margin-bottom:8px">반갑습니다!</h3>
        <p style="color:var(--ink-soft);line-height:1.7;margin-bottom:16px">교회에서 쓰시는 <b>성함</b>을 알려 주세요.<br />담당자가 교인이신지 확인할 때만 씁니다.</p>
        <form id="realNameForm">
          <input type="text" name="n" required maxlength="30" autocomplete="name" placeholder="예: 홍길동" value=""
            style="width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:1.05rem" />
          <p id="realNameMsg" style="color:#c0392b;font-size:.9rem;margin-top:8px" hidden></p>
          <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
            <button type="button" class="btn btn-line" data-later>나중에</button>
            <button type="submit" class="btn btn-solid">저장</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(box);
    const input = box.querySelector("input");
    if (nick && /^[가-힣]{2,4}$/.test(nick)) input.value = nick;   // 카카오 이름이 한글 실명처럼 보이면 미리 채움
    setTimeout(() => input.focus(), 50);
    const close = () => { box.remove(); resolveName(); };
    box.querySelector("[data-later]").onclick = close;
    box.querySelector("#realNameForm").onsubmit = async (e) => {
      e.preventDefault();
      const v = input.value.trim();
      const m = box.querySelector("#realNameMsg");
      if (!v) return;
      try {
        const { error } = await sb.auth.updateUser({ data: { real_name: v, name: v } });
        if (error) throw error;
        await sb.rpc("set_my_name", { p_name: v });
        close();
        renderAuth();
      } catch (err) { m.hidden = false; m.textContent = "저장하지 못했습니다: " + ((err && err.message) || err); }
    };
    });
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
    toggleBtn.addEventListener("click", () => { if (mode === "signup") setMode("login"); else openJoinGuide(); });
    // auth.js 로드 전에 '가입하기'를 눌러 모달이 열려 있으면 가입 안내 창으로 바꿔 준다
    if (window.__authPendingMode) {
      const pm = window.__authPendingMode; window.__authPendingMode = null;
      if (pm === "signup") openJoinGuide(); else setMode(pm);
    }

    // 비밀번호 찾기: 입력한 이메일로 재설정 메일 발송
    if (forgotBtn) {
      forgotBtn.addEventListener("click", async () => {
        const email = (emailInput && emailInput.value || "").trim();
        if (!email) { showMsg("먼저 이메일을 입력해 주세요.", false); if (emailInput) emailInput.focus(); return; }
        forgotBtn.disabled = true;
        try {
          const { error } = await sb.auth.resetPasswordForEmail(email, {
            redirectTo: location.origin + "/reset.html",
          });
          if (error) throw error;
          showMsg("비밀번호 재설정 메일을 보냈습니다. 메일의 링크는 30분 동안 1회만 사용할 수 있습니다.", true);
        } catch (err) {
          showMsg("오류: " + (err.message || "다시 시도해 주세요."), false);
        } finally {
          forgotBtn.disabled = false;
        }
      });
    }

    if (kakaoBtn) kakaoBtn.addEventListener("click", startKakao);

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
          const chk = readSignupInfo(form, name);
          if (chk.err) { showMsg(chk.err, false); return; }
          const meta = { name, real_name: name, signup: chk.info };
          if (joinVia()) meta.join_via = joinVia();
          const { data, error } = await sb.auth.signUp({ email, password, options: { data: meta } });
          if (error) throw error;
          // Supabase 의 '이메일 확인' 설정이 꺼져 있으면 세션이 바로 나오고 메일도 안 간다.
          // 예전에는 무조건 "확인 메일을 보냈습니다"라고 띄워서 안내와 실제가 어긋났다.
          if (data && data.session) {
            showMsg("가입이 완료되었습니다. 교회 정보는 담당자 승인 후에 보실 수 있습니다.", true);
            setTimeout(() => { closeModal(); location.reload(); }, 1600);
          } else {
            showMsg("가입 확인 메일을 보냈습니다. 메일의 링크를 눌러 인증해 주세요.", true);
          }
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
        showMsg(friendlyError(err), false);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // 카카오 로그인이 정지 계정으로 거부되면 주소 해시에 오류가 담겨 돌아온다 → 안내 표시
  (function checkOAuthBanned() {
    try {
      const h = new URLSearchParams((location.hash || "").replace(/^#/, ""));
      const desc = (h.get("error_description") || "") + " " + (h.get("error_code") || "");
      if (h.get("error") && /banned/i.test(desc)) {
        history.replaceState(null, "", location.pathname + location.search);
        const text = BLOCKED_TEXT();
        if (modal) { setMode("login"); openModal(); showMsg(text, false); }
        else alert(text);
      }
    } catch (_) {}
  })();

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
