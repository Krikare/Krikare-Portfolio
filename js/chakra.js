(() => {
  // Ashoka Chakra cursor: inside the campus ring on the home page only, the pointer
  // becomes a translucent 24-spoke wheel. It turns slowly on its own and eases a
  // little faster or backwards as you sweep the mouse, like a calm, heavy wheel.
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const stage = document.getElementById("stage");
  if (!stage) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The red ring from the design, as percentages of the campus stage.
  const REGION = { cx: 47.5, cy: 52, rx: 44, ry: 44.5 };
  // Anything here keeps the normal cursor.
  const BLOCK = ".topbar, .menu-dropdown, .panel, .bgm, .unwrap-cue, .scroll-view, .dock";

  const OPACITY = 0.9; // translucent
  const IDLE_SPIN = 0.26; // rad/s while still (about one turn every 24s)
  const SWEEP_GAIN = 1 / 520; // extra rad/s per px/s of horizontal mouse speed
  const SWEEP_MAX = 0.9; // cap on that extra spin, rad/s
  const SPIN_EASE = 520; // ms; bigger = heavier, calmer changes in speed

  // --- DOM -----------------------------------------------------------------
  const root = document.createElement("div");
  root.className = "chakra";
  root.setAttribute("aria-hidden", "true");
  const img = document.createElement("img");
  // Swap to "assets/ashoka-chakra-navy.svg" for the flag-navy version.
  img.src = "assets/ashoka-chakra.svg?v=white1";
  img.alt = "";
  img.width = 44;
  img.height = 44;
  img.draggable = false;
  root.appendChild(img);
  document.body.appendChild(root);

  // --- state ---------------------------------------------------------------
  const mouse = { x: -999, y: -999 };
  const pos = { x: -999, y: -999 };
  let active = false;
  let locked = false;
  let angle = 0;
  let omega = IDLE_SPIN;
  let vis = 0;
  let scaleHot = 1;
  let lastT = 0;
  let raf = 0;

  function clamp(n, a, b) {
    return Math.min(b, Math.max(a, n));
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
    document.body.classList.toggle("chakra-on", on);
    if (on) {
      pos.x = mouse.x;
      pos.y = mouse.y;
      vis = Math.max(vis, 0.3);
      omega = IDLE_SPIN;
      root.style.display = "block";
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

  function kick() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  // --- frame ---------------------------------------------------------------
  function tick(now) {
    raf = 0;
    const dt = lastT ? Math.min(40, now - lastT) : 16.7;
    lastT = now;

    if (active && globalBlock()) setActive(false);

    if (active) {
      const k = reduce ? 1 : 1 - Math.exp(-dt / 34);
      const px = pos.x;
      pos.x += (mouse.x - pos.x) * k;
      pos.y += (mouse.y - pos.y) * k;
      if (!reduce) {
        const vx = ((pos.x - px) / dt) * 1000; // px/s, signed
        const target = IDLE_SPIN + clamp(vx * SWEEP_GAIN, -SWEEP_MAX, SWEEP_MAX);
        omega += (target - omega) * (1 - Math.exp(-dt / SPIN_EASE));
        angle += omega * (dt / 1000);
      }
    }

    vis += ((active ? 1 : 0) - vis) * (1 - Math.exp(-dt / 90));
    scaleHot += ((locked ? 1.18 : 1) - scaleHot) * (1 - Math.exp(-dt / 140));

    const s = (0.6 + 0.4 * vis) * scaleHot;
    root.style.opacity = (clamp(vis, 0, 1) * OPACITY).toFixed(3);
    root.style.transform = `translate3d(${pos.x.toFixed(2)}px, ${pos.y.toFixed(2)}px, 0) scale(${s.toFixed(3)})`;
    img.style.transform = `rotate(${angle.toFixed(4)}rad)`;

    if (active || vis > 0.01) {
      raf = requestAnimationFrame(tick);
    } else {
      root.style.display = "none";
      lastT = 0;
    }
  }
})();
