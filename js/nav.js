(() => {
  // Glass dock: three sections (campus / article / skill wheel) with an Apple-style
  // "liquid glass" lens. Press to lift it, drag it between buttons, release to land.
  const dock = document.getElementById("dock");
  if (!dock) return;
  const track = dock.querySelector(".dock-track");
  const items = Array.from(dock.querySelectorAll(".dock-item"));
  const lens = dock.querySelector(".dock-lens");
  if (!track || !lens || !items.length) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const KEYS = items.map((el) => el.dataset.go); // campus, article, wheel

  // ---- spring tuning (a touch of overshoot, like iOS) -------------------------
  const SLIDE_K = 430; // stiffness
  const SLIDE_C = 27; // damping
  const PRESS_K = 520;
  const PRESS_C = 32;
  const REFRACT_REST = 10; // displacement px when idle
  const REFRACT_PRESS = 34; // extra when pressed
  const REFRACT_MOTION = 22; // extra while sliding fast

  let rects = [];
  let lensW = 0;
  let lensH = 0;
  let active = 0;
  let lock = -1;
  let lockUntil = 0;
  let drag = null;
  let raf = 0;
  let last = 0;

  const s = { x: 0, v: 0, p: 0, pv: 0 };
  let tx = 0; // target x
  let tp = 0; // target press (0..1)

  function measure() {
    rects = items.map((el) => ({ x: el.offsetTop, w: el.offsetHeight }));
    lensW = items[0].offsetWidth;
    lensH = items[0].offsetHeight;
    lens.style.width = `${lensW}px`;
    lens.style.height = `${lensH}px`;
    if (!raf && !drag) {
      s.x = tx = rects[active].x;
      paint();
    }
    sizeRefraction();
  }

  function maxX() {
    return rects[rects.length - 1].x;
  }

  function clamp(n, a, b) {
    return Math.min(b, Math.max(a, n));
  }

  function nearest(xCentre) {
    let best = 0;
    let bestD = Infinity;
    rects.forEach((r, i) => {
      const d = Math.abs(r.x + r.w / 2 - xCentre);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  // ---- refraction (Chromium: backdrop-filter with an SVG displacement map) ----
  const dispR = document.getElementById("dockDispR");
  const dispG = document.getElementById("dockDispG");
  const dispB = document.getElementById("dockDispB");
  const mapEl = document.getElementById("dockMap");
  let refract = false;
  let lastScale = -1;

  function buildMap(lw, lh) {
    const W = Math.round(lw * 3);
    const H = Math.round(lh * 3);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    const img = g.createImageData(W, H);
    const r = Math.min(W, H) / 2;
    const halfX = Math.max(0, W / 2 - r);
    const halfY = Math.max(0, H / 2 - r);
    const depthMax = r * 0.82;
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const cx = x + 0.5 - W / 2;
        const cy = y + 0.5 - H / 2;
        const vx = cx - clamp(cx, -halfX, halfX);
        const vy = cy - clamp(cy, -halfY, halfY);
        const dist = Math.hypot(vx, vy);
        const depth = r - dist;
        let dx = 0;
        let dy = 0;
        if (depth > 0 && dist > 0.001 && depth < depthMax) {
          const m = Math.pow(1 - depth / depthMax, 1.7);
          dx = (-vx / dist) * m; // inward
          dy = (-vy / dist) * m;
        }
        const i = (y * W + x) * 4;
        img.data[i] = clamp(Math.round(128 + dx * 127), 0, 255);
        img.data[i + 1] = clamp(Math.round(128 + dy * 127), 0, 255);
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  }

  function initRefraction() {
    const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
    const chromium = brands.some((b) => /Chromium/i.test(b.brand));
    if (!chromium || reduce || !dispR || !dispG || !dispB || !mapEl) return;
    try {
      mapEl.setAttribute("href", buildMap(items[0].offsetWidth || 44, items[0].offsetHeight || 60));
      refract = true;
      dock.classList.add("dock--refract");
      sizeRefraction();
    } catch (err) {
      refract = false;
    }
  }

  function sizeRefraction() {
    if (!refract) return;
    mapEl.setAttribute("width", String(lensW));
    mapEl.setAttribute("height", String(lensH));
  }

  function setRefraction(scale) {
    if (!refract) return;
    const q = Math.round(scale * 2) / 2;
    if (q === lastScale) return;
    lastScale = q;
    dispR.setAttribute("scale", String(q));
    dispG.setAttribute("scale", String((q * 0.9).toFixed(2)));
    dispB.setAttribute("scale", String((q * 0.8).toFixed(2)));
  }

  // ---- animation --------------------------------------------------------------
  function paint() {
    const speed = Math.min(1, Math.abs(s.v) / 1900);
    const sx = (1 - speed * 0.11) * (1 + 0.15 * s.p);
    const sy = (1 + speed * 0.3) * (1 + 0.15 * s.p);
    lens.style.transform = `translate3d(0,${s.x.toFixed(2)}px,0) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
    setRefraction(REFRACT_REST + REFRACT_PRESS * clamp(s.p, 0, 1.15) + REFRACT_MOTION * speed);
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.032, last ? (now - last) / 1000 : 0.016);
    last = now;

    if (reduce) {
      s.x = tx;
      s.v = 0;
      s.p = tp;
      s.pv = 0;
    } else {
      s.v += (SLIDE_K * (tx - s.x) - SLIDE_C * s.v) * dt;
      s.x += s.v * dt;
      s.pv += (PRESS_K * (tp - s.p) - PRESS_C * s.pv) * dt;
      s.p += s.pv * dt;
    }
    paint();

    const settled =
      Math.abs(tx - s.x) < 0.05 && Math.abs(s.v) < 0.4 && Math.abs(tp - s.p) < 0.002 && Math.abs(s.pv) < 0.02;
    if (settled && !drag) {
      s.x = tx;
      s.v = 0;
      s.p = tp;
      s.pv = 0;
      paint();
      last = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  // ---- selection --------------------------------------------------------------
  function paintActive() {
    items.forEach((el, i) => {
      if (i === active) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
    dock.dataset.tone = active === 0 ? "dark" : "light";
  }

  function setActive(i, moveLens) {
    active = i;
    paintActive();
    if (moveLens && rects[i]) {
      tx = rects[i].x;
      kick();
    }
  }

  function closeOpenPanels() {
    document.querySelectorAll(".panel:not([hidden]) [data-close]").forEach((btn) => btn.click());
  }

  function go(i) {
    const key = KEYS[i];
    const nav = window.campusNav;
    if (!nav || typeof nav[key] !== "function") return;
    closeOpenPanels();
    nav[key]();
  }

  function choose(i) {
    if (i !== active) {
      lock = i;
      lockUntil = performance.now() + 2600;
      setActive(i, true);
      go(i);
    } else {
      tx = rects[i].x;
      kick();
    }
  }

  function sync() {
    if (drag || !window.campusNav) return;
    const idx = KEYS.indexOf(window.campusNav.state());
    if (idx < 0) return;
    if (lock >= 0) {
      if (idx === lock) lock = -1;
      else if (performance.now() < lockUntil) return;
      else lock = -1;
    }
    if (idx !== active) setActive(idx, true);
  }

  // ---- pointer: press to lift, drag to move, release to land -------------------
  function trackX(clientY) {
    return clientY - track.getBoundingClientRect().top;
  }

  function indexAt(clientY) {
    const x = trackX(clientY);
    const i = rects.findIndex((r) => x >= r.x && x <= r.x + r.w + 2);
    return i >= 0 ? i : nearest(x);
  }

  dock.addEventListener("pointerdown", (e) => {
    if (e.button) return;
    const i = indexAt(e.clientY);
    drag = { id: e.pointerId, moved: false, startX: e.clientY, from: active };
    dock.setPointerCapture?.(e.pointerId);
    tp = 1;
    tx = rects[i].x;
    drag.hover = i;
    kick();
  });

  dock.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.abs(e.clientY - drag.startX) > 4) drag.moved = true;
    if (!drag.moved) return;
    tx = clamp(trackX(e.clientY) - lensH / 2, 0, maxX());
    drag.hover = nearest(tx + lensH / 2);
    kick();
  });

  function release(e, cancelled) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const hover = drag.hover;
    const from = drag.from;
    drag = null;
    tp = 0;
    if (dock.hasPointerCapture?.(e.pointerId)) dock.releasePointerCapture(e.pointerId);
    if (cancelled) {
      tx = rects[from].x;
      kick();
      return;
    }
    choose(hover);
  }

  dock.addEventListener("pointerup", (e) => release(e, false));
  dock.addEventListener("pointercancel", (e) => release(e, true));

  // Keyboard: Enter / Space fires a click with detail 0.
  items.forEach((el, i) => {
    el.addEventListener("click", (e) => {
      if (e.detail === 0) choose(i);
    });
  });

  dock.addEventListener("keydown", (e) => {
    const fwd = e.key === "ArrowDown" || e.key === "ArrowRight";
    const back = e.key === "ArrowUp" || e.key === "ArrowLeft";
    if (!fwd && !back) return;
    const next = clamp(active + (fwd ? 1 : -1), 0, items.length - 1);
    items[next].focus();
    choose(next);
    e.preventDefault();
  });

  // ---- keep the lens in step with the real page --------------------------------
  let syncRaf = 0;
  function queueSync() {
    if (syncRaf) return;
    syncRaf = requestAnimationFrame(() => {
      syncRaf = 0;
      sync();
    });
  }

  window.addEventListener("scroll", queueSync, { passive: true });
  window.addEventListener("resize", () => {
    measure();
    queueSync();
  });
  new MutationObserver(queueSync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(queueSync).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style"],
  });

  // ---- boot ---------------------------------------------------------------------
  initRefraction();
  measure();
  if (window.campusNav) {
    const idx = KEYS.indexOf(window.campusNav.state());
    if (idx >= 0) active = idx;
  }
  paintActive();
  s.x = tx = rects[active].x;
  paint();
})();
