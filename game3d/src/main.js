/* 『壁打ち』3D調査パート 体験版
   一人称探索 + 会話 + 証拠収集。three.js 使用、アセット完全プロシージャル。 */

import * as THREE from "three";

/* ================= DOM ================= */
const $ = (id) => document.getElementById(id);
const canvas = $("c");
const ui = {
  objective: $("objective"), toast: $("toast"), prompt: $("prompt"),
  dlg: $("dlg"), dlgname: $("dlgname"), dlgtext: $("dlgtext"),
  dlgcue: $("dlgcue"), dlgchoices: $("dlgchoices"),
  start: $("start"), fade: $("fade"), fadetext: $("fadetext"),
  ending: $("ending"), repbody: $("repbody"), repsay: $("repsay"),
  stick: $("stick"), nub: $("nub"), btnact: $("btnact"),
};

const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
if (isTouch) {
  document.body.classList.add("touch");
  $("ctlpc").style.display = "none";
  $("ctlmb").style.display = "block";
}

/* ================= 音 ================= */
let AC = null;
function audioInit() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const hum = AC.createOscillator(); hum.type = "sine"; hum.frequency.value = 52;
    const hg = AC.createGain(); hg.gain.value = 0.012;
    hum.connect(hg).connect(AC.destination); hum.start();
    const hum2 = AC.createOscillator(); hum2.type = "sine"; hum2.frequency.value = 103;
    const hg2 = AC.createGain(); hg2.gain.value = 0.005;
    hum2.connect(hg2).connect(AC.destination); hum2.start();
  } catch (e) { AC = null; }
}
function blip(freq = 880, dur = 0.05, vol = 0.05) {
  if (!AC) return;
  const o = AC.createOscillator(); o.type = "square"; o.frequency.value = freq;
  const g = AC.createGain();
  g.gain.setValueAtTime(vol, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
  o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime + dur);
}
function pok() { blip(140, 0.09, 0.09); }

/* ================= 3D 基盤 ================= */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05080f);
scene.fog = new THREE.FogExp2(0x05080f, 0.024);
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 300);
camera.rotation.order = "YXZ";

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize); resize();

scene.add(new THREE.HemisphereLight(0x33456a, 0x0a0d14, 1.5));
const moon = new THREE.DirectionalLight(0x8fb0d8, 0.75);
moon.position.set(-30, 50, -10); scene.add(moon);

/* ================= 素材 ================= */
const MAT = {
  asphalt: new THREE.MeshLambertMaterial({ color: 0x11161f }),
  ground: new THREE.MeshLambertMaterial({ color: 0x0b0f16 }),
  bldg: new THREE.MeshLambertMaterial({ color: 0x141b28 }),
  bldg2: new THREE.MeshLambertMaterial({ color: 0x101623 }),
  steel: new THREE.MeshLambertMaterial({ color: 0x2a2f38 }),
  rust: new THREE.MeshLambertMaterial({ color: 0x4a3226 }),
  cyan: new THREE.MeshBasicMaterial({ color: 0x5fd4e8 }),
  red: new THREE.MeshBasicMaterial({ color: 0xe05d5d }),
  sheet: new THREE.MeshLambertMaterial({ color: 0xb9c2cc }),
  ball: new THREE.MeshLambertMaterial({ color: 0x8a5a30 }),
  grass: new THREE.MeshLambertMaterial({ color: 0x18211c }),
};

function canvasTex(w, h, draw) {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  draw(cv.getContext("2d"));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* 窓明かりテクスチャ */
const winTex = canvasTex(128, 256, (g) => {
  g.fillStyle = "#101622"; g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 18) for (let x = 8; x < 120; x += 16) {
    const r = Math.random();
    g.fillStyle = r < 0.12 ? "#5fd4e8" : r < 0.2 ? "#e0b060" : "#0c1119";
    g.globalAlpha = r < 0.2 ? 0.75 : 1;
    g.fillRect(x, y, 9, 11); g.globalAlpha = 1;
  }
});
const winMat = new THREE.MeshLambertMaterial({ map: winTex, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.45 });

/* ================= ワールド ================= */
const colliders = [];
function addCollider(x, z, w, d) { colliders.push({ x0: x - w / 2 - 0.5, x1: x + w / 2 + 0.5, z0: z - d / 2 - 0.5, z1: z + d / 2 + 0.5 }); }

const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), MAT.ground);
ground.rotation.x = -Math.PI / 2; scene.add(ground);
const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 200), MAT.asphalt);
road.rotation.x = -Math.PI / 2; road.position.y = 0.01; scene.add(road);

/* 中央線（アニメなし・情景） */
for (let z = -90; z < 90; z += 6) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 2.4), new THREE.MeshBasicMaterial({ color: 0x2a3550 }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, 0.02, z); scene.add(m);
}

/* 建物 */
let seed = 7;
function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
for (let side = -1; side <= 1; side += 2) {
  for (let z = 34; z > -46; z -= 11) {
    const w = 7 + rnd() * 5, d = 7 + rnd() * 4, h = 7 + rnd() * 13;
    const x = side * (9 + w / 2 + rnd() * 4);
    if (side === 1 && z < -8 && z > -34) continue; // 公園スペース
    const geo = new THREE.BoxGeometry(w, h, d);
    const mats = [winMat, winMat, MAT.bldg, MAT.bldg, winMat, winMat];
    const b = new THREE.Mesh(geo, rnd() < 0.5 ? mats : [MAT.bldg2, MAT.bldg2, MAT.bldg2, MAT.bldg2, winMat, winMat]);
    b.position.set(x, h / 2, z); scene.add(b);
    addCollider(x, z, w, d);
  }
}

/* 街灯 */
for (let z = 24; z > -40; z -= 16) for (let side = -1; side <= 1; side += 2) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.6), MAT.steel);
  p.position.set(side * 5, 2.3, z); scene.add(p);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.22), MAT.cyan);
  head.position.set(side * 4.6, 4.5, z); scene.add(head);
}

/* 給水塔 */
const tower = new THREE.Group();
const tank = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 5.5, 14), MAT.rust);
tank.position.y = 13; tower.add(tank);
const cap = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.6, 14), MAT.steel);
cap.position.y = 16.5; tower.add(cap);
for (let i = 0; i < 4; i++) {
  const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 10.5), MAT.steel);
  leg.position.set(Math.cos(a) * 2.4, 5.2, Math.sin(a) * 2.4);
  leg.rotation.z = Math.cos(a) * 0.12; leg.rotation.x = -Math.sin(a) * 0.12;
  tower.add(leg);
}
const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.5, 10.5, 0.1), MAT.steel);
ladder.position.set(0, 5.2, 2.5); tower.add(ladder);
const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3), MAT.red.clone());
beacon.position.y = 17.6; tower.add(beacon);
tower.position.set(0, 0, -38); scene.add(tower);
addCollider(0, -38, 5.4, 5.4);

/* サーチライト（回転する監視の光） */
const searchCone = new THREE.Mesh(
  new THREE.ConeGeometry(6, 22, 24, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x5fd4e8, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false })
);
searchCone.position.set(0, 11, -38);
searchCone.rotation.x = 0.5;
const searchPivot = new THREE.Group();
searchPivot.position.set(0, 0, 0);
scene.add(searchPivot);
searchPivot.add(searchCone);

/* 規制テープ */
const tapeTex = canvasTex(256, 32, (g) => {
  g.fillStyle = "#e0b060"; g.fillRect(0, 0, 256, 32);
  g.fillStyle = "#060a12"; g.font = "bold 18px monospace";
  g.fillText("機構規制線  KEEP OUT  機構規制線", 4, 22);
});
tapeTex.wrapS = THREE.RepeatWrapping; tapeTex.repeat.x = 3;
for (let i = 0; i < 4; i++) {
  const a1 = (i / 4) * Math.PI * 2, a2 = ((i + 1) / 4) * Math.PI * 2, R = 7;
  const p1 = new THREE.Vector3(Math.cos(a1) * R, 1, -38 + Math.sin(a1) * R);
  const p2 = new THREE.Vector3(Math.cos(a2) * R, 1, -38 + Math.sin(a2) * R);
  const len = p1.distanceTo(p2);
  const tape = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.28),
    new THREE.MeshBasicMaterial({ map: tapeTex, side: THREE.DoubleSide, transparent: true }));
  tape.position.copy(p1).add(p2).multiplyScalar(0.5);
  tape.lookAt(new THREE.Vector3(0, 1, -38));
  scene.add(tape);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1), MAT.steel);
  pole.position.set(p1.x, 0.55, p1.z); scene.add(pole);
}

/* 遺体シート */
const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 1.9), MAT.sheet);
sheet.position.set(1.4, 0.15, -35.4); sheet.rotation.y = 0.4; scene.add(sheet);

/* 澪(ビルボード) */
const mioTex = canvasTex(128, 256, (g) => {
  g.clearRect(0, 0, 128, 256);
  g.fillStyle = "#0d1524";
  g.strokeStyle = "#5fd4e8"; g.lineWidth = 2.5;
  // 頭
  g.beginPath(); g.arc(64, 52, 20, 0, Math.PI * 2); g.fill(); g.stroke();
  // 体(制服)
  g.beginPath();
  g.moveTo(38, 92); g.quadraticCurveTo(64, 74, 90, 92);
  g.lineTo(96, 210); g.lineTo(32, 210); g.closePath(); g.fill(); g.stroke();
  // 襟
  g.strokeStyle = "#5fd4e8"; g.beginPath(); g.moveTo(52, 88); g.lineTo(64, 104); g.lineTo(76, 88); g.stroke();
  // 端末
  g.fillStyle = "#5fd4e8"; g.globalAlpha = 0.85; g.fillRect(76, 128, 16, 24); g.globalAlpha = 1;
});
const mio = new THREE.Sprite(new THREE.SpriteMaterial({ map: mioTex, transparent: true }));
mio.scale.set(1.15, 2.3, 1);
mio.position.set(-2.2, 1.15, -33.5);
scene.add(mio);

/* 公園の壁 */
const wallTex = canvasTex(512, 256, (g) => {
  g.fillStyle = "#2b2f33"; g.fillRect(0, 0, 512, 256);
  g.fillStyle = "#24282c";
  for (let y = 0; y < 256; y += 32) for (let x = (y / 32 % 2) * 32; x < 512; x += 64) g.fillRect(x + 1, y + 1, 62, 30);
  // 磨かれた痕
  const grad = g.createRadialGradient(256, 140, 10, 256, 140, 90);
  grad.addColorStop(0, "rgba(200,200,190,0.5)");
  grad.addColorStop(1, "rgba(200,200,190,0)");
  g.fillStyle = grad; g.beginPath(); g.arc(256, 140, 90, 0, Math.PI * 2); g.fill();
});
const wall = new THREE.Mesh(new THREE.BoxGeometry(9, 4.4, 0.5),
  new THREE.MeshLambertMaterial({ map: wallTex }));
wall.position.set(20, 2.2, -21); wall.rotation.y = -Math.PI / 2.15;
scene.add(wall);
addCollider(20, -21, 2.5, 9);

/* 公園の地面・草 */
const park = new THREE.Mesh(new THREE.PlaneGeometry(18, 20), MAT.grass);
park.rotation.x = -Math.PI / 2; park.position.set(15, 0.005, -21); scene.add(park);
const grassGeo = new THREE.ConeGeometry(0.09, 0.5, 4);
for (let i = 0; i < 80; i++) {
  const gm = new THREE.Mesh(grassGeo, MAT.grass);
  gm.position.set(12 + rnd() * 7, 0.25, -28 + rnd() * 14);
  gm.rotation.y = rnd() * 3; gm.scale.setScalar(0.7 + rnd());
  scene.add(gm);
}

/* ボール */
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), MAT.ball);
ball.position.set(17.6, 0.13, -19.2); scene.add(ball);
const ballRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 24),
  new THREE.MeshBasicMaterial({ color: 0xe0b060, transparent: true, opacity: 0, side: THREE.DoubleSide }));
ballRing.rotation.x = -Math.PI / 2; ballRing.position.set(17.6, 0.03, -19.2); scene.add(ballRing);

/* 目的地ビーコン */
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 40, 16, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x5fd4e8, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
beam.visible = false; scene.add(beam);
function setBeacon(x, z) { beam.visible = true; beam.position.set(x, 20, z); }
function clearBeacon() { beam.visible = false; }

/* 浮遊塵 */
const dustGeo = new THREE.BufferGeometry();
const dustN = 350, dustPos = new Float32Array(dustN * 3);
for (let i = 0; i < dustN; i++) {
  dustPos[i * 3] = (rnd() - 0.5) * 90;
  dustPos[i * 3 + 1] = rnd() * 12;
  dustPos[i * 3 + 2] = (rnd() - 0.5) * 120 - 10;
}
dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x3a4a66, size: 0.06, transparent: true, opacity: 0.7 }));
scene.add(dust);

/* ================= 壁打ち空間(異空間) ================= */
const voidGroup = new THREE.Group(); voidGroup.visible = false; scene.add(voidGroup);
function textPanel(lines, x, z, w = 6) {
  const t = canvasTex(1024, 512, (g) => {
    g.clearRect(0, 0, 1024, 512);
    g.fillStyle = "#c9c2b6";
    g.font = "34px monospace"; g.textAlign = "center";
    lines.forEach((ln, i) => g.fillText(ln, 512, 200 + i * 58));
  });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0 }));
  p.position.set(x, 2.1, z);
  voidGroup.add(p);
  return p;
}
const voidPanels = [
  textPanel(["【壁打ち】"], 0, -12),
  textPanel(["ルールは三つ。", "名前を持たない。記録を残さない。", "球は、打ち返す。"], 2.5, -24, 8),
  textPanel(["【シオ】今日も壁当てしてきた。", "あの壁、ちょっとおれに甘い気がする。"], -2.5, -36, 8),
  textPanel(["【シオ】なあ、みんな最近どうした?", "球が全然返ってこないんだけど。"], 2, -48, 8),
  textPanel(["【シオ】壁、聞こえてるか?"], -1.5, -58, 7),
  textPanel(["【シオ】おーい。"], 0, -68, 5),
];
const voidEnd = textPanel(["ここから先は、まだ工事中だ。", "――第二部へ、続く。"], 0, -80, 8);

/* ================= プレイヤー ================= */
const P = {
  pos: new THREE.Vector3(0, 1.6, 26),
  yaw: 0, pitch: 0,
  vel: new THREE.Vector3(),
  dist: 0, inspected: 0, evidence: [],
  mode: "city",
};
camera.position.copy(P.pos);
const keys = {};
addEventListener("keydown", (e) => { keys[e.code] = true; if (e.code === "KeyE") tryInteract(); });
addEventListener("keyup", (e) => { keys[e.code] = false; });

/* 視点: ドラッグ(マウス/タッチ右側) */
let dragging = false, lastX = 0, lastY = 0;
canvas.addEventListener("mousedown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
addEventListener("mouseup", () => { dragging = false; });
addEventListener("mousemove", (e) => {
  if (!dragging) return;
  P.yaw -= (e.clientX - lastX) * 0.004;
  P.pitch = Math.max(-1.2, Math.min(1.2, P.pitch - (e.clientY - lastY) * 0.004));
  lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener("click", () => { if (!dlgActive) tryInteract(); });

/* タッチ: 左スティック + 右ドラッグ */
const stickState = { active: false, id: -1, dx: 0, dy: 0 };
const lookState = { id: -1, x: 0, y: 0 };
addEventListener("touchstart", (e) => {
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.4 && t.clientY > innerHeight * 0.5 && !stickState.active) {
      stickState.active = true; stickState.id = t.identifier;
      stickCenter(t.clientX, t.clientY);
    } else if (lookState.id === -1) {
      lookState.id = t.identifier; lookState.x = t.clientX; lookState.y = t.clientY;
    }
  }
}, { passive: true });
addEventListener("touchmove", (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === stickState.id) {
      const r = ui.stick.getBoundingClientRect();
      const cx = r.left + 55, cy = r.top + 55;
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const len = Math.hypot(dx, dy), max = 44;
      if (len > max) { dx *= max / len; dy *= max / len; }
      stickState.dx = dx / max; stickState.dy = dy / max;
      ui.nub.style.transform = `translate(${dx}px,${dy}px)`;
    } else if (t.identifier === lookState.id) {
      P.yaw -= (t.clientX - lookState.x) * 0.005;
      P.pitch = Math.max(-1.2, Math.min(1.2, P.pitch - (t.clientY - lookState.y) * 0.005));
      lookState.x = t.clientX; lookState.y = t.clientY;
    }
  }
}, { passive: true });
addEventListener("touchend", (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === stickState.id) {
      stickState.active = false; stickState.id = -1; stickState.dx = stickState.dy = 0;
      ui.nub.style.transform = "";
    }
    if (t.identifier === lookState.id) lookState.id = -1;
  }
}, { passive: true });
function stickCenter(x, y) {
  ui.stick.style.left = (x - 55) + "px";
  ui.stick.style.top = (y - 55) + "px";
  ui.stick.style.bottom = "auto";
}
ui.btnact.addEventListener("click", () => tryInteract());

/* ================= 会話 ================= */
let dlgActive = false, dlgQueue = [], dlgResolve = null, typeTimer = null, typing = false, fullText = "";
function say(name, lines) {
  return new Promise((res) => {
    dlgQueue = lines.slice(); dlgResolve = res; dlgActive = true;
    ui.dlg.classList.add("show");
    ui.dlgname.textContent = name;
    ui.dlgname.className = name === "透" ? "kuro" : "";
    nextLine();
  });
}
function nextLine() {
  if (typing) {
    clearInterval(typeTimer); typing = false;
    ui.dlgtext.textContent = fullText;
    return;
  }
  if (!dlgQueue.length) {
    ui.dlg.classList.remove("show"); dlgActive = false;
    const r = dlgResolve; dlgResolve = null; if (r) r();
    return;
  }
  fullText = dlgQueue.shift();
  ui.dlgtext.textContent = ""; typing = true;
  blip(660, 0.03, 0.02);
  let i = 0;
  typeTimer = setInterval(() => {
    i++;
    ui.dlgtext.textContent = fullText.slice(0, i);
    if (i >= fullText.length) { clearInterval(typeTimer); typing = false; }
  }, 24);
}
ui.dlg.addEventListener("click", (e) => { e.stopPropagation(); nextLine(); });

function ask(name, text, options) {
  return new Promise((res) => {
    dlgActive = true;
    ui.dlg.classList.add("show");
    ui.dlgname.textContent = name;
    ui.dlgname.className = "";
    ui.dlgtext.textContent = text;
    ui.dlgcue.style.visibility = "hidden";
    ui.dlgchoices.style.display = "flex";
    ui.dlgchoices.innerHTML = "";
    options.forEach((op, i) => {
      const b = document.createElement("button");
      b.textContent = op;
      b.onclick = (e) => {
        e.stopPropagation();
        ui.dlgchoices.style.display = "none";
        ui.dlgcue.style.visibility = "";
        ui.dlg.classList.remove("show");
        dlgActive = false;
        blip(880, 0.05, 0.04);
        res(i);
      };
      ui.dlgchoices.appendChild(b);
    });
  });
}

/* ================= HUD ================= */
function objective(t) {
  ui.objective.classList.remove("show");
  setTimeout(() => { ui.objective.textContent = "▸ " + t; ui.objective.classList.add("show"); }, 350);
}
let toastTimer = null;
function toast(t) {
  ui.toast.textContent = t; ui.toast.classList.add("show");
  blip(1200, 0.08, 0.05);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2600);
}
function fadeTo(text) {
  return new Promise((res) => {
    ui.fadetext.textContent = text || "";
    ui.fade.classList.add("on");
    setTimeout(res, text ? 1600 : 700);
  });
}
function fadeIn() { ui.fade.classList.remove("on"); }

/* ================= インタラクト ================= */
const interactables = [];
function addInteract(x, z, r, label, fn) {
  const it = { x, z, r, label, fn, enabled: false };
  interactables.push(it); return it;
}
let nearest = null;
function updateInteract() {
  nearest = null;
  let best = 1e9;
  for (const it of interactables) {
    if (!it.enabled) continue;
    const d = Math.hypot(P.pos.x - it.x, P.pos.z - it.z);
    if (d < it.r && d < best) { best = d; nearest = it; }
  }
  if (nearest && !dlgActive) {
    ui.prompt.textContent = (isTouch ? "" : "[E] ") + nearest.label;
    ui.prompt.classList.add("show");
    ui.btnact.style.borderColor = "#e0b060";
  } else {
    ui.prompt.classList.remove("show");
    ui.btnact.style.borderColor = "#5fd4e8";
  }
}
function tryInteract() {
  if (dlgActive || !nearest) return;
  const it = nearest;
  it.enabled = false;
  P.inspected++;
  blip(880, 0.06, 0.05);
  it.fn();
}

/* ================= クエスト進行 ================= */
const itMio = addInteract(-2.2, -33.5, 2.4, "二階堂澪と話す", onMio);
const itSheet = addInteract(1.4, -35.4, 2.2, "調べる", onSheet);
const itWall = addInteract(17.5, -21, 3.4, "壁を調べる", onWall);
const itBall = addInteract(17.6, -19.2, 1.6, "草むらを探す", onBall);
const itVoidEnd = addInteract(0, -80, 3.2, "触れる", onVoidEnd);
let towerTriggered = false;

async function questStart() {
  await say("透", [
    "旧市街、第三区。",
    "機構のカメラ更新網から取り残された、この街で最後の、観測されない場所。",
    "……こういう朝に人が死ぬのは、雨の朝に死ぬより、ずっとこたえる。",
  ]);
  objective("現場へ向かえ ―― 赤い光の下");
  setBeacon(0, -33);
}

async function onTowerArea() {
  clearBeacon();
  await say("澪", [
    "「灰原さん。こちらです」",
    "「汐見航、十六歳。適応値、上位〇・一パーセント。機構の模範事例です」",
    "「情動ログは直近九十日、すべて『回復帯・良好』。……昨夜二十二時の定時報告が最後です」",
  ]);
  await say("透", ["機構開闢以来、初の完全予測失敗事案。", "予測できない事件には、予測できない人間をぶつける。それが僕だ。"]);
  objective("遺体を調べろ");
  itSheet.enabled = true;
  itMio.enabled = false;
}

async function onSheet() {
  await say("透", [
    "シートの下から、細い手首が出ていた。",
    "その手のひらに――僕は、見てはいけないものを見つけてしまった。",
  ]);
  const c = await ask("澪", "「灰原さん。所見を」", [
    "「予兆ゼロの死なんて、あり得ない」",
    "「……なんで、この手にマメがあるんですか」",
    "(黙って手のひらを指す)",
  ]);
  if (c === 0) {
    await say("澪", ["「あり得ません。だからこそ例外事案です。……それより、彼の手を」"]);
  }
  await say("透", [
    "硬いマメ。皮膚が何度も潰れて、そのたびに固くなった、労働のあとみたいなマメ。",
    "ちょうどいい課題だけが配信されるこの社会に、素振りは存在しない。",
    "誰の手にも、マメなんてできないはずなのだ。",
  ]);
  toast("証拠を記録した ―― 手のひらのマメ");
  P.evidence.push("手のひらのマメ");
  await say("澪", [
    "「……生活ログに、一箇所だけ空白があります。週三回、夕方の一時間」",
    "「位置情報は、この先の第三公園。カメラの対象外区域です」",
  ]);
  objective("第三公園の壁を調べろ");
  setBeacon(17.5, -21);
  itWall.enabled = true;
}

async function onMio() { /* 序盤は塔エリア到達で自動会話 */ }

async function onWall() {
  clearBeacon();
  await say("透", [
    "壁の一箇所だけ、色が違う。",
    "腰の高さから頭の上まで――何かが、何千回もぶつかった痕だ。",
    "足元の草むらが、不自然に踏まれている。",
  ]);
  objective("草むらを探せ");
  itBall.enabled = true;
  ballRing.material.opacity = 0.8;
}

async function onBall() {
  ballRing.material.opacity = 0;
  ball.position.y = 1.2;
  await say("透", [
    "古い、硬式の野球ボールだった。",
    "革は飴色で、表面には壁の煤が染み込んでいる。登録タグは――どこにもない。",
    "この世界の物品台帳に存在しないボール。",
  ]);
  toast("証拠を記録した ―― 未登録の硬球");
  P.evidence.push("未登録の硬球");
  await say("澪", [
    "「……何のためですか。投球の習熟なら、課題申請をすれば最適なプログラムが」",
  ]);
  await say("透", [
    "「何のためでもないですよ。壁当てっていうんです」",
    "「壁にボールを投げると、壁が打ち返してくる。一人でやるキャッチボール」",
    "誰も見ていない場所で、観測されない努力をしていた少年。",
    "……その夜、僕は家に帰って、押し入れの奥から古い端末を出した。",
  ]);
  enterVoid();
}

async function enterVoid() {
  await fadeTo("未登録網に接続しています ……");
  P.mode = "void";
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.055);
  scene.traverse((o) => { if (o !== voidGroup && o.parent === scene && o !== camera) o.visible = false; });
  voidGroup.visible = true;
  ui.objective.classList.remove("show");
  document.getElementById("hudbar").style.opacity = "0";
  P.pos.set(0, 1.6, 0); P.yaw = 0;
  fadeIn();
  await say("透", [
    "あの少年が出入りしていた場所。機構が闇と呼ぶこの場所を、九年間、管理してきたのは――僕だ。",
    "奥へ。言葉の中を、歩いてくれ。",
  ]);
  itVoidEnd.enabled = true;
  pok();
}

async function onVoidEnd() {
  await fadeTo("");
  showEnding();
}

function showEnding() {
  const secs = Math.round((Date.now() - startTime) / 1000);
  ui.repbody.innerHTML =
    "調査時間: " + Math.floor(secs / 60) + "分" + (secs % 60) + "秒<br>" +
    "歩行距離: " + Math.round(P.dist) + " m<br>" +
    "調査回数: " + P.inspected + " 回<br>" +
    "記録した証拠: " + P.evidence.join(" ／ ");
  ui.repsay.textContent = "このゲームは、最初からあなたを観測していた。機構が彼にしたのと、同じ静かさで。――3D体験版はここまで。";
  ui.fade.classList.remove("on");
  ui.ending.classList.add("show");
}

/* ================= メインループ ================= */
let startTime = 0, started = false, tPrev = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min((t - tPrev) / 1000, 0.05); tPrev = t;
  if (!started) { renderer.render(scene, camera); return; }

  /* 移動 */
  let mx = 0, mz = 0;
  if (keys.KeyW || keys.ArrowUp) mz -= 1;
  if (keys.KeyS || keys.ArrowDown) mz += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  mx += stickState.dx; mz += stickState.dy;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const sp = 4.4;
  if (!dlgActive && (mx || mz)) {
    const sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
    const dx = (mx * cos + mz * sin) * sp * dt;
    const dz = (-mx * sin + mz * cos) * sp * dt;
    const nx = P.pos.x + dx, nz = P.pos.z + dz;
    let bx = false, bz = false;
    for (const c of colliders) {
      if (nx > c.x0 && nx < c.x1 && P.pos.z > c.z0 && P.pos.z < c.z1) bx = true;
      if (P.pos.x > c.x0 && P.pos.x < c.x1 && nz > c.z0 && nz < c.z1) bz = true;
    }
    if (!bx) { P.dist += Math.abs(dx); P.pos.x = Math.max(-40, Math.min(40, nx)); }
    if (!bz) { P.dist += Math.abs(dz); P.pos.z = Math.max(-90, Math.min(34, nz)); }
    /* 歩行の揺れ */
    P.pos.y = 1.6 + Math.sin(t * 0.012) * 0.035;
  }
  camera.position.copy(P.pos);
  camera.rotation.set(P.pitch, P.yaw, 0);

  /* アニメーション群 */
  beacon.visible = Math.sin(t * 0.004) > -0.2;
  searchCone.rotation.y += dt * 0.25;
  searchPivot.rotation.y += dt * 0.11;
  dust.rotation.y += dt * 0.006;
  beam.material.opacity = 0.1 + Math.sin(t * 0.003) * 0.05;
  ballRing.rotation.z += dt * 1.2;
  if (ballRing.material.opacity > 0) ballRing.scale.setScalar(1 + Math.sin(t * 0.005) * 0.15);
  mio.position.y = 1.15 + Math.sin(t * 0.0015) * 0.02;

  /* 壁打ち空間: パネルは近づくと浮かび上がる */
  if (P.mode === "void") {
    for (const p of voidPanels.concat([voidEnd])) {
      const d = Math.hypot(P.pos.x - p.position.x, P.pos.z - p.position.z);
      const target = d < 14 ? Math.max(0, 1 - Math.abs(d - 5) / 9) : 0;
      p.material.opacity += (target - p.material.opacity) * 0.06;
      p.lookAt(camera.position.x, 2.1, camera.position.z);
    }
  }

  /* 塔エリアトリガ */
  if (!towerTriggered && P.mode === "city" && Math.hypot(P.pos.x, P.pos.z + 33) < 8) {
    towerTriggered = true;
    onTowerArea();
  }

  updateInteract();
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);

/* 開発用フック（テスト・デバッグ） */
window.__dbg = { tp: (x, z) => { P.pos.x = x; P.pos.z = z; }, P };

/* ================= 開始 ================= */
$("btnstart").addEventListener("click", async () => {
  audioInit();
  ui.start.classList.add("hide");
  started = true;
  startTime = Date.now();
  itMio.enabled = false;
  await questStart();
});
