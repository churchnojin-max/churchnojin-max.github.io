/* '실시간 예배 영상보기' 단추 — 방송 중일 때만 보이고(2026-10-10), 점 — 실제로 방송 중일 때만 빨갛게 깜빡이고, 아니면 회색으로 가만히 있는다.
   방송 중인지는 js/live-status.js 가 알려 준다(사무실 PC 가 주일 10:20~16:00 2분마다 유튜브를 보고 적은 값,
   그 값이 없으면 주일 10:30~16:00 시간으로 짐작). 방송 중이면 단추가 그 방송 영상으로 바로 간다. (2026-10-04) */
(function () {
  const btn = document.querySelector(".live-float");
  if (!btn) return;
  const DEFAULT_HREF = btn.getAttribute("href");
  function update() {
    const p = window.LiveStatus ? window.LiveStatus.get() : Promise.resolve({ live: false });
    p.then((s) => {
      btn.classList.toggle("is-live", !!s.live);
      btn.hidden = !s.live;   // 방송 중일 때만 보인다(2026-10-10 목사님)
      btn.setAttribute("title", s.live ? "지금 주일 예배를 실시간으로 방송하고 있습니다" : "주일 오전 10시 30분 무렵부터 실시간 예배가 방송됩니다");
      btn.setAttribute("href", s.live && s.id ? "https://www.youtube.com/watch?v=" + s.id : DEFAULT_HREF);
    });
  }
  update();
  setInterval(update, 60000);
})();
