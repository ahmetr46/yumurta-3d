// Sıfır Meridyen (The Wrong Zero) — why the prime meridian is in Greenwich, and why the brass line there is no longer zero.
// English narration (voice/script.txt). Sets, far apart in x:
//   STUDY  (x≈0)    a night study: a globe with meridians, an orrery whose sun is the key light, moonlight from the window
//   SEA    (x≈200)  a ship's deck at night: a lantern on the mast is the key, the moon is the cool fill, other ships' lights
//   HALL   (x≈300)  Washington 1884: a gas chandelier (warm) against blue night windows; delegates behind a long table
//   GREEN  (x≈400)  Greenwich by day: the courtyard with the brass line, the transit telescope and its plumb line, the park
//                   14 m further east (stands for the ~100 m) with the real zero; the sun is the key
//   FRAME  (x≈500)  the analogy: a picture squared to a tilted floor, sun through a window
// Every cue is pinned to a word of voice/words.json (W('word', n) = start of the n-th match).
import * as THREE from 'three';
import { stoneTex, woodTex, carpetTex, wallTex, ciniTex, frizTex, painted, flat, rng, D, shade } from '/engine/src/paint.js';
import { Toon, Arm3D, PLUM, flap, blinkAt } from '/engine/src/toon.js';
import { CamPath, smoother } from '/engine/src/camera.js';
import { Smoke, beam, glow } from '/engine/src/fx.js';
import { holedWall, vistaMat, nightCityTex, dayGardenTex } from '/engine/src/vista.js';

export const NAME = 'sifir-meridyen';
export const FPS = 30;
export let DUR = 49.3;
export const CUES = [];

const S = smoother;
const ramp = (t, a, b) => S((t - a) / (b - a));
const lin = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const lerpN = (a, b, k) => a + (b - a) * k;
const V = (...a) => new THREE.Vector3(...a);
const HDR = (r, g, b) => new THREE.Color().setRGB(r, g, b);
const DEG = Math.PI / 180;
const backOut = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
const FONT = '"Inter Black", "Arial Black", sans-serif';
let C, W;
let cast = {}, sets = {}, dyn = {}, smokes = {};

function wordTimes(words) {
  const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return (w, n = 1) => { let k = 0; for (const x of words) if (norm(x.word) === norm(w) && ++k === n) return x.start; throw new Error('word not found: ' + w); };
}
function shadows(g) {
  g.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return;
    if (o.material.isMeshLambertMaterial) o.receiveShadow = true;
    if (/Box|Cylinder|Extrude|Lathe|Torus|Sphere/.test(o.geometry.type) && !o.userData.noShadow) o.castShadow = true;
  });
}
function keySpot(color, intensity, pos, target, angle, { map, size = 2048, near = 1, far = 60, penumbra = .35 } = {}) {
  const l = new THREE.SpotLight(color, intensity, 0, angle, penumbra, 0);
  l.position.set(...pos); l.target.position.set(...target); l.castShadow = true;
  l.shadow.mapSize.set(size, size); l.shadow.camera.near = near; l.shadow.camera.far = far; l.shadow.bias = -.0006; l.shadow.normalBias = .03; l.shadow.radius = 3;
  if (map) l.map = map;
  return l;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.canvas = c; t.g = g; return t;
}
// an on-screen tag (layer 1, no world ink): cream pill, plum letters. A Sprite: always faces the camera.
function tag(scene, text, h = .1, { bg = '#fbf3df', fg = PLUM, red = false } = {}) {
  const fs = 96, pad = 40;
  const mc = document.createElement('canvas').getContext('2d'); mc.font = `900 ${fs}px ${FONT}`;
  const tw = Math.ceil(mc.measureText(text).width) + pad * 2, th = fs + pad * 1.4;
  const t = canvasTex(tw, th, (g, w, hh) => {
    g.fillStyle = D(red ? '#d8343c' : bg); g.strokeStyle = PLUM; g.lineWidth = 12; g.beginPath(); g.roundRect(6, 6, w - 12, hh - 12, hh / 2 - 6); g.fill(); g.stroke();
    g.font = `900 ${fs}px ${FONT}`; g.fillStyle = red ? '#fff' : D(fg); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, hh / 2 + 4);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, depthWrite: false }));
  s.scale.set(h * tw / th, h, 1); s.layers.set(1); s.renderOrder = 30; s.visible = false; s.base = s.scale.clone(); scene.add(s); return s;
}
// pop a tag in with an overshoot (k = seconds since it appeared)
function pop(s, k, on = true) { s.visible = on && k >= 0; if (s.visible) { const f = .2 + .8 * backOut(k / .18); s.scale.set(s.base.x * f, s.base.y * f, 1); } }

// ---------------------------------------------------------------- world map (equirectangular), coarse outlines
const LAND = [
  [[-168, 66], [-140, 70], [-110, 72], [-80, 72], [-62, 60], [-55, 50], [-66, 44], [-75, 35], [-81, 25], [-97, 26], [-97, 18], [-87, 15], [-80, 8], [-92, 14], [-105, 20], [-112, 30], [-118, 34], [-124, 40], [-125, 49], [-135, 57], [-150, 60], [-165, 62]],
  [[-50, 60], [-42, 60], [-20, 70], [-20, 80], [-45, 83], [-60, 78], [-55, 68]],
  [[-80, 8], [-72, 12], [-60, 10], [-50, 0], [-35, -6], [-40, -22], [-48, -28], [-58, -38], [-65, -42], [-68, -55], [-75, -50], [-72, -30], [-70, -18], [-76, -12], [-81, -4]],
  [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [2, 51], [5, 53], [8, 57], [5, 62], [15, 69], [28, 71], [40, 67], [60, 70], [80, 73], [100, 77], [130, 72], [160, 70], [180, 66], [175, 62], [160, 58], [140, 54], [135, 43], [122, 38], [122, 30], [110, 20], [105, 10], [100, 13], [98, 8], [92, 22], [80, 15], [77, 8], [72, 20], [66, 25], [58, 25], [52, 28], [48, 30], [56, 24], [59, 22], [52, 16], [44, 13], [38, 22], [34, 28], [35, 32], [36, 36], [27, 37], [22, 37], [18, 40], [15, 38], [12, 44], [8, 44], [3, 43], [-1, 37]],
  [[-5, 50], [1, 51], [2, 53], [-1, 55], [-2, 57], [-4, 58.5], [-6, 57], [-5, 55], [-3, 54], [-5, 52]],
  [[-10, 52], [-6, 52], [-6, 55], [-8, 55], [-10, 54]],
  [[-17, 15], [-17, 21], [-13, 28], [-6, 36], [10, 37], [11, 33], [20, 31], [30, 31], [32, 31], [35, 28], [43, 12], [51, 12], [42, -2], [40, -15], [35, -24], [27, -34], [19, -35], [13, -20], [12, -6], [9, 4], [-8, 4], [-14, 10]],
  [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -26], [150, -37], [140, -38], [132, -32], [115, -34]],
  [[44, -25], [50, -15], [49, -12], [44, -16]],
  [[130, 31], [135, 34], [140, 36], [142, 40], [141, 45], [139, 42], [136, 36], [131, 34]],
];
const SEAS = [[[28, 41], [28, 44], [33, 46], [38, 47], [41, 42], [35, 41.5]]];     // the Black Sea (Istanbul sits on its strait)
// draw the map into a rectangle; lon/lat window [l0, l1] x [b0, b1]
function drawMap(g, x, y, w, h, { l0 = -180, l1 = 180, b0 = -90, b1 = 90, sea = '#3f7fd0', land = '#86c26c', coast = '#2a4a3a', lw = 3, ice = true, grid = 0, gridC = 'rgba(30,40,80,.35)' } = {}) {
  const X = lon => x + (lon - l0) / (l1 - l0) * w, Y = lat => y + (b1 - lat) / (b1 - b0) * h;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = sea; g.fillRect(x, y, w, h);
  const R = rng(7); for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${.03 + R() * .04})`; g.beginPath(); g.ellipse(x + R() * w, y + R() * h, 20 + R() * 60, 6 + R() * 14, 0, 0, 6.29); g.fill(); }
  if (grid) { g.strokeStyle = gridC; g.lineWidth = lw * .5; for (let lo = -180; lo <= 180; lo += grid) { g.beginPath(); g.moveTo(X(lo), y); g.lineTo(X(lo), y + h); g.stroke(); } for (let la = -90; la <= 90; la += grid) { g.beginPath(); g.moveTo(x, Y(la)); g.lineTo(x + w, Y(la)); g.stroke(); } }
  const poly = (P, fill) => { g.beginPath(); P.forEach(([lo, la], i) => i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la))); g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = coast; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(); };
  for (const P of LAND) poly(P, land);
  for (const P of SEAS) poly(P, sea);
  if (ice) { g.fillStyle = '#f2f4fa'; g.fillRect(x, Y(-72), w, h); g.strokeStyle = coast; g.lineWidth = lw; g.beginPath(); g.moveTo(x, Y(-72)); g.lineTo(x + w, Y(-72)); g.stroke(); }
  g.restore();
  return { X, Y };
}

// ---------------------------------------------------------------- STUDY (x = 0)
const GLOBE = V(0, 1.18, -1.0), GR = .42;
const ORR = V(1.45, .99, -1.6);          // the orrery's sun
const GREEN_LON = 0, IST_LON = 29;
function lonDir(lon, lat = 0) { const l = lon * DEG, b = lat * DEG; return V(Math.cos(l) * Math.cos(b), Math.sin(b), -Math.sin(l) * Math.cos(b)); }
function bookTex() {
  return canvasTex(2048, 1024, (g, w, h) => {
    g.fillStyle = '#5a3a2e'; g.fillRect(0, 0, w, h);
    const R = rng(4), rows = 4, rh = h / rows, cols = ['#c8423c', '#3a6ab8', '#e0a83e', '#3f8a5a', '#8a4a9a', '#e8dcc0', '#2f4f8a', '#b8643a', '#5ab0b0'];
    for (let r = 0; r < rows; r++) {
      const y0 = r * rh + 18, y1 = (r + 1) * rh - 22;
      g.fillStyle = '#3a2420'; g.fillRect(0, y0 - 18, w, y1 - y0 + 36);
      for (let x = 10; x < w - 20;) {
        const bw = 24 + R() * 30, bh = (y1 - y0) * (.72 + R() * .28), c = cols[Math.floor(R() * cols.length)];
        if (R() < .07) { x += 40; continue; }
        g.fillStyle = c; g.fillRect(x, y1 - bh, bw, bh);
        g.fillStyle = shade(c, 1.25); g.fillRect(x + 4, y1 - bh + 4, 5, bh - 8);
        g.fillStyle = shade(c, .55); g.fillRect(x, y1 - bh + bh * .15, bw, 6); g.fillRect(x, y1 - bh * .2, bw, 6);
        g.strokeStyle = shade(c, .4); g.lineWidth = 2.4; g.strokeRect(x, y1 - bh, bw, bh);
        x += bw + 2;
      }
      g.fillStyle = '#8a5a3a'; g.fillRect(0, y1, w, 22); g.fillStyle = '#a8744a'; g.fillRect(0, y1, w, 5);
    }
    for (let x = 0; x <= w; x += w / 4) { g.fillStyle = '#7a4c30'; g.fillRect(x - 14, 0, 28, h); g.fillStyle = '#9a6a42'; g.fillRect(x - 14, 0, 6, h); }
  });
}
function buildStudy(scene) {
  const g = new THREE.Group(); scene.add(g);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), painted(woodTex({ base: '#9a6438', plank: 48, rep: [3, 3] }))); fl.rotation.x = -Math.PI / 2; g.add(fl);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.4), painted(carpetTex({ base: '#2f4f9a', band: '#e0b050', rows: 2 }))); rug.rotation.x = -Math.PI / 2; rug.position.set(.2, .005, -.6); g.add(rug);
  // back wall: bookshelves (pattern on the big wall), proud of the plaster
  const back = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), painted(wallTex({ base: '#4a6aa8', frame: '#2a2a48', cols: 1, rows: [], night: true, ashlar: [20, 10] }))); back.position.set(0, 1.7, -4); g.add(back);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.7, .35), [flat('#6a4430'), flat('#6a4430'), flat('#6a4430'), flat('#6a4430'), painted(bookTex()), flat('#6a4430')]); shelf.position.set(-.2, 1.35, -3.8); g.add(shelf);
  // left wall with a window: night city, moon
  const WIN = [-.6, 1.0, .6, 2.4];
  const lw = holedWall(9, 3.4, WIN, painted(wallTex({ base: '#4a6aa8', cols: 1, rows: [], night: true, ashlar: [20, 10], rep: [1 / 9, 1 / 3.4] })));
  lw.position.set(-4, 0, 0); lw.rotation.y = Math.PI / 2; lw.castShadow = true; g.add(lw);
  const vm = vistaMat(nightCityTex(), { yaw: Math.atan2(-4 - .6, 0 - 1.6), az: Math.PI / 2, el: [-10 * DEG, 35 * DEG], gain: 1.25 });
  const vp = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6), vm); vp.position.set(-4.12, 1.7, 0); vp.rotation.y = Math.PI / 2; g.add(vp);
  const casing = flat('#e8dcc0');
  for (const [w, h, y, z] of [[.14, 1.6, 1.7, -.67], [.14, 1.6, 1.7, .67], [1.48, .14, 2.47, 0], [1.48, .12, .93, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.24, h, w), casing); b.position.set(-3.95, y, z); g.add(b); }
  for (const z of [0]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.05, 1.4, .05), casing); b.position.set(-4.0, 1.7, z); b.userData.noShadow = true; g.add(b); }
  const right = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), painted(wallTex({ base: '#4a6aa8', cols: 2, night: true, ashlar: [20, 10] }))); right.position.set(4, 1.7, 0); right.rotation.y = -Math.PI / 2; g.add(right);
  // a painted band (wainscot) along the walls, 5 cm proud
  const fr = frizTex({ ground: '#e8dcbc', a: '#e0b050', b: '#7ab8d8', c: '#c8503a' });
  for (const [x, z, ry, w] of [[0, -3.6, 0, 9], [3.95, 0, -Math.PI / 2, 9]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, .5), painted(fr.clone())); m.material.map.repeat.set(w / 2, 1); m.material.map.needsUpdate = true; m.position.set(x, .45, z); m.rotation.y = ry; m.translateZ(.05); g.add(m); }
  // the globe on a wooden stand, with a brass horizon ring
  const stand = painted(woodTex({ base: '#7a4a2a' }));
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2, leg = new THREE.Mesh(new THREE.CylinderGeometry(.025, .03, .7, 8), stand); leg.position.set(GLOBE.x + Math.cos(a) * .22, .35, GLOBE.z + Math.sin(a) * .22); leg.rotation.set(Math.sin(a) * .2, 0, -Math.cos(a) * .2); g.add(leg); }
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, .14, 16), stand); ped.position.set(GLOBE.x, .72, GLOBE.z); g.add(ped);
  const horizon = new THREE.Mesh(new THREE.TorusGeometry(GR + .05, .016, 8, 96), flat('#d9a441')); horizon.rotation.x = Math.PI / 2; horizon.position.copy(GLOBE); horizon.userData.noShadow = true; g.add(horizon);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, GLOBE.y - GR - .7, 8), flat('#d9a441')); post.position.set(GLOBE.x, (.78 + GLOBE.y - GR) / 2, GLOBE.z); g.add(post);
  // globe: tilted axis; spin group inside (rotation.y = -90° - the longitude that faces +z)
  const tilt = new THREE.Group(); tilt.position.copy(GLOBE); tilt.rotation.z = -16 * DEG; g.add(tilt);
  const spin = new THREE.Group(); tilt.add(spin); dyn.spin = spin; dyn.tilt = tilt;
  const gt = canvasTex(4096, 2048, (c, w, h) => drawMap(c, 0, 0, w, h, { lw: 6, grid: 0 }));
  const earth = new THREE.Mesh(new THREE.SphereGeometry(GR, 96, 64), new THREE.MeshLambertMaterial({ map: gt, emissive: '#ffffff', emissiveMap: gt, emissiveIntensity: .42 })); spin.add(earth);
  // meridian overlay: redrawn when the count changes
  const mt = canvasTex(4096, 2048, () => {});
  const over = new THREE.Mesh(new THREE.SphereGeometry(GR * 1.004, 96, 64), new THREE.MeshBasicMaterial({ map: mt, transparent: true, depthWrite: false }));
  over.layers.set(1); spin.add(over); dyn.mer = { t: mt, n: -1 };
  // the zero meridian: a glowing red half ring that can slide around the globe
  const zr = new THREE.Group(); spin.add(zr); dyn.zero = zr;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(GR * 1.012, .0065, 8, 96, Math.PI), new THREE.MeshBasicMaterial({ color: HDR(2.6, .5, .45) }));
  ring.rotation.z = -Math.PI / 2; ring.layers.set(1); zr.add(ring);
  // pins: Greenwich, Istanbul
  dyn.pins = {};
  for (const [k, lon, lat] of [['gr', GREEN_LON, 51.5], ['ist', IST_LON, 41]]) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(.014, 12, 10), flat(k === 'gr' ? '#ffd84a' : '#ffd84a')); p.position.copy(lonDir(lon, lat).multiplyScalar(GR * 1.01)); spin.add(p); dyn.pins[k] = p;
  }
  dyn.grTag = tag(scene, 'GREENWICH', .055); dyn.istTag = tag(scene, 'ISTANBUL', .055);
  // satellites (the GPS beat): two little craft orbiting, a thin line from each to the Earth's centre
  dyn.sats = [];
  for (let k = 0; k < 2; k++) {
    const s = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(.05, .04, .04), flat('#e0b050')); s.add(body);
    for (const sx of [-1, 1]) { const pn = new THREE.Mesh(new THREE.BoxGeometry(.09, .004, .035), flat('#3a6ae0')); pn.position.x = sx * .075; s.add(pn); }
    const lineM = new THREE.Mesh(new THREE.CylinderGeometry(.0025, .0025, 1, 6), new THREE.MeshBasicMaterial({ color: HDR(.6, 1.6, 2.0), transparent: true, opacity: .9 })); lineM.layers.set(1);
    s.visible = false; lineM.visible = false; s.traverse(o => o.userData.noShadow = true); g.add(s); scene.add(lineM);
    dyn.sats.push({ s, line: lineM, k });
  }
  dyn.centre = new THREE.Mesh(new THREE.SphereGeometry(.018, 12, 10), new THREE.MeshBasicMaterial({ color: HDR(.8, 1.8, 2.2), depthTest: false })); dyn.centre.renderOrder = 25; dyn.centre.layers.set(1); dyn.centre.position.copy(GLOBE); dyn.centre.visible = false; scene.add(dyn.centre);
  // desk + orrery (its sun is the key light of the room)
  const deskM = painted(woodTex({ base: '#8a5634' }));
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.5, .07, .8), deskM); desk.position.set(1.5, .76, -1.7); g.add(desk);
  for (const [dx, dz] of [[-.68, -.34], [.68, -.34], [-.68, .34], [.68, .34]]) { const lg = new THREE.Mesh(new THREE.BoxGeometry(.06, .73, .06), deskM); lg.position.set(1.5 + dx, .365, -1.7 + dz); g.add(lg); }
  const brass = flat('#d9a441');
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.11, .14, .05, 24), flat('#b8863a')); base.position.set(ORR.x, .82, ORR.z); g.add(base);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, ORR.y - .82, 8), brass); col.position.set(ORR.x, (ORR.y + .82) / 2, ORR.z); g.add(col);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(.05, 24, 16), new THREE.MeshBasicMaterial({ color: HDR(2.2, 1.6, .65) })); sun.position.copy(ORR); sun.userData.noShadow = true; g.add(sun);
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(.3, .0035, 6, 96), brass); orbit.rotation.x = Math.PI / 2; orbit.position.copy(ORR); orbit.userData.noShadow = true; g.add(orbit);
  const arm = new THREE.Group(); arm.position.copy(ORR); g.add(arm); dyn.orrArm = arm;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .3, 6), brass); rod.rotation.z = Math.PI / 2; rod.position.x = .15; rod.userData.noShadow = true; arm.add(rod);
  const mini = new THREE.Mesh(new THREE.SphereGeometry(.03, 24, 16), painted(canvasTex(512, 256, (c, w, h) => drawMap(c, 0, 0, w, h, { lw: 2 })))); mini.position.x = .3; arm.add(mini); dyn.mini = mini;
  // the calendar flag on the orbit: a pin with a small card, text changes JAN 1 -> MAR 25
  const flag = new THREE.Group(); g.add(flag); dyn.flag = flag;
  const fpost = new THREE.Mesh(new THREE.CylinderGeometry(.003, .003, .14, 6), flat('#3a2a30')); fpost.position.y = .07; flag.add(fpost);
  dyn.flagTex = canvasTex(512, 256, () => {}); dyn.flagText = '';
  const fc = new THREE.Mesh(new THREE.PlaneGeometry(.12, .06), new THREE.MeshBasicMaterial({ map: dyn.flagTex, side: THREE.DoubleSide })); fc.position.set(.06, .11, 0); flag.add(fc); flag.card = fc;
  const FA = -112 * DEG; flag.position.set(ORR.x + Math.cos(FA) * .3, ORR.y, ORR.z - Math.sin(FA) * .3); dyn.flagHome = flag.position.clone();
  // a desk lamp with a green shade (a second, small warm source near the globe)
  const lb = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .02, 16), brass); lb.position.set(2.05, .81, -1.85); g.add(lb);
  const ls = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .3, 8), brass); ls.position.set(2.05, .95, -1.85); g.add(ls);
  const shadeM = new THREE.Mesh(new THREE.CylinderGeometry(.05, .12, .1, 20, 1, true), flat('#2f8a5a', { side: THREE.DoubleSide })); shadeM.position.set(2.05, 1.12, -1.85); g.add(shadeM);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 10), new THREE.MeshBasicMaterial({ color: HDR(3, 2.4, 1.2) })); bulb.position.set(2.05, 1.08, -1.85); bulb.userData.noShadow = true; g.add(bulb);
  // a few books and a quill on the desk
  for (const [x, z, c, h] of [[.95, -1.9, '#c8423c', .05], [.96, -1.9, '#3a6ab8', .04]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.24, h, .17), flat(c)); b.position.set(x, .795 + (c === '#3a6ab8' ? .05 : 0) + h / 2 - .02, z); b.rotation.y = c === '#3a6ab8' ? .2 : 0; g.add(b); }
  // light: the orrery's sun (warm key, shadows), moonlight through the window (cool), a blue night fill
  const L = new THREE.Group();
  L.add(new THREE.HemisphereLight('#8a96ee', '#4a3a6a', 1.6));
  // the orrery's sun lights the desk close by; the room's key comes from the same warm corner (desk lamp + orrery), a bit higher
  const key = new THREE.PointLight('#ffc070', 3.2, 0, .6); key.position.set(1.7, 1.75, -1.2); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.near = .08; key.shadow.camera.far = 14; key.shadow.bias = -.002; key.shadow.normalBias = .04; key.shadow.radius = 4; L.add(key);
  const lampL = new THREE.PointLight('#ffd08a', 1.2, 2.5, 1.5); lampL.position.set(2.05, 1.0, -1.85); L.add(lampL);
  const moon = keySpot('#a3b8ff', 2.6, [-9, 4.2, 1.0], [0, 0, -1.0], .32, { near: 3, far: 20 }); L.add(moon); L.add(moon.target);
  scene.add(L); sets.study = { g, L };
  shadows(g);
  dyn.sBeamS = beam(scene, [-4.1, 2.2, 0], [-1.2, 0, -.6], { r0: .6, r1: 1.0, color: '#a9bcff', strength: .13 });
  dyn.sunGlow = glow(scene, ORR.toArray(), '#ffb050', .22, .3);
}
function drawMeridians(n) {
  const M = dyn.mer; if (M.n === n) return; M.n = n;
  const g = M.t.g, w = 4096, h = 2048; g.clearRect(0, 0, w, h);
  g.strokeStyle = D('#24204a', .8); g.lineWidth = 5;
  for (let i = 0; i < n; i++) { const lon = -180 + i * 10; const x = (lon + 180) / 360 * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  if (n > 0) { g.lineWidth = 5; for (let la = -60; la <= 60; la += 30) { const y = (90 - la) / 180 * h; g.globalAlpha = la === 0 ? 1 : .5; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.globalAlpha = 1; }
  M.t.needsUpdate = true;
}
function drawFlag(text) {
  if (dyn.flagText === text) return; dyn.flagText = text;
  const g = dyn.flagTex.g; g.clearRect(0, 0, 512, 256);
  g.fillStyle = D('#fbf3df'); g.strokeStyle = PLUM; g.lineWidth = 16; g.beginPath(); g.roundRect(8, 8, 496, 240, 26); g.fill(); g.stroke();
  g.fillStyle = D('#d8343c'); g.fillRect(8, 8, 496, 50); g.strokeRect(8, 8, 496, 50);
  g.fillStyle = PLUM; g.font = `900 132px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 160);
  dyn.flagTex.needsUpdate = true;
}

// ---------------------------------------------------------------- SEA (x = 200)
function skyDome(g, x, top, bottom, { stars = 0, moon = null, clouds = 0, r = 70 } = {}) {
  const t = canvasTex(2048, 1024, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h * .5); gr.addColorStop(0, D(top)); gr.addColorStop(1, D(bottom)); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    const R = rng(12);
    for (let i = 0; i < stars; i++) { c.fillStyle = `rgba(255,250,230,${.4 + R() * .6})`; c.beginPath(); c.arc(R() * w, R() * h * .42, .8 + R() * 1.8, 0, 6.29); c.fill(); }
    for (let i = 0; i < clouds; i++) { const cx = R() * w, cy = h * (.18 + R() * .22), s = 30 + R() * 50; c.fillStyle = D('#ffffff', .9); for (let k = 0; k < 5; k++) { c.beginPath(); c.ellipse(cx + (k - 2) * s * .8, cy - Math.sin(k / 4 * Math.PI) * s * .5, s, s * .6, 0, 0, 6.29); c.fill(); } c.fillStyle = D('#c8d4f0', .8); c.fillRect(cx - s * 2.4, cy + s * .2, s * 4.8, s * .28); }
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 24), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, depthWrite: false })); m.position.x = x; m.renderOrder = -10; g.add(m);
  return m;
}
const CHART_C = V(199.25, .93, .85);
function buildSea(scene) {
  const g = new THREE.Group(); g.position.x = 200; scene.add(g);
  skyDome(g, 0, '#141a48', '#3a4a98', { stars: 700 });
  const moonM = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), new THREE.MeshBasicMaterial({ color: HDR(1.25, 1.3, 1.45) })); moonM.position.set(-26, 22, -50); moonM.lookAt(0, 1.5, 0); g.add(moonM);
  // the sea: painted water, with a moon path
  const wt = canvasTex(2048, 2048, (c, w, h) => {
    c.fillStyle = D('#1c2c6a'); c.fillRect(0, 0, w, h); const R = rng(3);
    for (let i = 0; i < 2600; i++) { const x = R() * w, y = R() * h, l = 20 + R() * 60; c.strokeStyle = D(R() < .5 ? '#2e4890' : '#4a68b8', .7); c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + l / 2, y - 6, x + l, y); c.stroke(); }
  });
  wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(10, 10);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshBasicMaterial({ map: wt })); sea.rotation.x = -Math.PI / 2; sea.position.y = -1.3; g.add(sea);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(6, 60), new THREE.MeshBasicMaterial({ map: canvasTex(64, 512, (c, w, h) => { for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(220,226,255,${.25 + Math.random() * .4})`; c.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 20, 3); } }), transparent: true, depthWrite: false }));
  path.rotation.x = -Math.PI / 2; path.rotation.z = Math.atan2(-26, -50) + Math.PI; path.position.set(-12, -1.28, -26); g.add(path);
  // the deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(5.2, .2, 14), painted(woodTex({ base: '#a8743e', plank: 40, rep: [3, 6] }))); deck.position.set(0, -.1, -1); g.add(deck);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.2, 14.2), painted(woodTex({ base: '#5a3a5a', plank: 64, rep: [2, 1] }))); hull.position.set(0, -.8, -1); g.add(hull);
  const railM = painted(woodTex({ base: '#7a4a2a' }));
  for (const sx of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(.1, .08, 14), railM); r.position.set(sx * 2.55, .95, -1); g.add(r);
    for (let z = -7.5; z <= 5.5; z += .7) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .9, 6), railM); b.position.set(sx * 2.55, .47, z); g.add(b); }
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.13, .16, 14, 12), painted(woodTex({ base: '#8a5a32', vertical: true }))); mast.position.set(.7, 7, -1.6); g.add(mast);
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 5, 8), railM); yard.rotation.z = Math.PI / 2; yard.position.set(.7, 5.2, -1.6); g.add(yard);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.6, 8, 8), flat('#efe6d2', { side: THREE.DoubleSide, emissive: '#4a4468' }));
  const sp = sail.geometry.attributes.position; for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i); sp.setZ(i, .5 * Math.cos(x / 4.6 * Math.PI) * (1 - Math.abs(y) / 3.6 * .4)); } sail.geometry.computeVertexNormals();
  sail.position.set(.7, 3.3, -1.45); g.add(sail);
  for (const [a, b] of [[[.7, 6.8, -1.6], [2.5, .95, 3]], [[.7, 6.8, -1.6], [-2.5, .95, 3]], [[.7, 6.8, -1.6], [2.5, .95, -6]]]) {
    const p0 = V(...a), p1 = V(...b), len = p0.distanceTo(p1), r = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, len, 4), flat('#3a2a28'));
    r.position.copy(p0).lerp(p1, .5); r.quaternion.setFromUnitVectors(V(0, 1, 0), p1.clone().sub(p0).normalize()); r.userData.noShadow = true; g.add(r);
  }
  // barrels and a coil of rope
  for (const [x, z] of [[1.9, -3.2], [1.6, -3.9]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .7, 16), painted(woodTex({ base: '#9a6438', vertical: true }))); b.position.set(x, .35, z); g.add(b); for (const y of [.15, .55]) { const hb = new THREE.Mesh(new THREE.TorusGeometry(.285, .015, 6, 24), flat('#4a4458')); hb.rotation.x = Math.PI / 2; hb.position.set(x, y, z); g.add(hb); } }
  const coil = new THREE.Mesh(new THREE.TorusGeometry(.22, .06, 8, 24), flat('#c8a060')); coil.rotation.x = Math.PI / 2; coil.position.set(-1.6, .06, 1.6); g.add(coil);
  // the chart table with the chart (unlit paper)
  const tab = new THREE.Mesh(new THREE.BoxGeometry(1.2, .08, .8), railM); tab.position.set(-.75, .88, .85); g.add(tab);
  for (const [dx, dz] of [[-.55, -.35], [.55, -.35], [-.55, .35], [.55, .35]]) { const lg = new THREE.Mesh(new THREE.BoxGeometry(.06, .84, .06), railM); lg.position.set(-.75 + dx, .42, .85 + dz); g.add(lg); }
  const ct = canvasTex(2048, 1400, (c, w, h) => {
    c.fillStyle = D('#f2e4c0'); c.fillRect(0, 0, w, h);
    const m = drawMap(c, 90, 90, w - 180, h - 180, { l0: -30, l1: 40, b0: 28, b1: 66, sea: D('#cfe0e8'), land: D('#e8d29a'), coast: D('#5a3a2a'), lw: 5, ice: false, grid: 10, gridC: D('#8a6a4a', .6) });
    c.strokeStyle = D('#5a3a2a'); c.lineWidth = 8; c.strokeRect(90, 90, w - 180, h - 180);
    c.strokeStyle = D('#d8343c'); c.lineWidth = 12; c.beginPath(); c.moveTo(m.X(0), 90); c.lineTo(m.X(0), h - 90); c.stroke();
    c.fillStyle = D('#d8343c'); c.font = `900 70px ${FONT}`; c.textAlign = 'left'; c.fillText('0°', m.X(0) + 20, 180); c.font = `900 46px ${FONT}`; c.fillText('GREENWICH', m.X(0) + 20, 240);
    c.fillStyle = D('#5a3a2a'); c.font = `900 40px ${FONT}`; c.textAlign = 'center'; for (let lo = -20; lo <= 30; lo += 10) if (lo) c.fillText(`${Math.abs(lo)}°${lo < 0 ? 'W' : 'E'}`, m.X(lo), 80);
    // a compass rose
    const cx = 330, cy = h - 330; c.strokeStyle = D('#5a3a2a'); c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, 120, 0, 6.29); c.stroke();
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283, r = k % 2 ? 80 : 150; c.fillStyle = k % 2 ? D('#e8d29a') : D('#d8343c'); c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a - .18) * 30, cy + Math.sin(a - .18) * 30); c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); c.lineTo(cx + Math.cos(a + .18) * 30, cy + Math.sin(a + .18) * 30); c.closePath(); c.fill(); c.stroke(); }
  });
  const chart = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .68), new THREE.MeshBasicMaterial({ map: ct })); chart.rotation.x = -Math.PI / 2; chart.rotation.z = .06; chart.position.set(-.75, .925, .85); g.add(chart);
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .68), new THREE.ShadowMaterial({ color: '#2a2040', opacity: .35 })); catcher.rotation.copy(chart.rotation); catcher.position.set(-.75, .927, .85); catcher.receiveShadow = true; g.add(catcher);
  const div = new THREE.Group(); for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.004, .002, .2, 6), flat('#c8ccd8')); l.position.set(s * .03, .0, 0); l.rotation.z = s * .3; div.add(l); } div.position.set(-.55, 1.0, .75); div.rotation.x = -1.2; g.add(div);
  // the ship's lantern on the mast: the key
  const lan = new THREE.Group(); lan.position.set(.4, 2.05, -1.25); g.add(lan);
  const lframe = flat('#2a2630');
  for (const [x, z] of [[-.07, -.07], [.07, -.07], [-.07, .07], [.07, .07]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.014, .26, .014), lframe); p.position.set(x, 0, z); lan.add(p); }
  for (const y of [-.14, .14]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.18, .03, .18), lframe); p.position.y = y; lan.add(p); }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(.12, .1, 4), lframe); roof.position.y = .2; roof.rotation.y = Math.PI / 4; lan.add(roof);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(.13, .24, .13), new THREE.MeshBasicMaterial({ color: HDR(2.8, 1.8, .7) })); glass.userData.noShadow = true; lan.add(glass);
  lan.traverse(o => { o.userData.noShadow = true; });
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(.32, .03, .03), lframe); bracket.position.set(.55, 2.35, -1.4); g.add(bracket);
  dyn.lanGlass = glass;
  // the other ships out at sea: hulls, masts, sails and one light each
  dyn.fleet = [];
  const R = rng(9);
  for (let i = 0; i < 7; i++) {
    const sg = new THREE.Group(); const d = 22 + i * 9, a = -1.15 + i * .36;
    sg.position.set(Math.sin(a) * d, -1.3, -Math.cos(a) * d - 4); sg.rotation.y = R() * 3; g.add(sg);
    const h = new THREE.Mesh(new THREE.BoxGeometry(1.2, .9, 4.2), flat('#3a3a6a')); h.position.y = .3; sg.add(h);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 4.6, 6), flat('#4a3a48')); m.position.y = 2.6; sg.add(m);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), flat('#cfd0e8', { side: THREE.DoubleSide })); s.position.y = 2.6; s.rotation.y = Math.PI / 2; sg.add(s);
    const l = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), new THREE.MeshBasicMaterial({ color: HDR(3.0, 2.0, .8) })); l.position.set(0, 1.1, 1.9); sg.add(l);
    sg.traverse(o => o.userData.noShadow = true); dyn.fleet.push(sg);
  }
  const L = new THREE.Group();
  L.add(new THREE.HemisphereLight('#7a88e8', '#3a3266', 1.5));
  const key = new THREE.PointLight('#ffb060', 6.5, 0, 1.15); key.position.set(200.4, 2.0, -1.1); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.near = .12; key.shadow.camera.far = 20; key.shadow.bias = -.002; key.shadow.normalBias = .04; key.shadow.radius = 4; L.add(key);
  dyn.seaKey = key;
  const moon = keySpot('#9fb4ff', 2.2, [174, 22, -50], [200, 0, 0], .25, { near: 20, far: 90 }); L.add(moon); L.add(moon.target);
  scene.add(L); sets.sea = { g, L };
  shadows(g);
  dyn.lanGlow = glow(scene, [200.4, 2.05, -1.25], '#ffb060', .8, .45);
}

// ---------------------------------------------------------------- HALL (x = 300), Washington 1884
const CH_P = V(298.2, 3.55, -.3);
function buildHall(scene) {
  const g = new THREE.Group(); g.position.x = 300; scene.add(g);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), painted(carpetTex({ base: '#8a2a3a', band: '#e0b050', rows: 3, rep: [2, 2] }))); fl.rotation.x = -Math.PI / 2; g.add(fl);
  const paper = painted(ciniTex({ kind: 'lale', ground: '#2f6a5a', a: '#5aa88a', b: '#e0c070', c: '#3f8a70', ink: '#1a3a30', rep: [8, 3] }));
  const wallB = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.6), paper); wallB.position.set(0, 2.3, -4.5); g.add(wallB);
  const wallR = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.6), paper.clone()); wallR.position.set(5, 2.3, 0); wallR.rotation.y = -Math.PI / 2; g.add(wallR);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), flat('#e8dcc0')); ceil.rotation.x = Math.PI / 2; ceil.position.y = 4.6; g.add(ceil);
  // wood panelling below, with a rail (proud of the paper)
  const pan = painted(woodTex({ base: '#7a4428', plank: 128, rep: [6, 1], vertical: true }));
  const dado = new THREE.Mesh(new THREE.BoxGeometry(12, 1.1, .08), pan); dado.position.set(0, .55, -4.42); g.add(dado);
  const dadoR = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.1, 12), pan); dadoR.position.set(4.92, .55, 0); g.add(dadoR);
  for (const [w, d, x, z] of [[12, .14, 0, -4.36], [.14, 12, 4.86, 0]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(w, .08, d), flat('#d9a441')); r.position.set(x, 1.12, z); g.add(r); }
  // the big world map on the back wall, with the red zero line
  const mt = canvasTex(3072, 1536, (c, w, h) => {
    c.fillStyle = D('#f2e4c0'); c.fillRect(0, 0, w, h);
    const m = drawMap(c, 60, 60, w - 120, h - 120, { sea: D('#a8c8e0'), land: D('#e8cc8a'), coast: D('#5a3a2a'), lw: 6, grid: 15, gridC: D('#5a6a8a', .45) });
    c.strokeStyle = D('#5a3a2a'); c.lineWidth = 12; c.strokeRect(60, 60, w - 120, h - 120);
    c.strokeStyle = D('#d8343c'); c.lineWidth = 16; c.beginPath(); c.moveTo(m.X(0), 60); c.lineTo(m.X(0), h - 60); c.stroke();
  });
  const map = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), new THREE.MeshLambertMaterial({ map: mt })); map.position.set(0, 2.75, -4.38); g.add(map);
  const mframe = flat('#b8863a');
  for (const [w, h, x, y] of [[4.36, .08, 0, 3.84], [4.36, .08, 0, 1.66], [.08, 2.26, -2.14, 2.75], [.08, 2.26, 2.14, 2.75]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .06), mframe); b.position.set(x, y, -4.36); g.add(b); }
  dyn.mapGlow = new THREE.Mesh(new THREE.PlaneGeometry(.035, 2.0), new THREE.MeshBasicMaterial({ color: HDR(2.4, .5, .45), transparent: true, opacity: 0 })); dyn.mapGlow.position.set(300 + (0 + 180) / 360 * (4.2 * (3072 - 120) / 3072) - 4.2 * (3072 - 120) / 3072 / 2, 2.75, -4.33); dyn.mapGlow.layers.set(1); scene.add(dyn.mapGlow);
  // banner: WASHINGTON 1884
  const bt = canvasTex(1024, 256, (c, w, h) => { c.fillStyle = D('#24305e'); c.fillRect(0, 0, w, h); c.strokeStyle = D('#e0b050'); c.lineWidth = 14; c.strokeRect(14, 14, w - 28, h - 28); c.fillStyle = D('#f6ecd0'); c.font = `900 96px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('WASHINGTON 1884', w / 2, h / 2 + 6); });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .6), new THREE.MeshBasicMaterial({ map: bt })); banner.position.set(0, 4.2, -4.4); g.add(banner);
  // tall windows on the right wall: blue night (the cool half)
  for (const z of [-2.6, 1.0]) {
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.4), new THREE.MeshBasicMaterial({ color: HDR(.32, .46, 1.05) })); gl.position.set(4.86, 2.5, z); gl.rotation.y = -Math.PI / 2; g.add(gl);
    for (const [w, h, y, dz] of [[1.3, .1, 3.75, 0], [1.3, .1, 1.25, 0], [.1, 2.6, 2.5, -.6], [.1, 2.6, 2.5, .6], [.05, 2.4, 2.5, 0], [1.2, .05, 2.5, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.12, h, w), flat('#e8dcc0')); b.position.set(4.82, y, z + dz); b.userData.noShadow = w < .1 || h < .1; g.add(b); }
    for (const s of [-1, 1]) { const cu = new THREE.Mesh(new THREE.BoxGeometry(.1, 3.0, .35), flat('#a8323a')); cu.position.set(4.78, 2.6, z + s * .82); g.add(cu); }
  }
  // the long table (green baize) and chairs
  const table = new THREE.Mesh(new THREE.BoxGeometry(5.6, .08, 1.2), flat('#2f7a4a')); table.position.set(0, .82, -1.6); g.add(table);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(5.6, .5, 1.22), painted(woodTex({ base: '#6a3a22', rep: [3, 1] }))); skirt.position.set(0, .54, -1.6); g.add(skirt);
  for (let k = 0; k < 6; k++) { const pp = new THREE.Mesh(new THREE.BoxGeometry(.32, .04, .22), flat('#f2ead8')); pp.position.set(-2.2 + k * .88, .87, -1.35); pp.rotation.y = (k % 3 - 1) * .15; g.add(pp); }
  for (let k = 0; k < 3; k++) { const ink = new THREE.Mesh(new THREE.CylinderGeometry(.04, .045, .07, 12), flat('#2a2236')); ink.position.set(-1.7 + k * 1.7, .9, -1.2); g.add(ink); }
  // the gas chandelier: brass ring, six glass globes (brighter than white), the key light
  const brass = flat('#d9a441', { emissive: '#4a3008' });
  const crown = new THREE.Mesh(new THREE.TorusGeometry(.55, .03, 8, 48), brass); crown.rotation.x = Math.PI / 2; crown.position.set(CH_P.x - 300, CH_P.y, CH_P.z); g.add(crown);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.1, 8), brass); stem.position.set(CH_P.x - 300, CH_P.y + .55, CH_P.z); g.add(stem);
  const globeM = new THREE.MeshBasicMaterial({ color: HDR(2.7, 2.0, 1.0) });
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, gb = new THREE.Mesh(new THREE.SphereGeometry(.09, 14, 10), globeM); gb.position.set(CH_P.x - 300 + Math.cos(a) * .55, CH_P.y + .12, CH_P.z + Math.sin(a) * .55); gb.userData.noShadow = true; g.add(gb); }
  crown.userData.noShadow = true; stem.userData.noShadow = true;
  const L = new THREE.Group();
  L.add(new THREE.HemisphereLight('#8a94e8', '#5a3a5a', 1.5));
  const key = new THREE.PointLight('#ffc27a', 9, 0, 1.1); key.position.set(CH_P.x, CH_P.y - .05, CH_P.z + .2); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.near = .2; key.shadow.camera.far = 16; key.shadow.bias = -.002; key.shadow.normalBias = .04; key.shadow.radius = 4; L.add(key);
  const win = keySpot('#9fb4ff', 1.8, [309, 4.0, -.8], [300, 0, -1.6], .5, { near: 3, far: 20 }); L.add(win); L.add(win.target);
  scene.add(L); sets.hall = { g, L };
  shadows(g);
  dyn.chGlow = glow(scene, [CH_P.x, CH_P.y + .1, CH_P.z], '#ffc070', 1.0, .25);
}

// ---------------------------------------------------------------- GREENWICH (x = 400): courtyard, telescope, park
const PLUMB = V(397.25, 1.1, -2.1);     // where the plumb line hangs from
const TRUE_X = 414;                         // the real zero (stands in for ~100 m east)
function buildGreen(scene) {
  const g = new THREE.Group(); g.position.x = 400; scene.add(g);
  skyDome(g, 6, '#4f8ae8', '#bcd8f6', { clouds: 18, r: 80 });
  const cob = new THREE.Mesh(new THREE.PlaneGeometry(14, 22), painted(stoneTex({ base: '#c8c0b4', bw: 48, bh: 32, rep: [7, 11] }))); cob.rotation.x = -Math.PI / 2; cob.position.set(-1, 0, 2); g.add(cob);
  // the brass line between two granite strips
  const gran = flat('#8a8aa0');
  for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.BoxGeometry(.16, .02, 13), gran); s.position.set(sx * .12, .01, 1.6); g.add(s); }
  const lineM = new THREE.Mesh(new THREE.BoxGeometry(.07, .024, 13), flat('#f0c050', { emissive: '#4a3208' })); lineM.position.set(0, .012, 1.6); g.add(lineM);
  for (let z = -4; z <= 7; z += 1.2) { const tick = new THREE.Mesh(new THREE.BoxGeometry(.2, .026, .02), flat('#f0c050')); tick.position.set(0, .013, z); tick.userData.noShadow = true; g.add(tick); }
  // the old building: brick, white windows; the observatory dome on top
  const brick = painted(stoneTex({ base: '#b8583e', seam: '#ecd8c8', bw: 40, bh: 16, rep: [6, 3] }));
  const bld = new THREE.Mesh(new THREE.BoxGeometry(12, 5.2, 3), brick); bld.position.set(-1, 2.6, -6.4); g.add(bld);
  const winT = canvasTex(256, 384, (c, w, h) => { c.fillStyle = D('#f2ece0'); c.fillRect(0, 0, w, h); c.fillStyle = D('#5a7ab0'); c.fillRect(24, 24, w - 48, h - 48); c.fillStyle = D('#8aa8d8'); c.fillRect(24, 24, (w - 48) / 2, (h - 48) * .4); c.strokeStyle = D('#f2ece0'); c.lineWidth = 12; for (const x of [w / 2]) { c.beginPath(); c.moveTo(x, 24); c.lineTo(x, h - 24); c.stroke(); } for (const y of [h / 3, 2 * h / 3]) { c.beginPath(); c.moveTo(24, y); c.lineTo(w - 24, y); c.stroke(); } c.strokeStyle = D('#3a2a2a'); c.lineWidth = 5; c.strokeRect(24, 24, w - 48, h - 48); });
  for (const x of [-5.5, -3.5, -1.5, 2.0, 4.0]) for (const y of [1.5, 3.7]) { const wm = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.35), flat('#ffffff', { map: winT })); wm.position.set(x, y, -4.88); g.add(wm); const sill = new THREE.Mesh(new THREE.BoxGeometry(1.05, .08, .14), flat('#f2ece0')); sill.position.set(x, y - .72, -4.84); g.add(sill); }
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(12.3, .25, 3.3), flat('#f2ece0')); cornice.position.set(-1, 5.25, -6.4); g.add(cornice);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.1, 32), brick); drum.position.set(2.5, 5.9, -6.6); g.add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), flat('#5aa898')); dome.position.set(2.5, 6.45, -6.6); g.add(dome);
  const slit = new THREE.Mesh(new THREE.BoxGeometry(.4, .06, 1.7), flat('#2a3a4a')); slit.position.set(2.5, 7.25, -5.95); slit.rotation.x = .55; g.add(slit);
  // the plaque where the line meets the wall
  const pt = canvasTex(1024, 384, (c, w, h) => { c.fillStyle = D('#2a3a5a'); c.fillRect(0, 0, w, h); c.strokeStyle = D('#e0b050'); c.lineWidth = 14; c.strokeRect(16, 16, w - 32, h - 32); c.fillStyle = D('#f6ecd0'); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 84px ${FONT}`; c.fillText('PRIME MERIDIAN', w / 2, h * .38); c.font = `900 110px ${FONT}`; c.fillText('0°', w / 2, h * .7); });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .56), new THREE.MeshBasicMaterial({ map: pt })); plaque.position.set(0, 2.5, -4.86); g.add(plaque);
  // the transit telescope on its stone pier, a bracket with the plumb line
  const pierM = painted(stoneTex({ base: '#d8d0c0', bw: 64, bh: 32 }));
  const pier = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.15, .6), pierM); pier.position.set(-2.75, .575, -2.5); g.add(pier);
  const yoke = flat('#4a4a6a');
  for (const sx of [-1, 1]) { const y = new THREE.Mesh(new THREE.BoxGeometry(.06, .5, .12), yoke); y.position.set(-2.75 + sx * .28, 1.4, -2.5); g.add(y); }
  const tube = new THREE.Group(); tube.position.set(-2.75, 1.58, -2.5); tube.rotation.z = Math.PI / 2; tube.rotation.y = .9; g.add(tube);
  const tb = new THREE.Mesh(new THREE.CylinderGeometry(.1, .085, 1.7, 20), flat('#3a5a9a')); tb.rotation.x = Math.PI / 2; tube.add(tb);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .62, 10), flat('#d9a441')); tube.add(axle);
  for (const z of [-.85, .85]) { const rng2 = new THREE.Mesh(new THREE.TorusGeometry(.1, .02, 6, 20), flat('#d9a441')); rng2.position.z = z; tube.add(rng2); }
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.04, .04, .14), yoke); arm.position.set(PLUMB.x - 400, PLUMB.y + .02, PLUMB.z - .05); g.add(arm);
  const plumb = new THREE.Group(); plumb.position.set(PLUMB.x - 400, PLUMB.y, PLUMB.z); g.add(plumb); dyn.plumb = plumb;
  const str = new THREE.Mesh(new THREE.CylinderGeometry(.007, .007, .6, 5), flat('#f2ead8')); str.position.y = -.3; str.userData.noShadow = true; plumb.add(str);
  const bob = new THREE.Mesh(new THREE.ConeGeometry(.04, .1, 16), flat('#e0a83c', { emissive: '#3a2808' })); bob.rotation.x = Math.PI; bob.position.y = -.64; plumb.add(bob);
  // the true vertical: a dashed card beside the plumb line (shown on "crooked")
  const dash = canvasTex(64, 512, (c, w, h) => { c.fillStyle = '#fff'; for (let y = 0; y < h; y += 64) c.fillRect(16, y, 32, 38); });
  dyn.trueV = new THREE.Mesh(new THREE.PlaneGeometry(.022, .8), new THREE.MeshBasicMaterial({ map: dash, color: HDR(.6, 1.5, 1.9), transparent: true, depthTest: false })); dyn.trueV.position.set(PLUMB.x, PLUMB.y - .38, PLUMB.z + .02); dyn.trueV.layers.set(1); dyn.trueV.renderOrder = 22; dyn.trueV.visible = false; scene.add(dyn.trueV);
  // a low wall and railing between courtyard and park
  const wallM = painted(stoneTex({ base: '#d8ccb8', bw: 64, bh: 32, rep: [6, 1] }));
  const lw = new THREE.Mesh(new THREE.BoxGeometry(.4, .7, 14), wallM); lw.position.set(6.2, .35, 1); g.add(lw);
  for (let z = -5.8; z <= 7.8; z += .45) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .6, 5), flat('#2a3040')); r.position.set(6.2, 1.0, z); r.userData.noShadow = true; g.add(r); }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, 14), flat('#2a3040')); rail.position.set(6.2, 1.3, 1); g.add(rail);
  // the park: mowed stripes, a path running east, trees, the real zero line and its little sign
  const grass = canvasTex(1024, 1024, (c, w, h) => { for (let k = 0; k < 8; k++) { c.fillStyle = D(k % 2 ? '#6ab84e' : '#7cc85a'); c.fillRect(k * w / 8, 0, w / 8, h); } const R = rng(5); for (let i = 0; i < 3000; i++) { c.fillStyle = D(R() < .5 ? '#5aa042' : '#8ad466', .6); c.fillRect(R() * w, R() * h, 3, 9); } });
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.repeat.set(3, 3);
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(24, 30), painted(grass)); gr.rotation.x = -Math.PI / 2; gr.position.set(18.4, .002, 1); g.add(gr);
  const pathM = new THREE.Mesh(new THREE.PlaneGeometry(24, 1.8), painted(stoneTex({ base: '#e2d4b4', bw: 256, bh: 128, rep: [8, 1] }))); pathM.rotation.x = -Math.PI / 2; pathM.position.set(18.4, .006, 1.2); g.add(pathM);
  const dash2 = canvasTex(512, 64, (c, w, h) => { c.fillStyle = '#fff'; for (let x = 0; x < w; x += 64) c.fillRect(x, 8, 40, 48); });
  dash2.wrapS = THREE.RepeatWrapping; dash2.repeat.set(12, 1);
  const tl = new THREE.Mesh(new THREE.PlaneGeometry(14, .12), new THREE.MeshBasicMaterial({ map: dash2, transparent: true, color: '#fff8e8' })); tl.rotation.x = -Math.PI / 2; tl.rotation.z = Math.PI / 2; tl.position.set(TRUE_X - 400, .012, 1); g.add(tl);
  const st = canvasTex(512, 256, (c, w, h) => { c.fillStyle = D('#fbf3df'); c.fillRect(0, 0, w, h); c.strokeStyle = PLUM; c.lineWidth = 16; c.strokeRect(8, 8, w - 16, h - 16); c.fillStyle = D('#d8343c'); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 96px ${FONT}`; c.fillText('REAL 0°', w / 2, h / 2 + 4); });
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.0, 8), flat('#5a3a2a')); sp.position.set(TRUE_X - 400 + .35, .5, -.1); g.add(sp);
  const sb = new THREE.Mesh(new THREE.BoxGeometry(.62, .31, .03), [flat('#fbf3df'), flat('#fbf3df'), flat('#fbf3df'), flat('#fbf3df'), new THREE.MeshBasicMaterial({ map: st }), flat('#fbf3df')]); sb.position.set(TRUE_X - 400 + .35, 1.05, -.1); sb.rotation.y = -.35; g.add(sb);
  const trunkM = painted(woodTex({ base: '#7a4a2a', vertical: true })), leafM = [flat('#3f9a48'), flat('#4fae52'), flat('#2f8a48')];
  const R = rng(17);
  for (let i = 0; i < 16; i++) {
    const x = 8.5 + R() * 15, z = -6 + R() * 13; if (Math.abs(z - 1.2) < 1.6 || Math.abs(x - (TRUE_X - 400)) < 1.2 || z > 2.8) continue;
    const s = .8 + R() * .7, tr = new THREE.Mesh(new THREE.CylinderGeometry(.09 * s, .13 * s, 1.6 * s, 8), trunkM); tr.position.set(x, .8 * s, z); g.add(tr);
    for (let k = 0; k < 3; k++) { const cn = new THREE.Mesh(new THREE.SphereGeometry((.7 + R() * .3) * s, 14, 10), leafM[k]); cn.position.set(x + (R() - .5) * .6 * s, (1.8 + k * .35) * s, z + (R() - .5) * .6 * s); g.add(cn); }
  }
  // benches along the path
  for (const x of [10, 17.5]) { const bnch = new THREE.Mesh(new THREE.BoxGeometry(1.2, .08, .4), painted(woodTex({ base: '#3f7a5a' }))); bnch.position.set(x, .45, 2.5); g.add(bnch); const bk = new THREE.Mesh(new THREE.BoxGeometry(1.2, .4, .06), painted(woodTex({ base: '#3f7a5a' }))); bk.position.set(x, .7, 2.72); g.add(bk); }
  dyn.hundred = tag(scene, '≈ 100 m  →', .26);
  dyn.arrow = tag(scene, '→', .3, { red: true });
  const L = new THREE.Group();
  L.add(new THREE.HemisphereLight('#cfdcff', '#8a7aa0', 2.3));
  const sun = new THREE.DirectionalLight('#ffe0a8', 3.4); sun.position.set(394, 14, 9); sun.target.position.set(402, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 50 }); sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; sun.shadow.radius = 3;
  L.add(sun); L.add(sun.target); dyn.gSun = V(8, -14, -9).normalize();
  scene.add(L); sets.green = { g, L };
  shadows(g);
}

// ---------------------------------------------------------------- FRAME (x = 500): the analogy
const TILT = -7 * DEG;
const floorY = x => (x - 500) * Math.tan(TILT);
function buildFrame(scene) {
  const g = new THREE.Group(); g.position.x = 500; scene.add(g);
  const fl = new THREE.Mesh(new THREE.BoxGeometry(8, .1, 6), painted(woodTex({ base: '#c08a50', plank: 40, rep: [3, 2] }))); fl.position.set(0, -.05, 0); fl.rotation.z = TILT; g.add(fl);
  const WIN = [-2.4, 1.0, -1.2, 2.4];
  const wallP = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#e8b8c0'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 64) { c.fillStyle = '#f2ccd0'; c.fillRect(x, 0, 30, h); } c.strokeStyle = '#c88a98'; c.lineWidth = 2; for (let x = 0; x < w; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } });
  wallP.wrapS = wallP.wrapT = THREE.RepeatWrapping; wallP.repeat.set(1 / 1.0, 1 / 1.0);
  const back = holedWall(8, 4, WIN, painted(wallP)); back.position.set(0, -.6, -2); back.castShadow = true; g.add(back);
  const vm = vistaMat(dayGardenTex(), { yaw: Math.atan2(498.2 - 500.2, -2 - 3), az: Math.PI / 2, el: [-22 * DEG, 23 * DEG], gain: 1.1 });
  const vp = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.7), vm); vp.position.set(-1.8, 1.1, -2.15); g.add(vp);
  const cas = flat('#f2ece0');
  for (const [w, h, x, y] of [[1.4, .1, -1.8, 1.85], [1.4, .1, -1.8, .4], [.1, 1.5, -2.45, 1.1], [.1, 1.5, -1.15, 1.1]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .14), cas); b.position.set(x, y - .6 + .6, -1.95); g.add(b); }
  // skirting board that follows the tilted floor
  const sk = new THREE.Mesh(new THREE.BoxGeometry(8, .16, .06), flat('#f2ece0')); sk.position.set(0, .08, -1.95); sk.rotation.z = TILT; g.add(sk);
  // the picture: a gold frame around a painted ship
  const pic = new THREE.Group(); pic.position.set(1.0, 1.7, -1.92); g.add(pic); dyn.pic = pic;
  const pt = canvasTex(512, 384, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, D('#8ac0f0')); gr.addColorStop(.6, D('#d8ecff')); gr.addColorStop(.6, D('#3a6ab8')); gr.addColorStop(1, D('#2a4a90')); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = D('#7a4a2a'); c.beginPath(); c.moveTo(150, 250); c.lineTo(360, 250); c.lineTo(330, 290); c.lineTo(180, 290); c.closePath(); c.fill(); c.fillStyle = D('#f6f0e2'); c.beginPath(); c.moveTo(255, 90); c.lineTo(255, 240); c.lineTo(340, 240); c.closePath(); c.fill(); c.beginPath(); c.moveTo(245, 110); c.lineTo(245, 240); c.lineTo(180, 240); c.closePath(); c.fill();
    c.strokeStyle = D('#2a2236'); c.lineWidth = 5; c.beginPath(); c.moveTo(250, 80); c.lineTo(250, 250); c.stroke(); c.fillStyle = D('#ffd84a'); c.beginPath(); c.arc(420, 80, 32, 0, 6.29); c.fill(); });
  const canvasM = new THREE.Mesh(new THREE.PlaneGeometry(.9, .66), new THREE.MeshLambertMaterial({ map: pt })); canvasM.position.z = .03; pic.add(canvasM);
  const gold = flat('#e0b050');
  for (const [w, h, x, y] of [[1.06, .08, 0, .37], [1.06, .08, 0, -.37], [.08, .82, -.49, 0], [.08, .82, .49, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .06), gold); b.position.set(x, y, .03); pic.add(b); }
  const nail = new THREE.Mesh(new THREE.SphereGeometry(.02, 8, 6), flat('#3a3040')); nail.position.set(1.0, 2.2, -1.96); g.add(nail);
  // the plumb line that shows the truth (dashed, light blue)
  const dash = canvasTex(64, 512, (c, w, h) => { c.fillStyle = '#fff'; for (let y = 0; y < h; y += 64) c.fillRect(16, y, 32, 38); });
  dyn.fTrue = new THREE.Mesh(new THREE.PlaneGeometry(.025, 1.3), new THREE.MeshBasicMaterial({ map: dash, color: HDR(.6, 1.5, 1.9), transparent: true, depthTest: false })); dyn.fTrue.position.set(501.0, 1.7, -1.85); dyn.fTrue.layers.set(1); dyn.fTrue.renderOrder = 22; dyn.fTrue.visible = false; scene.add(dyn.fTrue);
  // a side table with a vase, to fill the left of the frame
  const tb = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .05, 20), painted(woodTex({ base: '#8a5634' }))); tb.position.set(-.6, .62 + floorY(499.4), -1.4); g.add(tb);
  const tl = new THREE.Mesh(new THREE.CylinderGeometry(.04, .06, .6, 8), painted(woodTex({ base: '#8a5634' }))); tl.position.set(-.6, .32 + floorY(499.4), -1.4); g.add(tl);
  const vase = new THREE.Mesh(new THREE.CylinderGeometry(.07, .1, .28, 16), flat('#3a6ab8')); vase.position.set(-.6, .79 + floorY(499.4), -1.4); g.add(vase);
  for (const [dx, c] of [[-.04, '#e8384a'], [.05, '#ffd84a'], [0, '#ffffff']]) { const f = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), flat(c)); f.position.set(-.6 + dx, 1.0 + floorY(499.4) + Math.abs(dx), -1.4); g.add(f); }
  const L = new THREE.Group();
  L.add(new THREE.HemisphereLight('#dfe4ff', '#8a7aa0', 2.2));
  const sun = new THREE.DirectionalLight('#ffd89c', 3.0); sun.position.set(497.4, 4.4, -5.4); sun.target.position.set(500.2, 0, .5);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: .5, far: 16 }); sun.shadow.bias = -.0006; sun.shadow.normalBias = .02; sun.shadow.radius = 3;
  L.add(sun); L.add(sun.target); dyn.fSun = V(2.8, -4.4, 5.9).normalize();
  scene.add(L); sets.frame = { g, L };
  shadows(g);
  dyn.fBeam = beam(scene, [498.2, 1.1, -2.1], [499.4, 0, 0], { r0: .6, r1: .9, color: '#ffe9b8', strength: .12 });
}

// ---------------------------------------------------------------- CAST
export const LOOK = {
  prof: { cloth: '#6a3a8a', trim: '#e0aa3e', body: 'robe', hair: '#e8e2da', mustache: '#d8d0c6', beard: '#efe9e1', beardLen: .5, height: 1.66 },
  captain: { hat: 'captain', hatColor: '#26305a', cloth: '#2a3a7a', buttons: '#f0c040', beard: '#7a4a32', beardLen: .55, height: 1.72 },
  uk: { hat: 'top', hatColor: '#2e2a3a', hatBand: '#7a2a3a', cloth: '#3a3550', buttons: '#d9a441', mustache: true, hair: '#6a4a3a', height: 1.7 },
  us: { hat: 'top', hatColor: '#5a4030', hatBand: '#2a3a6a', cloth: '#6a3a2a', beard: '#a8784a', beardLen: .45, height: 1.66, headW: 268 },
  fr: { hat: 'top', hatColor: '#24305e', hatBand: '#c8323a', cloth: '#2f4aa0', sash: '#f2eee6', mustache: '#3a2a24', hair: '#3a2a24', height: 1.62, headW: 284, headH: 252 },
  del4: { hat: 'top', hatColor: '#3a3a3a', hatBand: '#3a6a4a', cloth: '#4a6a4a', mustache: true, hair: '#2a2a2a', height: 1.64 },
  t1: { hat: 'cap', hatColor: '#e8483a', capSide: 1, cloth: '#f0b030', height: 1.6, pocket: true },
  t2: { cloth: '#3aa8a0', hair: '#5a3a2a', height: 1.56, headW: 266, headH: 250 },
  t3: { hat: 'cap', hatColor: '#3a6ad8', capSide: -1, cloth: '#e86a8a', height: 1.68 },
};

// ---------------------------------------------------------------- CAMERA
function cameraPath() {
  const t = W;
  const keys = [
    // hook: the glowing zero on the globe -> pull back: the professor spinning it -> Greenwich: the line is wrong -> back
    { t: 0, pos: [.42, 1.36, .55], look: [0, 1.2, -1.0], fov: 38, creep: .3, drift: .03 },
    { t: t('whole') + .7, dur: .75, pos: [.55, 1.5, 2.1], look: [.15, 1.08, -1.05], fov: 52, creep: .28 },
    { t: t('is', 1) + .12, dur: .3, move: 'whip', pos: [398.3, 1.45, 4.3], look: [400.4, .95, .2], fov: 48, creep: .3 },
    { t: t('you') + .14, dur: .3, move: 'whip', pos: [.3, 1.45, 1.9], look: [-.38, 1.2, -.9], fov: 50, creep: .27 },
    { t: t('earth') + 1.0, dur: 1.4, pos: [.3, 1.45, .95], look: [0, 1.22, -1.0], fov: 40, creep: .26, drift: .04 },
    { t: t('its', 1) + .95, dur: 1.0, pos: [2.05, 1.32, -.4], look: [1.45, .97, -1.55], fov: 40, creep: .28, drift: .06 },
    { t: t('so', 1) + .6, dur: .9, pos: [.9, 1.5, 1.9], look: [.35, 1.1, -1.2], fov: 50, creep: .27 },
    { t: t('sailors') + .14, dur: .32, move: 'whip', pos: [201.0, 1.5, 2.1], look: [200.1, 1.45, -.3], fov: 46, creep: .27 },
    { t: t('royal') + .5, dur: 1.2, pos: [199.15, 1.62, 1.75], look: [199.25, .92, .82], fov: 42, creep: .28, drift: .03 },
    { t: t('most') + .7, dur: 1.4, pos: [198.6, 2.4, 5.2], look: [192, 1.0, -22], fov: 50, creep: .25 },
    { t: t('eighteen') + .14, dur: .32, move: 'whip', pos: [300.7, 2.0, 5.3], look: [299.95, 2.45, -3], fov: 54, creep: .27 },
    { t: t('voted') + .35, dur: 1.0, pos: [300.4, 1.85, 1.6], look: [300.1, 1.6, -2.3], fov: 46, creep: .28 },
    { t: t('french') + .6, dur: .9, pos: [301.05, 1.72, .35], look: [301.55, 1.55, -2.3], fov: 40, creep: .27, drift: .04 },
    { t: t('abstained') + .7, dur: 1.0, pos: [301.35, 1.7, 1.3], look: [301.6, 1.45, -2.3], fov: 46, creep: .27 },
    { t: t('today') + .14, dur: .32, move: 'whip', pos: [402.7, 1.65, 5.4], look: [400.1, 1.0, .1], fov: 50, creep: .27 },
    { t: t('straddle') + .4, dur: 1.0, pos: [401.45, 1.15, 3.5], look: [400.0, .88, .4], fov: 46, creep: .28 },
    { t: t('telescope') + .45, dur: 1.2, pos: [398.75, 1.55, .2], look: [397.3, 1.25, -2.5], fov: 44, creep: .26 },
    { t: t('gravity', 2) + .2, dur: 1.0, pos: [397.8, 1.0, -1.05], look: [397.25, .82, -2.1], fov: 38, creep: .3 },
    { t: t('satellites') + .14, dur: .32, move: 'whip', pos: [.75, 1.55, .85], look: [0, 1.2, -1.0], fov: 46, creep: .28 },
    { t: t('like', 2), move: 'cut', pos: [500.6, 1.5, 3.3], look: [500.55, 1.45, -1], fov: 48, creep: .27 },
    { t: t('so', 2) + .14, dur: .32, move: 'whip', pos: [400.8, 1.8, 4.0], look: [400.1, .35, .4], fov: 48, creep: .25, drift: 0 },
    { t: t('about') + .9, dur: 1.5, pos: [410.6, 2.5, 5.4], look: [414.2, .45, .6], fov: 50, creep: .3 },
  ];
  const cp = new CamPath(keys, { fps: FPS });
  cp.kick(t('wrong') + .03, .8); cp.kick(t('voted') + .03, .6); cp.kick(t('crooked') + .03, .7);
  return cp;
}

// ---------------------------------------------------------------- SETUP
export async function setup(ctx) {
  C = ctx; W = wordTimes(ctx.words);
  DUR = Math.ceil((ctx.words[ctx.words.length - 1].end + .6) * FPS) / FPS;
  const { scene } = ctx;
  scene.background = new THREE.Color('#1a1f3a');
  buildStudy(scene); buildSea(scene); buildHall(scene); buildGreen(scene); buildFrame(scene);
  for (const [k, l] of Object.entries(LOOK)) cast[k] = new Toon(l, scene);
  cast.jog = new Toon({ hat: 'cap', hatColor: '#2fa860', capSide: 1, cloth: '#e84a6a', height: 1.66 }, scene);
  dyn.armP = new Arm3D(scene, cast.prof);
  dyn.cam = cameraPath();
  // dust in the orrery light, sea spray specks, sparkle in the park
  smokes.motes = new Smoke(scene, { color: '#fff0d0', maxPoints: 500, H: ctx.H, additive: true, near: 1.2 });
  const hash = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const motes = (n, c, sz, on) => smokes.motes.wisps.push({ n, size: .006, alpha: .45, speed: .05, on,
    path: (u, t, i) => [c[0] + (hash(i, 1) - .5) * sz[0] + Math.sin(t * .5 + i) * .05, c[1] + (hash(i, 2) - .5) * sz[1] + (u - .5) * .4, c[2] + (hash(i, 3) - .5) * sz[2] + Math.cos(t * .4 + i * 2) * .05] });
  motes(160, [.6, 1.3, -1.0], [3.5, 1.8, 3], t => true);
  motes(120, [300, 2.4, -1.4], [5, 2.5, 4], t => true);
  // the lamp on the mast smokes a little
  smokes.sea = new Smoke(scene, { color: '#c8c0d0', maxPoints: 200, H: ctx.H });
  smokes.sea.wisps.push({ n: 60, size: .06, alpha: .35, speed: .3, path: (u, t) => [200.4 + Math.sin(u * 6 + t * 2) * .05 * u * 3, 2.28 + u * 1.2, -1.25 + Math.cos(u * 5 + t) * .04 * u * 3] });
  // sound cues
  const cue = (t, type, extra = {}) => CUES.push({ t: +t.toFixed(3), type, ...extra });
  cue(W('sailors') - .05, 'whoosh'); cue(W('eighteen') - .05, 'whoosh'); cue(W('today') - .05, 'whoosh');
  cue(0, 'score', { mode: 'major' });
  for (const w of [['is', 1], ['you', 1], ['satellites', 1], ['so', 2]]) cue(W(...w) - .02, 'rise', { dur: .5 });
  cue(W('wrong') + .03, 'lock'); cue(W('zero', 1), 'shimmer'); cue(W('istanbul') - .3, 'shimmer'); cue(W('january') - .05, 'lock'); cue(W('march') - .05, 'lock');
  cue(W('sailors') + .1, 'wind', { dur: W('eighteen') - W('sailors') - .2 });
  cue(W('voted') + .03, 'boom'); cue(W('kept') - .05, 'lock'); cue(W('crooked') + .03, 'boom');
  cue(W('like', 2), 'cut'); cue(W('floor') + .1, 'lock'); cue(W('real') - .1, 'shimmer'); cue(W('park') - .1, 'shimmer');
}

// ---------------------------------------------------------------- PER FRAME
const vis = (set, on) => { sets[set].g.visible = on; sets[set].L.visible = on; };
const NIGHT = '#d6d1f2', DAY = '#e8e3f4', WARM = '#ffb45a';
export function frame(t, ctx) {
  const { cam, env } = ctx;
  const cp = dyn.cam.apply(cam, t);
  const x = cam.position.x;
  const where = x < 100 ? 'study' : x < 250 ? 'sea' : x < 350 ? 'hall' : x < 450 ? 'green' : 'frame';
  for (const s of ['study', 'sea', 'hall', 'green', 'frame']) vis(s, s === where);
  const T = W, A = (w, n) => W(w, n) - 2 / FPS;
  const bl = (seed, ...swaps) => blinkAt(t, seed, swaps, FPS);
  const tint = FACE[where].map((v, i) => v / GRADE[where][i]);
  for (const c of Object.values(cast)) c.hide();
  dyn.armP.hide();
  for (const s of [dyn.grTag, dyn.istTag, dyn.hundred, dyn.arrow]) s.visible = false;
  dyn.sats.forEach(s => { s.s.visible = s.line.visible = false; }); dyn.centre.visible = false;
  dyn.sBeamS.visible = where === 'study'; dyn.fBeam.visible = where === 'frame'; dyn.sunGlow.visible = where === 'study'; dyn.lanGlow.visible = where === 'sea'; dyn.chGlow.visible = where === 'hall';
  dyn.mapGlow.visible = where === 'hall'; dyn.trueV.visible = false; dyn.fTrue.visible = false;
  smokes.sea.pts.visible = where === 'sea';

  // ---- STUDY
  if (where === 'study') {
    // the globe turns slowly; the professor gives it a push on "whole" and on "Istanbul"
    const push1 = ramp(t, T('whole') - .1, T('two') + .4), push2 = ramp(t, T('well') - .1, T('istanbul') + .3);
    const facing = 8 + t * .5 + 12 * push2 - (t < T('you') ? 25 * (1 - push1) : 0);    // longitude that faces +z (the camera)
    dyn.spin.rotation.y = -Math.PI / 2 - facing * DEG;
    drawMeridians(t < T('slice') ? (t < T('you') ? 0 : 0) : Math.round(36 * lin(t, T('slice'), T('meridians') + .3)));
    // the zero line: on Greenwich, slides to Istanbul, back to Greenwich for the satellites
    const toIst = ramp(t, T('well') - .15, T('istanbul') + .2) * (1 - ramp(t, T('satellites') - .5, T('satellites')));
    const zl = lerpN(GREEN_LON, IST_LON, toIst);
    dyn.zero.rotation.y = zl * DEG; dyn.zero.visible = t < T('you') || t > T('nothing', 1) - .3;
    // tags float over the pins
    const tagAt = (s, pin, k, on) => { pin.updateMatrixWorld(); const p = pin.getWorldPosition(V()); const out = p.clone().sub(GLOBE).normalize(); s.position.copy(p).addScaledVector(out, .05).add(V(0, .045, 0)); pop(s, k, on); };
    tagAt(dyn.grTag, dyn.pins.gr, t - T('england', 1) + .4, t > T('england', 1) - .4 && t < T('its', 1));
    tagAt(dyn.istTag, dyn.pins.ist, t - T('istanbul'), t < T('its', 1));
    // orrery: the little Earth goes round its sun
    const oa = t * .9; dyn.orrArm.rotation.y = oa; dyn.mini.rotation.y = t * 3;
    const fk = t - T('january');
    dyn.flag.visible = fk > 0;
    if (dyn.flag.visible) {
      const drop = backOut(Math.min(1, fk / .25)); dyn.flag.position.copy(dyn.flagHome).add(V(0, (1 - drop) * .25, 0));
      const flip = ramp(t, T('march') - .15, T('march') + .2);       // spins round: JAN 1 -> MAR 25
      dyn.flag.rotation.y = flip * Math.PI * 2 + Math.atan2(cam.position.x - dyn.flag.position.x, cam.position.z - dyn.flag.position.z);
      drawFlag(flip > .5 ? 'MAR 25' : 'JAN 1');
    }
    // satellites
    if (t > T('satellites') - .4) {
      const k = ramp(t, T('satellites') - .2, T('measure'));
      dyn.sats.forEach(s => {
        const a = t * .7 + s.k * 2.6, r = .72, p = V(Math.cos(a) * r, Math.sin(a * .6 + s.k) * .32 + .12, Math.sin(a) * r * .6).add(GLOBE);
        s.s.visible = true; s.s.position.copy(p); s.s.lookAt(GLOBE); s.s.scale.setScalar(k * 1.8);
        const ln = ramp(t, T('center') - .3, T('center') + .25), len = p.distanceTo(GLOBE) * ln;
        s.line.visible = ln > 0; s.line.scale.set(1, Math.max(.001, len), 1); s.line.position.copy(p).lerp(GLOBE, ln / 2 * 1);
        s.line.position.copy(p).addScaledVector(GLOBE.clone().sub(p).normalize(), len / 2);
        s.line.quaternion.setFromUnitVectors(V(0, 1, 0), GLOBE.clone().sub(p).normalize());
      });
      dyn.centre.visible = t > T('center') + .1;
    }
    // the professor
    const atDesk = t >= T('its', 1) + .3 && t < T('satellites') - .3;
    const px = atDesk ? [.88, 0, -1.25] : [-.78, 0, -.72];
    cast.prof.show(); cast.prof.place(...px, cam, tint); cast.prof.castFrom(ORR);
    if (!atDesk) {
      const spinning = (t > T('whole') - .2 && t < T('two') + .4) || (t > T('well') - .2 && t < T('istanbul') + .4);
      const sat = t > T('satellites') - .3;
      const touch = spinning || (t > T('says') && t < T('istanbul') + .4);
      const ex = t < T('wrong') ? 'smug' : t < T('you') + .1 ? 'surprised' : sat ? 'proud' : t > T('istanbul') - .1 ? 'smile' : t > T('nothing', 1) ? 'focused' : 'neutral';
      cast.prof.draw({ expr: ex, look: .75, lookY: sat ? -.4 : .25, brow: t > T('nothing', 1) && t < T('england', 1) ? .6 : 0, blink: bl(1, A('wrong'), A('you'), A('nothing', 1), A('istanbul'), A('satellites')),
        noArmR: touch, armR: sat ? [120, -30] : [30, 40], armL: [18, 20], lit: 1, shade: NIGHT, rim: { color: WARM, a: .38 }, mouth: 0 });
      if (touch) { const h = GLOBE.clone().add(V(-GR * .82, .12 + (spinning ? Math.sin(t * 9) * .05 : 0), .22)); dyn.armP.set(1, h, { sag: .05, tint }); }
    } else {
      const shrug = t > T('so', 1) - .05;
      const made = t > T('made') - .1 && t < T('england', 2);
      cast.prof.draw({ expr: shrug ? 'worried' : made ? 'smug' : t > T('january') ? 'surprised' : 'focused', look: shrug ? .3 : .85, lookY: shrug ? 0 : .5, brow: shrug ? .8 : 0, blink: bl(1, A('january'), A('made'), A('so', 1)),
        armL: shrug ? [100, -90] : [18, 30], armR: shrug ? [100, -90] : made ? [70, -20] : [24, 40], lit: 1, shade: NIGHT, rim: { color: WARM, a: .45 } });
    }
  }
  // ---- SEA
  if (where === 'sea') {
    dyn.lanGlass.scale.setScalar(1 + .04 * Math.sin(t * 23) * Math.sin(t * 7)); dyn.seaKey.intensity = 6.5 * (.94 + .06 * Math.sin(t * 19));
    dyn.fleet.forEach((s, i) => { s.position.y = -1.3 + Math.sin(t * 1.3 + i) * .06; s.rotation.z = Math.sin(t * .9 + i) * .03; });
    const chartBeat = t > T('royal') - .1 && t < T('most') + .4;
    cast.captain.show(); cast.captain.place(200.15, 0, -.3, cam, tint); cast.captain.castFrom(dyn.seaKey.position);
    cast.captain.draw({ expr: chartBeat ? 'focused' : t > T('most') ? 'proud' : 'smug', look: chartBeat ? -.8 : -.2, lookY: chartBeat ? .8 : -.1, blink: bl(2, A('royal'), A('most') + .4),
      armR: chartBeat ? [20, 30] : [130, -40], propR: chartBeat ? null : 'spyglass', armL: chartBeat ? [70, 40] : [20, 30], lit: 1, shade: NIGHT, rim: { color: WARM, a: .45 } });
  }
  // ---- HALL
  if (where === 'hall') {
    const vote = t > A('voted') && t < T('french') + .2;
    const mg = ramp(t, T('voted'), T('greenwich', 2) + .2) * (1 - ramp(t, T('french') + .4, T('french') + 1));
    dyn.mapGlow.material.opacity = mg;
    const D5 = [['uk', 298.0, 'smile', 3], ['us', 299.15, 'proud', 4], ['del4', 300.35, 'smile', 5], ['fr', 301.55, null, 6]];
    for (const [k, xx, ex, seed] of D5) {
      const c = cast[k]; c.show(); c.place(xx, 0, -2.35, cam, tint); c.castFrom(CH_P);
      if (k !== 'fr') {
        const up = vote ? ramp(t, A('voted') + (seed - 3) * .06, A('voted') + .2 + (seed - 3) * .06) : 0;
        c.draw({ expr: vote ? ex : t > T('french') ? 'surprised' : 'neutral', look: t > T('french') ? .8 : (k === 'uk' ? .5 : -.2), lookY: .1, blink: bl(seed, A('voted'), A('french')),
          armR: [lerpN(16, 165, up), lerpN(10, -10, up)], armL: [16, 10], lit: xx < 300 ? 1 : -1, shade: NIGHT, rim: { color: WARM, a: .38 } });
      } else {
        const talk = t > A('zero', 3) - .05 && t < A('english') + .5, object = t > A('objected') - .2 && t < T('they') - .1;
        const crossed = t >= T('they') - .1, sign = t > A('kept');
        c.draw({ expr: talk || object ? 'angry' : crossed ? 'smug' : 'neutral', look: -.6, lookY: 0, brow: crossed ? .5 : 0, mouth: talk ? flap(env, t) : 0, blink: bl(seed, A('objected'), A('they'), A('kept')),
          armL: talk ? [110 + Math.sin(t * 8) * 18, -40] : crossed ? [60, -120] : [16, 10], armR: sign ? [40, -60] : crossed ? [60, -120] : talk ? [40, 30] : [16, 10], propR: sign ? 'sign' : null, signText: 'PARIS 0°',
          lean: talk ? -3 + Math.sin(t * 6) * 2 : 0, lit: -1, shade: NIGHT, rim: { color: WARM, a: .38 } });
      }
    }
  }
  // ---- GREENWICH
  if (where === 'green') {
    const queue = t > T('today') - .5;
    // hook: one tourist on the line, the other photographing; "wrong" pops an arrow pointing east
    const jump = ramp(t, A('straddle'), A('straddle') + .25);
    const j = queue && t < T('but', 2) ? Math.sin(Math.min(1, lin(t, A('straddle'), A('straddle') + .4)) * Math.PI) * .18 : 0;
    if (t < T('but', 2) || t > T('so', 2) - .1) cast.t1.show(); cast.t1.place(400 + (queue ? lerpN(.9, 0, jump) : 0), j, queue ? lerpN(1.0, .7, jump) : .6, cam, tint); cast.t1.castFrom(dyn.gSun, true);
    const wrong = t > A('wrong') && t < T('you');
    cast.t1.draw({ expr: wrong ? 'surprised' : queue && jump > .9 ? 'grin' : 'smile', look: wrong ? .6 : -.3, lookY: wrong ? .6 : 0, blink: bl(7, A('wrong'), A('straddle')), armL: [140, -10], armR: [140, -10], lit: -1, shade: DAY, rim: { color: '#ffe2a0', a: .3 }, sweat: wrong ? 1 : 0 });
    if (t < T('but', 2) || t > T('so', 2) - .1) { cast.t2.show(); cast.t2.place(401.2, 0, -.5, cam, tint); } cast.t2.castFrom(dyn.gSun, true);
    cast.t2.draw({ expr: wrong ? 'worried' : 'smile', look: -.7, lookY: .1, blink: bl(8, A('wrong')), armR: [100, -70], propR: 'phone', armL: [80, -60], lit: -1, shade: DAY, rim: { color: '#ffe2a0', a: .3 } });
    if (queue && t < T('but', 2)) { cast.t3.show(); cast.t3.place(399.0, 0, 1.6, cam, tint); cast.t3.castFrom(dyn.gSun, true); cast.t3.draw({ expr: 'neutral', look: -.6, blink: bl(9), armL: [16, 10], armR: [16, 10], lit: -1, shade: DAY, rim: { color: '#ffe2a0', a: .3 } }); }
    const ak = t - (T('wrong') + .03); dyn.arrow.position.set(400.75, 1.55, .6); pop(dyn.arrow, ak, ak >= 0 && t < T('you'));
    if (ak >= 0 && t < T('you')) dyn.arrow.position.x += Math.min(.6, ak * 1.2);
    // the plumb line leans on "crooked" (exaggerated), the true vertical shows beside it
    const cr = ramp(t, T('pulls') - .1, T('crooked') + .1);
    dyn.plumb.rotation.z = -cr * .17 + Math.sin(t * 2.2) * .01 * (1 - cr);
    dyn.trueV.visible = t > T('pulls') - .1 && t < T('satellites');
    // the end: the walk east, the sign, the jogger who doesn't stop
    const hk = t - (T('about') - .1); { const f = V(); cam.getWorldDirection(f); dyn.hundred.position.copy(cam.position).addScaledVector(f, 2.6).add(V(0, .62, 0)); } pop(dyn.hundred, hk, hk >= 0 && t < T('park') + .2);
    if (t > T('about')) {
      const jx = 412 + (t - T('through', 3)) * 2.2;
      cast.jog.show(); cast.jog.place(jx, Math.abs(Math.sin(t * 9)) * .05, 1.35, cam, tint); cast.jog.castFrom(dyn.gSun, true);
      const sw = Math.sin(t * 9) * 40;
      cast.jog.draw({ expr: 'focused', look: .9, blink: bl(10), armL: [20 + sw, -60], armR: [20 - sw, -60], lean: 6, lit: -1, shade: DAY, rim: { color: '#ffe2a0', a: .3 } });
    }
  }
  // ---- FRAME
  if (where === 'frame') {
    const sq = ramp(t, T('squaring') - .1, T('tilted') + .1);
    dyn.pic.rotation.z = Math.sin(Math.PI * .15) * 0 + lerpN(3 * DEG, TILT, sq);
    dyn.fTrue.visible = t > T('floor') - .05; if (dyn.fTrue.visible) { const k = lin(t, T('floor') - .05, T('floor') + .3); dyn.fTrue.scale.set(1, Math.max(.01, k), 1); dyn.fTrue.position.y = 1.7 + .65 * (1 - k); }
    cast.prof.show(); cast.prof.place(500.05, floorY(500.05), -1.2, cam, tint); cast.prof.castFrom(dyn.fSun, true);
    const done = t > T('floor') - .05;
    cast.prof.draw({ expr: done ? 'surprised' : sq > .3 ? 'proud' : 'focused', look: .8, lookY: done ? -.2 : -.5, blink: bl(1, A('floor')), armR: done ? [30, 20] : [150, -40], armL: [20, 20], tilt: TILT / DEG, lit: -1, shade: DAY, rim: { color: '#ffe2a0', a: .35 } });
  }
  for (const s of Object.values(smokes)) s.update(t);

  // ---- look per set / beat
  const focusOn = (p, coc, range) => ({ focus: cam.position.distanceTo(p), coc, range });
  let look;
  if (where === 'study') {
    if (t < T('whole') + .5) look = focusOn(V(-.1, 1.3, -.7), 7, 1.0);
    else if (t > T('its', 1) + .3 && t < T('so', 1) + .2) look = focusOn(ORR, 8, .7);
    else look = focusOn(GLOBE, 5, 2.4);
    Object.assign(look, { sat: 1.18, lift: [.1, .09, .17], bloom: .9, vignette: .24 });
  } else if (where === 'sea') {
    look = t > T('royal') && t < T('most') + .4 ? focusOn(CHART_C, 7, .8) : focusOn(V(200.1, 1.4, -.3), 5, 4);
    Object.assign(look, { sat: 1.2, lift: [.09, .09, .18], bloom: .95, vignette: .26 });
  } else if (where === 'hall') {
    look = { ...focusOn(t > T('french') ? V(301.55, 1.5, -2.35) : V(300, 1.5, -2.35), 5, 2.8), sat: 1.2, lift: [.1, .085, .15], bloom: .85, vignette: .22 };
  } else if (where === 'green') {
    look = t > T('telescope') && t < T('satellites') ? focusOn(PLUMB, 6, 1.2) : t > T('so', 2) ? { focus: 10, coc: 0, range: 10 } : focusOn(V(400.3, 1.0, .3), 4, 3);
    Object.assign(look, { sat: 1.3, lift: [.09, .09, .14], bloom: .7, vignette: .18 });
  } else look = { ...focusOn(V(500.6, 1.5, -1.6), 5, 2.4), sat: 1.3, lift: [.1, .09, .14], bloom: .7, vignette: .18 };
  look.tint = GRADE[where];
  look.blur = cp.moving > .15 ? 16 : 0;
  look.flash = t >= T('like', 2) && t < T('like', 2) + 2 / FPS ? .35 : 0;
  return look;
}
const GRADE = { study: [1, .98, 1.03], sea: [.98, .98, 1.05], hall: [1.03, 1.0, .97], green: [1.02, 1.0, .97], frame: [1.03, 1.0, .96] };
const FACE = { study: [1, .985, .97], sea: [.97, .975, 1], hall: [1, .985, .96], green: [1, 1, .985], frame: [1, .99, .97] };
