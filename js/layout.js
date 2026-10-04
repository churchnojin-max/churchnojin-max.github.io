/* ============================================================
   ○○교회 — 공유 레이아웃 (모든 페이지 공통)
   헤더(5대메뉴)·푸터·설치배너 주입 + 스크롤/모바일메뉴 + PWA/푸시
   ============================================================ */
(function () {
  // 위 메뉴 순서(2026-09-29 목사님 지정): 메인화면으로 · 예배와 말씀 · 공동체와 양육 · 선교와 사역 · 교회 안내 · 행정
  const NAV = [
    { href: "word.html", label: "예배와 말씀", sub: [
      { href: "word.html#sermon", label: "이번 주 말씀" },
      { href: "word.html#qt", label: "매일 말씀 묵상" },
      { href: "word.html#believe", label: "우리가 믿는 것" },
      { href: "word.html#song", label: "이달의 찬양" },
    ] },
    // 삶의 질문(story.html#qna)은 2026-09-29 숨김 — 다시 쓰려면 story.html 의 hidden 을 지우고 여기에 다시 넣는다
    { href: "story.html", label: "공동체와 양육", sub: [
      { href: "district.html", label: "교구사역" },
      { href: "story.html#communities", label: "다음 세대" },
      { href: "story.html#groups", label: "전도회" },
      { href: "story.html#album", label: "우리들 소식" },
    ] },
    { href: "world.html", label: "선교와 사역", sub: [
      { href: "world.html#mission", label: "선교" },
      { href: "world.html#local", label: "지역 연합사역" },
    ] },
    { href: "welcome.html", label: "교회 안내", sub: [
      { href: "welcome.html#about", label: "노진교회를 소개합니다" },
      { href: "welcome.html#worship", label: "예배 안내" },
      { href: "welcome.html#bulletin", label: "이번 주 주보" },
      { href: "welcome.html#directions", label: "찾아오시는 길" },
      { href: "welcome.html#newfamily", label: "새가족 등록" },
    ] },
    { href: "office.html", label: "행정", sub: [
      { href: "office.html#notice", label: "공지사항" },
      { href: "office.html#give", label: "온라인 헌금" },
      { href: "office.html#receipt", label: "기부금영수증" },
      { href: "office.html#rooms", label: "모임장소 확인" },
      { href: "office.html#reserve", label: "장소신청" },
      { href: "office.html#edu", label: "교육 자료실" },
      { href: "office.html#worship-lib", label: "예배 자료실" },
      { href: "office.html#app", label: "앱 설치 안내" },
    ] },
    // 교회행정: 위 메뉴줄이 아니라 오른쪽 이름(○○○ 담임목사님) 왼편에 따로 뜬다(2026-09-29).
    // 권한을 받은 사람에게만 보이고, 각 항목은 perm 권한(또는 관리자)이 있을 때만 보인다.
    // perm 에 "a|b" 처럼 적으면 둘 중 하나만 있어도 보인다(관리자는 항상 전부).
    // 목회행정은 목회행정 권한(심방·상담·설교) 또는 예배 권한(이달의 찬양·주보)이 있으면 열리고, 안의 탭도 권한별로 나뉜다.
    { href: "finance.html", label: "교회행정", adminOnly: true, sub: [
      { href: "finance.html", label: "재정관리", perm: "canFinance" },
      { href: "gyojeok.html", label: "교적관리", perm: "canGyojeok" },
      { href: "affairs.html", label: "목회행정", perm: "canAffairs|canWorship" },
      { href: "home-settings.html", label: "홈페이지 설정", perm: "canHomepage" },
    ] },
    // 사이트맵: 상단 메뉴는 4개로 간소화하기 위해 빼고, 푸터에서만 보이게 함(footerOnly)
    { href: "sitemap.html", label: "사이트맵", footerOnly: true },
  ];

  const path = location.pathname.split("/").pop() || "index.html";

  // ===== 한 화면씩 넘어가는 페이지 =====
  // 아래 페이지들은 컴퓨터(마우스)에서 휠을 굴리면 한 화면씩 넘어간다(css: html.snap-page).
  // 휴대폰·태블릿에서는 css 쪽 조건(화면 폭·마우스 여부)에 걸려 평소처럼 자유롭게 내려간다.
  const SNAP_PAGES = ["index.html", "welcome.html", "word.html", "story.html", "world.html", "office.html"];
  if (SNAP_PAGES.indexOf(path) !== -1) {
    const root = document.documentElement;
    root.classList.add("snap-page");
    // 휠을 한 번 굴리면(방향만 보고) 다음/이전 화면으로 넘어간다.
    // 브라우저 기본 '부드러운 스크롤'은 너무 빨라 툭 끊기듯 보여서(2026-09-29 목사님 의견),
    // 약 1초 동안 천천히 출발해 천천히 멈추도록 직접 움직인다(GLIDE_MS 로 빠르기 조절).
    // 한 화면보다 긴 화면은 그 안을 끝까지 내려 본 다음에 다음 화면으로 넘어간다.
    const GLIDE_MS = 1000;
    const snapMQ = window.matchMedia("(min-width: 1025px) and (hover: hover) and (pointer: fine)");
    const pageOf = (p) => p.split("/").pop() || "index.html";
    let lockUntil = 0, glideRaf = 0;
    const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
    const glideTo = (target) => {
      const maxY = root.scrollHeight - window.innerHeight;
      target = Math.max(0, Math.min(maxY, Math.round(target)));
      const from = window.scrollY, dist = target - from;
      if (Math.abs(dist) < 2) return 0;
      const screens = Math.abs(dist) / window.innerHeight;
      const dur = Math.round(Math.min(GLIDE_MS * 1.6, GLIDE_MS + Math.max(0, screens - 1) * 160));
      cancelAnimationFrame(glideRaf);
      root.classList.add("snap-gliding");        // 움직이는 동안은 css 맞춤·기본 부드러운 스크롤을 끈다
      const t0 = performance.now();
      const frame = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        window.scrollTo(0, from + dist * easeInOutSine(p));
        if (p < 1) glideRaf = requestAnimationFrame(frame);
        else root.classList.remove("snap-gliding");
      };
      glideRaf = requestAnimationFrame(frame);
      return dur;
    };
    const blocked = () =>
      root.classList.contains("pop-open") || document.body.classList.contains("menu-lock") ||
      !!document.querySelector(".modal:not([hidden])");
    const canScrollInside = (el, dir) => {
      for (; el && el !== document.body && el !== root; el = el.parentElement) {
        const st = getComputedStyle(el);
        if (!/(auto|scroll)/.test(st.overflowY) || el.scrollHeight <= el.clientHeight + 1) continue;
        if (dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
      }
      return false;
    };
    const snapStops = () => {
      const maxY = root.scrollHeight - window.innerHeight;
      const stops = [];
      document.querySelectorAll("body > section").forEach((s) => {
        if (s.hidden || getComputedStyle(s).scrollSnapAlign.indexOf("start") === -1) return;
        stops.push({ top: s.offsetTop, bottom: s.offsetTop + s.offsetHeight });
      });
      stops.push({ top: maxY, bottom: maxY + window.innerHeight });
      return stops.filter((s) => s.top <= maxY + 1).sort((a, b) => a.top - b.top);
    };
    // dir 방향으로 갈 곳: 숫자(화면 위치) / "native"(긴 화면 안이라 평소처럼 스크롤) / null(더 갈 곳 없음)
    const nextTarget = (dir) => {
      const y = window.scrollY, vh = window.innerHeight, stops = snapStops();
      const cur = stops.filter((s) => s.top <= y + 2).pop();
      if (cur && cur.bottom - cur.top > vh + 4) {
        if (dir > 0 && y + vh < cur.bottom - 4) return "native";
        if (dir < 0 && y > cur.top + 4) return "native";
      }
      if (dir > 0) { const n = stops.find((s) => s.top > y + 2); return n ? n.top : null; }
      const prev = stops.filter((s) => s.top < y - 2).pop();
      // 위로 갈 때, 긴 화면이면 그 화면의 맨 아래(끝부분)부터 보여 준다
      return prev ? ((prev.bottom - prev.top > vh + 4) ? Math.max(prev.top, prev.bottom - vh) : prev.top) : null;
    };
    const go = (target) => { lockUntil = Date.now() + glideTo(target) + 150; };

    window.addEventListener("wheel", (e) => {
      if (!snapMQ.matches || e.ctrlKey || e.defaultPrevented) return;
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX) || !e.deltaY || blocked()) return;
      const now = Date.now();
      // 움직이는 중이거나 막 멈춘 직후(터치패드 관성)에는 휠을 무시 — 두 칸씩 넘어가지 않게
      if (now < lockUntil) { e.preventDefault(); lockUntil = Math.max(lockUntil, now + 180); return; }
      const dir = e.deltaY > 0 ? 1 : -1;
      if (canScrollInside(e.target, dir)) return;               // 안쪽 목록 상자 등은 그 안에서 먼저 스크롤
      const t = nextTarget(dir);
      if (t === "native") return;
      e.preventDefault();
      if (t != null) go(t);
    }, { passive: false });

    // 키보드(Page Down·화살표·스페이스·Home·End)도 똑같이 부드럽게
    window.addEventListener("keydown", (e) => {
      if (!snapMQ.matches || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || blocked()) return;
      const ae = document.activeElement;
      if (ae && (ae.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))) return;
      if (e.key === " " && ae && /^(BUTTON|A|SUMMARY)$/.test(ae.tagName)) return;
      let dir = 0;
      if (e.key === "PageDown" || e.key === "ArrowDown" || (e.key === " " && !e.shiftKey)) dir = 1;
      else if (e.key === "PageUp" || e.key === "ArrowUp" || (e.key === " " && e.shiftKey)) dir = -1;
      else if (e.key === "Home") { e.preventDefault(); go(0); return; }
      else if (e.key === "End") { e.preventDefault(); go(root.scrollHeight); return; }
      if (!dir) return;
      if (Date.now() < lockUntil) { e.preventDefault(); return; }
      const t = nextTarget(dir);
      if (t === "native") return;
      e.preventDefault();
      if (t != null) go(t);
    });

    // 같은 페이지 안으로 가는 링크(표지의 차례, 위 메뉴의 세부 항목, 맨 위로 버튼 등)도 부드럽게
    document.addEventListener("click", (e) => {
      if (!snapMQ.matches || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = e.target.closest && e.target.closest("a[href*='#']");
      if (!a || (a.target && a.target !== "_self")) return;
      const url = new URL(a.getAttribute("href"), location.href);
      if (pageOf(url.pathname) !== pageOf(location.pathname) || !url.hash) return;
      const el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!el || el.closest(".pop-src")) return;                 // 팝업 속 내용은 SitePopup 이 연다
      e.preventDefault();
      try { history.replaceState(null, "", url.hash); } catch (err) {}
      const sec = el.closest("body > section") || el;
      go(sec.getBoundingClientRect().top + window.scrollY);
    });
    window.__snapGlideTo = go;   // '맨 위로' 버튼 등에서 같이 쓴다
  }

  // ===== 우리 교회 정보(js/church.js) 읽기 =====
  const C = window.CHURCH || {};
  const CH_NAME = C.name || "우리 교회";
  const CH_EN_LINE = (C.nameEn || "") + (C.since ? " · SINCE " + C.since : "");
  const CH_DENOM = C.denomination || "";
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
  // 로고 클릭으로도 처음화면에 갈 수 있지만, 다른 창(외부 링크 등)에서 넘어왔을 때
  // "메인화면으로"라는 글자 링크가 명확히 보이는 게 낫다는 요청으로 다시 추가함.
  // '메인화면으로'에 마우스를 올리면 모든 메뉴와 그 세부 항목을 한눈에 보여 주는 큰 메뉴(전체 메뉴)가 뜬다.
  const megaCols = NAV.filter((n) => n.sub && !n.adminOnly && !n.memberOnly && !n.footerOnly).map((n) => `
          <div class="mega-col">
            <a class="mega-head" href="${n.href}">${n.label}</a>
            <div class="mega-links">${n.sub.map((s) => `<a href="${s.href}">${s.label}</a>`).join("")}</div>
          </div>`).join("");
  const homeLink = `<div class="nav-item nav-home-link has-mega">
        <a href="index.html"${path === "index.html" ? ' class="active"' : ""}>메인화면으로<span class="nav-caret mega-caret" aria-hidden="true">⌄</span></a>
        <div class="nav-mega" aria-label="전체 메뉴"><div class="nav-mega-inner">${megaCols}
        </div></div>
      </div>`;
  // footerOnly 항목(사이트맵)은 상단 메뉴를 4개로 간소하게 유지하기 위해 상단에서는 뺀다(푸터에는 남음).
  const navLinks = homeLink + NAV.filter((n) => !n.footerOnly).map((n) => {
    const active = path === n.href.split("#")[0] ? ' class="active"' : "";
    const admAttr = n.adminOnly ? ' id="navAdmin" style="display:none"' : (n.memberOnly ? ' id="navMember" style="display:none"' : "");
    if (!n.sub) return `<div class="nav-item"${admAttr}><a href="${n.href}"${active}>${n.label}</a></div>`;
    const subs = n.sub.map((s) => `<a href="${s.href}"${s.perm ? ` data-perm="${s.perm}" hidden` : ""}>${s.label}</a>`).join("");
    return `<div class="nav-item has-sub"${admAttr}>
        <a href="${n.href}"${active}>${n.label}<span class="nav-caret" aria-hidden="true">⌄</span></a>
        <div class="nav-dropdown"><div class="nav-dropdown-inner">
          <div class="nav-dropdown-links">${subs}</div>
        </div></div>
      </div>`;
  }).join("");

  // 교회행정(업무) 메뉴 — 컴퓨터 화면에서 이름 왼쪽에. 휴대폰에서는 햄버거 메뉴 안의 '교회행정'을 쓴다.
  const WORK = NAV.find((n) => n.adminOnly);
  const workMenuHTML = WORK ? `
          <div class="work-menu" id="workMenu" hidden>
            <button type="button" class="work-btn" aria-haspopup="true" aria-expanded="false">
              <span class="work-ico" aria-hidden="true">⚙</span>${WORK.label}<span class="nav-caret" aria-hidden="true">⌄</span>
            </button>
            <div class="work-dropdown"><div class="work-dropdown-inner">
              <p class="work-note">권한을 받은 분께만 보이는 메뉴</p>
              ${WORK.sub.map((s) => `<a href="${s.href}" data-perm="${s.perm || "isAdmin"}" hidden>${s.label}</a>`).join("")}
            </div></div>
          </div>` : "";

  // 성도님들이 보는 공개 화면(<html class="big-text">)에만 글씨 크기 '가+' 단추와 '홈페이지 사용법'을 둔다(관리 화면은 그대로)
  const IS_PUBLIC = document.documentElement.classList.contains("big-text");
  const headerHTML = `
    <header id="header">
      <div class="nav-inner">
        <div class="nav-left">
          <a href="index.html" class="logo">
            <img src="images/icon-192.png?v=20260926icon2" alt="" class="logo-mark" />
            <span class="logo-txt"><span class="logo-kr">${CH_NAME}</span>${CH_DENOM ? `<span class="logo-denom">${CH_DENOM}</span>` : ""}</span>
          </a>
          <a href="dashboard.html" class="hdr-dash-btn" id="hdrDash" style="display:none">대시보드</a>
        </div>
        <nav class="nav-menu" id="navMenu">${navLinks}${IS_PUBLIC ? `<button type="button" class="nav-help" data-guide>❓ 홈페이지 사용법</button>` : ""}</nav>
        <div class="nav-right">${workMenuHTML}
          <div class="auth-slot" id="authSlot"></div>
          ${IS_PUBLIC ? `<button type="button" class="ts-btn" id="tsBtn" aria-label="글씨 크기 바꾸기" title="글씨 크기 바꾸기">가<span aria-hidden="true">+</span></button>` : ""}
          <button class="nav-toggle" id="navToggle" aria-label="메뉴 열기"><span></span><span></span><span></span></button>
        </div>
      </div>
    </header>`;
  document.body.insertAdjacentHTML("afterbegin", headerHTML);

  // ===== 각 메뉴 첫 화면(표지)에 이 페이지의 차례 붙이기 =====
  // 위 메뉴(NAV)에 이 페이지가 있으면 그 세부 항목을 그대로 쓰고(메뉴와 차례가 늘 같게),
  // 없으면 페이지 안의 <section id=".."><h2>제목</h2> 을 읽어 만든다.
  // (한 화면씩 넘어가는 페이지에서만. 휴대폰에서는 css에서 숨긴다)
  if (document.documentElement.classList.contains("snap-page")) {
    const ph = document.querySelector(".page-hero");
    const navEntry = NAV.find((n) => n.sub && !n.adminOnly && n.href.split("#")[0] === path);
    const buildToc = () => {
      const items = navEntry
        ? navEntry.sub
            .map((s) => ({ href: s.href.split("#")[0] === path ? "#" + (s.href.split("#")[1] || "") : s.href, label: s.label }))
            .filter((it) => {
              if (it.href.charAt(0) !== "#") return true;             // 다른 페이지로 가는 항목(교구사역 등)
              const el = document.getElementById(it.href.slice(1));
              return !!el && !el.hidden;
            })
        : Array.prototype.slice.call(document.querySelectorAll("body > section[id]"))
            .filter((s) => !s.hidden)
            .map((s) => { const h = s.querySelector("h2"); return h ? { href: "#" + s.id, label: (s.getAttribute("data-toc") || h.textContent).trim() } : null; })
            .filter(Boolean);
      const old = ph.querySelector(".ph-toc");
      if (old) old.remove();
      // 항목이 많으면(행정 등) 두 칸으로 나눠 한 화면에 들어가게
      if (items.length) ph.insertAdjacentHTML("beforeend", `<nav class="ph-toc${items.length > 6 ? " is-long" : ""}" aria-label="이 페이지 차례">${items.map((it) => `<a href="${it.href}">${it.label}</a>`).join("")}</nav>`);
    };
    if (ph) {
      buildToc();
      // 팟캐스트처럼 내용이 있을 때만 나타나는 화면이 뒤늦게 열리면 차례도 다시 만든다
      const mo = new MutationObserver(buildToc);
      document.querySelectorAll("body > section[id]").forEach((s) => mo.observe(s, { attributes: true, attributeFilter: ["hidden"] }));
    }
  }

  // ===== 지금 로그인돼 있나 — 로그인한 분께만 보이는 칸(사진·봉사위원 등)을 그릴 때 쓴다(2026-10-05) =====
  function sessionToken() {
    try {
      const ref = new URL(window.SUPABASE_URL).hostname.split(".")[0];
      const raw = sessionStorage.getItem(`sb-${ref}-auth-token`);
      if (!raw) return "";
      const s0 = JSON.parse(raw);
      const s = s0 && s0.currentSession ? s0.currentSession : s0;
      return (s && s.user && s.access_token) || "";
    } catch (e) { return ""; }
  }
  window.ChurchSignedIn = () => !!sessionToken();

  // ===== 홈페이지 설정(공개 읽기) — 로고 · 섬기는 사람들 · 월별 봉사위원 =====
  // church_settings 의 공개 키를 1회씩 읽어 캐시한다. 봉사위원('committees')은 이름이 들어 있어
  // 로그인한 분만 읽을 수 있으므로(supabase/member_only_20261005.sql) 로그인돼 있으면 그 열쇠로 읽는다.
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
      const headers = { apikey: window.SUPABASE_ANON_KEY };
      const tok = sessionToken();
      if (tok) headers.Authorization = "Bearer " + tok;
      cache[key] = fetch(url, { headers })
        .then((r) => (r.ok ? r.json() : null))
        .then((rows) => (rows && rows[0] && rows[0].data) || null)
        .catch(() => null);
      return cache[key];
    }
    return {
      homepage: () => fetchKey("homepage"),
      committees: () => fetchKey("committees"),
      monthlySong: () => fetchKey("monthly_song"),
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
        <a href="index.html" class="footer-brand">
          <img src="images/logo-symbol-white.svg?v=20260929" alt="" class="footer-mark" width="72" height="61" />
          <span class="footer-brand-txt">
            <span class="logo-kr">${CH_NAME}</span>
            ${CH_DENOM ? `<span class="logo-denom">${CH_DENOM}</span>` : ""}
          </span>
        </a>
        <nav class="footer-nav">${NAV.filter((n) => !n.adminOnly && !n.memberOnly).map((n) => `<a href="${n.href}">${n.label}</a>`).join("")}${IS_PUBLIC ? `<a href="#" data-guide>홈페이지 사용법</a>` : ""}<a href="bylaws.html">정관</a><a href="terms.html">이용약관</a><a href="privacy.html">개인정보처리방침</a><a href="withdraw.html">회원탈퇴</a></nav>
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
      <img src="images/icon-192.png?v=20260926icon2" alt="${CH_NAME}" class="install-icon" />
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
          <img src="images/icon-192.png?v=20260926icon2" alt="" class="auth-logo" />
          <h3 id="authTitle">로그인</h3>
          <p id="authSubtitle">${CH_NAME} 나눔터에 오신 것을 환영합니다.</p>
        </div>
        <div class="auth-social" id="kakaoField" hidden>
          <button type="button" class="kakao-btn" id="kakaoLogin">💬 카카오로 시작하기</button>
          <div class="auth-divider">또는</div>
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
        <p class="auth-privacy">로그인하면 계정 보안을 위해 로그인 기록(시각·IP·기기)이 1년간 보관됩니다. <a href="privacy.html">개인정보처리방침</a></p>
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
      t.setAttribute("style", "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:rgba(26,58,47,.96);color:#fff;padding:12px 22px;border-radius:30px;font-size:.95rem;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:9999;opacity:0;transition:opacity .25s;");
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

  // ===== 글씨 크기 '가+'(2026-10-05 목사님): 누를 때마다 보통 → 크게 → 아주 크게 → 보통, 이 기기에 기억 =====
  // (그림을 그리기 전에 page-slide.js 가 <head> 에서 먼저 입혀 깜빡이지 않게 한다)
  const TS_KEY = "nojin_text_size", TS_STEPS = ["", "ts-l", "ts-xl"], TS_NAMES = ["보통", "크게", "아주 크게"];
  let tsCur = "";
  try { tsCur = localStorage.getItem(TS_KEY) || ""; } catch (e) {}
  if (TS_STEPS.indexOf(tsCur) < 0) tsCur = "";
  function tsApply(v) {
    const r = document.documentElement;
    r.classList.remove("ts-l", "ts-xl");
    if (v && IS_PUBLIC) r.classList.add(v);
  }
  tsApply(tsCur);
  const tsBtn = document.getElementById("tsBtn");
  if (tsBtn) tsBtn.addEventListener("click", () => {
    const i = (TS_STEPS.indexOf(tsCur) + 1) % TS_STEPS.length;
    tsCur = TS_STEPS[i];
    try { if (tsCur) localStorage.setItem(TS_KEY, tsCur); else localStorage.removeItem(TS_KEY); } catch (e) {}
    tsApply(tsCur);
    showFlash("글씨 크기: " + TS_NAMES[i] + (i === 0 ? " (처음 크기로)" : " — 한 번 더 누르면 " + TS_NAMES[(i + 1) % 3]));
  });

  // ===== 홈페이지 사용법(2026-10-05 목사님: 어르신들이 처음 들어오셨을 때 기능을 다 쓰실 수 있게) =====
  //  · 휴대폰·패드로 처음 들어오면(이 기기에서 한 번) 저절로 한 번 뜨고, 메뉴(☰)·맨 아래 '홈페이지 사용법'으로 언제든 다시 본다.
  //  · 첫 화면 환영 안내·로그인 창 등이 떠 있으면 닫힐 때까지 기다렸다가 띄운다.
  const GUIDE_KEY = "nojin_guide_seen";
  const GUIDE = [
    { ic: '<span class="sg-swipe"><span class="sg-hand">👆</span></span>', t: "옆으로 밀면 다음 화면",
      d: "손가락으로 화면을 <b>왼쪽으로 밀면 다음 메뉴</b>, <b>오른쪽으로 밀면 앞 메뉴</b>로 넘어갑니다.",
      s: "첫 화면 → 예배와 말씀 → 공동체와 양육 → 선교와 사역 → 교회 안내" },
    { ic: `<span class="sg-bar"><b>${CH_NAME}</b><i>가+</i><em>☰</em></span>`, t: "메뉴로 바로가기",
      d: "오른쪽 위 <b>☰ 단추</b>를 누르면 메뉴가 열립니다. 가고 싶은 곳을 누르면 바로 갑니다.", s: "" },
    { ic: '<span class="sg-back">◁</span>', t: "돌아가기",
      d: "휴대폰의 <b>뒤로 단추</b>(안드로이드는 아래쪽 ◁, 아이폰은 화면 아래 ‹)를 누르면 열린 창이 닫히거나 앞 화면으로 돌아갑니다.",
      s: `왼쪽 위 <b>'${CH_NAME}'</b>를 누르면 언제든 첫 화면으로 갑니다.` },
    { ic: '<span class="sg-ts">가<sup>+</sup></span>', t: "글씨 크게 · 실시간 예배",
      d: "글씨가 작으면 위쪽 <b>'가+' 단추</b>를 누르세요. 누를 때마다 더 커지고, 세 번째에는 처음 크기로 돌아옵니다.",
      s: "주일 예배 때 화면 아래 <b>'실시간 예배'</b> 단추에 빨간 불이 켜지면 눌러서 바로 보세요." },
  ];
  let sgEl = null, sgI = 0;
  function sgRender() {
    const g = GUIDE[sgI], last = sgI === GUIDE.length - 1;
    sgEl.querySelector("#sgStep").textContent = (sgI + 1) + " / " + GUIDE.length;
    sgEl.querySelector("#sgIll").innerHTML = g.ic;
    sgEl.querySelector("#sgTitle").textContent = g.t;
    sgEl.querySelector("#sgDesc").innerHTML = g.d;
    sgEl.querySelector("#sgSub").innerHTML = g.s || "";
    sgEl.querySelector("#sgDots").innerHTML = GUIDE.map((_, i) => `<i class="${i === sgI ? "on" : ""}"></i>`).join("");
    sgEl.querySelector('[data-sg="prev"]').hidden = sgI === 0;
    sgEl.querySelector('[data-sg="next"]').textContent = last ? "시작하기" : "다음 ›";
    sgEl.querySelector("#sgAgain").hidden = !last;
  }
  function sgGo(d) {
    const n = sgI + d;
    if (n >= GUIDE.length) { sgClose(); return; }
    if (n < 0) return;
    sgI = n; sgRender();
  }
  function sgBuild() {
    sgEl = document.createElement("div");
    sgEl.className = "modal site-guide";
    sgEl.hidden = true;
    sgEl.innerHTML = `<div class="modal-backdrop" data-sg="close"></div>
      <div class="modal-box sg-box" role="dialog" aria-modal="true" aria-labelledby="sgTitle">
        <button class="modal-close" data-sg="close" aria-label="닫기">&times;</button>
        <p class="sg-eyebrow">홈페이지 사용법 <span id="sgStep"></span></p>
        <div class="sg-ill" id="sgIll"></div>
        <h3 class="sg-title" id="sgTitle"></h3>
        <p class="sg-desc" id="sgDesc"></p>
        <p class="sg-sub" id="sgSub"></p>
        <div class="sg-dots" id="sgDots"></div>
        <div class="sg-nav"><button type="button" class="btn btn-line" data-sg="prev">‹ 이전</button><button type="button" class="btn btn-solid" data-sg="next">다음 ›</button></div>
        <p class="sg-again" id="sgAgain" hidden>이 안내는 메뉴(☰)의 <b>'홈페이지 사용법'</b>에서 언제든 다시 볼 수 있어요.</p>
      </div>`;
    document.body.appendChild(sgEl);
    sgEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-sg]");
      if (!b) return;
      const act = b.getAttribute("data-sg");
      if (act === "close") sgClose(); else if (act === "next") sgGo(1); else if (act === "prev") sgGo(-1);
    });
    // 안내 안에서도 옆으로 밀어 넘길 수 있게
    let tx = null;
    const box = sgEl.querySelector(".sg-box");
    box.addEventListener("touchstart", (e) => { tx = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
    box.addEventListener("touchend", (e) => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; tx = null; if (Math.abs(dx) > 50) sgGo(dx < 0 ? 1 : -1); });
    document.addEventListener("keydown", (e) => {
      if (!sgEl || sgEl.hidden) return;
      if (e.key === "Escape") sgClose(); else if (e.key === "ArrowRight") sgGo(1); else if (e.key === "ArrowLeft") sgGo(-1);
    });
  }
  function sgCloseDom() {
    if (!sgEl || sgEl.hidden) return;
    sgEl.hidden = true;
    document.body.style.overflow = "";
    if (!document.querySelector(".pop-modal:not([hidden])")) document.documentElement.classList.remove("pop-open");
  }
  function sgClose() { if (window.ModalNav && window.ModalNav.close()) return; sgCloseDom(); }
  function sgOpen() {
    if (!sgEl) sgBuild();
    closeMenu();
    try { localStorage.setItem(GUIDE_KEY, "1"); localStorage.setItem("swipeNavHint1", "1"); } catch (e) {}   // 따로 뜨던 '옆으로 밀기' 안내는 이 안내가 대신한다
    sgI = 0; sgRender();
    sgEl.hidden = false;
    document.body.style.overflow = "hidden";
    document.documentElement.classList.add("pop-open");   // 뒤 화면이 옆으로 넘어가지 않게
    if (window.ModalNav) window.ModalNav.open(sgCloseDom);   // 휴대폰 '뒤로'로 이 안내만 닫히게
  }
  window.SiteGuide = { open: sgOpen };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-guide]");
    if (!b) return;
    e.preventDefault();
    sgOpen();
  });
  // 처음 들어온 휴대폰·패드에서 한 번 저절로
  if (IS_PUBLIC && window.matchMedia && matchMedia("(pointer: coarse)").matches && window.innerWidth <= 1024) {
    const seen = () => { try { return localStorage.getItem(GUIDE_KEY) === "1"; } catch (e) { return true; } };
    // 첫 화면 환영 안내(auth.js)가 곧 뜰 수 있으면 그것을 먼저 보여 준다
    const welcomePending = () => {
      try {
        return /(^|\/)(index\.html)?$/.test(location.pathname) && !window.ChurchSignedIn() &&
          !localStorage.getItem("nojin_known_member") && !sessionStorage.getItem("nojin_welcome_shown");
      } catch (e) { return false; }
    };
    let tries = 0;
    const tryAuto = () => {
      if (seen()) return;
      const busy = document.querySelector(".modal:not([hidden]), .pop-modal:not([hidden]), .ig-viewer:not([hidden])") ||
        document.documentElement.classList.contains("pop-open") || document.body.classList.contains("menu-lock");
      if (busy || (welcomePending() && tries < 8)) { if (tries++ < 120) setTimeout(tryAuto, 1000); return; }
      sgOpen();
    };
    if (!seen()) window.addEventListener("load", () => setTimeout(tryAuto, 2200));
  }

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
    // sessionStorage의 Supabase 세션을 즉시 읽어 헤더에 반영(페이지 이동 시에도 깜빡임 없음)
    // auth.js가 세션을 sessionStorage에 저장하므로(창을 닫으면 자동 로그아웃) 여기서도 동일하게 읽는다.
    const slot0 = document.getElementById("authSlot");
    let cachedUser = null;
    let cachedToken = null;
    try {
      const ref = new URL(window.SUPABASE_URL).hostname.split(".")[0];
      const raw = sessionStorage.getItem(`sb-${ref}-auth-token`);
      if (raw) {
        const sess = JSON.parse(raw);
        const s = (sess && sess.currentSession) ? sess.currentSession : sess;
        cachedUser = (s && s.user) || null;
        cachedToken = (s && s.access_token) || null;
      }
    } catch (e) {}
    // 로그인한 사용자에게만 헤더 '대시보드' 링크 노출(대시보드는 정회원 전용)
    if (cachedUser) { document.documentElement.classList.add("logged-in"); const hd = document.getElementById("hdrDash"); if (hd) hd.style.display = ""; }

    // 권한(my_perms)에 맞춰 교회행정 메뉴와 그 안의 항목을 보이거나 숨긴다
    function applyWorkPerms(p) {
      p = p || {};
      let any = false;
      document.querySelectorAll("[data-perm]").forEach((a) => {
        const show = !!(p.isAdmin || a.getAttribute("data-perm").split("|").some((k) => p[k]));
        a.hidden = !show;
        if (show) any = true;
      });
      const wm = document.getElementById("workMenu");
      if (wm) wm.hidden = !any;
      const na = document.getElementById("navAdmin");       // 휴대폰 햄버거 메뉴 속 교회행정
      if (na) na.style.display = any ? "" : "none";
    }
    // 교회행정 버튼: 마우스를 올리면 열리고(css), 눌러도 열리고 닫힌다(터치 화면·키보드)
    (function () {
      const wm = document.getElementById("workMenu");
      if (!wm) return;
      const btn = wm.querySelector(".work-btn");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = !wm.classList.contains("open");
        wm.classList.toggle("open", open);
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      document.addEventListener("click", (e) => {
        if (!wm.contains(e.target)) { wm.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }
      });
    })();

    // 직분(profiles.role)을 읽어 헤더 이름을 "홍길동 담임목사님" 형태로 보강
    function enhanceHeaderWithRole(uid, baseName) {
      if (!uid) return;
      try {
        let token = cachedToken;
        try {
          const ref = new URL(window.SUPABASE_URL).hostname.split(".")[0];
          const raw = sessionStorage.getItem(`sb-${ref}-auth-token`);
          if (raw) { const s0 = JSON.parse(raw); const s = s0 && s0.currentSession ? s0.currentSession : s0; token = (s && s.access_token) || token; }
        } catch (e) {}
        const headers = { apikey: window.SUPABASE_ANON_KEY };
        if (token) headers.Authorization = "Bearer " + token;
        // 권한(my_perms: 관리자·재정·교적 등)을 읽어 이름 왼쪽의 '교회행정' 메뉴를 채운다.
        // my_perms 가 없는 옛 DB면 admins 테이블로 관리자 여부만 확인한다.
        fetch(window.SUPABASE_URL + "/rest/v1/rpc/my_perms", {
          method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, headers), body: "{}",
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((p) => {
            if (p && typeof p === "object" && !Array.isArray(p)) return p;
            return fetch(window.SUPABASE_URL + "/rest/v1/admins?uid=eq." + uid + "&select=uid", { headers })
              .then((r) => (r.ok ? r.json() : null))
              .then((rows) => ({ isAdmin: !!(rows && rows.length) }));
          })
          .then(applyWorkPerms)
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
                a.style.cssText = "display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;padding:9px 14px;background:#1A3A2F;color:#fff;border-radius:8px;font-size:.84rem;font-weight:700;text-decoration:none;letter-spacing:.03em;transition:background .18s";
                a.onmouseenter = function () { this.style.background = "#1a4080"; };
                a.onmouseleave = function () { this.style.background = "#1A3A2F"; };
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
          // 1) 로그인 토큰을 즉시 삭제(우리 UI의 기준값) — 관련 sb-* 키 모두 정리(sessionStorage)
          try {
            const ref = new URL(window.SUPABASE_URL).hostname.split(".")[0];
            sessionStorage.removeItem(`sb-${ref}-auth-token`);
          } catch (e) {}
          try {
            for (let i = sessionStorage.length - 1; i >= 0; i--) {
              const k = sessionStorage.key(i);
              if (k && k.indexOf("sb-") === 0 && k.indexOf("-auth-token") !== -1) sessionStorage.removeItem(k);
            }
          } catch (e) {}
          // 2) SDK signOut은 잠금으로 멈출 수 있으니 기다리지 않고 백그라운드로만 시도
          if (window.__sb) { try { window.__sb.auth.signOut().catch(() => {}); } catch (e) {} }
          // 3) 헤더 즉시 갱신 + 안내 후 홈으로 이동
          try { slot0.innerHTML = '<span class="auth-wrap-out"><button class="auth-btn">로그인</button><button class="auth-btn auth-btn-join">가입하기</button></span>'; } catch (e) {}
          try { sessionStorage.setItem("flashMsg", "로그아웃되었습니다."); } catch (e) {}
          showFlash("로그아웃되었습니다.");
          setTimeout(() => { location.href = "index.html"; }, 700);
        });
        // 직분이 지정돼 있으면 이름 옆에 붙여 표시
        enhanceHeaderWithRole(cachedUser.id, name);
      } else {
        // 로그인 + 가입하기 나란히. auth.js 가 아직 안 떴어도 눌리게 해 두고,
        // 어느 모드로 열지는 __authPendingMode 로 넘겨 auth.js 가 이어받는다.
        slot0.innerHTML = '<span class="auth-wrap-out"><button class="auth-btn" id="loginBtnInit">로그인</button><button class="auth-btn auth-btn-join" id="joinBtnInit">가입하기</button></span>';
        const openAuth = (wantMode) => {
          if (window.__authSetMode) window.__authSetMode(wantMode);
          else window.__authPendingMode = wantMode;
          const m = document.getElementById("authModal");
          if (m) { m.hidden = false; document.body.style.overflow = "hidden"; }
        };
        document.getElementById("loginBtnInit").addEventListener("click", () => openAuth("login"));
        // 가입하기 → 가입 안내 창(카카오 먼저, 안 되면 이메일 — auth.js). auth.js 가 아직이면 가입 화면을 열어 두면 이어받는다.
        document.getElementById("joinBtnInit").addEventListener("click", () => { if (window.__openJoinGuide) window.__openJoinGuide(); else openAuth("signup"); });
      }
    }
    const sdk = document.createElement("script");
    sdk.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    sdk.onload = function () {
      const auth = document.createElement("script");
      auth.src = "js/auth.js?v=20261005welcome";
      document.body.appendChild(auth);
    };
    // SDK 로드 실패 시에도 버튼은 유지(클릭 시 모달은 위 핸들러가 처리)
    document.head.appendChild(sdk);
  } else {
    const slot = document.getElementById("authSlot");
    if (slot) slot.innerHTML = '<span class="auth-pending" title="로그인 기능 준비 중">로그인</span>';
  }

  // ===== 사이트맵(sitemap.html) — NAV 구조를 그대로 재사용해 항상 최신 상태 유지 =====
  // 교회행정(권한자 전용)과 사이트맵 링크 자신은 목록에서 제외
  const sitemapBox = document.getElementById("sitemapGrid");
  if (sitemapBox) {
    sitemapBox.innerHTML = NAV.filter((n) => !n.adminOnly && n.sub).map((n) => `
      <div class="sitemap-col">
        <h3><a href="${n.href}">${n.label}</a></h3>
        <ul>${n.sub.map((s) => `<li><a href="${s.href}">${s.label}</a></li>`).join("")}</ul>
      </div>`).join("") + `
      <div class="sitemap-col">
        <h3><a href="index.html">처음화면</a></h3>
        <ul>
          <li><a href="dashboard.html">나의 대시보드</a> <span class="sitemap-note">(정회원 전용)</span></li>
        </ul>
      </div>
      <div class="sitemap-col">
        <h3>안내</h3>
        <ul>
          <li><a href="bylaws.html">정관</a></li>
          <li><a href="terms.html">이용약관</a></li>
          <li><a href="privacy.html">개인정보처리방침</a></li>
          <li><a href="withdraw.html">회원탈퇴</a></li>
        </ul>
      </div>`;
    const searchInput = document.getElementById("sitemapSearch");
    const emptyMsg = document.getElementById("sitemapEmpty");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const q = searchInput.value.trim().toLowerCase();
        let anyVisible = false;
        sitemapBox.querySelectorAll(".sitemap-col").forEach((col) => {
          const colMatches = col.querySelector("h3").textContent.toLowerCase().includes(q);
          let colHasVisibleItem = false;
          col.querySelectorAll("li").forEach((li) => {
            const match = !q || colMatches || li.textContent.toLowerCase().includes(q);
            li.hidden = !match;
            if (match) colHasVisibleItem = true;
          });
          const showCol = !q || colMatches || colHasVisibleItem;
          col.hidden = !showCol;
          if (showCol) anyVisible = true;
        });
        if (emptyMsg) emptyMsg.hidden = anyVisible;
      });
    }
  }

  // ===== 맨 위로 버튼 (전 페이지 공통) =====
  const topBtn = document.createElement("button");
  topBtn.type = "button";
  topBtn.id = "backToTop";
  topBtn.className = "back-to-top";
  topBtn.setAttribute("aria-label", "맨 위로");
  topBtn.innerHTML = "↑";
  document.body.appendChild(topBtn);
  topBtn.addEventListener("click", () => { if (window.__snapGlideTo && window.matchMedia("(min-width: 1025px) and (hover: hover) and (pointer: fine)").matches) window.__snapGlideTo(0); else window.scrollTo({ top: 0, behavior: "smooth" }); });
  window.addEventListener("scroll", () => {
    topBtn.classList.toggle("show", window.scrollY > 480);
  }, { passive: true });
})();

/* ============================================================
   ModalNav — 모달 뒤로가기 처리(전 페이지 공통)
   모달을 열면 history 항목을 하나 쌓고, 브라우저 '뒤로 가기'가
   사이트 밖으로 나가지 않고 '최상단 모달만' 닫도록 한다.
   사용: 열 때 ModalNav.open(닫는함수) / 닫기버튼·ESC·백드롭은 ModalNav.close()
   ============================================================ */
// 로그인한 분께만 보이는 칸의 '가입하기'·'로그인' 단추(data-mo="join"|"login", 2026-10-05) — 어느 화면에서나 같은 창을 연다
document.addEventListener("click", function (e) {
  var b = e.target && e.target.closest ? e.target.closest("[data-mo]") : null;
  if (!b) return;
  var act = b.getAttribute("data-mo");
  if (act === "join" && window.__openJoinGuide) { window.__openJoinGuide(); return; }   // 카카오 먼저 권하는 가입 안내
  var mode = act === "join" ? "signup" : "login";
  if (window.__authSetMode) window.__authSetMode(mode); else window.__authPendingMode = mode;
  var m = document.getElementById("authModal");
  if (m) { m.hidden = false; document.body.style.overflow = "hidden"; }
});

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

/* ============================================================
   SitePopup — 긴 내용은 팝업으로 (전 페이지 공통)
   한 화면씩 넘어가는 페이지에서 한 화면에 다 안 들어가는 긴 글(신앙고백, 섬기는 사람들,
   주보 전체, 새가족 등록서 등)은 페이지 안에 숨겨 두었다가 버튼을 누르면 팝업으로 연다.
   팝업 안에서는 평소처럼 자유롭게 스크롤된다.

   쓰는 법:
     숨겨 둘 내용   <div class="pop-src" id="pop-xxx" data-pop-title="제목" hidden> … </div>
     여는 버튼      <button type="button" data-pop="pop-xxx">열기</button>  (a 태그도 됨)
   주소 끝이 #pop-xxx 이거나, 팝업 안에 있는 요소의 id(예: #committee)면 페이지를 열 때 바로 띄운다.
   ※ 내용을 복사하지 않고 그대로 옮겼다가 닫을 때 제자리로 돌려놓는다
     (그래서 main.js 가 id 로 채워 넣는 섬기는 사람들·봉사위원·주보도 그대로 동작한다).
   ============================================================ */
window.SitePopup = (function () {
  var modal = null, body = null, titleEl = null, cur = null, mark = null;
  function build() {
    if (modal) return;
    document.body.insertAdjacentHTML("beforeend",
      '<div class="pop-modal" id="sitePop" hidden>' +
        '<div class="pop-backdrop" data-pop-close></div>' +
        '<div class="pop-box" role="dialog" aria-modal="true" aria-labelledby="sitePopTitle">' +
          '<div class="pop-head"><h3 class="pop-title" id="sitePopTitle"></h3>' +
          '<button type="button" class="pop-close" data-pop-close aria-label="닫기">&times;</button></div>' +
          '<div class="pop-body" id="sitePopBody"></div>' +
        '</div>' +
      '</div>');
    modal = document.getElementById("sitePop");
    body = document.getElementById("sitePopBody");
    titleEl = document.getElementById("sitePopTitle");
    modal.addEventListener("click", function (e) {
      if (e.target.closest("[data-pop-close]")) { e.preventDefault(); close(); }
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && cur) close(); });
  }
  function closeDom() {
    if (!cur) return;
    cur.hidden = true;
    if (mark && mark.parentNode) { mark.parentNode.insertBefore(cur, mark); mark.parentNode.removeChild(mark); }
    cur = null; mark = null;
    modal.hidden = true;
    document.documentElement.classList.remove("pop-open");
  }
  function open(id, focusEl) {
    var src = document.getElementById(id);
    if (!src) return;
    build();
    if (cur) closeDom();
    mark = document.createComment("pop-src:" + id);
    src.parentNode.insertBefore(mark, src);
    body.appendChild(src);
    src.hidden = false;
    cur = src;
    titleEl.textContent = src.getAttribute("data-pop-title") || "";
    modal.hidden = false;
    document.documentElement.classList.add("pop-open");
    body.scrollTop = 0;
    if (focusEl && focusEl !== src) {
      setTimeout(function () { body.scrollTop = focusEl.getBoundingClientRect().top - body.getBoundingClientRect().top - 12; }, 30);
    }
    if (window.ModalNav) window.ModalNav.open(closeDom); // 휴대폰 '뒤로 가기'로 팝업만 닫히게
  }
  function close() {
    if (!cur) return;
    if (!(window.ModalNav && window.ModalNav.close())) closeDom();
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-pop]");
    if (!t) return;
    e.preventDefault();
    open(t.getAttribute("data-pop"));
  });
  // 주소로 바로 열기: #pop-xxx, 또는 팝업 속 요소의 id(#committee 등)
  function openFromHash() {
    var h = decodeURIComponent((location.hash || "").slice(1));
    if (!h) return;
    var el = document.getElementById(h);
    if (!el) return;
    var src = el.classList.contains("pop-src") ? el : el.closest(".pop-src");
    if (src) open(src.id, el);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", openFromHash);
  else setTimeout(openFromHash, 0);
  window.addEventListener("hashchange", openFromHash);
  return { open: open, close: close };
})();

/* 다른 화면에서 '#자리' 주소로 들어올 때(바로가기·메뉴의 세부 항목) 그 자리를 정확히 찾아가게 한다.
   휴대폰에서는 사진·글꼴·불러온 내용이 늦게 자리를 차지해 위쪽이 길어지면 목적지가 아래로 밀려나
   한 칸 위(예: 새가족 안내 → 찾아오시는 길)에 멈추곤 했다(2026-10-03 목사님 말씀).
   들어온 뒤 몇 초 동안은 목적지가 밀릴 때마다 다시 맞추고, 손가락·휠·키보드를 쓰면 바로 그만둔다. */
(function () {
  var h = "";
  try { h = decodeURIComponent((location.hash || "").slice(1)); } catch (e) { return; }
  if (!h || /^(pop-|qt-open)/.test(h)) return;
  var stop = false, end = Date.now() + 6000;
  function quit() { stop = true; }
  ["touchstart", "wheel", "keydown", "mousedown"].forEach(function (ev) { window.addEventListener(ev, quit, { passive: true, once: true }); });
  window.addEventListener("hashchange", quit);
  function fix() {
    if (stop || Date.now() > end || document.documentElement.classList.contains("pop-open")) return;
    var el = document.getElementById(h);
    if (!el || el.closest(".pop-src") || el.offsetParent === null) return;
    var cs = getComputedStyle(document.documentElement);
    var want = (parseFloat(cs.scrollPaddingTop) || 0) + (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
    var top = el.getBoundingClientRect().top;
    var maxY = document.documentElement.scrollHeight - window.innerHeight;
    if (Math.abs(top - want) > 3 && !(top > want && window.scrollY >= maxY - 2)) {
      window.scrollTo({ top: Math.max(0, window.scrollY + top - want), behavior: "instant" });
    }
  }
  [60, 250, 600, 1000, 1600, 2400, 3500, 5000].forEach(function (ms) { setTimeout(fix, ms); });
  window.addEventListener("load", function () { setTimeout(fix, 30); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(fix, 30); });
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function () { if (stop || Date.now() > end) { ro.disconnect(); return; } fix(); });
    var watch = function () { if (document.body) ro.observe(document.body); };
    if (document.body) watch(); else document.addEventListener("DOMContentLoaded", watch);
  }
})();
