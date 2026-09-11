import { VisionCore, HAND_CONNECTIONS } from "./vision.js";
import { GestureEngine, gestureLabel } from "./gesture-engine.js";
import { AirDrawExperience } from "./experiences/air-draw.js";
import { EmojiPlaygroundExperience } from "./experiences/emoji-playground.js";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const hubView = $("#hubView");
const experienceView = $("#experienceView");
const experienceName = $("#experienceName");
const experienceDesc = $("#experienceDesc");
const backBtn = $("#backBtn");
const cameraBtn = $("#cameraBtn");
const switchBtn = $("#switchBtn");
const skeletonToggle = $("#skeletonToggle");
const debugToggle = $("#debugToggle");
const statusEl = $("#status");
const fpsEl = $("#fps");
const gestureEl = $("#gesture");
const handsEl = $("#hands");
const modeEl = $("#mode");
const hitBox = $("#hitBox");
const hitsEl = $("#hits");
const hint = $("#hint");
const moduleActions = $("#moduleActions");
const helpGrid = $("#helpGrid");
const debugPanel = $("#debugPanel");
const debugRaw = $("#debugRaw");
const debugCandidate = $("#debugCandidate");
const debugActive = $("#debugActive");
const debugSpeed = $("#debugSpeed");
const dwellBar = $("#dwellBar");
const toast = $("#toast");

const video = $("#cam");
const overlay = $("#overlay");
const paint = $("#paint");
const oc = overlay.getContext("2d");

const mobile = matchMedia("(pointer:coarse)").matches;
const vision = new VisionCore({
  video,
  maxHands: mobile ? 1 : 2,
  onStatus: setStatus,
});
const gestureEngine = new GestureEngine({ dwellMs: 90, releaseGraceMs: 160, smoothingAlpha: .38 });
const airDraw = new AirDrawExperience({ paintCanvas: paint });
const emojiPlayground = new EmojiPlaygroundExperience();

let running = false;
let currentExperience = null;
let lastFrameTime = performance.now();
let lastHandSample = null;
let lastLandmarks = [];
let hand = emptyHand();
let frames = 0;
let fpsWindow = performance.now();
let raf = null;

const experienceMeta = {
  draw: {
    title: "Air Draw",
    desc: "Desenhe no ar com o dedo indicador usando rastreamento em tempo real.",
    help: [
      ["☝️ Indicador", "Levante só o indicador para desenhar."],
      ["✋ Parar", "Abra a mão ou mude o gesto para interromper o traço."],
      ["🧠 Gesture Engine", "O gesto precisa permanecer estável antes de ser confirmado."],
      ["🧽 Limpar", "Use o botão para apagar o canvas sem desligar a câmera."],
    ],
  },
  emoji: {
    title: "Emoji Playground",
    desc: "Pegue, arremesse e acerte emojis usando gestos e velocidade da mão.",
    help: [
      ["🤏 Pinça", "Faça pinça sobre um emoji para agarrar."],
      ["💨 Arremesso", "Mova rápido e solte a pinça para lançar."],
      ["🥊 Pancada", "Movimentos rápidos perto do emoji causam impacto."],
      ["✌️ Paz", "Dispara partículas quando o gesto é confirmado."],
    ],
  },
};

function emptyHand() {
  return { gesture: "none", raw: "none", candidate: "none", point: null, pinch: null, palm: null, vx: 0, vy: 0, speed: 0, progress: 0 };
}

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = `pill ${type}`.trim();
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.remove("show"), 1400);
}

function openExperience(name) {
  const meta = experienceMeta[name];
  if (!meta) return;
  currentExperience = name;
  hubView.classList.remove("active");
  experienceView.classList.add("active");
  experienceName.textContent = meta.title;
  experienceDesc.textContent = meta.desc;
  modeEl.textContent = meta.title;
  paint.style.opacity = name === "draw" ? "1" : ".18";
  hitBox.style.display = name === "emoji" ? "block" : "none";
  airDraw.resetStroke();
  moduleActions.innerHTML = "";
  helpGrid.innerHTML = meta.help.map(([a,b]) => `<div class="helpCard"><b>${a}</b><span>${b}</span></div>`).join("");

  if (name === "draw") {
    addAction("Limpar desenho", () => airDraw.clear());
  }
  if (name === "emoji") {
    addAction("+ Emoji", () => emojiPlayground.spawn(overlay.width, overlay.height), true);
    addAction("Reset emojis", () => {
      emojiPlayground.reset(overlay.width, overlay.height);
      hitsEl.textContent = "0";
    });
    if (!emojiPlayground.emojis.length && overlay.width) emojiPlayground.reset(overlay.width, overlay.height);
  }
}

function closeExperience() {
  currentExperience = null;
  experienceView.classList.remove("active");
  hubView.classList.add("active");
  airDraw.resetStroke();
}

function addAction(label, handler, accent = false) {
  const btn = document.createElement("button");
  btn.className = `actionBtn${accent ? " accent" : ""}`;
  btn.textContent = label;
  btn.onclick = handler;
  moduleActions.appendChild(btn);
}

function resize() {
  const w = video.videoWidth || 960;
  const h = video.videoHeight || 540;
  const changed = overlay.width !== w || overlay.height !== h;
  if (changed) {
    overlay.width = w;
    overlay.height = h;
    emojiPlayground.reset(w, h);
  }
  airDraw.resize(w, h);
}

async function toggleCamera() {
  if (running) {
    vision.stop();
    running = false;
    cancelAnimationFrame(raf);
    cameraBtn.textContent = "Ligar câmera";
    hint.classList.remove("hidden");
    hint.innerHTML = "<strong>Gesture Cam Hub 👋</strong><span>Ligue a câmera para iniciar o módulo.</span>";
    oc.clearRect(0, 0, overlay.width, overlay.height);
    gestureEngine.reset();
    hand = emptyHand();
    return;
  }
  try {
    await vision.start();
    resize();
    running = true;
    cameraBtn.textContent = "Desligar câmera";
    hint.classList.add("hidden");
    lastFrameTime = performance.now();
    loop();
  } catch (error) {
    console.error(error);
    setStatus("Câmera bloqueada", "err");
    hint.classList.remove("hidden");
    hint.innerHTML = "<strong>Não consegui abrir a câmera 😭</strong><span>Libere a permissão no navegador e tente novamente.</span>";
  }
}

function point(lm, i) {
  return { x: lm[i].x * overlay.width, y: lm[i].y * overlay.height };
}

function avg(...pts) {
  return { x: pts.reduce((s,p) => s + p.x, 0) / pts.length, y: pts.reduce((s,p) => s + p.y, 0) / pts.length };
}

function updateHand(landmarks, now) {
  if (!landmarks) {
    const snap = gestureEngine.update("none", now);
    hand = { ...emptyHand(), gesture: snap.active, raw: snap.raw, candidate: snap.candidate, progress: snap.progress };
    lastHandSample = null;
    return;
  }

  const raw = gestureEngine.classify(landmarks, overlay.width, overlay.height);
  const snap = gestureEngine.update(raw, now);
  const index = gestureEngine.smoothPoint(point(landmarks, 8));
  const thumb = point(landmarks, 4);
  const pinch = avg(index, thumb);
  const palm = avg(point(landmarks,0), point(landmarks,5), point(landmarks,9), point(landmarks,13), point(landmarks,17));
  let vx = 0, vy = 0, speed = 0;
  if (lastHandSample) {
    const dt = Math.max((now - lastHandSample.t) / 1000, .001);
    vx = (palm.x - lastHandSample.x) / dt;
    vy = (palm.y - lastHandSample.y) / dt;
    speed = Math.hypot(vx, vy);
  }
  lastHandSample = { x: palm.x, y: palm.y, t: now };
  hand = { gesture: snap.active, raw: snap.raw, candidate: snap.candidate, progress: snap.progress, point: index, pinch, palm, vx, vy, speed };
}

function drawSkeleton(landmarks) {
  if (!skeletonToggle.checked) return;
  oc.save();
  oc.strokeStyle = "rgba(255,255,255,.62)";
  oc.lineWidth = Math.max(2, overlay.width / 520);
  for (const [a,b] of HAND_CONNECTIONS) {
    const p1 = point(landmarks,a), p2 = point(landmarks,b);
    oc.beginPath();
    oc.moveTo(p1.x,p1.y);
    oc.lineTo(p2.x,p2.y);
    oc.stroke();
  }
  for (let i = 0; i < landmarks.length; i++) {
    const p = point(landmarks,i);
    oc.beginPath();
    oc.arc(p.x,p.y,i===8?Math.max(7,overlay.width/110):Math.max(3,overlay.width/270),0,Math.PI*2);
    oc.fillStyle = i===8 ? "#72ffd5" : "rgba(255,255,255,.9)";
    oc.fill();
  }
  oc.restore();
}

function render(now) {
  oc.clearRect(0,0,overlay.width,overlay.height);
  if (currentExperience === "emoji") emojiPlayground.render(oc, now);
  for (const lm of lastLandmarks) drawSkeleton(lm);
  if (hand.point) {
    oc.save();
    oc.beginPath();
    oc.arc(hand.point.x, hand.point.y, Math.max(10, overlay.width/95), 0, Math.PI*2);
    oc.fillStyle = hand.gesture === "point" ? "#72ffd5" : "#fff";
    oc.shadowBlur = 18;
    oc.shadowColor = oc.fillStyle;
    oc.fill();
    oc.restore();
  }
}

function updateDebug() {
  gestureEl.textContent = gestureLabel(hand.gesture);
  handsEl.textContent = String(lastLandmarks.length);
  debugRaw.textContent = gestureLabel(hand.raw);
  debugCandidate.textContent = gestureLabel(hand.candidate);
  debugActive.textContent = gestureLabel(hand.gesture);
  debugSpeed.textContent = `${Math.round(hand.speed)} px/s`;
  dwellBar.style.width = `${Math.round(hand.progress * 100)}%`;
  debugPanel.style.display = debugToggle.checked ? "block" : "none";
  if (currentExperience === "emoji") hitsEl.textContent = String(emojiPlayground.hits);
}

function tickFps() {
  frames++;
  const now = performance.now();
  const elapsed = now - fpsWindow;
  if (elapsed >= 1000) {
    fpsEl.textContent = `${Math.round(frames * 1000 / elapsed)} FPS`;
    frames = 0;
    fpsWindow = now;
  }
}

function loop(now = performance.now()) {
  if (!running) return;
  resize();
  const dt = Math.min((now - lastFrameTime) / 1000, .04);
  lastFrameTime = now;
  const result = vision.detect(now);
  if (result) {
    lastLandmarks = result.landmarks || [];
    updateHand(lastLandmarks[0], now);
    if (currentExperience === "draw") airDraw.update({ gesture: hand.gesture, point: hand.point });
    if (currentExperience === "emoji") emojiPlayground.update(hand, now, overlay.width);
    tickFps();
  }
  if (currentExperience === "emoji") emojiPlayground.physics(dt, overlay.width, overlay.height);
  render(now);
  updateDebug();
  raf = requestAnimationFrame(loop);
}

$$('[data-experience]').forEach(card => card.addEventListener("click", () => openExperience(card.dataset.experience)));
$$('[data-soon]').forEach(card => card.addEventListener("click", () => showToast(`${card.dataset.soon} entra nas próximas etapas 👀`)));
backBtn.onclick = closeExperience;
cameraBtn.onclick = toggleCamera;
switchBtn.onclick = async () => {
  try { await vision.switchCamera(); resize(); }
  catch (e) { console.error(e); showToast("Não consegui trocar a câmera"); }
};
debugToggle.onchange = updateDebug;

if (!navigator.mediaDevices?.getUserMedia) {
  setStatus("Sem suporte à câmera", "err");
} else {
  vision.init().then(() => cameraBtn.disabled = false).catch(error => {
    console.error(error);
    setStatus("Erro ao carregar IA", "err");
  });
}
