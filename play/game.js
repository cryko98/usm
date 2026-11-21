/* =========================================================
   $UTM — The Climb
   Ride the chart. Land on green. Dodge the rug.
   ========================================================= */
(() => {
  "use strict";

  const $ = (q) => document.querySelector(q);
  const canvas = $("#game");
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }
  };

  /* ---------- assets ---------- */
  const load = (src) => { const i = new Image(); i.src = src; return i; };
  const IMG = { up: load("/assets/cat-up.png"), down: load("/assets/cat.png"), sky: load("/assets/sky.jpg") };
  const ready = (img) => img.complete && img.naturalWidth > 0;
  // the logo sky with its upper half faded out, so it melts into the gradient
  let skyCanvas = null;
  const skyMasked = () => {
    if (skyCanvas) return skyCanvas;
    if (!ready(IMG.sky)) return null;
    const c = document.createElement("canvas");
    c.width = IMG.sky.naturalWidth;
    c.height = IMG.sky.naturalHeight;
    const g = c.getContext("2d");
    g.drawImage(IMG.sky, 0, 0);
    g.globalCompositeOperation = "destination-in";
    const m = g.createLinearGradient(0, 0, 0, c.height);
    m.addColorStop(0, "rgba(0,0,0,0)");
    m.addColorStop(0.42, "rgba(0,0,0,.35)");
    m.addColorStop(0.56, "rgba(0,0,0,1)");
    m.addColorStop(1, "rgba(0,0,0,1)");
    g.fillStyle = m;
    g.fillRect(0, 0, c.width, c.height);
    skyCanvas = c;
    return c;
  };

  /* ---------- tuning (world units; the play column is W wide) ---------- */
  const W = 480;
  const G = 1650;          // gravity
  const JUMP = 860;        // ~224 units of height per bounce
  const GOD = 2150;        // god candle launch
  const MAX_FALL = 1500;
  const RUN = 440;
  const MC0 = 4200;        // launch market cap
  const DECADE = 3200;     // world units per 10x
  const BASE_Y = 60;

  const LAYERS = [
    [0, "cruising altitude"],
    [2300, "stratosphere"],
    [5000, "mesosphere"],
    [8000, "kármán line"],
    [11200, "low orbit"],
    [15000, "beyond the chart"],
    [21000, "the moon"]
  ];
  const BUYERS = ["anon", "ser", "degen", "wife-changer", "intern", "dev’s cousin", "a cat", "0x…f00d", "shrimp", "your ex"];
  const SELLERS = ["paper hands", "jeet", "early seller", "anon (regrets)", "a bear"];
  const FUDDERS = ["fud account", "reply guy", "a bear", "ct doomer"];
  const SKY = [
    [0, "#163a8f", "#3d86e6"],
    [3000, "#0f2a74", "#2357d6"],
    [6000, "#0a1a4f", "#16378f"],
    [9000, "#060f33", "#0d2466"],
    [12000, "#040a22", "#091744"],
    [16000, "#030611", "#060c26"]
  ];
  const QUIPS = [
    "i’m up too much", "UTM", "up too much", "+69%", "no top", "send it", "utm.", "number go up",
    "ATH", "parabolic", "still going", "wen top? no.", "ser.", "higher", "green.", "don’t look down"
  ];
  const MILE_LINES = ["i’m up too much", "up too much.", "no top. only up.", "utm.", "say it once.", "the floor was a rumour"];
  const OVER_QUIPS = [
    "you were up too much. then you weren’t.",
    "paper paws.",
    "it’s not a loss if you never check the chart.",
    "the floor was a rumour.",
    "cope is a word too. we just don’t say it here.",
    "should’ve stayed on the green ones."
  ];
  const BG_WORDS = ["UP TOO MUCH", "UTM", "NO TOP", "SEND IT", "UP TOO MUCH", "WAGMI", "UTM", "PARABOLIC"];

  /* ---------- helpers ---------- */
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => {
    const A = hex(a), B = hex(b);
    return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(",")})`;
  };
  const difficulty = (y) => clamp(y / 18000, 0, 1);
  const multAt = (y) => Math.pow(10, Math.max(0, y) / DECADE);
  const fmtMoney = (n) => {
    const u = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
    for (const [v, s] of u) if (n >= v) { const x = n / v; return "$" + (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)) + s; }
    return "$" + n.toFixed(0);
  };
  const fmtX = (m) => (m < 10 ? m.toFixed(2) : Math.round(m).toLocaleString("en-US")) + "x";

  /* ---------- view ---------- */
  let vw = 0, vh = 0, dpr = 1, s = 1, colX = 0, colW = 0, viewH = 0, vignette = null;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    s = Math.min(vw / W, vh / 780);
    colW = W * s;
    colX = (vw - colW) / 2;
    viewH = vh / s;
    vignette = ctx.createRadialGradient(vw / 2, vh * 0.45, Math.min(vw, vh) * 0.3, vw / 2, vh * 0.5, Math.max(vw, vh) * 0.78);
    vignette.addColorStop(0, "rgba(4,8,20,0)");
    vignette.addColorStop(1, "rgba(4,8,20,.55)");
    sizeMini();
  };
  const sx = (x) => colX + x * s;
  const sy = (y) => vh - (y - camY) * s;

  /* ---------- stars ---------- */
  const STARS = Array.from({ length: 240 }, () => ({
    x: Math.random(), y: Math.random(), r: Math.random() < 0.9 ? rand(0.4, 1.2) : rand(1.3, 2.2),
    tw: rand(0, 6.28), warm: Math.random() < 0.55
  }));

  /* ---------- state ---------- */
  let state = "menu";       // menu | play | dead
  let t = 0, camY = 0, peak = 0, bags = 0;
  let genY = 0, genX = W / 2;
  let plats = [], coins = [], fuds = [], parts = [], texts = [];
  let layerIdx = 0, nextMile = 10, boostT = 0;
  let shakeT = 0, shakeMag = 0, flashA = 0, flashC = "#fff";
  let best = parseFloat(store.get("utm_climb_best", "0")) || 0;
  let paused = false;
  let streak = 0, lastLandY = BASE_Y, deathT = 0, slowT = 0, mileUntil = 0, pendingBanner = null;
  let props = [], propT = 2;
  const cat = { x: W / 2, y: BASE_Y, vx: 0, vy: 0, rot: 0, face: 1, sq: 0, spin: 0, spinT: 0, spinDir: 1, pose: 1, swap: 0, trail: [] };
  const SPIN_DUR = 0.62;
  const flip = () => { if (cat.spinT <= 0 && state !== "dead") { cat.spinT = SPIN_DUR; cat.spinDir = cat.face; } };

  const mkPlat = (x, y, w, type, path, d = 0) => ({
    x, y, w, type, path, base: x,
    h: type === "y" ? 78 : type === "r" ? rand(24, 42) : rand(30, 62),
    wt: rand(8, 26), wb: rand(8, 22),
    amp: rand(40, lerp(70, 120, d)), sp: rand(1.1, 2.1) * lerp(1, 1.5, d), ph: rand(0, 6.28),
    hit: 0, dead: false
  });

  const reset = () => {
    plats = []; coins = []; fuds = []; parts = []; texts = [];
    t = 0; peak = 0; bags = 0; layerIdx = 0; nextMile = 10; boostT = 0;
    shakeT = 0; flashA = 0;
    streak = 0; lastLandY = BASE_Y; deathT = 0; slowT = 0; mileUntil = 0; pendingBanner = null;
    props = []; propT = 2;
    chartData.length = 0; chartCur = null;
    genY = BASE_Y; genX = W / 2;
    plats.push(mkPlat(W / 2, BASE_Y, 140, "g", true));
    plats[0].h = 56;
    Object.assign(cat, { x: W / 2, y: BASE_Y, vx: 0, vy: JUMP, rot: 0, face: 1, sq: 0, spin: 0, spinT: 0, trail: [] });
    camY = BASE_Y - viewH * (vw < 640 ? 0.38 : 0.31);
    lastCamY = camY;
    generate(camY + viewH + 600);
    updateHud(true);
  };

  /* ---------- world generation ---------- */
  const generate = (limit) => {
    while (genY < limit) {
      const d = difficulty(genY);
      const gap = rand(lerp(62, 118, d), lerp(120, 192, d));
      genY += gap;
      const swing = lerp(120, 175, d);
      genX = clamp(genX + rand(-swing, swing), 46, W - 46);
      let type = "g";
      if (genY > 900 && Math.random() < 0.03) type = "y";
      else if (genY > 500 && Math.random() < lerp(0.06, 0.4, d)) type = "m";
      plats.push(mkPlat(genX, genY, lerp(82, 54, d) + rand(-6, 6), type, true, d));

      // red decoys: look like a step, rug when touched
      if (genY > 350 && Math.random() < lerp(0.12, 0.4, d)) {
        let rx = genX + (Math.random() < 0.5 ? -1 : 1) * rand(130, 230);
        rx = (((rx - 40) % (W - 80)) + (W - 80)) % (W - 80) + 40;
        plats.push(mkPlat(rx, genY + rand(-55, 55), lerp(78, 58, d), "r", false, d));
      }
      // extra greens early on, so the first minute feels generous
      if (d < 0.3 && Math.random() < 0.3 - d) {
        const ex = clamp(genX + (Math.random() < 0.5 ? -1 : 1) * rand(150, 240), 46, W - 46);
        plats.push(mkPlat(ex, genY + rand(-40, 40), 70, "g", false, d));
      }
      if (Math.random() < 0.24) coins.push({ x: clamp(genX + rand(-70, 70), 30, W - 30), y: genY + rand(70, 150), ph: rand(0, 6.28) });
      if (genY > 2600 && Math.random() < lerp(0.05, 0.13, d)) {
        fuds.push({ x: rand(70, W - 70), y: genY + gap * 0.5 + 30, vx: (Math.random() < 0.5 ? -1 : 1) * rand(40, 95) * lerp(1, 1.4, d), ph: rand(0, 6.28), hit: 0 });
      }
    }
  };

  /* ---------- fx ---------- */
  const shake = (mag, dur) => { if (reduce) return; shakeMag = Math.max(shakeMag, mag); shakeT = Math.max(shakeT, dur); };
  const flash = (c, a) => { if (reduce) a *= 0.3; flashC = c; flashA = Math.max(flashA, a); };
  const burst = (x, y, n, color, kind = "spark", spread = 1) => {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), v = rand(80, 340) * spread;
      parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 + (kind === "debris" ? 120 : 60),
        life: 0, max: rand(0.45, 0.9), size: kind === "debris" ? rand(5, 11) : rand(1.5, 3.6),
        color, kind, rot: rand(0, 6), vr: rand(-10, 10)
      });
    }
  };
  const say = (x, y, text, color = "#fff2df", size = 30, max = 1.2) =>
    texts.push({ x: clamp(x, 70, W - 70), y, text, color, size, life: 0, max, rot: rand(-0.12, 0.12), vy: 70 });

  const banner = $("#banner"), bannerT = $("#bannerT");
  const mile = $("#milestone"), msX = $("#msX"), msT = $("#msT");
  const replay = (el) => { el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); };

  /* ---------- audio ---------- */
  const music = $("#music");
  let muted = store.get("utm_muted", "0") === "1";
  let ac = null, sfxOut = null, musicTarget = 0.75;
  const audioInit = () => {
    if (ac) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      sfxOut = ac.createGain();
      sfxOut.gain.value = 0.55;
      sfxOut.connect(ac.destination);
    } catch { ac = null; }
  };
  const tone = (f0, f1, dur, type = "sine", vol = 0.1, delay = 0) => {
    if (!ac || muted) return;
    const n = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, n);
    o.frequency.exponentialRampToValueAtTime(f1, n + dur);
    g.gain.setValueAtTime(0.0001, n);
    g.gain.exponentialRampToValueAtTime(vol, n + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
    o.connect(g).connect(sfxOut);
    o.start(n);
    o.stop(n + dur + 0.03);
  };
  const noise = (dur, vol, freq) => {
    if (!ac || muted) return;
    const n = ac.currentTime;
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = buf; f.type = "lowpass"; f.frequency.value = freq; g.gain.value = vol;
    src.connect(f).connect(g).connect(sfxOut);
    src.start(n);
  };
  const SFX = {
    bounce: (k = 0) => { const b = 420 * Math.pow(1.06, Math.min(k, 14)); tone(b, b * 1.85, 0.09, "sine", 0.08); },
    coin: () => { tone(988, 1318, 0.07, "triangle", 0.07); tone(1318, 1976, 0.1, "triangle", 0.06, 0.06); },
    rug: () => { noise(0.3, 0.35, 1400); tone(300, 90, 0.25, "square", 0.04); },
    god: () => { tone(160, 1500, 0.7, "sawtooth", 0.05); tone(320, 2200, 0.7, "triangle", 0.05); },
    fud: () => { tone(150, 55, 0.3, "square", 0.06); noise(0.2, 0.2, 500); },
    die: () => tone(440, 60, 0.9, "triangle", 0.12),
    mile: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, f * 1.01, 0.22, "triangle", 0.06, i * 0.07)); }
  };
  const muteBtn = $("#mute");
  const applyMute = () => {
    music.muted = muted;
    muteBtn.setAttribute("aria-pressed", String(muted));
    muteBtn.setAttribute("aria-label", muted ? "Unmute music" : "Mute music");
    store.set("utm_muted", muted ? "1" : "0");
  };
  const toggleMute = () => { muted = !muted; applyMute(); };
  muteBtn.addEventListener("click", toggleMute);
  applyMute();
  music.volume = 0;
  const startMusic = () => {
    const p = music.play();
    if (p && p.catch) p.catch(() => {});
  };

  /* ---------- HUD ---------- */
  const mcEl = $("#mc"), pctEl = $("#pct"), bagsEl = $("#bags"), bagsBox = $(".hud-bags");
  let lastMc = "", lastPct = "";
  const updateHud = (force) => {
    const m = multAt(peak);
    const mc = fmtMoney(MC0 * m);
    const pct = "▲ " + Math.round((m - 1) * 100).toLocaleString("en-US") + "%";
    if (force || mc !== lastMc) { mcEl.textContent = mc; lastMc = mc; }
    if (force || pct !== lastPct) { pctEl.textContent = pct; lastPct = pct; }
    if (force) bagsEl.textContent = bags;
  };

  /* ---------- streak pill ---------- */
  const streakBox = $("#streak"), streakEl = $("#streakN");

  /* ---------- trade feed (wide screens) ---------- */
  const feed = $("#feed");
  const feedPush = (kind, text) => {
    if (!feed || feed.offsetParent === null) return;
    const li = document.createElement("li");
    li.className = "f-" + kind;
    const time = document.createElement("span");
    time.className = "f-t";
    const d = new Date();
    time.textContent = String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0");
    const msg = document.createElement("span");
    msg.textContent = text;
    li.append(time, msg);
    feed.prepend(li);
    while (feed.children.length > 9) feed.lastElementChild.remove();
  };

  /* ---------- your chart: real candles of the run ---------- */
  const mini = $("#mini");
  const mctx = mini ? mini.getContext("2d") : null;
  const chartData = [];
  let chartCur = null, chartClock = 0;
  const chartTick = (dt) => {
    const v = cat.y;
    if (!chartCur) chartCur = { o: v, h: v, l: v, c: v };
    chartCur.h = Math.max(chartCur.h, v);
    chartCur.l = Math.min(chartCur.l, v);
    chartCur.c = v;
    chartClock += dt;
    if (chartClock >= 0.7) {
      chartClock = 0;
      chartData.push(chartCur);
      if (chartData.length > 34) chartData.shift();
      chartCur = { o: v, h: v, l: v, c: v };
    }
  };
  const drawMini = () => {
    if (!mctx || state === "menu") return;
    const cw = mini.width, ch = mini.height;
    mctx.clearRect(0, 0, cw, ch);
    const all = chartCur ? chartData.concat([chartCur]) : chartData;
    if (!all.length) return;
    let lo = Infinity, hi = -Infinity;
    for (const c of all) { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); }
    if (hi - lo < 200) hi = lo + 200;
    const pad = 4, bw = (cw - pad * 2) / 35;
    const Y = (v) => ch - pad - ((v - lo) / (hi - lo)) * (ch - pad * 2);
    all.forEach((c, i) => {
      const x = pad + i * bw + bw / 2;
      const up = c.c >= c.o;
      mctx.strokeStyle = mctx.fillStyle = up ? "#5cff9d" : "#ff5c6c";
      mctx.lineWidth = 1 * dpr;
      mctx.beginPath(); mctx.moveTo(x, Y(c.h)); mctx.lineTo(x, Y(c.l)); mctx.stroke();
      const y1 = Y(Math.max(c.o, c.c)), y2 = Y(Math.min(c.o, c.c));
      mctx.fillRect(x - bw * 0.32, y1, bw * 0.64, Math.max(1.5 * dpr, y2 - y1));
    });
  };
  const sizeMini = () => {
    if (!mini) return;
    mini.width = Math.round(mini.clientWidth * dpr);
    mini.height = Math.round(mini.clientHeight * dpr);
  };

  /* ---------- scenery that drifts past at each altitude ---------- */
  const PROP_KINDS = (alt) =>
    alt < 2300 ? ["plane", "plane", "bird"] :
    alt < 5000 ? ["balloon", "plane"] :
    alt < 8000 ? ["meteor", "meteor", "balloon"] :
    alt < 15000 ? ["satellite", "meteor", "satellite"] :
    ["satellite", "meteor", "comet"];
  const updateProps = (dt) => {
    if (state === "play") {
      propT -= dt;
      if (propT <= 0) {
        propT = rand(2.2, 4.5);
        const kind = pick(PROP_KINDS(camY + viewH * 0.5));
        const dir = Math.random() < 0.5 ? 1 : -1;
        const depth = rand(0.45, 0.85);
        props.push({
          kind, dir, depth,
          x: dir > 0 ? -160 : vw + 160,
          y: rand(0.1, 0.55) * vh,
          v: kind === "meteor" || kind === "comet" ? rand(520, 900) : kind === "plane" ? rand(70, 120) : rand(25, 55),
          life: 0, ph: rand(0, 6.28)
        });
      }
    }
    for (const p of props) {
      p.life += dt;
      p.x += p.dir * p.v * dt * (vw / 1000 + 0.4);
      if (p.kind === "meteor" || p.kind === "comet") p.y += p.v * 0.45 * dt;
    }
    props = props.filter((p) => p.x > -400 && p.x < vw + 400 && p.y < vh + 200);
  };
  let lastCamY = 0;
  const drawProps = () => {
    const dy = (camY - lastCamY) * s;
    lastCamY = camY;
    for (const p of props) {
      p.y += dy * p.depth * 0.5;   // parallax: things far away drift down slower than the chart
      const k = p.depth * Math.max(0.7, s);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = 0.35 + p.depth * 0.5;
      if (p.kind === "plane") {
        ctx.scale(p.dir * k, k);
        ctx.strokeStyle = "rgba(255,255,255,.35)";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-40, 1); ctx.lineTo(-240, 1); ctx.stroke();
        ctx.fillStyle = "#eef3ff";
        ctx.beginPath(); ctx.ellipse(0, 0, 34, 5.5, 0, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-18, 18); ctx.lineTo(-10, 18); ctx.lineTo(8, 0); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-14, -12); ctx.lineTo(-8, -12); ctx.lineTo(6, 0); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-28, -2); ctx.lineTo(-36, -14); ctx.lineTo(-31, -14); ctx.lineTo(-22, -2); ctx.fill();
        ctx.fillStyle = "#ff5c6c";
        if (Math.sin(t * 8 + p.ph) > 0.7) { ctx.beginPath(); ctx.arc(-16, 18, 2, 0, 6.283); ctx.fill(); }
      } else if (p.kind === "bird") {
        ctx.scale(p.dir * k, k);
        ctx.strokeStyle = "rgba(10,26,79,.6)";
        ctx.lineWidth = 2.4;
        for (let i = 0; i < 3; i++) {
          const f = Math.sin(t * 9 + i) * 5;
          const ox = -i * 22, oy = i * 9;
          ctx.beginPath(); ctx.moveTo(ox - 9, oy - f); ctx.quadraticCurveTo(ox - 4, oy - 4, ox, oy); ctx.quadraticCurveTo(ox + 4, oy - 4, ox + 9, oy - f); ctx.stroke();
        }
      } else if (p.kind === "balloon") {
        ctx.scale(k, k);
        ctx.translate(0, Math.sin(t * 1.3 + p.ph) * 6);
        const g = ctx.createRadialGradient(-6, -36, 2, 0, -28, 22);
        g.addColorStop(0, "#fff2df"); g.addColorStop(1, "#ee8a3c");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(0, -28, 18, 22, 0, 0, 6.283); ctx.fill();
        ctx.strokeStyle = "rgba(255,242,223,.6)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-8, -9); ctx.lineTo(-4, 8); ctx.moveTo(8, -9); ctx.lineTo(4, 8); ctx.stroke();
        ctx.fillStyle = "#c9621c"; ctx.fillRect(-5, 8, 10, 7);
      } else if (p.kind === "satellite") {
        ctx.scale(k, k);
        ctx.rotate(Math.sin(t * 0.5 + p.ph) * 0.4);
        ctx.fillStyle = "#3a5bd9";
        ctx.fillRect(-46, -8, 30, 16); ctx.fillRect(16, -8, 30, 16);
        ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1;
        for (const ox of [-46, 16]) for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(ox + i * 10, -8); ctx.lineTo(ox + i * 10, 8); ctx.stroke(); }
        ctx.fillStyle = "#d8d2c4"; ctx.fillRect(-16, -2, 32, 4);
        ctx.fillStyle = "#ffd36b"; ctx.fillRect(-9, -10, 18, 20);
        if (Math.sin(t * 5 + p.ph) > 0.8) { ctx.fillStyle = "#ff5c6c"; ctx.beginPath(); ctx.arc(0, -13, 2.2, 0, 6.283); ctx.fill(); }
      } else {
        const len = p.kind === "comet" ? 260 : 150;
        const ang = Math.atan2(0.45, p.dir);
        ctx.rotate(ang);
        const g = ctx.createLinearGradient(-len, 0, 0, 0);
        g.addColorStop(0, "rgba(255,242,223,0)");
        g.addColorStop(1, p.kind === "comet" ? "rgba(157,220,255,.9)" : "rgba(255,226,170,.9)");
        ctx.strokeStyle = g;
        ctx.lineWidth = p.kind === "comet" ? 4 : 2.2;
        ctx.beginPath(); ctx.moveTo(-len * k, 0); ctx.lineTo(0, 0); ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(0, 0, p.kind === "comet" ? 4 : 2.4, 0, 6.283); ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  /* ---------- game flow ---------- */
  const startScreen = $("#start"), overScreen = $("#over");
  const setState = (st) => {
    state = st;
    document.body.classList.toggle("is-menu", st === "menu");
  };
  const start = () => {
    audioInit();
    if (ac && ac.state === "suspended") ac.resume();
    if (state === "menu") {
      // keep the world from the menu, just start counting
      peak = 0; bags = 0; updateHud(true);
    } else {
      reset();
    }
    startScreen.hidden = true;
    overScreen.hidden = true;
    setState("play");
    musicTarget = 0.8;
    startMusic();
    canvas.focus && canvas.focus();
  };
  const die = () => {
    setState("dead");
    deathT = 0;
    slowT = reduce ? 0 : 0.55;
    cat.spinDir = cat.face;
    streakBox.classList.remove("on");
    feedPush("sell", "position closed. rugged.");
    SFX.die();
    shake(12, 0.4);
    flash("#ff5c6c", 0.35);
    musicTarget = 0.3;
    const isBest = peak > best;
    if (isBest) { best = peak; store.set("utm_climb_best", String(best)); }
    const m = multAt(peak);
    $("#sPeak").textContent = fmtMoney(MC0 * m);
    $("#sX").textContent = fmtX(m);
    $("#sBags").textContent = bags.toLocaleString("en-US");
    $("#sBest").textContent = fmtMoney(MC0 * multAt(best));
    $("#ath").hidden = !isBest || peak < 400;
    $("#quip").textContent = peak < 400 ? "rugged at launch. classic." : pick(OVER_QUIPS);
    const text = `i’m up too much.\n\n$UTM hit ${fmtMoney(MC0 * m)} market cap on my climb (${fmtX(m)} from launch). beat that.\n\nuptoomuch.fun/play`;
    $("#share").href = "https://x.com/intent/tweet?text=" + encodeURIComponent(text);
    setTimeout(() => {
      if (state !== "dead") return;
      overScreen.hidden = false;
      $("#again").focus({ preventScroll: true });
    }, 950);
  };
  $("#play").addEventListener("click", start);
  $("#again").addEventListener("click", start);

  const bestStart = $("#bestStart");
  if (best > 0) bestStart.textContent = "best " + fmtMoney(MC0 * multAt(best));

  /* ---------- input ---------- */
  const keys = { left: false, right: false };
  const pointer = { x: W / 2, active: false };
  addEventListener("keydown", (e) => {
    const k = e.code;
    if (k === "ArrowLeft" || k === "KeyA") { keys.left = true; pointer.active = false; e.preventDefault(); }
    else if (k === "ArrowRight" || k === "KeyD") { keys.right = true; pointer.active = false; e.preventDefault(); }
    else if (k === "KeyM") toggleMute();
    else if (k === "Space" || k === "Enter" || k === "ArrowUp") {
      if (state === "menu" || (state === "dead" && !overScreen.hidden)) {
        if (document.activeElement && document.activeElement.tagName === "A") return;
        e.preventDefault();
        start();
      } else if (k === "Space" || k === "ArrowUp") e.preventDefault();
    }
  });
  addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
  });
  const setPointer = (e) => { pointer.x = (e.clientX - colX) / s; pointer.active = true; };
  canvas.addEventListener("pointerdown", (e) => { setPointer(e); if (e.pointerType !== "mouse") canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || e.buttons) setPointer(e); });
  canvas.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") pointer.active = false; });
  canvas.addEventListener("pointercancel", () => { pointer.active = false; });
  document.addEventListener("visibilitychange", () => {
    paused = document.hidden;
    if (paused) music.pause();
    else if (state !== "menu") startMusic();
  });
  addEventListener("resize", resize);

  /* ---------- update ---------- */
  const land = (p) => {
    if (p.type === "r") {
      p.dead = true;
      burst(p.x, p.y - p.h / 2, 18, "#ff5c6c", "debris", 1.1);
      say(p.x, p.y + 70, "RUG", "#ff5c6c", 34, 0.9);
      SFX.rug();
      shake(7, 0.25);
      if (state === "play") { streak = 0; feedPush("sell", pick(SELLERS) + " dumped " + rand(4, 60).toFixed(1) + " SOL"); }
      return;
    }
    cat.y = p.y;
    cat.vy = p.type === "y" ? GOD : state === "menu" ? 720 : JUMP;
    cat.sq = 1;
    p.hit = 1;
    const col = p.type === "y" ? "#ffd36b" : p.type === "m" ? "#6fffe0" : "#5cff9d";
    burst(p.x + (cat.x - p.x) * 0.5, p.y, 9, col, "spark", 0.7);
    parts.push({ x: clamp(cat.x, p.x - p.w / 2, p.x + p.w / 2), y: p.y, vx: 0, vy: 0, life: 0, max: 0.38, size: p.w, color: col, kind: "ring", rot: 0, vr: 0 });
    if (state !== "play") { SFX.bounce(0); return; }

    // streak: every landing higher than the last one keeps it going
    if (p.y > lastLandY + 25) streak++;
    else if (p.y < lastLandY - 25) streak = 0;
    lastLandY = p.y;

    if (p.type === "y") {
      boostT = 1.25;
      shake(16, 0.55);
      flash("#ffd36b", 0.5);
      burst(cat.x, p.y, 46, "#ffd36b", "spark", 1.6);
      say(cat.x, cat.y + 170, "GOD CANDLE", "#ffd36b", 50, 1.6);
      SFX.god();
      flip();
      feedPush("whale", "whale aped " + Math.round(rand(80, 420)) + " SOL");
    } else {
      SFX.bounce(streak);
      if (streak >= 3 && streak % 5 === 0) {
        say(cat.x, cat.y + 190, "×" + streak + " STREAK", "#5cff9d", 44, 1.3);
        flip();
        SFX.mile();
      } else if (Math.random() < 0.36) {
        const c = Math.random() < 0.3 ? "#ffd36b" : Math.random() < 0.5 ? "#5cff9d" : "#fff2df";
        say(cat.x + rand(-40, 40), cat.y + rand(150, 200), pick(QUIPS), c, rand(26, 36));
      } else if (Math.random() < 0.08) flip();
      if (Math.random() < 0.45) feedPush("buy", pick(BUYERS) + " bought " + rand(0.2, 9).toFixed(1) + " SOL");
    }
    streakEl.textContent = "×" + streak;
    streakBox.classList.toggle("on", streak >= 3);
  };

  // ?autopilot — plays itself (used for testing and for showing it off)
  const AUTOPILOT = /[?&]autopilot\b/.test(location.search);
  const autopilot = () => {
    const apex = cat.y + Math.max(0, cat.vy) * Math.max(0, cat.vy) / (2 * G);
    let best = null;
    for (const p of plats) {
      if (p.dead || p.type === "r") continue;
      if (p.y > apex - 20 || p.y < cat.y - (cat.vy < 0 ? 260 : 60)) continue;
      if (!best || p.y > best.y) best = p;
    }
    if (best) { pointer.x = best.x; pointer.active = true; }
  };

  const update = (dt) => {
    t += dt;
    const playing = state === "play";

    for (const p of plats) {
      if (p.type === "m") p.x = clamp(p.base + Math.sin(t * p.sp + p.ph) * p.amp, p.w / 2 + 4, W - p.w / 2 - 4);
      if (p.hit > 0) p.hit = Math.max(0, p.hit - dt * 3.2);
    }

    // steering
    let target = 0;
    if (playing && AUTOPILOT) autopilot();
    if (playing) {
      if (keys.left) target -= RUN;
      if (keys.right) target += RUN;
      if (!keys.left && !keys.right && pointer.active) target = clamp((pointer.x - cat.x) * 7, -RUN * 1.3, RUN * 1.3);
    } else if (state === "menu") {
      target = clamp((plats[0].x - cat.x) * 4, -200, 200);
    }
    cat.vx += (target - cat.vx) * Math.min(1, dt * (playing ? 11 : 4));
    cat.x += cat.vx * dt;
    // solid walls at the chart edges: one cat, always fully in view
    const EDGE = 34;
    if (cat.x < EDGE) { cat.x = EDGE; if (cat.vx < 0) cat.vx = 0; }
    else if (cat.x > W - EDGE) { cat.x = W - EDGE; if (cat.vx > 0) cat.vx = 0; }
    if (cat.vx < -40) cat.face = -1;
    else if (cat.vx > 40) cat.face = 1;

    const prevY = cat.y;
    cat.vy = Math.max(cat.vy - G * dt, -MAX_FALL);
    cat.y += cat.vy * dt;

    if (cat.vy < 0 && state !== "dead") {
      const list = state === "menu" ? [plats[0]] : plats;
      for (const p of list) {
        if (p.dead || prevY < p.y || cat.y > p.y) continue;
        let dx = Math.abs(cat.x - p.x);
        // no wraparound: plain horizontal distance
        if (dx <= p.w / 2 + 16) { land(p); if (p.type !== "r") break; }
      }
    }

    cat.sq = Math.max(0, cat.sq - dt * 4.5);
    if (cat.swap > 0) cat.swap = Math.max(0, cat.swap - dt * 8);
    if (state === "dead") {
      cat.spin += dt * 6.5 * cat.spinDir;
      cat.rot *= 1 - Math.min(1, dt * 4);
    } else {
      cat.rot += (clamp(cat.vx / 950, -0.32, 0.32) - cat.rot) * Math.min(1, dt * 8);
      if (cat.spinT > 0) {
        cat.spinT = Math.max(0, cat.spinT - dt);
        const u = 1 - cat.spinT / SPIN_DUR;
        const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        cat.spin = -cat.spinDir * Math.PI * 2 * e;
      } else cat.spin = 0;
    }

    if (boostT > 0) {
      boostT -= dt;
      cat.trail.unshift({ x: cat.x, y: cat.y, rot: cat.rot, spin: cat.spin, face: cat.face });
      if (cat.trail.length > 7) cat.trail.pop();
      if (Math.random() < 0.8) parts.push({ x: cat.x + rand(-20, 20), y: cat.y + rand(-10, 30), vx: rand(-30, 30), vy: rand(-260, -120), life: 0, max: rand(0.4, 0.8), size: rand(2, 4), color: "#ffd36b", kind: "spark", rot: 0, vr: 0 });
    } else if (cat.trail.length) cat.trail.pop();

    if (playing) {
      // camera only climbs
      const tgt = cat.y - viewH * 0.42;
      if (tgt > camY) camY += (tgt - camY) * Math.min(1, dt * 7);
      if (cat.y > peak) peak = cat.y;

      // coins
      for (const c of coins) {
        if (c.got) continue;
        let dx = Math.abs(cat.x - c.x);
        const dy = cat.y + 40 - c.y;
        if (dx * dx + dy * dy < 40 * 40) {
          c.got = true;
          bags++;
          bagsEl.textContent = bags;
          bagsBox.classList.remove("pop");
          void bagsBox.offsetWidth;
          bagsBox.classList.add("pop");
          burst(c.x, c.y, 12, "#ffd36b", "spark", 0.8);
          say(c.x, c.y + 30, "+1 $UTM", "#ffd36b", 22, 0.8);
          SFX.coin();
        }
      }

      // FUD
      for (const f of fuds) {
        if (f.hit) continue;
        const dx = (cat.x - f.x) / 62, dy = (cat.y + 40 - f.y) / 36;
        if (dx * dx + dy * dy < 1 && boostT <= 0) {
          f.hit = 0.001;
          cat.vy = Math.min(cat.vy, -420);
          streak = 0;
          streakBox.classList.remove("on");
          feedPush("sell", pick(FUDDERS) + " posted fud");
          say(f.x, f.y + 60, "FUD", "#ff5c6c", 40, 1);
          shake(10, 0.3);
          flash("#ff5c6c", 0.22);
          SFX.fud();
        } else if (dx * dx + dy * dy < 1.4 && boostT > 0) {
          f.hit = 0.001;
          burst(f.x, f.y, 20, "#b9a7ff", "spark", 1);
          say(f.x, f.y + 60, "fud? no.", "#fff2df", 28, 0.9);
        }
      }

      // milestones + layers
      const m = multAt(peak);
      if (m >= nextMile) {
        msX.textContent = (nextMile >= 1000 ? nextMile.toLocaleString("en-US") : nextMile) + "X";
        msT.textContent = pick(MILE_LINES);
        replay(mile);
        SFX.mile();
        flash("#fff2df", 0.18);
        flip();
        feedPush("whale", "you are up " + (nextMile >= 1000 ? nextMile.toLocaleString("en-US") : nextMile) + "x");
        mileUntil = t + 2.1;
        nextMile *= 10;
      }
      while (layerIdx < LAYERS.length - 1 && peak >= LAYERS[layerIdx + 1][0]) {
        layerIdx++;
        pendingBanner = LAYERS[layerIdx][1];
      }
      if (pendingBanner && t >= mileUntil) {
        bannerT.textContent = pendingBanner;
        replay(banner);
        pendingBanner = null;
      }

      chartTick(dt);
      if (cat.y < camY - 150) die();
      generate(camY + viewH + 600);
      updateHud(false);
    }
    if (state === "dead") deathT += dt;
    updateProps(dt);

    for (const f of fuds) {
      f.x += f.vx * dt;
      if (f.x < 60 || f.x > W - 60) { f.vx *= -1; f.x = clamp(f.x, 60, W - 60); }
      if (f.hit) f.hit += dt * 2.2;
    }

    // particles + texts
    for (const p of parts) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= (p.kind === "debris" ? 900 : p.kind === "ring" ? 0 : 260) * dt;
      p.vx *= 1 - dt * 1.5;
      p.rot += p.vr * dt;
    }
    parts = parts.filter((p) => p.life < p.max);
    for (const x of texts) { x.life += dt; x.y += x.vy * dt; x.vy *= 1 - dt * 1.2; }
    texts = texts.filter((x) => x.life < x.max);

    // gold candles shed sparks
    for (const p of plats) {
      if (p.type === "y" && !p.dead && Math.random() < dt * 10 && p.y > camY - 50 && p.y < camY + viewH + 50) {
        parts.push({ x: p.x + rand(-p.w / 2, p.w / 2), y: p.y, vx: rand(-20, 20), vy: rand(80, 200), life: 0, max: rand(0.5, 1), size: rand(1.5, 3), color: "#ffd36b", kind: "spark", rot: 0, vr: 0 });
      }
    }

    // cleanup below the camera
    const floor = camY - 400;
    if (state !== "menu") {
      plats = plats.filter((p) => p.y > floor && !(p.dead && p.type === "r"));
      coins = coins.filter((c) => c.y > floor && !c.got);
      fuds = fuds.filter((f) => f.y > floor && f.hit < 1);
    }

    if (shakeT > 0) shakeT -= dt; else shakeMag = 0;
    flashA = Math.max(0, flashA - dt * 2.2);
    if (!muted) music.volume = clamp(music.volume + (musicTarget - music.volume) * Math.min(1, dt * 2.5), 0, 1);
  };

  /* ---------- draw ---------- */
  const skyAt = (alt) => {
    let i = 0;
    while (i < SKY.length - 1 && alt >= SKY[i + 1][0]) i++;
    const a = SKY[i], b = SKY[Math.min(i + 1, SKY.length - 1)];
    const k = a === b ? 0 : clamp((alt - a[0]) / (b[0] - a[0]), 0, 1);
    return [mix(a[1], b[1], k), mix(a[2], b[2], k)];
  };

  const roundRect = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  const setFont = (weight, px, family = "Archivo", stretch = "condensed") => {
    ctx.font = `${weight} ${px}px ${family}, "Arial Narrow", sans-serif`;
    if ("fontStretch" in ctx) ctx.fontStretch = stretch;
  };

  const drawBackground = () => {
    const alt = camY + viewH * 0.5;
    const [top, bot] = skyAt(alt);
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);

    // stars, more of them the higher you go
    const starA = clamp(0.45 + alt / 9000, 0.45, 1);
    const tileH = vh * 1.6;
    const off = camY * s * 0.12;
    for (const st of STARS) {
      const y = (st.y * tileH + off) % tileH;
      if (y > vh) continue;
      const tw = 0.6 + 0.4 * Math.sin(t * 2 + st.tw);
      ctx.globalAlpha = starA * tw * (st.r > 1.2 ? 1 : 0.75);
      ctx.fillStyle = st.warm ? "#ffd99a" : "#cfe2ff";
      ctx.beginPath();
      ctx.arc(st.x * vw, y, st.r * Math.max(1, s * 0.8), 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // the logo sky: clouds fall away as you climb
    const skyImg = skyMasked();
    if (skyImg) {
      const fade = 1 - clamp((camY - 600) / 2600, 0, 1);
      if (fade > 0) {
        const S = Math.max(vw, vh * 1.15);
        const y0 = vh * 0.66 - 0.535 * S + camY * s * 0.42;
        if (y0 < vh) {
          ctx.globalAlpha = fade;
          ctx.drawImage(skyImg, (vw - S) / 2, y0, S, S);
          ctx.globalAlpha = 1;
        }
      }
    }

    // the moon, if you get that far
    const moonY = 21500;
    const my = vh - (moonY - camY * 0.55 - (moonY * 0.45)) * s;
    if (my > -400 && my < vh + 400 && camY > 12000) {
      const r = 150 * s;
      const mx = vw * 0.72;
      const mg = ctx.createRadialGradient(mx - r * 0.3, my - r * 0.3, r * 0.1, mx, my, r);
      mg.addColorStop(0, "#fff7e8");
      mg.addColorStop(1, "#c9c1b2");
      ctx.fillStyle = "rgba(255,240,210,.08)";
      ctx.beginPath(); ctx.arc(mx, my, r * 1.5, 0, 6.283); ctx.fill();
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(mx, my, r, 0, 6.283); ctx.fill();
      ctx.fillStyle = "rgba(120,110,100,.25)";
      for (const [cx, cy, cr] of [[-0.3, -0.1, 0.18], [0.25, 0.2, 0.12], [0.05, -0.4, 0.09], [0.4, -0.25, 0.07], [-0.15, 0.4, 0.1]]) {
        ctx.beginPath(); ctx.arc(mx + cx * r, my + cy * r, cr * r, 0, 6.283); ctx.fill();
      }
    }

    // giant parallax words
    setFont(900, Math.round(Math.min(vw * 0.2, 220)), "Archivo", "ultra-condensed");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const pcam = camY * 0.45;
    const span = 1500;
    const first = Math.floor((pcam - 400) / span);
    for (let i = first; i < first + 4; i++) {
      if (i < 1) continue;
      const wy = i * span;
      const y = vh - (wy - pcam) * s;
      if (y < -200 || y > vh + 200) continue;
      const word = BG_WORDS[i % BG_WORDS.length];
      ctx.save();
      ctx.translate(vw / 2 + (i % 2 ? -1 : 1) * vw * 0.06, y);
      ctx.rotate(i % 2 ? -0.05 : 0.04);
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = "#fff2df";
      ctx.fillText(word, 0, 0);
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = "#fff2df";
      ctx.lineWidth = 1.2;
      ctx.strokeText(word, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  const drawChartFrame = () => {
    // pane edges on wide screens
    if (colX > 6) {
      ctx.fillStyle = "rgba(4,8,20,.22)";
      ctx.fillRect(0, 0, colX, vh);
      ctx.fillRect(colX + colW, 0, vw - colX - colW, vh);
      ctx.strokeStyle = "rgba(255,242,223,.16)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(colX + 0.5, 0); ctx.lineTo(colX + 0.5, vh);
      ctx.moveTo(colX + colW - 0.5, 0); ctx.lineTo(colX + colW - 0.5, vh);
      ctx.stroke();
    }
    // price grid
    const step = 160;
    const fs = Math.max(10, Math.round(11 * Math.min(1.2, s)));
    ctx.font = `500 ${fs}px "IBM Plex Mono", monospace`;
    if ("fontStretch" in ctx) ctx.fontStretch = "normal";
    ctx.textBaseline = "middle";
    const wide = colX > 70;
    ctx.textAlign = wide ? "left" : "right";
    for (let gy = Math.floor(camY / step) * step; gy < camY + viewH + step; gy += step) {
      if (gy < 0) continue;
      const y = Math.round(sy(gy)) + 0.5;
      ctx.strokeStyle = "rgba(255,242,223,.08)";
      ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.moveTo(colX, y); ctx.lineTo(colX + colW, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,242,223,.38)";
      ctx.fillText(fmtMoney(MC0 * multAt(gy)), wide ? colX + colW + 10 : colX + colW - 6, y - (wide ? 0 : 9));
    }
  };

  const drawPriceLine = () => {
    const pts = plats.filter((p) => p.path && p.y > camY - 300 && p.y < camY + viewH + 300);
    if (pts.length < 2) return;
    ctx.save();
    if (state === "menu") ctx.globalAlpha = 0.35;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    // glow
    const red = state === "dead";
    ctx.strokeStyle = red ? "rgba(255,92,108,.14)" : "rgba(92,255,157,.12)";
    ctx.lineWidth = 12 * s;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
    ctx.stroke();
    ctx.strokeStyle = red ? "rgba(255,92,108,.55)" : "rgba(92,255,157,.5)";
    ctx.lineWidth = Math.max(1.5, 2.2 * s);
    ctx.stroke();
    ctx.restore();
  };

  const PAL = {
    g: { a: "#7dffb4", b: "#16b862", wick: "#5cff9d", glow: "rgba(92,255,157," },
    m: { a: "#9dffe0", b: "#14a39a", wick: "#6fffe0", glow: "rgba(110,255,224," },
    r: { a: "#ff7a87", b: "#b3162b", wick: "#ff8a95", glow: "rgba(255,92,108," },
    y: { a: "#fff2b0", b: "#ffae1f", wick: "#ffd36b", glow: "rgba(255,211,107," }
  };
  const drawCandle = (p) => {
    // when you get rugged the whole chart dumps, bottom to top
    const dumped = state === "dead" && deathT * 1.7 > (p.y - camY) / viewH;
    const pal = dumped ? PAL.r : PAL[p.type];
    const dip = p.hit > 0 ? Math.sin(p.hit * Math.PI) * 7 * s : 0;
    const w = p.w * s, h = p.h * s;
    const draws = [p.x];
    for (const px of draws) {
      const x = sx(px), y = sy(p.y) + dip;
      if (y > vh + 120 || y + h < -120) continue;
      // wick
      ctx.strokeStyle = pal.wick;
      const am = state === "menu" && p !== plats[0] ? 0.3 : 1;
      ctx.globalAlpha = 0.85 * am;
      ctx.lineWidth = Math.max(1, 2 * s);
      ctx.beginPath();
      ctx.moveTo(x, y - p.wt * s);
      ctx.lineTo(x, y + h + p.wb * s);
      ctx.stroke();
      ctx.globalAlpha = am;
      // glow
      const pulse = p.type === "y" ? 0.35 + 0.2 * Math.sin(t * 6) : 0.16;
      ctx.fillStyle = pal.glow + (pulse + p.hit * 0.35) + ")";
      roundRect(x - w / 2 - 6 * s, y - 6 * s, w + 12 * s, h + 12 * s, 9 * s);
      ctx.fill();
      if (p.type === "y") {
        ctx.fillStyle = pal.glow + (0.12 + 0.08 * Math.sin(t * 6)) + ")";
        roundRect(x - w / 2 - 16 * s, y - 16 * s, w + 32 * s, h + 32 * s, 18 * s);
        ctx.fill();
      }
      // body
      const gr = ctx.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, pal.a);
      gr.addColorStop(1, pal.b);
      ctx.fillStyle = gr;
      roundRect(x - w / 2, y, w, h, 4 * s);
      ctx.fill();
      // top highlight
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.fillRect(x - w / 2 + 4 * s, y + 2.5 * s, w - 8 * s, 2 * s);
      // moving candles: motion streaks
      if (p.type === "m") {
        const dir = Math.cos(t * p.sp + p.ph) >= 0 ? -1 : 1;
        ctx.strokeStyle = "rgba(157,255,224,.45)";
        ctx.lineWidth = Math.max(1, 1.5 * s);
        for (let i = 0; i < 3; i++) {
          const ly = y + h * (0.25 + i * 0.25);
          const lx = x + dir * (w / 2 + 6 * s);
          ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + dir * (10 + i * 5) * s, ly); ctx.stroke();
        }
      }
      if (p.type === "y") {
        setFont(800, Math.round(11 * s + 2), "IBM Plex Mono", "normal");
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(10,26,79,.7)";
        ctx.fillText("GOD", x, y + h * 0.55);
      }
    }
  };

  const drawCoin = (c) => {
    const x = sx(c.x), y = sy(c.y);
    if (y < -40 || y > vh + 40) return;
    const r = 13 * s;
    const k = Math.max(0.14, Math.abs(Math.cos(t * 3 + c.ph)));
    const bob = Math.sin(t * 2.4 + c.ph) * 4 * s;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.fillStyle = "rgba(255,211,107,.18)";
    ctx.beginPath(); ctx.arc(0, 0, r * 1.9, 0, 6.283); ctx.fill();
    ctx.scale(k, 1);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, "#fff6cf");
    g.addColorStop(0.45, "#ffd36b");
    g.addColorStop(1, "#c4821a");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = "rgba(140,80,10,.6)";
    ctx.lineWidth = Math.max(1, 1.6 * s);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, 6.283); ctx.stroke();
    if (k > 0.45) {
      setFont(900, Math.round(r * 1.05), "Archivo", "condensed");
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#7a4a08";
      ctx.fillText("U", 0, r * 0.06);
    }
    ctx.restore();
  };

  const FUD_PUFFS = [[-36, 6, 24], [-12, -10, 30], [16, -6, 27], [40, 6, 21], [2, 12, 28]];
  const drawFud = (f) => {
    const x = sx(f.x), y = sy(f.y);
    if (y < -100 || y > vh + 100) return;
    const a = f.hit ? clamp(1 - f.hit, 0, 1) : 1;
    const grow = f.hit ? 1 + f.hit * 0.6 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y + Math.sin(t * 1.8 + f.ph) * 5 * s);
    ctx.scale(grow * s, grow * s);
    ctx.fillStyle = "rgba(255,92,108,.14)";
    ctx.beginPath(); ctx.ellipse(0, 2, 78, 44, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = "#231a3f";
    for (const [px, py, pr] of FUD_PUFFS) { ctx.beginPath(); ctx.arc(px, py, pr, 0, 6.283); ctx.fill(); }
    ctx.fillStyle = "#33285a";
    for (const [px, py, pr] of FUD_PUFFS) { ctx.beginPath(); ctx.arc(px - 3, py - 5, pr * 0.7, 0, 6.283); ctx.fill(); }
    if (Math.sin(t * 9 + f.ph * 3) > 0.93) {
      ctx.strokeStyle = "#ffd36b";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-6, 26); ctx.lineTo(4, 40); ctx.lineTo(-4, 42); ctx.lineTo(8, 60);
      ctx.stroke();
    }
    ctx.font = '700 17px "IBM Plex Mono", monospace';
    if ("fontStretch" in ctx) ctx.fontStretch = "normal";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ff5c6c";
    ctx.fillText("FUD", 0, 3);
    ctx.restore();
  };

  // Both photos are drawn so the cat covers the same area on screen,
  // anchored on the body's centroid, so swapping poses doesn't pop.
  const SPR = { up: { w: 140, cx: 0.545, cy: 0.47 }, down: { w: 86, cx: 0.456, cy: 0.531 } };
  const CH = 50; // body centre sits this far above the feet
  const drawSprite = (img, cfg, alpha) => {
    if (!ready(img) || alpha <= 0.01) return;
    const w = cfg.w * s, h = (w * img.naturalHeight) / img.naturalWidth;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, -cfg.cx * w, -cfg.cy * h, w, h);
  };
  const poseNow = () => (boostT > 0 ? 1 : state === "dead" ? 0 : cat.vy > -60 ? 1 : 0);
  const drawCatAt = (x, y, o) => {
    {
      const ox = x;
      ctx.save();
      ctx.translate(sx(ox), sy(y));
      ctx.rotate(o.rot);
      ctx.scale(o.sqx, o.sqy);          // squash/stretch pivots on the feet
      ctx.translate(0, -CH * s);
      ctx.rotate(o.spin);               // flips pivot on the body
      ctx.scale(o.face, 1);
      if (o.k) drawSprite(IMG.up, SPR.up, o.alpha);
      else drawSprite(IMG.down, SPR.down, o.alpha);
      ctx.restore();
    }
  };

  const drawShadow = () => {
    if (state === "dead") return;
    let below = null;
    for (const p of state === "menu" ? [plats[0]] : plats) {
      if (p.dead || p.y > cat.y + 1) continue;
      let dx = Math.abs(cat.x - p.x);
      if (dx > p.w / 2 + 8) continue;
      if (!below || p.y > below.y) below = p;
    }
    if (!below) return;
    const dist = cat.y - below.y;
    if (dist > 340) return;
    const k = 1 - dist / 340;
    const dip = below.hit > 0 ? Math.sin(below.hit * Math.PI) * 7 * s : 0;
    ctx.fillStyle = `rgba(4,12,30,${0.42 * k})`;
    ctx.beginPath();
    ctx.ellipse(sx(clamp(cat.x, below.x - below.w / 2 + 6, below.x + below.w / 2 - 6)), sy(below.y) + dip + 1.5 * s, (16 + 18 * k) * s, (3 + 2.5 * k) * s, 0, 0, 6.283);
    ctx.fill();
  };

  const drawCat = () => {
    const q = cat.sq;
    let sqx = 1 + 0.22 * q, sqy = 1 - 0.25 * q;
    const v = cat.vy;
    if (v > 450) { const e = Math.min(1, (v - 450) / 700); sqx *= 1 - 0.07 * e; sqy *= 1 + 0.09 * e; }
    if (v < -650) { const e = Math.min(1, (-v - 650) / 700); sqx *= 1 - 0.04 * e; sqy *= 1 + 0.05 * e; }
    const wob = state === "dead" ? 0 : Math.sin(t * 7.5) * (v > 0 ? 0.04 : 0.02);
    const k = poseNow();
    if (k !== cat.pose) { cat.pose = k; cat.swap = 1; }
    if (cat.swap > 0) { sqx *= 1 - 0.08 * cat.swap; sqy *= 1 + 0.06 * cat.swap; }
    drawShadow();
    for (let i = cat.trail.length - 1; i >= 0; i--) {
      const tr = cat.trail[i];
      drawCatAt(tr.x, tr.y - i * 7, { rot: tr.rot, spin: tr.spin, face: tr.face, alpha: 0.2 * (1 - i / cat.trail.length), sqx: 1, sqy: 1, k: 1 });
    }
    if (boostT > 0) {
      const g = ctx.createRadialGradient(sx(cat.x), sy(cat.y + CH), 0, sx(cat.x), sy(cat.y + CH), 90 * s);
      g.addColorStop(0, "rgba(255,211,107,.45)");
      g.addColorStop(1, "rgba(255,211,107,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx(cat.x), sy(cat.y + CH), 90 * s, 0, 6.283); ctx.fill();
    }
    drawCatAt(cat.x, cat.y, { rot: cat.rot + wob, spin: cat.spin, face: cat.face, alpha: 1, sqx, sqy, k });
    ctx.globalAlpha = 1;
    // dizzy stars when rugged
    if (state === "dead") {
      const cx = sx(cat.x), cy = sy(cat.y + CH + 40);
      setFont(900, Math.round(20 * s), "Archivo", "normal");
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < 4; i++) {
        const a = t * 5 + (i * Math.PI) / 2;
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(a);
        ctx.fillStyle = i % 2 ? "#ffd36b" : "#fff2df";
        ctx.fillText("✦", cx + Math.cos(a) * 44 * s, cy + Math.sin(a) * 12 * s);
      }
      ctx.globalAlpha = 1;
    }
  };

  const drawParticles = () => {
    ctx.save();
    for (const p of parts) {
      const a = 1 - p.life / p.max;
      const x = sx(p.x), y = sy(p.y);
      if (p.kind === "ring") {
        const u = p.life / p.max;
        ctx.globalAlpha = (1 - u) * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, 2.5 * s * (1 - u));
        ctx.beginPath();
        ctx.ellipse(x, y, (p.size * 0.35 + u * p.size * 0.6) * s, (4 + u * 10) * s, 0, 0, 6.283);
        ctx.stroke();
      } else if (p.kind === "debris") {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot);
        ctx.fillRect((-p.size / 2) * s, (-p.size / 2) * s, p.size * s, p.size * 1.4 * s);
        ctx.restore();
      } else {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(x, y, p.size * s * (0.6 + a * 0.6), 0, 6.283); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
    }
    ctx.restore();
  };

  const drawTexts = () => {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const x of texts) {
      const u = x.life / x.max;
      const pop = u < 0.14 ? 0.4 + (u / 0.14) * 0.75 : u < 0.22 ? 1.15 - ((u - 0.14) / 0.08) * 0.15 : 1;
      const a = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
      const px = Math.round(x.size * s);
      setFont(900, px, "Archivo", "condensed");
      const half = ctx.measureText(x.text).width / 2 + px * 0.2;
      const tx = clamp(sx(x.x), half + 8, vw - half - 8);
      ctx.save();
      ctx.translate(tx, sy(x.y));
      ctx.rotate(x.rot);
      ctx.scale(pop, pop);
      ctx.globalAlpha = a;
      setFont(900, px, "Archivo", "condensed");
      ctx.lineWidth = Math.max(3, px * 0.16);
      ctx.strokeStyle = "#0a1a4f";
      ctx.strokeText(x.text, 0, 0);
      ctx.fillStyle = x.color;
      ctx.fillText(x.text, 0, 0);
      ctx.restore();
    }
  };

  const drawOverlay = () => {
    // speed lines on god candles
    if (cat.vy > 1250 && !reduce) {
      ctx.strokeStyle = "rgba(255,242,223,.22)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 16; i++) {
        const x = Math.random() * vw, y = Math.random() * vh, l = rand(60, 180);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + l); ctx.stroke();
      }
    }
    // danger glow when close to falling off
    if (state === "play" && cat.vy < 0) {
      const d = clamp(1 - (cat.y - camY) / 260, 0, 1);
      if (d > 0) {
        const g = ctx.createLinearGradient(0, vh, 0, vh * 0.7);
        g.addColorStop(0, `rgba(255,92,108,${0.4 * d})`);
        g.addColorStop(1, "rgba(255,92,108,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, vh * 0.7, vw, vh * 0.3);
      }
    }
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, vw, vh);
    if (flashA > 0.01) {
      ctx.globalAlpha = flashA;
      ctx.fillStyle = flashC;
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalAlpha = 1;
    }
  };

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground();
    drawProps();
    ctx.save();
    if (shakeT > 0) ctx.translate(rand(-1, 1) * shakeMag * (shakeT / 0.5), rand(-1, 1) * shakeMag * (shakeT / 0.5));
    drawChartFrame();
    drawPriceLine();
    for (const f of fuds) drawFud(f);
    for (const p of plats) drawCandle(p);
    ctx.globalAlpha = state === "menu" ? 0.3 : 1;
    for (const c of coins) if (!c.got) drawCoin(c);
    ctx.globalAlpha = 1;
    drawParticles();
    drawCat();
    drawTexts();
    ctx.restore();
    drawOverlay();
    drawMini();
  };

  /* ---------- loop ---------- */
  let last = performance.now();
  const frame = (now) => {
    let dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    if (slowT > 0) { slowT -= dt; dt *= 0.35; }
    if (!paused) {
      update(dt);
      draw();
    }
    requestAnimationFrame(frame);
  };

  resize();
  reset();
  setState("menu");
  requestAnimationFrame(frame);
})();
