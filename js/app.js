(() => {
  const weatherBtn = document.getElementById("weatherBtn");
  const weatherMenu = document.getElementById("weatherMenu");
  const menuBtn = document.getElementById("menuBtn");
  const navMenu = document.getElementById("navMenu");
  const pin = document.getElementById("pin");
  const pinTitle = document.getElementById("pinTitle");
  const pinSub = document.getElementById("pinSub");
  const stage = document.getElementById("stage");
  const rainCanvas = document.getElementById("rainCanvas");
  const noiseCanvas = document.getElementById("noiseCanvas");
  const birdCanvas = document.getElementById("birdCanvas");
  const lightning = document.getElementById("lightning");
  const rainCtx = rainCanvas.getContext("2d");
  const noiseCtx = noiseCanvas.getContext("2d");
  const birdCtx = birdCanvas.getContext("2d");

  const PINS = {
    parliament: { title: "Parliament", sub: "About", x: 28, y: 22 },
    hawa: { title: "Hawa Mahal", sub: "Projects", x: 52, y: 7 },
    qutub: { title: "Qutub Minar", sub: "Skills", x: 73, y: 10 },
    fort: { title: "Red Fort", sub: "Work", x: 74, y: 47 },
    gate: { title: "India Gate", sub: "Contact", x: 50, y: 59 },
  };

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
      lightning.style.opacity = String(flash);

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
  }

  function closePanels() {
    document.querySelectorAll(".panel").forEach((el) => {
      el.hidden = true;
    });
    if (location.hash) history.replaceState(null, "", " ");
  }

  function showPin(key) {
    const data = PINS[key];
    if (!data) return;
    pinTitle.textContent = data.title;
    pinSub.textContent = data.sub;
    pin.hidden = false;
    pin.style.left = `${data.x}%`;
    pin.style.top = `${data.y}%`;
    requestAnimationFrame(() => pin.classList.add("is-on"));
  }

  function hidePin() {
    pin.classList.remove("is-on");
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

  document.querySelectorAll(".hot").forEach((hot) => {
    hot.addEventListener("pointerenter", () => showPin(hot.dataset.pin));
    hot.addEventListener("pointerleave", hidePin);
    hot.addEventListener("focus", () => showPin(hot.dataset.pin));
    hot.addEventListener("blur", hidePin);
  });

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

  applyTime("day");
  applyWeather("rain");
  if (/debug=hots/.test(location.search)) document.body.classList.add("debug-hots");
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
