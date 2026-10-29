/* 첫 화면 작은 알림 창: 손병민 목사 위임감사예배 순서지 (2026-10-15 초대장 창으로 시작, 10/30 작은 창으로 바꿈)
   - 2026-10-30 목사님: "작은 창 하나를 오늘·내일 계속 팝업으로 뜨게 해서 눌러서 들어갈 수 있게. 내일 오후 3시 이후면 팝업 삭제"
     → 화면을 가리지 않는 작은 카드(아래쪽), 들어올 때마다 뜸(하루 한 번 제한 없음), 누르면 순서지(order/), × 는 이번 화면에서만 닫힘
     → 2026-10-31 15:00 부터는 아예 안 뜸(END). 그 뒤에도 보려면 주소 끝에 ?orderpop=1
   - 누구에게나(로그인 무관). 환영 창·사용법 안내가 떠 있어도 그 뒤에 가만히 있다가 창이 닫히면 보인다(z-index 150: modal 200 보다 낮고, 맨 위로·실시간 단추(400, 아래 구석)와 안 겹치게 그 위쪽에).
   - 예전 큰 초대장 창은 git 기록(c35e78f·dea7daa)에 있음. */
(function () {
  "use strict";
  var OPEN = true;
  var END = Date.parse("2026-10-31T15:00:00+09:00");  // 이때부터는 안 띄움(목사님 10/30 "내일 오후 3시 이후면 삭제")
  var URL_ORDER = "order/";                           // 디지털 순서지(12판), 로그인 없이 누구나
  var force = /[?&](invitepop|orderpop)=1\b/.test(location.search);
  if (!force && (!OPEN || Date.now() >= END)) return;

  var CSS =
    ".ivm{position:fixed;left:50%;bottom:calc(82px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:150;" +
      "width:min(420px,calc(100% - 24px));display:flex;align-items:center;gap:12px;padding:10px 44px 10px 10px;" +
      "background:#FDF2DE;color:#1A3A2F;border:1px solid #CDB27A;border-radius:16px;box-shadow:0 10px 30px rgba(26,58,47,.28);" +
      "text-decoration:none;font-family:inherit;opacity:0;transition:opacity .35s,transform .35s}" +
    ".ivm.ivm-in{opacity:1}" +
    ".ivm:active{transform:translateX(-50%) scale(.985)}" +
    ".ivm-img{flex:0 0 56px;width:56px;height:56px;border-radius:10px;object-fit:cover;object-position:center top;background:#1A3A2F}" +
    ".ivm-txt{min-width:0;flex:1;text-align:left;line-height:1.3}" +
    ".ivm-eye{display:block;font-family:'Gowun Batang',serif;color:#A8843F;font-size:.74rem;letter-spacing:.3em}" +
    ".ivm-ttl{display:block;font-family:'Gowun Batang',serif;font-weight:700;font-size:1.08rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".ivm-sub{display:block;color:#6E6656;font-size:.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".ivm-sub b{color:#1A3A2F;font-weight:600}" +
    ".ivm-x{position:absolute;top:6px;right:6px;width:32px;height:32px;border:0;border-radius:50%;background:transparent;color:#6E6656;font-size:22px;line-height:32px;cursor:pointer}" +
    ".ivm-x:hover{background:rgba(26,58,47,.08)}" +
    "@media (min-width:900px){.ivm{left:auto;right:22px;transform:none;bottom:86px}.ivm:active{transform:scale(.985)}}";

  var el = null;
  function show() {
    if (el) return;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    el = document.createElement("a");
    el.className = "ivm";
    el.href = URL_ORDER;
    el.setAttribute("aria-label", "위임감사예배 순서지 보기");
    el.innerHTML =
      '<img class="ivm-img" src="order/img/cover.jpg" alt="" />' +
      '<span class="ivm-txt">' +
        '<span class="ivm-eye">위임감사예배</span>' +
        '<span class="ivm-ttl">순서지 보기 ›</span>' +
        '<span class="ivm-sub"><b>10월 31일(토) 오전 11시</b> · 로그인 없이 볼 수 있어요</span>' +
      '</span>' +
      '<button type="button" class="ivm-x" aria-label="닫기">&times;</button>';
    document.body.appendChild(el);
    el.querySelector(".ivm-x").addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      el.classList.remove("ivm-in");
      setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 350);
    });
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("ivm-in"); }); });
  }

  if (document.readyState === "complete") setTimeout(show, 900);
  else window.addEventListener("load", function () { setTimeout(show, 900); });
})();
