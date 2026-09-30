/* 우리 이야기 표지 — 다음 세대 여름성경학교(2026) 단체 사진을 바탕으로 한 움직이는 그림.
   영상 파일 대신 SVG + CSS 애니메이션으로 그린다(가볍고, 휴대폰에서도 선명하다).
   <div class="story-scene" data-story-scene></div> 자리에 그려 넣는다. */
(function () {
  const host = document.querySelector("[data-story-scene]");
  if (!host) return;

  const SKIN = ["#F6D5BC", "#F0C7A6", "#F3CDB2", "#EDC09C"];
  const HAIR = "#2B2420";
  const BLACK = "#23252A";
  const WHITE = "#FDFDFB";

  // 머리 모양 (머리 중심 0,0 · 반지름 21 기준)
  const HAIR_BACK = {
    long: '<rect x="-25" y="-14" width="50" height="50" rx="20"/>',
    bob: '<rect x="-25" y="-12" width="50" height="32" rx="14"/>',
    tied: '<circle cx="0" cy="-23" r="9"/>',
    pony: '<ellipse cx="21" cy="-6" rx="8" ry="16" transform="rotate(-18 21 -6)"/>',
  };
  const HAIR_FRONT = {
    short: '<path d="M-22 1C-25-27 25-27 22 1C19-9 11-13 0-12C-11-13-19-9-22 1Z"/>',
    kid: '<path d="M-22 3C-26-28 26-28 22 3C18-5 8-9 0-8C-8-9-18-5-22 3Z"/>',
    long: '<path d="M-23 8C-26-28 26-28 23 8C21-6 12-14 2-14C-4-6-14-2-23 8Z"/>',
    bob: '<path d="M-24 6C-27-27 27-27 24 6C20-4 10-10 0-10C-10-10-20-4-24 6Z"/>',
    tied: '<path d="M-22 0C-24-26 24-26 22 0C18-10 10-13 0-13C-10-13-18-10-22 0Z"/>',
    pony: '<path d="M-22 1C-24-26 24-26 22 1C18-9 8-14-2-13C-10-12-18-8-22 1Z"/>',
  };

  // 팔: 어깨(0,0)에서 시작. side = 1(오른쪽) / -1(왼쪽)
  function arm(kind, side, shirt, skin) {
    const s = side;
    const sleeve = `<path d="M0 0L${3 * s} 13" stroke="${shirt}" stroke-width="15" stroke-linecap="round"/>`;
    const out = shirt === WHITE ? `<path d="M0 0L${3 * s} 13" stroke="#D9D6CF" stroke-width="17" stroke-linecap="round"/>` : "";
    const limb = (d) => `<path d="${d}" stroke="${skin}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    if (kind === "rest") return out + limb(`M${2 * s} 8L${6 * s} 30L${-2 * s} 54`) + sleeve + `<circle cx="${-2 * s}" cy="56" r="5.5" fill="${skin}"/>`;
    if (kind === "knees") return out + limb(`M${2 * s} 8L${2 * s} 32L${-14 * s} 44`) + sleeve + `<circle cx="${-15 * s}" cy="44" r="5.5" fill="${skin}"/>`;
    if (kind === "chin") return out + limb(`M${2 * s} 8L${10 * s} 26L${-16 * s} -12`) + sleeve + `<circle cx="${-17 * s}" cy="-14" r="5.5" fill="${skin}"/>`;
    // 손 흔들기 · 브이 · 만세: 윗팔은 그대로, 아래팔만 팔꿈치에서 흔든다
    const ex = 17 * s, ey = -20;
    const hand = kind === "v"
      ? `<path d="M0-30L-4-44M0-30L4-44" stroke="${skin}" stroke-width="3.6" stroke-linecap="round"/><circle cx="0" cy="-30" r="5.5" fill="${skin}"/>`
      : `<circle cx="0" cy="-31" r="6" fill="${skin}"/>`;
    const cls = kind === "v" ? "ss-shake" : kind === "cheer" ? "ss-cheer" : "ss-wave";
    return out + limb(`M${2 * s} 6L${ex} ${ey}`) + sleeve +
      `<g transform="translate(${ex} ${ey})"><g class="${cls}">${limb("M0 0L1 -27")}${hand}</g></g>`;
  }

  function person(p) {
    const skin = SKIN[p.skin || 0];
    const shirt = p.shirt === "w" ? WHITE : BLACK;
    const pants = p.pants || "#3B4150";
    const edge = p.shirt === "w" ? ' stroke="#D9D6CF" stroke-width="2"' : "";
    const arms = p.arms || ["rest", "rest"];

    let legs = "";
    if (p.pose === "sit") {
      legs = `<rect x="-24" y="-6" width="48" height="14" rx="7" fill="${pants}"/>
        <rect x="-19" y="0" width="15" height="48" rx="7" fill="${pants}"/><rect x="4" y="0" width="15" height="48" rx="7" fill="${pants}"/>
        <ellipse cx="-12" cy="51" rx="11" ry="6" fill="#F1C94A"/><ellipse cx="12" cy="51" rx="11" ry="6" fill="#F1C94A"/>`;
    } else if (p.pose === "cross") {
      legs = `<ellipse cx="0" cy="4" rx="48" ry="14" fill="${pants}"/>
        <ellipse cx="-34" cy="10" rx="10" ry="6" fill="#fff"/><ellipse cx="34" cy="10" rx="10" ry="6" fill="#fff"/>`;
    } else if (p.pose === "crouch") {
      // 쪼그려 앉은 다리: 무릎이 양옆으로 벌어지고 발은 아래에
      legs = `<rect x="-22" y="-7" width="44" height="14" rx="7" fill="${pants}"/>
        <path d="M-9-2L-24 16L-19 36M9-2L24 16L19 36" stroke="${pants}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <ellipse cx="-19" cy="41" rx="11" ry="5.5" fill="#E9E6DF"/><ellipse cx="19" cy="41" rx="11" ry="5.5" fill="#E9E6DF"/>`;
    } else if (p.pose === "stand") {
      // 서 있는 다리
      legs = `<rect x="-22" y="-8" width="44" height="16" rx="6" fill="${pants}"/>
        <rect x="-19" y="0" width="16" height="66" rx="7" fill="${pants}"/><rect x="3" y="0" width="16" height="66" rx="7" fill="${pants}"/>
        <ellipse cx="-12" cy="68" rx="11" ry="5.5" fill="#E9E6DF"/><ellipse cx="12" cy="68" rx="11" ry="5.5" fill="#E9E6DF"/>`;
    }
    const kneesFront = p.pose === "knees"
      ? `<rect x="-22" y="-40" width="20" height="50" rx="10" fill="${pants}"/><rect x="2" y="-40" width="20" height="50" rx="10" fill="${pants}"/>
         <ellipse cx="-12" cy="12" rx="12" ry="6" fill="#28324A"/><ellipse cx="12" cy="12" rx="12" ry="6" fill="#28324A"/>` : "";

    const hb = HAIR_BACK[p.hair] ? `<g fill="${HAIR}">${HAIR_BACK[p.hair]}</g>` : "";
    const glasses = p.glasses
      ? '<g fill="none" stroke="#3a3a3a" stroke-width="1.8"><circle cx="-8" cy="2" r="6"/><circle cx="8" cy="2" r="6"/><path d="M-2 2H2"/></g>' : "";
    const prop = p.bag ? '<g transform="translate(-58 -30)"><path d="M8 2C8-10 26-10 26 2" fill="none" stroke="#1F2A55" stroke-width="3"/><rect x="0" y="0" width="34" height="40" rx="3" fill="#24306A"/><rect x="11" y="10" width="12" height="3" fill="#C9B37A"/></g>' : "";

    return `<g transform="translate(${p.x} ${p.y}) scale(${p.s || 1})">
      <g class="ss-p ${p.anim || "ss-breathe"}" style="animation-delay:${p.d || 0}s">
        ${legs}
        <g transform="translate(0 -92)">${hb}</g>
        <rect x="-6" y="-76" width="12" height="12" fill="${skin}"/>
        <path d="M-26-64Q-31-38-24 0L24 0Q31-38 26-64Q0-72-26-64Z" fill="${shirt}"${edge}/>
        <text x="0" y="-28" class="ss-lord">LORD</text>
        ${kneesFront}
        <g transform="translate(-24 -60)">${arm(arms[0], -1, shirt, skin)}</g>
        <g transform="translate(24 -60)">${arm(arms[1], 1, shirt, skin)}</g>
        ${prop}
        <g transform="translate(0 -92)"><g class="${p.nod ? "ss-nod" : ""}" style="animation-delay:${(p.d || 0) + 0.4}s">
          <circle r="21" fill="${skin}"/>
          <circle cx="-12" cy="9" r="4" fill="#F29C9C" opacity=".4"/><circle cx="12" cy="9" r="4" fill="#F29C9C" opacity=".4"/>
          <g class="ss-blink" style="animation-delay:${(p.d || 0) * 1.7}s"><circle cx="-7.5" cy="2" r="2.3" fill="#2b2b2b"/><circle cx="7.5" cy="2" r="2.3" fill="#2b2b2b"/></g>
          <path d="M-5.5 9Q0 14 5.5 9" fill="none" stroke="#9A4B3E" stroke-width="2" stroke-linecap="round"/>
          <g fill="${HAIR}">${HAIR_FRONT[p.hair] || HAIR_FRONT.short}</g>
          ${glasses}
        </g></g>
      </g></g>`;
  }

  // 사진 속 자리 그대로(뒷줄은 무대 끝에 걸터앉고, 앞줄은 바닥에)
  const BACK = [
    { x: 612, y: 268, s: .92, pose: "stand", hair: "pony", shirt: "w", skin: 1, arms: ["rest", "wave"], anim: "ss-breathe", d: 1.2 },
    { x: 150, y: 338, s: .95, pose: "sit", hair: "short", shirt: "w", arms: ["rest", "wave"], anim: "ss-sway", d: 0, pants: "#5A5C62" },
    { x: 212, y: 342, s: .66, pose: "sit", hair: "kid", shirt: "b", glasses: 1, anim: "ss-hop", d: .3, skin: 2 },
    { x: 278, y: 338, s: .93, pose: "sit", hair: "long", shirt: "b", skin: 2, anim: "ss-sway", d: .8, pants: "#D8CFBF" },
    { x: 350, y: 338, s: .93, pose: "sit", hair: "bob", shirt: "b", glasses: 1, anim: "ss-breathe", nod: 1, d: .5, pants: "#2E2F33" },
    { x: 422, y: 338, s: .93, pose: "sit", hair: "tied", shirt: "b", skin: 3, anim: "ss-sway", d: 1.6, pants: "#2E2F33" },
    { x: 494, y: 338, s: .95, pose: "sit", hair: "short", shirt: "b", arms: ["rest", "chin"], anim: "ss-breathe", nod: 1, d: 2.1, pants: "#4A6EA0" },
    { x: 566, y: 338, s: .95, pose: "sit", hair: "short", shirt: "w", skin: 1, anim: "ss-sway", d: 2.6, pants: "#34363C" },
  ];
  const FRONT = [
    { x: 196, y: 452, s: .78, pose: "cross", hair: "kid", shirt: "w", glasses: 1, arms: ["rest", "v"], bag: 1, anim: "ss-hop", d: .9, pants: "#7B8A9B" },
    { x: 318, y: 456, s: 1.02, pose: "cross", hair: "long", shirt: "b", skin: 2, anim: "ss-sway", d: 1.4, pants: "#1E1F22" },
    { x: 440, y: 452, s: .9, pose: "knees", hair: "long", shirt: "b", arms: ["knees", "knees"], anim: "ss-breathe", nod: 1, d: .2, pants: "#9AA3AE" },
    { x: 562, y: 456, s: 1.02, pose: "cross", hair: "short", shirt: "b", skin: 3, anim: "ss-sway", d: 2.2, pants: "#1E1F22" },
    { x: 648, y: 422, s: .95, pose: "crouch", hair: "long", shirt: "b", arms: ["rest", "wave"], anim: "ss-breathe", d: 3, pants: "#4A6EA0" },
  ];

  // 글자 상자(사진 양옆의 '살아가요' / '하나님나라')
  const COL = { b: "#2F6FD1", g: "#3E9B4F", y: "#F0BE2C", r: "#E0484E" };
  function tower(x, letters, delay0) {
    let out = "";
    letters.forEach(([ch, c], i) => {
      const y = 330 - i * 50;
      out += `<g class="ss-drop" style="animation-delay:${delay0 + i * 0.16}s"><g class="ss-boxhop" style="animation-delay:${3.2 + delay0 + i * 0.12}s">
        <rect x="${x}" y="${y}" width="76" height="50" rx="3" fill="#D4AE7E" stroke="#A9824F" stroke-width="2"/>
        <rect x="${x + 9}" y="${y + 6}" width="58" height="38" rx="2" fill="#fff"/>
        <rect x="${x + 12}" y="${y + 9}" width="52" height="32" rx="2" fill="${COL[c]}"/>
        <text x="${x + 38}" y="${y + 34}" class="ss-letter">${ch}</text></g></g>`;
    });
    return out;
  }

  // 색종이(고정된 난수로 매번 같은 모양)
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  let confetti = "";
  const cc = ["#2F6FD1", "#3E9B4F", "#F0BE2C", "#E0484E", "#F28DB0", "#7FC8E8"];
  for (let i = 0; i < 28; i++) {
    const x = Math.round(20 + rnd() * 760), w = 5 + rnd() * 4, dur = (6 + rnd() * 5).toFixed(1), dl = (-rnd() * 11).toFixed(1);
    confetti += `<rect class="ss-conf" x="${x}" y="-20" width="${w.toFixed(1)}" height="${(w * 1.6).toFixed(1)}" fill="${cc[i % cc.length]}" style="animation-duration:${dur}s;animation-delay:${dl}s"/>`;
  }

  // 천장 줄 깃발
  let bunting = '<path d="M0 14Q200 40 400 18Q600 40 800 14" fill="none" stroke="#B8A68C" stroke-width="1.5"/>';
  const bc = ["#E0484E", "#F0BE2C", "#3E9B4F", "#2F6FD1", "#F28DB0"];
  for (let i = 0; i < 20; i++) {
    const x = 12 + i * 40, yy = 14 + Math.sin((x / 400) * Math.PI) * 18;
    bunting += `<g transform="translate(${x} ${yy.toFixed(1)})"><path class="ss-flag" style="animation-delay:${(i * 0.13).toFixed(2)}s" d="M-11 0H11L0 20Z" fill="${bc[i % 5]}"/></g>`;
  }

  const fan = (x, y, r, d) => `<g transform="translate(${x} ${y})"><g class="ss-fan" style="animation-delay:${d}s">
      <circle r="${r}" fill="#A9DCEB"/><circle r="${r}" fill="none" stroke="#86C6DA" stroke-width="${r}" stroke-dasharray="3 4" transform="scale(.5)"/>
      <circle r="${r * 0.22}" fill="#6FB6CC"/></g></g>`;

  const notes = [["♪", 250, 0], ["♫", 470, 2.4], ["♪", 600, 4.6], ["♬", 360, 6.4]]
    .map(([t, x, d]) => `<text class="ss-note" x="${x}" y="250" style="animation-delay:${d}s">${t}</text>`).join("");

  host.innerHTML = `
  <svg viewBox="0 0 800 500" role="img" aria-label="여름성경학교를 마친 다음 세대 아이들과 선생님들이 무대 앞에 모여 손을 흔드는 그림">
    <defs>
      <linearGradient id="ssRainbow" x1="0" x2="1">
        <stop offset="0" stop-color="#F0BE2C"/><stop offset=".3" stop-color="#E0484E"/><stop offset=".55" stop-color="#F28DB0"/><stop offset=".8" stop-color="#2F9BD1"/><stop offset="1" stop-color="#3E9B4F"/>
      </linearGradient>
      <linearGradient id="ssWall" gradientUnits="userSpaceOnUse" x1="0" y1="-500" x2="0" y2="330"><stop offset="0" stop-color="#F7F4EC"/><stop offset="1" stop-color="#EDE8DC"/></linearGradient>
      <linearGradient id="ssFloor" gradientUnits="userSpaceOnUse" x1="0" y1="382" x2="0" y2="500"><stop offset="0" stop-color="#DCCBAE"/><stop offset="1" stop-color="#CDB894"/></linearGradient>
    </defs>
    <rect x="-2000" y="-1500" width="4800" height="2000" fill="url(#ssWall)"/>
    <g class="ss-lights"><circle cx="120" cy="6" r="7" fill="#FFF6D6"/><circle cx="400" cy="4" r="7" fill="#FFF6D6"/><circle cx="680" cy="6" r="7" fill="#FFF6D6"/></g>
    ${bunting}
    <!-- 스크린 -->
    <g>
      <rect x="244" y="48" width="312" height="176" rx="4" fill="#fff" stroke="#D6D0C3" stroke-width="3"/>
      <rect x="252" y="56" width="296" height="160" fill="#DDF4EE"/>
      <path class="ss-tri" d="M262 66l34 0-17 22z" fill="#F7A8C4"/><path class="ss-tri t2" d="M520 196l24 0-12-18z" fill="#6FB6E8"/>
      <path class="ss-tri t3" d="M530 70l14 14-20 4z" fill="#F4D35E"/><path class="ss-tri t2" d="M270 190l18-12 2 20z" fill="#F4D35E"/>
      <rect x="306" y="96" width="188" height="74" rx="4" fill="#F0668F"/>
      <rect x="330" y="86" width="40" height="14" fill="#F0668F"/><rect x="430" y="86" width="40" height="14" fill="#F0668F"/>
      <text x="400" y="126" class="ss-screen">앞으로도 살아갈</text>
      <text x="400" y="155" class="ss-screen">하나님 나라!</text>
      <g class="ss-stars" fill="#F0668F"><text x="400" y="200" class="ss-star">★ ★ ★ ★ ★</text></g>
    </g>
    ${fan(262, 262, 26, 0)}${fan(530, 250, 22, 1.5)}${fan(610, 236, 16, .7)}
    ${notes}
    <!-- 무대와 바닥 -->
    <rect x="-2000" y="330" width="4800" height="52" fill="#B7865A"/>
    <rect x="-2000" y="330" width="4800" height="7" fill="#C99A6C"/>
    <g stroke="#9E7149" stroke-width="2">${Array.from({ length: 40 }, (_, k) => 80 + (k - 17) * 120).map((x) => `<path d="M${x} 340V382"/>`).join("")}</g>
    <rect x="-2000" y="382" width="4800" height="400" fill="url(#ssFloor)"/>
    <g stroke="#C4AE88" stroke-width="1.5">${[410, 440, 472].map((y) => `<path d="M-2000 ${y}H2800"/>`).join("")}</g>
    ${tower(18, [["요", "b"], ["가", "y"], ["아", "g"], ["살", "b"]], 0)}
    ${tower(706, [["라", "r"], ["나", "b"], ["님", "y"], ["나", "g"], ["하", "r"]], 0.5)}
    ${BACK.map(person).join("")}
    ${FRONT.map(person).join("")}
    <g class="ss-confetti">${confetti}</g>
  </svg>`;

  // 컴퓨터(한 화면씩 넘기는 화면)에서는 그림이 다음 세대 화면 전체를 채운다.
  // 사람들은 오른쪽 아래에 두고, 왼쪽으로 이어지는 벽·무대 자리에 제목과 주일학교 조직이 놓인다.
  const svg = host.querySelector("svg");
  const stage = host.closest(".ng-stage");
  const wide = window.matchMedia("(min-width: 1025px) and (hover: hover) and (pointer: fine)");
  function fit() {
    if (!stage || !wide.matches || !document.documentElement.classList.contains("snap-page")) {
      svg.setAttribute("viewBox", "0 0 800 500");
      return;
    }
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return;
    const hdr = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hdr")) || 84;
    const sideEl = stage.querySelector(".ng-side");
    const textLeft = sideEl.getBoundingClientRect().left - stage.getBoundingClientRect().left;
    // 그림 자리: 조직도 오른쪽 ~ 화면 오른쪽(왼쪽 여백과 같은 만큼 띄움). 그 안 가운데에 둔다.
    const areaL = textLeft + sideEl.offsetWidth + 32, areaR = W - textLeft;
    const k = Math.min((areaR - areaL) / 800, (H - hdr - 12) / 500);  // 그림 배율
    const sceneLeft = areaL + (areaR - areaL - 800 * k) / 2;
    const vw = W / k, vh = H / k;
    svg.setAttribute("viewBox", `${(-sceneLeft / k).toFixed(1)} ${(500 - vh).toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`);
  }
  fit();
  window.addEventListener("resize", fit);
  if (wide.addEventListener) wide.addEventListener("change", fit);

  // 화면 밖에 있을 때는 멈춰서 배터리·CPU를 아낀다.
  // 처음에도 멈춘 채 시작하므로, 글자 상자는 이 그림까지 내려왔을 때 떨어진다.
  if ("IntersectionObserver" in window) {
    host.classList.add("is-paused");
    new IntersectionObserver((es) => es.forEach((e) => host.classList.toggle("is-paused", !e.isIntersecting))).observe(host);
  }
})();
