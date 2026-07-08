/* finance-member.js — 내 정보(admin.html)의 "교적 인증 · 진행중인 교육" 섹션
 * 로그인한 회원이 이름+생년월일로 교적 인증(정/준회원).
 * 헌금 내역·가계도는 대시보드(dashboard.html)로 이동되었습니다.
 * 콘솔: [finance-member.js] v20260701dj
 */
console.log('[finance-member.js] v20260701dj');

(function () {
  var box = document.getElementById('offeringBox');
  var body = document.getElementById('offeringBody');
  if (!box || !body) return;

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // 로그인 토큰이 준비될 때까지 잠깐 대기(auth.js 로딩 시차)
  var tries = 0;
  function waitLogin() {
    if (!window.FINANCE_API_URL) { box.hidden = true; return; }
    if (window.WPF && WPF.token()) { box.hidden = false; loadMe(); return; }
    if (tries++ < 20) { setTimeout(waitLogin, 400); return; }
    box.hidden = true; // 끝내 비로그인 → 섹션 숨김
  }

  function loading(msg) { body.innerHTML = '<p class="qt-loading">' + esc(msg || '확인 중입니다…') + '</p>'; }
  function errBox(msg) {
    body.innerHTML = '<p style="color:var(--accent-soft);font-size:.9rem;">' + esc(msg) + '</p>';
    var b = document.createElement('button');
    b.className = 'btn btn-line'; b.textContent = '다시 시도'; b.style.marginTop = '10px';
    b.onclick = loadMe; body.appendChild(b);
  }

  function loadMe() {
    loading();
    WPF.call('me').then(function (me) {
      if (me.status === '정회원') renderMember(me);
      else renderMatchForm(me);
    }).catch(function (e) { errBox('불러오기에 실패했습니다: ' + e.message); });
  }

  // 준회원/미인증 → 인증 폼
  function renderMatchForm(me) {
    var pending = me.status === '준회원' && me.memberName;
    body.innerHTML =
      (pending ? '<p style="color:var(--accent-soft);font-size:.92rem;margin-bottom:12px;">현재 <b>준회원</b>입니다. 교적에서 자동 인증되지 않아 관리자 승인을 기다리고 있거나, 아래에서 다시 인증할 수 있습니다.</p>' : '') +
      '<div class="form-grid">' +
      '  <div class="form-field"><label>이름</label><input type="text" id="mm_name" maxlength="40" placeholder="교적에 등록된 이름" /></div>' +
      '  <div class="form-field"><label>생년월일</label><input type="text" id="mm_birth" maxlength="10" placeholder="예: 1981-08-19" inputmode="numeric" /></div>' +
      '</div>' +
      '<div class="form-actions" style="margin-top:14px;display:flex;gap:10px;align-items:center;">' +
      '  <button type="button" class="btn btn-solid" id="mm_btn">교적 인증</button>' +
      '  <span class="profile-msg" id="mm_msg"></span>' +
      '</div>';
    document.getElementById('mm_btn').onclick = function () {
      var name = document.getElementById('mm_name').value.trim();
      var birth = document.getElementById('mm_birth').value.replace(/[^0-9]/g, '');
      var msg = document.getElementById('mm_msg');
      if (!name || birth.length !== 8) { msg.textContent = '이름과 생년월일 8자리를 정확히 입력하세요.'; msg.style.color = 'var(--accent-soft)'; return; }
      msg.style.color = 'var(--ink-soft)'; msg.textContent = '확인 중…';
      WPF.call('match', { name: name, birth: birth }).then(function (r) {
        if (r.status === '정회원') { msg.style.color = 'green'; msg.textContent = '✓ 정회원 인증 완료'; setTimeout(loadMe, 700); }
        else { msg.style.color = 'var(--accent-soft)'; msg.textContent = r.message || '교적에서 일치하는 정보를 찾지 못했습니다.'; }
      }).catch(function (e) { msg.style.color = 'var(--accent-soft)'; msg.textContent = '오류: ' + e.message; });
    };
  }

  // 정회원 → 대시보드 안내 + 진행중인 교육
  function renderMember(me) {
    body.innerHTML =
      '<p style="font-size:.95rem;margin-bottom:14px;">✓ <b>정회원</b>' + (me.memberName ? ' · ' + esc(me.memberName) + '님' : '') + '</p>' +
      '<p style="font-size:.88rem;color:var(--ink-soft);margin-bottom:14px;">헌금 내역·가계도·오늘의 큐티 등은 <b>대시보드</b>에서 확인하실 수 있습니다.</p>' +
      '<div id="myEdu"></div>';
    var a = document.createElement('a');
    a.className = 'btn btn-solid'; a.href = 'dashboard.html'; a.textContent = '대시보드로 이동 →';
    a.style.marginTop = '4px'; a.style.marginBottom = '18px'; a.style.display = 'inline-block';
    body.insertBefore(a, document.getElementById('myEdu'));
    if (me.canFinance) {
      var f = document.createElement('a');
      f.className = 'btn btn-line'; f.href = 'finance.html'; f.textContent = '재정관리 페이지로 이동 →';
      f.style.marginTop = '4px'; f.style.marginLeft = '8px'; f.style.display = 'inline-block';
      body.insertBefore(f, document.getElementById('myEdu'));
    }
    loadMyEdu(me);
  }

  // ── 현재 수강 중인 교육 + 강의 자료실(본인이 참석자로 등록된 경우만 RLS로 조회됨) ──
  function todayStr() { var d = new Date(); function p(n) { return ('0' + n).slice(-2); } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function fmtSize(n) { if (!n && n !== 0) return ''; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(0) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }
  function eduLabel(r) { return esc(r.title) + (r.cohort ? ' · ' + esc(r.cohort) : '') + (r.class_name ? ' · ' + esc(r.class_name) : ''); }
  function loadMyEdu(me) {
    var el = document.getElementById('myEdu'); if (!el) return;
    var url = window.SUPABASE_URL, ak = window.SUPABASE_ANON_KEY, tok = (window.WPF && WPF.token && WPF.token());
    if (!url || !ak || !tok) return;
    var t = todayStr();
    fetch(url + '/rest/v1/edu_records?select=id,title,cohort,class_name,edu_date,end_date,teacher&edu_date=lte.' + t, { headers: { apikey: ak, Authorization: 'Bearer ' + tok } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var ongoing = (rows || []).filter(function (r) { return !r.end_date || r.end_date >= t; });
        if (!ongoing.length) { el.innerHTML = ''; return; }
        el.innerHTML = '<div class="form-card" style="margin-bottom:18px;padding:16px 18px;">' +
          '<h3 style="margin:0 0 10px;font-size:1rem;color:var(--accent,#032257);">📚 현재 수강 중인 교육</h3>' +
          ongoing.map(function (r) {
            return '<div class="my-edu-item" data-id="' + esc(r.id) + '" style="border:1px solid #e8edf3;border-radius:10px;padding:10px 12px;margin-bottom:8px;">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" class="my-edu-head">' +
              '<b style="font-size:.92rem">' + eduLabel(r) + '</b>' +
              '<span style="font-size:.78rem;color:#9aa5b1">' + esc(r.teacher || '') + ' ▾</span></div>' +
              '<div class="my-edu-body" hidden style="margin-top:8px;font-size:.83rem"></div></div>';
          }).join('') + '</div>';
        Array.prototype.forEach.call(el.querySelectorAll('.my-edu-item'), function (box) {
          var head = box.querySelector('.my-edu-head'), bodyEl = box.querySelector('.my-edu-body');
          var loaded = false;
          head.onclick = function () {
            bodyEl.hidden = !bodyEl.hidden;
            if (!bodyEl.hidden && !loaded) { loaded = true; loadMyEduMaterials(box.dataset.id, bodyEl, tok, url, ak); }
          };
        });
      })
      .catch(function () { el.innerHTML = ''; });
  }
  function loadMyEduMaterials(eduId, bodyEl, tok, url, ak) {
    bodyEl.innerHTML = '<p class="qt-loading">자료 불러오는 중…</p>';
    fetch(url + '/rest/v1/edu_materials?edu_id=eq.' + eduId + '&select=*&order=created_at.desc', { headers: { apikey: ak, Authorization: 'Bearer ' + tok } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        rows = rows || [];
        if (!rows.length) { bodyEl.innerHTML = '<p style="color:#9aa5b1">등록된 자료가 없습니다.</p>'; return; }
        bodyEl.innerHTML = rows.map(function (r) {
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-top:1px solid #f0f3f7">' +
            '<span>📎 ' + esc(r.title) + (r.size ? ' <span style="color:#9aa5b1;font-size:.76rem">· ' + fmtSize(r.size) + '</span>' : '') + '</span>' +
            '<a href="#" class="my-mat-dl" data-path="' + esc(r.path) + '" data-title="' + esc(r.title) + '" style="color:var(--accent,#032257)">다운로드</a></div>';
        }).join('');
        Array.prototype.forEach.call(bodyEl.querySelectorAll('.my-mat-dl'), function (a) {
          a.onclick = function (e) {
            e.preventDefault(); var old = a.textContent; a.textContent = '준비 중…';
            fetch(url + '/storage/v1/object/sign/edu_materials/' + a.dataset.path.split('/').map(encodeURIComponent).join('/'), {
              method: 'POST', headers: { apikey: ak, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 })
            }).then(function (r) { return r.json(); }).then(function (d) {
              a.textContent = old;
              if (!d || !d.signedURL) { alert('다운로드 오류: ' + (d && d.message || '알 수 없는 오류')); return; }
              window.open(url + '/storage/v1' + d.signedURL + '&download=' + encodeURIComponent(a.dataset.title || ''), '_blank');
            }).catch(function (err) { a.textContent = old; alert('다운로드 오류: ' + err.message); });
          };
        });
      })
      .catch(function () { bodyEl.innerHTML = '<p style="color:#9aa5b1">자료를 불러오지 못했습니다.</p>'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitLogin);
  else waitLogin();
})();
