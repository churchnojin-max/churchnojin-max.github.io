/* 예배 순서의 '교독문 51번 시편 118편'을 누르면 그 교독문 전체를 아래에서 올라오는 창(SlideSheet)으로 보여 준다.
   예배 순서는 main.js 가 그리므로, 여기서는 그려진 뒤 '교독문' 줄을 찾아 누를 수 있게 표시만 한다.
   교독문 자료(js/gyodok-data.js, 새찬송가 교독문 1~137번)는 처음 누를 때 한 번만 불러온다. */
(function () {
  "use strict";
  var LIST_SEL = ".hbb-order li, .hb-order li";
  var dataReady = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function loadData() {
    if (window.GYODOK) return Promise.resolve(window.GYODOK);
    if (dataReady) return dataReady;
    dataReady = new Promise(function (ok, fail) {
      var s = document.createElement("script");
      s.src = "js/gyodok-data.js?v=20261002kjv";
      s.onload = function () { window.GYODOK ? ok(window.GYODOK) : fail(new Error("no data")); };
      s.onerror = function () { dataReady = null; fail(new Error("load")); };
      document.head.appendChild(s);
    });
    return dataReady;
  }
  // '교 독 문' 줄인지, 몇 번인지
  function gyodokNo(li) {
    var b = li.querySelector("b");
    if (!b || b.textContent.replace(/\s+/g, "") !== "교독문") return 0;
    var m = li.textContent.replace(b.textContent, "").match(/(\d{1,3})\s*번/);
    var n = m ? Number(m[1]) : 0;
    return n >= 1 && n <= 137 ? n : 0;
  }
  function mark(root) {
    (root || document).querySelectorAll(LIST_SEL).forEach(function (li) {
      if (li.classList.contains("is-gyodok")) return;
      var n = gyodokNo(li);
      if (!n) return;
      li.classList.add("is-gyodok");
      li.dataset.gyodok = n;
      li.setAttribute("role", "button");
      li.setAttribute("tabindex", "0");
      li.setAttribute("aria-label", "교독문 " + n + "번 전체 보기");
      li.insertAdjacentHTML("beforeend", '<em class="gd-more">보기 ›</em>');
    });
  }
  function bodyHtml(body) {
    var lead = true;
    return (body || []).map(function (line) {
      if (/다같이/.test(line.slice(0, 8))) {
        return '<p class="gd-line gd-all"><span class="gd-role">다같이</span><span>' + esc(line.replace(/^\(?다같이\)?\s*/, "")) + "</span></p>";
      }
      var role = lead ? "인도자" : "회중";
      lead = !lead;
      return '<p class="gd-line' + (role === "회중" ? " gd-people" : "") + '"><span class="gd-role">' + role + "</span><span>" + esc(line) + "</span></p>";
    }).join("");
  }
  function open(n) {
    if (!window.SlideSheet) return;
    loadData().then(function (all) {
      var g = all.filter(function (x) { return x.no === n; })[0];
      if (!g) return;
      window.SlideSheet.open("교독문 " + g.no + "번 · " + g.title,
        '<div class="gd-body">' + bodyHtml(g.body) + "</div>" +
        '<p class="gd-note">새찬송가 교독문 (개역개정) · 굵은 글씨는 회중이 함께 읽습니다.</p>');
    }).catch(function () {
      window.SlideSheet.open("교독문 " + n + "번", '<p class="gd-note">교독문을 불러오지 못했습니다. 잠시 뒤 다시 눌러 주세요.</p>');
    });
  }

  document.addEventListener("click", function (e) {
    var li = e.target.closest && e.target.closest("li.is-gyodok");
    if (!li) return;
    e.preventDefault();
    e.stopPropagation();   // 주보 요약 상자 전체를 누른 것으로 치지 않게
    open(Number(li.dataset.gyodok));
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var li = e.target.closest && e.target.closest("li.is-gyodok");
    if (!li) return;
    e.preventDefault();
    open(Number(li.dataset.gyodok));
  });

  // 예배 순서는 주보를 불러온 뒤에 그려지므로, 바뀔 때마다 다시 찾아 표시한다
  mark();
  new MutationObserver(function () { mark(); }).observe(document.body, { childList: true, subtree: true });
})();
