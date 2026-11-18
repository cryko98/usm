/* =========================================================
   $USM — config. Fill these in when they're ready.
   ========================================================= */
const USM = {
  X_URL: "",   // e.g. "https://x.com/upsomuch"
  CA: ""       // Solana contract address
};

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- toast ---------- */
  const toastEl = $("#toast");
  let toastT;
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("on"), 2200);
  };

  /* ---------- CA + X ---------- */
  $$(".js-ca-text").forEach((el) => (el.textContent = USM.CA || "coming soon"));
  $$(".js-ca").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!USM.CA) return toast("CA not live yet. It drops on X first.");
      try {
        await navigator.clipboard.writeText(USM.CA);
        toast("CA copied. usm.");
      } catch {
        toast(USM.CA);
      }
    })
  );
  $$(".js-x").forEach((a) => {
    if (USM.X_URL) a.href = USM.X_URL;
    else
      a.addEventListener("click", (e) => {
        e.preventDefault();
        toast("X account landing soon.");
      });
  });

  /* ---------- flying words ---------- */
  const fly = (x, y, text = "USM") => {
    const s = document.createElement("span");
    s.className = "fly";
    s.textContent = text;
    s.style.left = x + "px";
    s.style.top = y + "px";
    s.style.setProperty("--dx", (Math.random() * 160 - 80).toFixed(0) + "px");
    s.style.setProperty("--rot", (Math.random() * 30 - 15).toFixed(0) + "deg");
    s.style.fontSize = 28 + Math.random() * 30 + "px";
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1500);
  };

  /* ---------- hero: parallax + cat ---------- */
  const hero = $(".hero");
  const bg = $(".stage-bg");
  const fg = $(".stage-fg");
  const word = $("#heroWord");
  const cat = $("#heroCat");

  if (!reduce && matchMedia("(pointer: fine)").matches) {
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      cat.style.setProperty("--mx", (nx * 36).toFixed(1) + "px");
      cat.style.setProperty("--my", (ny * 24).toFixed(1) + "px");
      word.style.translate = `${(-nx * 14).toFixed(1)}px 0`;
    });
    hero.addEventListener("pointerleave", () => {
      cat.style.setProperty("--mx", "0px");
      cat.style.setProperty("--my", "0px");
      word.style.translate = "0 0";
    });
  }

  cat.addEventListener("click", (e) => {
    cat.classList.remove("jump");
    void cat.offsetWidth;
    cat.classList.add("jump");
    const r = cat.getBoundingClientRect();
    fly(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 3);
  });
  cat.addEventListener("animationend", () => cat.classList.remove("jump"));

  /* ---------- altimeter ---------- */
  const altV = $("#altV");
  const altL = $("#altL");
  const altTicks = $("#altTicks");
  const altBox = $(".alt");
  const stops = [
    { el: hero, ft: 35000, name: "cruising" },
    { el: $("#word"), ft: 36000, name: "in the clouds" },
    { el: $("#lexicon"), ft: 164000, name: "stratosphere" },
    { el: $("#say"), ft: 262000, name: "mesosphere" },
    { el: $("#pilot"), ft: 328000, name: "kármán line" },
    { el: $("#board"), ft: 1312000, name: "low orbit" },
    { el: $(".space"), ft: 4200000, name: "beyond the chart" }
  ];
  let bonus = 0;
  const fmt = (n) => Math.round(n).toLocaleString("en-US");

  const altitude = () => {
    const y = scrollY + innerHeight * 0.5;
    const maxY = document.documentElement.scrollHeight - innerHeight;
    if (scrollY >= maxY - 4) return { ft: null, name: "up so much" };
    let i = 0;
    while (i < stops.length - 1 && stops[i + 1].el.offsetTop <= y) i++;
    const a = stops[i];
    const b = stops[i + 1];
    if (!b) return { ft: a.ft, name: a.name };
    const t = Math.min(1, Math.max(0, (y - a.el.offsetTop) / (b.el.offsetTop - a.el.offsetTop)));
    const e = t * t * (3 - 2 * t);
    return { ft: a.ft + (b.ft - a.ft) * e, name: a.name };
  };

  /* ---------- nav ---------- */
  const nav = $(".nav");

  /* ---------- scroll loop ---------- */
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = scrollY;
    nav.classList.toggle("scrolled", y > 40);

    if (!reduce && y < innerHeight * 1.3) {
      bg.style.setProperty("--py", (y * 0.35).toFixed(1) + "px");
      fg.style.setProperty("--cy", (-y * 0.25).toFixed(1) + "px");
      word.style.setProperty("--wy", (y * 0.18).toFixed(1) + "px");
    }

    const { ft, name } = altitude();
    altV.textContent = ft === null ? "USM" : fmt(ft + bonus);
    altBox.classList.toggle("top", ft === null);
    altL.textContent = name;
    altTicks.style.transform = `translateY(${((y * 0.6) % 60).toFixed(1)}px)`;
  };
  addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  }, { passive: true });
  addEventListener("resize", onScroll);

  /* ---------- stars ---------- */
  const drawStars = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    $$("canvas.stars").forEach((c) => {
      const w = c.offsetWidth;
      const h = c.offsetHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      const ctx = c.getContext("2d");
      ctx.scale(dpr, dpr);
      const density = parseFloat(c.dataset.density || "1");
      const n = Math.round((w * h) / 9000 * density);
      let seed = w * 7 + h;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < n; i++) {
        const x = rnd() * w;
        const yy = rnd() * h;
        const r = rnd() < 0.92 ? rnd() * 0.9 + 0.3 : rnd() * 1.4 + 1;
        const warm = rnd() < 0.55;
        ctx.globalAlpha = 0.35 + rnd() * 0.65;
        ctx.fillStyle = warm ? "#ffd99a" : "#cfe2ff";
        ctx.beginPath();
        ctx.arc(x, yy, r, 0, Math.PI * 2);
        ctx.fill();
        if (r > 1.6) {
          ctx.globalAlpha = 0.12;
          ctx.beginPath();
          ctx.arc(x, yy, r * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  };
  let starT;
  addEventListener("resize", () => {
    clearTimeout(starT);
    starT = setTimeout(drawStars, 200);
  });

  /* ---------- reveals ---------- */
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      }),
    { threshold: 0.18, rootMargin: "0px 0px -6% 0px" }
  );
  $$(".reveal").forEach((el) => io.observe(el));

  /* ---------- split-flap board ---------- */
  const CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-:$";
  const widths = [5, 4, 10, 9];
  const flapRows = $$(".flap-row[data-row]");
  flapRows.forEach((row) => {
    const parts = row.dataset.row.split("|");
    row.setAttribute("aria-label", parts.join(" · "));
    parts.forEach((txt, ci) => {
      const col = document.createElement("div");
      col.className = `cells col-${ci}`;
      col.setAttribute("role", "cell");
      const target = txt.padEnd(widths[ci], " ").slice(0, widths[ci]);
      [...target].forEach((ch) => {
        const c = document.createElement("span");
        c.className = "cell";
        c.dataset.t = ch;
        c.textContent = " ";
        col.appendChild(c);
      });
      row.appendChild(col);
    });
  });

  const runFlap = () => {
    flapRows.forEach((row, ri) => {
      $$(".cell", row).forEach((c, i) => {
        const target = c.dataset.t;
        if (reduce) return (c.textContent = target);
        let steps = 6 + Math.floor(Math.random() * 10) + ri * 4 + (i % 7);
        const start = ri * 260;
        setTimeout(function step() {
          if (steps-- <= 0) {
            c.textContent = target;
            return;
          }
          c.textContent = CHARS[Math.floor(Math.random() * CHARS.length)];
          c.classList.remove("tick");
          void c.offsetWidth;
          c.classList.add("tick");
          setTimeout(step, 55 + Math.random() * 40);
        }, start);
      });
    });
    setTimeout(() => $(".flap-row.is-usm").classList.add("lit"), flapRows.length * 260 + 2400);
  };
  const flapIO = new IntersectionObserver((en) => {
    if (en[0].isIntersecting) {
      runFlap();
      flapIO.disconnect();
    }
  }, { threshold: 0.4 });
  flapIO.observe($("#flap"));

  /* ---------- say it ---------- */
  const sayBtn = $("#sayBtn");
  const sayCount = $("#sayCount");
  let count = 0;
  try { count = parseInt(localStorage.getItem("usm_said") || "0", 10) || 0; } catch {}
  bonus = count * 1000;
  sayCount.textContent = fmt(count);

  sayBtn.addEventListener("click", (e) => {
    count++;
    bonus = count * 1000;
    sayCount.textContent = fmt(count);
    try { localStorage.setItem("usm_said", String(count)); } catch {}
    const r = sayBtn.getBoundingClientRect();
    const words = ["USM", "usm", "USM", "up so much", "USM", "usm."];
    fly(r.left + r.width / 2, r.top + r.height / 2, words[count % words.length]);
    altBox.classList.remove("bump");
    void altBox.offsetWidth;
    altBox.classList.add("bump");
    onScroll();
  });

  /* ---------- init ---------- */
  drawStars();
  onScroll();
  addEventListener("load", () => { drawStars(); onScroll(); });
})();
