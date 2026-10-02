/* ============================================================
   행정 표지 — 종이 위에 손이 연필로 글씨를 써 내려가는 연필 그림 (2026-10-02)
   office.html 의 <section class="page-hero ph-pen-hero"> 오른쪽에 그린다(자리·크기는 css .ph-pen).
   - 비스듬히 놓인 종이와 찻잔은 크림색 연필 선으로 그리고(교회 안내 표지 종탑 그림과 같은 방법),
     연필을 쥔 손은 연필 스케치 그림 파일(images/office-hand.webp)을 쓴다.
   - 손이 움직이며 종이에 "무엇을 도와드릴까요?" 를 써 내려간다 — 글자는 손글씨 글꼴(Nanum Pen Script).
     (목사님 말씀: 손이 있어야 하고, 손이 움직이듯이. 성경 말씀 대신 이 인사말로.)
   - 표지가 화면에 들어올 때마다 처음부터 다시 그리고 쓴다.
   ============================================================ */
(function () {
  const hero = document.querySelector(".page-hero.ph-pen-hero");
  if (!hero) return;

  let seed = 1440;
  function rnd() {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + (b - a) * rnd();
  const f = (v) => String(Math.round(v * 10) / 10);
  function stroke(d, w, op, t, u) {
    return `<path class="sk" d="${d}" stroke-width="${f(w)}" stroke-opacity="${op.toFixed(2)}" pathLength="1" style="--t:${t.toFixed(2)}s;--u:${u.toFixed(2)}s"/>`;
  }
  // 곧은 선을 손으로 그은 듯이(겹쳐 긋고, 끝은 살짝 넘치거나 모자라게)
  function line(bucket, x1, y1, x2, y2, o) {
    o = Object.assign({ passes: 2, amp: 1, over: 5, w: [0.9, 1.5], op: [0.55, 0.9], t: 0, dur: 0.5 }, o || {});
    const L = Math.hypot(x2 - x1, y2 - y1);
    if (L < 0.5) return;
    const ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = -uy, ny = ux;
    for (let p = 0; p < o.passes; p++) {
      const s0 = -R(-o.over * 0.3, o.over), s1 = L + R(-o.over * 0.3, o.over);
      const a = R(-o.amp, o.amp), b = R(-o.amp, o.amp), c = R(-o.amp * 1.6, o.amp * 1.6), sm = (s0 + s1) / 2;
      bucket.push(stroke(`M${f(x1 + ux * s0 + nx * a)},${f(y1 + uy * s0 + ny * a)} Q${f(x1 + ux * sm + nx * c)},${f(y1 + uy * sm + ny * c)} ${f(x1 + ux * s1 + nx * b)},${f(y1 + uy * s1 + ny * b)}`,
        R(o.w[0], o.w[1]), R(o.op[0], o.op[1]), o.t + p * 0.16, o.dur));
    }
  }
  // 점들을 부드럽게 잇는 선(둥근 것들: 찻잔·김)
  function curve(bucket, pts, o) {
    o = Object.assign({ passes: 2, amp: 0.8, w: [0.9, 1.4], op: [0.55, 0.9], t: 0, dur: 0.5 }, o || {});
    for (let p = 0; p < o.passes; p++) {
      const q = pts.map((P) => [P[0] + R(-o.amp, o.amp), P[1] + R(-o.amp, o.amp)]);
      let d = `M${f(q[0][0])},${f(q[0][1])}`;
      for (let i = 1; i < q.length - 1; i++) d += ` Q${f(q[i][0])},${f(q[i][1])} ${f((q[i][0] + q[i + 1][0]) / 2)},${f((q[i][1] + q[i + 1][1]) / 2)}`;
      d += ` L${f(q[q.length - 1][0])},${f(q[q.length - 1][1])}`;
      bucket.push(stroke(d, R(o.w[0], o.w[1]), R(o.op[0], o.op[1]), o.t + p * 0.16, o.dur));
    }
  }
  const arc = (cx, cy, rx, ry, a0, a1, n) => {
    const pts = [];
    for (let i = 0; i <= n; i++) { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return pts;
  };

  /* ---- 종이(비스듬히 놓임). 종이 안 좌표: 가로 500 × 세로 660 ---- */
  const PW = 500, PH = 630;
  const paper = [], cup = [], steam = [];
  // 아래에 깔린 종이 한 장(오른쪽·아래 가장자리만 보인다)
  line(paper, PW + 13, 16, PW + 15, PH + 13, { passes: 1, amp: 0.8, w: [0.9, 1.2], op: [0.3, 0.45], t: 0.1, dur: 0.6 });
  line(paper, 16, PH + 14, PW + 15, PH + 13, { passes: 1, amp: 0.8, w: [0.9, 1.2], op: [0.3, 0.45], t: 0.3, dur: 0.6 });
  // 종이 겉선
  [[0, 0, PW, 0], [PW, 0, PW, PH], [PW, PH, 0, PH], [0, PH, 0, 0]].forEach((e, i) =>
    line(paper, e[0], e[1], e[2], e[3], { passes: 3, amp: 1.1, over: 7, w: [1.2, 1.9], op: [0.6, 0.95], t: 0.15 + i * 0.18, dur: 0.6 }));
  // 종이 아래쪽 그늘 빗금
  for (let i = 0; i < 16; i++) {
    const x = PW - 150 + i * 10 + R(-2, 2);
    line(paper, x, PH + 4, x + 14, PH + 4 + R(10, 20), { passes: 1, amp: 0.3, over: 1, w: [0.7, 1], op: [0.18, 0.32], t: 0.9 + i * 0.02, dur: 0.15 });
  }

  /* ---- 찻잔과 받침(그림 전체 좌표) ---- */
  const CX = 765, CY = 150;
  curve(cup, arc(CX, CY + 62, 104, 33, 0, 360, 28), { t: 0.7, dur: 0.7, op: [0.5, 0.8] });                 // 받침
  curve(cup, arc(CX, CY + 60, 62, 18, 20, 160, 10), { passes: 1, t: 0.9, dur: 0.4, op: [0.3, 0.5] });       // 받침 안쪽 선
  curve(cup, arc(CX, CY, 60, 19, 0, 360, 24), { t: 1.0, dur: 0.6, w: [1.1, 1.6] });                          // 잔 입
  curve(cup, arc(CX, CY + 2, 50, 13, 0, 360, 20), { passes: 1, t: 1.2, dur: 0.5, op: [0.35, 0.55] });        // 찻물
  curve(cup, [[CX - 60, CY], [CX - 57, CY + 28], [CX - 44, CY + 52], [CX - 22, CY + 62], [CX, CY + 64], [CX + 22, CY + 62], [CX + 44, CY + 52], [CX + 57, CY + 28], [CX + 60, CY]],
    { t: 1.2, dur: 0.6, w: [1.1, 1.6] });                                                                     // 잔 몸통
  curve(cup, [[CX + 58, CY + 8], [CX + 82, CY + 4], [CX + 92, CY + 22], [CX + 80, CY + 40], [CX + 54, CY + 38]], { t: 1.5, dur: 0.4 });   // 손잡이
  for (let i = 0; i < 9; i++) {   // 찻물 빗금
    const x = CX - 38 + i * 9.5 + R(-1.5, 1.5);
    line(cup, x, CY + 9, x + 9, CY - 6, { passes: 1, amp: 0.3, over: 1, w: [0.7, 1], op: [0.25, 0.4], t: 1.6 + i * 0.02, dur: 0.12 });
  }
  for (let i = 0; i < 10; i++) {  // 잔 오른쪽 그늘
    const y = CY + 12 + i * 4.6;
    line(cup, CX + 30 + R(-2, 2), y + 6, CX + 52 - i * 1.6, y - 4, { passes: 1, amp: 0.3, over: 1, w: [0.7, 1], op: [0.18, 0.32], t: 1.7 + i * 0.02, dur: 0.12 });
  }
  // 김
  [[-16, 0], [14, 0.6]].forEach(([dx, dl], i) => {
    const pts = [];
    for (let k = 0; k <= 7; k++) pts.push([CX + dx + Math.sin(k * 1.25 + i) * 9, CY - 16 - k * 13]);
    const part = [];
    curve(part, pts, { passes: 1, amp: 0.6, w: [0.9, 1.2], op: [0.3, 0.5], t: 2.0 + dl, dur: 0.7 });
    steam.push(`<g class="pen-steam" style="--dl:-${i * 1.7}s">${part.join("")}</g>`);
  });

  /* ---- 종이에 쓰는 글 ---- */
  const LINES = [
    { text: "무엇을", x: 54, y: 192, size: 98 },
    { text: "도와드릴까요?", x: 54, y: 330, size: 98 },
  ];
  const clips = LINES.map((l, i) => `<clipPath id="penClip${i}"><rect x="${l.x - 8}" y="${l.y - l.size}" width="0" height="${l.size * 1.45}"/></clipPath>`).join("");
  const texts = LINES.map((l, i) => `<text class="pen-text" x="${l.x}" y="${l.y}" font-size="${l.size}" clip-path="url(#penClip${i})">${l.text}</text>`).join("");

  // 연필을 쥔 손: 연필 스케치 그림(images/office-hand.webp — 크림색 선, 바탕은 투명, 소매 끝은 서서히 사라짐).
  // 그림 안에서 연필 끝은 (13, 570) / 1100×904 이고, 그 점이 (0,0)에 오도록 놓는다.
  // (처음에는 점을 찍어 선으로 그렸으나 손 모양이 어색하다는 말씀에 그림으로 바꿈)
  const HS = 0.48;
  const PEN = `<image class="pen-body" href="images/office-hand.webp?v=20261002" x="${f(-13 * HS)}" y="${f(-570 * HS)}" width="${f(1100 * HS)}" height="${f(904 * HS)}" preserveAspectRatio="none"/>`;

  const svg = `<svg class="msk ph-pen" viewBox="0 0 900 1000" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
    <defs>
      <filter id="penGrain" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.2 -0.55" result="g"/>
        <feComposite in="SourceGraphic" in2="g" operator="in"/>
      </filter>
      <filter id="penGrainSoft" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="11" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0.5" result="g"/>
        <feComposite in="SourceGraphic" in2="g" operator="in"/>
      </filter>
      ${clips}
    </defs>
    <g filter="url(#penGrain)">${cup.join("")}${steam.join("")}</g>
    <g transform="translate(180 362) rotate(-8)">
      <path class="pen-sheet sk-fade" style="--t:.5s" d="M0,0 H${PW} V${PH} H0 Z"/>
      <g filter="url(#penGrain)">${paper.join("")}</g>
      <g class="pen-texts" filter="url(#penGrainSoft)">${texts}</g>
      <g class="pen-move sk-fade" style="--t:.9s">${PEN}</g>
    </g>
  </svg>`;
  hero.insertAdjacentHTML("afterbegin", svg);
  const el = hero.querySelector(".ph-pen");
  const rects = LINES.map((l, i) => el.querySelector(`#penClip${i} rect`));
  const tnodes = Array.prototype.slice.call(el.querySelectorAll(".pen-text"));
  const pen = el.querySelector(".pen-move");

  /* ---- 써 내려가는 움직임 ---- */
  const REST = [300, 600], START = [640, 820];    // 다 쓰고 손이 쉬는 자리, 처음 들어오는 자리(종이 밖 오른쪽 아래)
  let widths = LINES.map((l) => l.text.length * l.size * 0.5), raf = 0;
  function measure() {
    tnodes.forEach((t, i) => { try { const w = t.getComputedTextLength(); if (w > 10) widths[i] = w; } catch (e) {} });
  }
  function plan() {
    // 줄마다 [시작 시각, 끝 시각] — 글자 길이에 맞춰 쓰는 빠르기를 고르게
    const segs = []; let t = 1.9;
    LINES.forEach((l, i) => { const d = Math.max(1.1, widths[i] / 150); segs.push([t, t + d]); t += d + 0.7; });
    return segs;
  }
  const ease = (q) => q * q * (3 - 2 * q);
  function frame(now, t0, segs) {
    const t = (now - t0) / 1000;
    let px = START[0], py = START[1], rot = 0;
    const first = [LINES[0].x, LINES[0].y - LINES[0].size * 0.28];
    if (t < segs[0][0]) {                       // 쉬던 자리에서 첫 줄로
      const q = ease(Math.max(0, Math.min(1, (t - 0.9) / (segs[0][0] - 0.9))));
      px = START[0] + (first[0] - START[0]) * q; py = START[1] + (first[1] - START[1]) * q - Math.sin(q * Math.PI) * 26;
    }
    LINES.forEach((l, i) => {
      const s = segs[i], w = widths[i];
      const p = Math.max(0, Math.min(1, (t - s[0]) / (s[1] - s[0])));
      rects[i].setAttribute("width", f(p * (w + 16)));
      if (t >= s[0] && t <= s[1]) {             // 쓰는 중: 조금씩 위아래로 움직이며 나아간다
        px = l.x + p * w; py = l.y - l.size * 0.28 + Math.sin(t * 21) * l.size * 0.11 + Math.sin(t * 9.3) * l.size * 0.05;
        rot = Math.sin(t * 10.5) * 1.8;          // 손목이 살짝살짝 움직인다
      } else if (t > s[1]) {
        const nx = LINES[i + 1], ns = segs[i + 1];
        const from = [l.x + w, l.y - l.size * 0.28], to = nx ? [nx.x, nx.y - nx.size * 0.28] : REST;
        const end = nx ? ns[0] : s[1] + 1.2;
        if (t < end || !nx) {
          const q = ease(Math.max(0, Math.min(1, (t - s[1]) / (end - s[1]))));
          px = from[0] + (to[0] - from[0]) * q; py = from[1] + (to[1] - from[1]) * q - Math.sin(q * Math.PI) * 22;
        }
      }
    });
    pen.setAttribute("transform", `translate(${f(px)} ${f(py)}) rotate(${f(rot)})`);
    if (t < segs[segs.length - 1][1] + 1.4) raf = requestAnimationFrame((n) => frame(n, t0, segs));
  }
  function play() {
    cancelAnimationFrame(raf);
    el.classList.remove("is-drawing"); void el.getBoundingClientRect(); el.classList.add("is-drawing");
    measure();
    rects.forEach((r) => r.setAttribute("width", "0"));
    pen.setAttribute("transform", `translate(${START[0]} ${START[1]})`);
    const segs = plan(), t0 = performance.now();
    raf = requestAnimationFrame((n) => frame(n, t0, segs));
  }
  function start() {
    play();
    if ("IntersectionObserver" in window) {
      let away = false;
      new IntersectionObserver((es) => es.forEach((e) => {
        if (!e.isIntersecting) away = true;
        else if (away) { away = false; play(); }
      }), { threshold: 0.05 }).observe(hero);
    }
  }
  // 손글씨 글꼴이 준비된 뒤에 시작(글자 길이를 재야 펜이 글자를 따라간다). 늦어지면 그냥 시작.
  let started = false;
  const go = () => { if (!started) { started = true; start(); } };
  if (document.fonts && document.fonts.load) {
    document.fonts.load('104px "Nanum Pen Script"', LINES[0].text + LINES[1].text).then(go, go);
    setTimeout(go, 2500);
  } else go();
})();
