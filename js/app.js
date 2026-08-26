(() => {
  const weatherBtn = document.getElementById("weatherBtn");
  const weatherMenu = document.getElementById("weatherMenu");
  const menuBtn = document.getElementById("menuBtn");
  const navMenu = document.getElementById("navMenu");
  const stage = document.getElementById("stage");
  const pin = document.getElementById("pin");
  const pinTitle = document.getElementById("pinTitle");
  const pinSub = document.getElementById("pinSub");
  const rainCanvas = document.getElementById("rainCanvas");
  const noiseCanvas = document.getElementById("noiseCanvas");
  const birdCanvas = document.getElementById("birdCanvas");
  const lightning = document.getElementById("lightning");
  const rainCtx = rainCanvas.getContext("2d");
  const noiseCtx = noiseCanvas.getContext("2d");
  const birdCtx = birdCanvas.getContext("2d");

  const rain = [];
  const birds = [];
  const bolts = [];
  let vw = innerWidth;
  let vh = innerHeight;

  const storm = {
    nextAt: 2200,
    keys: [],
    until: 0,
  };

  function viewportSize() {
    vw = window.visualViewport?.width || innerWidth;
    vh = window.visualViewport?.height || innerHeight;
  }

  function sizeCanvases() {
    viewportSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    [rainCanvas, noiseCanvas, birdCanvas].forEach((node) => {
      node.width = Math.round(vw * dpr);
      node.height = Math.round(vh * dpr);
      node.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }

  function seedRain() {
    rain.length = 0;
    const n = Math.floor((vw * vh) / 11000);
    for (let i = 0; i < n; i += 1) {
      rain.push({
        x: Math.random() * vw,
        y: Math.random() * vh,
        len: 8 + Math.random() * 12,
        speed: 7 + Math.random() * 7,
        thick: Math.random() < 0.18 ? 1.2 : 0.65,
      });
    }
  }

  function seedBirds() {
    birds.length = 0;
    const count = vw < 700 ? 5 : 8;
    for (let i = 0; i < count; i += 1) {
      birds.push({
        x: Math.random() * vw,
        y: 40 + Math.random() * vh * 0.42,
        s: 0.5 + Math.random() * 0.85,
        vx: 0.28 + Math.random() * 0.42,
        phase: Math.random() * Math.PI * 2,
        dir: Math.random() < 0.5 ? 1 : -1,
      });
    }
  }

  const noiseTile = document.createElement("canvas");
  noiseTile.width = 160;
  noiseTile.height = 90;
  const noiseTileCtx = noiseTile.getContext("2d");
  let lastNoise = 0;

  function drawNoise(force) {
    const now = performance.now();
    if (!force && now - lastNoise < 2400) return;
    lastNoise = now;
    const img = noiseTileCtx.createImageData(160, 90);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + Math.random() * 50;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 28;
    }
    noiseTileCtx.putImageData(img, 0, 0);
    noiseCtx.save();
    noiseCtx.setTransform(1, 0, 0, 1, 0, 0);
    noiseCtx.clearRect(0, 0, noiseCanvas.width, noiseCanvas.height);
    noiseCtx.imageSmoothingEnabled = false;
    noiseCtx.drawImage(noiseTile, 0, 0, 160, 90, 0, 0, noiseCanvas.width, noiseCanvas.height);
    noiseCtx.restore();
  }

  function makeBolt() {
    const startX = vw * (0.42 + Math.random() * 0.22);
    const endX = startX + (Math.random() * 90 - 45);
    const endY = vh * (0.22 + Math.random() * 0.18);
    const pts = [{ x: startX, y: -10 }];
    let x = startX;
    let y = -10;
    while (y < endY) {
      y += 18 + Math.random() * 26;
      x += Math.random() * 34 - 17;
      pts.push({ x, y });
    }
    pts.push({ x: endX, y: endY });
    if (Math.random() > 0.4) {
      const forkAt = 2 + Math.floor(Math.random() * Math.max(1, pts.length - 3));
      const fx = pts[forkAt].x;
      const fy = pts[forkAt].y;
      const fork = [{ x: fx, y: fy }];
      let bx = fx;
      let by = fy;
      for (let i = 0; i < 4; i += 1) {
        bx += 16 + Math.random() * 22;
        by += 14 + Math.random() * 18;
        fork.push({ x: bx, y: by });
      }
      return { pts, fork, born: performance.now(), life: 420 };
    }
    return { pts, fork: null, born: performance.now(), life: 420 };
  }

  function stormOpacity(now) {
    let peak = 0;
    storm.keys.forEach((k) => {
      const d = now - k.t;
      if (d < 0 || d > k.hold + k.fade) return;
      const v = d < k.hold ? k.peak : k.peak * (1 - (d - k.hold) / k.fade);
      if (v > peak) peak = v;
    });
    return peak;
  }

  function startStorm(now) {
    storm.keys = [
      { t: now, peak: 0.16, hold: 40, fade: 140 },
      { t: now + 420, peak: 0.52, hold: 55, fade: 180 },
      { t: now + 880, peak: 0.2, hold: 40, fade: 160 },
      { t: now + 2200, peak: 0.68, hold: 70, fade: 240 },
      { t: now + 2580, peak: 0.24, hold: 45, fade: 320 },
    ];
    storm.until = now + 3400;
    bolts.length = 0;
    bolts.push(makeBolt());
    const later = makeBolt();
    later.born += 2180;
    later.life = 420;
    bolts.push(later);
    storm.nextAt = now + 14000 + Math.random() * 8000;
  }

  function drawBolt(bolt, now) {
    const age = now - bolt.born;
    if (age < 0) return true;
    if (age > bolt.life) return false;
    const a = 1 - age / bolt.life;
    birdCtx.save();
    birdCtx.globalAlpha = a;
    birdCtx.strokeStyle = `rgba(230, 242, 255, ${0.95 * a})`;
    birdCtx.lineWidth = 1.6;
    birdCtx.shadowColor = "rgba(180, 210, 255, 0.9)";
    birdCtx.shadowBlur = 12;
    birdCtx.beginPath();
    bolt.pts.forEach((p, i) => (i ? birdCtx.lineTo(p.x, p.y) : birdCtx.moveTo(p.x, p.y)));
    birdCtx.stroke();
    if (bolt.fork) {
      birdCtx.lineWidth = 1;
      birdCtx.beginPath();
      bolt.fork.forEach((p, i) => (i ? birdCtx.lineTo(p.x, p.y) : birdCtx.moveTo(p.x, p.y)));
      birdCtx.stroke();
    }
    birdCtx.restore();
    return true;
  }

  function tick(t) {
    const raining = document.body.dataset.weather === "rain";
    rainCtx.clearRect(0, 0, vw, vh);
    birdCtx.clearRect(0, 0, vw, vh);

    if (raining) {
      if (t >= storm.nextAt) startStorm(t);
      const flash = stormOpacity(t);
      lightning.style.opacity = String(flash * (1 - cover));

      rainCtx.strokeStyle = "rgba(214, 228, 238, 0.48)";
      rain.forEach((drop) => {
        rainCtx.lineWidth = drop.thick;
        rainCtx.beginPath();
        rainCtx.moveTo(drop.x, drop.y);
        rainCtx.lineTo(drop.x - 1.8, drop.y + drop.len);
        rainCtx.stroke();
        drop.y += drop.speed;
        drop.x -= 0.55;
        if (drop.y > vh) {
          drop.y = -20;
          drop.x = Math.random() * vw;
        }
      });

      for (let i = bolts.length - 1; i >= 0; i -= 1) {
        if (!drawBolt(bolts[i], t)) bolts.splice(i, 1);
      }
    } else {
      lightning.style.opacity = "0";
      bolts.length = 0;
    }

    birdCtx.strokeStyle = "rgba(250, 250, 250, 0.88)";
    birdCtx.lineWidth = 1.15;
    birds.forEach((b) => {
      b.x += b.vx * b.dir;
      b.y += Math.sin(t / 520 + b.phase) * 0.22;
      b.phase += 0.14;
      if (b.x > vw + 40) b.x = -40;
      if (b.x < -40) b.x = vw + 40;
      const flap = Math.sin(b.phase) * 5.5 * b.s;
      birdCtx.beginPath();
      birdCtx.moveTo(b.x - 7 * b.s, b.y + flap * 0.15);
      birdCtx.quadraticCurveTo(b.x, b.y - flap, b.x + 7 * b.s, b.y + flap * 0.15);
      birdCtx.stroke();
    });

    drawNoise(false);
    requestAnimationFrame(tick);
  }

  function autoTime() {
    const h = new Date().getHours();
    if (h < 6 || h >= 20) return "night";
    if (h < 8) return "dawn";
    if (h >= 17) return "sunset";
    return "day";
  }

  function applyTime(value) {
    const resolved = value === "auto" ? autoTime() : value;
    document.body.dataset.time = resolved;
    document.body.dataset.timePref = value;
    weatherMenu.querySelectorAll("[data-time]").forEach((btn) => {
      btn.querySelector(".sq").classList.toggle("on", btn.dataset.time === value);
    });
  }

  function applyWeather(value) {
    document.body.dataset.weather = value;
    weatherMenu.querySelectorAll("[data-weather]").forEach((btn) => {
      btn.querySelector(".sq").classList.toggle("on", btn.dataset.weather === value);
    });
    if (value === "rain") storm.nextAt = performance.now() + 1800;
  }

  function closeMenus(except) {
    if (except !== "weather") {
      weatherMenu.hidden = true;
      weatherBtn.classList.remove("is-open");
      weatherBtn.setAttribute("aria-expanded", "false");
    }
    if (except !== "nav") {
      navMenu.hidden = true;
      menuBtn.classList.remove("is-open");
      menuBtn.setAttribute("aria-expanded", "false");
    }
  }

  function openPanel(id) {
    document.querySelectorAll(".panel").forEach((el) => {
      el.hidden = el.id !== id;
    });
    const active = document.activeElement;
    if (active && active.classList?.contains("hot")) active.blur();
  }

  const PINS = {
    parliament: { title: "Parliament", sub: "Skills & Projects", x: 28, y: 22 },
    hawa: { title: "Hawa Mahal", sub: "Contact", x: 52, y: 7 },
    qutub: { title: "Qutub Minar", sub: "Education", x: 74, y: 8 },
    fort: { title: "Red Fort", sub: "Achievements", x: 74, y: 47 },
    gate: { title: "India Gate", sub: "About", x: 50, y: 59 },
  };

  function showPin(key) {
    const data = PINS[key];
    if (!data || !pin || cover > 0.08) return;
    pinTitle.textContent = data.title;
    pinSub.textContent = data.sub;
    pin.hidden = false;
    pin.style.left = `${data.x}%`;
    pin.style.top = `${data.y}%`;
    requestAnimationFrame(() => pin.classList.add("is-on"));
  }

  function hidePin() {
    pin?.classList.remove("is-on");
  }

  document.querySelectorAll(".hot").forEach((hot) => {
    hot.addEventListener("pointerenter", () => showPin(hot.dataset.pin));
    hot.addEventListener("pointerleave", hidePin);
    hot.addEventListener("click", (e) => {
      e.preventDefault();
      hidePin();
      const id = hot.dataset.panel;
      if (!id) return;
      history.replaceState(null, "", "#" + id);
      openPanel(id);
    });
  });

  function closePanels() {
    document.querySelectorAll(".panel").forEach((el) => {
      el.hidden = true;
    });
    if (location.hash) history.replaceState(null, "", " ");
  }

  weatherBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = weatherMenu.hidden;
    closeMenus("weather");
    weatherMenu.hidden = !open;
    weatherBtn.classList.toggle("is-open", open);
    weatherBtn.setAttribute("aria-expanded", String(open));
  });

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = navMenu.hidden;
    closeMenus("nav");
    navMenu.hidden = !open;
    menuBtn.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
  });

  weatherMenu.addEventListener("click", (e) => {
    const btn = e.target.closest(".opt");
    if (!btn) return;
    if (btn.dataset.time) applyTime(btn.dataset.time);
    if (btn.dataset.weather) applyWeather(btn.dataset.weather);
  });

  document.addEventListener("click", () => closeMenus());

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", closePanels);
  });

  window.addEventListener("hashchange", () => {
    const id = location.hash.slice(1);
    if (document.getElementById(id)?.classList.contains("panel")) openPanel(id);
    else closePanels();
    closeMenus();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePanels();
      closeMenus();
    }
  });

  function onResize() {
    sizeCanvases();
    seedRain();
    seedBirds();
    drawNoise(true);
  }

  window.addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("resize", onResize);
  if (stage && window.ResizeObserver) {
    new ResizeObserver(onResize).observe(stage);
  }

  const unwrapCue = document.getElementById("unwrapCue");
  const wrapBack = document.getElementById("wrapBack");
  const edition = document.getElementById("edition");
  const sheetLive = document.getElementById("sheetLive");
  const halfTop = document.getElementById("halfTop");
  const halfBot = document.getElementById("halfBot");

  let cover = 0;
  let coverTarget = 0;
  let snapping = false;
  let drag = null;
  let wheelAcc = 0;
  let coverRaf = 0;
  let lastCoverT = 0;
  let lastBucket = -1;
  let ripPts = [];
  let ripTop = [];
  let ripBot = [];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const RIP_N = 168;

  function clamp(n, a, b) {
    return Math.min(b, Math.max(a, n));
  }

  function hash(i) {
    const n = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  function hairLine(backbone, intoGap) {
    const pts = [];
    backbone.forEach(([x, y], i) => {
      pts.push([x, y]);
      if (i === 0 || i === backbone.length - 1) return;
      const len = 0.55 + hash(i + 11) * 1.55;
      const lean = (hash(i + 19) - 0.5) * 0.35;
      pts.push([x + 0.06 + lean, y + intoGap * len]);
      pts.push([x + 0.2, y]);
    });
    return pts;
  }

  function initRip() {
    const fiber = new Float32Array(RIP_N + 1);
    for (let i = 0; i <= RIP_N; i++) {
      const a = hash(i) - 0.5;
      const b = hash(i + 23) - 0.5;
      const c = hash(i + 47) - 0.5;
      fiber[i] = a * 1.35 + b * 0.7 + c * 0.32;
    }
    for (let i = 1; i < RIP_N; i++) {
      fiber[i] = fiber[i] * 0.5 + fiber[i - 1] * 0.28 + fiber[i + 1] * 0.22;
    }
    ripPts = [];
    for (let i = 0; i <= RIP_N; i++) {
      const x = (i / RIP_N) * 100;
      const sharp = hash(i * 5 + 2);
      const spike =
        sharp > 0.9 ? (hash(i + 41) - 0.5) * 3.1 : sharp > 0.8 ? (hash(i + 13) - 0.5) * 1.7 : 0;
      ripPts.push([x, 50 + fiber[i] * 2.15 + spike]);
    }
    ripTop = hairLine(ripPts, 1);
    ripBot = hairLine(ripPts, -1);
  }

  function clipStr(pts) {
    return pts.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(", ");
  }

  function makeRipEdge(pts) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "rip-edge");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    const d = pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
    const back = document.createElementNS(ns, "path");
    back.setAttribute("d", d);
    back.setAttribute("fill", "none");
    back.setAttribute("stroke", "#0c0c0c");
    back.setAttribute("stroke-width", "1.45");
    back.setAttribute("stroke-linejoin", "miter");
    back.setAttribute("stroke-linecap", "butt");
    const front = document.createElementNS(ns, "path");
    front.setAttribute("d", d);
    front.setAttribute("fill", "none");
    front.setAttribute("stroke", "#222");
    front.setAttribute("stroke-width", "0.5");
    front.setAttribute("stroke-linejoin", "miter");
    svg.append(back, front);
    return svg;
  }

  function tearClip() {
    if (!halfTop || !halfBot || !ripTop.length) return;
    halfTop.style.clipPath = `polygon(0% 0%, 100% 0%, ${clipStr(ripTop.slice().reverse())})`;
    halfBot.style.clipPath = `polygon(${clipStr(ripBot)}, 100% 100%, 0% 100%)`;
  }

  function cloneHalves() {
    if (!sheetLive || !halfTop || !halfBot) return;
    [
      [halfTop, ripTop],
      [halfBot, ripBot],
    ].forEach(([half, pts]) => {
      half.replaceChildren();
      const copy = sheetLive.cloneNode(true);
      copy.id = "";
      copy.classList.remove("paper-live");
      copy.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      copy.querySelectorAll("button, a").forEach((node) => node.setAttribute("tabindex", "-1"));
      half.appendChild(copy);
      half.appendChild(makeRipEdge(pts));
    });
    tearClip();
  }

  function viewportH() {
    return window.visualViewport?.height || innerHeight;
  }

  function travelMax() {
    return viewportH() * 0.5;
  }

  function applyCover(p) {
    const open = 1 - p;
    const y = open * travelMax();
    const tilt = open * 0.7;
    document.documentElement.style.setProperty("--cover", p.toFixed(4));
    edition.style.setProperty("--tear-y", `${y.toFixed(2)}px`);
    edition.style.setProperty("--tear-r", `${tilt.toFixed(3)}deg`);
    if (p > 0.08) hidePin();
    const tearing = p < 0.985;
    const interactive = p > 0.08;
    const covering = p > 0.02;
    const unwrapped = p > 0.92;
    const paged = p > 0.985;
    const bucket =
      (tearing ? 1 : 0) |
      (interactive ? 2 : 0) |
      (covering ? 4 : 0) |
      (unwrapped ? 8 : 0) |
      (paged ? 16 : 0);
    if (bucket === lastBucket) return;
    lastBucket = bucket;
    edition.classList.toggle("is-tearing", tearing);
    edition.classList.toggle("is-interactive", interactive);
    edition.setAttribute("aria-hidden", interactive ? "false" : "true");
    document.body.classList.toggle("is-covering", covering);
    document.body.classList.toggle("is-unwrapped", unwrapped);
    document.body.classList.toggle("is-paged", paged);
    if (!paged && window.scrollY) window.scrollTo(0, 0);
    if (unwrapCue) unwrapCue.style.pointerEvents = p > 0.55 ? "none" : "auto";
    if (paged) kickWheel();
  }

  function kickCover() {
    if (!coverRaf) coverRaf = requestAnimationFrame(tickCover);
  }

  function tickCover(now) {
    coverRaf = 0;
    const dt = lastCoverT ? Math.min(33, now - lastCoverT) : 16.67;
    lastCoverT = now;

    if (wheelAcc) {
      coverTarget = clamp(coverTarget + wheelAcc / travelMax(), 0, 1);
      wheelAcc = 0;
    }

    if (drag || reduceMotion) {
      cover = coverTarget;
      snapping = false;
    } else if (snapping) {
      cover += (coverTarget - cover) * (1 - Math.exp(-dt / 90));
      if (Math.abs(coverTarget - cover) < 0.00035) {
        cover = coverTarget;
        snapping = false;
      }
    } else if (Math.abs(coverTarget - cover) > 0.00008) {
      cover += (coverTarget - cover) * (1 - Math.exp(-dt / 18));
      if (Math.abs(coverTarget - cover) < 0.00008) cover = coverTarget;
    }

    applyCover(cover);
    if (drag || snapping || Math.abs(coverTarget - cover) > 0.00008) kickCover();
  }

  function setCoverImmediate(p) {
    snapping = false;
    coverTarget = clamp(p, 0, 1);
    cover = coverTarget;
    applyCover(cover);
  }

  function setCoverSnap(p) {
    coverTarget = clamp(p, 0, 1);
    if (reduceMotion) {
      cover = coverTarget;
      snapping = false;
      applyCover(cover);
      return;
    }
    snapping = true;
    kickCover();
  }

  function onCoverDelta(px) {
    if (coverTarget >= 0.999 && px > 0) return false;
    if (coverTarget >= 0.999 && window.scrollY > 2) return false;
    if (coverTarget <= 0 && px < 0) return false;
    wheelAcc += px;
    kickCover();
    return true;
  }

  function wheelPixels(e) {
    if (e.deltaMode === 1) return e.deltaY * 16;
    if (e.deltaMode === 2) return e.deltaY * viewportH();
    return e.deltaY;
  }

  wrapBack?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.scrollTo(0, 0);
    setCoverSnap(0);
  });

  unwrapCue?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && coverTarget > 0) {
      if (document.querySelector(".panel:not([hidden])")) return;
      window.scrollTo(0, 0);
      setCoverSnap(0);
    }
  });

  window.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey) return;
      if (document.querySelector(".panel:not([hidden])")) return;
      if (onCoverDelta(wheelPixels(e))) e.preventDefault();
    },
    { passive: false }
  );

  const dragHandles = [unwrapCue, edition].filter(Boolean);

  function dragFrom(el) {
    el.addEventListener("pointerdown", (e) => {
      if (e.button && e.button !== 0) return;
      if (e.target.closest("a, .wrap-back, .paper-bio, .paper-toc, .paper-photo")) return;
      if (document.body.classList.contains("is-paged") && window.scrollY > 4) return;
      drag = {
        id: e.pointerId,
        y: e.clientY,
        start: cover,
        moved: 0,
        fromCue: el === unwrapCue,
      };
      snapping = false;
      el.setPointerCapture?.(e.pointerId);
      if (el !== unwrapCue && !document.body.classList.contains("is-paged")) e.preventDefault();
      kickCover();
    });
  }

  dragHandles.forEach(dragFrom);

  window.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = drag.y - e.clientY;
    drag.moved = Math.max(drag.moved, Math.abs(dy));
    coverTarget = clamp(drag.start + dy / travelMax(), 0, 1);
    kickCover();
  });

  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const wasCueTap = drag.fromCue && drag.moved < 8;
    drag = null;
    if (wasCueTap) {
      setCoverSnap(1);
      return;
    }
    if (cover > 0.94) setCoverSnap(1);
    else if (cover < 0.06) setCoverSnap(0);
  }

  let wheelItems = [];
  let wheelRings = [];
  let wheelAngle = 0;
  let wheelRaf = 0;
  let lastWheelT = 0;
  const reduceWheel = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ICON = "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/";
  const SI = "https://cdn.simpleicons.org/";

  function skillSrc(skill) {
    if (skill.u) return skill.u;
    if (skill.d) return ICON + skill.d;
    if (skill.s) return SI + skill.s;
    return "";
  }

  function markLogo(node, skill) {
    const span = document.createElement("span");
    span.textContent = skill.m || skill.name.slice(0, 3);
    node.appendChild(span);
  }

  function buildWheel() {
    const mount = document.getElementById("skillWheel");
    if (!mount) return;
    const skills = [
      { name: "AWS", d: "amazonwebservices/amazonwebservices-plain-wordmark.svg" },
      { name: "EC2", m: "EC2" },
      { name: "IAM", m: "IAM" },
      { name: "VPC", m: "VPC" },
      { name: "EKS", m: "EKS" },
      { name: "S3", m: "S3" },
      { name: "Route 53", m: "R53" },
      { name: "Docker", d: "docker/docker-original.svg" },
      { name: "Kubernetes", d: "kubernetes/kubernetes-plain.svg" },
      { name: "Terraform", d: "terraform/terraform-original.svg" },
      { name: "ArgoCD", s: "argo" },
      { name: "GitHub Actions", s: "githubactions" },
      { name: "CI/CD", m: "CI" },
      { name: "Linux", d: "linux/linux-original.svg" },
      { name: "Shell Scripting", s: "gnubash" },
      { name: "Git", d: "git/git-original.svg" },
      { name: "GitHub", d: "github/github-original.svg" },
      { name: "GCP", d: "googlecloud/googlecloud-original.svg" },
      { name: "Java", d: "java/java-original.svg" },
      { name: "Python", d: "python/python-original.svg" },
      { name: "C++", d: "cplusplus/cplusplus-original.svg" },
      { name: "C", d: "c/c-original.svg" },
      { name: "JavaScript", d: "javascript/javascript-original.svg" },
      { name: "TypeScript", d: "typescript/typescript-original.svg" },
      { name: "SQL", d: "azuresqldatabase/azuresqldatabase-original.svg" },
      { name: "Bash", d: "bash/bash-original.svg" },
      { name: "React", d: "react/react-original.svg" },
      { name: "Node.js", d: "nodejs/nodejs-original.svg" },
      { name: "REST APIs", m: "API" },
      { name: "WebSockets", m: "WS" },
      { name: "Express.js", d: "express/express-original.svg" },
      { name: "Playwright", d: "playwright/playwright-original.svg" },
      { name: "OpenAI API", u: "https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/openai.svg" },
      { name: "PostgreSQL", d: "postgresql/postgresql-original.svg" },
      { name: "MySQL", d: "mysql/mysql-original.svg" },
      { name: "MongoDB", d: "mongodb/mongodb-original.svg" },
      { name: "Firebase", d: "firebase/firebase-plain.svg" },
      { name: "Redis", d: "redis/redis-original.svg" },
      { name: "Django", d: "django/django-plain.svg" },
      { name: "Socket.io", d: "socketio/socketio-original.svg" },
      { name: "FastAPI", s: "fastapi" },
      { name: "LangChain", s: "langchain" },
      { name: "RAG", m: "RAG" },
      { name: "NLP", m: "NLP" },
      { name: "ETL/ELT", m: "ETL" },
      { name: "Data Structures & Algorithms", m: "DSA" },
      { name: "Object-Oriented Programming", m: "OOP" },
      { name: "Operating Systems", m: "OS" },
      { name: "Computer Networks", m: "NET" },
      { name: "Database Management Systems", m: "DB" },
      { name: "System Design", m: "SD" },
      { name: "OAuth", s: "auth0" },
    ];
    const rings = [
      { r: 0.145, n: 8, dir: 1 },
      { r: 0.27, n: 12, dir: -1 },
      { r: 0.39, n: 14, dir: 1 },
      { r: 0.505, n: 18, dir: -1 },
    ];
    wheelRings = rings;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "wheel-frame");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("aria-hidden", "true");
    rings.forEach((ring) => {
      const c = document.createElementNS(ns, "circle");
      c.setAttribute("class", "wheel-ring");
      c.setAttribute("cx", "50");
      c.setAttribute("cy", "50");
      c.setAttribute("r", String(ring.r * 100));
      svg.appendChild(c);
    });
    function svgEl(name, attrs) {
      const el = document.createElementNS(ns, name);
      Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
      return el;
    }

    const hub = document.createElementNS(ns, "g");
    hub.setAttribute("class", "wheel-hub");
    hub.setAttribute("transform", "translate(50 50)");
    hub.append(
      svgEl("circle", { class: "wheel-core", r: "6.8", "stroke-width": "0.28" }),
      svgEl("rect", {
        class: "hub-pkg",
        x: "-2.9",
        y: "-2.9",
        width: "5.8",
        height: "5.8",
        rx: "0.38",
        "stroke-width": "0.3",
      }),
      svgEl("rect", {
        class: "hub-die",
        x: "-1.72",
        y: "-1.72",
        width: "3.44",
        height: "3.44",
        rx: "0.16",
        "stroke-width": "0.18",
      }),
      svgEl("path", {
        class: "hub-code",
        d: "M-1.08-0.72l-0.72 0.72 0.72 0.72M1.08-0.72l0.72 0.72-0.72 0.72M-0.22 0.82l0.48-1.64",
        "stroke-width": "0.32",
      }),
      svgEl("circle", { class: "hub-notch", cx: "-2.05", cy: "-2.05", r: "0.26" })
    );
    const pins = document.createElementNS(ns, "g");
    pins.setAttribute("class", "hub-pins");
    pins.setAttribute("stroke-width", "0.26");
    const edge = 2.9;
    const pin = 1.08;
    [-1.35, 0, 1.35].forEach((offset) => {
      pins.append(
        svgEl("line", { x1: offset, y1: -edge, x2: offset, y2: -(edge + pin) }),
        svgEl("line", { x1: offset, y1: edge, x2: offset, y2: edge + pin }),
        svgEl("line", { x1: -edge, y1: offset, x2: -(edge + pin), y2: offset }),
        svgEl("line", { x1: edge, y1: offset, x2: edge + pin, y2: offset })
      );
    });
    hub.insertBefore(pins, hub.children[1]);
    svg.append(hub);

    const orbit = document.createElement("div");
    orbit.className = "wheel-orbit";
    const veil = document.createElement("div");
    veil.className = "wheel-veil";

    wheelItems = [];
    let cursor = 0;
    rings.forEach((ring, ringIndex) => {
      const slice = skills.slice(cursor, cursor + ring.n);
      cursor += ring.n;
      const step = (Math.PI * 2) / slice.length;
      slice.forEach((skill, i) => {
        const base = i * step + (ringIndex % 2 ? step * 0.5 : 0) + ringIndex * 0.08;
        const node = document.createElement("div");
        node.className = "skill-logo";
        node.title = skill.name;
        const src = skillSrc(skill);
        if (src) {
          const img = document.createElement("img");
          img.alt = skill.name;
          img.src = src;
          img.loading = "eager";
          img.addEventListener("error", () => {
            img.remove();
            markLogo(node, skill);
          });
          node.appendChild(img);
        } else {
          markLogo(node, skill);
        }
        orbit.appendChild(node);
        wheelItems.push({ node, r: ring.r, base, dir: ring.dir });
      });
    });

    mount.replaceChildren(svg, orbit, veil);
    fitLogos();
    placeWheel(0);
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => {
        fitLogos();
        placeWheel(wheelAngle);
      }).observe(mount);
    }
  }

  function fitLogos() {
    const size = document.getElementById("skillWheel")?.clientWidth || 1;
    let space = Infinity;
    wheelRings.forEach((ring, i) => {
      space = Math.min(space, (2 * Math.PI * ring.r * size) / ring.n);
      if (i) space = Math.min(space, (ring.r - wheelRings[i - 1].r) * size);
    });
    const logo = Math.max(38, Math.min(64, space * 0.72));
    wheelItems.forEach((item) => {
      item.node.style.width = `${logo.toFixed(1)}px`;
      item.node.style.height = `${logo.toFixed(1)}px`;
    });
  }

  function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function placeWheel(t) {
    const size = document.getElementById("skillWheel")?.clientWidth || 1;
    wheelItems.forEach((item) => {
      const ang = item.base + t * item.dir;
      const x = Math.sin(ang);
      const y = -Math.cos(ang);
      const px = x * item.r * size;
      const py = y * item.r * size;
      const into = reduceWheel ? 0 : smoothstep(0.24, -0.32, x);
      const blur = into * 7.5;
      item.node.style.transform = `translate(-50%, -50%) translate(${px}px, ${py}px)`;
      item.node.style.filter = blur > 0.18 ? `blur(${blur.toFixed(2)}px)` : "none";
      item.node.style.opacity = String(1 - into * 0.2);
      item.node.style.zIndex = String(Math.round((1 + x) * 10));
    });
  }

  function kickWheel() {
    if (!wheelRaf) wheelRaf = requestAnimationFrame(tickWheel);
  }

  function tickWheel(now) {
    wheelRaf = 0;
    if (!document.body.classList.contains("is-paged")) {
      lastWheelT = 0;
      return;
    }
    const dt = lastWheelT ? Math.min(48, now - lastWheelT) : 16.67;
    lastWheelT = now;
    if (!reduceWheel) wheelAngle += dt * 0.00015;
    placeWheel(wheelAngle);
    wheelRaf = requestAnimationFrame(tickWheel);
  }

  function watchStudio() {
    const studio = document.getElementById("studio");
    if (!studio || !window.IntersectionObserver) {
      studio?.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          studio.classList.toggle("is-in", entry.isIntersecting);
        });
      },
      { threshold: 0.28 }
    );
    io.observe(studio);
  }

  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
  window.addEventListener("resize", () => {
    applyCover(cover);
    placeWheel(wheelAngle);
  });
  window.visualViewport?.addEventListener("resize", () => {
    applyCover(cover);
    placeWheel(wheelAngle);
  });

  initRip();
  cloneHalves();
  buildWheel();
  watchStudio();
  applyCover(0);
  applyTime("day");
  applyWeather("rain");
  if (/debug=hots/.test(location.search)) document.body.classList.add("debug-hots");
  if (/edition/.test(location.search)) setCoverImmediate(1);
  sizeCanvases();
  seedRain();
  seedBirds();
  drawNoise(true);
  requestAnimationFrame(tick);

  if (location.hash) {
    const id = location.hash.slice(1);
    if (document.getElementById(id)?.classList.contains("panel")) openPanel(id);
  }
})();
