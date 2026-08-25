/* district.js — 교구사역(구역장 사역보고 · 말씀 나눔지)
 * 콘솔: [district.js] v20260822
 *
 * 권한은 화면이 아니라 DB(RLS)가 막는다. 여기서 탭을 숨기는 것은
 * 편의를 위한 것일 뿐, 주소를 직접 쳐서 들어와도 자료는 나오지 않는다.
 */
console.log('[district.js] v20260822');

(function () {
  var root = document.getElementById('dtRoot');
  if (!root) return;

  var DISTRICTS = ['1구역', '2구역', '3구역', '4구역', '5구역'];
  var SB = String(window.SUPABASE_URL || '').replace(/\/$/, '');
  var AK = window.SUPABASE_ANON_KEY || '';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function msgCard(t, x) {
    return '<div class="fin-card" style="text-align:center;padding:40px 18px"><h3 style="margin:0 0 8px;color:var(--accent,#223350)">' +
      esc(t) + '</h3><p style="color:var(--ink-soft,#7b8794);line-height:1.7">' + esc(x) + '</p></div>';
  }
  function won(n) { return Number(n || 0).toLocaleString('ko-KR'); }
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ym(d) { return String(d || '').slice(0, 7); }

  // ── 로그인 세션 ──────────────────────────────────────────
  function ref() { try { return new URL(SB).hostname.split('.')[0]; } catch (e) { return ''; } }
  function session() {
    var key = 'sb-' + ref() + '-auth-token';
    var raw = null;
    try { raw = localStorage.getItem(key) || sessionStorage.getItem(key); } catch (e) { }
    if (!raw) return null;
    try {
      var o = JSON.parse(raw), s = (o && o.currentSession) ? o.currentSession : o;
      return (s && s.access_token) ? s : null;
    } catch (e) { return null; }
  }
  function uidOf(s) {
    if (s && s.user && s.user.id) return s.user.id;
    try { return JSON.parse(atob(String(s.access_token).split('.')[1])).sub || ''; } catch (e) { return ''; }
  }

  // ── 토큰 갱신 ────────────────────────────────────────────
  // access_token 은 한 시간이면 만료된다. 만료된 채로 부르면 'JWT expired' 가
  // 돌아오므로, refresh_token 으로 한 번 갱신한 뒤 다시 부른다.
  var _refreshing = null;
  function refreshToken() {
    if (_refreshing) return _refreshing;
    _refreshing = (function () {
      var key = 'sb-' + ref() + '-auth-token';
      var store = null, raw = null;
      try {
        raw = localStorage.getItem(key);
        if (raw) store = localStorage;
        else { raw = sessionStorage.getItem(key); if (raw) store = sessionStorage; }
      } catch (e) { }
      if (!raw) return Promise.reject(new Error('no session'));
      var stored, cur, rt;
      try {
        stored = JSON.parse(raw);
        cur = stored.currentSession || stored;
        rt = cur && cur.refresh_token;
      } catch (e) { return Promise.reject(new Error('bad session')); }
      if (!rt) return Promise.reject(new Error('no refresh token'));
      return fetch(SB + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: { apikey: AK, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.access_token) throw new Error('refresh failed');
        cur.access_token = d.access_token;
        cur.refresh_token = d.refresh_token || rt;
        if (d.expires_at) cur.expires_at = d.expires_at;
        if (d.expires_in) cur.expires_in = d.expires_in;
        if (d.user) cur.user = d.user;
        store.setItem(key, JSON.stringify(stored));
        return d.access_token;
      });
    })();
    _refreshing.then(function () { _refreshing = null; }, function () { _refreshing = null; });
    return _refreshing;
  }

  // ── Supabase 호출 ────────────────────────────────────────
  function api(method, path, body, prefer, _retried) {
    var s = session();
    var h = { apikey: AK, 'Content-Type': 'application/json' };
    if (s) h.Authorization = 'Bearer ' + s.access_token;
    if (prefer) h.Prefer = prefer;
    return fetch(SB + '/rest/v1/' + path, {
      method: method, headers: h, body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (r.status === 204) return null;
      return r.text().then(function (t) {
        if (!r.ok) {
          if (!_retried && (r.status === 401 || /JWT expired|PGRST303|invalid (JWT|token)/i.test(t || ''))) {
            return refreshToken().then(
              function () { return api(method, path, body, prefer, true); },
              function () { throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.'); }
            );
          }
          var j = null; try { j = JSON.parse(t); } catch (e) { }
          throw new Error((j && (j.message || j.error)) || t || ('오류 ' + r.status));
        }
        return t ? JSON.parse(t) : null;
      });
    });
  }

  // ── 시작 ────────────────────────────────────────────────
  var perms = { district: false, all: false }, tries = 0, tab = 'write';

  function boot() {
    if (!(SB && AK)) { root.innerHTML = msgCard('준비 중', '이 기능을 쓰려면 Supabase 연결이 필요합니다.'); return; }
    var s = session();
    if (!s) {
      if (tries++ < 20) { setTimeout(boot, 400); return; }
      root.innerHTML = msgCard('로그인이 필요합니다', '교구사역은 구역장·인도자·교구장만 이용할 수 있습니다. 로그인 후 다시 열어 주세요.');
      return;
    }
    // 권한은 DB 의 판정 함수에게 직접 묻는다.
    // admins·member_links 표는 RLS 로 막혀 있어 본인 것도 읽히지 않는다.
    Promise.all([
      api('POST', 'rpc/can_district', {}),
      api('POST', 'rpc/can_district_all', {})
    ]).then(function (r) {
      perms.district = r[0] === true;
      perms.all = r[1] === true;
      if (!perms.district) {
        root.innerHTML = msgCard('권한이 없습니다', '교구사역은 구역장·인도자·교구장에게 열려 있습니다. 필요하시면 교회 사무실로 말씀해 주세요.');
        return;
      }
      render();
    }).catch(function (e) {
      var m = (e && e.message) || '';
      if (/만료|JWT expired|401/i.test(m)) {
        root.innerHTML = msgCard('로그인이 만료되었습니다',
          '오른쪽 위에서 로그아웃한 뒤 다시 로그인해 주세요. 로그인 상태는 한동안 쓰지 않으면 자동으로 풀립니다.');
        return;
      }
      root.innerHTML = msgCard('불러오지 못했습니다', m || '잠시 후 다시 시도해 주세요.');
    });
  }

  function render() {
    var tabs = [['write', '사역보고 작성'], ['list', perms.all ? '보고 모아보기' : '내 보고'], ['stat', '월별 통계'], ['sheet', '말씀 나눔지']];
    root.innerHTML = '<div class="fin-tabs">' + tabs.map(function (t) {
      return '<button data-t="' + t[0] + '"' + (tab === t[0] ? ' class="active"' : '') + '>' + esc(t[1]) + '</button>';
    }).join('') + '</div><div id="dtPanel"></div>';
    Array.prototype.forEach.call(root.querySelectorAll('.fin-tabs button'), function (b) {
      b.onclick = function () { tab = b.dataset.t; render(); };
    });
    var p = document.getElementById('dtPanel');
    if (tab === 'list') renderList(p);
    else if (tab === 'stat') renderStat(p);
    else if (tab === 'sheet') renderSheet(p);
    else renderWrite(p);
  }

  /* ══════════════ 사역보고 작성 ══════════════ */
  function renderWrite(p, edit) {
    var r = edit || {};
    function opt(v) { return '<option' + (r.district === v ? ' selected' : '') + '>' + v + '</option>'; }
    p.innerHTML =
      '<div class="fin-card">' +
      '<div class="dr-sec">언제 · 누가</div>' +
      '<div class="dr-grid">' +
      '<div class="dr-f"><label>모임일자</label><input type="date" id="f_date" value="' + esc(r.met_on || todayISO()) + '"></div>' +
      '<div class="dr-f"><label>구역</label><select id="f_dist"><option value="">선택</option>' + DISTRICTS.map(opt).join('') + '</select></div>' +
      '<div class="dr-f"><label>보고자</label><input type="text" id="f_rep" value="' + esc(r.reporter || '') + '" placeholder="이름"></div>' +
      '<div class="dr-f"><label>예배장소</label><input type="text" id="f_place" value="' + esc(r.place || '') + '" placeholder="예: 김○○ 집사 댁"></div>' +
      '</div>' +

      '<div class="dr-sec">모임</div>' +
      '<div class="dr-grid">' +
      '<div class="dr-f dr-full"><label>참석자</label><textarea id="f_att" placeholder="한 줄에 한 분씩 적어 주세요">' + esc(r.attendees || '') + '</textarea>' +
      '<p class="dr-hint">줄 수를 세어 출석인원이 자동으로 채워집니다.</p></div>' +
      '<div class="dr-f"><label>출석인원</label><input type="number" id="f_cnt" min="0" value="' + esc(r.attend_count || 0) + '"></div>' +
      '<div class="dr-f"><label>헌금 (원)</label><input type="number" id="f_off" min="0" step="1000" value="' + esc(r.offering || 0) + '"></div>' +
      '<div class="dr-f"><label>다음 모임장소</label><input type="text" id="f_next" value="' + esc(r.next_place || '') + '"></div>' +
      '</div>' +

      '<div class="dr-sec">나눔</div>' +
      '<div class="dr-grid">' +
      '<div class="dr-f dr-full"><label>구역원 기도제목</label><textarea id="f_pray">' + esc(r.prayer || '') + '</textarea></div>' +
      '<div class="dr-f dr-full"><label>구역장 건의사항</label><textarea id="f_sug">' + esc(r.suggestion || '') + '</textarea></div>' +
      '</div>' +

      '<div class="dr-actions">' +
      '<button class="btn" id="f_save">' + (edit ? '수정 저장' : '보고 올리기') + '</button>' +
      (edit ? '<button class="btn btn-line" id="f_cancel">취소</button>' : '') +
      '<span class="dr-msg" id="f_msg"></span></div>' +
      '</div>';

    var att = p.querySelector('#f_att'), cnt = p.querySelector('#f_cnt'), touched = !!edit;
    cnt.addEventListener('input', function () { touched = true; });
    att.addEventListener('input', function () {
      if (touched) return;                        // 사람이 직접 고친 값은 덮어쓰지 않는다
      var n = att.value.split('\n').filter(function (x) { return x.trim(); }).length;
      cnt.value = n;
    });

    if (edit) p.querySelector('#f_cancel').onclick = function () { tab = 'list'; render(); };

    p.querySelector('#f_save').onclick = function () {
      var msg = p.querySelector('#f_msg');
      var body = {
        met_on: p.querySelector('#f_date').value,
        district: p.querySelector('#f_dist').value,
        reporter: p.querySelector('#f_rep').value.trim(),
        place: p.querySelector('#f_place').value.trim(),
        attendees: att.value.trim(),
        attend_count: Number(cnt.value || 0),
        offering: Number(p.querySelector('#f_off').value || 0),
        next_place: p.querySelector('#f_next').value.trim(),
        prayer: p.querySelector('#f_pray').value.trim(),
        suggestion: p.querySelector('#f_sug').value.trim()
      };
      if (!body.met_on) { msg.style.color = '#c0392b'; msg.textContent = '모임일자를 넣어 주세요.'; return; }
      if (!body.district) { msg.style.color = '#c0392b'; msg.textContent = '구역을 골라 주세요.'; return; }

      this.disabled = true;
      msg.style.color = '#7b8794'; msg.textContent = '저장하는 중…';
      var q = edit
        ? api('PATCH', 'district_reports?id=eq.' + edit.id, body, 'return=minimal')
        : api('POST', 'district_reports', [body], 'return=minimal');
      var btn = this;
      q.then(function () {
        msg.style.color = '#1e874b'; msg.textContent = '✓ 저장되었습니다';
        setTimeout(function () { tab = 'list'; render(); }, 700);
      }).catch(function (e) {
        btn.disabled = false;
        msg.style.color = '#c0392b';
        msg.textContent = '저장하지 못했습니다: ' + ((e && e.message) || '오류');
      });
    };
  }

  /* ══════════════ 보고 목록 ══════════════ */
  function renderList(p) {
    p.innerHTML = '<p class="qt-loading">불러오는 중…</p>';
    api('GET', 'district_reports?select=*&order=met_on.desc,id.desc&limit=200').then(function (rows) {
      rows = rows || [];
      if (!rows.length) { p.innerHTML = msgCard('아직 보고가 없습니다', '‘사역보고 작성’에서 첫 보고를 올려 보세요.'); return; }
      p.innerHTML = '<div class="fin-card"><table class="fin-table"><thead><tr>' +
        '<th>모임일자</th><th>구역</th><th>보고자</th><th>예배장소</th>' +
        '<th class="num">출석</th><th class="num">헌금</th><th></th>' +
        '</tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td>' + esc(r.met_on) + '</td><td>' + esc(r.district) + '</td>' +
            '<td>' + esc(r.reporter || '-') + '</td><td>' + esc(r.place || '-') + '</td>' +
            '<td class="num">' + Number(r.attend_count || 0) + '</td>' +
            '<td class="num">' + won(r.offering) + '</td>' +
            '<td><button class="btn btn-line" style="padding:4px 10px;font-size:.8rem" data-id="' + r.id + '">보기</button></td></tr>';
        }).join('') + '</tbody></table></div><div id="dtDetail"></div>';

      Array.prototype.forEach.call(p.querySelectorAll('button[data-id]'), function (b) {
        b.onclick = function () {
          var r = rows.filter(function (x) { return String(x.id) === b.dataset.id; })[0];
          showDetail(document.getElementById('dtDetail'), r);
        };
      });
    }).catch(function (e) {
      p.innerHTML = msgCard('불러오지 못했습니다', (e && e.message) || '잠시 후 다시 시도해 주세요.');
    });
  }

  function showDetail(box, r) {
    function blk(t, v) {
      return '<div style="margin-top:14px"><div class="dr-sec" style="margin:0 0 5px">' + esc(t) + '</div>' +
        '<div style="white-space:pre-wrap;line-height:1.8">' + (esc(v || '').trim() || '<span style="color:#9aa5b1">기록 없음</span>') + '</div></div>';
    }
    box.innerHTML = '<div class="fin-card">' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<span class="dr-pill">' + esc(r.district) + '</span>' +
      '<b style="font-size:1.05rem;color:var(--accent,#223350)">' + esc(r.met_on) + '</b>' +
      '<span style="color:#7b8794">보고자 ' + esc(r.reporter || '-') + '</span>' +
      '<button class="btn btn-line" id="d_edit" style="margin-left:auto;padding:5px 12px;font-size:.82rem">고치기</button>' +
      '</div>' +
      '<table class="fin-table" style="margin-top:14px"><tbody>' +
      '<tr><th style="width:130px">예배장소</th><td>' + esc(r.place || '-') + '</td></tr>' +
      '<tr><th>출석인원</th><td>' + Number(r.attend_count || 0) + '명</td></tr>' +
      '<tr><th>헌금</th><td>' + won(r.offering) + '원</td></tr>' +
      '<tr><th>다음 모임장소</th><td>' + esc(r.next_place || '-') + '</td></tr>' +
      '</tbody></table>' +
      blk('참석자', r.attendees) + blk('구역원 기도제목', r.prayer) + blk('구역장 건의사항', r.suggestion) +
      '</div>';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    box.querySelector('#d_edit').onclick = function () {
      tab = 'write'; render();
      renderWrite(document.getElementById('dtPanel'), r);
    };
  }

  /* ══════════════ 월별 통계 ══════════════ */
  function renderStat(p) {
    p.innerHTML = '<p class="qt-loading">불러오는 중…</p>';
    api('GET', 'district_reports?select=met_on,district,attend_count,offering&order=met_on.desc&limit=1000').then(function (rows) {
      rows = rows || [];
      if (!rows.length) { p.innerHTML = msgCard('통계를 낼 자료가 없습니다', '보고가 쌓이면 월별로 정리해 보여드립니다.'); return; }

      var months = [];
      rows.forEach(function (r) { var m = ym(r.met_on); if (months.indexOf(m) < 0) months.push(m); });
      months.sort().reverse();
      var cur = months[0];

      function draw() {
        var inMonth = rows.filter(function (r) { return ym(r.met_on) === cur; });
        var by = {};
        inMonth.forEach(function (r) {
          var k = r.district || '(미지정)';
          if (!by[k]) by[k] = { n: 0, att: 0, off: 0 };
          by[k].n++; by[k].att += Number(r.attend_count || 0); by[k].off += Number(r.offering || 0);
        });
        var keys = perms.all ? DISTRICTS.slice() : Object.keys(by).sort();
        Object.keys(by).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });

        var tn = 0, ta = 0, to = 0;
        var body = keys.map(function (k) {
          var v = by[k];
          if (!v) {
            return '<tr><td>' + esc(k) + '</td><td colspan="4" style="color:#c0392b">이번 달 보고 없음</td></tr>';
          }
          tn += v.n; ta += v.att; to += v.off;
          return '<tr><td>' + esc(k) + '</td>' +
            '<td class="num">' + v.n + '회</td>' +
            '<td class="num">' + (v.att / v.n).toFixed(1) + '명</td>' +
            '<td class="num">' + v.att + '명</td>' +
            '<td class="num">' + won(v.off) + '원</td></tr>';
        }).join('');

        var missing = keys.filter(function (k) { return !by[k]; });

        p.innerHTML = '<div class="fin-card">' +
          '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">' +
          '<label style="font-size:.85rem;color:#7b8794">기준 월</label>' +
          '<select id="s_m" style="padding:7px 10px;border:1px solid #dfe5ee;border-radius:8px;font:inherit">' +
          months.map(function (m) { return '<option' + (m === cur ? ' selected' : '') + '>' + m + '</option>'; }).join('') +
          '</select>' +
          (missing.length ? '<span class="dr-pill dr-none">보고 없는 구역 ' + missing.length + '곳</span>' : '<span class="dr-pill">모든 구역 보고 완료</span>') +
          '</div>' +
          '<table class="fin-table"><thead><tr><th>구역</th><th class="num">모임</th><th class="num">평균 출석</th><th class="num">연인원</th><th class="num">헌금</th></tr></thead>' +
          '<tbody>' + body + '</tbody>' +
          '<tfoot><tr><td>합계</td><td class="num">' + tn + '회</td><td class="num">' + (tn ? (ta / tn).toFixed(1) : 0) + '명</td>' +
          '<td class="num">' + ta + '명</td><td class="num">' + won(to) + '원</td></tr></tfoot></table>' +
          '</div>' + trendCard(rows);

        p.querySelector('#s_m').onchange = function () { cur = this.value; draw(); };
      }
      draw();
    }).catch(function (e) {
      p.innerHTML = msgCard('불러오지 못했습니다', (e && e.message) || '잠시 후 다시 시도해 주세요.');
    });
  }

  function trendCard(rows) {
    var by = {};
    rows.forEach(function (r) {
      var m = ym(r.met_on);
      if (!by[m]) by[m] = { n: 0, att: 0, off: 0 };
      by[m].n++; by[m].att += Number(r.attend_count || 0); by[m].off += Number(r.offering || 0);
    });
    var ms = Object.keys(by).sort().reverse().slice(0, 6);
    return '<div class="fin-card"><div class="dr-sec" style="margin-top:0">최근 여섯 달</div>' +
      '<table class="fin-table"><thead><tr><th>월</th><th class="num">모임</th><th class="num">평균 출석</th><th class="num">헌금</th></tr></thead><tbody>' +
      ms.map(function (m) {
        var v = by[m];
        return '<tr><td>' + m + '</td><td class="num">' + v.n + '회</td>' +
          '<td class="num">' + (v.att / v.n).toFixed(1) + '명</td>' +
          '<td class="num">' + won(v.off) + '원</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ══════════════ 말씀 나눔지 ══════════════ */
  function renderSheet(p) {
    p.innerHTML = '<p class="qt-loading">불러오는 중…</p>';
    api('GET', 'district_sheets?select=*&order=sheet_date.desc,id.desc&limit=100').then(function (rows) {
      rows = rows || [];
      var up = perms.all ? uploadCard() : '';
      if (!rows.length) { p.innerHTML = up + msgCard('아직 올라온 나눔지가 없습니다', perms.all ? '위에서 첫 나눔지를 올려 주세요.' : '나눔지가 올라오면 여기에서 받으실 수 있습니다.'); bindUpload(p); return; }
      p.innerHTML = up + '<div class="fin-card"><ul class="ds-list">' +
        rows.map(function (r) {
          return '<li><div><div class="ds-t">' + esc(r.title) + '</div>' +
            '<div class="ds-d">' + esc(r.sheet_date) + (r.size ? ' · ' + Math.round(r.size / 1024) + 'KB' : '') + '</div></div>' +
            '<button class="btn ds-dl" data-p="' + esc(r.path) + '" style="padding:6px 14px;font-size:.85rem">내려받기</button>' +
            (perms.all ? '<button class="btn btn-line" data-del="' + r.id + '" data-dp="' + esc(r.path) + '" style="padding:6px 10px;font-size:.8rem">삭제</button>' : '') +
            '</li>';
        }).join('') + '</ul></div>';
      bindUpload(p);
      Array.prototype.forEach.call(p.querySelectorAll('button[data-p]'), function (b) {
        b.onclick = function () { download(b.dataset.p, b); };
      });
      Array.prototype.forEach.call(p.querySelectorAll('button[data-del]'), function (b) {
        b.onclick = function () {
          if (!window.confirm('이 나눔지를 지울까요?')) return;
          api('DELETE', 'district_sheets?id=eq.' + b.dataset.del, null, 'return=minimal')
            .then(function () { return storageDelete(b.dataset.dp); })
            .then(function () { renderSheet(p); })
            .catch(function (e) { window.alert('지우지 못했습니다: ' + ((e && e.message) || '오류')); });
        };
      });
    }).catch(function (e) {
      p.innerHTML = msgCard('불러오지 못했습니다', (e && e.message) || '잠시 후 다시 시도해 주세요.');
    });
  }

  function uploadCard() {
    return '<div class="fin-card">' +
      '<div class="dr-sec" style="margin-top:0">나눔지 올리기 <span style="font-weight:400;color:#9aa5b1">(교구장·관리자)</span></div>' +
      '<div class="dr-grid">' +
      '<div class="dr-f"><label>제목</label><input type="text" id="u_title" placeholder="예: 8월 4주 말씀 나눔지"></div>' +
      '<div class="dr-f"><label>날짜</label><input type="date" id="u_date" value="' + todayISO() + '"></div>' +
      '<div class="dr-f"><label>파일</label><input type="file" id="u_file"></div>' +
      '</div>' +
      '<div class="dr-actions"><button class="btn" id="u_go">올리기</button><span class="dr-msg" id="u_msg"></span></div></div>';
  }

  function bindUpload(p) {
    var go = p.querySelector('#u_go');
    if (!go) return;
    go.onclick = function () {
      var msg = p.querySelector('#u_msg');
      var f = p.querySelector('#u_file').files[0];
      var title = p.querySelector('#u_title').value.trim();
      var date = p.querySelector('#u_date').value;
      if (!f) { msg.style.color = '#c0392b'; msg.textContent = '파일을 골라 주세요.'; return; }
      if (!title) title = f.name.replace(/\.[^.]+$/, '');
      var path = date + '/' + Date.now() + '_' + f.name;
      go.disabled = true; msg.style.color = '#7b8794'; msg.textContent = '올리는 중…';

      var s = session();
      fetch(SB + '/storage/v1/object/district_sheets/' + encPath(path), {
        method: 'POST',
        headers: { apikey: AK, Authorization: 'Bearer ' + s.access_token, 'x-upsert': 'true' },
        body: f
      }).then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error(t.slice(0, 120)); });
        return api('POST', 'district_sheets', [{ title: title, sheet_date: date, path: path, size: f.size }], 'return=minimal');
      }).then(function () {
        msg.style.color = '#1e874b'; msg.textContent = '✓ 올렸습니다';
        setTimeout(function () { renderSheet(p); }, 600);
      }).catch(function (e) {
        go.disabled = false; msg.style.color = '#c0392b';
        msg.textContent = '올리지 못했습니다: ' + ((e && e.message) || '오류');
      });
    };
  }

  function encPath(p) { return String(p).split('/').map(encodeURIComponent).join('/'); }

  function download(path, btn) {
    var s = session(), old = btn.textContent;
    btn.disabled = true; btn.textContent = '준비 중…';
    fetch(SB + '/storage/v1/object/sign/district_sheets/' + encPath(path), {
      method: 'POST',
      headers: { apikey: AK, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 300 })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.signedURL) throw new Error('주소를 받지 못했습니다');
      var a = document.createElement('a');
      a.href = SB + '/storage/v1' + j.signedURL + '&download';
      a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      btn.disabled = false; btn.textContent = old;
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = old;
      window.alert('내려받지 못했습니다: ' + ((e && e.message) || '오류'));
    });
  }

  function storageDelete(path) {
    var s = session();
    return fetch(SB + '/storage/v1/object/district_sheets/' + encPath(path), {
      method: 'DELETE', headers: { apikey: AK, Authorization: 'Bearer ' + s.access_token }
    });
  }

  boot();
})();
