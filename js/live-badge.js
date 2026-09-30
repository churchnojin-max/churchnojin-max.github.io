/* '실시간 예배 영상보기' 단추의 점 — 주일 오전 11:30 ~ 오후 4:00(한국 시간)에만 빨갛게 깜빡이고,
   그 밖의 시간에는 회색으로 가만히 있는다. 보는 사람 컴퓨터의 시간대와 상관없이 한국 시간 기준.
   시간을 바꾸려면 아래 START·END(분 단위, 0시 기준)만 고치면 된다. */
(function () {
  const btn = document.querySelector(".live-float");
  if (!btn) return;
  const START = 11 * 60 + 30, END = 16 * 60;
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  function update() {
    const parts = {};
    fmt.formatToParts(new Date()).forEach((p) => { parts[p.type] = p.value; });
    const mins = (parseInt(parts.hour, 10) % 24) * 60 + parseInt(parts.minute, 10);
    const live = parts.weekday === "Sun" && mins >= START && mins < END;
    btn.classList.toggle("is-live", live);
    btn.setAttribute("title", live ? "지금 주일 예배를 실시간으로 방송하고 있습니다" : "주일 오전 11시 30분부터 실시간 예배가 방송됩니다");
  }
  update();
  setInterval(update, 30000);
})();
