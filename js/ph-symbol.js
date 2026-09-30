/* 메뉴 표지(초록 화면)마다 교회 심벌의 한 부분을 금색으로 그려 보여 준다.
   심벌 전체는 흐리게 두고, 그 메뉴와 짝인 획만 그려지듯 나타난다. 누르면 '심볼 이야기'가 열린다.
     N  노진리, 함께 세워져 갈 공동체  → 공동체와 양육(story.html)
     J  십자가로 이어지는 길          → 예배와 말씀(word.html)
     C  이 땅을 품는 교회            → 교회 안내(welcome.html)
     ─  이웃과 이 땅으로             → 선교와 사역(world.html)
   <section class="page-hero" data-symbol="N|J|C|L"> 에 붙는다. 좌표는 심볼 이야기(welcome.html #symbol)와 같은 로고 최종안. */
(function () {
  const hero = document.querySelector(".page-hero[data-symbol]");
  if (!hero) return;
  const key = hero.getAttribute("data-symbol");
  const MAIN = "M177.42 73.52A78 78 0 1 0 63.66 177.21Q72.61 184.28 74.26 173.52L82.79 117.91Q84.00 110.00 89.49 115.82L142.45 172.00Q150.00 180.00 161.00 180.00L212.00 180.00";
  const CROSS = [
    "M144.80 67.90L148.80 67.20L155.20 66.70L154.77 90.85L145.23 91.15Z",
    "M117.10 94.40L136 94.48L184.60 93.30L183.70 96.50L184.20 98.60L183.30 101.50L162 102.66L115.10 104.00L116.60 100.60L115.50 99.00L116.40 96.60Z",
    "M145.50 106.15L154.50 105.75L153.20 178.00L146.80 178.00Z",
  ];
  const PART = {
    N: { text: "노진리, 함께 세워져 갈 공동체", stroke: "M63.66 177.21Q72.61 184.28 74.26 173.52L82.79 117.91Q84.00 110.00 89.49 115.82L150.00 180.00" },
    J: { text: "십자가로 이어지는 길", stroke: "M122.28 150.60L150.00 180.00", cross: true },
    C: { text: "이 땅을 품는 교회", stroke: "M177.42 73.52A78 78 0 1 0 63.66 177.21" },
    L: { text: "이웃과 이 땅으로", stroke: "M150.00 180.00L212.00 180.00" },
  }[key];
  if (!PART) return;
  const svg = `<svg viewBox="30 16 192 192" aria-hidden="true">
      <g class="phs-base"><path d="${MAIN}" fill="none" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>${CROSS.map((d) => `<path d="${d}"/>`).join("")}</g>
      ${PART.cross ? `<g class="phs-fill">${CROSS.map((d) => `<path d="${d}"/>`).join("")}</g>` : ""}
      <path class="phs-draw" d="${PART.stroke}" pathLength="1" fill="none" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  const a = document.createElement("a");
  a.className = "ph-symbol";
  a.href = "welcome.html#symbol";
  a.title = "노진교회 심볼 이야기 보기";
  a.innerHTML = `${svg}<span class="phs-text"><b class="${key === "L" ? "is-line" : ""}">${key === "L" ? "" : key}</b>${PART.text}</span>`;
  hero.insertBefore(a, hero.firstChild);
})();
