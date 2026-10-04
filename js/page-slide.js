/* 위 메뉴의 큰 항목(메인화면·예배와 말씀·공동체와 양육·선교와 사역·교회 안내·행정) 사이를 옮겨 갈 때
   화면이 옆으로 밀려 지나가게 한다. 메뉴에서 오른쪽 항목으로 가면 새 화면이 오른쪽에서, 왼쪽 항목으로 가면 왼쪽에서 들어온다.
   브라우저의 '화면 전환(View Transitions)' 기능을 쓴다 — 크롬·엣지·삼성인터넷·최신 사파리에서 동작하고,
   지원하지 않는 브라우저에서는 지금처럼 바로 바뀔 뿐이라 문제 없다. 페이지를 더 무겁게 하지 않는다.
   ※ 첫 화면이 그려지기 전에 동작해야 해서 <head> 안에서 불러온다. 움직임은 css 끝 '화면 옆으로 넘기기' 부분. */

// 글씨 크기('가+' 단추, js/layout.js)를 그림을 그리기 전에 먼저 입힌다 — 큰 글씨로 고른 분이 깜빡임 없이 보시게(2026-10-05)
(function () {
  try {
    var v = localStorage.getItem("nojin_text_size");
    if ((v === "ts-l" || v === "ts-xl") && document.documentElement.classList.contains("big-text")) document.documentElement.classList.add(v);
  } catch (e) {}
})();

(function () {
  var ORDER = ["index.html", "word.html", "story.html", "world.html", "welcome.html", "office.html"];
  function idx(u) {
    try {
      var p = new URL(u, location.href);
      if (p.origin !== location.origin) return -1;
      return ORDER.indexOf(p.pathname.split("/").pop() || "index.html");
    } catch (e) { return -1; }
  }
  // 떠나는 화면: 메뉴 큰 항목 사이가 아니면(관리 화면 등) 효과 없이 바로
  window.addEventListener("pageswap", function (e) {
    if (!e.viewTransition) return;
    var to = e.activation && e.activation.entry ? e.activation.entry.url : "";
    var a = idx(location.href), b = idx(to);
    if (a < 0 || b < 0 || a === b) e.viewTransition.skipTransition();
  });
  // 들어오는 화면: 방향 정하기
  window.addEventListener("pagereveal", function (e) {
    if (!e.viewTransition) return;
    var act = window.navigation && navigation.activation;
    var from = act && act.from ? act.from.url : "";
    var a = idx(from), b = idx(location.href);
    if (a < 0 || b < 0 || a === b || (act && act.navigationType === "reload")) { e.viewTransition.skipTransition(); return; }
    e.viewTransition.types.add(b > a ? "slide-next" : "slide-prev");
  });
})();

/* 휴대폰·태블릿: 화면을 오른쪽에서 왼쪽으로 밀면 위 메뉴의 다음 큰 항목으로, 왼쪽에서 오른쪽으로 밀면 이전 항목으로 간다
   (2026-10-03 목사님 요청 — 폰에서는 옆 화면으로 가려면 매번 메뉴를 열어야 해서 불편).
   미는 동안 화면 가장자리에 갈 곳 이름이 나타나고, 충분히 밀었다 떼면 넘어간다(넘어가는 움직임은 위의 화면 전환이 맡는다).
   가로로 움직이는 칸(표·가로 목록·사진 넘기기), 팝업·메뉴가 열려 있을 때, 글을 고르는 중, 화면을 확대해 둔 때,
   화면 맨 가장자리(휴대폰 '뒤로 가기' 손짓 자리)에서 시작한 손짓에는 반응하지 않는다. 마우스로는 동작하지 않는다. */
(function () {
  var ORDER = ["index.html", "word.html", "story.html", "world.html", "welcome.html", "office.html"];
  var NAMES = ["메인화면", "예배와 말씀", "공동체와 양육", "선교와 사역", "교회 안내", "행정"];
  var here = ORDER.indexOf(location.pathname.split("/").pop() || "index.html");
  if (here < 0) return;
  var EDGE = 22;
  var sx = 0, sy = 0, st = 0, on = false, horiz = null, pill = null, target = -1, ready = false;
  function blocked(t) {
    var d = document.documentElement, b = document.body;
    if (!b || d.classList.contains("pop-open") || b.classList.contains("menu-lock") || b.style.overflow === "hidden") return true;
    if (window.visualViewport && visualViewport.scale > 1.05) return true;
    for (var el = t; el && el.nodeType === 1 && el !== b; el = el.parentElement) {
      if (/^(INPUT|TEXTAREA|SELECT|VIDEO|IFRAME|CANVAS|AUDIO)$/.test(el.tagName) || el.isContentEditable) return true;
      if (el.hasAttribute("data-noswipe") || el.getAttribute("data-role") === "stage") return true;
      var cs = getComputedStyle(el);
      if (cs.position === "fixed") return true;   // 머리글·팝업·아래에서 올라오는 창
      if (el.scrollWidth > el.clientWidth + 2 && /(auto|scroll)/.test(cs.overflowX)) return true;   // 가로로 밀리는 칸
    }
    return false;
  }
  function showPill(dx) {
    if (!pill) { pill = document.createElement("div"); pill.className = "swipe-pill"; pill.setAttribute("aria-hidden", "true"); document.body.appendChild(pill); }
    var next = dx < 0;
    pill.className = "swipe-pill " + (next ? "is-right" : "is-left") + (ready ? " is-ready" : "");
    pill.textContent = next ? NAMES[target] + " ›" : "‹ " + NAMES[target];
    var p = Math.min(1, Math.abs(dx) / limit());
    pill.style.opacity = String(Math.max(0, p * 1.15 - .15));
    pill.style.transform = "translateY(-50%) translateX(" + ((next ? 1 : -1) * (1 - p) * 40) + "px)";
  }
  function hidePill() { if (pill) { pill.style.opacity = "0"; } }
  function limit() { return Math.min(120, window.innerWidth * 0.3); }
  document.addEventListener("touchstart", function (e) {
    on = false; horiz = null; target = -1; ready = false;
    if (e.touches.length !== 1) return;
    var t = e.touches[0];
    if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
    if (blocked(e.target)) return;
    sx = t.clientX; sy = t.clientY; st = Date.now(); on = true;
  }, { passive: true });
  document.addEventListener("touchmove", function (e) {
    if (!on || e.touches.length !== 1) { if (on) { on = false; hidePill(); } return; }
    var t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (horiz === null) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      horiz = Math.abs(dx) > Math.abs(dy) * 1.4;
      if (!horiz) { on = false; return; }
    }
    target = here + (dx < 0 ? 1 : -1);
    if (target < 0 || target >= ORDER.length) { target = -1; hidePill(); return; }
    ready = Math.abs(dx) >= limit() && Math.abs(dy) < Math.abs(dx) * 0.6;
    showPill(dx);
  }, { passive: true });
  function finish(e) {
    if (!on) return;
    on = false;
    var t = e.changedTouches && e.changedTouches[0];
    var go = horiz && target >= 0 && t && Date.now() - st < 1500;
    if (go) {
      var dx = t.clientX - sx, dy = t.clientY - sy;
      go = Math.abs(dx) >= limit() && Math.abs(dy) < Math.abs(dx) * 0.6 && (target > here) === (dx < 0);
    }
    if (go) { var sel = window.getSelection && String(window.getSelection()); if (sel) go = false; }
    if (go) { if (pill) pill.classList.add("is-go"); location.href = ORDER[target]; }
    else hidePill();
  }
  document.addEventListener("touchend", finish, { passive: true });
  document.addEventListener("touchcancel", function () { on = false; hidePill(); }, { passive: true });
  // 다른 화면에서 돌아왔을 때(뒤로 가기) 표시가 남지 않게
  window.addEventListener("pageshow", function () { if (pill) { pill.className = "swipe-pill"; pill.style.opacity = "0"; } });

  // 처음 한 번만: 폰에서 '옆으로 밀면 다음 메뉴' 안내를 잠깐 보여 준다
  var KEY = "swipeNavHint1";
  function seen() { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return true; } }
  function markSeen() { try { localStorage.setItem(KEY, "1"); } catch (e) {} }
  if (!(window.matchMedia && matchMedia("(pointer: coarse)").matches) || window.innerWidth > 1024 || seen()) return;
  window.addEventListener("load", function () {
    setTimeout(function () {
      if (seen() || document.documentElement.classList.contains("pop-open")) return;
      markSeen();
      var tip = document.createElement("div");
      tip.className = "swipe-tip";
      tip.setAttribute("role", "status");
      tip.innerHTML = '<span class="swipe-tip-hand" aria-hidden="true">👆</span> 화면을 옆으로 밀면 다음 메뉴로 넘어갑니다';
      document.body.appendChild(tip);
      requestAnimationFrame(function () { tip.classList.add("is-on"); });
      setTimeout(function () { tip.classList.remove("is-on"); setTimeout(function () { tip.remove(); }, 500); }, 4200);
    }, 1800);
  });
})();
