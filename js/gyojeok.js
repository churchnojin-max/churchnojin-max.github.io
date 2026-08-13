/* gyojeok.js — 교적관리(관리자 전용): 권한관리 + 교적명단
 * 콘솔: [gyojeok.js] v20260701di
 */
console.log('[gyojeok.js] v20260701di');

(function () {
  var root = document.getElementById('gjRoot');
  if (!root) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  // 생년월일: 매칭키(이름|YYYYMMDD)에서 정확히 추출, 없으면 ISO 앞 10자
  function birthOf(m) { var bd = (String(m['매칭키'] || '').split('|')[1]) || ''; if (bd.length === 8) return bd.slice(0, 4) + '-' + bd.slice(4, 6) + '-' + bd.slice(6, 8); return String(m['생년월일'] || '').slice(0, 10); }
  // 화면 표시 전용(수정 입력칸에는 안 씀 — ISO 형식이어야 저장이 됨): "YYYY년M월D일(음/양)"
  function birthDisplay(m) { var iso = birthOf(m); var mm = iso.match(/^(\d{4})-(\d{2})-(\d{2})/); if (!mm) return ''; return mm[1] + '년' + Number(mm[2]) + '월' + Number(mm[3]) + '일(' + (m['음력생일'] ? '음' : '양') + ')'; }
  // 휴대폰: 앞 0 복원 + 010-XXXX-XXXX 형식
  function fmtPhone(p) { p = String(p == null ? '' : p).replace(/[^0-9]/g, ''); if (!p) return ''; if (p.length === 10 && p.charAt(0) !== '0') p = '0' + p; if (p.length === 11) return p.slice(0, 3) + '-' + p.slice(3, 7) + '-' + p.slice(7); if (p.length === 10) return p.slice(0, 3) + '-' + p.slice(3, 6) + '-' + p.slice(6); return p; }
  function msgCard(t, x) { return '<div class="fin-card" style="text-align:center;padding:40px 18px;"><h3 style="margin:0 0 8px;color:var(--accent,#223350);">' + esc(t) + '</h3><p style="color:var(--ink-soft,#7b8794);">' + esc(x) + '</p></div>'; }
  function loading(el) { el.innerHTML = '<p class="qt-loading">불러오는 중…</p>'; }
  function stPill(st) { return '<span class="fin-pill ' + (st === '정회원' ? 'in' : 'out') + '">' + (st === '정회원' ? '정회원' : '준회원') + '</span>'; }

  var tries = 0, tab = 'access';
  function boot() {
    if (!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY)) { root.innerHTML = msgCard('준비 중', '교적 기능을 사용하려면 Supabase 연결이 필요합니다.'); return; }
    if (!(window.WPF && WPF.token())) {
      if (tries++ < 20) { setTimeout(boot, 400); return; }
      root.innerHTML = msgCard('로그인이 필요합니다', '아래 버튼을 눌러 로그인해 주세요.');
      var lb = document.createElement('button');
      lb.type = 'button'; lb.className = 'btn btn-line'; lb.style.marginTop = '12px'; lb.textContent = '로그인';
      lb.onclick = function () { var m = document.getElementById('authModal'); if (m) { m.hidden = false; document.body.style.overflow = 'hidden'; } };
      root.querySelector('.fin-card').appendChild(lb);
      return;
    }
    render();
  }
  function render() {
    root.innerHTML = '<div class="fin-tabs"><button data-t="access">권한 관리</button><button data-t="members">교적 명단</button><button data-t="newfamily">새가족 등록</button><button data-t="family">가계도</button><button data-t="import">엑셀 가져오기</button></div><div id="gjPanel"></div>';
    Array.prototype.forEach.call(root.querySelectorAll('.fin-tabs button'), function (b) {
      if (b.dataset.t === tab) b.classList.add('active');
      b.onclick = function () { tab = b.dataset.t; render(); };
    });
    var p = document.getElementById('gjPanel');
    if (tab === 'access') renderAccess(p);
    else if (tab === 'family') renderFamily(p);
    else if (tab === 'newfamily') renderNewFamily(p);
    else if (tab === 'import') renderImport(p);
    else renderMembers(p);
  }

  /* ── 새가족 등록: 등록카드 한 장을 그대로 입력 → 세대주+가족까지 한 번에 생성 ── */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function calSel(attr, isLunar) { return '<select ' + attr + ' style="width:70px"><option value="0"' + (isLunar ? '' : ' selected') + '>양력</option><option value="1"' + (isLunar ? ' selected' : '') + '>음력</option></select>'; }
  var VISITED_OPTS = ['미실시', '완료'];

  function renderNewFamily(panel) {
    var FAM_REL = ['배우자', '부', '모', '장남', '차남', '삼남', '아들', '장녀', '차녀', '삼녀', '딸', '자녀', '형제', '자매', '기타'];
    var rowSeq = 0;
    function famRowHtml(id) {
      return '<div class="nf-famrow" data-row="' + id + '" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:8px">' +
        '<div class="af-field" style="flex:1;min-width:110px"><label>이름</label><input type="text" class="nf-f-name"></div>' +
        '<div class="af-field" style="flex:1;min-width:140px"><label>생년월일(선택)</label><input type="text" class="nf-f-birth" inputmode="numeric" placeholder="8자리, 예: 20100321"></div>' +
        '<div class="af-field" style="flex:0;min-width:76px"><label>양/음</label>' + calSel('class="nf-f-cal"', false) + '</div>' +
        '<div class="af-field" style="flex:1;min-width:100px"><label>관계</label><select class="nf-f-rel">' + FAM_REL.map(function (r) { return '<option' + (r === '배우자' ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></div>' +
        '<button type="button" class="btn btn-line nf-f-remove" style="padding:8px 12px">삭제</button>' +
        '</div>';
    }

    // '등록일'이 실제로 찍힌 사람만 새가족(이 화면으로 등록된 사람)으로 취급 — 기존 성도/목회자는 등록일이 없어 제외됨
    function isNewFamily(m) { return !!m['등록일']; }
    function regMonthOf(m) {
      var d = m['등록일'] || '';
      return d ? d.slice(0, 7) : '';
    }
    function statsChart(all) {
      var now = new Date();
      var months = [];
      for (var i = 5; i >= 0; i--) { var d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(d.getFullYear() + '-' + pad2(d.getMonth() + 1)); }
      var counts = {}; months.forEach(function (m) { counts[m] = 0; });
      all.forEach(function (m) { var ym = regMonthOf(m); if (counts[ym] != null) counts[ym]++; });
      var maxV = Math.max.apply(null, months.map(function (m) { return counts[m]; }).concat([1]));
      var n = months.length, W = 280, H = 140, PT = 16, PB = 24, PL = 8, PR = 8;
      var ph = H - PT - PB, pw = W - PL - PR, baseY = PT + ph, bw = Math.min(30, pw / n - 10);
      var bars = '', labels = '';
      months.forEach(function (m, i) {
        var cx = PL + (i + 0.5) * (pw / n), v = counts[m], h = maxV ? (v / maxV) * ph : 0;
        bars += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + (baseY - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="4" fill="#223350" opacity="' + (v ? '0.85' : '0.15') + '"></rect>';
        bars += '<text x="' + cx.toFixed(1) + '" y="' + (baseY - h - 6).toFixed(1) + '" text-anchor="middle" font-size="11" fill="#223350" font-weight="700">' + (v || '') + '</text>';
        labels += '<text x="' + cx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="#8a8a8e">' + Number(m.slice(5)) + '월</text>';
      });
      return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="xMidYMid meet" style="max-width:320px;display:block;margin:0 auto">' + bars + labels + '</svg>';
    }
    // 새가족(등록일이 찍힌 사람)만 대상으로 이름 검색. 검색어가 없으면 최근 8명만, 검색 중에는 개수 제한 없이 전부 보여줘
    // 정보가 미흡해도(생년월일·연락처 등이 비어 있어도) 이름만으로 항상 찾을 수 있게 함
    function recentListHtml(all, q) {
      q = (q || '').trim();
      var newFam = all.filter(isNewFamily);
      var rows = q ? newFam.filter(function (m) { return String(m['이름'] || '').indexOf(q) >= 0; }) : newFam;
      var sorted = rows.slice().sort(function (a, b) { return String(b['등록일']).localeCompare(String(a['등록일'])); });
      var top = q ? sorted : sorted.slice(0, 8);
      if (!top.length) return '<p style="color:#9aa5b1;font-size:.85rem">' + (q ? '검색 결과가 없습니다.' : '아직 등록된 새가족이 없습니다.') + '</p>';
      return top.map(function (m) {
        return '<div class="nf-recent-row" data-key="' + esc(m['매칭키']) + '" style="display:flex;justify-content:space-between;gap:8px;padding:7px 4px;border-bottom:1px solid #f0f3f7;cursor:pointer">' +
          '<span style="font-weight:600;color:var(--accent,#223350)">' + esc(m['이름']) + '</span><span style="color:#9aa5b1;font-size:.82rem">' + esc(m['등록일']) + '</span></div>';
      }).join('');
    }

    panel.innerHTML = '<div class="fin-card"><p style="color:var(--ink-soft)">불러오는 중…</p></div>';
    WPF.call('listGyojeok').then(function (lr) {
      var all = (lr.members || []).filter(function (m) { return m['이름']; });
      ALL = all; // showDetail의 가족 조회가 참조하는 공용 목록도 최신화

      panel.innerHTML =
        '<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start">' +
        '<div class="fin-card" style="flex:2;min-width:340px">' +
        '<b>새가족 등록</b>' +
        '<p style="color:var(--ink-soft);font-size:.85rem;margin:6px 0 16px">방문 시 작성한 등록카드를 그대로 입력하세요. 함께 오신 가족이 있으면 아래에 추가하면 자동으로 한 가정으로 연결됩니다. 등록하면 회원상태는 우선 <b>정회원후보</b>로 저장됩니다.</p>' +
        '<div style="border-bottom:1px solid #eef1f5;padding-bottom:14px;margin-bottom:14px">' +
        '<div style="font-size:.85rem;color:var(--accent,#223350);font-weight:700;margin-bottom:8px">등록자(세대주)</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<div class="af-field" style="flex:1;min-width:110px"><label>이름*</label><input type="text" id="nf_name"></div>' +
        '<div class="af-field" style="flex:1;min-width:140px"><label>생년월일(선택)</label><input type="text" id="nf_birth" inputmode="numeric" placeholder="8자리, 예: 19800101"></div>' +
        '<div class="af-field" style="flex:0;min-width:76px"><label>양/음</label>' + calSel('id="nf_birth_cal"', false) + '</div>' +
        '<div class="af-field" style="flex:1;min-width:90px"><label>성별</label><select id="nf_sex"><option value=""></option><option>남</option><option>여</option></select></div>' +
        '<div class="af-field" style="flex:1;min-width:140px"><label>휴대폰</label><input type="text" id="nf_phone" inputmode="numeric" placeholder="01012345678"></div>' +
        '<div class="af-field" style="flex:2;min-width:200px"><label>주소</label><input type="text" id="nf_address"></div>' +
        '<div class="af-field" style="flex:1;min-width:150px"><label>등록일</label><input type="text" id="nf_regdate" value="' + todayISO() + '" placeholder="예: 2026-08-02"></div>' +
        '<div class="af-field" style="flex:1;min-width:110px"><label>신급</label><select id="nf_grade">' + selOpts(GRADE_OPTS, '') + '</select></div>' +
        '<div class="af-field" style="flex:1;min-width:140px"><label>직분</label><select id="nf_role">' + selOpts(ROLE_OPTS, '') + '</select></div>' +
        '<div class="af-field" style="flex:1;min-width:160px"><label>직전교회</label><input type="text" id="nf_prevchurch"></div>' +
        '<div class="af-field" style="flex:1;min-width:120px"><label>인도자</label><input type="text" id="nf_referrer"></div>' +
        '<div class="af-field" style="flex:1;min-width:120px"><label>새가족 심방여부</label><select id="nf_visited">' + VISITED_OPTS.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select></div>' +
        '<div class="af-field full" style="flex:1 1 100%;min-width:220px"><label>특이사항</label><textarea id="nf_note" rows="2" style="width:100%;padding:8px 10px;border:1px solid #dfe5ee;border-radius:8px;font:inherit"></textarea></div>' +
        '</div></div>' +
        '<div style="font-size:.85rem;color:var(--accent,#223350);font-weight:700;margin-bottom:8px">함께 오신 가족 (선택)</div>' +
        '<div id="nf_famlist"></div>' +
        '<button type="button" class="btn btn-line" id="nf_addrow" style="margin-bottom:14px">＋ 가족 추가</button>' +
        '<div style="display:flex;gap:10px;align-items:center;border-top:1px solid #eef1f5;padding-top:14px">' +
        '<button type="button" class="btn btn-solid" id="nf_submit">등록하기</button><span class="fin-msg" id="nf_msg"></span>' +
        '</div></div>' +
        '<div class="fin-card" style="flex:1;min-width:280px">' +
        '<b>월별 신규 등록</b><span style="color:#9aa5b1;font-size:.78rem"> · 새가족만 집계됩니다</span>' +
        '<div style="margin-top:10px">' + statsChart(all) + '</div>' +
        '<div style="margin-top:16px;border-top:1px solid #eef1f5;padding-top:10px">' +
        '<b style="font-size:.88rem">새가족 명단</b>' +
        '<p style="color:#9aa5b1;font-size:.78rem;margin:4px 0 6px">정보가 아직 미흡해도 이름으로 찾아 이어서 채워 넣을 수 있어요.</p>' +
        '<input type="text" id="nf_recent_q" placeholder="🔍 이름 검색" style="width:100%;padding:7px 10px;border:1px solid #cdd7e3;border-radius:8px;font:inherit;margin-bottom:8px">' +
        '<div id="nf_recent">' + recentListHtml(all, '') + '</div></div>' +
        '</div></div>';

      function bindRecentClicks() {
        Array.prototype.forEach.call(panel.querySelectorAll('.nf-recent-row'), function (row) {
          row.onclick = function () {
            var m = ALL.filter(function (x) { return String(x['매칭키']) === row.dataset.key; })[0];
            if (m) showDetail(m);
          };
        });
      }
      bindRecentClicks();
      panel.querySelector('#nf_recent_q').addEventListener('input', function () {
        panel.querySelector('#nf_recent').innerHTML = recentListHtml(all, this.value);
        bindRecentClicks();
      });

      var famList = panel.querySelector('#nf_famlist');
      function addRow() { rowSeq++; var d = document.createElement('div'); d.innerHTML = famRowHtml(rowSeq); var el = d.firstChild; famList.appendChild(el); el.querySelector('.nf-f-remove').onclick = function () { el.remove(); }; }
      panel.querySelector('#nf_addrow').onclick = addRow;

      panel.querySelector('#nf_submit').onclick = function () {
        var msg = panel.querySelector('#nf_msg');
        var name = panel.querySelector('#nf_name').value.trim();
        var birth = panel.querySelector('#nf_birth').value.replace(/[^0-9]/g, '');
        var sex = panel.querySelector('#nf_sex').value;
        var phone = panel.querySelector('#nf_phone').value.replace(/[^0-9]/g, '');
        var address = panel.querySelector('#nf_address').value.trim();
        var regDate = panel.querySelector('#nf_regdate').value.trim();
        var lunar = panel.querySelector('#nf_birth_cal').value === '1';
        var grade = panel.querySelector('#nf_grade').value;
        var role = panel.querySelector('#nf_role').value;
        var prevChurch = panel.querySelector('#nf_prevchurch').value.trim();
        var referrer = panel.querySelector('#nf_referrer').value.trim();
        var visited = panel.querySelector('#nf_visited').value;
        var note = panel.querySelector('#nf_note').value.trim();
        if (!name) { msg.style.color = '#c0392b'; msg.textContent = '등록자 이름은 필수입니다.'; return; }
        if (birth && birth.length !== 8) { msg.style.color = '#c0392b'; msg.textContent = '등록자 생년월일은 8자리이거나 비워 두세요.'; return; }
        var famRows = Array.prototype.map.call(famList.querySelectorAll('.nf-famrow'), function (r) {
          return { name: r.querySelector('.nf-f-name').value.trim(), birth: r.querySelector('.nf-f-birth').value.replace(/[^0-9]/g, ''), lunar: r.querySelector('.nf-f-cal').value === '1', rel: r.querySelector('.nf-f-rel').value };
        }).filter(function (f) { return f.name; });
        for (var i = 0; i < famRows.length; i++) {
          if (famRows[i].birth && famRows[i].birth.length !== 8) { msg.style.color = '#c0392b'; msg.textContent = '가족 생년월일은 8자리이거나 비워 두세요.'; return; }
        }
        var btn = panel.querySelector('#nf_submit'); btn.disabled = true;
        msg.style.color = 'var(--ink-soft)'; msg.textContent = '등록 중…';

        var headFields = {
          성별: sex, 휴대폰: phone, 주소: address, 등록일: regDate || null, 음력생일: lunar,
          신급: grade, 직책: role, 직전교회: prevChurch, 인도자: referrer, 심방여부: visited, 특이사항: note,
          세대주: name, 관계: '세대주'
        };
        WPF.call('addGyojeok', { name: name, birth: birth, fields: headFields }).then(function (r) {
          var headId = r.id, headName = r.name;
          var chain = Promise.resolve();
          famRows.forEach(function (f) {
            chain = chain.then(function () {
              return WPF.call('addGyojeok', { name: f.name, birth: f.birth, fields: { 음력생일: f.lunar, 등록일: regDate || null, 세대주: headName, 관계: f.rel } }).then(function (fr) {
                if (f.rel === '배우자') return WPF.call('updateGyojeok', { id: headId, fields: { 배우자: fr.name, 배우자매칭키: fr.key } });
              });
            });
          });
          return chain;
        }).then(function () {
          msg.style.color = 'green'; msg.textContent = '✓ 등록되었습니다' + (famRows.length ? ' (가족 ' + famRows.length + '명 포함)' : '') + '.';
          btn.disabled = false;
          renderNewFamily(panel);
        }).catch(function (e) {
          msg.style.color = '#c0392b'; msg.textContent = '오류: ' + e.message; btn.disabled = false;
        });
      };
    }).catch(function (e) {
      panel.innerHTML = msgCard('조회 실패', e.message);
    });
  }

  /* ── 권한 관리: 정/준회원·교적연결 + 관리자/재정권한 ── */
  function renderAccess(panel) {
    loading(panel);
    Promise.all([WPF.call('listAccess'), WPF.call('listGyojeok')]).then(function (res) {
      var users = (res[0].users || []).sort(function (a, b) { return (b.isAdmin - a.isAdmin) || (b.canFinance - a.canFinance) || String(a.name).localeCompare(String(b.name), 'ko'); });
      var gj = (res[1].members || []).filter(function (m) { return m['이름']; });
      panel.innerHTML = '<div class="fin-card"><p style="color:var(--ink-soft);font-size:.88rem;margin-bottom:12px">홈페이지에 가입한 회원입니다. <b>회원</b> 칸에서 정/준회원을 바꿀 수 있고, <b>정회원</b>으로 바꾸면 교적과 연결됩니다(헌금조회·가정합산 연동). <b>관리자</b>는 교적관리·전체 기능, <b>재정권한</b>은 재정관리에 접근합니다.</p>' +
        '<div style="overflow:auto"><table class="fin-table"><thead><tr><th>이름</th><th>이메일</th><th>회원</th><th style="text-align:center">관리자</th><th style="text-align:center">재정권한</th></tr></thead><tbody>' +
        users.map(function (u) {
          return '<tr data-uid="' + esc(u.uid) + '"><td><b>' + esc(u.name || '(이름없음)') + '</b></td><td style="color:var(--ink-soft)">' + esc(u.email) + '</td>' +
            '<td><span class="st-pill" style="margin-right:8px;display:inline-block;min-width:48px">' + stPill(u.status) + '</span><select class="ck-status" style="padding:5px 8px;border:1px solid #cdd7e3;border-radius:7px;font:inherit;background:#fff">' +
              '<option value="준회원"' + (u.status === '정회원' ? '' : ' selected') + '>준회원</option>' +
              '<option value="정회원"' + (u.status === '정회원' ? ' selected' : '') + '>정회원</option></select></td>' +
            '<td style="text-align:center"><input type="checkbox" class="ck-admin" ' + (u.isAdmin ? 'checked' : '') + '></td>' +
            '<td style="text-align:center"><input type="checkbox" class="ck-fin" ' + (u.canFinance ? 'checked' : '') + '></td></tr>';
        }).join('') + '</tbody></table></div><p class="help" id="gj_msg" style="margin-top:10px"></p></div>';
      var msg = panel.querySelector('#gj_msg');
      function flash(ok, txt) { msg.style.color = ok ? 'green' : '#c0392b'; msg.textContent = txt; }
      Array.prototype.forEach.call(panel.querySelectorAll('tr[data-uid]'), function (tr) {
        var uid = tr.getAttribute('data-uid');
        var u = users.filter(function (x) { return x.uid === uid; })[0] || {};
        var ckA = tr.querySelector('.ck-admin'), ckF = tr.querySelector('.ck-fin'), sel = tr.querySelector('.ck-status');
        var prevStatus = u.status === '정회원' ? '정회원' : '준회원';
        function saveAccess(field, val, revert) {
          var body = { targetUid: uid }; body[field] = val;
          msg.style.color = 'var(--ink-soft)'; msg.textContent = '저장 중…';
          WPF.call('setAccess', body).then(function () { flash(true, '✓ 저장됨'); }).catch(function (e) { flash(false, '오류: ' + e.message); if (revert) revert(); });
        }
        ckA.addEventListener('change', function () { saveAccess('isAdmin', ckA.checked, function () { ckA.checked = !ckA.checked; }); });
        ckF.addEventListener('change', function () { saveAccess('canFinance', ckF.checked, function () { ckF.checked = !ckF.checked; }); });
        function setMember(status, key, name) {
          msg.style.color = 'var(--ink-soft)'; msg.textContent = '저장 중…';
          WPF.call('adminSetMember', { uid: uid, status: status, memberKey: key, memberName: name }).then(function () {
            prevStatus = status; u.status = status; if (name) { u.name = name; tr.querySelector('td b').textContent = name; }
            var sp = tr.querySelector('.st-pill'); if (sp) sp.innerHTML = stPill(status);
            flash(true, '✓ ' + (name ? esc(name) + ' · ' : '') + status + ' 저장됨');
          }).catch(function (e) { flash(false, '오류: ' + e.message); sel.value = prevStatus; });
        }
        sel.addEventListener('change', function () {
          if (sel.value === '정회원') {
            pickGyojeok(gj, function (m) {
              if (!m) { sel.value = prevStatus; return; }
              setMember('정회원', m['매칭키'], m['이름']);
            });
          } else { setMember('준회원', '', u.name || ''); }
        });
      });
    }).catch(function (e) {
      if (/unknown action|admin_set_member|404/i.test(e.message)) root.innerHTML = msgCard('백엔드 업데이트 필요', 'Supabase에 admin_set_member.sql 을 실행해 주세요.');
      else if (e.message.indexOf('관리자') >= 0) root.innerHTML = msgCard('접근 권한이 없습니다', '교적관리는 관리자만 이용할 수 있습니다.');
      else root.innerHTML = msgCard('오류', e.message);
    });
  }

  // 교적에서 인물 선택 팝업(정회원 연결용)
  function pickGyojeok(gj, cb) {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:flex-start;justify-content:center;z-index:9999;padding:40px 16px;overflow:auto';
    ov.innerHTML = '<div class="fin-card" style="max-width:460px;width:100%;background:#fff;margin:auto">' +
      '<h3 style="margin:0 0 8px;color:var(--accent,#223350)">교적 연결</h3>' +
      '<p style="color:var(--ink-soft);font-size:.86rem;margin-bottom:10px">정회원으로 연결할 교적 인물을 선택하세요. 본인 헌금 조회·가정 합산이 이 교적과 연동됩니다.</p>' +
      '<input type="text" id="pg_q" placeholder="🔍 이름 검색" style="width:100%;padding:9px 11px;border:1px solid #dfe5ee;border-radius:8px;font:inherit">' +
      '<div id="pg_list" style="max-height:320px;overflow:auto;margin-top:8px;border:1px solid #eef1f5;border-radius:8px"></div>' +
      '<div style="margin-top:12px;text-align:right"><button class="btn btn-line" id="pg_cancel">취소</button></div></div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); }
    ov.addEventListener('click', function (e) { if (e.target === ov) { close(); cb(null); } });
    ov.querySelector('#pg_cancel').onclick = function () { close(); cb(null); };
    var q = ov.querySelector('#pg_q'), listEl = ov.querySelector('#pg_list');
    function draw() {
      var s = q.value.trim();
      var rows = (s ? gj.filter(function (m) { return String(m['이름']).indexOf(s) >= 0; }) : gj).slice(0, 50);
      listEl.innerHTML = rows.length ? rows.map(function (m) {
        return '<div class="pg-item" data-key="' + esc(m['매칭키']) + '" style="padding:9px 11px;border-bottom:1px solid #f0f0f0;cursor:pointer"><b>' + esc(m['이름']) + '</b> <span style="color:#9aa5b1;font-size:.8rem">' + esc(birthDisplay(m)) + (m['그룹'] ? ' · ' + esc(m['그룹']) : '') + (m['직책'] ? ' · ' + esc(m['직책']) : '') + (m['세대주'] && m['세대주'] !== m['이름'] ? ' · ' + esc(m['세대주']) + '의 가정' : '') + '</span></div>';
      }).join('') : '<p style="color:#9aa5b1;padding:10px">검색 결과가 없습니다.</p>';
      Array.prototype.forEach.call(listEl.querySelectorAll('.pg-item'), function (d) { d.onclick = function () { var m = gj.filter(function (x) { return String(x['매칭키']) === d.dataset.key; })[0]; close(); cb(m || null); }; });
    }
    q.addEventListener('input', draw); draw(); setTimeout(function () { q.focus(); }, 50);
  }

  /* ── 교적 명단 ── */
  var ALL = [];
  var membersPanel = null;
  function renderMembers(panel) {
    membersPanel = panel;
    loading(panel);
    WPF.call('listGyojeok').then(function (r) {
      var ms = (r.members || []).filter(function (m) { return m['이름']; });
      ms.sort(function (a, b) { var ha = a['세대주'] || a['이름'], hb = b['세대주'] || b['이름']; if (ha !== hb) return ha.localeCompare(hb, 'ko'); return (a['이름'] === ha ? -1 : 1) - (b['이름'] === hb ? -1 : 1); });
      ALL = ms;
      var couples = ms.filter(function (m) { return m['배우자']; }).length / 2;
      panel.innerHTML = '<div class="fin-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:10px;flex-wrap:wrap"><b>교적 명단 (' + ms.length + '명)</b><input type="text" id="gj_search" placeholder="🔍 이름 검색" style="padding:7px 11px;border:1px solid #cdd7e3;border-radius:8px;font:inherit;flex:1;min-width:140px;max-width:260px"><span style="color:var(--ink-soft);font-size:.85rem">부부 ' + Math.round(couples) + '쌍</span></div><p style="color:var(--ink-soft);font-size:.83rem;margin-bottom:8px">이름을 클릭하면 개인 신상을 볼 수 있습니다.</p><form id="gj_add" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:#f7faff;border:1px solid #e3e7ee;border-radius:10px;padding:10px 12px;margin-bottom:12px"><input type="text" id="gj_add_name" placeholder="이름" autocomplete="off" style="padding:8px 11px;border:1px solid #cdd7e3;border-radius:8px;font:inherit;width:120px"><input type="text" id="gj_add_birth" inputmode="numeric" placeholder="생년월일 8자리(예: 19800101, 선택)" autocomplete="off" style="padding:8px 11px;border:1px solid #cdd7e3;border-radius:8px;font:inherit;width:250px"><button type="submit" class="btn btn-solid" style="padding:8px 18px;white-space:nowrap">➕ 교적 추가</button><span id="gj_add_msg" style="font-size:.85rem"></span></form><div style="overflow:auto;max-height:640px"><table class="fin-table"><thead><tr><th>이름</th><th>생년월일</th><th>세대주</th><th>관계</th><th>배우자</th><th>그룹</th><th>직책</th><th>휴대폰</th></tr></thead><tbody id="gj_tbody"></tbody></table></div></div>';
      var tbody = panel.querySelector('#gj_tbody');
      function draw(q) {
        q = (q || '').trim();
        var rows = q ? ms.filter(function (m) { return String(m['이름']).indexOf(q) >= 0; }) : ms;
        tbody.innerHTML = rows.map(function (m) { var isHead = (m['세대주'] || m['이름']) === m['이름']; return '<tr' + (isHead ? ' style="background:#f7faff"' : '') + '><td><a href="#" class="gj-name" data-key="' + esc(m['매칭키']) + '" style="color:var(--accent,#223350);font-weight:700;text-decoration:none;border-bottom:1px dashed #9ab">' + esc(m['이름']) + '</a></td><td>' + esc(birthDisplay(m)) + '</td><td>' + esc(m['세대주'] || '') + '</td><td>' + esc(m['관계'] || '') + '</td><td>' + (m['배우자'] ? '💑 ' + esc(m['배우자']) : '') + '</td><td>' + esc(m['그룹']) + '</td><td>' + esc(m['직책']) + '</td><td>' + esc(fmtPhone(m['휴대폰'])) + '</td></tr>'; }).join('');
        Array.prototype.forEach.call(tbody.querySelectorAll('.gj-name'), function (a) { a.onclick = function (e) { e.preventDefault(); var m = ms.filter(function (x) { return String(x['매칭키']) === a.dataset.key; })[0]; if (m) showDetail(m); }; });
      }
      draw('');
      panel.querySelector('#gj_search').addEventListener('input', function () { draw(this.value); });
      var addF = panel.querySelector('#gj_add');
      if (addF) addF.addEventListener('submit', function (e) {
        e.preventDefault();
        var nm = panel.querySelector('#gj_add_name').value.trim();
        var bd = panel.querySelector('#gj_add_birth').value.replace(/[^0-9]/g, '');
        var mEl = panel.querySelector('#gj_add_msg');
        if (!nm) { mEl.style.color = '#c0392b'; mEl.textContent = '이름을 입력하세요.'; return; }
        if (bd && bd.length !== 8) { mEl.style.color = '#c0392b'; mEl.textContent = '생년월일은 숫자 8자리로 입력하세요.'; return; }
        var btn = addF.querySelector('button'); btn.disabled = true;
        mEl.style.color = 'var(--ink-soft)'; mEl.textContent = '추가 중…';
        WPF.call('addGyojeok', { name: nm, birth: bd }).then(function () { renderMembers(panel); })
          .catch(function (err) { mEl.style.color = '#c0392b'; mEl.textContent = '오류: ' + err.message; btn.disabled = false; });
      });
    }).catch(function (e) {
      panel.innerHTML = msgCard('조회 실패', e.message);
    });
  }

  /* ── 개인 신상 상세(클릭 시 모달, 보기/수정/사진) ── */
  // 수정 가능한 항목(라벨 → 교적 열 이름)
  var EDIT_FIELDS = [
    ['이름', '이름', 'text'], ['생년월일', '생년월일', 'birth'], ['성별', '성별', 'sex'],
    ['휴대폰', '휴대폰', 'tel'], ['신급', '신급', 'grade'], ['직책', '직책', 'role'],
    ['세례일', '세례일', 'date'], ['임직일', '임직일', 'date'],
    ['세대주', '세대주', 'text'], ['세대주와 관계', '관계', 'text'], ['배우자', '배우자', 'text'],
    ['구역/부서', '그룹', 'text'], ['회원상태', '회원상태', 'status'], ['주소', '주소', 'text'],
    ['등록일', '등록일', 'date'], ['직전교회', '직전교회', 'text'], ['인도자', '인도자', 'text'],
    ['새가족 심방여부', '심방여부', 'visited'], ['특이사항', '특이사항', 'textarea']
  ];
  var GRADE_OPTS = ['원입', '학습', '세례', '입교', '유아세례', '안수'];
  var ROLE_OPTS = ['담임목사', '원로목사', '장로', '원로장로', '안수집사', '권사', '은퇴권사', '집사', '권찰', '성도'];
  var STATUS_OPTS = ['준회원', '정회원후보', '정회원'];
  var GROUP_PRESET = ['여전도회', '권사회', '남전도회', '구제선교위원회', '성가대', '찬양대'];
  function selOpts(opts, v) { var has = opts.indexOf(v) >= 0; return '<option value=""></option>' + (v && !has ? '<option selected>' + esc(v) + '</option>' : '') + opts.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join(''); }
  function groupsOf(m) { return String(m['소속그룹'] || '').split(/[,·]/).map(function (s) { return s.trim(); }).filter(Boolean); }
  function photoUrl(m) { return m['사진'] || ''; }
  function avatar(m, size) {
    var u = photoUrl(m); size = size || 84;
    if (u) return '<img src="' + esc(u) + '" alt="" style="width:' + size + 'px;height:' + size + 'px;border-radius:12px;object-fit:cover;border:1px solid #e3e7ee">';
    return '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:12px;background:#eef2f7;display:flex;align-items:center;justify-content:center;color:#9aa5b1;font-size:1.6rem;border:1px solid #e3e7ee">👤</div>';
  }
  /* ── 진행중인 교육 조회(Supabase edu_records, 관리자 세션으로 직접 조회) ── */
  function sbToken() {
    try {
      var ref = new URL(window.SUPABASE_URL).hostname.split('.')[0];
      var raw = localStorage.getItem('sb-' + ref + '-auth-token');
      if (!raw) return null;
      var s = JSON.parse(raw); s = s.currentSession || s;
      return s && s.access_token;
    } catch (e) { return null; }
  }
  function todayStr() { var d = new Date(); function p(n) { return ('0' + n).slice(-2); } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  var EDU_CACHE = null;
  function loadOngoingEdu() {
    if (EDU_CACHE) return Promise.resolve(EDU_CACHE);
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return Promise.resolve([]);
    var tok = sbToken(); if (!tok) return Promise.resolve([]);
    var t = todayStr();
    return fetch(window.SUPABASE_URL + '/rest/v1/edu_records?select=id,title,cohort,class_name,edu_date,end_date,participants&edu_date=lte.' + t, {
      headers: { apikey: window.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + tok }
    }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
      EDU_CACHE = (rows || []).filter(function (r) { return !r.end_date || r.end_date >= t; });
      return EDU_CACHE;
    }).catch(function () { return []; });
  }
  function eduOf(matchKey) {
    if (!EDU_CACHE || !matchKey) return [];
    return EDU_CACHE.filter(function (r) {
      var parts = []; try { parts = JSON.parse(r.participants || '[]'); } catch (e) {}
      return parts.some(function (p) { return p.key && p.key === matchKey; });
    });
  }
  function eduLabel(r) { return esc(r.title) + (r.cohort ? ' · ' + esc(r.cohort) : '') + (r.class_name ? ' · ' + esc(r.class_name) : ''); }

  function showDetail(m) {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:flex-start;justify-content:center;z-index:9999;padding:24px 16px;overflow:auto';
    ov.innerHTML = '<div class="fin-card" id="gd_box" style="max-width:580px;width:100%;background:#fff;margin:auto"></div>';
    document.body.appendChild(ov);
    var box = ov.querySelector('#gd_box');
    function close() { ov.remove(); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

    function viewMode(cur) {
      var head = cur['세대주'] || cur['이름'];
      var family = ALL.filter(function (x) { return (x['세대주'] || x['이름']) === head; });
      function row(label, val) { return val ? '<div style="display:flex;padding:7px 0;border-bottom:1px solid #f0f3f7"><div style="flex:0 0 96px;color:#7b8794;font-size:.85rem">' + esc(label) + '</div><div style="flex:1;font-size:.92rem">' + esc(val) + '</div></div>' : ''; }
      var age = '', bd = (String(cur['매칭키'] || '').split('|')[1]) || '';
      if (bd.length === 8) { var y = Number(bd.slice(0, 4)); if (y) age = (new Date().getFullYear() - y + 1) + '세'; }
      var famRows = family.map(function (f) { var isMe = f['매칭키'] === cur['매칭키']; return '<tr' + (isMe ? ' style="background:#eef4ff"' : '') + '><td><a href="#" class="gd-fam" data-key="' + esc(f['매칭키']) + '" style="color:var(--accent,#223350);text-decoration:none;font-weight:600">' + esc(f['이름']) + '</a></td><td>' + esc(f['관계'] || '') + '</td><td>' + esc(birthDisplay(f)) + '</td><td>' + esc(f['직책'] || '') + '</td></tr>'; }).join('');
      box.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:14px">' +
        '<div style="display:flex;gap:14px;align-items:center">' + avatar(cur, 84) + '<div><h3 style="margin:0;color:var(--accent,#223350)">' + esc(cur['이름']) + (cur['직책'] ? ' <span style="font-size:.8rem;color:#7b8794">' + esc(cur['직책']) + '</span>' : '') + '</h3><div style="color:#7b8794;font-size:.85rem;margin-top:3px">' + esc(cur['그룹'] || '') + (cur['세대주'] ? ' · ' + esc(cur['세대주']) + '의 가정' : '') + '</div></div></div>' +
        '<div style="display:flex;gap:6px"><button class="btn btn-solid" id="gd_edit" style="padding:4px 14px">수정</button><button class="btn btn-line" id="gd_delete" style="padding:4px 12px;color:#c0392b;border-color:#e6b0aa">삭제</button><button class="btn btn-line" id="gd_close" style="padding:4px 12px">닫기</button></div></div>' +
        '<div style="display:flex;gap:18px;flex-wrap:wrap"><div style="flex:1;min-width:240px">' +
        row('생년월일', birthDisplay(cur) + (age ? ' (' + age + ')' : '')) + row('성별', cur['성별']) + row('휴대폰', fmtPhone(cur['휴대폰'])) + row('집전화', cur['집전화']) + row('구역직분', cur['구역직분']) + row('기관직책', cur['기관직책']) + row('세례여부', cur['세례여부'] ? '받음' + (cur['세례일메모'] ? ' (' + cur['세례일메모'] + ')' : '') : '') + row('세례받은교회', cur['세례받은교회']) + row('집례자', cur['집례자']) + row('직장주소', cur['직장주소']) + row('직장전화', cur['직장전화']) + row('가족사항', cur['가족사항']) +
        '</div><div style="flex:1;min-width:240px">' +
        row('세대주', cur['세대주']) + row('세대주와 관계', cur['관계']) + row('배우자', cur['배우자']) + row('회원상태', cur['회원상태']) + row('임직일', cur['임직일']) +
        '</div></div>' + (cur['주소'] ? row('주소', cur['주소']) : '') +
        '<div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:4px"><div style="flex:1;min-width:240px">' +
        row('등록일', cur['등록일']) + row('직전교회', cur['직전교회']) +
        '</div><div style="flex:1;min-width:240px">' +
        row('인도자', cur['인도자']) + row('심방여부', cur['심방여부']) +
        '</div></div>' + (cur['특이사항'] ? '<div style="margin-top:6px;padding:10px 12px;background:#fbfaf6;border:1px solid #f0ece0;border-radius:8px"><div style="color:#7b8794;font-size:.8rem;margin-bottom:3px">특이사항</div><div style="font-size:.9rem;white-space:pre-wrap">' + esc(cur['특이사항']) + '</div></div>' : '') +
        (groupsOf(cur).length ? '<div style="margin-top:12px"><div style="color:#7b8794;font-size:.85rem;margin-bottom:5px">소속 그룹</div>' + groupsOf(cur).map(function (g) { return '<span class="fin-pill" style="background:#e8f0fb;color:#2b5797;margin:0 6px 6px 0;display:inline-block">' + esc(g) + '</span>'; }).join('') + '</div>' : '') +
        '<div id="gd_edu" style="margin-top:12px"></div>' +
        '<div style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center"><b style="color:var(--accent,#223350)">가족 관계</b><button class="btn btn-line" id="gd_family" style="padding:3px 12px;font-size:.8rem">👪 가족 구성/수정</button></div><div style="overflow:auto;margin-top:6px"><table class="fin-table" style="font-size:.86rem"><thead><tr><th>이름</th><th>관계</th><th>생년월일</th><th>직책</th></tr></thead><tbody>' + famRows + '</tbody></table></div></div>';
      box.querySelector('#gd_close').onclick = close;
      box.querySelector('#gd_edit').onclick = function () { editMode(cur); };
      box.querySelector('#gd_delete').onclick = function () {
        var head = cur['세대주'] || cur['이름'];
        var fam = ALL.filter(function (x) { return (x['세대주'] || x['이름']) === head; });
        var warn = (cur['이름'] === head && fam.length > 1)
          ? '\n\n⚠ ' + cur['이름'] + '님은 세대주입니다. 삭제하면 가족 연결이 끊어질 수 있으니, 먼저 가계도에서 세대주를 변경하는 것을 권합니다.' : '';
        if (!confirm(cur['이름'] + '님의 교적을 삭제할까요?\n삭제하면 되돌릴 수 없습니다.' + warn)) return;
        var delBtn = box.querySelector('#gd_delete'); delBtn.disabled = true; delBtn.textContent = '삭제 중…';
        WPF.call('deleteGyojeok', { id: cur['교적ID'] }).then(function () {
          close();
          if (membersPanel && document.body.contains(membersPanel)) renderMembers(membersPanel);
        }).catch(function (e) { delBtn.disabled = false; delBtn.textContent = '삭제'; alert('삭제 실패: ' + e.message); });
      };
      box.querySelector('#gd_family').onclick = function () { familyMode(cur); };
      Array.prototype.forEach.call(box.querySelectorAll('.gd-fam'), function (a) { a.onclick = function (e) { e.preventDefault(); var f = ALL.filter(function (x) { return String(x['매칭키']) === a.dataset.key; })[0]; if (f) viewMode(f); }; });
      loadOngoingEdu().then(function () {
        var el = box.querySelector('#gd_edu'); if (!el) return;
        var list = eduOf(cur['매칭키']);
        if (!list.length) return;
        el.innerHTML = '<div style="color:#7b8794;font-size:.85rem;margin-bottom:5px">📚 진행중인 교육</div>' +
          list.map(function (r) { return '<span class="fin-pill" style="background:#eef2f7;color:#3a4a63;margin:0 6px 6px 0;display:inline-block">' + eduLabel(r) + '</span>'; }).join('');
      });
    }

    function editMode(cur) {
      var curGroups = groupsOf(cur);
      var extraGroups = curGroups.filter(function (g) { return GROUP_PRESET.indexOf(g) < 0; }).join(', ');
      var fIsHead = (!cur['세대주'] || cur['세대주'] === cur['이름']);
      var fHasOrigin = !!(cur['부모세대']);
      function inp(label, col, type) {
        var v = (col === '생년월일') ? birthOf(cur) : (cur[col] == null ? '' : cur[col]);
        var ctrl;
        if (type === 'sex') ctrl = '<select data-col="' + col + '"><option value=""></option><option' + (v === '남' ? ' selected' : '') + '>남</option><option' + (v === '여' ? ' selected' : '') + '>여</option></select>';
        else if (type === 'grade') ctrl = '<select data-col="' + col + '">' + selOpts(GRADE_OPTS, v) + '</select>';
        else if (type === 'role') ctrl = '<select data-col="' + col + '">' + selOpts(ROLE_OPTS, v) + '</select>';
        else if (type === 'status') ctrl = '<select data-col="' + col + '">' + selOpts(STATUS_OPTS, v) + '</select>';
        else if (type === 'visited') ctrl = '<select data-col="' + col + '">' + selOpts(VISITED_OPTS, v) + '</select>';
        else if (type === 'textarea') ctrl = '<textarea data-col="' + col + '" rows="2" style="width:100%;padding:8px 10px;border:1px solid #dfe5ee;border-radius:8px;font:inherit">' + esc(v) + '</textarea>';
        else ctrl = '<input type="text" data-col="' + col + '" value="' + esc(v) + '"' + (type === 'tel' ? ' inputmode="numeric"' : '') + (type === 'birth' ? ' placeholder="예: 1981-08-19"' : '') + (type === 'date' ? ' placeholder="예: 2010-03-21"' : '') + '>';
        return '<div class="af-field"' + (type === 'textarea' ? ' style="flex:1 1 100%"' : '') + '><label>' + esc(label) + '</label>' + ctrl + '</div>';
      }
      box.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 style="margin:0;color:var(--accent,#223350)">교적 수정 — ' + esc(cur['이름']) + '</h3><button class="btn btn-line" id="gd_cancel" style="padding:4px 12px">취소</button></div>' +
        '<div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px">' +
        '<div style="text-align:center"><div id="gd_drop" style="border:2px dashed #cdd7e3;border-radius:14px;padding:10px;cursor:pointer;transition:.15s"><div id="gd_photo">' + avatar(cur, 96) + '</div><div style="font-size:.7rem;color:#9aa5b1;margin-top:6px;line-height:1.4">사진을 여기로<br>드래그하세요</div></div><div style="margin-top:8px"><input type="file" id="gd_file" accept="image/*" style="display:none"><button type="button" class="btn btn-line" id="gd_upbtn" style="padding:4px 10px;font-size:.8rem">📷 사진 선택</button></div><input type="hidden" data-col="사진" id="gd_photourl" value="' + esc(photoUrl(cur)) + '"><div id="gd_upmsg" style="font-size:.76rem;color:#7b8794;margin-top:4px"></div></div>' +
        '<div class="fin-grid" style="flex:1;min-width:260px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">' +
        EDIT_FIELDS.map(function (f) { return inp(f[0], f[1], f[2]); }).join('') +
        '</div></div>' +
        '<div style="margin-bottom:12px;border-top:1px solid #eef1f5;padding-top:12px;display:flex;gap:18px;flex-wrap:wrap;align-items:center">' +
        '<label class="sw"><input type="checkbox" id="gd_ishead"' + (fIsHead ? ' checked' : '') + '> ⌂ 세대주(본인이 세대주)</label>' +
        '<label class="sw"><input type="checkbox" id="gd_branch"' + (fHasOrigin ? ' checked' : '') + '> 🌿 분가(분가한 세대)</label>' +
        '<div class="af-field" id="gd_origin_wrap" style="flex:1;min-width:180px;margin:0;' + (fHasOrigin ? '' : 'display:none') + '"><label>분가 출신(부모 세대주)</label><input type="text" data-col="부모세대" id="gd_origin" value="' + esc(cur['부모세대'] || '') + '" placeholder="예: ○○○"></div>' +
        '</div>' +
        '<div style="margin-bottom:12px;border-top:1px solid #eef1f5;padding-top:12px"><label style="display:block;font-size:.8rem;color:#7b8794;margin-bottom:7px">소속 그룹 (여러 개 선택 가능)</label><div style="display:flex;flex-wrap:wrap;gap:8px 16px">' +
        GROUP_PRESET.map(function (g) { return '<label class="sw"><input type="checkbox" class="gd-grp" value="' + esc(g) + '"' + (curGroups.indexOf(g) >= 0 ? ' checked' : '') + '> ' + esc(g) + '</label>'; }).join('') +
        '</div><input type="text" id="gd_grp_extra" placeholder="기타 그룹 추가 (쉼표로 구분)" value="' + esc(extraGroups) + '" style="margin-top:9px;width:100%;padding:8px 10px;border:1px solid #dfe5ee;border-radius:8px;font:inherit"></div>' +
        '<div style="display:flex;gap:10px;align-items:center;margin-top:6px"><button class="btn btn-solid" id="gd_save">저장</button><span class="fin-msg" id="gd_msg"></span></div>' +
        '<p class="help" style="margin-top:8px">※ 이름·생년월일을 바꾸면 매칭키가 갱신됩니다(이전에 입력된 헌금 연결은 그대로 유지).</p>';
      box.querySelector('#gd_cancel').onclick = function () { viewMode(cur); };
      // 사진 업로드(버튼 + 드래그&드롭)
      var fileInp = box.querySelector('#gd_file'), upmsg = box.querySelector('#gd_upmsg'), purl = box.querySelector('#gd_photourl'), drop = box.querySelector('#gd_drop');
      function doUpload(f) {
        if (!f) return;
        if (!/^image\//.test(f.type)) { upmsg.style.color = '#c0392b'; upmsg.textContent = '이미지 파일만 가능합니다.'; return; }
        if (!window.ChurchUpload || !ChurchUpload.isReady()) { upmsg.style.color = '#c0392b'; upmsg.textContent = '업로드 서버가 설정되지 않았습니다.'; return; }
        upmsg.style.color = '#7b8794'; upmsg.textContent = '업로드 중…';
        ChurchUpload.upload(f, { folder: 'gyojeok' }).then(function (r) { purl.value = r.url; box.querySelector('#gd_photo').innerHTML = '<img src="' + esc(r.url) + '" style="width:96px;height:96px;border-radius:12px;object-fit:cover;border:1px solid #e3e7ee">'; upmsg.style.color = 'green'; upmsg.textContent = '✓ 사진 업로드됨'; }).catch(function (e) { upmsg.style.color = '#c0392b'; upmsg.textContent = '업로드 실패: ' + e.message; });
      }
      box.querySelector('#gd_upbtn').onclick = function () { fileInp.click(); };
      drop.onclick = function () { fileInp.click(); };
      fileInp.onchange = function () { doUpload(fileInp.files && fileInp.files[0]); };
      ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.style.borderColor = '#1e874b'; drop.style.background = '#f0faf3'; }); });
      ['dragleave', 'dragend'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.style.borderColor = '#cdd7e3'; drop.style.background = ''; }); });
      drop.addEventListener('drop', function (e) { e.preventDefault(); e.stopPropagation(); drop.style.borderColor = '#cdd7e3'; drop.style.background = ''; var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; doUpload(f); });
      // 세대주/분가 체크박스
      var ishead = box.querySelector('#gd_ishead'), branch = box.querySelector('#gd_branch'), originWrap = box.querySelector('#gd_origin_wrap'), originInp = box.querySelector('#gd_origin');
      var headInp = box.querySelector('[data-col="세대주"]'), relInp = box.querySelector('[data-col="관계"]'), nameInp = box.querySelector('[data-col="이름"]');
      function syncHead() { if (ishead.checked) { if (headInp) { headInp.value = (nameInp && nameInp.value.trim()) || cur['이름']; headInp.disabled = true; } if (relInp && (!relInp.value.trim() || relInp.value.trim() === '세대주')) relInp.value = '세대주'; } else if (headInp) { headInp.disabled = false; } }
      ishead.onchange = syncHead;
      branch.onchange = function () { originWrap.style.display = branch.checked ? '' : 'none'; if (branch.checked) { ishead.checked = true; syncHead(); } else { originInp.value = ''; } };
      syncHead();
      box.querySelector('#gd_save').onclick = function () {
        var fields = {};
        Array.prototype.forEach.call(box.querySelectorAll('[data-col]'), function (el) { fields[el.dataset.col] = el.value.trim(); });
        if (ishead.checked) { fields['세대주'] = fields['이름']; fields['관계'] = '세대주'; }   // 세대주 지정
        if (!branch.checked) fields['부모세대'] = '';                                          // 분가 해제 시 연결 제거
        // 소속 그룹: 체크된 프리셋 + 기타입력 병합(중복 제거)
        var gset = [];
        Array.prototype.forEach.call(box.querySelectorAll('.gd-grp:checked'), function (c) { if (gset.indexOf(c.value) < 0) gset.push(c.value); });
        (box.querySelector('#gd_grp_extra').value || '').split(/[,·]/).forEach(function (s) { s = s.trim(); if (s && gset.indexOf(s) < 0) gset.push(s); });
        fields['소속그룹'] = gset.join(', ');
        var msg = box.querySelector('#gd_msg');
        if (!fields['이름']) { msg.style.color = '#c0392b'; msg.textContent = '이름은 필수입니다.'; return; }
        msg.style.color = '#7b8794'; msg.textContent = '저장 중…';
        WPF.call('updateGyojeok', { id: cur['교적ID'], fields: fields }).then(function (r) {
          // 로컬 갱신
          Object.keys(fields).forEach(function (k) { cur[k] = fields[k]; });
          if (fields['이름'] || fields['생년월일']) { var b = String(fields['생년월일'] || birthOf(cur)).replace(/[^0-9]/g, '').slice(0, 8); cur['매칭키'] = String(fields['이름'] || cur['이름']).trim() + '|' + b; }
          msg.style.color = 'green'; msg.textContent = '✓ 저장되었습니다' + (r && r.promoted ? ' · 홈페이지 계정 정회원 승격됨' : '');
          setTimeout(function () { renderMembers(document.getElementById('gjPanel')); viewMode(cur); }, 500);
        }).catch(function (e) {
          if (/unknown action/i.test(e.message)) { msg.style.color = '#c0392b'; msg.textContent = '교적 수정은 Apps Script 재배포 후 가능합니다.'; }
          else { msg.style.color = '#c0392b'; msg.textContent = '저장 실패: ' + e.message; }
        });
      };
    }

    // ── 가족 관계 설정(관계형 구성) ──
    function familyMode(cur) {
      var REL = ['세대주', '배우자', '부', '모', '조부', '조모', '장남', '차남', '삼남', '아들', '장녀', '차녀', '삼녀', '딸', '자녀', '형제', '자매', '손자', '손녀', '사위', '며느리', '기타'];
      function relSel(id, val) { var has = REL.indexOf(val) >= 0; return '<select id="' + id + '">' + (val && !has ? '<option selected>' + esc(val) + '</option>' : '') + REL.map(function (o) { return '<option' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>'; }
      var head = cur['세대주'] || cur['이름'];
      var fam = ALL.filter(function (x) { return (x['세대주'] || x['이름']) === head; });
      var cand = ALL.filter(function (x) { return (x['세대주'] || x['이름']) !== head; }).sort(function (a, b) { return String(a['이름']).localeCompare(String(b['이름']), 'ko'); });
      var msgEl;
      function setMsg(t, ok) { if (msgEl) { msgEl.style.color = ok ? 'green' : '#c0392b'; msgEl.textContent = t; } }
      function rerun(id) { setMsg('처리 중…', true); return WPF.call('listGyojeok').then(function (r) { ALL = (r.members || []).filter(function (m) { return m['이름']; }); var nc = ALL.filter(function (x) { return String(x['교적ID']) === String(id); })[0] || cur; familyMode(nc); }).catch(function (e) { setMsg('오류: ' + e.message, false); }); }
      function doLink(memberRow, rel) {
        var fields = { 세대주: head, 관계: rel };
        var calls = [];
        if (rel === '배우자') {
          var headRow = ALL.filter(function (x) { return x['이름'] === head; })[0];
          fields['배우자'] = head; fields['배우자매칭키'] = headRow ? headRow['매칭키'] : '';
          if (headRow) calls.push(WPF.call('updateGyojeok', { id: headRow['교적ID'], fields: { 배우자: memberRow['이름'], 배우자매칭키: memberRow['매칭키'] } }));
        }
        calls.push(WPF.call('updateGyojeok', { id: memberRow['교적ID'], fields: fields }));
        return Promise.all(calls);
      }

      box.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h3 style="margin:0;color:var(--accent,#223350)">👪 가족 관계 설정</h3><button class="btn btn-line" id="fm_back" style="padding:4px 12px">← 돌아가기</button></div>' +
        '<p style="color:#7b8794;font-size:.85rem;margin-bottom:10px"><b>' + esc(head) + '</b>의 가정 · ' + fam.length + '명</p>' +
        '<span class="fin-msg" id="fm_msg" style="display:block;margin-bottom:8px"></span>' +
        '<div class="fin-card" style="padding:12px;margin-bottom:14px"><b style="font-size:.85rem">현재 가족</b><div style="overflow:auto;margin-top:6px"><table class="fin-table" style="font-size:.85rem"><thead><tr><th>이름</th><th>생년월일</th><th>관계</th><th>관리</th></tr></thead><tbody>' +
        fam.map(function (f) { var isMe = f['교적ID'] === cur['교적ID']; return '<tr><td><b>' + esc(f['이름']) + '</b>' + (isMe ? ' <span style="color:#9ab;font-size:.74rem">(본인)</span>' : '') + '</td><td>' + esc(birthDisplay(f)) + '</td><td>' + relSel('fm_rel_' + f['교적ID'], f['관계']) + '</td><td style="white-space:nowrap"><button class="btn btn-line fm-relsave" data-id="' + esc(f['교적ID']) + '" style="padding:2px 8px;font-size:.74rem">관계저장</button> <button class="btn btn-line fm-remove" data-id="' + esc(f['교적ID']) + '" data-name="' + esc(f['이름']) + '" style="padding:2px 8px;font-size:.74rem">제외</button></td></tr>'; }).join('') +
        '</tbody></table></div></div>' +
        (cur['이름'] !== head ? '<div style="margin-bottom:14px"><button class="btn btn-line" id="fm_sethead" style="padding:5px 12px;font-size:.84rem">⌂ ' + esc(cur['이름']) + '님을 세대주로 지정</button></div>' : '') +
        '<div class="fin-card" style="padding:12px;margin-bottom:14px"><b style="font-size:.85rem">기존 교인 연결</b><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:8px">' +
        '<div class="af-field" style="flex:2;min-width:160px"><label>교인 선택</label><select id="fm_member"><option value="">교인 선택</option>' + cand.map(function (m) { return '<option value="' + esc(m['교적ID']) + '">' + esc(m['이름']) + ' (' + esc(birthDisplay(m)) + ')</option>'; }).join('') + '</select></div>' +
        '<div class="af-field" style="flex:1;min-width:110px"><label>관계</label>' + relSel('fm_rel', '배우자') + '</div>' +
        '<button class="btn btn-solid" id="fm_addexist" style="padding:8px 14px">＋ 연결</button></div></div>' +
        '<div class="fin-card" style="padding:12px"><b style="font-size:.85rem">새 교인 추가</b><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:8px">' +
        '<div class="af-field" style="flex:1;min-width:110px"><label>이름</label><input type="text" id="fm_nname"></div>' +
        '<div class="af-field" style="flex:1;min-width:120px"><label>생년월일(선택)</label><input type="text" id="fm_nbirth" placeholder="예: 2010-03-21"></div>' +
        '<div class="af-field" style="flex:1;min-width:100px"><label>관계</label>' + relSel('fm_nrel', '자녀') + '</div>' +
        '<button class="btn btn-solid" id="fm_addnew" style="padding:8px 14px">＋ 추가</button></div></div>' +
        '<p class="help" style="margin-top:8px">※ 같은 세대주로 묶이면 가족이 됩니다. ‘배우자’로 연결하면 양쪽에 배우자가 자동 등록됩니다.</p>';

      msgEl = box.querySelector('#fm_msg');
      box.querySelector('#fm_back').onclick = function () { renderMembers(document.getElementById('gjPanel')); viewMode(cur); };
      var setHead = box.querySelector('#fm_sethead');
      if (setHead) setHead.onclick = function () { WPF.call('updateGyojeok', { id: cur['교적ID'], fields: { 세대주: cur['이름'], 관계: '세대주' } }).then(function () { rerun(cur['교적ID']); }).catch(function (e) { setMsg('오류: ' + e.message, false); }); };
      Array.prototype.forEach.call(box.querySelectorAll('.fm-relsave'), function (b) {
        b.onclick = function () { var sel = document.getElementById('fm_rel_' + b.dataset.id); var rel = sel ? sel.value : ''; var m = ALL.filter(function (x) { return String(x['교적ID']) === String(b.dataset.id); })[0]; if (!m) return; doLink(m, rel).then(function () { rerun(cur['교적ID']); }).catch(function (e) { setMsg('오류: ' + e.message, false); }); };
      });
      Array.prototype.forEach.call(box.querySelectorAll('.fm-remove'), function (b) {
        b.onclick = function () { if (!confirm(b.dataset.name + '님을 이 가족에서 제외할까요?')) return; WPF.call('updateGyojeok', { id: b.dataset.id, fields: { 세대주: b.dataset.name, 관계: '', 배우자: '', 배우자매칭키: '' } }).then(function () { rerun(cur['교적ID']); }).catch(function (e) { setMsg('오류: ' + e.message, false); }); };
      });
      box.querySelector('#fm_addexist').onclick = function () {
        var id = box.querySelector('#fm_member').value; if (!id) { setMsg('연결할 교인을 선택하세요.', false); return; }
        var rel = box.querySelector('#fm_rel').value; var m = ALL.filter(function (x) { return String(x['교적ID']) === String(id); })[0]; if (!m) return;
        setMsg('연결 중…', true); doLink(m, rel).then(function () { rerun(cur['교적ID']); }).catch(function (e) { setMsg('오류: ' + e.message, false); });
      };
      box.querySelector('#fm_addnew').onclick = function () {
        var nm = box.querySelector('#fm_nname').value.trim(); var bd = box.querySelector('#fm_nbirth').value.replace(/[^0-9]/g, ''); var rel = box.querySelector('#fm_nrel').value;
        if (!nm) { setMsg('이름을 입력하세요.', false); return; }
        if (bd && bd.length !== 8) { setMsg('생년월일은 8자리이거나 비워 두세요.', false); return; }
        setMsg('추가 중…', true);
        WPF.call('addGyojeok', { name: nm, birth: bd }).then(function (r) {
          return WPF.call('listGyojeok').then(function (lr) {
            ALL = (lr.members || []).filter(function (m) { return m['이름']; });
            var newM = ALL.filter(function (x) { return String(x['매칭키']) === r.key; })[0];
            if (!newM) throw new Error('추가된 교인을 찾지 못했습니다.');
            return doLink(newM, rel);
          });
        }).then(function () { rerun(cur['교적ID']); }).catch(function (e) { setMsg('오류: ' + e.message, false); });
      };
    }

    viewMode(m);
  }

  /* ── 가족관계: 드래그 가계도 구성 ── */
  function renderFamily(panel) {
    var REL = ['세대주', '배우자', '부', '모', '조부', '조모', '장남', '차남', '삼남', '아들', '장녀', '차녀', '삼녀', '딸', '자녀', '형제', '자매', '손자', '손녀', '사위', '며느리', '기타'];
    var ORD = {}; REL.forEach(function (r, i) { ORD[r] = i + 1; });
    var KEYS = ['세대주', '관계', '배우자', '배우자매칭키', '부모세대'];
    var ALL = [], work = [], selKey = null, dragId = null, q = '', leftTab = 'name', activeHead = null;
    function headOf(m) { return m['세대주'] || m['이름']; }
    function isHeadM(m) { return headOf(m) === m['이름']; }
    function byId(arr, id) { for (var i = 0; i < arr.length; i++) if (String(arr[i]['교적ID']) === String(id)) return arr[i]; return null; }
    function byKey(arr, k) { for (var i = 0; i < arr.length; i++) if (arr[i]['매칭키'] === k) return arr[i]; return null; }
    function byName(arr, nm) { for (var i = 0; i < arr.length; i++) if (arr[i]['이름'] === nm) return arr[i]; return null; }
    function clone(arr) { return arr.map(function (m) { var o = {}; for (var k in m) o[k] = m[k]; return o; }); }
    function flash(t, ok) { var e = panel.querySelector('#fam_msg'); if (e) { e.style.color = ok === false ? '#c0392b' : (ok ? 'green' : '#7b8794'); e.textContent = t; } }
    function load() { panel.innerHTML = '<p class="qt-loading">불러오는 중…</p>'; return WPF.call('listGyojeok').then(function (r) { ALL = (r.members || []).filter(function (m) { return m['이름']; }); work = clone(ALL); if (activeHead && !byName(work, activeHead)) activeHead = null; draw(); }).catch(function (e) { panel.innerHTML = msgCard('조회 실패', e.message); }); }
    function changes() { var out = []; work.forEach(function (w) { var o = byId(ALL, w['교적ID']); if (!o) return; var f = {}; KEYS.forEach(function (k) { if ((w[k] || '') !== (o[k] || '')) f[k] = w[k] || ''; }); if (Object.keys(f).length) out.push({ id: w['교적ID'], fields: f }); }); return out; }
    function set(id, f) { var m = byId(work, id); if (m) for (var k in f) m[k] = f[k]; }
    function heads() { return work.filter(isHeadM); }
    function familyOf(h) { return work.filter(function (m) { return headOf(m) === h; }); }
    function childHouseholds(headName) { return heads().filter(function (h) { return (h['부모세대'] || '') === headName && h['이름'] !== headName; }).sort(function (a, b) { return birthOf(a).localeCompare(birthOf(b)); }); }
    function descendantHeads(headName, acc) { acc = acc || {}; childHouseholds(headName).forEach(function (h) { if (!acc[h['이름']]) { acc[h['이름']] = 1; descendantHeads(h['이름'], acc); } }); return acc; }
    function pickHead(exclude) {
      return new Promise(function (resolve) {
        var cand = heads().filter(function (h) { return exclude.indexOf(h['이름']) < 0; }).sort(function (a, b) { return String(a['이름']).localeCompare(String(b['이름']), 'ko'); });
        var ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:flex-start;justify-content:center;z-index:9999;padding:40px 16px;overflow:auto';
        ov.innerHTML = '<div class="fin-card" style="max-width:380px;width:100%;background:#fff;margin:auto"><h3 style="margin:0 0 8px;color:var(--accent,#223350)">부모 세대 선택</h3><p style="font-size:.84rem;color:#7b8794;margin:0 0 8px">이 가정이 분가해 나온 <b>부모 가정(세대주)</b>을 고르세요.</p><input type="text" id="ph_q" placeholder="🔍 세대주 검색" style="width:100%;padding:8px 11px;border:1px solid #dfe5ee;border-radius:8px;font:inherit"><div id="ph_list" style="max-height:300px;overflow:auto;margin-top:8px;border:1px solid #eef1f5;border-radius:8px"></div><div style="text-align:right;margin-top:10px"><button class="btn btn-line" id="ph_cancel">취소</button></div></div>';
        document.body.appendChild(ov);
        function close(v) { ov.remove(); resolve(v); }
        function rend(qq) { var ql = (qq || '').trim().toLowerCase(); var L = ov.querySelector('#ph_list'); L.innerHTML = cand.filter(function (h) { return !ql || h['이름'].toLowerCase().indexOf(ql) >= 0; }).map(function (h) { return '<div class="ph-item" data-name="' + esc(h['이름']) + '" style="padding:9px 11px;border-bottom:1px solid #f0f0f0;cursor:pointer">⌂ <b>' + esc(h['이름']) + '</b> <span style="color:#9aa5b1;font-size:.8rem">' + esc(birthDisplay(h)) + '</span></div>'; }).join('') || '<p style="padding:10px;color:#9aa5b1">결과 없음</p>'; Array.prototype.forEach.call(L.querySelectorAll('.ph-item'), function (d) { d.onclick = function () { close(d.dataset.name); }; }); }
        ov.querySelector('#ph_q').oninput = function () { rend(this.value); };
        ov.querySelector('#ph_cancel').onclick = function () { close(null); };
        ov.addEventListener('click', function (e) { if (e.target === ov) close(null); });
        rend('');
      });
    }
    function setOrigin(headMember) {
      var exclude = [headMember['이름']]; var desc = descendantHeads(headMember['이름']); Object.keys(desc).forEach(function (n) { exclude.push(n); });
      pickHead(exclude).then(function (name) { if (!name) return; set(headMember['교적ID'], { 부모세대: name }); draw(); flash('「' + name + '」 가정의 분가 세대로 연결 — 저장하기로 반영하세요'); });
    }
    function removeOrigin(headMember) { set(headMember['교적ID'], { 부모세대: '' }); draw(); flash('부모 세대 연결 해제 — 저장하기로 반영하세요'); }
    function pickRel(member, head, dflt) {
      return new Promise(function (resolve) {
        var ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px';
        ov.innerHTML = '<div class="fin-card" style="max-width:340px;width:100%;background:#fff"><h3 style="margin:0 0 10px;color:var(--accent,#223350)">관계 지정</h3>' +
          '<p style="font-size:.86rem;color:#7b8794;margin:0 0 10px"><b>' + esc(member['이름']) + '</b> → <b>' + esc(head) + '</b>님 가정</p>' +
          '<select id="pr_rel" style="width:100%;padding:8px;border:1px solid #cdd7e3;border-radius:8px;font:inherit">' + REL.map(function (o) { return '<option' + (o === dflt ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>' +
          '<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end"><button class="btn btn-line" id="pr_cancel">취소</button><button class="btn btn-solid" id="pr_ok">확인</button></div></div>';
        document.body.appendChild(ov);
        function close(v) { ov.remove(); resolve(v); }
        ov.addEventListener('click', function (e) { if (e.target === ov) close(null); });
        ov.querySelector('#pr_cancel').onclick = function () { close(null); };
        ov.querySelector('#pr_ok').onclick = function () { close(ov.querySelector('#pr_rel').value); };
      });
    }
    function assignLocal(member, head, rel) {
      set(member['교적ID'], { 세대주: head, 관계: rel });
      if (rel === '배우자') { var hr = byName(work, head); set(member['교적ID'], { 배우자: head, 배우자매칭키: hr ? hr['매칭키'] : '' }); if (hr) set(hr['교적ID'], { 배우자: member['이름'], 배우자매칭키: member['매칭키'] }); }
    }
    function addToActive(member) {
      if (!activeHead) return;
      if (member['이름'] === activeHead) { flash('세대주 본인입니다.', false); return; }
      pickRel(member, activeHead, member['배우자'] === activeHead ? '배우자' : '자녀').then(function (rel) { if (!rel) return; assignLocal(member, activeHead, rel); selKey = null; draw(); flash('추가됨 — 저장하기로 반영하세요'); });
    }
    function startFamily(member) { set(member['교적ID'], { 세대주: member['이름'], 관계: '세대주' }); activeHead = member['이름']; selKey = null; draw(); flash('「' + member['이름'] + '」 세대주로 시작 — 가족을 드래그해 추가하세요'); }
    function removeMember(member) { set(member['교적ID'], { 세대주: member['이름'], 관계: '', 배우자: '', 배우자매칭키: '' }); draw(); flash('가족에서 제외 — 저장하기로 반영하세요'); }
    function save() {
      var ch = changes();
      if (!ch.length) { flash('변경된 내용이 없습니다.', true); return; }
      flash('저장 중… (' + ch.length + '건)');
      Promise.all(ch.map(function (c) { return WPF.call('updateGyojeok', { id: c.id, fields: c.fields }); }))
        .then(function () { flash('✓ ' + ch.length + '건 저장되어 모두에게 반영되었습니다.', true); load(); })
        .catch(function (e) { flash('저장 실패: ' + e.message, false); });
    }
    function chip(m) {
      var isH = isHeadM(m);
      var sub = birthOf(m) + (isH ? ' · 세대주' : ' · ' + esc(m['세대주']) + '의 가정');
      var on = (selKey === m['매칭키']) || (leftTab === 'head' && activeHead === m['이름']);
      return '<div class="fam-chip" draggable="true" data-id="' + esc(m['교적ID']) + '" style="padding:7px 10px;border:1px solid ' + (on ? '#9ab8e8' : '#e1e7ef') + ';border-radius:8px;margin-bottom:6px;cursor:grab;background:' + (on ? '#e7f0ff' : '#fff') + '">' + (leftTab === 'head' ? '<span style="color:#c9a227">⌂</span> ' : '') + '<b>' + esc(m['이름']) + '</b> <span style="color:#9aa5b1;font-size:.76rem">' + sub + '</span></div>';
    }
    function leftHTML() {
      var ql = q.trim().toLowerCase();
      var src = leftTab === 'head' ? heads() : work;
      var list = src.filter(function (m) { return !ql || (m['이름'] || '').toLowerCase().indexOf(ql) >= 0; }).sort(function (a, b) { return String(a['이름']).localeCompare(String(b['이름']), 'ko'); });
      return list.map(chip).join('') || '<p style="color:#9aa5b1;padding:10px">결과 없음</p>';
    }
    function rightHTML() {
      if (!activeHead) {
        return '<div id="fam_canvas" style="border:2px dashed #cdd7e3;border-radius:12px;padding:34px 16px;text-align:center;color:#9aa5b1;font-size:.9rem;min-height:160px;display:flex;align-items:center;justify-content:center">이름을 여기로 <b style="margin:0 4px">드래그</b>하면 그 사람이 <b style="margin:0 4px">세대주</b>가 되어 가계도가 시작됩니다.<br>또는 왼쪽 <b style="margin:0 4px">‘세대주’</b> 탭에서 가정을 선택하세요.</div>';
      }
      var fam = familyOf(activeHead);
      var headM = byName(fam, activeHead);
      var spouse = null;
      for (var i = 0; i < fam.length; i++) { var f = fam[i]; if (f === headM) continue; if (f['관계'] === '배우자' || (headM && f['매칭키'] && f['매칭키'] === headM['배우자매칭키'])) { spouse = f; break; } }
      var others = fam.filter(function (m) { return m !== headM && m !== spouse; }).sort(function (a, b) { return birthOf(a).localeCompare(birthOf(b)); });  // 태어난 순(위가 손위)
      function memNode(m, kind) { // kind: 'head' | 'spouse' | 'child'
        var isHead = kind === 'head';
        var icon = kind === 'head' ? '<span style="color:#c9a227;font-size:1.05rem">⌂</span>' : (kind === 'spouse' ? '<span style="color:#e0639b">💑</span>' : '<span style="color:#cbd5e1">└</span>');
        return '<span class="fam-node"' + (isHead ? '' : ' draggable="true"') + ' data-id="' + esc(m['교적ID']) + '" style="display:inline-flex;align-items:center;gap:6px;cursor:' + (isHead ? 'default' : 'grab') + '">' +
          icon + '<b style="' + (isHead ? 'color:var(--accent,#223350);font-size:1.02rem' : '') + '">' + esc(m['이름']) + '</b>' +
          '<span style="font-size:.74rem;color:#7b8794">' + (isHead ? '세대주' : esc(m['관계'] || (kind === 'spouse' ? '배우자' : '관계 미지정'))) + ' · ' + esc(birthDisplay(m)) + '</span>' +
          (isHead ? '' : '<button class="fam-x" data-id="' + esc(m['교적ID']) + '" title="가족에서 제외" style="border:0;background:none;color:#c0392b;cursor:pointer;font-size:.82rem">✕</button>') +
          '</span>';
      }
      var topLine = '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:4px 0">' + (headM ? memNode(headM, 'head') : '') + (spouse ? '<span style="color:#cdd5e1">—</span>' + memNode(spouse, 'spouse') : '') + '</div>';
      var childRows = others.map(function (m) { return '<div style="padding:5px 0 5px 18px">' + memNode(m, 'child') + '</div>'; }).join('');
      var origin = headM ? (headM['부모세대'] || '') : '';
      var parentBar = '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px;font-size:.83rem">' +
        (origin
          ? '<span style="color:#7b8794">↑ 분가 출신: <b style="color:var(--accent,#223350)">' + esc(origin) + '</b>님 가정</span> <button class="btn btn-line" id="fam_origin_open" style="padding:2px 9px;font-size:.74rem">부모 가정 열기</button> <button class="btn btn-line" id="fam_origin_set" style="padding:2px 9px;font-size:.74rem">변경</button> <button class="btn btn-line" id="fam_origin_rm" style="padding:2px 9px;font-size:.74rem">해제</button>'
          : '<button class="btn btn-line" id="fam_origin_set" style="padding:3px 11px;font-size:.78rem">＋ 부모 세대 연결(분가 출신 가정 지정)</button>') +
        '</div>';
      var kids = childHouseholds(activeHead);
      var kidsHTML = kids.length ? '<div style="margin-top:12px"><div style="font-size:.78rem;color:#9aa5b1;margin-bottom:5px">└ 분가한 자녀 세대 (' + kids.length + ')</div>' + kids.map(function (k) { return '<button class="fam-kid btn btn-line" data-name="' + esc(k['이름']) + '" style="padding:5px 12px;font-size:.83rem;margin:0 6px 6px 0">→ ' + esc(k['이름']) + '님 가정</button>'; }).join('') + '</div>' : '';
      return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="color:var(--accent,#223350)">' + esc(activeHead) + '님 가정 (' + fam.length + '명)</b><button class="btn btn-line" id="fam_close" style="padding:3px 11px;font-size:.78rem">✕ 닫기</button></div>' +
        parentBar +
        '<div id="fam_canvas" style="border:2px dashed #b9cdee;border-radius:12px;padding:12px 14px;min-height:130px;background:#fafcff">' + topLine + childRows + '<div style="font-size:.76rem;color:#9aa5b1;margin-top:8px;border-top:1px dashed #e1e7ef;padding-top:6px">＋ 왼쪽에서 이름을 여기로 드래그하면 이 가정에 추가됩니다</div></div>' +
        kidsHTML;
    }
    function wireLeft() {
      Array.prototype.forEach.call(panel.querySelectorAll('.fam-chip'), function (c) {
        c.addEventListener('dragstart', function (e) { dragId = c.dataset.id; e.dataTransfer.setData('text/plain', c.dataset.id); });
        c.addEventListener('click', function () {
          var m = byId(work, c.dataset.id); if (!m) return;
          if (leftTab === 'head') { activeHead = (activeHead === m['이름']) ? null : m['이름']; selKey = null; draw(); }
          else { var k = m['매칭키']; selKey = (selKey === k) ? null : k; draw(); }
        });
      });
    }
    function draw() {
      var ch = changes().length;
      panel.innerHTML =
        '<div class="fin-card"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px"><b>가계도</b><span style="display:flex;gap:10px;align-items:center"><span class="fin-msg" id="fam_msg" style="font-size:.84rem"></span><button class="btn btn-solid" id="fam_save">💾 저장하기' + (ch ? ' (' + ch + ')' : '') + '</button><button class="btn btn-line" id="fam_revert">되돌리기</button></span></div>' +
        '<p style="color:var(--ink-soft);font-size:.83rem;margin:0 0 12px">왼쪽 <b>이름/세대주</b> 탭에서 사람을 골라 오른쪽으로 <b>드래그</b>합니다. 빈 칸에 놓으면 <b>세대주</b>가 되어 가계도가 시작되고, 가정이 열린 뒤 이름을 놓으면 그 가정에 <b>관계</b>로 추가됩니다. 다 한 뒤 <b>저장하기</b>를 누르면 모두에게 반영됩니다.</p>' +
        '<div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">' +
        '<div style="flex:0 0 280px;max-width:100%">' +
        '<div style="display:flex;gap:4px;margin-bottom:8px"><button class="fam-tab btn ' + (leftTab === 'name' ? 'btn-solid' : 'btn-line') + '" data-tab="name" style="flex:1;padding:6px 0;font-size:.84rem">이름</button><button class="fam-tab btn ' + (leftTab === 'head' ? 'btn-solid' : 'btn-line') + '" data-tab="head" style="flex:1;padding:6px 0;font-size:.84rem">세대주</button></div>' +
        '<input type="text" id="fam_q" value="' + esc(q) + '" placeholder="🔍 이름 검색" style="width:100%;padding:8px 11px;border:1px solid #cdd7e3;border-radius:8px;font:inherit;margin-bottom:8px"><div id="fam_left" style="max-height:540px;overflow:auto;padding-right:4px">' + leftHTML() + '</div></div>' +
        '<div style="flex:1;min-width:280px"><div id="fam_right">' + rightHTML() + '</div></div>' +
        '</div></div>';
      var qel = panel.querySelector('#fam_q');
      qel.oninput = function () { q = qel.value; var le = panel.querySelector('#fam_left'); if (le) { le.innerHTML = leftHTML(); wireLeft(); } };
      Array.prototype.forEach.call(panel.querySelectorAll('.fam-tab'), function (t) { t.onclick = function () { leftTab = t.dataset.tab; selKey = null; draw(); }; });
      panel.querySelector('#fam_save').onclick = save;
      panel.querySelector('#fam_revert').onclick = function () { if (changes().length && !confirm('저장하지 않은 변경을 되돌릴까요?')) return; work = clone(ALL); selKey = null; draw(); };
      var fc = panel.querySelector('#fam_close'); if (fc) fc.onclick = function () { activeHead = null; selKey = null; draw(); };
      var os = panel.querySelector('#fam_origin_set'); if (os) os.onclick = function () { var hm = byName(work, activeHead); if (hm) setOrigin(hm); };
      var orm = panel.querySelector('#fam_origin_rm'); if (orm) orm.onclick = function () { var hm = byName(work, activeHead); if (hm) removeOrigin(hm); };
      var oo = panel.querySelector('#fam_origin_open'); if (oo) oo.onclick = function () { var hm = byName(work, activeHead); if (hm && hm['부모세대']) { activeHead = hm['부모세대']; selKey = null; draw(); } };
      Array.prototype.forEach.call(panel.querySelectorAll('.fam-kid'), function (b) { b.onclick = function () { activeHead = b.dataset.name; selKey = null; draw(); }; });
      wireLeft();
      // 트리 노드 드래그(가정 내 인물 이동)
      Array.prototype.forEach.call(panel.querySelectorAll('.fam-node[draggable]'), function (n) {
        n.addEventListener('dragstart', function (e) { e.stopPropagation(); dragId = n.dataset.id; e.dataTransfer.setData('text/plain', n.dataset.id); });
      });
      // 오른쪽 캔버스: 드롭 → 세대주 시작 또는 가정에 추가
      var canvas = panel.querySelector('#fam_canvas');
      if (canvas) {
        canvas.addEventListener('dragover', function (e) { e.preventDefault(); canvas.style.boxShadow = 'inset 0 0 0 2px #6f9be0'; });
        canvas.addEventListener('dragleave', function () { canvas.style.boxShadow = ''; });
        canvas.addEventListener('drop', function (e) { e.preventDefault(); canvas.style.boxShadow = ''; var m = byId(work, dragId); if (!m) return; if (activeHead) addToActive(m); else startFamily(m); });
        canvas.addEventListener('click', function (e) { if (e.target.closest('.fam-x')) return; if (!selKey) return; var m = byKey(work, selKey); if (!m) return; if (activeHead) addToActive(m); else startFamily(m); });
      }
      Array.prototype.forEach.call(panel.querySelectorAll('.fam-x'), function (b) {
        b.onclick = function (e) { e.stopPropagation(); var m = byId(work, b.dataset.id); if (m) removeMember(m); };
      });
    }
    load();
  }

  /* ══════════════════════════════════════════════════════════════
     엑셀 가져오기 — '노진교회 교인 신상 통합 명부'(.xlsx) → 교적
     · 반영 전에 반드시 미리보기(신규/변경/경고)를 보여주고 확인받는다.
     · 사람 연결은 '이름'으로 한다. (통합 명부의 가족관계 시트에 있는
       '교인번호'는 교인기본정보의 '번호'와 체계가 달라 쓰면 안 된다 —
       2026-08 실제 파일에서 46건 전부 어긋나 있는 것을 확인함)
     ══════════════════════════════════════════════════════════════ */
  var GJ_IMPORT_ORG = ['제직회', '여호수아', '에스더', '루디아', '엘림회'];

  // "61년11월28일(음)" · "55.11.16(음)" · "1985.04.12(양)" · "83년 2월 11일(양)" 등을 모두 처리
  function parseBirth(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s || s === '(공란)') return null;
    var lunar = /음/.test(s);
    var both = /양음/.test(s);              // "44년3월16일(양음)" — 양력·음력 표기가 섞임
    var d = s.replace(/\([^)]*\)/g, ' ');   // 괄호(양/음/메모) 제거
    var m = d.match(/(\d{2,4})\s*년?\s*[.\-]?\s*(\d{1,2})\s*월?\s*[.\-]?\s*(\d{1,2})\s*일?/);
    if (!m) return { bad: '형식을 알 수 없음' };
    var y = parseInt(m[1], 10), mo = parseInt(m[2], 10), dy = parseInt(m[3], 10);
    if (m[1].length <= 2) y = (y <= (new Date().getFullYear() % 100)) ? 2000 + y : 1900 + y;
    if (mo < 1 || mo > 12 || dy < 1 || dy > 31) return { bad: '월/일이 범위를 벗어남' };
    // 실제로 존재하는 날짜인지 확인 (예: 1961-02-29 는 없는 날 — 실제 파일에 있었음)
    var dt = new Date(y, mo - 1, dy);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== dy) return { bad: '달력에 없는 날짜' };
    return { ymd: y + '-' + pad2(mo) + '-' + pad2(dy), lunar: lunar, warn: both ? '양력·음력 표기가 함께 있음(양력으로 처리)' : '' };
  }

  // 엑셀 한 줄 → 교적 필드(한글 키. finance-api.js 의 GJ_MAP 이 Supabase 컬럼으로 바꿔줌)
  // 통합 명부의 항목은 되도록 전용 칸에 담고(비고·직장정보·세례상세·가족사항 등),
  // 정말 갈 곳이 없는 것만 특이사항에 남긴다.
  function rowToMember(row, col) {
    function v(name) { var i = col[name]; var x = (i == null) ? '' : row[i]; return String(x == null ? '' : x).trim(); }
    var name = v('이름'); if (!name) return null;
    var warns = [];
    var b = parseBirth(v('생년월일'));
    if (b && b.bad) { warns.push('생년월일 ' + b.bad + ' (' + v('생년월일') + ') → 비워둠'); b = null; }
    if (b && b.warn) warns.push(b.warn);
    if (!b) warns.push('생년월일 없음 — 헌금·계정 연결(매칭키)이 이름만으로 만들어집니다');

    var orgs = GJ_IMPORT_ORG.filter(function (g) { return /^O$/i.test(v(g)); });
    var notes = [];
    var bigo = v('비고'); if (bigo) notes.push(bigo.replace(/\s*\n\s*/g, ' / '));

    var fields = {
      '이름': name,
      '성별': v('남여'),
      '직책': v('교회직분'),
      '그룹': v('구역'),
      '휴대폰': fmtPhone(v('핸드폰')),
      '집전화': fmtPhone(v('전화번호')),
      '주소': v('주소'),
      '직장주소': v('직장주소'),
      '직장전화': fmtPhone(v('직장전화번호')),
      '소속그룹': orgs.join(', '),
      '가족사항': v('가족사항'),
      '특이사항': notes.join('\n')
    };
    if (b) { fields['생년월일'] = b.ymd; fields['음력생일'] = b.lunar; }
    // 구역직분: 값이 '2구역'처럼 구역명 그 자체인 행이 섞여 있어 그런 경우는 제외
    var gr = v('구역직분');
    if (gr && !/구역$/.test(gr)) fields['구역직분'] = gr;
    var orgRole = v('기관직책'); if (orgRole) fields['기관직책'] = orgRole;

    // 세례일시가 "1982년"·"유아세례"처럼 연도/메모뿐이라 날짜 칸에 못 넣어 원문 그대로 보존
    var bap = v('세례일시'), baptOk = /^O$/i.test(v('세례 여부'));
    if (bap || baptOk) {
      fields['세례여부'] = true;
      if (bap) fields['세례일메모'] = bap;
    }
    var receivedCh = v('받은교회'); if (receivedCh) fields['세례받은교회'] = receivedCh;
    var byWhom = v('집례자'); if (byWhom) fields['집례자'] = byWhom;

    var spouse = '';
    var famTxt = v('가족사항');
    var sm = famTxt.match(/배우자\s*[:：]\s*([^,\n\/]+)/);
    if (sm) spouse = sm[1].trim();

    return { name: name, fields: fields, spouse: spouse, warns: warns };
  }

  function renderImport(panel) {
    panel.innerHTML =
      '<div class="fin-card">' +
      '<h3 style="margin:0 0 6px;color:var(--accent,#223350)">📥 엑셀로 교적 업데이트</h3>' +
      '<p style="margin:0 0 12px;font-size:.88rem;color:var(--ink-soft,#7b8794)">' +
      '<b>교인 신상 통합 명부(.xlsx)</b>를 올리면 <b>교인기본정보</b> 시트를 읽어 교적에 반영합니다. ' +
      '올리자마자 저장되지 않고, <b>무엇이 새로 생기고 무엇이 바뀌는지 먼저 보여드린 뒤</b> 확인을 받습니다.</p>' +
      '<label class="btn btn-line" style="cursor:pointer;display:inline-block">＋ 엑셀 파일 선택' +
      '<input type="file" id="gi_file" accept=".xlsx" hidden></label>' +
      '<span class="fin-msg" id="gi_msg" style="margin-left:10px"></span>' +
      '</div><div id="gi_result"></div>';

    var msgEl = panel.querySelector('#gi_msg'), resEl = panel.querySelector('#gi_result');
    function msg(t, c) { msgEl.style.color = c || '#7b8794'; msgEl.textContent = t; }

    panel.querySelector('#gi_file').onchange = function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      if (!window.XlsxLite || !window.JSZip) { msg('엑셀 리더를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.', '#c0392b'); return; }
      msg('읽는 중…'); resEl.innerHTML = '';
      var parsed = null;
      window.XlsxLite.readSheet(f)
        .then(function (wb) {
          var idx = wb.sheetNames.indexOf('교인기본정보');
          if (idx < 0) throw new Error("'교인기본정보' 시트를 찾지 못했습니다. (시트: " + wb.sheetNames.join(', ') + ')');
          return wb.getSheetGrid(idx);
        })
        .then(function (grid) {
          var hdr = grid[1] || [];                       // 1행=제목, 2행=열이름, 3행부터 데이터
          var col = {};
          hdr.forEach(function (h, i) { var k = String(h == null ? '' : h).trim(); if (k) col[k] = i; });
          if (col['이름'] == null) throw new Error("2행에서 '이름' 열을 찾지 못했습니다.");
          parsed = [];
          for (var r = 2; r < grid.length; r++) {
            var mem = rowToMember(grid[r] || [], col);
            if (mem) parsed.push(mem);
          }
          if (!parsed.length) throw new Error('읽어들인 사람이 없습니다.');
          return WPF.call('listGyojeok');
        })
        .then(function (lr) {
          var existing = (lr.members || []).filter(function (m) { return m['이름']; });
          var byName = {};
          existing.forEach(function (m) { (byName[String(m['이름']).trim()] = byName[String(m['이름']).trim()] || []).push(m); });
          showPreview(parsed, byName, existing);
          msg('✓ ' + parsed.length + '명을 읽었습니다 — 아래에서 확인 후 반영하세요', 'green');
        })
        .catch(function (err) { msg('실패: ' + err.message, '#c0392b'); });
      e.target.value = '';
    };

    function showPreview(parsed, byName, existing) {
      var news = [], upds = [], sames = [], amb = [];
      parsed.forEach(function (p) {
        var hit = byName[p.name] || [];
        if (hit.length > 1) { amb.push(p); return; }         // 동명이인 — 사람이 골라야 함
        if (!hit.length) { news.push(p); return; }
        var cur = hit[0], changes = [];
        Object.keys(p.fields).forEach(function (k) {
          var nv = p.fields[k]; if (nv === '' || nv == null) return;   // 빈 값으로 기존 값을 지우지 않음
          var ov = cur[k];
          if (k === '음력생일') { if (!!ov !== !!nv) changes.push({ k: k, from: ov ? '음력' : '양력', to: nv ? '음력' : '양력' }); return; }
          var o = String(ov == null ? '' : ov).trim(), n = String(nv).trim();
          if (k === '생년월일') o = o.slice(0, 10);
          if (o !== n) changes.push({ k: k, from: o, to: n });
        });
        p.cur = cur;
        if (changes.length) { p.changes = changes; upds.push(p); } else sames.push(p);
      });

      var warnRows = parsed.filter(function (p) { return p.warns.length; });
      function esc2(s) { return esc(String(s == null ? '' : s)); }

      resEl.innerHTML =
        '<div class="fin-card"><h4 style="margin:0 0 10px;color:var(--accent)">확인해 주세요</h4>' +
        '<div style="display:flex;gap:18px;flex-wrap:wrap;font-size:.92rem;margin-bottom:12px">' +
        '<span>🆕 새로 등록 <b>' + news.length + '명</b></span>' +
        '<span>✏️ 정보 변경 <b>' + upds.length + '명</b></span>' +
        '<span>＝ 그대로 <b>' + sames.length + '명</b></span>' +
        (amb.length ? '<span style="color:#c0392b">⚠ 동명이인 <b>' + amb.length + '명</b>(건너뜀)</span>' : '') +
        (warnRows.length ? '<span style="color:#b8860b">⚠ 확인 필요 <b>' + warnRows.length + '건</b></span>' : '') +
        '</div>' +
        (amb.length ? '<p style="color:#c0392b;font-size:.86rem">교적에 같은 이름이 여러 명 있어 어느 분인지 자동으로 정할 수 없습니다: <b>' +
          amb.map(function (p) { return esc2(p.name); }).join(', ') + '</b> — 이 분들은 반영에서 제외되니 직접 수정해 주세요.</p>' : '') +
        (warnRows.length ?
          '<details style="margin-top:6px"><summary style="cursor:pointer;font-weight:600;color:#b8860b">⚠ 확인이 필요한 항목 ' + warnRows.length + '건 보기</summary>' +
          '<ul style="margin:8px 0 0 18px;font-size:.86rem;line-height:1.7">' +
          warnRows.map(function (p) { return '<li><b>' + esc2(p.name) + '</b> — ' + p.warns.map(esc2).join(' · ') + '</li>'; }).join('') +
          '</ul></details>' : '') +
        (upds.length ?
          '<details style="margin-top:10px" open><summary style="cursor:pointer;font-weight:600">✏️ 바뀌는 내용 ' + upds.length + '명 보기</summary>' +
          '<div style="overflow-x:auto;margin-top:8px"><table class="fin-table" style="font-size:.85rem"><thead><tr><th>이름</th><th>항목</th><th>지금</th><th>→ 바뀔 값</th></tr></thead><tbody>' +
          upds.map(function (p) {
            return p.changes.map(function (c, i) {
              return '<tr>' + (i === 0 ? '<td rowspan="' + p.changes.length + '"><b>' + esc2(p.name) + '</b></td>' : '') +
                '<td>' + esc2(c.k) + '</td><td style="color:#9aa5b1">' + (esc2(c.from) || '<i>없음</i>') + '</td><td><b>' + esc2(c.to) + '</b></td></tr>';
            }).join('');
          }).join('') + '</tbody></table></div></details>' : '') +
        (news.length ?
          '<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:600">🆕 새로 등록될 ' + news.length + '명 보기</summary>' +
          '<p style="margin:8px 0 0;font-size:.86rem;line-height:1.8">' + news.map(function (p) { return esc2(p.name); }).join(' · ') + '</p></details>' : '') +
        '<div style="margin-top:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
        '<button class="btn btn-solid" id="gi_apply" style="padding:10px 20px;font-weight:700">위 내용으로 반영하기</button>' +
        '<span class="fin-msg" id="gi_apply_msg"></span></div>' +
        '<p style="margin:10px 0 0;font-size:.8rem;color:#9aa5b1">※ 엑셀에서 <b>비어 있는 칸은 반영하지 않습니다</b>(기존 값을 지우지 않음). 이름이 같은 사람을 같은 분으로 봅니다.</p>' +
        '</div>';

      var applyMsg = resEl.querySelector('#gi_apply_msg');
      resEl.querySelector('#gi_apply').onclick = function () {
        var btn = this;
        if (!news.length && !upds.length) { applyMsg.style.color = '#7b8794'; applyMsg.textContent = '반영할 변경이 없습니다.'; return; }
        if (!confirm('새로 등록 ' + news.length + '명, 정보 변경 ' + upds.length + '명을 교적에 반영합니다.\n계속할까요?')) return;
        btn.disabled = true;
        var todo = [], done = 0, fail = [];
        news.forEach(function (p) { todo.push({ kind: 'add', p: p }); });
        upds.forEach(function (p) { todo.push({ kind: 'upd', p: p }); });
        function step(i) {
          if (i >= todo.length) {
            btn.disabled = false;
            applyMsg.style.color = fail.length ? '#c0392b' : 'green';
            applyMsg.textContent = '✓ ' + done + '건 반영' + (fail.length ? ' · 실패 ' + fail.length + '건: ' + fail.slice(0, 3).join(', ') : '');
            if (!fail.length) setTimeout(function () { tab = 'members'; render(); }, 1200);
            return;
          }
          applyMsg.style.color = '#7b8794';
          applyMsg.textContent = '반영 중… ' + (i + 1) + '/' + todo.length;
          var t = todo[i], pr;
          if (t.kind === 'add') {
            pr = WPF.call('addGyojeok', { name: t.p.name, birth: (t.p.fields['생년월일'] || '').replace(/-/g, ''), fields: t.p.fields });
          } else {
            pr = WPF.call('updateGyojeok', { id: t.p.cur['교적ID'], fields: t.p.fields });
          }
          pr.then(function () { done++; }).catch(function (e) { fail.push(t.p.name); console.warn('[교적 가져오기]', t.p.name, e); })
            .then(function () { step(i + 1); });
        }
        step(0);
      };
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
