/* 위 메뉴의 큰 항목(메인화면·예배와 말씀·공동체와 양육·선교와 사역·교회 안내·행정) 사이를 옮겨 갈 때
   화면이 옆으로 밀려 지나가게 한다. 메뉴에서 오른쪽 항목으로 가면 새 화면이 오른쪽에서, 왼쪽 항목으로 가면 왼쪽에서 들어온다.
   브라우저의 '화면 전환(View Transitions)' 기능을 쓴다 — 크롬·엣지·삼성인터넷·최신 사파리에서 동작하고,
   지원하지 않는 브라우저에서는 지금처럼 바로 바뀔 뿐이라 문제 없다. 페이지를 더 무겁게 하지 않는다.
   ※ 첫 화면이 그려지기 전에 동작해야 해서 <head> 안에서 불러온다. 움직임은 css 끝 '화면 옆으로 넘기기' 부분. */
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
