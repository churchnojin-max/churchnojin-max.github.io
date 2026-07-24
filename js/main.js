// ============================================================
//  ○○교회 홈페이지 스크립트
// ============================================================

// ===== 1. 말씀(설교) 카드 덱: 최대 4주 · 3D 회전 전환 =====
const WEEKS = BULLETINS.slice(0, 4); // 최근 4주만 표기
const sermonDeck = document.getElementById("sermonDeck");
const sermonSide = document.getElementById("sermonSide");
const sermonDots = document.getElementById("sermonDots");
const sermonNewer = document.getElementById("sermonNewer");
const sermonOlder = document.getElementById("sermonOlder");
let active = 0; // 0 = 이번 주(최신)

const SERMON_YOUTUBE_URL = "https://www.youtube.com/@노진교회";

function cardInner(b, i) {
  return `
    <div class="sermon-meta">
      <span class="sermon-date">${b.dateLabel} · 주일 낮 예배</span>
      <h3 class="sermon-title">${b.title}</h3>
      <p class="sermon-ref">${b.scripture}</p>
      <p class="sermon-preacher">
        설교 · ${b.preacher}
        <a href="${SERMON_YOUTUBE_URL}" target="_blank" rel="noopener" class="sermon-yt-link">▶ 유튜브로 듣기</a>
      </p>
    </div>
    <blockquote class="sermon-quote">${b.quote}</blockquote>
    <div class="sermon-actions">
      <button type="button" class="sermon-listen-btn" data-i="${i}">🔊 음성으로 듣기</button>
      ${b.summary ? `<span class="sermon-more">설교 요약 보기 →</span>` : ""}
    </div>`;
}

function renderSide(b) {
  sermonSide.innerHTML = `
    <div class="side-card">
      <span class="side-tag">수요기도회</span>
      <p>${b.wed.replace(/^수요기도회 · /, "")}</p>
    </div>
    <div class="side-card">
      <span class="side-tag">새벽기도회</span>
      <p>${b.dawn.replace(/^새벽기도회 · /, "")}</p>
    </div>`;
}

function layoutDeck() {
  [...sermonDeck.children].forEach((card) => {
    const i = Number(card.dataset.i);
    const d = i - active; // d>0: 지나간(과거) 주, d<0: 이후 주
    const ad = Math.abs(d);
    card.style.zIndex = String(50 - ad);
    if (d === 0) {
      card.style.transform = "translate(0,0) scale(1) rotateY(0deg)";
      card.style.opacity = "1";
      card.classList.add("is-active");
    } else {
      const dir = d > 0 ? 1 : -1;
      card.style.transform =
        `translateX(${dir * (30 + (ad - 1) * 10)}px) translateY(${ad * 16}px) ` +
        `scale(${1 - ad * 0.05}) rotateY(${dir * -14}deg)`;
      card.style.opacity = String(Math.max(0.06, 0.32 - (ad - 1) * 0.11));
      card.classList.remove("is-active");
    }
  });
  [...sermonDots.children].forEach((dot, i) => dot.classList.toggle("active", i === active));
  sermonNewer.classList.toggle("disabled", active <= 0);
  sermonOlder.classList.toggle("disabled", active >= WEEKS.length - 1);
  renderSide(WEEKS[active]);
}

function buildDeck() {
  sermonDeck.innerHTML = WEEKS.map(
    (b, i) => `<article class="sermon-feature deck-card" data-i="${i}">${cardInner(b, i)}</article>`
  ).join("");
  sermonDots.innerHTML = WEEKS.map(
    (_, i) => `<button class="sdot" data-i="${i}" aria-label="${i + 1}주 전 말씀"></button>`
  ).join("");
  layoutDeck();
}

function goSermon(delta) {
  const n = Math.min(WEEKS.length - 1, Math.max(0, active + delta));
  if (n === active) return;
  active = n;
  layoutDeck();
}

if (sermonDeck) {
  buildDeck();
  sermonNewer.addEventListener("click", () => goSermon(-1)); // 이번 주 방향
  sermonOlder.addEventListener("click", () => goSermon(1)); // 지난 주 방향
  sermonDots.addEventListener("click", (e) => {
    const dot = e.target.closest(".sdot");
    if (dot) { active = Number(dot.dataset.i); layoutDeck(); }
  });

  // 모바일: 좌우 스와이프(손으로 밀기)로 카드 넘기기
  let touchStartX = 0, touchStartY = 0, swiped = false;
  sermonDeck.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    touchStartX = t.clientX; touchStartY = t.clientY; swiped = false;
  }, { passive: true });
  sermonDeck.addEventListener("touchend", (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    // 가로 이동이 충분하고 세로(스크롤)보다 클 때만 카드 전환
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      swiped = true;
      goSermon(dx < 0 ? 1 : -1); // 왼쪽으로 밀면 지난 주, 오른쪽으로 밀면 이번 주
    }
  }, { passive: true });

  // 카드 클릭(탭): 활성 카드 → 설교 요약 열기 / 뒤 카드 → 앞으로 가져오기
  sermonDeck.addEventListener("click", (e) => {
    if (swiped) { swiped = false; return; } // 스와이프 동작은 탭으로 처리하지 않음
    const listenBtn = e.target.closest(".sermon-listen-btn");
    if (listenBtn) {
      const b = WEEKS[Number(listenBtn.dataset.i)];
      const text = (b && (b.summary || b.quote)) || "";
      if (text && window.WPCTts) window.WPCTts.toggle(text, listenBtn, "🔊 음성으로 듣기");
      return;
    }
    if (e.target.closest(".sermon-yt-link")) return; // 새 탭으로 이동(기본 링크 동작)만 하고 카드 전환은 막음
    const card = e.target.closest(".deck-card");
    if (!card) return;
    const i = Number(card.dataset.i);
    if (card.classList.contains("is-active")) {
      openSermonSummary(i);
    } else {
      active = i;
      layoutDeck();
    }
  });
}

// ===== 1-2. 섬기는 사람들 + 이 달의 봉사위원 (홈페이지 설정/DB 우선, 없으면 하드코딩) =====
(function () {
  const escH = (t) => String(t == null ? "" : t).replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]));
  const now = new Date();
  const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 월 항목을 {label, roles:[{role,names}]} 표준형으로 변환
  function monLabel(ym) { const mm = (ym || "").split("-")[1]; return mm ? Number(mm) + "월" : ""; }
  function normMonth(m) {
    if (!m) return null;
    if (Array.isArray(m.roles)) return { label: m.label || monLabel(m.month), roles: m.roles.filter((r) => r && r.names) };
    // 교회행정(DB) 형태: offering(헌금위원)/guide(안내위원)/parking(주차·사찰)
    const roles = [];
    if (m.offering) roles.push({ role: "헌금위원", names: m.offering });
    if (m.guide) roles.push({ role: "안내위원", names: m.guide });
    if (m.parking) roles.push({ role: "주차 · 사찰", names: m.parking });
    return { label: m.label || monLabel(m.month), roles };
  }
  function pickCurrent(list) {
    if (!list || !list.length) return null;
    const sorted = [...list].sort((a, b) => (a.month < b.month ? 1 : -1));
    return sorted.find((x) => x.month === curYM) || sorted.find((x) => x.month <= curYM) || sorted[0];
  }
  function renderCommittee(monthItem) {
    const box = document.getElementById("committee");
    if (!box) return;
    const c = normMonth(monthItem);
    if (!c || !c.roles.length) { box.innerHTML = ""; return; }
    box.innerHTML = `
      <div class="committee-head">
        <span class="w-en light">SERVICE TEAM</span>
        <h4>${escH(c.label)} 봉사위원</h4>
      </div>
      <div class="committee-rows">
        ${c.roles.map((r) => `<div class="committee-item"><span class="c-role">${escH(r.role)}</span><p class="c-names">${escH(r.names)}</p></div>`).join("")}
      </div>`;
  }

  // 봉사위원: DB(교회행정 통합) 우선, 없으면 하드코딩 COMMITTEES 폴백
  const hardcoded = (typeof COMMITTEES !== "undefined" && COMMITTEES.length) ? COMMITTEES : null;
  if (document.getElementById("committee")) {
    if (window.SiteSettings) {
      window.SiteSettings.committees()
        .then((data) => {
          const months = data && data.months;
          if (months && months.length) renderCommittee(pickCurrent(months));
          else if (hardcoded) renderCommittee(pickCurrent(hardcoded));
        })
        .catch(() => { if (hardcoded) renderCommittee(pickCurrent(hardcoded)); });
    } else if (hardcoded) {
      renderCommittee(pickCurrent(hardcoded));
    }
  }

  // 섬기는 사람들: 설정값이 있으면 카드/행/기관부서 덮어쓰기(없으면 HTML 하드코딩 유지)
  if (window.SiteSettings && document.getElementById("servantCards")) {
    const rowsHtml = (arr) => arr
      .filter((r) => r && (r.label || r.names))
      .map((r) => `<div class="servant-row"><span class="row-label">${escH(r.label)}</span><span class="row-names">${escH(r.names)}</span></div>`)
      .join("");
    window.SiteSettings.homepage().then((hp) => {
      const s = hp && hp.servants;
      if (!s) return;
      if (Array.isArray(s.cards) && s.cards.length) {
        document.getElementById("servantCards").innerHTML = s.cards
          .map((c) => `<div class="servant-card${c.highlight ? " highlight" : ""}"><span class="role">${escH(c.role)}</span><span class="name">${escH(c.name) || "○○○"}</span></div>`)
          .join("");
      }
      if (Array.isArray(s.rows)) { const el = document.getElementById("servantRows"); if (el) el.innerHTML = rowsHtml(s.rows); }
      if (Array.isArray(s.org)) { const el = document.getElementById("servantOrg"); if (el) el.innerHTML = rowsHtml(s.org); }
    });
  }
})();

// ===== 공용 TTS(글 읽어주기) — 브라우저 내장 Web Speech(무료). 한국어 목소리 자동 선택 =====
// 긴 글은 문장 단위로 나눠 순차 재생(크롬의 긴 발화 끊김 버그 회피). window.WPCTts.toggle/stop 로 사용.
var WPCTts = (function () {
  var synth = window.speechSynthesis || null;
  var btnEl = null, btnLabel = "🔊 들어주기", active = false, gen = 0;
  var audio = null, queue = [], idx = 0, cache = {};
  // ── 낭독 따라 읽기: 본문 문단(줄) 하이라이트 ──
  //   AI 음성엔 단어별 타임스탬프가 없어, 오디오 진행도(현재시간/전체길이)를 문단 글자수 비율에
  //   맞춰 '지금 읽는 줄'을 추정해 표시한다. 문단마다 속도가 달라 약간의 오차는 있다.
  var hiEls = [], hiCum = [], hiIdx = -1, hiStart = 0;
  function setHiStyle(el, on) {
    if (!el) return;
    el.style.transition = "background-color .25s ease, box-shadow .25s ease";
    el.style.background = on ? "rgba(249,222,116,.5)" : "";
    el.style.borderRadius = on ? "6px" : "";
    el.style.boxShadow = on ? "0 0 0 5px rgba(249,222,116,.5)" : "";
  }
  function clearHi() { if (hiIdx >= 0) setHiStyle(hiEls[hiIdx], false); hiIdx = -1; }
  // 낭독 '시간'을 근사하는 가중치: 글자수(절 번호 제외) + 문장끝·줄바꿈마다 쉼 시간 보정.
  //   성경 본문은 짧은 절이 많아 쉼이 잦으므로, 글자수만 세면 하이라이트가 그만큼 앞서 나간다.
  var HI_PAUSE_W = 3;      // 쉼 1회(문장끝/줄바꿈) ≈ 가상 글자수
  var HI_INTRO_BONUS = 24; // 제목·구절 소개(구절을 길게 풀어 읽는 시간) 보정
  function lineWeight(s) {
    s = String(s || "");
    var chars = s.replace(/^\s*\d+\s+/gm, "").replace(/\s+/g, "").length;   // 절 번호(줄 앞 숫자) 제외
    var pauses = (s.match(/[.!?。…\n]/g) || []).length;                      // 문장끝·줄바꿈 = 쉼
    return Math.max(1, chars) + pauses * HI_PAUSE_W;
  }
  function buildHi(trackEl, preText) {
    clearHi(); hiEls = []; hiCum = []; hiStart = 0;
    if (!trackEl) return;
    var els = trackEl.querySelectorAll(".qt-d-head, .qt-d-sec p, .qtc-head, .qtc-verse, .qtc-body p, [data-tts-line]");
    var lens = [], total = 0;
    Array.prototype.forEach.call(els, function (el) {
      var L = lineWeight(el.textContent);
      lens.push(L); total += L; hiEls.push(el);
    });
    // 본문(줄)보다 먼저 음성이 읽는 '제목·성경 구절' 분량(+길게 풀어 읽는 시간) → 그만큼 시작을 늦춘다
    var preLen = preText ? (lineWeight(preText) + HI_INTRO_BONUS) : 0;
    total += preLen;
    hiStart = total ? preLen / total : 0;
    var acc = preLen; for (var i = 0; i < lens.length; i++) { acc += lens[i]; hiCum.push(acc / total); }
  }
  function setHi(i) {
    if (i === hiIdx || i < 0 || i >= hiEls.length) return;
    if (hiIdx >= 0) setHiStyle(hiEls[hiIdx], false);
    hiIdx = i; setHiStyle(hiEls[i], true);
    try { hiEls[i].scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
  }
  function hiFrac(frac) {
    if (!hiEls.length || !isFinite(frac)) return;
    if (frac < hiStart) { if (hiIdx !== -1) clearHi(); return; }   // 제목·구절 소개 구간엔 아직 표시 안 함
    var i = 0; while (i < hiCum.length - 1 && frac > hiCum[i]) i++;
    setHi(i);
  }
  // ── 기본 음성(브라우저, AI 실패 시 대체) ──
  function koVoice() {
    if (!synth) return null;
    var vs = synth.getVoices() || [];
    return vs.filter(function (v) { return /^ko/i.test(v.lang || ""); }).sort(function (a, b) {
      var s = function (v) { return /google|natural|neural|premium|yuna|siwoo|heami/i.test(v.name || "") ? 1 : 0; };
      return s(b) - s(a);
    })[0] || null;
  }
  function chunk(text) {
    var s = String(text).replace(/\s+/g, " ").trim();
    var sents = s.match(/[^.!?。…\n]+[.!?。…]?/g) || [s];
    var out = [], buf = "";
    sents.forEach(function (x) { x = x.trim(); if (!x) return; if ((buf + " " + x).length > 180) { if (buf) out.push(buf); buf = x; } else buf = buf ? buf + " " + x : x; });
    if (buf) out.push(buf);
    return out.length ? out : [s];
  }
  function browserNext(myGen) {
    if (!active || myGen !== gen) return;
    if (idx >= queue.length) { reset(); return; }
    if (queue.length) hiFrac(idx / queue.length);   // 기본 음성: 문장 순번으로 대략 따라 읽기 표시
    var u = new SpeechSynthesisUtterance(queue[idx]);
    u.lang = "ko-KR"; var v = koVoice(); if (v) u.voice = v; u.rate = 0.98; u.pitch = 1.0;
    u.onend = function () { idx++; browserNext(myGen); };
    u.onerror = function () { idx++; browserNext(myGen); };
    synth.speak(u);
  }
  function browserStart(text, myGen) {
    if (!synth) { reset(); return; }
    hideBar();                                  // 기본 음성은 탐색 불가 → 재생바 숨김
    queue = chunk(text); idx = 0;
    if (btnEl && myGen === gen) btnEl.textContent = "⏸ 멈춤 (기본 음성)";
    browserNext(myGen);
  }
  // 낭독 텍스트의 짧은 지문(내용이 바뀌면 값도 바뀜) — 저장 파일명에 넣어 옛 음성 재사용을 막는다
  function textSig(s) { var h = 2166136261 >>> 0; s = String(s || ""); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
  function ttsBase() { var sb = (window.SUPABASE_URL || "").replace(/\/$/, ""); return sb + "/storage/v1/object/public/tts-cache/"; }
  // ── AI 음성(Gemini TTS via Edge Function) ──
  function aiFetch(text, date, sig) {
    var ak = window.SUPABASE_ANON_KEY, sb = (window.SUPABASE_URL || "").replace(/\/$/, "");
    if (!ak || !sb) return Promise.reject(new Error("no-config"));
    var tok = (window.WPF && WPF.token && WPF.token()) || ak;
    var payload = { text: text };
    if (date) { payload.date = date; if (sig) payload.sig = sig; }
    return fetch(sb + "/functions/v1/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ak, Authorization: "Bearer " + tok },
      body: JSON.stringify(payload)
    }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || ("HTTP " + r.status)); }); return r.blob(); });
  }
  // ── 재생바(진행 표시 + 탐색) ── AI 음성(오디오)만 해당. 기본 음성은 탐색 불가라 숨김.
  var barWrap = null, seekEl = null, timeEl = null, userSeeking = false;
  function fmtT(s) { s = Math.max(0, Math.floor(s || 0)); var m = Math.floor(s / 60), ss = s % 60; return m + ":" + (ss < 10 ? "0" : "") + ss; }
  function ensureBar() {
    if (barWrap) return barWrap;
    barWrap = document.createElement("div");
    barWrap.style.cssText = "display:flex;align-items:center;gap:9px;margin:10px 0 2px;max-width:520px";
    seekEl = document.createElement("input");
    seekEl.type = "range"; seekEl.min = "0"; seekEl.max = "1000"; seekEl.value = "0"; seekEl.step = "1";
    seekEl.setAttribute("aria-label", "낭독 위치 이동");
    seekEl.style.cssText = "flex:1;height:6px;cursor:pointer;accent-color:#2f5d3a";
    timeEl = document.createElement("span");
    timeEl.style.cssText = "font-size:.8rem;color:#7b8794;font-variant-numeric:tabular-nums;white-space:nowrap;min-width:84px;text-align:right";
    timeEl.textContent = "0:00 / 0:00";
    barWrap.appendChild(seekEl); barWrap.appendChild(timeEl);
    function applySeek() { if (audio && audio.duration) { audio.currentTime = (Number(seekEl.value) / 1000) * audio.duration; updateBar(); } }
    seekEl.addEventListener("input", function () { userSeeking = true; applySeek(); });
    seekEl.addEventListener("change", function () { applySeek(); userSeeking = false; });
    seekEl.addEventListener("pointerup", function () { userSeeking = false; });
    return barWrap;
  }
  function updateBar() {
    if (!audio || !timeEl) return;
    var d = audio.duration || 0, c = audio.currentTime || 0;
    timeEl.textContent = fmtT(c) + " / " + (isFinite(d) && d ? fmtT(d) : "0:00");
    if (seekEl && !userSeeking && d) seekEl.value = String(Math.round(c / d * 1000));
  }
  function showBar() {   // 현재 버튼 바로 아래에 배치
    ensureBar();
    if (btnEl && btnEl.parentNode) btnEl.parentNode.insertBefore(barWrap, btnEl.nextSibling);
    barWrap.style.display = "flex";
    if (seekEl) seekEl.value = "0";
    updateBar();
  }
  function hideBar() { if (barWrap && barWrap.parentNode) barWrap.parentNode.removeChild(barWrap); userSeeking = false; }
  // 스트리밍본·생성본 공통 재생: 하이라이트·재생바까지 함께 연결
  function bindAndPlay(a, myGen) {
    audio = a;
    audio.playbackRate = 1.08;                          // 10% 느리게
    try { audio.preservesPitch = true; } catch (e) {}   // 음정 유지
    audio.onended = function () { if (myGen === gen) reset(); };
    audio.onerror = function () { if (myGen === gen) reset(); };
    audio.onloadedmetadata = function () { updateBar(); };
    audio.ontimeupdate = function () { if (myGen === gen && audio && audio.duration) { hiFrac(audio.currentTime / audio.duration); updateBar(); } };
    showBar();
    if (btnEl) btnEl.textContent = "⏸ 낭독 멈춤";
    audio.play().catch(function () { });
  }
  function playAudio(url, myGen) {   // blob URL 재생(생성본)
    if (!active || myGen !== gen) return;
    stopAudio();
    bindAndPlay(new Audio(url), myGen);
  }
  function stopAudio() { if (audio) { try { audio.pause(); } catch (e) {} try { audio.onerror = audio.oncanplay = audio.onended = audio.ontimeupdate = audio.onloadedmetadata = null; } catch (e) {} audio = null; } }
  function reset() { active = false; clearHi(); hideBar(); if (btnEl) btnEl.textContent = btnLabel; }
  function start(text, btn, label, opts) {
    stop();
    btnEl = btn || null; btnLabel = label || "🔊 들어주기"; active = true;
    var myGen = ++gen;
    if (btnEl) btnEl.textContent = "⏳ 음성 준비 중…";
    var date = (opts && opts.date) || null;
    var sig = date ? textSig(text) : null;   // 내용 지문(내용 바뀌면 파일명도 바뀜 → 옛 음성 안 씀)
    // ① 저장본 후보: 지문이 있으면 '내용 일치 파일'만(qt-<날짜>-<지문>.wav) — 내용이 바뀌면 새로 생성.
    //    지문이 없을 때만 미리 만든 로컬 음성(mp3/wav) 후보를 쓴다.
    var cands = sig ? [ttsBase() + "qt-" + date + "-" + sig + ".wav"]
                    : ((opts && opts.preUrls && opts.preUrls.length) ? opts.preUrls.slice() : []);
    buildHi(opts && opts.trackEl, opts && opts.preText);   // 따라 읽기 줄 목록 + 앞부분(제목·구절) 분량
    // ① 저장된 음원 후보를 실제로 로드 시도 → 존재하면 바로 재생(스트리밍)
    //    HEAD 확인은 일부 모바일에서 불안정하므로, 오디오 요소 로드 성공(=존재) 여부로 판단한다.
    (function tryStream(i) {
      if (!active || myGen !== gen) return;
      if (i >= cands.length) { doGenerate(); return; }   // 후보 모두 없음 → 생성
      var a = new Audio();
      a.preload = "auto";
      a.playbackRate = 1.08;                              // 10% 느리게
      try { a.preservesPitch = true; } catch (e) {}
      var moved = false;
      function nextOne() { if (moved) return; moved = true; try { a.pause(); } catch (e) {} tryStream(i + 1); }
      a.onerror = nextOne;                                // 파일 없음/로드 실패 → 다음 후보
      a.oncanplay = function () {                         // 로드 성공(=저장본 존재) → 이 음원을 재생
        if (moved) return; moved = true;
        if (!active || myGen !== gen) { try { a.pause(); } catch (e) {} return; }
        bindAndPlay(a, myGen);                            // 하이라이트·재생바 공통 연결
      };
      a.src = cands[i];
      try { a.load(); } catch (e) { nextOne(); }
    })(0);
    function doGenerate() {                               // ② 저장본 없음 → Gemini 생성(서버가 저장) → 다음부터 ①에서 재생
      if (!active || myGen !== gen) return;
      if (btnEl) btnEl.textContent = "⏳ 만드는 중… 1~2분, 새로고침 말고 기다려 주세요";
      aiFetch(text, date, sig)
        .then(function (b) { if (active && myGen === gen) playAudio(URL.createObjectURL(b), myGen); })
        .catch(function () { if (active && myGen === gen) browserStart(text, myGen); });   // ③ 실패 시 기본 음성
    }
  }
  function stop() { gen++; active = false; stopAudio(); if (synth) { try { synth.cancel(); } catch (e) {} } clearHi(); hideBar(); if (btnEl) btnEl.textContent = btnLabel; }
  function toggle(text, btn, label, opts) { if (active) stop(); else start(text, btn, label, opts); }
  // 날짜(YYYY-MM-DD)로 미리 만든 로컬 음성 후보 URL(mp3→wav)
  function preUrlsForDate(dashDate) {
    var sb = (window.SUPABASE_URL || "").replace(/\/$/, "");
    if (!sb || !dashDate) return [];
    var base = sb + "/storage/v1/object/public/tts-cache/qt-" + dashDate;
    return [base + ".mp3", base + ".wav"];
  }
  window.addEventListener("pagehide", stop);
  return { toggle: toggle, stop: stop, supported: true, preUrlsForDate: preUrlsForDate };   // 로컬음성→AI→기본음성 순으로 항상 동작
})();
window.WPCTts = WPCTts;

// ===== 1-3. 매일 말씀 묵상(QT) — Supabase qt_published 뷰(오늘 날짜 자동) =====
(function () {
  const todayBox = document.getElementById("qtToday");
  const modal = document.getElementById("qtModal");
  if (!todayBox || !modal) return;
  const dateListEl = document.getElementById("qtDateList");
  const detailEl = document.getElementById("qtDetail");
  const yearBarEl = document.getElementById("qtYearBar");
  const yearLabelEl = document.getElementById("qtYearLabel");
  const yearNewerBtn = document.getElementById("qtYearNewer"); // ‹ 최근 연도
  const yearOlderBtn = document.getElementById("qtYearOlder"); // › 지난 연도

  let entries = []; // [{date, content, title, ref}] (최신 → 과거)

  // Supabase 'qt_published' 뷰에서 매일 QT 가져오기 → 카카오톡 발송 양식과 동일한 텍스트로 합성
  function fmtKakaoDateFromIso(iso) {
    if (!iso) return "";
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return iso;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const dow = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][d.getDay()];
    return `${m[1]}.${m[2]}.${m[3]} ${dow}`;
  }
  // 서식(HTML) 원고 → 평문(QT 표시용). 평문이면 그대로.
  function qtHtmlToText(html) {
    if (html == null) return "";
    const s = String(html);
    if (!/<[a-z!][\s\S]*>/i.test(s)) return s;
    const d = document.createElement("div");
    d.innerHTML = s.replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, "$&\n").replace(/<br\s*\/?>/gi, "\n");
    return (d.textContent || "").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
  }
  function rowToQtContent(r) {
    const dateStr = fmtKakaoDateFromIso(r.sermon_date);
    const out = [];
    out.push("📖 샬롬! 오늘의 QT입니다.");
    out.push("");
    out.push(`📅 날짜: ${dateStr}`);
    out.push("");
    if (r.title) out.push(r.title);
    if (r.scripture) out.push(r.scripture);
    out.push("");
    out.push("📖 성경 본문 (우리말 성경)");
    out.push((r.qt_bible_text || "").trim());
    out.push("");
    out.push("📝 묵상");
    out.push("");
    out.push(qtHtmlToText(r.content).trim());
    const prayer = qtHtmlToText(r.prayer).trim();
    if (prayer) { out.push(""); out.push("🙏 기도"); out.push(""); out.push(prayer); }
    return out.join("\n");
  }
  function loadQtFromSupabase() {
    if (!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY)) return Promise.resolve(null);
    const u = window.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/qt_published?select=sermon_date,title,scripture,qt_bible_text,content,prayer&order=sermon_date.desc&limit=180";
    return fetch(u, { headers: { apikey: window.SUPABASE_ANON_KEY, Authorization: "Bearer " + window.SUPABASE_ANON_KEY } })
      .then((r) => r.ok ? r.json() : null)
      .then((rows) => {
        if (!rows || !rows.length) return null;
        const ymd = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[1]}.${m[2]}.${m[3]}` : ""; };
        return rows
          .filter((r) => r.sermon_date && (r.qt_bible_text || r.content))
          .map((r) => ({ date: ymd(r.sermon_date), content: rowToQtContent(r) }));
      })
      .catch(() => null);
  }

  // ── 갓피아(GODpia) 성경 듣기 딥링크: reading.asp?vol=<책코드>&chap=<장> ──
  const GODPIA_BASE = "https://www.godpia.com/read/reading.asp";
  const GODPIA_VOL = {
    "창세기":"gen","출애굽기":"exo","레위기":"lev","민수기":"num","신명기":"deu",
    "여호수아":"jos","사사기":"jdg","룻기":"rut","사무엘상":"1sa","사무엘하":"2sa",
    "열왕기상":"1ki","열왕기하":"2ki","역대상":"1ch","역대하":"2ch","에스라":"ezr",
    "느헤미야":"neh","에스더":"est","욥기":"job","시편":"psa","잠언":"pro",
    "전도서":"ecc","아가":"sng","이사야":"isa","예레미야":"jer","예레미야애가":"lam",
    "에스겔":"ezk","다니엘":"dan","호세아":"hos","요엘":"jol","아모스":"amo",
    "오바댜":"oba","요나":"jnh","미가":"mic","나훔":"nam","하박국":"hab",
    "스바냐":"zep","학개":"hag","스가랴":"zec","말라기":"mal","마태복음":"mat",
    "마가복음":"mrk","누가복음":"luk","요한복음":"jhn","사도행전":"act","로마서":"rom",
    "고린도전서":"1co","고린도후서":"2co","갈라디아서":"gal","에베소서":"eph","빌립보서":"php",
    "골로새서":"col","데살로니가전서":"1th","데살로니가후서":"2th","디모데전서":"1ti","디모데후서":"2ti",
    "디도서":"tit","빌레몬서":"phm","히브리서":"heb","야고보서":"jas","베드로전서":"1pe",
    "베드로후서":"2pe","요한일서":"1jn","요한이서":"2jn","요한삼서":"3jn","유다서":"jud","요한계시록":"rev",
    // 흔한 약어
    "창":"gen","출":"exo","레":"lev","민":"num","신":"deu","수":"jos","삿":"jdg","룻":"rut",
    "삼상":"1sa","삼하":"2sa","왕상":"1ki","왕하":"2ki","대상":"1ch","대하":"2ch","스":"ezr",
    "느":"neh","에":"est","욥":"job","시":"psa","잠":"pro","전":"ecc","아":"sng","사":"isa",
    "렘":"jer","애":"lam","겔":"ezk","단":"dan","호":"hos","욜":"jol","암":"amo","옵":"oba",
    "욘":"jnh","미":"mic","나":"nam","합":"hab","습":"zep","학":"hag","슥":"zec","말":"mal",
    "마":"mat","막":"mrk","눅":"luk","요":"jhn","행":"act","롬":"rom","고전":"1co","고후":"2co",
    "갈":"gal","엡":"eph","빌":"php","골":"col","살전":"1th","살후":"2th","딤전":"1ti","딤후":"2ti",
    "딛":"tit","몬":"phm","히":"heb","약":"jas","벧전":"1pe","벧후":"2pe","요일":"1jn","요이":"2jn",
    "요삼":"3jn","유":"jud","계":"rev",
  };
  // "나훔 2:1~7", "시편 119:105", "고린도전서 13:4" → 책+장으로 변환
  function godpiaUrl(ref) {
    if (!ref) return GODPIA_BASE;
    const m = String(ref).replace(/\s+/g, " ").trim().match(/([가-힣]+)\s*(\d+)\s*[:：]/);
    if (!m) return GODPIA_BASE;
    const code = GODPIA_VOL[m[1]];
    return code ? `${GODPIA_BASE}?vol=${code}&chap=${m[2]}` : GODPIA_BASE;
  }

  function digest(content) {
    const lines = content.split("\n").map((s) => s.trim()).filter(Boolean);
    const meaningful = lines.filter((l) => !/^📖|^📅|^샬롬|오늘의 QT/.test(l));
    const ref = meaningful.find((l) => /\d+\s*[:：]\s*\d+/.test(l) && l.length < 30) || "";
    const title = meaningful.find((l) => l !== ref) || meaningful[0] || "오늘의 말씀 묵상";
    return { title, ref };
  }

  function todayStr() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
  }
  // 날짜 문자열 → 비교용 숫자(YYYYMMDD). 미래 QT 숨김에 사용
  function dateNum(s) {
    const m = String(s).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : 0;
  }
  function todayNum() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function renderToday() {
    if (!entries.length) {
      todayBox.innerHTML = `<p class="qt-loading">아직 등록된 QT 말씀이 없습니다.</p>`;
      return;
    }
    const ts = todayStr();
    const todayEntry = entries.find((e) => e.date === ts);
    const entry = todayEntry || entries[0];
    const isToday = !!todayEntry;
    todayBox.innerHTML = `
      <button class="qt-card-today" id="qtOpen">
        <span class="qt-badge">${isToday ? "오늘의 QT" : "최근 QT"} · ${entry.date}</span>
        <h3 class="qt-card-title">${entry.title}</h3>
        ${entry.ref ? `<p class="qt-card-ref">${entry.ref}</p>` : ""}
        <span class="qt-card-more">묵상 전문 읽기 →</span>
      </button>`;
    document.getElementById("qtOpen").addEventListener("click", () => openModal(entry.date));

    // '오늘의 말씀 듣기'(TTS) → 본문 모달을 열어(팝업) 낭독 시작 (대시보드와 동일 컨셉)
    const homeTts = document.getElementById("qtHomeTts");
    if (homeTts) {
      if (!(window.WPCTts && window.WPCTts.supported)) { homeTts.style.display = "none"; }
      else {
        homeTts.onclick = () => {
          openModal(entry.date);                          // 오늘 큐티 본문 팝업(모달)
          const mb = document.getElementById("qtTtsBtn"); // 모달 안의 낭독 버튼을 눌러 재생 시작
          if (mb) mb.click();
        };
      }
    }
  }

  const escQt = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // QT 본문(시트 텍스트)을 제목·본문·섹션으로 구조화
  function parseQt(raw) {
    const lines = (raw || "").split("\n").map((s) => s.replace(/\s+$/g, ""));
    let date = "", title = "", ref = "";
    const sections = []; let cur = null;
    for (const ln of lines) {
      const t = ln.trim();
      if (!t) { if (cur) cur.body.push(""); continue; }
      if (/^📖/.test(t) && /(샬롬|오늘의\s*QT)/.test(t)) continue;           // 인사말 제거
      const dm = t.match(/^📅\s*날짜\s*[:：]?\s*(.+)$/);
      if (dm) { date = dm[1].trim(); continue; }                             // 날짜(한 번만)
      const hm = t.match(/^(?:📖|📝|🙏|💡|✏️|🕊️|✨|🌱|📌|✝️?)\s*(.+)$/);  // 섹션 헤더
      if (hm) { cur = { head: hm[1].trim(), body: [] }; sections.push(cur); continue; }
      if (!cur) {
        if (!title) { title = t; continue; }
        if (!ref && /\d/.test(t) && /[:：~∼\-장절,\s]/.test(t) && t.length <= 32) { ref = t; continue; }
        title += " " + t; continue;
      }
      cur.body.push(t);
    }
    return { date, title, ref, sections };
  }

  function qtParas(lines) {
    const out = []; let buf = [];
    for (const l of lines) { if (l === "") { if (buf.length) { out.push(buf.join("\n")); buf = []; } } else buf.push(l); }
    if (buf.length) out.push(buf.join("\n"));
    return out;
  }

  // 자료에 존재하는 연도 목록(최신 → 과거). entries는 최신순 정렬 상태.
  function qtYears() {
    const seen = [];
    for (const e of entries) { const y = e.date.slice(0, 4); if (!seen.includes(y)) seen.push(y); }
    return seen;
  }
  // 해당 연도에서 가장 최근 묵상 날짜(entries가 최신순이라 첫 매치)
  function latestDateOfYear(y) {
    const e = entries.find((x) => x.date.slice(0, 4) === y);
    return e ? e.date : null;
  }
  // 연도 넘김 바 상태 갱신 — 현재 보고 있는 날짜의 연도를 표시하고 양끝에서 화살표 비활성화
  function updateYearBar(activeDate) {
    if (!yearBarEl) return;
    if (!entries.length) { yearBarEl.hidden = true; return; }
    yearBarEl.hidden = false;
    const years = qtYears();
    const y = String(activeDate).slice(0, 4);
    if (yearLabelEl) yearLabelEl.textContent = y + "년";
    const idx = years.indexOf(y);
    if (yearNewerBtn) yearNewerBtn.disabled = idx <= 0;                       // 더 최근 연도 없음
    if (yearOlderBtn) yearOlderBtn.disabled = idx < 0 || idx >= years.length - 1; // 더 지난 연도 없음
  }
  // dir: -1 = 최근 연도로, +1 = 지난 연도로
  function jumpYear(dir) {
    const years = qtYears();
    const act = dateListEl.querySelector(".qt-dl-item.active");
    const cy = act ? act.dataset.date.slice(0, 4) : (years[0] || "");
    const target = years[years.indexOf(cy) + dir];
    if (!target) return;
    const d = latestDateOfYear(target);
    if (d) showDetail(d);
  }

  function buildDateList(activeDate) {
    dateListEl.innerHTML = entries
      .map((e) => `<button class="qt-dl-item${e.date === activeDate ? " active" : ""}" data-date="${e.date}">${e.date}</button>`)
      .join("");
  }

  // ── 홈 QT 아멘 체크(대시보드와 동일한 qt_checks 사용) — 로그인한 회원만 ──
  function dotToDash(d) { const m = String(d).match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/); return m ? `${m[1]}-${("0" + m[2]).slice(-2)}-${("0" + m[3]).slice(-2)}` : d; }
  function qtSession() {
    try {
      if (!window.SUPABASE_URL) return null;
      const ref = new URL(window.SUPABASE_URL).hostname.split(".")[0];
      const raw = localStorage.getItem(`sb-${ref}-auth-token`);
      if (!raw) return null;
      const s0 = JSON.parse(raw);
      const s = (s0 && s0.currentSession) ? s0.currentSession : s0;
      const uid = s && s.user && s.user.id, token = s && s.access_token;
      return (uid && token) ? { uid, token } : null;
    } catch (e) { return null; }
  }
  const AMEN_NOTE = "margin-top:16px;padding:12px 15px;background:#f4f1ea;border-radius:11px;color:#5b6b7d;font-size:.9rem;line-height:1.55;text-align:center";
  const AMEN_DONE = "margin-top:16px;padding:13px 15px;background:#e7f4ea;border:1px solid #bfe0c8;border-radius:11px;color:#1e7a45;font-weight:700;font-size:.95rem;text-align:center";
  function amenDoneBox(box, cd, sess, rankMsg) {
    box.innerHTML = `<div style="${AMEN_DONE}">${escQt(rankMsg || "✓ 오늘의 큐티를 마치고 아멘 하셨습니다 🙌")}</div>`;
    if (rankMsg) return;
    fetch(window.SUPABASE_URL + "/rest/v1/rpc/qt_check_rank", { method: "POST", headers: { apikey: window.SUPABASE_ANON_KEY, Authorization: "Bearer " + sess.token, "Content-Type": "application/json" }, body: JSON.stringify({ p_date: cd }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((rank) => { if (rank) box.innerHTML = `<div style="${AMEN_DONE}">✓ 오늘 ${rank}번째 아멘! 은혜 충만한 하루 되세요 🙌</div>`; })
      .catch(() => {});
  }
  function loadHomeAmen(date) {
    const box = document.getElementById("qtAmenBox");
    if (!box) return;
    const cd = dotToDash(date), SB = window.SUPABASE_URL, AK = window.SUPABASE_ANON_KEY;
    const sess = qtSession();
    if (!SB || !AK) { box.innerHTML = ""; return; }
    if (!sess) { box.innerHTML = `<div style="${AMEN_NOTE}">🙏 <b>로그인</b>하시면 오늘의 큐티에 <b>아멘</b> 체크를 할 수 있어요. <span style="color:#9aa5b1">(화면 오른쪽 위 로그인)</span></div>`; return; }
    const H = { apikey: AK, Authorization: "Bearer " + sess.token };
    box.innerHTML = `<div style="${AMEN_NOTE}">확인 중…</div>`;
    // 본인(user_id) 것만 조회 — 관리자는 전체 qt_checks를 읽을 수 있어 필터 없으면 남의 아멘이 잡힘
    fetch(SB + "/rest/v1/qt_checks?select=id&user_id=eq." + sess.uid + "&check_date=eq." + cd, { headers: H })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (rows && rows.length) { amenDoneBox(box, cd, sess); return; }
        box.innerHTML = `<label style="display:flex;align-items:center;gap:10px;margin-top:16px;padding:14px 16px;background:#eef5ef;border:1px solid #cfe3d4;border-radius:12px;color:#2f5133;font-size:.95rem;cursor:pointer"><input type="checkbox" id="qtAmenInput" style="width:18px;height:18px"> 🙏 기도문까지 읽고, 오늘의 큐티에 <b>아멘</b> 합니다</label>`;
        const chk = document.getElementById("qtAmenInput");
        chk.addEventListener("change", () => {
          if (!chk.checked) return;
          chk.disabled = true;
          fetch(SB + "/rest/v1/qt_checks", { method: "POST", headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ user_id: sess.uid, check_date: cd }) })
            .then((r) => { if (!r.ok && r.status !== 409) return r.text().then((t) => { throw new Error(t); }); amenDoneBox(box, cd, sess); })
            .catch((e) => {
              chk.disabled = false; chk.checked = false;
              const m = (e && e.message) || "";
              box.innerHTML = /does not exist|42P01|schema cache|Could not find/i.test(m)
                ? `<div style="${AMEN_NOTE};color:#c0392b">아멘 저장 테이블이 아직 없습니다 — 관리자는 supabase/qt_checks.sql 을 1회 실행해 주세요.</div>`
                : `<div style="${AMEN_NOTE};color:#c0392b">저장에 실패했습니다. 다시 시도해 주세요.</div>`;
            });
        });
      })
      .catch(() => { box.innerHTML = ""; });
  }

  function showDetail(date) {
    const e = entries.find((x) => x.date === date);
    if (!e) return;
    if (window.WPCTts) window.WPCTts.stop();   // 날짜 바꾸면 이전 낭독 정지
    const p = parseQt(e.content);
    const secHtml = p.sections.map((s) => `
      <h4 class="qt-d-head">${escQt(s.head)}</h4>
      <div class="qt-d-sec">${qtParas(s.body).map((par) => `<p>${escQt(par)}</p>`).join("")}</div>`).join("");
    detailEl.innerHTML = `
      <div class="qt-d-top">
        <span class="qt-d-date">${escQt(p.date || e.date)}</span>
        ${p.title ? `<h3 class="qt-d-title">${escQt(p.title)}</h3>` : ""}
        ${p.ref ? `<p class="qt-d-ref">${escQt(p.ref)}</p>` : ""}
      </div>
      <div class="qt-d-controls">
        <button type="button" class="qt-d-listen" id="qtTtsBtn" style="border:0;font:inherit;cursor:pointer">🔊 오늘의 말씀 듣기</button>
      </div>
      ${secHtml || `<div class="qt-d-sec"><p>${escQt(e.content)}</p></div>`}
      <div id="qtAmenBox"></div>`;
    loadHomeAmen(date);
    (function wireTts() {
      const btn = detailEl.querySelector("#qtTtsBtn");
      if (!btn) return;
      if (!(window.WPCTts && window.WPCTts.supported)) { btn.style.display = "none"; return; }
      const parts = [];
      if (p.title) parts.push(p.title);
      if (p.ref) parts.push(p.ref);
      (p.sections || []).forEach((s) => { const h = String(s.head || "").replace(/[^가-힣A-Za-z0-9\s]/g, " ").trim(); if (h) parts.push(h); if (s.body) parts.push(s.body); });
      let readText = parts.join(". ");
      if (!readText.trim()) readText = e.content;
      const dd = dotToDash(date);
      const preText = [p.title || "", p.ref || ""].filter(Boolean).join(" ");
      btn.onclick = () => window.WPCTts.toggle(readText, btn, "🔊 오늘의 말씀 듣기", { date: dd, trackEl: detailEl, preText: preText });
    })();
    const items = [...dateListEl.querySelectorAll(".qt-dl-item")];
    items.forEach((b) => b.classList.toggle("active", b.dataset.date === date));
    const act = dateListEl.querySelector(".qt-dl-item.active");
    if (act && act.scrollIntoView) act.scrollIntoView({ inline: "center", block: "nearest" });
    detailEl.scrollTop = 0;
    updateYearBar(date);
  }

  function openModal(date) {
    buildDateList(date);
    showDetail(date);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    if (window.WPCTts) window.WPCTts.stop();
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  dateListEl.addEventListener("click", (e) => {
    const b = e.target.closest(".qt-dl-item");
    if (b) showDetail(b.dataset.date);
  });
  if (yearNewerBtn) yearNewerBtn.addEventListener("click", () => jumpYear(-1));
  if (yearOlderBtn) yearOlderBtn.addEventListener("click", () => jumpYear(1));
  modal.addEventListener("click", (e) => { if (e.target.hasAttribute("data-close")) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

  function afterEntries() {
    entries = entries
      .filter((e) => e.date && e.content)
      .filter((e) => dateNum(e.date) <= todayNum())
      .map((e) => ({ ...e, ...digest(e.content) }));
    entries.sort((a, b) => (a.date < b.date ? 1 : -1));
    renderToday();
    const wantOpen =
      location.hash === "#qt-open" ||
      new URLSearchParams(location.search).get("qt") === "open";
    if (wantOpen && entries.length) {
      const ts = todayStr();
      openModal(entries.find((e) => e.date === ts) ? ts : entries[0].date);
    }
  }

  // QT는 Supabase qt_published 뷰에서만 가져온다(구글시트 레거시 제거 — 2026-06-30)
  loadQtFromSupabase().then((sb) => {
    entries = sb || [];
    afterEntries();
  }).catch(() => {
    todayBox.innerHTML = `<p class="qt-loading">오늘의 말씀을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>`;
  });
})();

// ===== 2. 주보 보관함: 월 필터 + 검색 =====
const bulletinList = document.getElementById("bulletinList");
const bulletinMonth = document.getElementById("bulletinMonth");
const bulletinSearch = document.getElementById("bulletinSearch");
const bulletinEmpty = document.getElementById("bulletinEmpty");

function buildMonthOptions() {
  const months = [];
  BULLETINS.forEach((b) => {
    if (!months.find((m) => m.value === b.month)) months.push({ value: b.month, label: b.monthLabel });
  });
  bulletinMonth.innerHTML =
    `<option value="all">전체 보기</option>` +
    months.map((m) => `<option value="${m.value}">${m.label}</option>`).join("");
}

function bulletinCardHTML(b, idx) {
  return `
    <button class="bulletin-card" data-idx="${idx}">
      <span class="b-week">${b.week}</span>
      <span class="b-date">${b.dateLabel}</span>
      <h4>${b.title}</h4>
      <p class="b-ref">${b.scripture}</p>
      <span class="b-more">주보 보기 →</span>
    </button>`;
}

// Supabase에 게시된 주보(bulletins_public) — 헌금 금액은 뷰에서 이미 제외됨
let SB_BULLETINS = [];
function escB(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function sbBulletinCardHTML(b, i) {
  const d = b.data || {};
  const dl = String(b.bdate || "").slice(0, 10).replace(/-/g, ". ");
  return `
    <button class="bulletin-card" data-sb="${i}">
      <span class="b-week">${escB(d.week || "주보")}</span>
      <span class="b-date">${escB(dl)}</span>
      <h4>${escB(b.title || "(제목 없음)")}</h4>
      <p class="b-ref">${escB(b.scripture || "")}</p>
      <span class="b-more">주보 보기 →</span>
    </button>`;
}

function renderBulletins() {
  const month = bulletinMonth.value;
  const q = bulletinSearch.value.trim().toLowerCase();
  const sbItems = SB_BULLETINS.map((b, i) => ({ b, i })).filter(({ b }) => {
    const text = `${b.title || ""} ${b.scripture || ""} ${String(b.bdate || "")} ${(b.data && b.data.week) || ""}`.toLowerCase();
    return !q || text.includes(q);
  });
  const items = BULLETINS.map((b, i) => ({ b, i })).filter(({ b }) => {
    const monthOk = month === "all" || b.month === month;
    const text = `${b.title} ${b.scripture} ${b.dateLabel} ${b.week} ${b.preacher}`.toLowerCase();
    const searchOk = !q || text.includes(q);
    return monthOk && searchOk;
  });
  bulletinList.innerHTML =
    sbItems.map(({ b, i }) => sbBulletinCardHTML(b, i)).join("") +
    items.map(({ b, i }) => bulletinCardHTML(b, i)).join("");
  bulletinEmpty.hidden = (items.length + sbItems.length) > 0;
}

function loadSBBulletins() {
  if (!bulletinList || !(window.SUPABASE_URL && window.SUPABASE_ANON_KEY)) return;
  const u = window.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/bulletins_public?select=*&order=bdate.desc&limit=60";
  fetch(u, { headers: { apikey: window.SUPABASE_ANON_KEY, Authorization: "Bearer " + window.SUPABASE_ANON_KEY } })
    .then((r) => (r.ok ? r.json() : []))
    .then((rows) => { SB_BULLETINS = rows || []; if (SB_BULLETINS.length) renderBulletins(); })
    .catch(() => {});
}

if (bulletinList) {
  buildMonthOptions();
  renderBulletins();
  loadSBBulletins();
  bulletinMonth.addEventListener("change", renderBulletins);
  bulletinSearch.addEventListener("input", renderBulletins);
}

// ===== 3. 주보 상세 모달 =====
const modal = document.getElementById("bulletinModal");
const modalBody = document.getElementById("modalBody");

function openBulletin(idx) {
  const b = BULLETINS[idx];
  if (!b) return;
  modalBody.innerHTML = `
    <span class="m-eyebrow">${b.week} · 주일 낮 예배</span>
    <h3 id="modalTitle" class="m-title">${b.title}</h3>
    <p class="m-sub">${b.dateLabel} · ${b.scripture} · ${b.preacher}</p>
    <blockquote class="m-quote">${b.quote}</blockquote>

    <h4 class="m-head">예배 순서</h4>
    <ol class="m-order">${b.order.map((o) => `<li>${o}</li>`).join("")}</ol>

    <h4 class="m-head">이 주의 말씀 강해</h4>
    <ul class="m-extra">
      <li>${b.wed}</li>
      <li>${b.dawn}</li>
      <li>${b.qt}</li>
    </ul>

    <h4 class="m-head">한 주의 소식</h4>
    <ol class="m-news">
      ${(b.news || []).map((n) => `<li><strong>${n.title}</strong><span>${n.detail}</span></li>`).join("")}
    </ol>

    <h4 class="m-head">향기로운 예물</h4>
    <div class="m-offering">
      ${(b.offering || []).map((o) => `<div class="m-off-row"><span class="m-off-cat">${o.cat}</span><span class="m-off-names">${o.names.split(" · ").map((n) => `<span>${n}</span>`).join("")}</span></div>`).join("")}
    </div>

    ${b.book ? `
    <h4 class="m-head">Faith &amp; Books</h4>
    <div class="m-book">
      <p class="m-book-title">「${b.book.title}」 · ${b.book.author} <span>(${b.book.publisher})</span></p>
      <p class="m-book-text">${b.book.text}</p>
    </div>` : ""}

    <p class="m-note">* 감사한 마음으로 드린 예물의 명단만 안내하며, 헌금 금액 내역은 게시하지 않습니다.</p>`;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

// 설교 카드 클릭 시: 요약 설교 보기
function openSermonSummary(idx) {
  const b = BULLETINS[idx];
  if (!b || !b.summary || !modal || !modalBody) return;
  const s = b.summary;
  modalBody.innerHTML = `
    <span class="m-eyebrow">${b.dateLabel} · 주일 낮 예배 · 설교 요약</span>
    <h3 id="modalTitle" class="m-title">${s.heading}</h3>
    <p class="m-sub">${b.scripture} · ${b.preacher}</p>

    <h4 class="m-head">${s.sectionTitle}</h4>
    <div class="sm-points">
      ${s.points.map((p) => `<div class="sm-point"><strong>${p.lead}</strong><p>${p.text}</p></div>`).join("")}
    </div>

    <div class="sm-apply">
      <span class="sm-apply-tag">🌱 적용 및 결단</span>
      <p>${s.apply}</p>
      ${s.applyRef ? `<span class="sm-apply-ref">${s.applyRef}</span>` : ""}
    </div>`;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
}

// Supabase 게시 주보 — 공용 렌더러(js/bulletin-render.js)로 새 탭 보기(헌금 금액 없음)
function openPublicBulletinView(b) {
  if (!b) return;
  if (window.BulletinRender) { window.BulletinRender.open(b, { amounts: false }); return; }
  alert("주보 보기를 불러오지 못했습니다. 페이지를 새로고침해 주세요.");
}

if (modal) {
  bulletinList.addEventListener("click", (e) => {
    const card = e.target.closest(".bulletin-card");
    if (!card) return;
    if (card.dataset.sb != null) { openPublicBulletinView(SB_BULLETINS[Number(card.dataset.sb)]); return; }
    openBulletin(Number(card.dataset.idx));
  });
  modal.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });
}

// ===== 3-2. 앱 설치 안내 배너 (PWA) =====
(function () {
  const bar = document.getElementById("installBar");
  if (!bar) return;
  const goBtn = document.getElementById("installGo");
  const closeBtn = document.getElementById("installClose");
  const msg = document.getElementById("installMsg");

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  const dismissed = localStorage.getItem("installDismissed") === "1";
  if (isStandalone || dismissed) return; // 이미 설치했거나 닫았으면 표시 안 함

  let deferredPrompt = null;

  // 기기 판별: iOS(아이폰·아이패드)는 프로그램 설치 미지원 → 안내만 가능
  const ua = window.navigator.userAgent;
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    // 아이패드OS 사파리는 UA가 'Macintosh'로 보고됨 → 터치 지원으로 보정
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isIOSNonSafari = isIOS && /crios|fxios|edgios|naver|kakaotalk|daum/i.test(ua);

  // 안드로이드/크롬·엣지(데스크톱): 설치 프롬프트 가로채기
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    msg.textContent = "홈 화면에 추가하여 앱처럼 사용하세요.";
    goBtn.textContent = "설치";
    goBtn.hidden = false;
    bar.hidden = false;
  });

  goBtn.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      bar.hidden = true;
    } else if (isIOS) {
      showIosGuide(); // iOS는 설치 API가 없으므로 수동 추가 방법을 안내
    }
  });

  closeBtn.addEventListener("click", () => {
    bar.hidden = true;
    localStorage.setItem("installDismissed", "1");
  });

  // iOS: beforeinstallprompt 미지원 → '방법' 버튼으로 안내 모달 제공
  if (isIOS && !isStandalone) {
    msg.textContent = isIOSNonSafari
      ? "Safari에서 ‘홈 화면에 추가’로 설치할 수 있어요."
      : "공유 → ‘홈 화면에 추가’로 설치하세요.";
    goBtn.textContent = "방법 보기";
    goBtn.hidden = false;
    bar.hidden = false;
  }

  function showIosGuide() {
    let m = document.getElementById("iosGuideModal");
    if (!m) {
      const shareSvg =
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#223350" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4"/><path d="M8.5 7.5 12 4l3.5 3.5"/><rect x="5" y="11" width="14" height="9" rx="2"/></svg>';
      const safariSteps =
        '<li><span class="ios-step-no">1</span><div>화면 아래(아이패드는 위)의 <b>공유 버튼</b> <span class="ios-share">' + shareSvg + '</span> 을 누릅니다.</div></li>' +
        '<li><span class="ios-step-no">2</span><div>메뉴를 내려 <b>‘홈 화면에 추가’</b> 를 누릅니다.</div></li>' +
        '<li><span class="ios-step-no">3</span><div>오른쪽 위 <b>‘추가’</b> 를 누르면 홈 화면에 ○○교회 앱이 생깁니다.</div></li>';
      const note = isIOSNonSafari
        ? '<p class="ios-note">※ 지금 브라우저(크롬 등)에서는 설치가 제한될 수 있어요. <b>Safari</b>로 <b>example.com</b>을 연 뒤 위 방법으로 진행해 주세요.</p>'
        : '<p class="ios-note">※ 아이폰·아이패드는 이렇게 ‘홈 화면에 추가’ 방식으로만 앱을 설치할 수 있어요(애플 정책).</p>';
      m = document.createElement("div");
      m.id = "iosGuideModal";
      m.className = "modal";
      m.hidden = true;
      m.innerHTML =
        '<div class="modal-backdrop" data-iclose></div>' +
        '<div class="modal-box modal-box-ios" role="dialog" aria-modal="true" aria-label="앱 설치 방법">' +
          '<button class="modal-close" data-iclose aria-label="닫기">&times;</button>' +
          '<div class="ios-guide">' +
            '<img src="images/icon-192.png?v=20260629a" class="ios-guide-icon" alt="" />' +
            '<h3>홈 화면에 앱 추가하기</h3>' +
            '<p class="ios-guide-sub">아이폰·아이패드는 아래 방법으로 설치합니다.</p>' +
            '<ol class="ios-steps">' + safariSteps + '</ol>' +
            note +
          '</div>' +
        '</div>';
      document.body.appendChild(m);
      m.addEventListener("click", (e) => { if (e.target.hasAttribute("data-iclose")) m.hidden = true; });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !m.hidden) m.hidden = true; });
    }
    m.hidden = false;
  }
})();

// (헤더 스크롤·모바일 메뉴 로직은 js/layout.js로 이관됨)

// ===== 4. 홈 '이번 주 말씀' 하이라이트 =====
const homeSermon = document.getElementById("homeSermon");
if (homeSermon && typeof BULLETINS !== "undefined" && BULLETINS.length) {
  const b = BULLETINS[0];
  homeSermon.innerHTML = `
    <span class="hs-date">${b.dateLabel} · 주일 낮 예배</span>
    <h3 class="hs-title">${b.title}</h3>
    <p class="hs-ref">${b.scripture} · ${b.preacher}</p>
    <blockquote class="hs-quote">${b.quote}</blockquote>
    <a class="btn btn-line" href="word.html">설교 더 보기 →</a>`;
}

// ===== 4b. 홈 '이번 주 주보' 미리보기 =====
const homeBulletin = document.getElementById("homeBulletin");
if (homeBulletin && typeof BULLETINS !== "undefined" && BULLETINS.length) {
  const b = BULLETINS[0];
  const orderItems = (b.order || []).map((o) => `<li>${o}</li>`).join("");
  const newsItems = (b.news || []).slice(0, 3).map((n) => `<li><strong>${n.title}</strong>${n.detail}</li>`).join("");
  homeBulletin.innerHTML = `
    <div class="hb-card">
      <div class="hb-hd">
        <span class="hb-hd-week">${b.week} · 주일 낮 예배</span>
        <span class="hb-hd-date">${b.dateLabel}</span>
      </div>
      <div class="hb-body">
        <div class="hb-col">
          <p class="hb-col-title">예배 순서</p>
          <ol class="hb-order">${orderItems}</ol>
        </div>
        <div class="hb-col">
          <p class="hb-col-title">이 주의 말씀 강해</p>
          <ul class="hb-extra">
            <li>${b.wed || ""}</li>
            <li>${b.dawn || ""}</li>
            <li>${b.qt || ""}</li>
          </ul>
          ${newsItems ? `<p class="hb-col-title">한 주의 소식</p><ul class="hb-news">${newsItems}</ul>` : ""}
        </div>
      </div>
      <div class="hb-ft">
        <button class="btn btn-line" id="homeBulletinBtn">주보 전체 보기 →</button>
      </div>
    </div>`;
  const hbBtn = document.getElementById("homeBulletinBtn");
  if (hbBtn) hbBtn.onclick = () => openBulletin(0);
}

// ===== 5. 새가족 등록 폼 (welcome) =====
const newcomerForm = document.getElementById("newcomerForm");
if (newcomerForm) {
  newcomerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(newcomerForm);
    const name = (fd.get("name") || "").trim();
    const phone = (fd.get("phone") || "").trim();
    if (!name || !phone) { alert("이름과 연락처를 입력해 주세요."); return; }
    const to = window.FORMSUBMIT_EMAIL;
    if (!to) { alert("접수 이메일이 아직 설정되지 않았습니다. 관리자에게 문의해 주세요."); return; }
    const btn = newcomerForm.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = "보내는 중…"; }
    try {
      const res = await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(to), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: "[○○교회] 새가족 등록 신청",
          _template: "table",
          _captcha: "false",
          이름: name,
          연락처: phone,
          방문예정일: (fd.get("visit") || "").trim() || "-",
          함께오는가족: (fd.get("family") || "").trim() || "-",
          남기실말씀: (fd.get("message") || "").trim() || "-",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (j && (j.success === "true" || j.success === true)) {
        newcomerForm.innerHTML = '<div style="text-align:center;padding:24px 0;"><p style="font-size:1.1rem;font-weight:600;color:var(--accent);">등록 신청이 접수되었습니다 🙏</p><p style="color:var(--ink-soft);margin-top:8px;">새가족 담당자가 따뜻하게 연락드리겠습니다.</p></div>';
      } else {
        throw new Error((j && j.message) || "전송에 실패했습니다");
      }
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = "등록 신청"; }
      alert("전송 오류: " + err.message + "\n잠시 후 다시 시도해 주세요.");
    }
  });
}

// ===== 5-2. 삶의 질문 Q&A 아코디언 =====
document.querySelectorAll(".qna-q").forEach((btn) => {
  btn.addEventListener("click", () => {
    const item = btn.closest(".qna-item");
    const open = item.classList.toggle("open");
    const mark = btn.querySelector(".qna-mark");
    if (mark) mark.textContent = open ? "−" : "+";
  });
});

// ===== 5-3. 하이델베르크 요리문답 — 카드 클릭 시 문답 탐색 =====
(function () {
  const card = document.getElementById("hcCard");
  const modal = document.getElementById("hcModal");
  if (!card || !modal || !window.HEIDELBERG) return;
  const body = document.getElementById("hcBody");
  const search = document.getElementById("hcSearch");
  const HC = window.HEIDELBERG;

  // 자주 묻는 신앙의 궁금증 → 해당 문답 번호
  const CURATED = [
    { n: 3, label: "내 죄와 비참함은 무엇을 통해 알 수 있나요?" },
    { n: 8, label: "사람은 정말 선을 조금도 행할 수 없나요?" },
    { n: 11, label: "하나님은 자비로우신데 왜 죄를 그냥 넘기지 않으시나요?" },
    { n: 16, label: "중보자는 왜 참 하나님이면서 참 사람이어야 했나요?" },
    { n: 21, label: "‘참된 믿음’이란 정확히 무엇인가요?" },
    { n: 38, label: "사도신경의 ‘본디오 빌라도에게 고난을 받으사’는 왜 들어 있나요?" },
    { n: 44, label: "예수님이 ‘음부에 내려가셨다’는 건 무슨 뜻인가요?" },
    { n: 60, label: "나는 어떻게 하나님 앞에서 의롭다 함을 받나요?" },
    { n: 72, label: "세례의 물 자체가 죄를 씻어 주는 건가요?" },
    { n: 78, label: "성찬의 떡과 포도주가 실제로 살과 피로 변하나요?" },
    { n: 86, label: "구원은 은혜로 받았는데 왜 선을 행해야 하나요?" },
    { n: 99, label: "십계명에서 하나님의 이름을 ‘망령되이 일컫지 말라’는 것의 의미는?" },
    { n: 103, label: "제4계명, 주일은 꼭 지켜야 하나요?" },
    { n: 105, label: "‘살인하지 말라’가 마음의 미움까지 포함하나요?" },
    { n: 116, label: "하나님은 다 아시는데 왜 기도해야 하나요?" },
    { n: 125, label: "‘일용할 양식을 주옵시고’는 무엇을 구하는 기도인가요?" },
    { n: 129, label: "기도 끝의 ‘아멘’은 무슨 뜻인가요?" },
  ];

  let part = "전체", query = "";
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const get = (n) => HC.find((x) => x.n === n);

  function listView() {
    const q = query.trim().toLowerCase();
    let items = HC;
    if (part !== "전체") items = items.filter((x) => x.part === part);
    if (q) items = items.filter((x) => `문 ${x.n} ${x.q} ${x.a} ${x.ldTitle}`.toLowerCase().includes(q));

    const curated = !q ? `
      <div class="hc-curated">
        <p class="hc-section-t">이런 것이 궁금하셨나요?</p>
        <div class="hc-chips">
          ${CURATED.map((c) => `<button class="hc-chip" data-n="${c.n}">${esc(c.label)}</button>`).join("")}
        </div>
      </div>` : "";

    const tabs = `
      <div class="hc-filters">
        ${["전체", "비참", "구원", "감사"].map((p) => `<button class="hc-tab${p === part ? " active" : ""}" data-part="${p}">${p}</button>`).join("")}
        <span class="hc-count">${items.length}문항</span>
      </div>`;

    const list = items.length
      ? `<div class="hc-list">${items.map((x) => `
          <button class="hc-item" data-n="${x.n}">
            <span class="hc-num">문 ${x.n}</span>
            <span class="hc-q">${esc(x.q)}</span>
            <span class="hc-ld">${x.part} · ${esc(x.ldTitle)}</span>
          </button>`).join("")}</div>`
      : `<p class="hc-empty">검색 결과가 없습니다.</p>`;

    body.innerHTML = curated + tabs + list;
    body.scrollTop = 0;
  }

  function detailView(n) {
    const it = get(n);
    if (!it) return;
    const ans = esc(it.a).split("\n").map((p) => `<p>${p}</p>`).join("");
    const prev = get(n - 1), next = get(n + 1);
    body.innerHTML = `
      <button class="hc-back" data-back>← 목록으로</button>
      <div class="hc-detail">
        <span class="hc-d-meta">제${it.n}문 · 제${it.ld}주일 ${esc(it.ldTitle)} · ${it.part}</span>
        <h4 class="hc-d-q">${esc(it.q)}</h4>
        <div class="hc-d-a">${ans}</div>
        <div class="hc-d-nav">
          ${prev ? `<button class="hc-navbtn" data-n="${prev.n}">← 제${prev.n}문</button>` : `<span></span>`}
          ${next ? `<button class="hc-navbtn" data-n="${next.n}">제${next.n}문 →</button>` : `<span></span>`}
        </div>
      </div>`;
    body.scrollTop = 0;
  }

  function openModal() { listView(); modal.hidden = false; document.body.style.overflow = "hidden"; }
  function closeModal() { modal.hidden = true; document.body.style.overflow = ""; if (search) search.value = ""; query = ""; part = "전체"; }

  card.addEventListener("click", openModal);
  card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(); } });

  body.addEventListener("click", (e) => {
    if (e.target.closest("[data-back]")) { listView(); return; }
    const tab = e.target.closest(".hc-tab");
    if (tab) { part = tab.dataset.part; listView(); return; }
    const el = e.target.closest("[data-n]");
    if (el) { detailView(Number(el.dataset.n)); return; }
  });

  if (search) search.addEventListener("input", () => { query = search.value; listView(); });
  modal.addEventListener("click", (e) => { if (e.target.hasAttribute("data-close")) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

  // 다른 페이지(히어로 등)에서 ?hc=open 으로 진입하면 모달 자동 열기
  if (new URLSearchParams(location.search).get("hc") === "open") openModal();
})();

// ===== 5-4. 목사님의 글(칼럼) — 카드 렌더 + 전문 모달 =====
(function () {
  const grid = document.getElementById("columnGrid");
  const modal = document.getElementById("columnModal");
  if (!grid || !modal || !window.COLUMNS) return;
  const body = document.getElementById("columnBody");
  const COLS = window.COLUMNS;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  grid.innerHTML = COLS.map((c, i) => {
    const open = !c.coming && Array.isArray(c.body) && c.body.length;
    return `
      <article class="story-card column-card${open ? " is-open" : " is-coming"}"${open ? ` data-col="${i}" role="button" tabindex="0"` : ""}>
        <div class="sc-body">
          <span class="sc-tag">${esc(c.tag || "칼럼")}</span>
          <h3>${esc(c.title)}</h3>
          <p>${esc(c.teaser || "")}${c.coming ? " <span class=\"placeholder-note\">준비 중</span>" : ""}</p>
          ${open ? `<span class="column-go">전문 읽기 →</span>` : ""}
        </div>
      </article>`;
  }).join("");

  function openCol(i) {
    const c = COLS[i];
    if (!c || !c.body) return;
    body.innerHTML = `
      <span class="m-eyebrow">PASTOR'S COLUMN${c.scripture ? " · " + esc(c.scripture) : ""}</span>
      <h3 class="column-title">${esc(c.title)}</h3>
      ${c.author ? `<p class="column-author">${esc(c.author)}</p>` : ""}
      <div class="column-text">${c.body.map((p) => `<p>${esc(p)}</p>`).join("")}</div>`;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    body.scrollTop = 0;
  }
  function closeCol() { modal.hidden = true; document.body.style.overflow = ""; }

  grid.addEventListener("click", (e) => {
    const card = e.target.closest("[data-col]");
    if (card) openCol(Number(card.dataset.col));
  });
  grid.addEventListener("keydown", (e) => {
    const card = e.target.closest("[data-col]");
    if (card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openCol(Number(card.dataset.col)); }
  });
  modal.addEventListener("click", (e) => { if (e.target.hasAttribute("data-close")) closeCol(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeCol(); });
})();

// ===== 5-5. 히어로 제목 회전 + 점 인디케이터 + 손가락 스와이프 =====
(function () {
  const rot = document.getElementById("heroRotator");
  if (!rot) return;
  const slides = [...rot.querySelectorAll(".hero-slide")];
  if (slides.length < 2) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dotsBox = document.getElementById("heroDots");
  let i = 0, timer = null;

  // 점(바) 생성
  let dots = [];
  if (dotsBox) {
    dotsBox.innerHTML = slides
      .map((_, n) => `<button type="button" class="hero-dot${n === 0 ? " active" : ""}" aria-label="${n + 1}번째 슬라이드"></button>`)
      .join("");
    dots = [...dotsBox.querySelectorAll(".hero-dot")];
  }

  function go(n) {
    slides[i].classList.remove("is-active");
    if (dots[i]) dots[i].classList.remove("active");
    i = (n + slides.length) % slides.length;
    slides[i].classList.add("is-active");
    if (dots[i]) dots[i].classList.add("active");
  }
  function start() { stop(); if (!reduce) timer = setInterval(() => go(i + 1), 5200); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  dots.forEach((d, n) => d.addEventListener("click", () => { go(n); start(); }));

  // 손가락 스와이프(좌/우)
  let x0 = null;
  const surface = rot.closest(".hero") || rot;
  surface.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  surface.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) { go(dx < 0 ? i + 1 : i - 1); start(); }
    x0 = null;
  }, { passive: true });

  start();
})();

// ===== 5-6. 함께 드리는 기도(prayer.html) — 이번 주 기도 제목 =====
(function () {
  const box = document.getElementById("prayerThisWeek");
  if (!box || typeof BULLETINS === "undefined" || !BULLETINS.length) return;
  const b = BULLETINS[0];
  const news = (b.news || []).map((n) => `<div class="pr-item"><h4>${n.title}</h4><p>${n.detail}</p></div>`).join("");
  box.innerHTML = `
    <div class="pr-meet">
      <div class="side-card"><span class="side-tag">수요기도회</span><p>${(b.wed || "").replace(/^수요기도회 · /, "")}</p></div>
      <div class="side-card"><span class="side-tag">새벽기도회</span><p>${(b.dawn || "").replace(/^새벽기도회 · /, "")}</p></div>
    </div>
    ${news ? `<div class="pr-news">${news}</div>` : ""}
    <p class="pr-source">${b.dateLabel} 주보 기준</p>`;
})();

// ===== 5-7. 지도 모달 (선교지 등 주소 카드 클릭 시) =====
(function () {
  const modal = document.getElementById("mapModal");
  if (!modal) return;
  const frame = document.getElementById("mapFrame");
  const titleEl = document.getElementById("mapTitle");
  const addrEl = document.getElementById("mapAddr");
  const kakao = document.getElementById("mapKakao");
  function openMap(name, addr) {
    titleEl.textContent = name || "지도";
    addrEl.textContent = addr;
    frame.src = "https://www.google.com/maps?q=" + encodeURIComponent(addr) + "&hl=ko&z=15&output=embed";
    kakao.href = "https://map.kakao.com/?q=" + encodeURIComponent(addr);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeMap() { modal.hidden = true; document.body.style.overflow = ""; frame.src = "about:blank"; }
  document.querySelectorAll("[data-map]").forEach((el) => {
    el.addEventListener("click", () => openMap(el.dataset.name, el.dataset.map));
  });
  modal.addEventListener("click", (e) => { if (e.target.hasAttribute("data-close")) closeMap(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeMap(); });
})();

// ===== 6. 스크롤 등장 애니메이션 =====
const revealTargets = document.querySelectorAll(
  ".about-intro, .servants, .worship-card, .sermon-nav, .sermon-side, .qt-today, .bulletin-controls, .bulletin-card, .news-item, .mission-card, .location-grid, .entry-card, .home-sermon, .info-card, .roadmap-step, .community-card, .group-card, .story-card, .qna-item, .timeline-item, .region-card, .cta-flow"
);
revealTargets.forEach((el) => el.classList.add("reveal"));

const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        entry.target.style.transitionDelay = `${(i % 4) * 0.08}s`;
        entry.target.classList.add("visible");
        io.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
revealTargets.forEach((el) => io.observe(el));

// ===== 7. 손병민 목사 저서 — 책 미리보기 모달 =====
(function () {
  const modal = document.getElementById("bookModal");
  if (!modal) return;
  const box = modal.querySelector(".book-read");
  const openers = [
    document.getElementById("bookPreviewOpen"),
    document.getElementById("bookPreviewOpen2"),
  ].filter(Boolean);

  function open() {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    if (box) box.scrollTop = 0;
  }
  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  openers.forEach((el) => {
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  });
  modal.addEventListener("click", (e) => { if (e.target.hasAttribute("data-bclose")) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });
})();
