/* 사회안 만들기 — 주보 제작(js/affairs.js)의 '📋 사회안 만들기'가 새 창에 A4 사회안을 그린다.
   주보 데이터(예배 순서·본문 말씀·교회소식) + 사도신경 + 교독문(js/gyodok-data.js) + 새찬송가 악보(비공개 보관함 hymns)
   + 설교 원고(창에서 hwpx를 골라 넣으면 굵은 글씨까지 그대로). 창 안의 글자는 바로 고칠 수 있고, 인쇄·PDF로 저장한다.
   모양은 목사님이 한글로 만들던 바탕화면 노진교회\사회안\노진교회 사회안 MMDD.hwpx 를 따랐다. */
window.Sahoean = (function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nz(s) { return String(s || '').replace(/\s+/g, ''); }

  // 사회안 원본(한글 파일)에 있던 문구 그대로
  var INVITE = ['형제들아! 우리가 예수의 피를 힘입어 성소에 들어갈 담력을 얻었나니',
    '참 마음과 온전한 믿음으로 하나님께 나아가자',
    '하나님은 영이시니 예배하는 자가 영과 진리로 예배할지니라 <아멘>'];
  var CREED = [
    ['전능하사 천지를 만드신 하나님 아버지를 내가 믿사오며,', '그 외아들 우리 주 예수 그리스도를 믿사오니,', '이는 성령으로 잉태하사 동정녀 마리아에게 나시고,'],
    ['본디오 빌라도에게 고난을 받으사, 십자가에 못 박혀 죽으시고,', '장사한 지 사흘 만에 죽은 자 가운데서 다시 살아나시며,'],
    ['하늘에 오르사, 전능하신 하나님 우편에 앉아 계시다가,', '저리로서 산 자와 죽은 자를 심판하러 오시리라.'],
    ['성령을 믿사오며, 거룩한 공회와, 성도가 서로 교통하는 것과,', '죄를 사하여 주시는 것과, 몸이 다시 사는 것과,', '영원히 사는 것을 믿사옵나이다. 아멘.']
  ];

  function dateParts(bdate) {
    var m = String(bdate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return { m: +m[2], d: +m[3], mmdd: m[2] + m[3] };
  }
  function hymnOf(detail) {
    var m = String(detail || '').match(/(\d{1,3})\s*장(?:\s*[\/·]\s*(.+))?/);
    if (!m || +m[1] < 1 || +m[1] > 645) return null;
    var title = (m[2] || '').trim();
    if (!title && window.HYMNS) {
      var h = window.HYMNS.filter(function (x) { return x.no === +m[1]; })[0];
      if (h) title = h.title;
    }
    return { no: +m[1], title: title };
  }
  // "창세기 15장 1~6절(구약. 17p)" → "창세기 15장 1~6절(구약 p.17)"
  function tidyBible(detail) {
    return String(detail || '').replace(/\(\s*(구약|신약)\s*\.?\s*(\d+)\s*p\s*\)/, '($1 p.$2)');
  }
  // "창세기 15장 1~6절" → "창세기 15:1~6"
  function shortRef(s) {
    var m = String(s || '').match(/^\s*([가-힣0-9]+?)\s*(\d+)\s*(?:장|편)\s*(\d+)\s*절?\s*(?:[~\-–]\s*(\d+)\s*절?)?/);
    if (!m) return String(s || '').trim();
    return m[1] + ' ' + m[2] + ':' + m[3] + (m[4] ? '~' + m[4] : '');
  }

  function head(parts) {
    return '<h3 class="sa-h"><span class="sq">■</span>' + parts.map(function (p) {
      return typeof p === 'string' ? esc(p) : '<span class="red">' + esc(p.red) + '</span>';
    }).join(' / ') + '</h3>';
  }
  function block(h, box, cls) {
    return '<section class="blk' + (cls ? ' ' + cls : '') + '">' + h + (box || '') + '</section>';
  }
  function scoreBox(no) {
    return '<div class="box score" data-k="score" data-hymn="' + no + '"><p class="hint">찬송가 ' + no + '장 악보를 불러오는 중…</p></div>';
  }

  function gyodokBox(no) {
    var g = (window.GYODOK || []).filter(function (x) { return x.no === no; })[0];
    if (!g) return '<div class="box" data-k="gyodok"><p class="hint">교독문 ' + no + '번을 찾지 못했습니다.</p></div>';
    var html = '<p class="gd-t">교독문 ' + g.no + '번 · ' + esc(g.title) + '</p><p class="gap">&nbsp;</p>';
    var n = 0, lead = true;
    g.body.forEach(function (raw) {
      // 줄 끝 장절 표시 (1-10)·(시 102:25-27)·(사 9:6, 7상) 는 사회안에 쓰지 않는다
      var line = String(raw).replace(/\s*\((?:[가-힣]+\s*)?\d+(?::\d+)?[상하]?(?:\s*[-~,]\s*(?:\d+:)?\d+[상하]?)*\)\s*$/, '').trim();
      if (/다같이/.test(line.slice(0, 8))) {
        html += '<p class="gd-all"><b>(다같이) ' + esc(line.replace(/^\(?다같이\)?\s*/, '')) + '</b></p>';
        lead = true;
        return;
      }
      if (lead) { n++; html += '<p class="gd-lead"><b>' + n + '. ' + esc(line) + '</b></p>'; }
      else html += '<p class="gd-people">' + esc(line) + '</p>';
      lead = !lead;
    });
    return '<div class="box gd" data-k="gyodok">' + html + '<p>아멘.</p></div>';
  }

  function bibleBox(headline) {
    var lines = String(headline || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) return '<div class="box" data-k="verses"><p class="hint">주보 제작 화면의 ‘본문’ 칸을 채우면 본문 말씀이 여기에 들어갑니다.</p></div>';
    return '<div class="box verses" data-k="verses">' + lines.map(function (l, i) {
      return '<p>' + (i % 2 === 0 ? '<b>' + esc(l) + '</b>' : esc(l)) + '</p>';
    }).join('') + '</div>';
  }

  function sermonHead(title, scripture, dp) {
    return '<p><b>제목 : ' + esc(title || '') + (dp ? '(' + dp.m + '/' + dp.d + ')' : '') + '</b></p>' +
      '<p>본문 : ' + esc(shortRef(scripture)) + '</p>';
  }

  // 주보 예배 순서 → 사회안 차례
  function buildBlocks(p) {
    var d = p.data || {}, dp = dateParts(p.bdate);
    var order = (d.order || []).filter(function (o) { return o && (o.name || o.detail); });
    var out = [], afterGyodok = false;
    order.forEach(function (o) {
      var name = nz(o.name), detail = String(o.detail || '').trim(), hy;
      var wasGyodok = afterGyodok;
      afterGyodok = false;
      if (/^예배로초대/.test(name)) {
        out.push(block(head(['예배로 초대', { red: '다같이 자리에서 일어나 찬양대 찬양에 맞춰 예배드립니다.' }]),
          '<div class="box center big" data-k="invite">' + INVITE.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div>', 'keep'));
      } else if (/입례송/.test(name)) {
        out.push(block(head(['(기도 후) 입례송', detail || '']),
          '<div class="box center xl" data-k="entrance"><p>입례송 부르며 예배자로 나아갑니다.</p></div>', 'keep'));
      } else if (/신앙고백/.test(name)) {
        out.push(block(head(['신앙고백', detail || '사도신경']),
          '<div class="box center creed" data-k="creed">' + CREED.map(function (g) {
            return g.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('');
          }).join('<p class="gap">&nbsp;</p>') + '</div>', 'keep'));
      } else if (/교독문|성시교독/.test(name)) {
        var gm = detail.match(/(\d{1,3})\s*번/);
        out.push(block(head(['성시교독', '교독문 ' + detail.replace(/\s+/g, ' ')]),
          gm ? gyodokBox(+gm[1]) : '<div class="box" data-k="gyodok"><p class="hint">교독문 번호(예: 51번)를 찾지 못했습니다.</p></div>'));
        afterGyodok = true;
      } else if (/봉헌/.test(name)) {
        hy = hymnOf(detail);
        out.push(block('<h3 class="sa-h red"><span class="sq">■</span>봉헌 및 기도 / 다같이 일어나셔서 ' +
          (hy ? hy.no + '장 ' : '') + '찬송하며 봉헌하고 축도로 예배를 마칩니다.</h3>',
          hy ? scoreBox(hy.no) : '<div class="box empty" data-k="score"></div>', 'keep'));
      } else if (/찬송/.test(name) && (hy = hymnOf(detail))) {
        var parts = ['찬송가 ' + hy.no + '장', hy.title];
        if (wasGyodok) parts.push({ red: '자리 앉기' });
        out.push(block(head(parts), scoreBox(hy.no), 'keep'));
      } else if (/대표기도/.test(name)) {
        out.push(block(head(['대표기도', '기도자']),
          '<div class="box center xl" data-k="prayer"><p>대표기도 / ' + esc(detail) + '</p></div>', 'keep'));
      } else if (/성경봉독|봉독/.test(name)) {
        out.push(block(head(['성경봉독', tidyBible(detail || p.scripture)]), bibleBox(d.headline)));
      } else if (/찬양대|성가대/.test(name)) {
        out.push(block(head(['찬양대 찬양']), '<div class="box" data-k="choir"><p><b>찬양대 찬양 후 할렐루야~~~</b></p></div>', 'keep'));
      } else if (/말씀선포|말씀강해|설교/.test(name)) {
        out.push(block(head(['말씀선포']),
          '<div class="box sermon" data-k="sermon" id="sa_sermon">' + sermonHead(p.title || detail, p.scripture, dp) +
          '<p class="gap">&nbsp;</p><p class="hint">위의 ‘📄 설교 원고 넣기’로 이번 주 설교 원고(hwpx)를 고르면 여기에 원고가 들어갑니다.</p></div>'));
        out.push(block(head(['말씀 후 기도'])));
      } else if (/교회소식|광고/.test(name)) {
        var notes = String(d.notices || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
        out.push(block(head(['교회소식']),
          '<div class="box" data-k="news"><p>교회소식 전합니다. 주보를 참고해 주시길 바랍니다.</p><p class="gap">&nbsp;</p>' +
          notes.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div>'));
      } else if (/축도/.test(name)) {
        out.push(block(head(['축도'])));
      } else {
        out.push(block(head([o.name || '', detail].filter(Boolean))));
      }
    });
    return out.join('');
  }

  var CSS =
    '@page{size:A4;margin:14mm 16mm 16mm;@top-right{content:"- " counter(page) " -";font:9pt "Malgun Gothic",sans-serif;color:#555}' +
    '@bottom-center{content:"- " counter(page) " -";font:9pt "Malgun Gothic",sans-serif;color:#555}}' +
    '*{box-sizing:border-box}' +
    'html,body{margin:0;background:#e9ecef}' +
    'body{font-family:"함초롬바탕","HCR Batang","Batang","Noto Serif KR",serif;font-size:11pt;line-height:1.6;color:#111}' +
    '.bar{position:sticky;top:0;z-index:5;background:#1A3A2F;color:#fff;padding:10px 16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-family:"Malgun Gothic",sans-serif;font-size:14px}' +
    '.bar .btn{background:#fff;color:#1A3A2F;border:0;border-radius:8px;padding:8px 14px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit}' +
    '.bar .btn.gold{background:#BFA06C;color:#fff}' +
    '.bar .msg{flex-basis:100%;font-size:13px;opacity:.9}' +
    '.sheet{width:210mm;min-height:297mm;margin:16px auto;background:#fff;padding:14mm 16mm 16mm;box-shadow:0 2px 12px rgba(0,0,0,.15);outline:none}' +
    '.title{text-align:center;font-family:"Malgun Gothic",sans-serif;font-weight:700;font-size:15pt;margin:0 0 10px}' +
    '.blk{margin:0 0 12px}.blk.keep{break-inside:avoid}' +
    '.sa-h{font-family:"Malgun Gothic",sans-serif;font-size:11.5pt;font-weight:700;color:#2E5597;margin:14px 0 5px;break-after:avoid}' +
    '.sa-h .sq{color:#1F3E79;margin-right:10px}.red,.sa-h.red{color:#E0201B}' +
    '.box{border:1px solid #333;padding:6px 10px;margin:0}.box p{margin:0}' +
    '.box.empty{min-height:22mm}' +
    '.center{text-align:center}.big{font-size:12pt}.xl{font-size:14pt;padding:6px 10px}' +
    '.creed{font-size:12pt;line-height:1.75}' +
    '.gap{line-height:.8}' +
    '.gd .gd-t{color:#333}.gd .gd-people{padding-left:1.6em}.gd .gd-lead{padding-left:1.6em;text-indent:-1.6em}' +
    '.verses p{padding-left:1.4em;text-indent:-1.4em}' +
    '.sermon{text-align:justify}.sermon p{white-space:pre-wrap}.sermon .q{color:#0000FF;font-weight:700}' +
    '.score{min-height:30mm;text-align:center;padding:4px}.score img{max-width:100%;max-height:228mm;display:block;margin:0 auto}' +
    '.hint{color:#8a6d3b;background:#fff8e6;font-family:"Malgun Gothic",sans-serif;font-size:10pt;padding:4px 6px;border-radius:4px}' +
    '@media print{html,body{background:#fff}.bar,.hint{display:none!important}.sheet{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}' +
    '.score.fail{min-height:22mm}}';

  // ── 설교 원고(hwpx) 읽기: 문단별로 [{t, b}] (b = 굵은 글씨)
  function parseSermonHwpx(file) {
    if (!window.JSZip) return Promise.reject(new Error('압축 해제 모듈(JSZip)이 없습니다. 주보 화면을 새로고침해 주세요.'));
    return file.arrayBuffer().then(function (buf) { return window.JSZip.loadAsync(buf); }).then(function (zip) {
      var secs = Object.keys(zip.files).filter(function (n) { return /^Contents\/section\d+\.xml$/.test(n); })
        .sort(function (a, b) { return +a.match(/\d+/)[0] - +b.match(/\d+/)[0]; });
      if (!secs.length) throw new Error('hwpx 안에서 본문을 찾지 못했습니다.');
      var hf = zip.file('Contents/header.xml');
      return Promise.all([hf ? hf.async('string') : Promise.resolve(''),
        Promise.all(secs.map(function (n) { return zip.file(n).async('string'); }))]);
    }).then(function (res) {
      var dp = new DOMParser(), bold = {};
      if (res[0]) {
        var hdoc = dp.parseFromString(res[0], 'application/xml');
        Array.prototype.forEach.call(hdoc.getElementsByTagNameNS('*', 'charPr'), function (c) {
          if (c.getElementsByTagNameNS('*', 'bold').length) bold[c.getAttribute('id')] = true;
        });
      }
      var paras = [];
      function kids(el, name) { return Array.prototype.filter.call(el.children, function (c) { return c.localName === name; }); }
      function readP(p) {
        var runs = [], later = [];
        kids(p, 'run').forEach(function (run) {
          var b = !!bold[run.getAttribute('charPrIDRef')];
          Array.prototype.forEach.call(run.children, function (c) {
            if (c.localName === 't') {
              var s = '';
              Array.prototype.forEach.call(c.childNodes, function (n) {
                if (n.nodeType === 3) s += n.nodeValue;
                else if (n.localName === 'tab') s += '    ';
                else if (n.localName === 'lineBreak') s += '\n';
              });
              if (s) runs.push({ t: s, b: b });
            } else if (c.localName === 'tbl') {
              later.push(c);
            }
          });
        });
        paras.push(runs);
        later.forEach(function (tbl) {
          Array.prototype.forEach.call(tbl.getElementsByTagNameNS('*', 'p'), function (q) { readP(q); });
        });
      }
      res[1].forEach(function (xml) {
        var doc = dp.parseFromString(xml, 'application/xml');
        kids(doc.documentElement, 'p').forEach(readP);
      });
      return paras;
    });
  }

  function runsHtml(runs) {
    return runs.map(function (r) { return r.b ? '<b>' + esc(r.t) + '</b>' : esc(r.t); }).join('');
  }
  function sermonHtml(paras, p, dropVerses) {
    var dp = dateParts(p.bdate), header = [], body = [], started = false;
    paras.forEach(function (runs) {
      var text = runs.map(function (r) { return r.t; }).join('');
      if (!started) {
        if (!text.trim()) return;
        if (/^\s*(제목|본문)\s*[:：]/.test(text)) { header.push(runs); return; }
        if (dropVerses && /^\s*\d{1,3}\s+\S/.test(text)) return;
        started = true;
      }
      body.push(runs);
    });
    while (body.length && !body[body.length - 1].map(function (r) { return r.t; }).join('').trim()) body.pop();
    var top = header.length
      ? header.map(function (runs) {
          var text = runs.map(function (r) { return r.t; }).join('');
          return /^\s*제목/.test(text) ? '<p><b>' + esc(text.trim()) + '</b></p>' : '<p>' + esc(text.trim()) + '</p>';
        }).join('')
      : sermonHead(p.title, p.scripture, dp);
    // '||'로 시작하는 인용 구절 줄은 원래 사회안처럼 파란 굵은 글씨
    return top + '<p class="gap">&nbsp;</p>' + body.map(function (runs) {
      var t = runsHtml(runs), plain = runs.map(function (r) { return r.t; }).join('');
      if (!t.replace(/\s/g, '')) return '<p class="gap">&nbsp;</p>';
      return /^\s*\|\|/.test(plain) ? '<p class="q">' + esc(plain) + '</p>' : '<p>' + t + '</p>';
    }).join('');
  }

  // ── 찬송가 악보(비공개 보관함 hymns, 서명된 주소 1시간)
  function signHymn(no, o, retried) {
    var key = ('00' + no).slice(-3) + '.webp';
    return Promise.resolve(o.getToken()).then(function (token) {
      if (!token) throw new Error('login');
      return fetch(o.sb.replace(/\/$/, '') + '/storage/v1/object/sign/hymns/' + key, {
        method: 'POST',
        headers: { apikey: o.ak, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 3600 })
      });
    }).then(function (r) {
      if (r.status === 401 && !retried && o.refresh) return o.refresh().then(function () { return signHymn(no, o, true); });
      return r.json().then(function (j) {
        if (!j || !j.signedURL) throw new Error('no url');
        return o.sb.replace(/\/$/, '') + '/storage/v1' + j.signedURL;
      });
    });
  }
  function loadScores(doc, o) {
    Array.prototype.forEach.call(doc.querySelectorAll('.score[data-hymn]'), function (box) {
      var no = +box.dataset.hymn;
      signHymn(no, o).then(function (url) {
        box.innerHTML = '<img alt="찬송가 ' + no + '장 악보" src="' + esc(url) + '">';
      }).catch(function () {
        box.classList.add('fail');
        box.innerHTML = '<p class="hint">찬송가 ' + no + '장 악보를 불러오지 못했습니다(악보 권한이 필요합니다). 인쇄하면 빈 칸으로 나옵니다.</p>';
      });
    });
  }

  // ── 한글 파일(HWPX)로 저장: 창에 보이는(고친 것까지) 내용을 그대로 옮긴다.
  //    틀(data/sahoean-template.hwpx)은 목사님 사회안 0927.hwpx 에서 내용을 빼고 글꼴·색·쪽 설정만 남긴 것.
  //    아래 번호(charPr·paraPr)는 그 틀의 Contents/header.xml 에 들어 있는 모양 번호다.
  //    paraPr 23 은 틀에 덧붙인 제목줄 모양(11과 같고 '다음 문단과 함께'만 켬 — 제목이 쪽 끝에 혼자 남지 않게).
  //    글 상자는 원본처럼 '셀 단위로 나눔'(CELL) — 긴 설교 상자도 쪽을 넘어 이어진다.
  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
  var CP = { head: 7, title: 8, red: 16, quote: 19 };
  var BOXCP = {
    invite: { pp: 10, n: 11, b: 12, v: 'CENTER' }, entrance: { pp: 10, n: 13, b: 13, v: 'CENTER' },
    creed: { pp: 10, n: 11, b: 12, v: 'CENTER' }, prayer: { pp: 10, n: 15, b: 15, v: 'CENTER' },
    choir: { pp: 0, n: 14, b: 14, v: 'CENTER' }, gyodok: { pp: 0, n: 20, b: 21, v: 'TOP' },
    verses: { pp: 0, n: 9, b: 10, v: 'TOP' }, sermon: { pp: 0, n: 9, b: 10, v: 'TOP' },
    news: { pp: 0, n: 9, b: 10, v: 'TOP' }, other: { pp: 0, n: 9, b: 10, v: 'TOP' }
  };
  function xe(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function runXml(cp, t) { return '<hp:run charPrIDRef="' + cp + '"><hp:t>' + xe(t) + '</hp:t></hp:run>'; }
  function paraXml(pp, runs, emptyCp, inner, pageBreak) {
    var body = runs.length ? runs.map(function (r) { return runXml(r.cp, r.t); }).join('') : '<hp:run charPrIDRef="' + emptyCp + '"/>';
    return '<hp:p id="' + (inner ? '2147483648' : '0') + '" paraPrIDRef="' + pp + '" styleIDRef="0" pageBreak="' +
      (pageBreak ? 1 : 0) + '" columnBreak="0" merged="0">' + body + '</hp:p>';
  }
  // 상자·제목 안의 글을 줄(문단)과 글 조각(굵게/빨강)으로 나눈다. 창에서 고친 글(div·br·b)도 따라간다.
  function linesOf(el) {
    var lines = [], cur = null;
    function flush() { if (cur) lines.push(cur); cur = null; }
    function add(t, st) {
      if (!cur) cur = { runs: [], cls: '' };
      var last = cur.runs[cur.runs.length - 1];
      if (last && last.b === st.b && last.red === st.red) last.t += t;
      else cur.runs.push({ t: t, b: st.b, red: st.red });
    }
    function walk(node, st) {
      if (node.nodeType === 3) { if (node.nodeValue) add(node.nodeValue.replace(/ /g, ' ').replace(/\n/g, ' '), st); return; }
      if (node.nodeType !== 1) return;
      var tag = node.tagName, cl = node.classList;
      if (cl.contains('hint') || tag === 'IMG' || tag === 'STYLE' || tag === 'SCRIPT') return;
      if (tag === 'BR') { if (!cur) cur = { runs: [], cls: '' }; flush(); return; }
      var ns = { b: st.b || tag === 'B' || tag === 'STRONG' || /^(bold|[6-9]00)$/.test(node.style.fontWeight || ''), red: st.red || cl.contains('red') };
      if (cl.contains('sq')) { add('■  ', st); return; }
      if (!/^(P|DIV|LI|H[1-6]|SECTION)$/.test(tag)) {
        Array.prototype.forEach.call(node.childNodes, function (c) { walk(c, ns); });
        return;
      }
      // 문단: 안에 다른 문단이 들어 있어도 빈 줄이 덧생기지 않게
      if (cur && cur.runs.length) flush(); else cur = null;
      var before = lines.length;
      cur = { runs: [], cls: node.className || '' };
      Array.prototype.forEach.call(node.childNodes, function (c) { walk(c, ns); });
      if (cur && cur.runs.length) flush();
      else if (lines.length === before) { lines.push({ runs: [], cls: node.className || '' }); cur = null; }
      else cur = null;
    }
    Array.prototype.forEach.call(el.childNodes, function (c) { walk(c, { b: false, red: false }); });
    flush();
    return lines;
  }
  function tblXml(id, z, inner, vAlign, split, height, inline) {
    var ht = height || 3176;
    return '<hp:p id="0" paraPrIDRef="11" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="7">' +
      '<hp:tbl id="' + id + '" zOrder="' + z + '" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="' + split + '" repeatHeader="1" rowCnt="1" colCnt="1" cellSpacing="0" borderFillIDRef="2" noAdjust="0">' +
      '<hp:sz width="49049" widthRelTo="ABSOLUTE" height="' + ht + '" heightRelTo="ABSOLUTE" protect="0"/>' +
      '<hp:pos treatAsChar="' + (inline ? 1 : 0) + '" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>' +
      '<hp:outMargin left="283" right="283" top="283" bottom="283"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>' +
      '<hp:tr><hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="2">' +
      '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="' + vAlign + '" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">' +
      inner + '</hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/>' +
      '<hp:cellSz width="49049" height="' + ht + '"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc></hp:tr></hp:tbl><hp:t/></hp:run></hp:p>';
  }
  function picSize(wPx, hPx) {
    var ow = wPx * 75, oh = hPx * 75;                       // 1px(96dpi) = 75 HWPUNIT
    var s = Math.min(43776 / ow, 60898 / oh);
    return { ow: ow, oh: oh, cw: Math.round(ow * s), ch: Math.round(oh * s) };
  }
  function picXml(id, z, binId, wPx, hPx) {
    var ps = picSize(wPx, hPx), ow = ps.ow, oh = ps.oh, cw = ps.cw, ch = ps.ch;
    return '<hp:p id="2147483648" paraPrIDRef="10" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="11">' +
      '<hp:pic id="' + id + '" zOrder="' + z + '" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="' + (id + 7) + '" reverse="0">' +
      '<hp:offset x="0" y="0"/><hp:orgSz width="' + ow + '" height="' + oh + '"/><hp:curSz width="' + cw + '" height="' + ch + '"/>' +
      '<hp:flip horizontal="0" vertical="0"/><hp:rotationInfo angle="0" centerX="' + Math.round(cw / 2) + '" centerY="' + Math.round(ch / 2) + '" rotateimage="1"/>' +
      '<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="' + (cw / ow).toFixed(6) + '" e2="0" e3="0" e4="0" e5="' + (ch / oh).toFixed(6) + '" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>' +
      '<hc:img binaryItemIDRef="' + binId + '" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>' +
      '<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="' + ow + '" y="0"/><hc:pt2 x="' + ow + '" y="' + oh + '"/><hc:pt3 x="0" y="' + oh + '"/></hp:imgRect>' +
      '<hp:imgClip left="0" right="' + ow + '" top="0" bottom="' + oh + '"/><hp:inMargin left="0" right="0" top="0" bottom="0"/>' +
      '<hp:imgDim dimwidth="' + ow + '" dimheight="' + oh + '"/><hp:effects/>' +
      '<hp:sz width="' + cw + '" widthRelTo="ABSOLUTE" height="' + ch + '" heightRelTo="ABSOLUTE" protect="0"/>' +
      '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>' +
      '<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:shapeComment>그림입니다.</hp:shapeComment></hp:pic><hp:t/></hp:run></hp:p>';
  }
  // 악보 그림(webp)을 한글이 읽는 JPG로
  function toJpeg(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
      .then(function (b) { return createImageBitmap(b); })
      .then(function (bmp) {
        var c = document.createElement('canvas');
        c.width = bmp.width; c.height = bmp.height;
        var g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0);
        return new Promise(function (ok) { c.toBlob(ok, 'image/jpeg', 0.92); })
          .then(function (blob) { return blob.arrayBuffer(); })
          .then(function (buf) { return { buf: buf, w: bmp.width, h: bmp.height }; });
      });
  }
  function buildHwpx(doc) {
    if (!window.JSZip) return Promise.reject(new Error('압축 모듈(JSZip)이 없습니다. 주보 화면을 새로고침해 주세요.'));
    var sheet = doc.getElementById('sa_doc');
    var blks = Array.prototype.slice.call(sheet.querySelectorAll('section.blk'));
    // 악보 그림을 먼저 받아 둔다(실패한 장은 빈 칸)
    var imgs = blks.map(function (b) {
      var im = b.querySelector('.score img');
      return im && im.src ? toJpeg(im.src).catch(function () { return null; }) : Promise.resolve(null);
    });
    var tplUrl = new URL('../data/sahoean-template.hwpx?v=20261003', SCRIPT_SRC || location.href).href;
    return Promise.all([fetch(tplUrl).then(function (r) {
      if (!r.ok) throw new Error('사회안 틀 파일을 받지 못했습니다(HTTP ' + r.status + ')');
      return r.arrayBuffer();
    }).then(function (buf) { return window.JSZip.loadAsync(buf); }), Promise.all(imgs)]).then(function (res) {
      var zip = res[0], pics = res[1];
      return Promise.all([zip.file('Contents/section0.xml').async('string'), zip.file('Contents/content.hpf').async('string')])
        .then(function (xs) {
          var sec = xs[0], hpf = xs[1];
          var titleEl = sheet.querySelector('.title');
          var title = titleEl ? titleEl.textContent.replace(/\s+/g, ' ').trim() : '주일 예배 사회안';
          var parts = [], id = 2116591000, z = 20, nImg = 0, items = '';
          blks.forEach(function (blk, i) {
            var h = blk.querySelector('h3.sa-h'), box = blk.querySelector('.box');
            var pic = pics[i];
            if (h) {
              var allRed = h.classList.contains('red');
              var hl = linesOf(h)[0] || { runs: [] };
              var runs = hl.runs.filter(function (r) { return r.t; }).map(function (r) { return { t: r.t, cp: allRed || r.red ? CP.red : CP.head }; });
              parts.push(paraXml(23, runs, CP.head, false, false));
            }
            if (!box) return;
            var k = box.getAttribute('data-k') || 'other', st = BOXCP[k] || BOXCP.other, inner = '';
            if (k === 'score') {
              if (pic) {
                nImg++;
                var bin = 'image' + nImg;
                zip.file('BinData/' + bin + '.jpg', pic.buf, { compression: 'STORE', createFolders: false });
                items += '<opf:item id="' + bin + '" href="BinData/' + bin + '.jpg" media-type="image/jpg" isEmbeded="1"/>';
                inner = picXml(id + 500 + nImg, z + 100 + nImg, bin, pic.w, pic.h);
              } else inner = paraXml(10, [], 11, true);
              // 악보 상자 높이를 그림에 맞춰 적어 둬야 한글이 다음 글을 그 아래에 놓는다(안 그러면 겹침)
              var tall = pic ? picSize(pic.w, pic.h).ch + 600 : 6000;
              // 악보 상자는 '글자처럼 취급' — 남은 자리가 모자라면 상자와 그 뒤 글이 함께 다음 쪽으로 넘어간다
              // (떠 있는 상자로 두면 상자만 넘어가고 뒤의 글이 앞쪽에 남아 서로 겹친다)
              parts.push(tblXml(++id, ++z, inner, 'CENTER', 'NONE', tall, true));
            } else {
              var lines = linesOf(box);
              while (lines.length && !lines[lines.length - 1].runs.some(function (r) { return r.t.trim(); })) lines.pop();
              inner = lines.map(function (ln) {
                var text = ln.runs.map(function (r) { return r.t; }).join('');
                if (!text.trim()) return paraXml(st.pp, [], st.n, true);
                if (k === 'sermon' && /^\s*\|\|/.test(text)) return paraXml(22, [{ t: text, cp: CP.quote }], CP.quote, true);
                var runs = ln.runs.filter(function (r) { return r.t; }).map(function (r) { return { t: r.t, cp: r.b ? st.b : st.n }; });
                if (/gd-people/.test(ln.cls) && runs.length) runs[0].t = '   ' + runs[0].t;
                return paraXml(st.pp, runs, st.n, true);
              }).join('') || paraXml(st.pp, [], st.n, true);
              parts.push(tblXml(++id, ++z, inner, st.v, 'CELL'));
            }
            parts.push(paraXml(11, [], CP.head));
          });
          sec = sec.replace('{{TITLE}}', xe(title)).replace('</hs:sec>', parts.join('') + '</hs:sec>');
          hpf = hpf.replace(/(<opf:item id="header"[^>]*\/>)/, '$1' + items);
          var noDir = { createFolders: false };
          zip.file('Contents/section0.xml', sec, noDir);
          zip.file('Contents/content.hpf', hpf, noDir);
          zip.file('Preview/PrvText.txt', title, noDir);
          zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE', createFolders: false });
          // 한글이 만든 파일처럼 mimetype·version.xml 은 압축하지 않는다
          return zip.file('version.xml').async('uint8array').then(function (v) {
            zip.file('version.xml', v, { compression: 'STORE', createFolders: false });
            // 폴더 항목만 뺀다(zip.remove 는 폴더 속 파일까지 지우므로 쓰지 않음)
            Object.keys(zip.files).forEach(function (n) { if (zip.files[n].dir) delete zip.files[n]; });
            return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/hwp+zip' });
          }).then(function (blob) { return { blob: blob, images: nImg }; });
        });
    });
  }

  // w: 클릭하자마자 연 새 창, p: 주보 제작 화면의 gather() 결과,
  // o: { sb, ak, getToken(), refresh() } — 악보 주소 받을 때 씀
  function open(w, p, o) {
    var dp = dateParts(p.bdate);
    if (!dp) throw new Error('주일 날짜가 없습니다.');
    var fileName = '노진교회 사회안 ' + dp.mmdd;
    var expectName = dp.m + '월 ' + ('0' + dp.d).slice(-2) + '일 오전예배 설교.hwpx';
    var body = buildBlocks(p);
    if (!body) throw new Error('예배 순서가 비어 있습니다. 주보의 예배 순서를 먼저 채워 주세요.');
    var html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(fileName) + '</title>' +
      '<style>' + CSS + '</style></head><body>' +
      '<div class="bar">' +
      '<label class="btn gold">📄 설교 원고 넣기<input type="file" id="sa_file" accept=".hwpx" hidden></label>' +
      '<button type="button" class="btn" id="sa_hwpx">💾 한글 파일(HWPX)로 저장</button>' +
      '<button type="button" class="btn" id="sa_print">🖨 인쇄 · PDF 저장</button>' +
      '<span id="sa_msg">설교 원고: 바탕화면 › 노진교회 › 설교 › 주일 낮 설교 › ' + esc(expectName) + '</span>' +
      '<span class="msg">글자를 눌러 바로 고칠 수 있습니다. PDF로 남기려면 인쇄 창의 대상에서 ‘PDF로 저장’을 고르세요. (이 위쪽 줄과 노란 안내는 인쇄되지 않습니다)</span>' +
      '</div>' +
      '<div class="sheet" id="sa_doc" contenteditable="true" spellcheck="false">' +
      '<p class="title">' + dp.m + '월 ' + dp.d + '일 주일 예배 사회안</p>' + body + '</div>' +
      '</body></html>';
    w.document.open();
    w.document.write(html);
    w.document.close();
    var doc = w.document;
    doc.getElementById('sa_print').onclick = function () { w.focus(); w.print(); };
    var msg = doc.getElementById('sa_msg');
    var hwpxBtn = doc.getElementById('sa_hwpx');
    hwpxBtn.onclick = function () {
      hwpxBtn.disabled = true;
      msg.textContent = '한글 파일을 만드는 중… (악보 그림을 넣느라 몇 초 걸립니다)';
      buildHwpx(doc).then(function (r) {
        var url = URL.createObjectURL(r.blob);
        var a = doc.createElement('a');
        a.href = url; a.download = fileName + '.hwpx';
        doc.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        var scores = doc.querySelectorAll('.score[data-hymn]').length;
        msg.textContent = '✓ ' + fileName + '.hwpx 를 내려받았습니다(다운로드 폴더).' +
          (r.images < scores ? ' 악보 ' + (scores - r.images) + '장은 넣지 못해 빈 칸입니다.' : '');
      }).catch(function (e) {
        msg.textContent = '한글 파일을 만들지 못했습니다: ' + ((e && e.message) || e);
      }).then(function () { hwpxBtn.disabled = false; });
    };
    doc.getElementById('sa_file').onchange = function () {
      var f = this.files && this.files[0];
      this.value = '';
      if (!f) return;
      var box = doc.getElementById('sa_sermon');
      if (!box) { msg.textContent = '예배 순서에 ‘말씀선포’ 줄이 없어 원고를 넣을 자리가 없습니다.'; return; }
      msg.textContent = '설교 원고를 읽는 중…';
      parseSermonHwpx(f).then(function (paras) {
        box.innerHTML = sermonHtml(paras, p, !!String((p.data || {}).headline || '').trim());
        msg.textContent = '✓ 설교 원고를 넣었습니다: ' + f.name;
      }).catch(function (e) {
        msg.textContent = '원고를 읽지 못했습니다: ' + ((e && e.message) || e);
      });
    };
    if (o && o.getToken) loadScores(doc, o);
    w.focus();
  }

  return { open: open, parseSermonHwpx: parseSermonHwpx, sermonHtml: sermonHtml, buildBlocks: buildBlocks, buildHwpx: buildHwpx };
})();
