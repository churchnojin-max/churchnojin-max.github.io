/* 첫 화면 움직이는 그림 — 배경 그림(images/hero-bg-wilderness.jpg) 위에 겹쳐 그린다.
   · 하늘의 별이 반짝인다(모든 화면).
   · 아브라함이 지팡이를 짚고 오른쪽에서 걸어와 재단 앞에 멈추고, 걸은 자리에 발자국이 찍힌다.
     멈춘 뒤에는 고개를 들어 하늘의 별을 바라본다(창 15:5).
     첫 화면이 다시 보일 때마다 오른쪽에서 새로 걸어 나온다.
     (휴대폰처럼 땅이 거의 안 보이는 좁은 화면에서는 별만 반짝인다)
   좌표는 모두 배경 그림의 픽셀(2000×1332) 기준. 화면 크기에 맞춰 그림이 잘려 보이는 만큼(cover)
   viewBox 를 계산해서, 겹쳐 그린 것이 배경 그림과 정확히 맞물리게 한다. */
(function () {
  const hero = document.getElementById("home");
  if (!hero) return;
  const IMG_W = 2000, IMG_H = 1332;
  const NS = "http://www.w3.org/2000/svg";

  // 그림 속 별 자리(배경 그림을 분석해 찾은 위치 x, y, 크기)
  const STARS = [
    [855, 46, 80], [1229, 364, 88], [1488, 552, 90], [643, 226, 62], [1599, 405, 34], [1864, 91, 28],
    [221, 381, 30], [463, 177, 28], [670, 368, 18], [1567, 69, 22], [1749, 109, 26], [1844, 260, 20],
    [1702, 518, 10], [1004, 39, 12], [101, 433, 14], [208, 172, 10], [797, 266, 7], [438, 296, 7], [1678, 327, 7],
  ];
  const ALTAR_RIGHT = 613;   // 재단 오른쪽 끝(x)
  const ALTAR_FOOT = 1108;   // 재단 밑동(y) — 아브라함이 멈추는 땅 높이

  // 아브라함(발바닥 0,0 · 키 100 · 왼쪽을 보고 걷는다)
  const INK = "#17110d";
  const ABRAHAM = `
    <ellipse cx="0" cy="-.4" rx="17" ry="2.6" fill="#3a2618" opacity=".28"/>
    <g class="hw-bob">
      <g class="hw-leg hw-leg-b" transform="translate(1.5 -44)"><g><path d="M0 0L0 42" stroke="#2c2018" stroke-width="3.4" stroke-linecap="round"/><ellipse cx="-2.2" cy="43" rx="3.8" ry="1.5" fill="#1a120d"/></g></g>
      <g class="hw-leg hw-leg-a" transform="translate(-1.5 -44)"><g><path d="M0 0L0 42" stroke="#1d1510" stroke-width="3.4" stroke-linecap="round"/><ellipse cx="-2.2" cy="43" rx="3.8" ry="1.5" fill="#150f0b"/></g></g>
      <g transform="translate(0 -80)"><g class="hw-robe"><g transform="translate(0 80)">
        <path d="M-6-80C-9.2-74-11.4-62-11.8-48C-12.2-32-13.2-16-14.4-3.5L13-3.5C12.4-18 11.6-34 11.2-48C11-62 10-74 6-80Z" fill="#2e2219"/>
        <path d="M-11.9-50C-6-51.6-1-51.6 1.5-50.6" stroke="#7d6349" stroke-width="1.5" fill="none"/>
        <g stroke="#4a382b" stroke-width=".6" fill="none"><path d="M-9-45C-10-30-11-17-12-5"/><path d="M-4.5-46C-5-30-5.5-17-6-5"/></g>
        <path d="M-4.5-80.5C-1-82 4-82 7.5-80C11.5-76 13.6-68 13.8-58C14-42 13.4-22 14.8-3.5L2-3.5C1.2-20 .2-40-1.5-56C-2.4-66-3.8-74-4.5-80.5Z" fill="#19110c"/>
        <g stroke="#34271e" stroke-width=".6" fill="none"><path d="M8-70C9.5-50 9.5-25 10-5"/><path d="M4-60C5-40 5-22 5.5-5"/></g>
        <path d="M11.6-82.5C12.8-76 13.8-68 13.8-58C14-42 13.4-22 14.8-3.5" stroke="#EBA868" stroke-width=".9" fill="none" opacity=".7"/>
      </g></g></g>
      <g transform="translate(-4 -76)"><g class="hw-staff"><g transform="translate(4 76)">
        <path d="M-18.2 0L-16.4-86C-16.3-92.5-22.6-93.6-23-88.4" stroke="#3b2a1c" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <path d="M-1.8-78C-5.4-74-8.4-68-10.6-63L-15.6-61.6C-16.4-60.2-15.8-58.6-14.4-58.4L-9-58.8C-7.4-59-6-60-5-61.6C-3.4-65-1.6-69.4.6-73Z" fill="#231812"/>
        <ellipse cx="-16.2" cy="-60" rx="1.9" ry="2.2" fill="#3d2b1f"/>
      </g></g></g>
      <g transform="translate(1 -80)"><g class="hw-headturn"><g transform="translate(-1 80)">
        <path d="M-3-79C-4-83-6.4-84.6-7.8-86.2L-9.7-86.8L-7.6-89.4C-7.4-91-7.5-92.2-7.9-93.2L-2-93L2-84Z" fill="#3a281d"/>
        <path d="M-8.8-92.6C-8-98.6.5-101.2 5-98C8.4-95.2 10.4-89.4 11.6-82.5C12.4-78.4 12.6-75.5 12.2-72.5L6-76C4.4-80.5 2.6-85.5-1.2-88.6C-3.6-90.6-6.2-91.6-8.8-92.6Z" fill="#1d1510"/>
        <path d="M-8.4-92.2C-3-94.6 3-95.4 8.8-93" stroke="#7d6349" stroke-width=".9" fill="none"/>
        <path d="M-7.6-86.3C-8.8-83.6-10.3-79.8-10.3-76C-10.3-72.8-9-70.3-7-68.8C-6.4-71.8-4.8-75.6-3-79.2C-4-82.4-5.6-85-7.6-86.3Z" fill="#a08f7b"/>
        <g stroke="#6f614f" stroke-width=".45" fill="none"><path d="M-8.2-83C-9-79-8.8-75-7.6-71.5"/><path d="M-6-82C-6.6-78-6.6-75-5.8-72.8"/></g>
        <path d="M5-98C8.4-95.2 10.4-89.4 11.6-82.5" stroke="#EBA868" stroke-width=".9" fill="none" opacity=".75"/>
      </g></g></g>
    </g>`;

  // ---------- 겹쳐 그릴 판 ----------
  const layer = document.createElement("div");
  layer.className = "hero-sky";
  layer.setAttribute("aria-hidden", "true");
  let stars = "";
  let seed = 11;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  STARS.forEach(([x, y, s]) => {
    const r = Math.max(7, s * 0.42), dur = (2.2 + rnd() * 2.6).toFixed(2), dl = (-rnd() * 4).toFixed(2);
    stars += `<g transform="translate(${x} ${y})"><g class="hw-star" style="animation-duration:${dur}s;animation-delay:${dl}s">
      <circle r="${(r * 1.5).toFixed(1)}" fill="url(#hwGlow)"/>
      <path d="M0 ${-r}Q${r * 0.12} ${-r * 0.12} ${r} 0Q${r * 0.12} ${r * 0.12} 0 ${r}Q${-r * 0.12} ${r * 0.12} ${-r} 0Q${-r * 0.12} ${-r * 0.12} 0 ${-r}Z" fill="#FFF4DE"/>
    </g></g>`;
  });
  layer.innerHTML = `<svg preserveAspectRatio="none">
    <defs>
      <radialGradient id="hwGlow"><stop offset="0" stop-color="#FFF6E4" stop-opacity=".85"/><stop offset=".35" stop-color="#FFE9C4" stop-opacity=".35"/><stop offset="1" stop-color="#FFE0B0" stop-opacity="0"/></radialGradient>
      <filter id="hwInk" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.1"/>
      </filter>
    </defs>
    <g class="hw-stars">${stars}</g>
    <g class="hw-prints" filter="url(#hwInk)"></g>
    <g class="hw-walker" filter="url(#hwInk)"><g class="hw-body">${ABRAHAM}</g></g>
  </svg>`;
  hero.insertBefore(layer, hero.firstChild);
  const svg = layer.querySelector("svg");
  const prints = layer.querySelector(".hw-prints");
  const walker = layer.querySelector(".hw-walker");
  const body = layer.querySelector(".hw-body");

  // ---------- 화면에 맞추기 ----------
  let G = null; // 이번 화면 크기에서의 길 정보
  function measure() {
    const W = hero.clientWidth, H = hero.clientHeight;
    const cs = getComputedStyle(hero);
    const pos = cs.backgroundPosition.split(",").pop().trim().split(/\s+/);
    const pct = (v, d) => (/%$/.test(v) ? parseFloat(v) / 100 : d);
    const px = pct(pos[0], 0.5), py = pct(pos[1] || pos[0], 0.5);
    const s = Math.max(W / IMG_W, H / IMG_H);
    const vx = ((IMG_W * s - W) * px) / s, vy = ((IMG_H * s - H) * py) / s, vw = W / s, vh = H / s;
    svg.setAttribute("viewBox", `${vx.toFixed(2)} ${vy.toFixed(2)} ${vw.toFixed(2)} ${vh.toFixed(2)}`);

    // 걸어갈 땅 높이: 재단 밑동, 화면 아래가 잘리면 그만큼 위로
    const bottomImg = vy + (H - 12) / s;
    const feetY = Math.min(ALTAR_FOOT, bottomImg);
    // 키: 설교 상자·제목 아래 빈 땅에 들어가는 만큼(최대 재단의 1.5배쯤)
    const hr = hero.getBoundingClientRect();
    let textBottom = 0;
    hero.querySelectorAll(".hero-headline, .hero-sermon-banner").forEach((el) => {
      if (el.offsetParent) textBottom = Math.max(textBottom, el.getBoundingClientRect().bottom - hr.top);
    });
    const feetScreen = (feetY - vy) * s;
    const heightScreen = Math.min(210 * s, feetScreen - textBottom - 10);
    const k = heightScreen / s / 100;             // 아브라함 1단위 = 그림 몇 픽셀
    const endX = ALTAR_RIGHT + 24 * k;
    const startX = vx + vw + 30 * k;
    const ok = W >= 761 && heightScreen >= 70 && endX > vx && endX < vx + vw && startX - endX > 200;
    G = ok ? { k, feetY, startX, endX, startY: Math.min(feetY + 14, bottomImg) } : null;
    layer.classList.toggle("no-walker", !ok);
  }

  // ---------- 걷기 ----------
  const HALF = 0.5;                     // 한 걸음(초) — css 의 walk 한 바퀴(1초)의 절반
  const STRIDE = 2 * 42 * Math.sin((20 * Math.PI) / 180); // 한 걸음 길이(아브라함 단위)
  let raf = 0, t0 = 0, steps = 0, running = false;

  function place(x, y) {
    walker.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${G.k.toFixed(3)})`);
  }
  function addPrint(x, y, n) {
    const k = G.k, side = n % 2 ? 1 : -1;
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "hw-print");
    g.setAttribute("transform", `translate(${x.toFixed(1)} ${(y + side * 2.4 * k).toFixed(1)}) scale(${k.toFixed(3)})`);
    const rot = ((n * 37) % 11) - 5;
    g.innerHTML = `<g transform="rotate(${rot})"><ellipse cx="-2.8" cy="0" rx="5.2" ry="2" transform="rotate(-5 -2.8 0)"/><ellipse cx="4.4" cy=".2" rx="2.7" ry="1.7"/></g>`;
    prints.appendChild(g);
  }
  function reset() {
    cancelAnimationFrame(raf);
    running = false;
    prints.textContent = "";
    body.classList.remove("is-walking", "is-still", "is-looking");
    walker.style.opacity = "0";
  }
  function start(delay) {
    reset();
    measure();
    if (!G) return;
    // 도착하는 순간 두 다리가 모이도록(걸음 중간) 멈출 자리를 반 걸음 안에서 맞춘다
    const speed = (STRIDE / HALF) * G.k;
    const n = Math.max(1, Math.round(((G.startX - G.endX) / speed - HALF / 2) / HALF));
    G.endX = G.startX - speed * (n * HALF + HALF / 2);
    place(G.startX, G.startY);
    walker.style.opacity = "1";
    running = true;
    steps = 0;
    setTimeout(() => {
      if (!running) return;
      void body.offsetWidth;            // 걷는 동작을 처음부터 다시
      body.classList.add("is-walking");
      t0 = performance.now();
      raf = requestAnimationFrame(tick);
    }, delay || 0);
  }
  function tick(now) {
    const t = (now - t0) / 1000;
    const speed = (STRIDE / HALF) * G.k;           // 그림 픽셀/초
    const dist = G.startX - G.endX;
    const p = Math.min(1, (speed * t) / dist);
    const x = G.startX - dist * p, y = G.startY + (G.feetY - G.startY) * p;
    place(x, y);
    // 앞발이 땅에 닿는 순간마다 발자국
    while (steps <= Math.floor(t / HALF) && p < 1) {
      const tp = steps * HALF, pp = Math.min(1, (speed * tp) / dist);
      const fx = G.startX - dist * pp - (STRIDE / 2) * G.k, fy = G.startY + (G.feetY - G.startY) * pp;
      addPrint(fx, fy, steps);
      steps++;
    }
    if (p < 1) { raf = requestAnimationFrame(tick); return; }
    // 재단 앞에 도착: 멈추고, 잠시 뒤 고개를 들어 별을 본다
    body.classList.remove("is-walking");
    body.classList.add("is-still");
    setTimeout(() => { if (running) body.classList.add("is-looking"); }, 900);
  }

  // 첫 화면이 다시 보일 때마다 오른쪽에서 새로 걸어 나온다
  let visible = false;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => es.forEach((e) => {
      layer.classList.toggle("is-paused", !e.isIntersecting);
      if (e.intersectionRatio >= 0.6 && !visible) { visible = true; start(900); }
      else if (e.intersectionRatio < 0.15 && visible) { visible = false; reset(); }
    }), { threshold: [0, 0.15, 0.6] }).observe(hero);
  } else {
    start(900);
  }
  let lastW = 0, lastH = 0, rt = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const W = hero.clientWidth, H = hero.clientHeight;
      if (W === lastW && Math.abs(H - lastH) < 60) { measure(); return; }
      lastW = W; lastH = H;
      if (visible) start(300); else measure();
    }, 250);
  });
  lastW = hero.clientWidth; lastH = hero.clientHeight;
  measure();
})();
