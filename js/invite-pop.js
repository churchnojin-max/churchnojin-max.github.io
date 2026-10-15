/* 첫 화면 알림 창: 손병민 목사 위임감사예배 초대 (2026-10-15 준비, 목사님이 "오픈" 하시면 OPEN = true)
   - 누구에게나(로그인 무관), 이 기기에서 하루 한 번. 예배가 끝난 뒤(10/31 14시)에는 저절로 안 뜬다.
   - 사용법 안내·환영 창·로그인 창 등이 떠 있으면 닫힐 때까지 기다렸다가 띄운다(js/wed-notes.js 와 같은 방식).
   - 미리 보기: 주소 끝에 ?invitepop=1 을 붙이면 OPEN 이 false 여도 띄운다(하루 한 번 표시도 무시). */
(function () {
  "use strict";
  var OPEN = false;                                   // ← 목사님이 "오픈" 하시면 true
  var END = Date.parse("2026-10-31T14:00:00+09:00");  // 이때부터는 안 띄움
  var KEY = "nojin_invite_pop";                       // localStorage: 띄운 날짜(한국 날짜)
  var URL_INVITE = "invite/";

  var force = /[?&]invitepop=1\b/.test(location.search);
  if (!force && (!OPEN || Date.now() >= END)) return;

  function today() { var k = new Date(Date.now() + 9 * 3600e3); return k.toISOString().slice(0, 10); }
  function seen() { try { return localStorage.getItem(KEY) === today(); } catch (e) { return false; } }
  function mark() { try { localStorage.setItem(KEY, today()); } catch (e) {} }
  if (!force && seen()) return;

  function busy() {
    return !!document.querySelector(".modal:not([hidden]), .pop-modal:not([hidden]), .ig-viewer:not([hidden])") ||
      document.documentElement.classList.contains("pop-open") || document.body.classList.contains("menu-lock");
  }

  var CSS =
    ".ivp-box{max-width:380px;width:calc(100% - 32px);padding:0;overflow:hidden;background:#FDF2DE;border-radius:18px;text-align:center}" +
    ".ivp-art{display:block;width:100%;height:auto}" +
    ".ivp-in{padding:4px 22px 22px}" +
    ".ivp-eye{margin:0;font-family:'Gowun Batang',serif;color:#A8843F;letter-spacing:.45em;padding-left:.45em;font-size:.92rem}" +
    ".ivp-who{margin:6px 0 0;font-family:'Gowun Batang',serif;color:#1A3A2F;font-size:1.05rem}" +
    ".ivp-title{margin:0;font-family:'Gowun Batang',serif;color:#1A3A2F;font-size:1.7rem;font-weight:700;line-height:1.3}" +
    ".ivp-when{display:inline-block;margin:12px 0 0;padding:7px 4px;border-top:1px solid #CDB27A;border-bottom:1px solid #CDB27A;color:#2B2A24;font-size:clamp(.8rem,3.6vw,.95rem);white-space:nowrap}" +
    ".ivp-from{margin:10px 0 0;color:#6E6656;font-size:.86rem}" +
    ".ivp-btns{display:grid;gap:8px;margin-top:16px}" +
    ".ivp-btns .btn{width:100%;min-height:48px;justify-content:center}" +
    ".ivp-go{background:#1A3A2F !important;border-color:#1A3A2F !important;color:#FDF2DE !important}" +
    ".ivp-box .modal-close{background:rgba(253,242,222,.85)}";

  var el = null, on = false, wait = 0;
  function show() {
    if (on) return;
    if (busy()) { if (wait++ < 120) setTimeout(show, 1500); return; }
    if (!el) {
      var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
      el = document.createElement("div");
      el.className = "modal ivp";
      el.hidden = true;
      el.innerHTML = '<div class="modal-backdrop" data-ivp="close"></div>' +
        '<div class="modal-box ivp-box" role="dialog" aria-modal="true" aria-labelledby="ivpTitle">' +
          '<button type="button" class="modal-close" data-ivp="close" aria-label="닫기">&times;</button>' +
          '<img class="ivp-art" src="invite/hero.jpg" alt="" />' +
          '<div class="ivp-in">' +
            '<p class="ivp-eye">초대합니다</p>' +
            '<p class="ivp-who">손병민 목사</p>' +
            '<h3 class="ivp-title" id="ivpTitle">위임감사예배</h3>' +
            '<p class="ivp-when">2026년 10월 31일 토요일 오전 11시</p>' +
            '<p class="ivp-from">노진교회 담임목사 손병민 · 교우 일동</p>' +
            '<div class="ivp-btns">' +
              '<a class="btn btn-solid ivp-go" href="' + URL_INVITE + '" data-ivp="go">초대장 보기</a>' +
              '<button type="button" class="btn btn-line" data-ivp="close">닫기</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(el);
      el.addEventListener("click", function (e) {
        var b = e.target.closest("[data-ivp]");
        if (!b) return;
        if (b.getAttribute("data-ivp") === "close") { e.preventDefault(); close(); }
      });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && on) close(); });
    }
    if (!force) mark();
    el.hidden = false;
    on = true;
    document.body.style.overflow = "hidden";
    document.documentElement.classList.add("pop-open");   // 뒤 화면이 옆으로 넘어가지 않게
    if (window.ModalNav) window.ModalNav.open(hide);       // 휴대폰 '뒤로'로 이 창만 닫히게
  }
  function hide() {
    if (!on) return;
    on = false;
    el.hidden = true;
    if (!document.querySelector(".modal:not([hidden]), .pop-modal:not([hidden])")) {
      document.body.style.overflow = "";
      document.documentElement.classList.remove("pop-open");
    }
  }
  function close() { if (on && !(window.ModalNav && window.ModalNav.close())) hide(); }

  if (document.readyState === "complete") setTimeout(show, 1500);
  else window.addEventListener("load", function () { setTimeout(show, 1500); });
})();
