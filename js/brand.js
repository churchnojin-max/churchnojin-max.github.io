/* ============================================================
   brand.js — church.js 설정을 페이지 전체에 자동 적용
   ------------------------------------------------------------
   ※ 교회 관계자는 이 파일을 수정할 필요가 없습니다.
     바꿀 내용은 모두 js/church.js 에 있습니다.

   하는 일:
   1) 브라우저 탭 제목·검색/SNS 미리보기(메타태그·schema)를 우리 교회 정보로 채움
   2) 본문에 남아 있는 중립 표기(○○교회 / OOO CHURCH)를 실제 교회명으로 치환
   3) 대표 색(theme-color), 검색엔진 소유확인 코드 반영
   ============================================================ */
(function () {
  var C = window.CHURCH;
  if (!C) return;
  var NAME = C.name || "";
  var EN = C.nameEn || "";

  // 중립 표기 → 실제 교회명
  function fill(s) {
    if (!s) return s;
    return s.replace(/○○교회/g, NAME).replace(/OOO CHURCH/g, EN);
  }

  // ---- 1) 문서 제목 ----
  document.title = fill(document.title);

  // ---- 2) 메타태그(설명·OG·트위터 등) ----
  document.querySelectorAll("meta[content]").forEach(function (m) {
    if (/○○교회|OOO CHURCH/.test(m.getAttribute("content") || "")) {
      m.setAttribute("content", fill(m.getAttribute("content")));
    }
  });

  function setMeta(sel, val) {
    if (!val) return;
    var m = document.querySelector(sel);
    if (m) m.setAttribute("content", val);
  }
  function setMetaHref(sel, val) {
    if (!val) return;
    var m = document.querySelector(sel);
    if (m) m.setAttribute("href", val);
  }

  // 홈 히어로의 "SINCE ○○○○" 표기 — 설립연도 설정에 맞춤(없으면 숨김)
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".hero-since").forEach(function (el) {
      if (C.since) el.textContent = "SINCE " + C.since;
      else el.style.display = "none";
    });
  });

  // 대표 색 · 앱 제목 · 키워드
  setMeta('meta[name="theme-color"]', C.themeColor);
  setMeta('meta[name="apple-mobile-web-app-title"]', NAME);
  if (C.seo && C.seo.keywords) setMeta('meta[name="keywords"]', C.seo.keywords);

  // 도메인 기반 주소들(정식 주소가 설정된 경우에만 교체)
  if (C.domain && C.domain.indexOf("example.com") === -1) {
    var dom = C.domain.replace(/\/$/, "") + "/";
    setMetaHref('link[rel="canonical"]', dom);
    setMeta('meta[property="og:url"]', dom);
    var ogImg = dom + "images/icon-512.png";
    setMeta('meta[property="og:image"]', ogImg);
  }

  // ---- 3) 검색엔진 소유확인 코드(있을 때만 삽입) ----
  function ensureVerify(name, content) {
    if (!content) return;
    var m = document.querySelector('meta[name="' + name + '"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", name);
      document.head.appendChild(m);
    }
    m.setAttribute("content", content);
  }
  if (C.seo) {
    ensureVerify("google-site-verification", C.seo.google);
    ensureVerify("naver-site-verification", C.seo.naver);
  }

  // ---- 4) schema.org(교회 구조화 데이터) 최신화 ----
  try {
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function (s) {
      var data = JSON.parse(s.textContent);
      if (data && (data["@type"] === "Church" || data["@type"] === "Organization")) {
        data.name = NAME;
        if (EN) data.alternateName = EN;
        if (C.since) data.foundingDate = String(C.since);
        if (C.phone) data.telephone = C.phone;
        if (C.domain && C.domain.indexOf("example.com") === -1) {
          data.url = C.domain;
          data.logo = C.domain.replace(/\/$/, "") + "/images/icon-512.png";
          data.image = data.logo;
        }
        s.textContent = JSON.stringify(data);
      }
    });
  } catch (e) {}

  // ---- 5) 본문 텍스트의 중립 표기 치환 ----
  function walk(root) {
    if (!root) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.nodeName;
        if (tag === "SCRIPT" || tag === "STYLE") return NodeFilter.FILTER_REJECT;
        return /○○교회|OOO CHURCH/.test(n.nodeValue)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });
    var nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(function (n) { n.nodeValue = fill(n.nodeValue); });
  }
  if (document.body) walk(document.body);
  else document.addEventListener("DOMContentLoaded", function () { walk(document.body); });

  // layout.js 가 나중에 헤더/푸터를 주입하므로, 그 뒤로도 한 번 더 훑어 준다.
  document.addEventListener("DOMContentLoaded", function () { walk(document.body); });
})();
