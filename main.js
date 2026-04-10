import { prepareWithSegments, walkLineRanges } from "@chenglou/pretext";

const RAMP = " .:-=+*#%@";
const BRIGHTNESS_BOOST = 1.6;
const COLS = 260;
const ROWS = 90;
const ASCII_FONT = "6px monospace";
const LINE_HEIGHT = 8;
const REPULSION_RADIUS = 120;
const REPULSION_FORCE = 6;
const MAX_VEL = 18;

/** @type {HTMLVideoElement | null} */
const video = document.querySelector("#source-video");
/** @type {HTMLCanvasElement | null} */
const canvas = document.querySelector("#ascii-canvas");
const intro = document.querySelector("#intro");
const enterBtn = document.querySelector("#enter-btn");
const stage = document.querySelector("#video-stage");
const landing = document.querySelector("#landing");
const landingContent = document.querySelector("#landing-content");
const overlayLogo = document.querySelector("#intro-logo");

if (
  !video ||
  !canvas ||
  !intro ||
  !enterBtn ||
  !stage ||
  !landing ||
  !landingContent ||
  !overlayLogo
) {
  throw new Error("Missing required DOM nodes");
}

let logoShown = false;

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("2D context unavailable");

const off = document.createElement("canvas");
off.width = COLS;
off.height = ROWS;
const offCtx = off.getContext("2d", { willReadFrequently: true });
if (!offCtx) throw new Error("Offscreen context unavailable");

const blankRow = " ".repeat(COLS);
const gridChars = Array.from({ length: ROWS }, () => blankRow).join("\n");
const preparedGrid = prepareWithSegments(gridChars, ASCII_FONT, {
  whiteSpace: "pre-wrap",
});
let pretextLineCount = 0;
walkLineRanges(preparedGrid, Number.POSITIVE_INFINITY, () => {
  pretextLineCount++;
});
if (pretextLineCount !== ROWS) {
  console.warn("pretext line count", pretextLineCount, "expected", ROWS);
}

const N = COLS * ROWS;
const particles = [];
for (let i = 0; i < N; i++) {
  particles.push({
    char: " ",
    homeX: 0,
    homeY: 0,
    currentX: 0,
    currentY: 0,
    velX: 0,
    velY: 0,
    r: 0,
    g: 0,
    b: 0,
  });
}

let mouseX = -1e6;
let mouseY = -1e6;
let playing = false;
let raf = 0;
let homesSnapped = false;

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function brightnessToChar(lum) {
  const charIndex = Math.floor(
    (lum / 255) * (RAMP.length - 1) * 1.4,
  );
  return RAMP[Math.min(charIndex, RAMP.length - 1)];
}

function layoutHomes() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const charWidth = vw / COLS;
  const blockH = ROWS * LINE_HEIGHT;
  const offsetY = (vh - blockH) / 2;

  for (let row = 0; row < ROWS; row++) {
    const base = row * COLS;
    for (let col = 0; col < COLS; col++) {
      const p = particles[base + col];
      p.homeX = col * charWidth;
      p.homeY = offsetY + row * LINE_HEIGHT;
    }
  }
}

function drawVideoToSample() {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) {
    offCtx.fillStyle = "#000";
    offCtx.fillRect(0, 0, COLS, ROWS);
    return;
  }
  offCtx.fillStyle = "#000";
  offCtx.fillRect(0, 0, COLS, ROWS);
  const scale = Math.max(COLS / vw, ROWS / vh);
  const sw = COLS / scale;
  const sh = ROWS / scale;
  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;
  offCtx.drawImage(video, sx, sy, sw, sh, 0, 0, COLS, ROWS);
}

function syncParticlesFromVideo() {
  drawVideoToSample();
  const { data } = offCtx.getImageData(0, 0, COLS, ROWS);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const i = (row * COLS + col) * 4;
      const rawR = data[i];
      const rawG = data[i + 1];
      const rawB = data[i + 2];
      const r = Math.min(255, Math.round(rawR * BRIGHTNESS_BOOST));
      const g = Math.min(255, Math.round(rawG * BRIGHTNESS_BOOST));
      const b = Math.min(255, Math.round(rawB * BRIGHTNESS_BOOST));
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const p = particles[row * COLS + col];
      p.char = brightnessToChar(lum);
      p.r = r;
      p.g = g;
      p.b = b;
    }
  }
  layoutHomes();
}

function stepPhysics() {
  for (let i = 0; i < N; i++) {
    const p = particles[i];
    const dx = p.currentX - mouseX;
    const dy = p.currentY - mouseY;
    const dist = Math.hypot(dx, dy);
    if (dist < REPULSION_RADIUS && dist > 0.001) {
      const force =
        (1 - dist / REPULSION_RADIUS) ** 1.5 * REPULSION_FORCE;
      const nx = dx / dist;
      const ny = dy / dist;
      p.velX += nx * force;
      p.velY += ny * force;
    }

    const hx = p.homeX - p.currentX;
    const hy = p.homeY - p.currentY;
    if (
      Math.abs(hx) < 0.5 &&
      Math.abs(hy) < 0.5 &&
      Math.abs(p.velX) < 0.1 &&
      Math.abs(p.velY) < 0.1
    ) {
      p.currentX = p.homeX;
      p.currentY = p.homeY;
      p.velX = 0;
      p.velY = 0;
    } else {
      p.velX += hx * 0.12;
      p.velY += hy * 0.12;
      p.velX *= 0.75;
      p.velY *= 0.75;
      const spd = Math.hypot(p.velX, p.velY);
      if (spd > MAX_VEL) {
        p.velX = (p.velX / spd) * MAX_VEL;
        p.velY = (p.velY / spd) * MAX_VEL;
      }
      p.currentX += p.velX;
      p.currentY += p.velY;
    }
  }
}

function draw() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.font = ASCII_FONT;
  ctx.textBaseline = "top";

  for (let i = 0; i < N; i++) {
    const p = particles[i];
    ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
    ctx.fillText(p.char, p.currentX, p.currentY);
  }
}

function tick() {
  if (!playing) return;
  raf = requestAnimationFrame(tick);

  if (video.readyState >= video.HAVE_CURRENT_DATA) {
    syncParticlesFromVideo();
    if (!homesSnapped) {
      for (let i = 0; i < N; i++) {
        const p = particles[i];
        p.currentX = p.homeX;
        p.currentY = p.homeY;
      }
      homesSnapped = true;
    }
    stepPhysics();
    draw();
  }
}

function startAsciiLoop() {
  playing = true;
  homesSnapped = false;
  for (let i = 0; i < N; i++) {
    const p = particles[i];
    p.velX = 0;
    p.velY = 0;
  }
  cancelAnimationFrame(raf);
  tick();
}

function stopAsciiLoop() {
  playing = false;
  cancelAnimationFrame(raf);
}

function mountLogoForVideo() {
  logoShown = false;
  document.body.appendChild(overlayLogo);
  overlayLogo.style.position = "fixed";
  overlayLogo.style.top = "50%";
  overlayLogo.style.left = "50%";
  overlayLogo.style.transform = "translate(-50%, -50%)";
  overlayLogo.style.width = "320px";
  overlayLogo.style.height = "auto";
  overlayLogo.style.opacity = "0";
  overlayLogo.style.zIndex = "20";
  overlayLogo.style.pointerEvents = "none";
  overlayLogo.style.transition = "";
}

video.addEventListener("timeupdate", () => {
  if (!logoShown && video.currentTime >= 21) {
    logoShown = true;
    overlayLogo.style.transition = "opacity 0.6s ease";
    overlayLogo.style.opacity = "1";
  }
});

window.addEventListener("resize", () => {
  resizeCanvas();
  if (playing) {
    layoutHomes();
    for (let i = 0; i < N; i++) {
      const p = particles[i];
      p.currentX = p.homeX;
      p.currentY = p.homeY;
    }
  }
});

window.addEventListener("pointermove", (e) => {
  if (!playing) return;
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});

window.addEventListener("pointerleave", () => {
  mouseX = -1e6;
  mouseY = -1e6;
});

enterBtn.addEventListener("click", () => {
  overlayLogo.style.transition = "opacity 0.4s ease";
  overlayLogo.style.opacity = "0";
  enterBtn.style.transition = "opacity 0.4s ease";
  enterBtn.style.opacity = "0";

  window.setTimeout(() => {
    intro.style.transition = "opacity 0.4s ease";
    intro.style.opacity = "0";
    window.setTimeout(() => {
      intro.style.display = "none";
      mountLogoForVideo();
      stage.classList.add("is-active");
      canvas.style.opacity = "1";
      resizeCanvas();
      video.muted = false;
      video.volume = 1;
      video.play().catch(() => {});
      startAsciiLoop();
    }, 400);
  }, 300);
});

video.addEventListener("ended", () => {
  stopAsciiLoop();
  if (!logoShown) {
    logoShown = true;
    overlayLogo.style.transition = "none";
    overlayLogo.style.opacity = "1";
    void overlayLogo.offsetHeight;
  }
  overlayLogo.style.transition = "all 0.9s cubic-bezier(0.4, 0, 0.2, 1)";
  overlayLogo.style.top = "28px";
  overlayLogo.style.left = "50%";
  overlayLogo.style.transform = "translate(-50%, 0)";
  overlayLogo.style.width = "200px";
  overlayLogo.style.zIndex = "35";

  window.setTimeout(() => {
    canvas.style.transition = "opacity 0.6s ease";
    canvas.style.opacity = "0";
    landing.classList.add("is-visible");
    landingContent.classList.add("is-revealed");
    stage.classList.remove("is-active");
    stage.classList.add("is-fading-out");
  }, 950);
});

resizeCanvas();
