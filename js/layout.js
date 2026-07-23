/* ============================================================
   ○○교회 — 공유 레이아웃 (모든 페이지 공통)
   헤더(5대메뉴)·푸터·설치배너 주입 + 스크롤/모바일메뉴 + PWA/푸시
   ============================================================ */
(function () {
  const NAV = [
    { href: "dashboard.html", label: "대시보드", memberOnly: true },
    { href: "welcome.html", label: "처음 오셨나요", sub: [
      { href: "welcome.html#worship", label: "예배 안내" },
      { href: "welcome.html#directions", label: "교회 가는 길" },
      { href: "welcome.html#about", label: "우리 교회는 어떤 곳" },
      { href: "welcome.html#newfamily", label: "새가족 등록" },
    ] },
    { href: "word.html", label: "말씀으로", sub: [
      { href: "word.html#sermon", label: "이번 주 말씀" },
      { href: "word.html#qt", label: "매일 말씀 묵상" },
      { href: "word.html#archive", label: "주보" },
      { href: "word.html#believe", label: "우리가 믿는 것" },
      { href: "word.html#column", label: "목사님의 글" },
    ] },
    { href: "story.html", label: "우리 이야기", sub: [
      { href: "story.html#album", label: "우리들 소식" },
      { href: "story.html#notice", label: "공지사항" },
      { href: "story.html#board", label: "게시판" },
      { href: "story.html#request", label: "기도 부탁" },
      { href: "story.html#thisweek", label: "이번 주 기도 제목" },
      { href: "story.html#howpray", label: "이렇게 기도합니다" },
      { href: "story.html#qna", label: "삶의 질문" },
      { href: "story.html#groups", label: "섬김 부서" },
      { href: "story.html#history", label: "교회 연혁" },
      { href: "story.html#communities", label: "그리스도의 몸 된 지체들" },
    ] },
    { href: "world.html", label: "지역과 세상", sub: [
      { href: "world.html#local", label: "지역 연합사역" },
      { href: "world.html#mission", label: "선교" },
    ] },
    { href: "library.html", label: "자료실", sub: [
      { href: "library.html#edu", label: "교육 자료실" },
      { href: "library.html#worship", label: "예배 자료실" },
    ] },
    { href: "finance.html", label: "교회행정", adminOnly: true, sub: [
      { href: "finance.html", label: "재정관리" },
      { href: "gyojeok.html", label: "교적관리" },
      { href: "affairs.html", label: "목회행정" },
      { href: "home-settings.html", label: "홈페이지 설정" },
    ] },
  ];

  const path = location.pathname.split("/").pop() || "index.html";

  // ===== 우리 교회 정보(js/church.js) 읽기 =====
  const C = window.CHURCH || {};
  const CH_NAME = C.name || "우리 교회";
  const CH_EN_LINE = (C.nameEn || "") + (C.since ? " · SINCE " + C.since : "");
  const CH_PASTORS = (C.pastors || []).map((p) => `${p.role} ${p.name}`).join(" · ");
  const CH_ADDR = C.address || "";
  const CH_PHONE = C.phone || "";
  const CH_TEL = (C.phone || "").replace(/[^0-9+]/g, "");
  const CH_YEAR = new Date().getFullYear();
  const CH_COPY_EN = C.nameEn || CH_NAME;
  const G = C.give || {};
  const GIVE_DIGITS = (G.tossDigits || G.account || "").replace(/[^0-9]/g, "");
  const GIVE_ON = !!(G.account && String(G.account).replace(/[^0-9]/g, "").length >= 6);
  const KAKAO_ON = !!(C.kakaoChannel && C.kakaoChannel.indexOf("http") === 0);

  // ===== 헤더 =====
  const navLinks = NAV.map((n) => {
    const active = path === n.href.split("#")[0] ? ' class="active"' : "";
    const admAttr = n.adminOnly ? ' id="navAdmin" style="display:none"' : (n.memberOnly ? ' id="navMember" style="display:none"' : "");
    if (!n.sub) return `<div class="nav-item"${admAttr}><a href="${n.href}"${active}>${n.label}</a></div>`;
    const subs = n.sub.map((s) => `<a href="${s.href}">${s.label}</a>`).join("");
    return `<div class="nav-item has-sub"${admAttr}>
        <a href="${n.href}"${active}>${n.label}<span class="nav-caret" aria-hidden="true">⌄</span></a>
        <div class="nav-dropdown"><div class="nav-dropdown-inner">${subs}</div></div>
      </div>`;
  }).join("");

  const headerHTML = `
    <header id="header">
      <div class="nav-inner">
        <a href="index.html" class="logo">
          <img src="images/icon-192.png?v=20260625e" alt="" class="logo-mark" />
          <span class="logo-kr">${CH_NAME}</span>
        </a>
        <a href="dashboard.html" class="hdr-dash-btn" id="hdrDash" style="display:none">대시보드</a>
        <nav class="nav-menu" id="navMenu">${navLinks}</nav>
        <div class="auth-slot" id="authSlot"></div>
        <button class="nav-toggle" id="navToggle" aria-label="메뉴 열기"><span></span><span></span><span></span></button>
      </div>
    </header>`;
  document.body.insertAdjacentHTML("afterbegin", headerHTML);

  // ===== 홈페이지 설정(공개 읽기) — 로고 · 섬기는 사람들 · 월별 봉사위원 =====
  // church_settings 의 공개 키를 익명 anon 키로 1회씩 읽어 캐시한다.
  // (쓰기는 관리자 전용. 공개 읽기 정책은 supabase/homepage-settings.sql 참고)
  window.SiteSettings = (function () {
    const cache = {};
    function fetchKey(key) {
      if (cache[key]) return cache[key];
      if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
        cache[key] = Promise.resolve(null);
        return cache[key];
      }
      const url = window.SUPABASE_URL + "/rest/v1/church_settings?key=eq." + key + "&select=data";
      cache[key] = fetch(url, { headers: { apikey: window.SUPABASE_ANON_KEY } })
        .then((r) => (r.ok ? r.json() : null))
        .then((rows) => (rows && rows[0] && rows[0].data) || null)
        .catch(() => null);
      return cache[key];
    }
    return {
      homepage: () => fetchKey("homepage"),
      committees: () => fetchKey("committees"),
    };
  })();

  // 헤더/설치배너/로그인창 로고를 설정값(dataURL)으로 교체
  window.SiteSettings.homepage().then((hp) => {
    const logo = hp && hp.logo;
    if (!logo) return;
    ["#header .logo-mark", ".install-icon", ".auth-logo"].forEach((sel) => {
      document.querySelectorAll(sel).forEach((img) => { img.src = logo; });
    });
  });

  // ===== 푸터 =====
  const footerHTML = `
    <footer class="footer">
      <div class="container footer-inner">
        <div class="footer-brand">
          <span class="logo-kr">${CH_NAME}</span>
          <span class="logo-en">${CH_EN_LINE}</span>
        </div>
        <nav class="footer-nav">${NAV.filter((n) => !n.adminOnly && !n.memberOnly).map((n) => `<a href="${n.href}">${n.label}</a>`).join("")}<a href="bylaws.html">정관</a><a href="terms.html">이용약관</a><a href="privacy.html">개인정보처리방침</a><a href="withdraw.html">회원탈퇴</a></nav>
        <div class="footer-actions">
          ${KAKAO_ON ? `<a class="kakao-channel-btn" href="${C.kakaoChannel}" target="_blank" rel="noopener">💬 카카오톡 채널 추가</a>` : ""}
          ${GIVE_ON ? `<a class="give-btn" id="giveOnlineBtn" href="javascript:void(0)">💝 온라인헌금</a>` : ""}
        </div>
        <div class="footer-meta">
          ${CH_PASTORS ? `<p>${CH_PASTORS}</p>` : ""}
          <p>${CH_ADDR}${CH_ADDR && CH_PHONE ? " · " : ""}${CH_PHONE ? `T. <a href="tel:${CH_TEL}">${CH_PHONE}</a>` : ""}</p>
          <p class="copy">© ${CH_YEAR} ${CH_COPY_EN}. All rights reserved.</p>
        </div>
      </div>
    </footer>
    <div class="install-bar" id="installBar" hidden>
      <img src="images/icon-192.png?v=20260625e" alt="${CH_NAME}" class="install-icon" />
      <div class="install-text">
        <strong>${CH_NAME} 앱 설치</strong>
        <span id="installMsg">홈 화면에 추가하여 앱처럼 사용하세요.</span>
      </div>
      <button class="install-go" id="installGo">설치</button>
      <button class="install-close" id="installClose" aria-label="닫기">&times;</button>
    </div>

    <!-- 로그인/회원가입 모달 -->
    <div class="modal" id="authModal" hidden>
      <div class="modal-backdrop" data-close></div>
      <div class="modal-box modal-box-auth" role="dialog" aria-modal="true" aria-label="로그인">
        <button class="modal-close" data-close aria-label="닫기">&times;</button>
        <div class="auth-head">
          <img src="images/icon-192.png?v=20260625e" alt="" class="auth-logo" />
          <h3 id="authTitle">로그인</h3>
          <p id="authSubtitle">${CH_NAME} 나눔터에 오신 것을 환영합니다.</p>
        </div>
        <form id="authForm" class="auth-form">
          <div class="form-field" id="nameField" hidden><label>이름</label><input type="text" name="name" autocomplete="name" placeholder="홍길동" /></div>
          <div class="form-field" id="emailField"><label>이메일</label><input type="email" name="email" required autocomplete="username" placeholder="name@example.com" /></div>
          <div class="form-field" id="passwordField"><label id="passwordLabel">비밀번호</label><input type="password" name="password" required minlength="6" autocomplete="current-password" placeholder="6자 이상" /></div>
          <div class="auth-options" id="authOptions">
            <label class="auth-remember"><input type="checkbox" id="rememberEmail" /> 이메일 기억하기</label>
            <button type="button" class="auth-forgot" id="authForgot">비밀번호 찾기</button>
          </div>
          <p class="auth-msg" id="authMsg" hidden></p>
          <button type="submit" class="btn btn-solid auth-submit" id="authSubmit">로그인</button>
        </form>
        <p class="auth-switch">처음이신가요? <button type="button" id="authToggle">회원가입</button></p>
      </div>
    </div>

    <!-- 온라인 헌금 모달 -->
    <div class="modal" id="giveModal" hidden>
      <div class="modal-backdrop" data-give-close></div>
      <div class="modal-box modal-box-give" role="dialog" aria-modal="true" aria-label="온라인 헌금">
        <button class="modal-close" data-give-close aria-label="닫기">&times;</button>
        <div class="give-head">
          <span class="give-emoji">💝</span>
          <h3>온라인 헌금</h3>
          <p>아래 계좌로 헌금하실 수 있습니다. 정성을 다해 드리는 헌금에 감사드립니다.</p>
        </div>
        <div class="give-acct">
          <span class="give-bank">${G.bank || ""}</span>
          <span class="give-no" id="giveAcctNo">${G.account || ""}</span>
          <span class="give-holder">예금주 · ${G.holder || CH_NAME}</span>
        </div>
        <div class="give-actions">
          ${G.tossDigits ? `<a class="give-toss" id="giveTossBtn" href="supertoss://send?bank=${encodeURIComponent(G.bank || "")}&accountNo=${GIVE_DIGITS}">📲 토스로 송금하기</a>` : ""}
          <button type="button" class="give-copy" id="giveCopyBtn">📋 계좌번호 복사</button>
        </div>
        <p class="give-note">‘토스로 송금하기’는 토스 앱이 설치된 휴대폰에서 송금 화면으로 연결됩니다. 그 외에는 계좌번호를 복사해 이용해 주세요.</p>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", footerHTML);
  // 온라인 헌금 모달 동작
  (function () {
    var giveBtn = document.getElementById("giveOnlineBtn");
    var giveModal = document.getElementById("giveModal");
    if (giveBtn && giveModal) {
      var openGive = function () { giveModal.removeAttribute("hidden"); document.body.style.overflow = "hidden"; };
      var closeGive = function () { giveModal.setAttribute("hidden", ""); document.body.style.overflow = ""; };
      giveBtn.addEventListener("click", openGive);
      giveModal.querySelectorAll("[data-give-close]").forEach(function (el) { el.addEventListener("click", closeGive); });
      var copyBtn = document.getElementById("giveCopyBtn");
      if (copyBtn) copyBtn.addEventListener("click", function () {
        var num = (window.CHURCH && window.CHURCH.give && (window.CHURCH.give.tossDigits || window.CHURCH.give.account) || "").replace(/[^0-9]/g, "");
        var done = function () { var o = copyBtn.textContent; copyBtn.textContent = "✓ 복사되었습니다"; copyBtn.classList.add("copied"); setTimeout(function () { copyBtn.textContent = o; copyBtn.classList.remove("copied"); }, 1800); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(num).then(done, function () { window.prompt("계좌번호를 복사하세요", num); });
        } else { window.prompt("계좌번호를 복사하세요", num); }
      });
    }
  })();

  // ===== 토스트 메시지(로그아웃 등 안내) =====
  function showFlash(msg) {
    try {
      const t = document.createElement("div");
      t.className = "flash-toast";
      t.textContent = msg;
      t.setAttribute("style", "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:rgba(34,51,80,.96);color:#fff;padding:12px 22px;border-radius:30px;font-size:.95rem;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:9999;opacity:0;transition:opacity .25s;");
      document.body.appendChild(t);
      requestAnimationFrame(() => { t.style.opacity = "1"; });
      setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 2600);
    } catch (e) {}
  }
  // 다른 페이지로 이동한 뒤에도 안내가 보이도록(예: 로그아웃 후 홈)
  try {
    const fm = sessionStorage.getItem("flashMsg");
    if (fm) { sessionStorage.removeItem("flashMsg"); showFlash(fm); }
  } catch (e) {}

  // ===== 헤더 스크롤 상태 =====
  const header = document.getElementById("header");
  const hasHero = !!document.querySelector(".hero, .page-hero");
  const onScroll = () => {
    if (window.scrollY > 60 || !hasHero) header.classList.add("scrolled");
    else header.classList.remove("scrolled");
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ===== 모바일 메뉴 =====
  const navToggle = document.getElementById("navToggle");
  const navMenu = document.getElementById("navMenu");
  // 배경 딤(backdrop): 메뉴 열리면 본문 위를 덮어 비침/오작동 방지 + 탭하면 닫힘
  const navBackdrop = document.createElement("div");
  navBackdrop.className = "nav-backdrop";
  navBackdrop.id = "navBackdrop";
  // 헤더 안에 넣어야 메뉴(z-index 106)가 딤(104) 위에 와서 클릭됨
  header.appendChild(navBackdrop);

  function openMenu() {
    navMenu.classList.add("open");
    header.classList.add("menu-open");
    navBackdrop.classList.add("show");
    document.body.classList.add("menu-lock");   // 뒤 본문 스크롤 잠금
  }
  function closeMenu() {
    navMenu.classList.remove("open");
    header.classList.remove("menu-open");
    navBackdrop.classList.remove("show");
    document.body.classList.remove("menu-lock");
  }
  navToggle.addEventListener("click", () => {
    if (header.classList.contains("menu-open")) closeMenu(); else openMenu();
  });
  navBackdrop.addEventListener("click", closeMenu);
  navMenu.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", closeMenu)
  );
  // 모바일: 상위 메뉴의 ⌄ 캐럿을 누르면 하위 메뉴 펼침/접힘 (텍스트는 그대로 이동)
  navMenu.querySelectorAll(".nav-item.has-sub > a .nav-caret").forEach((c) =>
    c.addEventListener("click", (e) => {
      if (window.matchMedia("(max-width: 760px)").matches) {
        e.preventDefault();
        e.stopPropagation();
        c.closest(".nav-item").classList.toggle("open");
      }
    })
  );

  // ===== 알림 설정 버튼(🔔) — 클릭 시 휴대폰/브라우저 알림 권한 요청 =====
  const notifyBtn = document.getElementById("notifyBtn");
  if (notifyBtn) {
    function markNotifyState() {
      try { notifyBtn.classList.toggle("on", "Notification" in window && Notification.permission === "granted"); } catch (e) {}
    }
    markNotifyState();
    notifyBtn.addEventListener("click", function () {
      if (!window.ONESIGNAL_APP_ID) { alert("알림 기능이 아직 준비 중입니다."); return; }
      if (!("Notification" in window)) { alert("이 브라우저는 알림을 지원하지 않습니다."); return; }
      if (Notification.permission === "granted") { alert("이미 알림을 받고 있습니다 🔔"); return; }
      if (Notification.permission === "denied") {
        alert("브라우저에서 알림이 차단되어 있습니다.\n주소창 왼쪽 자물쇠(🔒) → 사이트 설정 → 알림을 '허용'으로 바꿔 주세요.");
        return;
      }
      // 기본(미결정) 상태 → 권한 팝업 띄우기
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function (OneSignal) {
        try {
          await OneSignal.Notifications.requestPermission();
        } catch (e) {
          try { await OneSignal.Slidedown.promptPush(); } catch (e2) {}
        }
        setTimeout(markNotifyState, 800);
      });
    });
  }

  // ===== 서비스 워커(PWA) — 등록만(자동 새로고침 없음: 새로고침 루프 방지) =====
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  // ===== 푸시 알림(OneSignal) — App ID 설정 시에만 =====
  if (window.ONESIGNAL_APP_ID) {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    const s = document.createElement("script");
    s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    s.defer = true;
    document.head.appendChild(s);
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        await OneSignal.init({
          appId: window.ONESIGNAL_APP_ID,
          serviceWorkerPath: "OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/onesignal/" },
          allowLocalhostAsSecureOrigin: true,
          notifyButton: {
            enable: true,
            size: "medium",
            position: "bottom-right",
            text: {
              "tip.state.unsubscribed": "매일 QT 알림 받기",
              "tip.state.subscribed": "QT 알림을 받고 있습니다",
              "tip.state.blocked": "알림이 차단되어 있습니다",
              "message.prenotify": "클릭하여 매일 아침 QT 알림을 받으세요",
              "message.action.subscribed": "이제 매일 아침 QT를 받습니다 🙏",
              "message.action.resubscribed": "QT 알림을 다시 받습니다 🙏",
              "message.action.unsubscribed": "QT 알림을 끕니다",
              "dialog.main.title": CH_NAME + " QT 알림",
              "dialog.main.button.subscribe": "알림 받기",
              "dialog.main.button.unsubscribe": "알림 끄기",
              "dialog.blocked.title": "알림 차단 해제",
              "dialog.blocked.message": "브라우저 설정에서 알림을 허용해 주세요.",
            },
          },
        });
      } catch (e) {
        /* 대시보드 Web 설정 완료 전에는 조용히 무시 */
      }
    });
  }

  // ===== 회원/로그인(Supabase) — 키 설정 시에만 로드 =====
  if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    // localStorage의 Supabase 세션을 즉시 읽어 헤더에 반영(페이지 이동 시에도 깜빡임 없음)
    const slot0 = document.getElementById("authSlot");
    let cachedUser = null;
    let cachedToken = null;
    try {
      const ref = new URL(window.SUPABASE_URL).hostname.split(".")[0];
      const raw = localStorage.getItem(`sb-${ref}-auth-token`);
      if (raw) {
        const sess = JSON.parse(raw);
        const s = (sess && sess.currentSession) ? sess.currentSession : sess;
        cachedUser = (s && s.user) || null;
        cachedToken = (s && s.access_token) || null;
      }
    } catch (e) {}
    // 로그인한 사용자에게만 헤더 '대시보드' 링크 노출(대시보드는 정회원 전용)
    if (cachedUser) { const hd = document.getElementById("hdrDash"); if (hd) hd.style.display = ""; }

    // 직분(profiles.role)을 읽어 헤더 이름을 "홍길동 담임목사님" 형태로 보강
    function enhanceHeaderWithRole(uid, baseName) {
      if (!uid) return;
      try {
        let token = cachedToken;
        try {
          const ref = new URL(window.SUPABASE_URL).hostname.split(".")[0];
          const raw = localStorage.getItem(`sb-${ref}-auth-token`);
          if (raw) { const s0 = JSON.parse(raw); const s = s0 && s0.currentSession ? s0.currentSession : s0; token = (s && s.access_token) || token; }
        } catch (e) {}
        const headers = { apikey: window.SUPABASE_ANON_KEY };
        if (token) headers.Authorization = "Bearer " + token;
        // 관리자(admins 테이블)면 헤더 '관리자' 메뉴 노출 + 목회행정 바로가기 버튼 삽입
        fetch(window.SUPABASE_URL + "/rest/v1/admins?uid=eq." + uid + "&select=uid", { headers })
          .then((r) => (r.ok ? r.json() : null))
          .then((rows) => {
            if (rows && rows.length) {
              const el = document.getElementById("navAdmin");
              if (el) el.style.display = "";
              // auth-card 안에 목회행정 바로가기 버튼 추가 (중복 방지)
              const card = document.querySelector(".auth-card");
              if (card && !card.querySelector(".ac-admin-go")) {
                const a = document.createElement("a");
                a.href = "affairs.html";
                a.className = "ac-admin-go";
                a.style.cssText = "display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;padding:9px 14px;background:#223350;color:#fff;border-radius:8px;font-size:.84rem;font-weight:700;text-decoration:none;letter-spacing:.03em;transition:background .18s";
                a.onmouseenter = function () { this.style.background = "#1a4080"; };
                a.onmouseleave = function () { this.style.background = "#223350"; };
                a.innerHTML = "<span>⚙</span><span>목회행정</span>";
                card.appendChild(a);
              }
            }
          })
          .catch(() => {});
        // 정회원(member_links.member_status)이면 헤더 '대시보드' 메뉴 노출
        fetch(window.SUPABASE_URL + "/rest/v1/member_links?user_id=eq." + uid + "&select=member_status", { headers })
          .then((r) => (r.ok ? r.json() : null))
          .then((rows) => {
            const row = rows && rows[0];
            if (row && row.member_status === "정회원") {
              const el = document.getElementById("navMember");
              if (el) el.style.display = "";
              const card = document.querySelector(".auth-card");
              if (card && !card.querySelector(".ac-dash-go")) {
                const a = document.createElement("a");
                a.href = "dashboard.html";
                a.className = "ac-dash-go";
                a.style.cssText = "display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;padding:9px 14px;background:#223350;color:#fff;border-radius:8px;font-size:.84rem;font-weight:700;text-decoration:none;letter-spacing:.03em;transition:background .18s";
                a.onmouseenter = function () { this.style.background = "#1a4080"; };
                a.onmouseleave = function () { this.style.background = "#223350"; };
                a.innerHTML = "<span>🏠</span><span>대시보드</span>";
                card.appendChild(a);
              }
            }
          })
          .catch(() => {});
        fetch(window.SUPABASE_URL + "/rest/v1/profiles?id=eq." + uid + "&select=name,role", { headers })
          .then((r) => (r.ok ? r.json() : null))
          .then((rows) => {
            const row = rows && rows[0];
            if (!row) return;
            const nm = row.name || baseName;
            const disp = row.role ? nm + " " + row.role : nm;
            const nameEl = document.querySelector(".auth-name");
            if (nameEl) nameEl.textContent = disp + "님 ▾";
            const acName = document.querySelector(".ac-name");
            if (acName) acName.textContent = disp;
          })
          .catch(() => {});
      } catch (e) {}
    }
    window.__enhanceHeaderRole = enhanceHeaderWithRole;
    if (slot0) {
      if (cachedUser) {
        const meta = cachedUser.user_metadata || {};
        const name = meta.name || meta.full_name || meta.nickname || (cachedUser.email ? cachedUser.email.split("@")[0] : "성도");
        const email = cachedUser.email || "";
        const provider = (cachedUser.app_metadata && cachedUser.app_metadata.provider) || "email";
        const providerLabel = provider === "kakao" ? "카카오" : provider === "email" ? "이메일" : provider;
        const created = cachedUser.created_at ? new Date(cachedUser.created_at) : null;
        const joined = created ? `${created.getFullYear()}.${String(created.getMonth() + 1).padStart(2, "0")}.${String(created.getDate()).padStart(2, "0")}` : "";
        const avatar = meta.avatar_url || meta.picture || "";
        slot0.innerHTML = `
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
          <button class="auth-btn" id="logoutBtnInit">로그아웃</button>`;
        document.getElementById("logoutBtnInit").addEventListener("click", (ev) => {
          const lb = ev.currentTarget;
          lb.disabled = true;
          lb.textContent = "로그아웃 중…";
          // 1) 로그인 토큰을 즉시 삭제(우리 UI의 기준값) — 관련 sb-* 키 모두 정리
          try {
            const ref = new URL(window.SUPABASE_URL).hostname.split(".")[0];
            localStorage.removeItem(`sb-${ref}-auth-token`);
          } catch (e) {}
          try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const k = localStorage.key(i);
              if (k && k.indexOf("sb-") === 0 && k.indexOf("-auth-token") !== -1) localStorage.removeItem(k);
            }
          } catch (e) {}
          // 2) SDK signOut은 잠금으로 멈출 수 있으니 기다리지 않고 백그라운드로만 시도
          if (window.__sb) { try { window.__sb.auth.signOut().catch(() => {}); } catch (e) {} }
          // 3) 헤더 즉시 갱신 + 안내 후 홈으로 이동
          try { slot0.innerHTML = '<button class="auth-btn">로그인</button>'; } catch (e) {}
          try { sessionStorage.setItem("flashMsg", "로그아웃되었습니다."); } catch (e) {}
          showFlash("로그아웃되었습니다.");
          setTimeout(() => { location.href = "index.html"; }, 700);
        });
        // 직분이 지정돼 있으면 이름 옆에 붙여 표시
        enhanceHeaderWithRole(cachedUser.id, name);
      } else {
        slot0.innerHTML = '<button class="auth-btn" id="loginBtnInit">로그인</button>';
        document.getElementById("loginBtnInit").addEventListener("click", () => {
          const m = document.getElementById("authModal");
          if (m) { m.hidden = false; document.body.style.overflow = "hidden"; }
        });
      }
    }
    const sdk = document.createElement("script");
    sdk.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    sdk.onload = function () {
      const auth = document.createElement("script");
      auth.src = "js/auth.js?v=20260723up1";
      document.body.appendChild(auth);
    };
    // SDK 로드 실패 시에도 버튼은 유지(클릭 시 모달은 위 핸들러가 처리)
    document.head.appendChild(sdk);
  } else {
    const slot = document.getElementById("authSlot");
    if (slot) slot.innerHTML = '<span class="auth-pending" title="로그인 기능 준비 중">로그인</span>';
  }
})();

/* ============================================================
   ModalNav — 모달 뒤로가기 처리(전 페이지 공통)
   모달을 열면 history 항목을 하나 쌓고, 브라우저 '뒤로 가기'가
   사이트 밖으로 나가지 않고 '최상단 모달만' 닫도록 한다.
   사용: 열 때 ModalNav.open(닫는함수) / 닫기버튼·ESC·백드롭은 ModalNav.close()
   ============================================================ */
window.ModalNav = (function () {
  var stack = [];
  window.addEventListener("popstate", function () {
    if (stack.length) { var fn = stack.pop(); try { fn(); } catch (e) {} }
  });
  return {
    open: function (closeDom) {
      if (typeof closeDom !== "function") return;
      stack.push(closeDom);
      try { history.pushState({ modal: stack.length }, ""); } catch (e) {}
    },
    close: function () {
      if (!stack.length) return false;
      try { history.back(); } catch (e) { var fn = stack.pop(); try { fn(); } catch (_) {} }
      return true;
    },
    count: function () { return stack.length; }
  };
})();
