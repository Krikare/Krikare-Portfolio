(() => {
  // Drop audio files in assets/music and add them here.
  const TRACKS = [
    { src: "assets/music/sundari-neeve.mp3", title: "Sundari Neeve" },
  ];

  const DEFAULT_VOLUME = 15;
  const CHOICE_KEY = "campus-bgm";
  const VOL_KEY = "campus-bgm-vol";

  const ask = document.getElementById("bgmAsk");
  const allowBtn = document.getElementById("bgmAllow");
  const declineBtn = document.getElementById("bgmDecline");
  const openBtn = document.getElementById("bgmOpen");
  const gemBtn = document.getElementById("bgmGem");
  const menu = document.getElementById("bgmMenu");
  const songsEl = document.getElementById("bgmSongs");
  const toggleBtn = document.getElementById("bgmToggle");
  const volumeInput = document.getElementById("bgmVolume");
  const volumeLabel = document.getElementById("bgmVolLabel");
  const titleEl = document.getElementById("bgmTitle");
  const missingEl = document.getElementById("bgmMissing");
  const audio = document.getElementById("bgmAudio");
  const root = document.getElementById("bgm");
  if (!ask || !openBtn || !menu || !audio || !volumeInput || !root) return;

  let index = 0;
  let volume = readVolume();
  let wanted = false;
  let userPaused = true;
  let resumeBtn = null;
  let ctx = null;
  let master = null;

  volumeInput.value = String(volume);
  paintVolume(volume);
  audio.loop = TRACKS.length === 1;
  audio.volume = 1;
  renderSongs();
  showTrack(0);
  setPlaying(false);

  const saved = localStorage.getItem(CHOICE_KEY);
  if (saved === "on") {
    ask.hidden = true;
    wanted = true;
    userPaused = false;
    armGesture();
  } else if (saved === "off") {
    ask.hidden = true;
  }

  allowBtn.addEventListener("click", () => accept());
  declineBtn?.addEventListener("click", () => decline());
  openBtn.addEventListener("click", () => {
    const opening = menu.hidden;
    toggleMenu();
    if (opening && audio.paused) resumePlayback();
  });
  gemBtn?.addEventListener("click", () => {
    if (audio.paused) resumePlayback();
    else pausePlayback();
  });
  toggleBtn?.addEventListener("click", () => {
    if (root.classList.contains("is-paused")) resumePlayback();
    else pausePlayback();
  });
  volumeInput.addEventListener("input", () => {
    volume = clamp(Number(volumeInput.value), 0, 100);
    paintVolume(volume);
    localStorage.setItem(VOL_KEY, String(volume));
    applyLevel(0.08);
  });

  audio.addEventListener("play", () => {
    if (userPaused) {
      audio.pause();
      return;
    }
    setPlaying(true);
    if (missingEl) missingEl.hidden = true;
  });
  audio.addEventListener("pause", () => {
    if (userPaused) setPlaying(false);
  });
  audio.addEventListener("ended", () => {
    if (!userPaused) playIndex(index + 1);
  });
  audio.addEventListener("error", () => {
    setPlaying(false);
    if (missingEl) {
      missingEl.hidden = false;
      missingEl.textContent = `Add ${fileName(TRACKS[index].src)} to assets/music.`;
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (menu.hidden) return;
    if (event.target?.closest?.(".bgm-dock")) return;
    setMenu(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
  });

  function accept() {
    userPaused = false;
    wanted = true;
    localStorage.setItem(CHOICE_KEY, "on");
    ask.hidden = true;
    resumeBtn?.remove();
    ensureAudio();
  }

  function decline() {
    userPaused = true;
    wanted = false;
    localStorage.setItem(CHOICE_KEY, "off");
    ask.hidden = true;
    audio.pause();
    setPlaying(false);
  }

  function armGesture() {
    const go = (event) => {
      if (event.target?.closest?.(".bgm")) return;
      document.removeEventListener("pointerdown", go, true);
      if (wanted && !userPaused) ensureAudio();
    };
    document.addEventListener("pointerdown", go, true);
  }

  function ensureAudio() {
    if (userPaused) return;
    const nextSrc = new URL(TRACKS[index].src, location.href).href;
    if (audio.src !== nextSrc) audio.src = nextSrc;
    const fade = wireBed();
    applyLevel(fade ? 3.2 : 0.2);
    const attempt = audio.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => {
        setPlaying(false);
        if (missingEl) {
          missingEl.hidden = false;
          missingEl.textContent = "Press Sound again to start the track.";
        }
      });
    }
  }

  function pausePlayback() {
    userPaused = true;
    setPlaying(false);
    audio.pause();
  }

  function resumePlayback() {
    userPaused = false;
    wanted = true;
    localStorage.setItem(CHOICE_KEY, "on");
    ask.hidden = true;
    setPlaying(true);
    ensureAudio();
  }

  function playIndex(next) {
    userPaused = false;
    wanted = true;
    index = (next + TRACKS.length) % TRACKS.length;
    showTrack(index);
    renderSongs();
    audio.src = TRACKS[index].src;
    applyLevel(1.6);
    localStorage.setItem(CHOICE_KEY, "on");
    ask.hidden = true;
    if (missingEl) missingEl.hidden = true;
    ensureAudio();
  }

  function renderSongs() {
    if (!songsEl) return;
    songsEl.replaceChildren();
    TRACKS.forEach((track, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bgm-song" + (i === index ? " is-on" : "");
      button.textContent = track.title;
      button.addEventListener("click", () => playIndex(i));
      songsEl.appendChild(button);
    });
  }

  function showTrack(i) {
    const track = TRACKS[i];
    if (!titleEl || !track) return;
    titleEl.textContent = track.title;
    titleEl.title = track.title;
  }

  function toggleMenu() {
    setMenu(menu.hidden);
  }

  function setMenu(open) {
    menu.hidden = !open;
    openBtn.setAttribute("aria-expanded", open ? "true" : "false");
    gemBtn?.setAttribute("aria-label", open ? "Close sound menu" : "Open sound menu");
  }

  function setPlaying(on) {
    root.classList.toggle("is-paused", !on);
    toggleBtn?.setAttribute("aria-label", on ? "Pause soundtrack" : "Play soundtrack");
    gemBtn?.setAttribute("aria-label", on ? "Pause soundtrack" : "Play soundtrack");
    if (toggleBtn) toggleBtn.textContent = on ? "Pause" : "Play";
  }

  function wireBed() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;
    if (!ctx) {
      ctx = new AudioCtx();
      const source = ctx.createMediaElementSource(audio);
      const body = ctx.createBiquadFilter();
      body.type = "highpass";
      body.frequency.value = 140;
      const warm = ctx.createBiquadFilter();
      warm.type = "lowpass";
      warm.frequency.value = 1100;
      warm.Q.value = 0.5;
      const dry = ctx.createGain();
      dry.gain.value = 0.72;
      const delay = ctx.createDelay(1.5);
      delay.delayTime.value = 0.46;
      const damp = ctx.createBiquadFilter();
      damp.type = "lowpass";
      damp.frequency.value = 650;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.34;
      const echo = ctx.createGain();
      echo.gain.value = 0.38;
      master = ctx.createGain();
      master.gain.value = 0;
      source.connect(body);
      body.connect(warm);
      warm.connect(dry);
      dry.connect(master);
      warm.connect(delay);
      delay.connect(damp);
      damp.connect(feedback);
      feedback.connect(delay);
      damp.connect(echo);
      echo.connect(master);
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  function applyLevel(seconds) {
    const target = volume / 100;
    if (!master || !ctx) {
      audio.volume = target;
      return;
    }
    audio.volume = 1;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(target, now + seconds);
  }

  function paintVolume(value) {
    volumeInput.style.setProperty("--bgm-p", `${value}%`);
    if (volumeLabel) volumeLabel.textContent = `${value}%`;
  }

  function fileName(src) {
    return src.split("/").pop();
  }

  function readVolume() {
    const raw = localStorage.getItem(VOL_KEY);
    if (raw == null || raw === "") return DEFAULT_VOLUME;
    const stored = Number(raw);
    if (!Number.isFinite(stored)) return DEFAULT_VOLUME;
    return clamp(stored, 0, 100);
  }

  function clamp(n, a, b) {
    return Math.min(b, Math.max(a, n));
  }
})();
