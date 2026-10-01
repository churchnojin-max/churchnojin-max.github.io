/* ============================================================
   교회 안내 표지 — 종탑·십자가·'노진교회'를 연필로 스케치한 그림 (2026-10-01)
   welcome.html 의 <section class="page-hero ph-spire-hero"> 오른쪽에 그린다(자리·크기는 css .ph-spire).
   - 짙은 초록 바탕에 크림색 연필 선. 같은 그림이 늘 같게 나오도록 정해 둔 난수로 손떨림을 만든다.
   - 겉선은 두세 번 겹쳐 긋고, 면은 빗금으로 명암을 넣는다(빛 받는 왼쪽 면은 촘촘히, 그늘진 오른쪽 면은 성기게).
   - 십자가와 글자는 또렷하게(목사님 요청: '십자가와 노진교회가 선명하게').
   - 표지가 화면에 들어올 때마다 연필로 그려 나가는 모습을 다시 보여 준다.
   ============================================================ */
(function () {
  const hero = document.querySelector(".ph-spire-hero");
  if (!hero) return;

  let seed = 1001;
  function rnd() {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + (b - a) * rnd();
  const f = (v) => String(Math.round(v * 10) / 10);

  // ---- 종탑 모양(viewBox 0 -110 900 1110) ----
  const TOP = 250, BOT = 1000, H = BOT - TOP, END = 1012;
  const xl = (y) => 442 - 102 * (y - TOP) / H;     // 왼쪽 모서리
  const xm = (y) => 450 + 30 * (y - TOP) / H;      // 가운데 능선(왼쪽 면이 더 넓게 보임)
  const xr = (y) => 458 + 102 * (y - TOP) / H;     // 오른쪽 모서리
  const seams = [];
  for (let k = 1; k < 12; k++) seams.push(TOP + H * Math.pow(k / 12, 1.3));
  const letters = Array.from("노진교회").map((ch, i) => {
    const y0 = seams[5 + i], y1 = seams[6 + i], yc = (y0 + y1) / 2, w = xm(yc) - xl(yc);
    return { ch, x: (xl(yc) + xm(yc)) / 2, y: yc, s: Math.min(0.72 * (y1 - y0), 0.66 * w) };
  });
  const letterRects = letters.map((l) => [l.x - l.s * 0.6, l.y - l.s * 0.62, l.x + l.s * 0.6, l.y + l.s * 0.62]);
  const CX = 450, CY = 119;
  const CROSS = [[443, 70], [457, 70], [457, 112], [502, 112], [502, 126], [457, 126], [457, 236], [443, 236],
                 [443, 126], [398, 126], [398, 112], [443, 112]];

  // ---- 연필 획 ----
  function stroke(d, w, op, t, u) {
    return `<path class="sk" d="${d}" stroke-width="${f(w)}" stroke-opacity="${op.toFixed(2)}" pathLength="1" style="--t:${t.toFixed(2)}s;--u:${u.toFixed(2)}s"/>`;
  }
  // 곧은 선: 긴 선은 몇 토막으로 나눠 겹쳐 긋고, 끝은 살짝 넘치거나 모자라게
  function line(bucket, x1, y1, x2, y2, o) {
    o = Object.assign({ passes: 2, amp: 1, over: 5, w: [0.9, 1.5], op: [0.55, 0.9], t: 0, dur: 0.5, seg: 230 }, o || {});
    const L = Math.hypot(x2 - x1, y2 - y1);
    if (L < 0.5) return;
    const ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = -uy, ny = ux;
    const n = Math.max(1, Math.ceil(L / o.seg));
    for (let p = 0; p < o.passes; p++) {
      for (let i = 0; i < n; i++) {
        const s0 = i ? (L * i) / n - R(4, 10) : -R(-o.over * 0.3, o.over);
        const s1 = i < n - 1 ? (L * (i + 1)) / n + R(2, 8) : L + R(-o.over * 0.3, o.over);
        const a = R(-o.amp, o.amp), b = R(-o.amp, o.amp), c = R(-o.amp * 1.6, o.amp * 1.6), sm = (s0 + s1) / 2;
        const d = `M${f(x1 + ux * s0 + nx * a)},${f(y1 + uy * s0 + ny * a)} Q${f(x1 + ux * sm + nx * c)},${f(y1 + uy * sm + ny * c)} ${f(x1 + ux * s1 + nx * b)},${f(y1 + uy * s1 + ny * b)}`;
        bucket.push(stroke(d, R(o.w[0], o.w[1]), R(o.op[0], o.op[1]), o.t + (o.dur * i) / n + p * 0.18, Math.max(0.18, (o.dur / n) * 1.2)));
      }
    }
  }
  // 선분이 네모 안에 드는 구간(Liang–Barsky)
  function clipRect(bx, by, ux, uy, p0, p1, r) {
    let lo = p0, hi = p1;
    const lim = (b, d, mn, mx) => {
      if (Math.abs(d) < 1e-9) return b >= mn && b <= mx;
      let s0 = (mn - b) / d, s1 = (mx - b) / d;
      if (s0 > s1) { const tmp = s0; s0 = s1; s1 = tmp; }
      lo = Math.max(lo, s0); hi = Math.min(hi, s1);
      return true;
    };
    if (!lim(bx, ux, r[0], r[2]) || !lim(by, uy, r[1], r[3]) || lo >= hi) return null;
    return [lo, hi];
  }
  // 빗금: 볼록한 다각형 안을 한 방향으로 채운다. ex(글자 자리)는 비운다.
  function hatch(bucket, poly, deg, gap, o) {
    o = Object.assign({ op: [0.2, 0.38], w: [0.7, 1.1], t0: 1, t1: 2.3, ex: [] }, o || {});
    const a = (deg * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    const cs = poly.map((P) => P[0] * nx + P[1] * ny);
    const cmin = Math.min.apply(null, cs), cmax = Math.max.apply(null, cs);
    for (let c = cmin + gap * R(0.3, 0.9); c < cmax; c += gap * R(0.85, 1.15)) {
      const ss = [];
      for (let i = 0; i < poly.length; i++) {
        const P = poly[i], Q = poly[(i + 1) % poly.length];
        const dp = P[0] * nx + P[1] * ny - c, dq = Q[0] * nx + Q[1] * ny - c;
        if (dp === dq || (dp > 0 && dq > 0) || (dp < 0 && dq < 0)) continue;
        const k = dp / (dp - dq);
        ss.push((P[0] + (Q[0] - P[0]) * k) * ux + (P[1] + (Q[1] - P[1]) * k) * uy);
      }
      if (ss.length < 2) continue;
      let pieces = [[Math.min.apply(null, ss) + R(0.5, 4), Math.max.apply(null, ss) - R(0.5, 5)]];
      const bx = c * nx, by = c * ny;
      o.ex.forEach((r) => {
        const next = [];
        pieces.forEach((pc) => {
          const cut = clipRect(bx, by, ux, uy, pc[0], pc[1], r);
          if (!cut) { next.push(pc); return; }
          if (cut[0] - 1 > pc[0]) next.push([pc[0], cut[0] - R(1, 3)]);
          if (cut[1] + 1 < pc[1]) next.push([cut[1] + R(1, 3), pc[1]]);
        });
        pieces = next;
      });
      const t = o.t0 + ((c - cmin) / (cmax - cmin)) * (o.t1 - o.t0);
      pieces.forEach((pc) => {
        if (pc[1] - pc[0] < 3) return;
        const j0 = R(-0.6, 0.6), j1 = R(-0.6, 0.6);
        const d = `M${f(bx + pc[0] * ux + nx * j0)},${f(by + pc[0] * uy + ny * j0)} L${f(bx + pc[1] * ux + nx * j1)},${f(by + pc[1] * uy + ny * j1)}`;
        bucket.push(stroke(d, R(o.w[0], o.w[1]), R(o.op[0], o.op[1]), t, 0.22));
      });
    }
  }

  const body = [], clouds = [], rays = [], stars = [];

  // 밑그림 선(십자가 가운데 세로선) — 연필 스케치다운 흔적
  line(body, 450, 40, 450, 300, { passes: 1, amp: 0.4, w: [0.6, 0.8], op: [0.12, 0.18], t: 0, dur: 0.5 });
  // 종탑 겉선
  line(body, 442, TOP, xl(END), END, { passes: 3, amp: 1.1, w: [1.3, 2.1], op: [0.7, 1], t: 0, dur: 0.9, seg: 200 });
  line(body, 458, TOP, xr(END), END, { passes: 3, amp: 1.1, w: [1.3, 2.1], op: [0.6, 0.9], t: 0.15, dur: 0.9, seg: 200 });
  line(body, 450, TOP, xm(END), END, { passes: 2, amp: 0.9, w: [1, 1.4], op: [0.45, 0.7], t: 0.3, dur: 0.9, seg: 220 });
  line(body, 440, TOP, 460, TOP, { passes: 2, amp: 0.5, over: 3, w: [1.2, 1.6], op: [0.7, 0.9], t: 0.2, dur: 0.2 });
  // 판넬 이음새
  seams.forEach((y, k) => {
    const t = 0.8 + k * 0.06;
    line(body, xl(y), y, xm(y), y + 4, { passes: 2, amp: 0.7, over: 3, w: [0.8, 1.2], op: [0.35, 0.6], t, dur: 0.25 });
    line(body, xm(y), y + 4, xr(y), y + 1, { passes: 1, amp: 0.7, over: 3, w: [0.8, 1.1], op: [0.25, 0.45], t: t + 0.1, dur: 0.2 });
  });
  // 사다리(오른쪽 면)
  const lr = (y, off) => xr(y) - off;
  line(body, lr(420, 6), 420, lr(END, 8), END, { passes: 1, amp: 0.8, w: [0.8, 1.1], op: [0.3, 0.45], t: 1.2, dur: 0.6 });
  line(body, lr(420, 13), 420, lr(END, 20), END, { passes: 1, amp: 0.8, w: [0.8, 1.1], op: [0.3, 0.45], t: 1.25, dur: 0.6 });
  for (let y = 428; y < END; y += 13 + 6 * (y - 420) / (END - 420)) {
    const q = (y - 420) / (END - 420);
    line(body, lr(y, 6 + 2 * q), y, lr(y, 13 + 7 * q), y, { passes: 1, amp: 0.3, over: 1, w: [0.7, 1], op: [0.25, 0.4], t: 1.3 + q * 0.6, dur: 0.15 });
  }
  // 빗금: 빛 받는 왼쪽 면은 촘촘히(글자 자리는 비움), 그늘진 오른쪽 면은 성기게 + 엇갈린 빗금
  const leftPoly = [[442, TOP], [450, TOP], [xm(END), END], [xl(END), END]];
  const rightPoly = [[450, TOP], [458, TOP], [xr(END), END], [xm(END), END]];
  hatch(body, leftPoly, -58, 6.2, { op: [0.2, 0.36], t0: 1.0, t1: 2.3, ex: letterRects });
  hatch(body, rightPoly, -58, 8.5, { op: [0.13, 0.24], t0: 1.1, t1: 2.4 });
  hatch(body, rightPoly, 32, 10.5, { op: [0.07, 0.14], t0: 1.6, t1: 2.6 });
  // 꼭대기 받침(고리와 공)
  const ell = (cx, cy, rx, ry, t, op) => {
    for (let p = 0; p < 2; p++) {
      const jx = R(-0.6, 0.6), jy = R(-0.4, 0.4);
      body.push(stroke(`M${f(cx - rx + jx)},${f(cy + jy)} A${f(rx * R(0.96, 1.04))},${f(ry)} 0 1 1 ${f(cx + rx + jx)},${f(cy - jy)} A${f(rx)},${f(ry * R(0.9, 1.1))} 0 1 1 ${f(cx - rx + jx * 0.5)},${f(cy + jy + 0.8)}`,
        R(1, 1.4), R(op[0], op[1]), t + p * 0.12, 0.3));
    }
  };
  ell(450, 250, 12, 4.5, 1.9, [0.55, 0.8]);
  ell(450, 241, 7, 7, 2.0, [0.6, 0.85]);
  // 십자가: 겉선 두 번 + 안을 촘촘한 빗금으로 칠함(아래에 옅은 채움을 깔아 또렷하게)
  CROSS.forEach((P, i) => {
    const Q = CROSS[(i + 1) % CROSS.length];
    line(body, P[0], P[1], Q[0], Q[1], { passes: 2, amp: 0.45, over: 2.5, w: [1.3, 1.9], op: [0.8, 1], t: 2.0 + i * 0.04, dur: 0.22, seg: 400 });
  });
  hatch(body, [[443, 70], [457, 70], [457, 236], [443, 236]], -58, 2.4, { op: [0.55, 0.8], w: [0.8, 1.1], t0: 2.2, t1: 2.6 });
  hatch(body, [[398, 112], [502, 112], [502, 126], [398, 126]], -58, 2.4, { op: [0.55, 0.8], w: [0.8, 1.1], t0: 2.3, t1: 2.7 });

  // 빛줄기(십자가에서 퍼지는 가는 연필 선)
  [[-172, 230], [-152, 250], [-133, 220], [-116, 240], [-100, 200], [-80, 210], [-64, 245], [-47, 225], [-28, 250], [-8, 230], [12, 210], [168, 210]]
    .forEach(([ang, L], i) => {
      const a = (ang * Math.PI) / 180, r0 = 72;
      line(rays, CX + Math.cos(a) * r0, CY + Math.sin(a) * r0, CX + Math.cos(a) * L, CY + Math.sin(a) * L,
        { passes: 1, amp: 0.6, over: 2, w: [0.8, 1.2], op: [0.4, 0.65], t: 2.8 + i * 0.05, dur: 0.4, seg: 400 });
    });

  // 구름: 원들이 겹친 바깥 둘레(위쪽)만 손으로 그린 듯이 + 아래 옅은 빗금
  const CLOUDS = [
    [640, 520, 26, [[-110, -10, 34], [-60, -38, 52], [10, -52, 64], [80, -30, 46], [130, -6, 30]], 300, 0.55],
    [190, 420, 31, [[-90, -6, 28], [-45, -30, 42], [15, -40, 50], [70, -18, 34]], 220, 0.45],
    [760, 250, 22, [[-50, -8, 22], [-15, -26, 32], [30, -20, 26], [60, -4, 18]], 140, 0.4],
    [300, 700, 35, [[-80, -6, 30], [-30, -32, 46], [30, -36, 48], [85, -12, 32]], 230, 0.35],
    [720, 820, 29, [[-70, -6, 30], [-20, -30, 44], [40, -26, 40], [90, -6, 26]], 220, 0.4],
  ];
  CLOUDS.forEach(([cx, cy, dur, cs, bw, op], ci) => {
    const parts = [];
    const circ = cs.map(([dx, dy, r]) => [cx + dx, cy + dy, r]);
    const t0 = 0.3 + ci * 0.25;
    circ.forEach(([x, y, r], k) => {
      // 이 원의 둘레 중 다른 원에 가려지지 않은 위쪽 부분만
      let run = [];
      const flush = () => {
        if (run.length > 2) {
          for (let p = 0; p < 2; p++) {
            const pts = run.map(([px, py]) => [px + R(-0.8, 0.8), py + R(-0.8, 0.8)]);
            parts.push(stroke("M" + pts.map((q) => f(q[0]) + "," + f(q[1])).join(" L"), R(0.9, 1.3), R(0.5, 0.85) * op, t0 + k * 0.12 + p * 0.15, 0.35));
          }
        }
        run = [];
      };
      for (let deg = 180; deg <= 360; deg += 5) {
        const a = (deg * Math.PI) / 180, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        const hidden = py > cy + 10 || circ.some(([ox, oy, orr], j) => j !== k && Math.hypot(px - ox, py - oy) < orr - 0.5);
        if (hidden) flush(); else run.push([px, py]);
      }
      flush();
    });
    line(parts, cx - bw / 2 + 10, cy + 12, cx + bw / 2 - 10, cy + 12, { passes: 1, amp: 0.8, w: [0.8, 1.1], op: [0.3 * op, 0.5 * op], t: t0 + 0.5, dur: 0.4 });
    for (let i = 0; i < 6; i++) {
      const hx = cx - bw * 0.3 + (bw * 0.6 * i) / 5 + R(-6, 6), hy = cy + R(-4, 8);
      line(parts, hx, hy + 6, hx + 9, hy - 8, { passes: 1, amp: 0.3, over: 1, w: [0.7, 0.9], op: [0.2 * op, 0.35 * op], t: t0 + 0.7 + i * 0.04, dur: 0.12 });
    }
    clouds.push(`<g class="sp-drift" style="--d:${dur}s;--dl:-${ci * 5}s">${parts.join("")}</g>`);
  });

  // 반짝이는 작은 별(첫 화면처럼)
  [[120, 120, 7], [230, 60, 5], [640, 70, 6], [800, 150, 8], [860, 380, 5], [90, 300, 5], [560, 330, 4], [330, 200, 4]]
    .forEach(([x, y, r], i) => {
      const s = [];
      line(s, x, y - r, x, y + r, { passes: 1, amp: 0.2, over: 1, w: [0.8, 1], op: [0.6, 0.8], t: 2.9 + i * 0.05, dur: 0.15 });
      line(s, x - r, y, x + r, y, { passes: 1, amp: 0.2, over: 1, w: [0.8, 1], op: [0.6, 0.8], t: 2.95 + i * 0.05, dur: 0.15 });
      stars.push(`<g class="sk-star" style="--dl:-${(i * 0.7).toFixed(1)}s">${s.join("")}</g>`);
    });

  const crossFill = "M" + CROSS.map((P) => P.join(",")).join(" L") + " Z";
  const letterSvg = letters.map((l) =>
    `<text class="sk-letter-o" x="${f(l.x + 1.4)}" y="${f(l.y - 1)}" font-size="${f(l.s)}">${l.ch}</text>` +
    `<text class="sk-letter" x="${f(l.x)}" y="${f(l.y)}" font-size="${f(l.s)}">${l.ch}</text>`).join("");

  const svg = `<svg class="ph-spire" viewBox="0 -110 900 1110" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="spGlowG" cx="${CX}" cy="${CY}" r="170" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#F8EBC4" stop-opacity=".6"/><stop offset=".4" stop-color="#BFA06C" stop-opacity=".2"/><stop offset="1" stop-color="#BFA06C" stop-opacity="0"/></radialGradient>
      <radialGradient id="spRayFade" cx="${CX}" cy="${CY}" r="215" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <mask id="spRayMask"><rect y="-110" width="900" height="1110" fill="url(#spRayFade)"/></mask>
      <linearGradient id="skBottomG" x1="0" y1="820" x2="0" y2="1010" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity=".25"/></linearGradient>
      <mask id="skBottom"><rect y="-110" width="900" height="1130" fill="url(#skBottomG)"/></mask>
      <filter id="skGrain" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.2 -0.55" result="g"/>
        <feComposite in="SourceGraphic" in2="g" operator="in"/>
      </filter>
      <filter id="skGrainSoft" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="11" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0.45" result="g"/>
        <feComposite in="SourceGraphic" in2="g" operator="in"/>
      </filter>
    </defs>
    <g class="sk-stars">${stars.join("")}</g>
    <g class="sk-clouds">${clouds.join("")}</g>
    <circle class="sk-glow" cx="${CX}" cy="${CY}" r="170" fill="url(#spGlowG)"/>
    <g mask="url(#spRayMask)"><g class="sp-rays">${rays.join("")}</g></g>
    <path class="sk-crossfill sk-fade" style="--t:2.4s" d="${crossFill}"/>
    <g class="sk-body" filter="url(#skGrain)" mask="url(#skBottom)">${body.join("")}</g>
    <g class="sk-letters sk-fade" style="--t:2.1s" filter="url(#skGrainSoft)">${letterSvg}</g>
  </svg>`;
  hero.insertAdjacentHTML("afterbegin", svg);
  const el = hero.querySelector(".ph-spire");

  // 그려 나가는 모습: 처음 열 때, 그리고 표지를 벗어났다가 다시 볼 때마다
  function play() {
    el.classList.remove("is-drawing");
    void el.getBoundingClientRect();
    el.classList.add("is-drawing");
  }
  play();
  if ("IntersectionObserver" in window) {
    let away = false;
    new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) away = true;
      else if (away) { away = false; play(); }
    }), { threshold: 0.05 }).observe(hero);
  }
})();
