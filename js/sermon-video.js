/* '예배와 말씀' 첫 화면 오른쪽 — 그 주 설교 영상 창
   · 평소: 가장 최근 주일낮예배 설교(data/youtube.json — GitHub 가 자동으로 새로 적음, tools/update_youtube.py)
   · 주일 오전 11:30 ~ 오후 4:00(한국 시간): '지금 실시간 예배 중' — 누르면 교회 채널의 실시간 방송
   · 처음에는 사진(썸네일)만 보여 주고, 누르면 그 자리에서 영상이 재생된다(첫 화면을 가볍게).
   · 목록 파일을 못 읽으면 채널의 최신 영상 목록을 그대로 띄운다. */
(function () {
  const box = document.getElementById("phVideo");
  if (!box) return;
  const CHANNEL = "UCYlesUmTrHecsHYmQNFYY1A";
  const CHANNEL_URL = "https://www.youtube.com/@노진교회";
  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function isLiveTime() {
    const parts = {};
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date()).forEach((p) => { parts[p.type] = p.value; });
    const m = (parseInt(parts.hour, 10) % 24) * 60 + parseInt(parts.minute, 10);
    return parts.weekday === "Sun" && m >= 690 && m < 960;
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

  function render(data) {
    const live = isLiveTime();
    const main = data && data.sermon;
    const others = data && data.recent ? data.recent.filter((r) => !main || r.id !== main.id).slice(0, 2) : [];
    let screen, label, info;
    if (live) {
      label = `<span class="pv-label is-live"><i></i>지금 실시간 예배 중</span>`;
      screen = `<button type="button" class="pv-screen pv-screen-live" data-src="https://www.youtube.com/embed/live_stream?channel=${CHANNEL}&autoplay=1" aria-label="실시간 예배 보기">
        <span class="pv-live-txt">주일 예배<br />실시간 방송</span><span class="pv-play" aria-hidden="true"></span></button>`;
      info = main ? `<p class="pv-sub">지난 설교: <button type="button" class="pv-link" data-id="${main.id}">${esc(main.title)} ▶</button></p>` : "";
    } else if (main) {
      label = `<span class="pv-label">이번 주 설교 영상</span>`;
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
    const frame = box.querySelector(".pv-frame");
    box.addEventListener("click", (e) => {
      const b = e.target.closest("[data-src], [data-id]");
      if (!b || !box.contains(b)) return;
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
  }

  // 한 시간마다 새로 받아오도록 주소 끝에 시간 표시
  fetch("data/youtube.json?h=" + Math.floor(Date.now() / 3600000), { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then(render);
})();
