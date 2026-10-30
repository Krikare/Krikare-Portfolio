(() => {
  // Jet cursor: inside the campus ring on the home page only, the pointer becomes
  // an Indian Air Force Tejas that banks toward the cursor's direction and leaves
  // a saffron / white / green tricolour trail.
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const stage = document.getElementById("stage");
  if (!stage) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The red ring from the design, as percentages of the campus stage.
  const REGION = { cx: 47.5, cy: 52, rx: 44, ry: 44.5 };
  // Anything here keeps the normal cursor.
  const BLOCK = ".topbar, .menu-dropdown, .panel, .bgm, .unwrap-cue, .scroll-view";

  const JET_W = 44;
  const JET_H = 64;
  const NOZZLE = 30; // px behind the jet's centre where the trail starts
  const LIFE = 1050; // ms a trail point lives
  const MAX_POINTS = 140;
  const BANDS = [
    { k: -1, rgb: "255,153,51" }, // saffron
    { k: 0, rgb: "255,255,255" }, // white
    { k: 1, rgb: "26,160,38" }, // green
  ];

  // --- DOM -----------------------------------------------------------------
  const canvas = document.createElement("canvas");
  canvas.id = "jetTrail";
  canvas.setAttribute("aria-hidden", "true");
  const jet = document.createElement("div");
  jet.className = "jet";
  jet.setAttribute("aria-hidden", "true");
  const body = document.createElement("div");
  body.className = "jet-body";
  const img = document.createElement("img");
  img.src = "assets/jet.png";
  img.alt = "";
  img.width = JET_W;
  img.height = JET_H;
  img.draggable = false;
  body.appendChild(img);
  jet.appendChild(body);
  document.body.append(canvas, jet);
  const ctx = canvas.getContext("2d");

  // --- state ---------------------------------------------------------------
  const mouse = { x: -999, y: -999 };
  const pos = { x: -999, y: -999 };
  const trail = [];
  let active = false;
  let locked = false;
  let fresh = true;
  let heading = -Math.PI / 2; // nose up
  let bank = 0;
  let side = 1; // keeps saffron on the upper side of the flag
  let sideV = 1;
  let vis = 0;
  let lockScale = 1;
  let lastT = 0;
  let raf = 0;
  let dpr = 1;
  let vw = innerWidth;
  let vh = innerHeight;

  function sizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = innerWidth;
    vh = innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clamp(n, a, b) {
    return Math.min(b, Math.max(a, n));
  }

  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function globalBlock() {
    return (
      document.body.classList.contains("is-covering") ||
      !!document.querySelector(".panel:not([hidden])") ||
      !document.getElementById("scrollView")?.hidden
    );
  }

  function insideRegion(x, y, wasIn) {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const nx = ((x - r.left) / r.width) * 100 - REGION.cx;
    const ny = ((y - r.top) / r.height) * 100 - REGION.cy;
    const d = (nx * nx) / (REGION.rx * REGION.rx) + (ny * ny) / (REGION.ry * REGION.ry);
    return d < (wasIn ? 1.05 : 0.97);
  }

  function setActive(on) {
    if (on === active) return;
    active = on;
    document.body.classList.toggle("jet-on", on);
    if (on) {
      pos.x = mouse.x;
      pos.y = mouse.y;
      fresh = true;
      bank = 0;
      vis = Math.max(vis, 0.35);
      jet.style.display = "block";
    } else {
      locked = false;
    }
    kick();
  }

  function onMove(e) {
    if (e.pointerType === "touch") return;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    const target = e.target;
    const allowed = !globalBlock() && !(target && target.closest && target.closest(BLOCK));
    setActive(allowed && insideRegion(e.clientX, e.clientY, active));
    locked = active && !!(target && target.closest && target.closest(".hot"));
  }

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onMove, { passive: true });
  document.addEventListener("mouseleave", () => setActive(false));
  window.addEventListener("blur", () => setActive(false));
  window.addEventListener("resize", sizeCanvas);

  function kick() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  // --- trail ---------------------------------------------------------------
  function emit(now, dt) {
    const dx = Math.cos(heading);
    const dy = Math.sin(heading);
    if (dx > 0.2) side = 1;
    else if (dx < -0.2) side = -1;
    // Ease the flag orientation so a reversal reads as a ribbon twist, not a hard cross-over.
    sideV += (side - sideV) * (reduce ? 1 : 1 - Math.exp(-dt / 70));
    const tx = pos.x - dx * NOZZLE;
    const ty = pos.y - dy * NOZZLE;
    const last = trail[trail.length - 1];
    if (last && Math.hypot(tx - last.x, ty - last.y) < 2.5) return;
    trail.push({ x: tx, y: ty, t: now, nx: dy * sideV, ny: -dx * sideV });
    if (trail.length > MAX_POINTS) trail.shift();
  }

  function trace(path, pts) {
    path.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i += 1) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      path.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    path.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }

  function drawTrail(now) {
    ctx.clearRect(0, 0, vw, vh);
    const n = trail.length;
    if (n < 2) return;
    const newest = trail[n - 1];
    const fade = clamp(1 - (now - newest.t) / LIFE, 0, 1);
    if (fade <= 0.01) return;
    const oldest = trail[0];
    // Newest point first so the gradient runs head -> tail.
    const pts = trail.slice().reverse();

    BANDS.forEach((band) => {
      const lo = [];
      const hi = [];
      pts.forEach((p) => {
        const age = clamp((now - p.t) / LIFE, 0, 1);
        const bw = 3.6 + 3.8 * age;
        lo.push({ x: p.x + p.nx * (band.k - 0.5) * bw, y: p.y + p.ny * (band.k - 0.5) * bw });
        hi.push({ x: p.x + p.nx * (band.k + 0.5) * bw, y: p.y + p.ny * (band.k + 0.5) * bw });
      });
      const path = new Path2D();
      trace(path, lo);
      const hiRev = hi.slice().reverse();
      path.lineTo(hiRev[0].x, hiRev[0].y);
      for (let i = 1; i < hiRev.length - 1; i += 1) {
        const mx = (hiRev[i].x + hiRev[i + 1].x) / 2;
        const my = (hiRev[i].y + hiRev[i + 1].y) / 2;
        path.quadraticCurveTo(hiRev[i].x, hiRev[i].y, mx, my);
      }
      path.lineTo(hiRev[hiRev.length - 1].x, hiRev[hiRev.length - 1].y);
      path.closePath();

      const grad = ctx.createLinearGradient(newest.x, newest.y, oldest.x, oldest.y);
      grad.addColorStop(0, `rgba(${band.rgb}, ${(0.95 * fade).toFixed(3)})`);
      grad.addColorStop(0.55, `rgba(${band.rgb}, ${(0.5 * fade).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${band.rgb}, 0)`);
      ctx.fillStyle = grad;
      ctx.fill(path);
    });
  }

  function drawGlow(now) {
    if (vis < 0.05) return;
    const tx = pos.x - Math.cos(heading) * (NOZZLE - 2);
    const ty = pos.y - Math.sin(heading) * (NOZZLE - 2);
    const pulse = 0.82 + 0.18 * Math.sin(now / 55);
    const r = 15 * pulse;
    const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, r);
    g.addColorStop(0, `rgba(255, 214, 150, ${(0.75 * vis).toFixed(3)})`);
    g.addColorStop(0.45, `rgba(255, 140, 50, ${(0.35 * vis).toFixed(3)})`);
    g.addColorStop(1, "rgba(255, 120, 30, 0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(tx - r, ty - r, r * 2, r * 2);
    ctx.restore();
  }

  // --- frame ---------------------------------------------------------------
  function tick(now) {
    raf = 0;
    const dt = lastT ? Math.min(40, now - lastT) : 16.7;
    lastT = now;

    if (active && globalBlock()) setActive(false);

    if (active) {
      const k = reduce ? 1 : 1 - Math.exp(-dt / 42);
      const px = pos.x;
      const py = pos.y;
      pos.x += (mouse.x - pos.x) * k;
      pos.y += (mouse.y - pos.y) * k;
      const mx = pos.x - px;
      const my = pos.y - py;
      const speed = Math.hypot(mx, my) / dt;
      let turning = 0;
      if (speed > 0.05) {
        const want = Math.atan2(my, mx);
        if (fresh) {
          heading = want;
          fresh = false;
        }
        const diff = wrapAngle(want - heading);
        heading = wrapAngle(heading + diff * (reduce ? 1 : 1 - Math.exp(-dt / 105)));
        turning = clamp(diff * 1.7, -0.7, 0.7);
      }
      bank += (turning - bank) * (1 - Math.exp(-dt / 150));
      if (!reduce) emit(now, dt);
    }

    vis += ((active ? 1 : 0) - vis) * (1 - Math.exp(-dt / 80));
    lockScale += ((locked ? 1.14 : 1) - lockScale) * (1 - Math.exp(-dt / 100));
    while (trail.length && now - trail[0].t > LIFE) trail.shift();

    const s = (0.55 + 0.45 * vis) * lockScale;
    const sx = s * (1 - Math.abs(bank) * 0.2);
    jet.style.opacity = vis.toFixed(3);
    jet.style.transform = `translate3d(${pos.x.toFixed(2)}px, ${pos.y.toFixed(2)}px, 0)`;
    body.style.transform = `rotate(${(heading + Math.PI / 2).toFixed(4)}rad) scale(${sx.toFixed(3)}, ${s.toFixed(3)})`;

    drawTrail(now);
    drawGlow(now);

    if (active || vis > 0.01 || trail.length) {
      raf = requestAnimationFrame(tick);
    } else {
      jet.style.display = "none";
      ctx.clearRect(0, 0, vw, vh);
      lastT = 0;
    }
  }

  sizeCanvas();
})();
