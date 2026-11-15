/* Contact card: eye button reveals / hides the blurred phone number. */
(() => {
  const eye = document.getElementById("ccEye");
  const num = document.getElementById("ccNum");
  if (!eye || !num) return;

  let timer = 0;
  const set = (show) => {
    eye.setAttribute("aria-pressed", String(show));
    eye.setAttribute("aria-label", show ? "Hide phone number" : "Show phone number");
    num.classList.toggle("is-shown", show);
    num.setAttribute("aria-hidden", String(!show));
    window.clearTimeout(timer);
    if (show) timer = window.setTimeout(() => set(false), 8000);
  };

  eye.addEventListener("click", () => set(eye.getAttribute("aria-pressed") !== "true"));
})();

/* Name: scrambles zig-zag, then settles into Telugu; later scrambles again and settles into English. */
(() => {
  const el = document.getElementById("ccName");
  if (!el) return;

  const NAMES = [
    { cls: "is-te", text: "కార్తీక్ రెడ్డి పెద్దాల", pool: "అఆఇఈఉఊఎఏఐఒఓకఖగఘచఛజఝటఠడఢణతథదధనపఫబభమయరలవశషసహ" },
    { cls: "is-en", text: "Karthik Reddy Peddala", pool: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" },
  ];
  const HOLD = 3000; // ms the finished name stays on screen
  const TICK = 60; // ms between random glyph swaps
  const SETTLE = 420; // ms before the first letter locks in
  const STAGGER = 38; // extra ms per following letter

  const seg = window.Intl && Intl.Segmenter ? new Intl.Segmenter("te", { granularity: "grapheme" }) : null;
  const split = (t) => (seg ? Array.from(seg.segment(t), (x) => x.segment) : Array.from(t));
  const pick = (pool) => pool[Math.floor(Math.random() * pool.length)];

  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let idx = 1; // markup starts on English; first animation goes to Telugu
  let raf = 0;
  let timer = 0;
  let visible = true;
  let started = false;
  const card = el.closest(".contact-card");

  function build(target) {
    el.className = "cc-name-in " + target.cls;
    el.textContent = "";
    return split(target.text).map((ch) => {
      const s = document.createElement("span");
      s.className = "cc-g" + (ch === " " ? " is-space" : "");
      s.textContent = ch === " " ? "\u00a0" : pick(target.pool);
      el.appendChild(s);
      return { s, ch, done: ch === " " };
    });
  }

  function play(target, done) {
    const slots = build(target);
    const start = performance.now();
    let last = 0;
    let flip = 1;

    const frame = () => {
      const now = performance.now(); // same clock as `start` (rAF's own timestamp can differ)
      const t = now - start;
      if (now - last >= TICK) {
        last = now;
        flip = -flip;
        slots.forEach((g, i) => {
          if (g.done) return;
          const lockAt = SETTLE + i * STAGGER;
          if (t >= lockAt) {
            g.done = true;
            g.s.textContent = g.ch;
            g.s.style.transform = "";
            return;
          }
          g.s.textContent = pick(target.pool);
          const left = 1 - t / lockAt; // 1 → 0 as it settles
          const dir = (i % 2 ? 1 : -1) * flip; // neighbours move opposite ways: zig-zag
          g.s.style.transform = `translateY(${(dir * 0.16 * (0.35 + left)).toFixed(3)}em)`;
        });
      }
      if (slots.every((g) => g.done)) {
        raf = 0;
        done();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  function next() {
    window.clearTimeout(timer);
    timer = 0;
    if (!visible || document.hidden) return; // resumes via the observers below
    // card is on a hidden page (studio not shown): check again shortly instead of animating unseen
    if (card && getComputedStyle(card).visibility === "hidden") {
      timer = window.setTimeout(next, 800);
      return;
    }
    idx = (idx + 1) % NAMES.length;
    play(NAMES[idx], () => {
      timer = window.setTimeout(() => {
        timer = 0;
        next();
      }, HOLD);
    });
  }

  const resume = () => {
    if (started && visible && !document.hidden && !raf && !timer) next();
  };
  if (card && "IntersectionObserver" in window) {
    new IntersectionObserver((es) => {
      visible = es[0].isIntersecting;
      if (!visible) {
        cancelAnimationFrame(raf);
        window.clearTimeout(timer);
        raf = 0;
        timer = 0;
      } else resume();
    }).observe(card);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      raf = 0;
      timer = 0;
    } else resume();
  });

  // kick off after fonts are ready so the first frames don't reflow
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => {
    started = true;
    timer = window.setTimeout(next, 600);
  });
})();
