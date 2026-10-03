/* 예배 순서·설교 요약·칼럼에서 '눌러서 보기'
   ① 예배 순서(.hbb-order / .hb-order)의 교독문·사도신경·성경봉독 줄 → 아래에서 올라오는 창(SlideSheet)에 전문
      찬송가 줄(예: 찬송가 28장 / 복의 근원 강림하사, 봉헌 445장 / …)은 새찬송가 악보 — 저작권 때문에 로그인한 정회원만
      (Supabase 비공개 보관함 'hymns' 의 001~645.webp, supabase/hymns_bucket.sql 의 is_full_member() 규칙).
   ② 설교 요약·칼럼·신앙 상담 글 속 성경 장절(예: 롬 8:17, 창세기 15장 7절) → 누르면 그 자리 아래에 본문이 펼쳐짐
   성경 본문은 개역개정(data/gyr/01~66.json, data/bible-gyr.json 을 책별로 나눈 것), 교독문은 js/gyodok-data.js.
   예배 순서·요약은 main.js 가 주보를 불러온 뒤 그리므로, 그려질 때마다 다시 찾아 표시한다. */
(function () {
  "use strict";

  // [번호, 책 이름, 약칭, 다른 이름…]
  var BOOKS = [
    [1, "창세기", "창"], [2, "출애굽기", "출"], [3, "레위기", "레"], [4, "민수기", "민"], [5, "신명기", "신"],
    [6, "여호수아", "수"], [7, "사사기", "삿"], [8, "룻기", "룻"], [9, "사무엘상", "삼상"], [10, "사무엘하", "삼하"],
    [11, "열왕기상", "왕상"], [12, "열왕기하", "왕하"], [13, "역대상", "대상"], [14, "역대하", "대하"], [15, "에스라", "스"],
    [16, "느헤미야", "느"], [17, "에스더", "에"], [18, "욥기", "욥"], [19, "시편", "시"], [20, "잠언", "잠"],
    [21, "전도서", "전"], [22, "아가", "아"], [23, "이사야", "사"], [24, "예레미야", "렘"], [25, "예레미야애가", "애"],
    [26, "에스겔", "겔"], [27, "다니엘", "단"], [28, "호세아", "호"], [29, "요엘", "욜"], [30, "아모스", "암"],
    [31, "오바댜", "옵"], [32, "요나", "욘"], [33, "미가", "미"], [34, "나훔", "나"], [35, "하박국", "합"],
    [36, "스바냐", "습"], [37, "학개", "학"], [38, "스가랴", "슥"], [39, "말라기", "말"], [40, "마태복음", "마"],
    [41, "마가복음", "막"], [42, "누가복음", "눅"], [43, "요한복음", "요"], [44, "사도행전", "행"], [45, "로마서", "롬"],
    [46, "고린도전서", "고전"], [47, "고린도후서", "고후"], [48, "갈라디아서", "갈"], [49, "에베소서", "엡"], [50, "빌립보서", "빌"],
    [51, "골로새서", "골"], [52, "데살로니가전서", "살전"], [53, "데살로니가후서", "살후"], [54, "디모데전서", "딤전"], [55, "디모데후서", "딤후"],
    [56, "디도서", "딛"], [57, "빌레몬서", "몬"], [58, "히브리서", "히"], [59, "야고보서", "약"], [60, "베드로전서", "벧전"],
    [61, "베드로후서", "벧후"], [62, "요한일서", "요일", "요한1서"], [63, "요한이서", "요이", "요한2서"], [64, "요한삼서", "요삼", "요한3서"], [65, "유다서", "유"],
    [66, "요한계시록", "계"]
  ];
  var NAME2NO = {};
  BOOKS.forEach(function (b) { for (var i = 1; i < b.length; i++) NAME2NO[b[i]] = b[0]; });
  NAME2NO["시편"] = 19; NAME2NO["룻"] = 8; NAME2NO["욥"] = 18;
  var NAMES = Object.keys(NAME2NO).sort(function (a, b) { return b.length - a.length; });
  var BOOK_RE = NAMES.join("|");
  // 창세기 15장 1~6절 / 창 15:1-6 / 롬 8:17 / 시편 23편 / 요 3:16, 18
  var REF_RE = new RegExp(
    "(^|[^가-힣])(" + BOOK_RE + ")\\s?(\\d{1,3})\\s*(?:(?:장|편)\\s*(\\d{1,3})\\s*절?|:\\s*(\\d{1,3}))" +
    "(?:\\s*[-~–]\\s*(?:(\\d{1,3})\\s*:\\s*)?(\\d{1,3})\\s*절?)?", "g");
  var CH_RE = new RegExp("(" + BOOK_RE + ")\\s?(\\d{1,3})\\s*(?:장|편)(?!\\s*\\d)");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function bookName(no) { return BOOKS[no - 1][1]; }

  // ── 성경 본문(개역개정): 책 하나씩 필요할 때 불러온다
  var bookCache = {};
  function loadBook(no) {
    if (!bookCache[no]) {
      bookCache[no] = fetch("data/gyr/" + (no < 10 ? "0" : "") + no + ".json?v=20261002")
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .catch(function (e) { delete bookCache[no]; throw e; });
    }
    return bookCache[no];
  }
  // 정규식 한 건 → {no, c1, v1, c2, v2}
  function refFromMatch(m) {
    var no = NAME2NO[m[2]], c1 = +m[3], v1 = +(m[4] || m[5]);
    var c2 = m[6] ? +m[6] : c1, v2 = m[7] ? +m[7] : v1;
    if (!no || !c1 || !v1) return null;
    if (c2 === c1 && v2 < v1) v2 = v1;
    return { no: no, c1: c1, v1: v1, c2: c2, v2: v2 };
  }
  function parseRef(text) {
    REF_RE.lastIndex = 0;
    var m = REF_RE.exec(String(text || ""));
    if (m) return refFromMatch(m);
    var w = String(text || "").match(CH_RE);   // 장 전체(시편 23편)
    if (w && NAME2NO[w[1]]) return { no: NAME2NO[w[1]], c1: +w[2], v1: 1, c2: +w[2], v2: 999 };
    return null;
  }
  function refLabel(r) {
    var s = bookName(r.no) + " " + r.c1 + ":" + r.v1;
    if (r.c2 !== r.c1) s += "-" + r.c2 + ":" + r.v2;
    else if (r.v2 !== r.v1 && r.v2 !== 999) s += "-" + r.v2;
    if (r.v1 === 1 && r.v2 === 999) s = bookName(r.no) + " " + r.c1 + (r.no === 19 ? "편" : "장");
    return s;
  }
  var cleanV = function (t) { return String(t).replace(/([가-힣A-Za-z])\d{1,2}\)/g, "$1").trim(); };   // 각주 번호(1)) 빼기
  function getVerses(r) {
    return loadBook(r.no).then(function (book) {
      var out = [];
      for (var c = r.c1; c <= r.c2; c++) {
        var chap = book[c - 1] || [];
        var from = c === r.c1 ? r.v1 : 1, to = c === r.c2 ? Math.min(r.v2, chap.length) : chap.length;
        for (var v = from; v <= to; v++) if (chap[v - 1]) out.push({ c: c, v: v, t: cleanV(chap[v - 1]) });
      }
      return out;
    });
  }
  function versesHtml(list, multiChap) {
    return '<div class="sv-lines">' + list.map(function (x) {
      return '<p class="sv-line"><sup>' + (multiChap ? x.c + ":" : "") + x.v + "</sup>" + esc(x.t) + "</p>";
    }).join("") + "</div>";
  }

  // ── 교독문·사도신경
  var gyodokReady = null;
  function loadGyodok() {
    if (window.GYODOK) return Promise.resolve(window.GYODOK);
    if (!gyodokReady) {
      gyodokReady = new Promise(function (ok, fail) {
        var s = document.createElement("script");
        s.src = "js/gyodok-data.js?v=20261002kjv";
        s.onload = function () { window.GYODOK ? ok(window.GYODOK) : fail(new Error("no data")); };
        s.onerror = function () { gyodokReady = null; fail(new Error("load")); };
        document.head.appendChild(s);
      });
    }
    return gyodokReady;
  }
  function gyodokHtml(body) {
    var lead = true;
    return '<div class="gd-body">' + (body || []).map(function (line) {
      if (/다같이/.test(line.slice(0, 8))) {
        return '<p class="gd-line gd-all"><span class="gd-role">다같이</span><span>' + esc(line.replace(/^\(?다같이\)?\s*/, "")) + "</span></p>";
      }
      var role = lead ? "인도자" : "회중";
      lead = !lead;
      return '<p class="gd-line' + (role === "회중" ? " gd-people" : "") + '"><span class="gd-role">' + role + "</span><span>" + esc(line) + "</span></p>";
    }).join("") + "</div>";
  }
  // 주보 만들기(js/affairs.js)에 넣어 쓰는 것과 같은 사도신경
  var CREED = ["전능하사 천지를 만드신 하나님 아버지를 내가 믿사오며,", "그 외아들 우리 주 예수 그리스도를 믿사오니,",
    "이는 성령으로 잉태하사 동정녀 마리아에게 나시고,", "본디오 빌라도에게 고난을 받으사, 십자가에 못 박혀 죽으시고,",
    "장사한 지 사흘 만에 죽은 자 가운데서 다시 살아나시며,", "하늘에 오르사, 전능하신 하나님 우편에 앉아 계시다가,",
    "저리로서 산 자와 죽은 자를 심판하러 오시리라.", "성령을 믿사오며, 거룩한 공회와, 성도가 서로 교통하는 것과,",
    "죄를 사하여 주시는 것과, 몸이 다시 사는 것과, 영원히 사는 것을 믿사옵나이다. 아멘."];
  function prayerHtml(lines) { return '<div class="cr-body">' + lines.map(function (l) { return "<p>" + esc(l) + "</p>"; }).join("") + "</div>"; }

  function sheet(title, html) { if (window.SlideSheet) window.SlideSheet.open(title, html); }

  // ── 새찬송가 악보(정회원만). 서명된 주소는 1시간짜리라 같은 장은 그동안 다시 받지 않는다.
  var hymnUrls = {};
  function hymnMsg(text, login) {
    return '<p class="hy-msg">' + text + '</p>' +
      (login ? '<p class="hy-msg"><button type="button" class="wv-more hy-login">로그인하기 ›</button></p>' : "");
  }
  function openHymn(no, title) {
    var head = "찬송가 " + no + "장" + (title ? " · " + title : "");
    var sb = window.__sb;
    if (!sb) { sheet(head, hymnMsg("로그인한 정회원만 사용할 수 있습니다.", false)); return; }
    sheet(head, '<p class="gd-note">악보를 불러오는 중…</p>');
    var body = document.getElementById("slideSheetBody");
    var token = {};
    if (body) body.__hy = token;
    function put(html) { if (body && body.__hy === token) body.innerHTML = html; }
    sb.auth.getSession().then(function (r) {
      if (!(r && r.data && r.data.session)) { put(hymnMsg("<b>로그인한 정회원</b>만 사용할 수 있습니다.", true)); return; }
      var key = ("00" + no).slice(-3) + ".webp";
      var hit = hymnUrls[key];
      var p = hit && hit.until > Date.now() ? Promise.resolve(hit.url)
        : sb.storage.from("hymns").createSignedUrl(key, 3600).then(function (res) {
            if (res.error || !res.data) throw res.error || new Error("no url");
            hymnUrls[key] = { url: res.data.signedUrl, until: Date.now() + 50 * 60 * 1000 };
            return res.data.signedUrl;
          });
      return p.then(function (url) {
        put('<figure class="hy-fig"><img class="hy-img" src="' + esc(url) + '" alt="' + esc(head) + ' 악보" /></figure>' +
          '<p class="gd-note">정회원 전용</p>');
      }, function () {
        put(hymnMsg("<b>정회원</b>만 사용할 수 있습니다.<br>정회원 승인을 받으시면 바로 보입니다.", false));
      });
    }).catch(function () { put(hymnMsg("악보를 불러오지 못했습니다. 잠시 뒤 다시 눌러 주세요.", false)); });
  }
  window.HymnView = { open: openHymn };
  function openOrder(kind, arg) {
    if (kind === "gyodok") {
      loadGyodok().then(function (all) {
        var g = all.filter(function (x) { return x.no === arg; })[0];
        if (g) sheet("교독문 " + g.no + "번 · " + g.title, gyodokHtml(g.body) +
          '<p class="gd-note">새찬송가 교독문 (개역개정) · 굵은 글씨는 회중이 함께 읽습니다.</p>');
      }).catch(function () { sheet("교독문 " + arg + "번", '<p class="gd-note">교독문을 불러오지 못했습니다. 잠시 뒤 다시 눌러 주세요.</p>'); });
    } else if (kind === "hymn") {
      openHymn(arg[0], arg[1]);
    } else if (kind === "creed") {
      sheet("사도신경", prayerHtml(CREED) + '<p class="gd-note">함께 고백합니다.</p>');
    } else if (kind === "bible") {
      var r = arg;
      getVerses(r).then(function (list) {
        if (!list.length) throw new Error("none");
        sheet("성경봉독 · " + refLabel(r), versesHtml(list, r.c2 !== r.c1) + '<p class="gd-note">개역개정</p>');
      }).catch(function () { sheet("성경봉독", '<p class="gd-note">본문을 불러오지 못했습니다. 잠시 뒤 다시 눌러 주세요.</p>'); });
    }
  }

  // 주보 설교 요약의 인용구절(●장절 + 본문) — main.js 가 window.BULLETIN_XREFS 에 넣어 둔다.
  // '[함께 나누는 질문]' 같은 질문 칸은 빼고, ● 줄마다 그 아래 줄들을 본문으로 묶는다.
  function parseXrefs(text) {
    var out = [], cur = null, skip = false;
    String(text || "").split(/\r?\n/).forEach(function (raw) {
      var l = raw.trim();
      if (!l) return;
      if (/^\[.*\]$/.test(l)) { skip = /질문/.test(l); cur = null; return; }
      if (skip) return;
      var m = l.match(/^●\s*(.+)$/);
      if (m) { cur = { label: m[1].trim(), text: [] }; out.push(cur); return; }
      if (cur) cur.text.push(l);
    });
    return out;
  }
  function openXrefs() {
    var list = parseXrefs(window.BULLETIN_XREFS);
    if (!list.length) return;
    var html = '<div class="xr-list">' + list.map(function (x, i) {
      return '<div class="xr-item"><p class="vref-head">' + esc(x.label) + '</p>' +
        (x.text.length ? '<p class="sv-line">' + esc(x.text.join(" ")) + '</p>' : '<p class="sv-line xr-fill" data-i="' + i + '">불러오는 중…</p>') + '</div>';
    }).join("") + '</div><p class="gd-note">설교에 인용된 말씀 ' + list.length + '곳 · 개역개정</p>';
    sheet("설교 인용구절", html);
    // 본문 없이 장절만 적힌 줄은 찾아서 채운다
    list.forEach(function (x, i) {
      if (x.text.length) return;
      var r = parseRef(x.label);
      var el = document.querySelector('.xr-fill[data-i="' + i + '"]');
      if (!el) return;
      if (!r) { el.textContent = ""; return; }
      getVerses(r).then(function (vs) { el.textContent = vs.map(function (v) { return v.t; }).join(" "); })
        .catch(function () { el.textContent = "본문을 불러오지 못했습니다."; });
    });
  }

  // ① 예배 순서 줄 표시
  function orderKind(li) {
    var b = li.querySelector("b");
    if (!b) return null;
    var name = b.textContent.replace(/\s+/g, "");
    var rest = li.textContent.replace(b.textContent, "");
    var m;
    if (name === "교독문" && (m = rest.match(/(\d{1,3})\s*번/)) && +m[1] >= 1 && +m[1] <= 137) return ["gyodok", +m[1]];
    if (/사도신경/.test(name + rest)) return ["creed"];
    // 찬송가: 이름이 찬송(가)이고 'NNN장'이 있거나, 'NNN장 / 제목' 꼴(봉헌 찬송 등). 성경 장절(창세기 15장 7절)과 헷갈리지 않게 책 이름이 앞에 오면 뺀다
    var hm = rest.match(/(^|[^가-힣\d])(\d{1,3})\s*장(?!\s*\d)(?:\s*[\/·]\s*([^\/]+))?/);
    if (hm && +hm[2] >= 1 && +hm[2] <= 645 && (/찬송/.test(name) || hm[3]) && !parseRef(rest)) {
      return ["hymn", [+hm[2], (hm[3] || "").replace(/\s+/g, " ").trim()]];
    }
    if (/성경봉독|성경말씀|봉독/.test(name)) { var r = parseRef(rest); if (r) return ["bible", r]; }
    return null;
  }
  var ORDER_KINDS = [];
  function markOrders(root) {
    root.querySelectorAll(".hbb-order li, .hb-order li").forEach(function (li) {
      if (li.dataset.wv) return;
      li.dataset.wv = "-";
      var k = orderKind(li);
      if (!k) return;
      li.dataset.wv = ORDER_KINDS.push(k) - 1;
      li.classList.add("is-wv");
      li.setAttribute("role", "button");
      li.setAttribute("tabindex", "0");
      // 성경봉독 줄에는 설교 인용구절이 있으면 '인용구절 보기'도 함께(휴대폰에서는 '보기' 밑으로)
      var xr = k[0] === "bible" && parseXrefs(window.BULLETIN_XREFS).length
        ? '<em class="wv-more wv-xref" role="button" tabindex="0">인용구절 ›</em>' : "";
      // 찬송가 줄은 주황 '보기'와 헷갈리지 않게 파란 '♪ 악보'(2026-10-03 목사님 요청)
      if (k[0] === "hymn") li.classList.add("is-hymn");
      var label = k[0] === "hymn" ? "♪ 악보 ›" : "보기 ›";
      li.insertAdjacentHTML("beforeend", '<em class="wv-btns"><em class="wv-more">' + label + '</em>' + xr + '</em>');
    });
  }

  // ② 글 속 장절 → 누르면 펼쳐지는 본문
  var REF_SCOPE = ".ws-body, .hb-summary, .column-text, .qna-a, .ss-q, .hc-d-a";
  function linkRefs(root) {
    root.querySelectorAll(REF_SCOPE).forEach(function (box) {
      if (box.dataset.vrefDone) return;
      box.dataset.vrefDone = "1";
      // ●장절 바로 아래에 본문이 이미 적혀 있으면 그 줄은 건너뛴다
      var skip = [];
      box.querySelectorAll(".ss-xref").forEach(function (x) {
        var n = x.nextElementSibling;
        if (n && n.tagName === "P" && !n.className) skip.push(x);
      });
      var walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, null);
      var nodes = [], t;
      while ((t = walker.nextNode())) {
        if (!t.nodeValue || t.nodeValue.length < 4) continue;
        if (t.parentElement.closest(".vref, .vref-box, button, a")) continue;
        if (skip.some(function (s) { return s.contains(t); })) continue;
        nodes.push(t);
      }
      nodes.forEach(function (node) {
        var s = node.nodeValue, last = 0, m, frag = null;
        REF_RE.lastIndex = 0;
        while ((m = REF_RE.exec(s))) {
          var r = refFromMatch(m);
          if (!r) continue;
          var start = m.index + m[1].length;
          var label = s.slice(start, m.index + m[0].length);
          frag = frag || document.createDocumentFragment();
          frag.appendChild(document.createTextNode(s.slice(last, start)));
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "vref";
          btn.textContent = label;
          btn.dataset.ref = JSON.stringify(r);
          btn.setAttribute("aria-expanded", "false");
          frag.appendChild(btn);
          last = start + label.length;
        }
        if (frag) {
          frag.appendChild(document.createTextNode(s.slice(last)));
          node.parentNode.replaceChild(frag, node);
        }
      });
      // 주보 '함께 읽을 말씀'에 ●장절만 적고 본문을 비워 두었으면, 본문을 찾아 바로 펼쳐 둔다
      box.querySelectorAll(".ss-xref").forEach(function (x) {
        if (skip.indexOf(x) >= 0) return;
        var b = x.querySelector("button.vref");
        if (b && b.getAttribute("aria-expanded") === "false") toggleRef(b);
      });
    });
  }
  function toggleRef(btn) {
    var holder = btn.closest("p, li, .ss-xref") || btn.parentElement;
    var box = holder.nextElementSibling;
    if (box && box.classList.contains("vref-box") && box.dataset.for === btn.dataset.ref) {
      box.remove();
      btn.setAttribute("aria-expanded", "false");
      return;
    }
    var r = JSON.parse(btn.dataset.ref);
    var nb = document.createElement("div");
    nb.className = "vref-box";
    nb.dataset.for = btn.dataset.ref;
    nb.innerHTML = '<p class="vref-head">' + esc(refLabel(r)) + ' <small>개역개정</small></p><p class="gd-note">불러오는 중…</p>';
    holder.parentNode.insertBefore(nb, holder.nextSibling);
    btn.setAttribute("aria-expanded", "true");
    getVerses(r).then(function (list) {
      nb.innerHTML = '<p class="vref-head">' + esc(refLabel(r)) + ' <small>개역개정</small></p>' +
        (list.length ? versesHtml(list, r.c2 !== r.c1) : '<p class="gd-note">본문을 찾지 못했습니다.</p>');
    }).catch(function () { nb.innerHTML = '<p class="gd-note">본문을 불러오지 못했습니다. 잠시 뒤 다시 눌러 주세요.</p>'; });
  }

  // 누르기
  document.addEventListener("click", function (e) {
    var lb = e.target.closest && e.target.closest(".hy-login");
    if (lb) {
      e.preventDefault();
      e.stopPropagation();
      if (window.SlideSheet && window.SlideSheet.close) window.SlideSheet.close();
      var b = document.getElementById("loginBtn");
      if (b) setTimeout(function () { b.click(); }, 250);
      return;
    }
    var hi = e.target.closest && e.target.closest(".hy-img");
    if (hi) { e.stopPropagation(); return; }   // 악보를 눌러도 창이 닫히지 않게(손가락으로 확대해 보기)
    var xb = e.target.closest && e.target.closest(".wv-xref");
    if (xb) {
      e.preventDefault();
      e.stopPropagation();
      openXrefs();
      return;
    }
    var li = e.target.closest && e.target.closest("li.is-wv");
    if (li) {
      e.preventDefault();
      e.stopPropagation();   // 주보 요약 상자 전체를 누른 것으로 치지 않게
      var k = ORDER_KINDS[+li.dataset.wv];
      if (k) openOrder(k[0], k[1]);
      return;
    }
    var btn = e.target.closest && e.target.closest("button.vref");
    if (btn) {
      e.preventDefault();
      e.stopPropagation();   // 창이 닫히지 않게(설교 창은 글을 누르면 닫힌다)
      toggleRef(btn);
    }
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.target.closest && e.target.closest(".wv-xref")) { e.preventDefault(); openXrefs(); return; }
    var li = e.target.closest && e.target.closest("li.is-wv");
    if (!li) return;
    e.preventDefault();
    var k = ORDER_KINDS[+li.dataset.wv];
    if (k) openOrder(k[0], k[1]);
  });

  function scan() { markOrders(document); linkRefs(document); }
  scan();
  var pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; scan(); });
  }).observe(document.body, { childList: true, subtree: true });

  window.WorshipView = { parseRef: parseRef, getVerses: getVerses };
})();
