/* '예배와 말씀' 첫 화면 오른쪽 — 그 주 설교 영상 창
   · 평소: 가장 최근 주일낮예배 설교(data/youtube.json — GitHub 가 자동으로 새로 적음, tools/update_youtube.py)
   · 실제로 방송 중일 때: '지금 실시간 예배 중' — 누르면 그 방송(2026-10-04: 시간이 아니라 실제 방송 여부,
     js/live-status.js 가 알려 줌. 사무실 PC 가 주일 10:20~16:00 2분마다 확인, 없으면 주일 10:30~16:00 시간으로 짐작)
   · 처음에는 사진(썸네일)만 보여 주고, 누르면 그 자리에서 영상이 재생된다(첫 화면을 가볍게).
   · 목록 파일을 못 읽으면 채널의 최신 영상 목록을 그대로 띄운다. */
(function () {
  const box = document.getElementById("phVideo");
  if (!box) return;
  const CHANNEL = "UCYlesUmTrHecsHYmQNFYY1A";
  const CHANNEL_URL = "https://www.youtube.com/@노진교회";
  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const liveStatus = () => (window.LiveStatus ? window.LiveStatus.get() : Promise.resolve({ live: false, id: null }));

  // 영상 이름(2026-10-03 목사님 요청): 설교한 주일 당일은 '이번 주', 월요일부터는 '지난 주 · 9월 27일'
  //   날짜(date)는 tools/update_youtube.py 가 영상 페이지의 방송 날짜로 적는다(한국 날짜). 없으면 '최근 설교 영상'
  function videoLabel(v) {
    const ymd = (v && v.date) || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "최근 설교 영상";
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());   // 2026-10-03
    const days = Math.round((Date.parse(today + "T00:00:00Z") - Date.parse(ymd + "T00:00:00Z")) / 86400000);
    const md = parseInt(ymd.slice(5, 7), 10) + "월 " + parseInt(ymd.slice(8, 10), 10) + "일";
    if (days <= 0) return "이번 주 설교 영상";
    if (days <= 7) return "지난 주 설교 영상 · " + md;
    return "지난 설교 영상 · " + md;
  }

  function player(src) {
    return `<iframe src="${src}" title="설교 영상" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
  }
  function thumb(v) {
    // 큰 사진이 없으면 작은 사진으로
    return `<img src="https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg" alt="" loading="eager"
      onload="if(this.naturalWidth<200)this.src='https://i.ytimg.com/vi/${v.id}/hqdefault.jpg'"
      onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${v.id}/hqdefault.jpg'" />`;
  }

  let data = null, shownLive = null;
  function render(st) {
    const live = !!(st && st.live);
    shownLive = live;
    const main = data && data.sermon;
    const others = data && data.recent ? data.recent.filter((r) => !main || r.id !== main.id).slice(0, 2) : [];
    let screen, label, info;
    if (live) {
      const liveSrc = st.id ? `https://www.youtube.com/embed/${st.id}?autoplay=1&rel=0` : `https://www.youtube.com/embed/live_stream?channel=${CHANNEL}&autoplay=1`;
      label = `<span class="pv-label is-live"><i></i>지금 실시간 예배 중</span>`;
      screen = `<button type="button" class="pv-screen pv-screen-live" data-src="${esc(liveSrc)}" aria-label="실시간 예배 보기">
        <span class="pv-live-txt">주일 예배<br />실시간 방송</span><span class="pv-play" aria-hidden="true"></span></button>`;
      info = main ? `<p class="pv-sub">지난 설교: <button type="button" class="pv-link" data-id="${main.id}">${esc(main.title)} ▶</button></p>` : "";
    } else if (main) {
      label = `<span class="pv-label">${esc(videoLabel(main))}</span>`;
      screen = `<button type="button" class="pv-screen" data-src="https://www.youtube.com/embed/${main.id}?autoplay=1&rel=0" aria-label="${esc(main.title)} 영상 보기">
        ${thumb(main)}<span class="pv-play" aria-hidden="true"></span></button>`;
      info = `<p class="pv-title">${esc(main.title)}</p>
        <p class="pv-meta">${[main.passage, main.service, main.preacher].filter(Boolean).map(esc).join(" · ")}</p>`;
    } else {
      label = `<span class="pv-label">최근 설교 영상</span>`;
      screen = `<button type="button" class="pv-screen pv-screen-live" data-src="https://www.youtube.com/embed/videoseries?list=UU${CHANNEL.slice(2)}&autoplay=1&rel=0" aria-label="최근 설교 영상 보기">
        <span class="pv-live-txt">노진교회<br />설교 영상</span><span class="pv-play" aria-hidden="true"></span></button>`;
      info = "";
    }
    const more = others.length
      ? `<div class="pv-more">${others.map((o) => `<button type="button" class="pv-chip" data-id="${o.id}"><b>${esc(o.service || "설교")}</b> ${esc(o.title)}</button>`).join("")}</div>` : "";
    box.innerHTML = `<div class="pv-card">
      <div class="pv-head">${label}<a class="pv-channel" href="${CHANNEL_URL}" target="_blank" rel="noopener">유튜브 채널 ›</a></div>
      <div class="pv-frame">${screen}</div>
      <div class="pv-info">${info}${more}</div>
    </div>`;
  }

  // 누르기는 한 번만 걸어 둔다(방송이 시작·끝나 다시 그려도 그대로 동작)
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-src], [data-id]");
    const frame = box.querySelector(".pv-frame");
    if (!b || !box.contains(b) || !frame) return;
    const src = b.getAttribute("data-src") || `https://www.youtube.com/embed/${b.getAttribute("data-id")}?autoplay=1&rel=0`;
    frame.innerHTML = player(src);
    if (b.hasAttribute("data-id") && data && data.recent) {
      const v = data.recent.find((r) => r.id === b.getAttribute("data-id"));
      const info = box.querySelector(".pv-info");
      if (v && info) {
        const rest = data.recent.filter((r) => r.id !== v.id).slice(0, 2);
        info.innerHTML = `<p class="pv-title">${esc(v.title)}</p><p class="pv-meta">${[v.passage, v.service, v.preacher].filter(Boolean).map(esc).join(" · ")}</p>` +
          (rest.length ? `<div class="pv-more">${rest.map((o) => `<button type="button" class="pv-chip" data-id="${o.id}"><b>${esc(o.service || "설교")}</b> ${esc(o.title)}</button>`).join("")}</div>` : "");
      }
    }
  });

  // 한 시간마다 새로 받아오도록 주소 끝에 시간 표시
  Promise.all([
    fetch("data/youtube.json?h=" + Math.floor(Date.now() / 3600000), { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    liveStatus(),
  ]).then(([d, st]) => { data = d; render(st); });

  // 방송이 시작되거나 끝나면 2분 안에 칸을 바꾼다(영상을 이미 틀어 놓았으면 그대로 둔다)
  setInterval(() => {
    if (box.querySelector(".pv-frame iframe")) return;
    liveStatus().then((st) => { if (!!st.live !== shownLive) render(st); });
  }, 120000);
})();
