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
    return '<div class="box score" data-hymn="' + no + '"><p class="hint">찬송가 ' + no + '장 악보를 불러오는 중…</p></div>';
  }

  function gyodokBox(no) {
    var g = (window.GYODOK || []).filter(function (x) { return x.no === no; })[0];
    if (!g) return '<div class="box"><p class="hint">교독문 ' + no + '번을 찾지 못했습니다.</p></div>';
    var html = '<p class="gd-t">교독문 ' + g.no + '번 · ' + esc(g.title) + '</p><p class="gap">&nbsp;</p>';
    var n = 0, lead = true;
    g.body.forEach(function (raw) {
      var line = String(raw).replace(/\s*\(\d+(?:[-~]\d+)?\)\s*$/, '').trim();
      if (/다같이/.test(line.slice(0, 8))) {
        html += '<p class="gd-all"><b>(다같이) ' + esc(line.replace(/^\(?다같이\)?\s*/, '')) + '</b></p>';
        lead = true;
        return;
      }
      if (lead) { n++; html += '<p class="gd-lead"><b>' + n + '. ' + esc(line) + '</b></p>'; }
      else html += '<p class="gd-people">' + esc(line) + '</p>';
      lead = !lead;
    });
    return '<div class="box gd">' + html + '<p>아멘.</p></div>';
  }

  function bibleBox(headline) {
    var lines = String(headline || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) return '<div class="box"><p class="hint">주보 제작 화면의 ‘본문’ 칸을 채우면 본문 말씀이 여기에 들어갑니다.</p></div>';
    return '<div class="box verses">' + lines.map(function (l, i) {
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
          '<div class="box center big">' + INVITE.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div>', 'keep'));
      } else if (/입례송/.test(name)) {
        out.push(block(head(['(기도 후) 입례송', detail || '']),
          '<div class="box center xl"><p>입례송 부르며 예배자로 나아갑니다.</p></div>', 'keep'));
      } else if (/신앙고백/.test(name)) {
        out.push(block(head(['신앙고백', detail || '사도신경']),
          '<div class="box center creed">' + CREED.map(function (g) {
            return g.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('');
          }).join('<p class="gap">&nbsp;</p>') + '</div>', 'keep'));
      } else if (/교독문|성시교독/.test(name)) {
        var gm = detail.match(/(\d{1,3})\s*번/);
        out.push(block(head(['성시교독', '교독문 ' + detail.replace(/\s+/g, ' ')]),
          gm ? gyodokBox(+gm[1]) : '<div class="box"><p class="hint">교독문 번호(예: 51번)를 찾지 못했습니다.</p></div>'));
        afterGyodok = true;
      } else if (/봉헌/.test(name)) {
        hy = hymnOf(detail);
        out.push(block('<h3 class="sa-h red"><span class="sq">■</span>봉헌 및 기도 / 다같이 일어나셔서 ' +
          (hy ? hy.no + '장 ' : '') + '찬송하며 봉헌하고 축도로 예배를 마칩니다.</h3>',
          hy ? scoreBox(hy.no) : '<div class="box empty"></div>', 'keep'));
      } else if (/찬송/.test(name) && (hy = hymnOf(detail))) {
        var parts = ['찬송가 ' + hy.no + '장', hy.title];
        if (wasGyodok) parts.push({ red: '자리 앉기' });
        out.push(block(head(parts), scoreBox(hy.no), 'keep'));
      } else if (/대표기도/.test(name)) {
        out.push(block(head(['대표기도', '기도자']),
          '<div class="box center xl"><p>대표기도 / ' + esc(detail) + '</p></div>', 'keep'));
      } else if (/성경봉독|봉독/.test(name)) {
        out.push(block(head(['성경봉독', tidyBible(detail || p.scripture)]), bibleBox(d.headline)));
      } else if (/찬양대|성가대/.test(name)) {
        out.push(block(head(['찬양대 찬양']), '<div class="box"><p><b>찬양대 찬양 후 할렐루야~~~</b></p></div>', 'keep'));
      } else if (/말씀선포|말씀강해|설교/.test(name)) {
        out.push(block(head(['말씀선포']),
          '<div class="box sermon" id="sa_sermon">' + sermonHead(p.title || detail, p.scripture, dp) +
          '<p class="gap">&nbsp;</p><p class="hint">위의 ‘📄 설교 원고 넣기’로 이번 주 설교 원고(hwpx)를 고르면 여기에 원고가 들어갑니다.</p></div>'));
        out.push(block(head(['말씀 후 기도'])));
      } else if (/교회소식|광고/.test(name)) {
        var notes = String(d.notices || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
        out.push(block(head(['교회소식']),
          '<div class="box"><p>교회소식 전합니다. 주보를 참고해 주시길 바랍니다.</p><p class="gap">&nbsp;</p>' +
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
    '.sermon{text-align:justify}.sermon p{white-space:pre-wrap}' +
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
    return top + '<p class="gap">&nbsp;</p>' + body.map(function (runs) {
      var t = runsHtml(runs);
      return t.replace(/\s/g, '') ? '<p>' + t + '</p>' : '<p class="gap">&nbsp;</p>';
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

  return { open: open, parseSermonHwpx: parseSermonHwpx, sermonHtml: sermonHtml, buildBlocks: buildBlocks };
})();
