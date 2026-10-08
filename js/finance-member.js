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
    if (!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY)) { box.hidden = true; return; }
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
      (pending ? '<p style="color:var(--accent-soft);font-size:.92rem;margin-bottom:12px;">현재 <b>준회원</b>입니다. 신청이 접수되어 운영진의 승인을 기다리고 있습니다. 이름이나 생년월일을 잘못 적으셨다면 아래에서 다시 신청할 수 있습니다.</p>' : '<p style="color:var(--ink-soft);font-size:.88rem;margin-bottom:12px;">교적에 등록된 이름과 생년월일을 적어 신청하시면, 운영진이 확인한 뒤 정회원으로 승인해 드립니다.</p>') +
      '<div class="form-grid">' +
      '  <div class="form-field"><label>이름</label><input type="text" id="mm_name" maxlength="40" placeholder="교적에 등록된 이름" /></div>' +
      '  <div class="form-field"><label>생년월일</label><input type="text" id="mm_birth" maxlength="10" placeholder="예: 1981-08-19" inputmode="numeric" /></div>' +
      '</div>' +
      '<div class="form-actions" style="margin-top:14px;display:flex;gap:10px;align-items:center;">' +
      '  <button type="button" class="btn btn-solid" id="mm_btn">교적 인증</button>' +
      '  <span class="profile-msg" id="mm_msg"></span>' +
      '</div>' +
      // 다른 교회 성도 — 특별 승인 신청(2026-10-08 목사님: 소속 교회·직분·추천인·연락처를 스스로 적게)
      '<div id="spBox" style="margin-top:18px;padding-top:14px;border-top:1px dashed var(--line,#e3e6ea)"></div>';
    drawSpecial(document.getElementById('spBox'));
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

  // ── 특별 승인 신청(우리 교회 교적에 없는 분) — supabase/special_apply_20261008.sql
  //    목사님이 고르신 것: 소속 교회·지역·교단·직분·추천인(노진교회에서 아는 분)·휴대폰(필수)·까닭.
  //    신청서는 목사님·관리자만 보고, 추천인으로 적힌 성도가 대시보드에서 '아는 분이 맞습니다'로 보증할 수 있다.
  var SP_OFFICES = ['성도', '집사', '안수집사', '권사', '장로', '전도사', '강도사', '목사', '사모', '선교사', '기타'];
  function drawSpecial(box) {
    if (!box) return;
    WPF.call('mySpecial').then(function (r) {
      var q = r.request;
      var head = '<p style="font-size:.92rem;margin:0 0 6px"><b>우리 교회 교적에 없는 분이신가요?</b></p>';
      if (q && q.status === 'pending') {
        box.innerHTML = head + '<p style="color:var(--accent-soft);font-size:.88rem;line-height:1.7;margin:0 0 10px">⏳ <b>특별 승인 신청</b>이 접수되어 확인을 기다리고 있습니다.<br>' +
          esc(q.church) + ' · ' + esc(q.office) + ' · 추천인 ' + esc(q.referrer) + '</p>' +
          '<button type="button" class="btn btn-line" id="sp_open" style="padding:8px 16px">신청서 고쳐서 다시 내기</button>';
      } else {
        box.innerHTML = head +
          (q && q.status === 'rejected' ? '<p style="color:#8a6d1f;font-size:.86rem;margin:0 0 8px">지난 신청은 승인되지 않았습니다. 담임목사님께 먼저 말씀하신 뒤 다시 신청해 주세요.</p>' : '') +
          '<p style="color:var(--ink-soft);font-size:.86rem;line-height:1.7;margin:0 0 10px">다른 교회 성도님도 <b>노진교회에서 아는 분(추천인)</b>이 있으면 <b>특별 승인</b>을 신청하실 수 있습니다. 담임목사님이 확인한 뒤 승인해 드립니다(1년마다 다시 확인).</p>' +
          '<button type="button" class="btn btn-line" id="sp_open" style="padding:8px 16px">특별 승인 신청하기</button>';
      }
      box.querySelector('#sp_open').onclick = openSpecialForm;
    }).catch(function () { box.innerHTML = ''; });
  }
  function openSpecialForm() {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:flex-start;justify-content:center;z-index:9999;padding:24px 14px;overflow:auto';
    var f = function (id, label, ph, extra) {
      return '<div class="form-field" style="margin-bottom:10px"><label for="' + id + '" style="font-weight:700">' + label + '</label>' +
        '<input type="text" id="' + id + '" placeholder="' + ph + '"' + (extra || '') + ' style="width:100%;padding:10px 12px;border:1px solid #dfe5ee;border-radius:8px;font:inherit" /></div>';
    };
    ov.innerHTML = '<div class="fin-card" style="max-width:480px;width:100%;background:#fff;margin:auto">' +
      '<h3 style="margin:0 0 6px;color:var(--accent,#1A3A2F)">특별 승인 신청</h3>' +
      '<p style="color:var(--ink-soft);font-size:.84rem;line-height:1.6;margin-bottom:12px">적어 주신 내용은 <b>담임목사님과 관리자만</b> 보고, 승인 여부를 확인하는 데만 씁니다. 승인되지 않으면 30일 뒤 지웁니다.</p>' +
      f('sp_name', '이름 (실명)', '예: 홍길동', ' maxlength="40"') +
      f('sp_church', '소속 교회', '예: ○○교회', ' maxlength="60"') +
      f('sp_region', '교회 지역 (시·군)', '예: 화성시 장안면', ' maxlength="40"') +
      f('sp_denom', '교단 (아시면)', '예: 예장 합동', ' maxlength="40"') +
      '<div class="form-field" style="margin-bottom:10px"><label for="sp_office" style="font-weight:700">직분</label><select id="sp_office" style="width:100%;padding:10px 12px;border:1px solid #dfe5ee;border-radius:8px;font:inherit"><option value="">고르세요</option>' +
        SP_OFFICES.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select></div>' +
      f('sp_ref', '노진교회에서 나를 아는 분 (추천인)', '예: 노진교회 성도 이름', ' maxlength="40"') +
      f('sp_phone', '휴대폰 번호', '예: 010-1234-5678', ' maxlength="13" inputmode="tel"') +
      '<div class="form-field" style="margin-bottom:10px"><label for="sp_reason" style="font-weight:700">신청하는 까닭 (짧게)</label><textarea id="sp_reason" rows="2" maxlength="200" placeholder="예: 수요예배에 함께 참석하고 있습니다" style="width:100%;padding:10px 12px;border:1px solid #dfe5ee;border-radius:8px;font:inherit"></textarea></div>' +
      '<p class="help" id="sp_msg" style="min-height:1.2em;margin:4px 0 8px;color:#c0392b"></p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="btn btn-line" id="sp_cancel" style="min-height:44px;padding:8px 18px">취소</button>' +
      '<button type="button" class="btn btn-solid" id="sp_send" style="min-height:44px;padding:8px 22px">신청하기</button></div></div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); }
    function v(id) { return (ov.querySelector('#' + id).value || '').trim(); }
    ov.querySelector('#sp_cancel').onclick = close;
    ov.querySelector('#sp_send').onclick = function () {
      var msgEl = ov.querySelector('#sp_msg'), btn = this;
      var d = { name: v('sp_name'), church: v('sp_church'), region: v('sp_region'), denomination: v('sp_denom'), office: v('sp_office'),
                referrer: v('sp_ref'), phone: v('sp_phone'), reason: v('sp_reason') };
      if (!d.name || !d.church || !d.region || !d.office || !d.referrer) { msgEl.textContent = '이름·소속 교회·지역·직분·추천인을 모두 적어 주세요.'; return; }
      if (!/^01[016789]\d{7,8}$/.test(d.phone.replace(/\D/g, ''))) { msgEl.textContent = '휴대폰 번호를 정확히 적어 주세요(예: 010-1234-5678).'; return; }
      btn.disabled = true; msgEl.style.color = 'var(--ink-soft)'; msgEl.textContent = '보내는 중…';
      WPF.call('submitSpecial', d).then(function () {
        close();
        drawSpecial(document.getElementById('spBox'));
        if (window.showFlash) window.showFlash('특별 승인 신청을 보냈습니다');
      }).catch(function (e) { btn.disabled = false; msgEl.style.color = '#c0392b'; msgEl.textContent = e.message; });
    };
    setTimeout(function () { var n = ov.querySelector('#sp_name'); if (n) n.focus(); }, 50);
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
          '<h3 style="margin:0 0 10px;font-size:1rem;color:var(--accent,#1A3A2F);">📚 현재 수강 중인 교육</h3>' +
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
            '<a href="#" class="my-mat-dl" data-path="' + esc(r.path) + '" data-title="' + esc(r.title) + '" style="color:var(--accent,#1A3A2F)">다운로드</a></div>';
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
