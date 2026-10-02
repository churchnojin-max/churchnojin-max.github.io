/* ============================================================
   선교와 사역(world.html) — 연필로 그린 그림 세 가지 (2026-10-02)
   ① 표지: 금색 연필 선이 화면 맨 아래에서 올라와 한 획으로 하트를 그리고 다시 아래로 사라진다.
   ② 선교: 세계 지도를 연필 스케치로 깔고, 선교지마다 점을 찍어 카드와 선으로 잇는다.
      컴퓨터 화면에서는 카드가 지도 위 그 지역 가까이에 놓인다(자리는 아래 CARD 표). 휴대폰에서는 지도 아래에 카드가 차례로 놓인다.
   ③ 지역 교회와 함께 하는 연합사역: 화성시 지도(우정읍·장안면에 빗금, 노진교회 자리에 점).
   밑자료는 js/map-sketch-data.js. 그리는 방법은 교회 안내 표지의 종탑 그림(js/spire-sketch.js)과 같다
   — 정해 둔 난수로 손떨림을 만들고, 겉선은 겹쳐 긋고, 면은 빗금으로 채우고, 화면에 들어올 때마다 그려 나간다.
   ============================================================ */
(function () {
  const D = window.MAP_SKETCH_DATA;

  let seed = 2026;
  function rnd() {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + (b - a) * rnd();
  const f = (v) => String(Math.round(v * 100) / 100);

  function stroke(d, w, op, t, u, cls) {
    return `<path class="sk${cls ? " " + cls : ""}" d="${d}" stroke-width="${f(w)}" stroke-opacity="${op.toFixed(2)}" pathLength="1" style="--t:${t.toFixed(2)}s;--u:${u.toFixed(2)}s"/>`;
  }
  // 점들을 잇는 손그림 선: 점마다 살짝 흔들고, smooth 면 모서리를 둥글려 긋는다
  function polyPath(pts, amp, smooth) {
    const q = pts.map((p) => [p[0] + R(-amp, amp), p[1] + R(-amp, amp)]);
    if (!smooth || q.length < 3) return "M" + q.map((p) => f(p[0]) + "," + f(p[1])).join(" L");
    let d = `M${f(q[0][0])},${f(q[0][1])}`;
    for (let i = 1; i < q.length - 1; i++) {
      const mx = (q[i][0] + q[i + 1][0]) / 2, my = (q[i][1] + q[i + 1][1]) / 2;
      d += ` Q${f(q[i][0])},${f(q[i][1])} ${f(mx)},${f(my)}`;
    }
    const e = q[q.length - 1];
    return d + ` L${f(e[0])},${f(e[1])}`;
  }
  // 긴 줄을 몇 토막으로 나눠 긋는다(토막끼리 조금 겹침)
  function coast(bucket, pts, o) {
    const per = o.per || 14;
    for (let p = 0; p < o.passes; p++) {
      for (let i = 0; i < pts.length - 1; i += per - 1) {
        const part = pts.slice(Math.max(0, i - (p ? 1 : 0)), Math.min(pts.length, i + per + (p ? 0 : 1)));
        if (part.length < 2) continue;
        const cx = part[Math.floor(part.length / 2)][0];
        bucket.push(stroke(polyPath(part, o.amp * (p ? 1.7 : 1), p > 0), R(o.w[0], o.w[1]) * (p ? 0.8 : 1), R(o.op[0], o.op[1]) * (p ? 0.6 : 1),
          o.t(cx) + p * 0.25, o.dur || 0.5));
      }
    }
  }
  // 빗금: 여러 다각형(겹치지 않음)의 안쪽을 한 방향 선으로 채운다. box = [x0,y0,x1,y1] 밖은 긋지 않는다.
  function hatch(bucket, polys, deg, gap, o) {
    const a = (deg * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    let cmin = Infinity, cmax = -Infinity;
    polys.forEach((poly) => poly.forEach((P) => { const c = P[0] * nx + P[1] * ny; if (c < cmin) cmin = c; if (c > cmax) cmax = c; }));
    let group = [], gx = 0, gn = 0;
    const flush = () => {
      if (!group.length) return;
      bucket.push(stroke(group.join(" "), R(o.w[0], o.w[1]), R(o.op[0], o.op[1]), o.t(gx / gn), o.dur || 0.7));
      group = []; gx = 0; gn = 0;
    };
    let k = 0;
    for (let c = cmin + gap * R(0.3, 0.9); c < cmax; c += gap * R(0.8, 1.2)) {
      const ss = [];
      polys.forEach((poly) => {
        for (let i = 0; i < poly.length; i++) {
          const P = poly[i], Q = poly[(i + 1) % poly.length];
          const dp = P[0] * nx + P[1] * ny - c, dq = Q[0] * nx + Q[1] * ny - c;
          if ((dp > 0) === (dq > 0)) continue;
          const t = dp / (dp - dq);
          ss.push((P[0] + (Q[0] - P[0]) * t) * ux + (P[1] + (Q[1] - P[1]) * t) * uy);
        }
      });
      ss.sort((x, y) => x - y);
      const bx = c * nx, by = c * ny;
      for (let i = 0; i + 1 < ss.length; i += 2) {
        let s0 = ss[i] + R(0.03, 0.2), s1 = ss[i + 1] - R(0.03, 0.25);
        if (s1 - s0 < 0.25) continue;
        let x0 = bx + s0 * ux, y0 = by + s0 * uy, x1 = bx + s1 * ux, y1 = by + s1 * uy;
        if (o.box) {
          const b = o.box;
          if (Math.max(x0, x1) < b[0] || Math.min(x0, x1) > b[2] || Math.max(y0, y1) < b[1] || Math.min(y0, y1) > b[3]) continue;
        }
        const j = gap * 0.12;
        group.push(`M${f(x0 + R(-j, j))},${f(y0 + R(-j, j))} L${f(x1 + R(-j, j))},${f(y1 + R(-j, j))}`);
        gx += (x0 + x1) / 2; gn++;
      }
      if (++k % (o.group || 6) === 0) flush();
    }
    flush();
  }
  const DEFS = (id) => `<defs><filter id="${id}" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.2 -0.5" result="g"/>
      <feComposite in="SourceGraphic" in2="g" operator="in"/></filter></defs>`;
  // 화면에 들어올 때마다 다시 그려 나간다
  function replayOnView(el, watch) {
    const play = () => { el.classList.remove("is-drawing"); void el.getBoundingClientRect(); el.classList.add("is-drawing"); };
    if (!("IntersectionObserver" in window)) { play(); return; }
    let away = true;
    new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) away = true;
      else if (away) { away = false; play(); }
    }), { threshold: 0.18 }).observe(watch || el);
  }

  /* ---------- ② 선교: 세계 지도 ---------- */
  // 카드 자리(지도 단위: 가로 100 = 경도 360도, 왼쪽 끝이 서경 30도). [왼쪽, 위] — 카드 크기는 17 × 6.
  const CW = 17, CH = 6, X0 = -7;
  const CARD = {
    turkiye:        { at: "turkiye",     xy: [9.5, 0.6] },
    kenya:          { at: "kenya",       xy: [-6.6, 23.2] },
    srilanka:       { at: "srilanka",    xy: [22.3, 24.6] },
    eunmok:         { at: "korea",       xy: [52, 4.0] },
    cosmos:         { at: "korea",       xy: [52, 10.7] },
    philippines:    { at: "philippines", xy: [52, 17.4] },
    cambodia:       { at: "cambodia",    xy: [52, 24.1] },
    thailand:       { at: "thailand",    xy: [52, 30.8] },
    "thai-student": { at: "thailand",    xy: [69.7, 30.8], after: "thailand" },
  };
  function worldMap() {
    const stage = document.querySelector("[data-world-map]");
    if (!stage || !D) return;
    const W = D.world, H = W.h, P = D.places;
    seed = 4107;
    const land = [], shade = [], arcs = [], leads = [];
    const tx = (x) => 0.15 + ((x - X0) / (100 - X0)) * 1.7;
    W.land.forEach((it) => {
      const lines = it.l || [it.f.concat([it.f[0]])];
      const big = it.f.length > 18;
      lines.forEach((ln) => coast(land, ln, { passes: big ? 2 : 1, amp: 0.035, w: [0.1, 0.16], op: [0.45, 0.75], t: tx, dur: 0.55 }));
    });
    hatch(shade, W.land.map((it) => it.f), -58, 0.62, { w: [0.06, 0.09], op: [0.16, 0.28], t: (x) => 0.7 + tx(x), dur: 0.8, group: 5, box: [X0, -1, 101, H + 1] });

    // 노진교회(대한민국)에서 선교지로 뻗어 가는 선
    const home = P.korea;
    Object.keys(P).forEach((k, i) => {
      if (k === "korea") return;
      const p = P[k], dx = p[0] - home[0], dy = p[1] - home[1], L = Math.hypot(dx, dy);
      const bend = Math.min(5.5, L * 0.24);
      for (let pass = 0; pass < 2; pass++) {
        const cx = (home[0] + p[0]) / 2 + R(-0.15, 0.15), cy = (home[1] + p[1]) / 2 - bend + R(-0.2, 0.2);
        arcs.push(stroke(`M${f(home[0])},${f(home[1])} Q${f(cx)},${f(cy)} ${f(p[0])},${f(p[1])}`, R(0.09, 0.13), R(0.55, 0.85) * (pass ? 0.6 : 1), 2.3 + i * 0.12 + pass * 0.1, 0.5 + L * 0.02));
      }
    });
    // 점에서 카드로 이어지는 선
    const cards = Array.prototype.slice.call(stage.querySelectorAll(".mission-card[data-mission]"));
    const ends = [];
    cards.forEach((c, i) => {
      const cf = CARD[c.dataset.mission];
      if (!cf) return;
      c.style.setProperty("--x", cf.xy[0] - X0);
      c.style.setProperty("--y", cf.xy[1]);
      c.classList.add("on-map");
      const x = cf.xy[0], y = cf.xy[1], cy = y + CH / 2;
      let a, b;
      if (cf.after) { const o = CARD[cf.after].xy; a = [o[0] + CW, cy]; b = [x, cy]; }
      else {
        a = P[cf.at];
        if (a[0] < x) b = [x, cy];
        else if (a[0] > x + CW) b = [x + CW, cy];
        else b = [Math.min(Math.max(a[0], x + 2), x + CW - 2), a[1] > y + CH ? y + CH : y];
      }
      const mx = (a[0] + b[0]) / 2 + R(-0.12, 0.12), my = (a[1] + b[1]) / 2 + R(-0.12, 0.12);
      leads.push(stroke(`M${f(a[0])},${f(a[1])} Q${f(mx)},${f(my)} ${f(b[0])},${f(b[1])}`, 0.1, 0.75, 2.9 + i * 0.08, 0.45));
      ends.push(`<circle class="mm-end sk-fade" style="--t:${(3.2 + i * 0.08).toFixed(2)}s" cx="${f(b[0])}" cy="${f(b[1])}" r=".24"/>`);
    });
    const pins = Object.keys(P).map((k, i) => {
      const p = P[k];
      return `<g class="mm-pin${k === "korea" ? " is-home" : ""} sk-fade" style="--t:${(2.1 + i * 0.1).toFixed(2)}s" transform="translate(${f(p[0])} ${f(p[1])})">
        <circle class="mm-pulse" r="1" style="animation-delay:-${(i * 0.4).toFixed(1)}s"/><circle class="mm-dot" r="${k === "korea" ? ".52" : ".4"}"/></g>`;
    }).join("");
    const svg = `<svg class="msk mm-map" viewBox="${X0} 0 ${100 - X0} ${f(H)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      ${DEFS("mmGrain")}
      <g filter="url(#mmGrain)"><g class="mm-shade">${shade.join("")}</g><g class="mm-land">${land.join("")}</g></g>
      <g class="mm-arcs" filter="url(#mmGrain)">${arcs.join("")}</g>
      <g class="mm-leads">${leads.join("")}${ends.join("")}</g>
      ${pins}
      <text class="mm-home sk-fade" style="--t:2.4s" x="${f(home[0] - 0.9)}" y="${f(home[1] - 0.75)}">노진교회</text>
    </svg>`;
    stage.insertAdjacentHTML("afterbegin", svg);
    const el = stage.querySelector(".mm-map");
    // 휴대폰·태블릿: 선교지가 모인 쪽(아프리카~태평양 서쪽)만 크게 보여 준다
    const mq = window.matchMedia("(min-width: 1025px)");
    const fit = () => el.setAttribute("viewBox", mq.matches ? `${X0} 0 ${100 - X0} ${f(H)}` : `2 0 56 ${f(H - 4)}`);
    fit();
    if (mq.addEventListener) mq.addEventListener("change", fit); else if (mq.addListener) mq.addListener(fit);
    replayOnView(el, stage);
  }

  /* ---------- ③ 연합사역: 화성시 지도 ---------- */
  function hwaseongMap() {
    const box = document.querySelector("[data-hwaseong-map]");
    if (!box || !D) return;
    const S = D.hwaseong, H = S.h;
    seed = 3124;
    const out = [], inn = [], shade = [], sea = [];
    const tx = (x) => 0.1 + (x / 100) * 1.3;
    S.outer.forEach((ln) => coast(out, ln, { passes: ln.length > 20 ? 2 : 1, per: 12, amp: 0.12, w: [0.5, 0.72], op: [0.6, 0.9], t: tx, dur: 0.5 }));
    S.inner.forEach((ln) => coast(inn, ln, { passes: 1, per: 10, amp: 0.1, w: [0.26, 0.34], op: [0.26, 0.4], t: (x) => 0.9 + tx(x), dur: 0.4 }));
    S.edge.forEach((ln) => coast(inn, ln, { passes: 2, per: 10, amp: 0.12, w: [0.34, 0.46], op: [0.45, 0.65], t: (x) => 1.1 + tx(x), dur: 0.4 }));
    const fj = S.focus.jangan, fu = S.focus.ujeong;
    hatch(shade, [fu.p], -58, 1.25, { w: [0.2, 0.28], op: [0.3, 0.45], t: () => 1.6, dur: 0.9, group: 40 });
    hatch(shade, [fj.p], -58, 0.95, { w: [0.2, 0.3], op: [0.36, 0.55], t: () => 1.9, dur: 0.9, group: 40 });
    hatch(shade, [fj.p], 32, 1.9, { w: [0.18, 0.24], op: [0.18, 0.3], t: () => 2.2, dur: 0.8, group: 40 });
    // 서해 물결
    [[4, 40, 13], [10, 47, 16], [1, 52, 11], [20, 54, 12], [6, 31, 9]].forEach(([x, y, w], i) => {
      const pts = [];
      for (let k = 0; k <= 8; k++) pts.push([x + (w * k) / 8, y + (k % 2 ? -0.55 : 0.45)]);
      sea.push(stroke(polyPath(pts, 0.1, true), 0.26, 0.4, 2.2 + i * 0.12, 0.5));
    });
    const church = [fj.c[0] + 0.6, fj.c[1] + 1.4];
    const svg = `<svg class="msk hs-map" viewBox="-3 -3 106 ${f(H + 6)}" aria-hidden="true" focusable="false">
      ${DEFS("hsGrain")}
      <g filter="url(#hsGrain)"><g>${shade.join("")}</g><g>${sea.join("")}</g><g>${inn.join("")}</g><g>${out.join("")}</g></g>
      <text class="hs-city sk-fade" style="--t:1.2s" x="66" y="20">화성시</text>
      <text class="hs-emd sk-fade" style="--t:2.3s" x="${f(fu.c[0] - 1)}" y="${f(fu.c[1] + 2.4)}">우정읍</text>
      <text class="hs-emd sk-fade" style="--t:2.5s" x="${f(fj.c[0] + 0.5)}" y="${f(fj.c[1] - 4.2)}">장안면</text>
      <g class="mm-pin is-home sk-fade" style="--t:2.7s" transform="translate(${f(church[0])} ${f(church[1])})"><circle class="mm-pulse" r="2.6"/><circle class="mm-dot" r="1.25"/></g>
      <text class="hs-church sk-fade" style="--t:2.9s" x="${f(church[0] + 2.6)}" y="${f(church[1] + 1.3)}">노진교회</text>
    </svg>`;
    box.insertAdjacentHTML("afterbegin", svg);
    replayOnView(box.querySelector(".hs-map"), box);
  }

  /* ---------- ① 표지: 아래에서 올라와 하트를 그리고 아래로 ---------- */
  function heartHero() {
    const hero = document.querySelector(".page-hero.ph-heart-hero");
    if (!hero) return;
    const NS = "http://www.w3.org/2000/svg";
    const el = document.createElementNS(NS, "svg");
    el.setAttribute("class", "msk ph-heart");
    el.setAttribute("aria-hidden", "true");
    hero.insertBefore(el, hero.firstChild);
    const hx = (t) => 16 * Math.pow(Math.sin(t), 3);
    const hy = (t) => -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    function draw() {
      const W = hero.clientWidth, HH = hero.clientHeight;
      if (!W || !HH) return;
      const wide = window.matchMedia("(min-width: 1025px)").matches;
      const vh = window.innerHeight;
      const badge = hero.querySelector(".ph-symbol");
      const hr = hero.getBoundingClientRect(), br = badge ? badge.getBoundingClientRect() : null;
      // 하트 자리·크기(k = 하트 곡선 1칸의 길이), 시작점
      let cx, cy, k, sx, sy;
      if (wide) {
        k = Math.min(vh * 0.2, W * 0.13) / 16;
        cx = W / 2 + Math.min(vh * 0.52, W * 0.37);
        cy = HH * 0.45 - 2 * k;
        sx = br ? br.right - hr.left + 18 : W * 0.3;
        sy = br ? br.top - hr.top + br.height / 2 : HH * 0.3;
      } else {
        k = Math.min(W * 0.2, HH * 0.17) / 16;
        cx = W * 0.74; cy = HH * 0.52;
        sx = -12; sy = br ? br.bottom - hr.top + 14 : HH * 0.35;
      }
      const X = (t) => cx + hx(t) * k, Y = (t) => cy + hy(t) * k;
      const E = 0.42;                                   // 꼭지 조금 위에서 선이 엇갈린다
      // 점들을 부드럽게 잇는 곡선(캣멀-롬). 맨 앞·맨 뒤 점은 방향만 잡아 주고 긋지는 않는다.
      const spline = (P, per) => {
        const o = [];
        for (let i = 1; i < P.length - 2; i++) {
          const a = P[i - 1], b = P[i], c = P[i + 1], d = P[i + 2];
          for (let j = 0; j < per; j++) {
            const t = j / per, t2 = t * t, t3 = t2 * t;
            o.push([0.5 * (2 * b[0] + (c[0] - a[0]) * t + (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * t2 + (3 * b[0] - a[0] - 3 * c[0] + d[0]) * t3),
                    0.5 * (2 * b[1] + (c[1] - a[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * t2 + (3 * b[1] - a[1] - 3 * c[1] + d[1]) * t3)]);
          }
        }
        return o;
      };
      const at = (dx, dy) => [cx + dx * k, cy + dy * k];
      const pr = [X(Math.PI - E), Y(Math.PI - E)], prN = [X(Math.PI - E - 0.25), Y(Math.PI - E - 0.25)];
      const pl = [X(Math.PI + E), Y(Math.PI + E)], plP = [X(Math.PI + E + 0.25), Y(Math.PI + E + 0.25)];
      // 들어오는 선: 화면 맨 아래에서 올라와 → 꼭지를 지나 오른쪽 볼을 타고 올라간다(목사님 말씀: 아래에서 올라와 한 획을 긋고 아래로 사라지게)
      const ey = HH + 30;
      const lerpY = (dy, q) => Math.min(cy + dy * k, ey - q);
      let pts = spline([[cx - 19 * k, ey + 80], [cx - 17 * k, ey], [cx - 11.5 * k, lerpY(32, 70)], at(-4, 21.5), pr, prN], 14);
      // 하트: 오른쪽 볼 → 가운데 골 → 왼쪽 볼 → 꼭지 쪽으로
      for (let t = Math.PI - E; t > 0; t -= 0.06) pts.push([X(t), Y(t)]);
      for (let t = 2 * Math.PI; t > Math.PI + E; t -= 0.06) pts.push([X(t), Y(t)]);
      // 나가는 선: 꼭지를 지나 아래로
      pts = pts.concat(spline([plP, pl, at(2.6, 23), [cx + 6.5 * k, lerpY(34, 60)], [cx + 8 * k, ey], [cx + 8.5 * k, ey + 80]], 12));
      seed = 5252;
      const base = Math.max(1.6, k * 0.34);
      const passes = [[1, 0.95, 0], [0.7, 0.55, 0.14], [0.55, 0.4, 0.26]].map(([w, op, dl], p) => {
        // 느린 흔들림: 몇 점마다 어긋남을 정하고 그 사이를 고르게 잇는다
        const amp = p ? k * 0.42 : k * 0.1, step = 9;
        const off = [];
        for (let i = 0; i <= pts.length / step + 1; i++) off.push([R(-amp, amp), R(-amp, amp)]);
        const q = pts.map((pt, i) => {
          const a = Math.floor(i / step), t = (i % step) / step, s = t * t * (3 - 2 * t);
          return [pt[0] + off[a][0] * (1 - s) + off[a + 1][0] * s, pt[1] + off[a][1] * (1 - s) + off[a + 1][1] * s];
        });
        return stroke(polyPath(q, 0, true), base * w, op, 0.5 + dl, 2.8);
      });
      el.setAttribute("viewBox", `0 0 ${W} ${HH}`);
      // 맨 아래에서는 선이 옅어지며 사라진다
      const fade = `<linearGradient id="phHeartFadeG" gradientUnits="userSpaceOnUse" x1="0" y1="${f(HH - Math.min(150, HH * 0.22))}" x2="0" y2="${f(HH)}"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity=".08"/></linearGradient>
        <mask id="phHeartFade" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${HH + 40}"><rect width="${W}" height="${HH + 40}" fill="url(#phHeartFadeG)"/></mask>`;
      el.innerHTML = `${DEFS("phHeartGrain").replace("</defs>", fade + "</defs>")}<g mask="url(#phHeartFade)"><g filter="url(#phHeartGrain)">${passes.join("")}</g></g>`;
    }
    draw();
    let timer = 0, lastW = hero.clientWidth;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (Math.abs(hero.clientWidth - lastW) > 4 || window.matchMedia("(min-width: 1025px)").matches) { lastW = hero.clientWidth; draw(); } }, 180);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    replayOnView(el, hero);
  }

  heartHero();
  worldMap();
  hwaseongMap();
})();
