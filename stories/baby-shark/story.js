// Baby Shark (The Video That Broke YouTube) — a 16:9 documentary, about four minutes, English narration.
// Our own visuals: no Pinkfong characters, artwork or song. The "video" on every screen is our own drawing: a small
// orange fin in blue waves with music notes. Sets, far apart in x:
//   LIVING (x≈0)    a living room at night: the TV is the key (cool), a floor lamp the warm pool, moonlight in the window
//   STAGE  (x≈100)  a dark stage of records: three pedestals under spotlights, a big scoreboard counter overhead
//   STUDIO (x≈200)  a small animation studio in Seoul, 2016, by day: sun through a big window over a painted skyline
//   CAMP   (x≈300)  a campfire in the woods at night: the fire is the key, the moon the cool fill
//   CLASS  (x≈400)  a classroom by day: blackboard, a world map that lights up, kids copying the moves
//   CITY   (x≈500)  apartment blocks at night: hundreds of windows flicker with the same blue screen light
// Every cue is pinned to a word of voice/words.json (W('word', n) = start of the n-th match).
import * as THREE from 'three';
import { stoneTex, woodTex, carpetTex, wallTex, frizTex, painted, flat, rng, D, shade } from '/engine/src/paint.js';
import { Toon, PLUM, blinkAt } from '/engine/src/toon.js';
import { CamPath, smoother } from '/engine/src/camera.js';
import { Smoke, beam, glow } from '/engine/src/fx.js';
import { holedWall, vistaMat, nightCityTex, dayGardenTex } from '/engine/src/vista.js';

export const NAME = 'baby-shark';
export const FPS = 24;
export const SIZE = [1920, 1080];
export const CAPTION = { y: .86, size: 62 };
export let DUR = 240;
export const CUES = [];

const S = smoother;
const ramp = (t, a, b) => S((t - a) / (b - a));
const lin = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const lerpN = (a, b, k) => a + (b - a) * k;
const V = (...a) => new THREE.Vector3(...a);
const HDR = (r, g, b) => new THREE.Color().setRGB(r, g, b);
const DEG = Math.PI / 180;
const backOut = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
const FONT = '"Inter Black", "Arial Black", "DejaVu Sans", sans-serif';
let C, W;
const cast = {}, sets = {}, dyn = {}, smokes = {};

function wordTimes(words) {
  const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
  return (w, n = 1) => { let k = 0; for (const x of words) if (norm(x.word) === norm(w) && ++k === n) return x.start; throw new Error('word not found: ' + w + ' #' + n); };
}
function shadows(g) {
  g.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return;
    if (o.material.isMeshLambertMaterial) o.receiveShadow = true;
    if (/Box|Cylinder|Extrude|Lathe|Torus|Sphere|Cone/.test(o.geometry.type) && !o.userData.noShadow) o.castShadow = true;
  });
}
function spot(color, intensity, pos, target, angle, { size = 1024, near = .5, far = 30, penumbra = .45, decay = 0, dist = 0 } = {}) {
  const l = new THREE.SpotLight(color, intensity, dist, angle, penumbra, decay);
  l.position.set(...pos); l.target.position.set(...target); l.castShadow = true;
  l.shadow.mapSize.set(size, size); l.shadow.camera.near = near; l.shadow.camera.far = far; l.shadow.bias = -.0008; l.shadow.normalBias = .03; l.shadow.radius = 3;
  return l;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.canvas = c; t.g = g; return t;
}
const box = (w, h, d, m, x, y, z, g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
const cyl = (r0, r1, h, m, x, y, z, g, seg = 20) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m); o.position.set(x, y, z); g.add(o); return o; };

// small icons drawn into tags (the fonts here have no emoji)
const ICON = {
  note(g, x, y, s, c) { g.fillStyle = c; g.strokeStyle = c; g.lineWidth = s * .12; g.beginPath(); g.ellipse(x - s * .18, y + s * .28, s * .2, s * .15, -.4, 0, 6.29); g.fill();
    g.beginPath(); g.moveTo(x, y + s * .26); g.lineTo(x, y - s * .38); g.quadraticCurveTo(x + s * .3, y - s * .25, x + s * .3, y - s * .02); g.stroke(); },
  heart(g, x, y, s, c) { g.fillStyle = c; g.beginPath(); g.moveTo(x, y + s * .38); g.bezierCurveTo(x - s * .6, y - s * .05, x - s * .3, y - s * .5, x, y - s * .18); g.bezierCurveTo(x + s * .3, y - s * .5, x + s * .6, y - s * .05, x, y + s * .38); g.fill(); },
  bulb(g, x, y, s, c) { g.fillStyle = c; g.beginPath(); g.arc(x, y - s * .1, s * .3, 0, 6.29); g.fill(); g.fillRect(x - s * .14, y + s * .14, s * .28, s * .2); },
  replay(g, x, y, s, c) { g.strokeStyle = c; g.fillStyle = c; g.lineWidth = s * .13; g.lineCap = 'round'; g.beginPath(); g.arc(x, y, s * .3, -.6, 4.4); g.stroke();
    const a = -.6, px = x + Math.cos(a) * s * .3, py = y + Math.sin(a) * s * .3; g.beginPath(); g.moveTo(px + s * .2, py - s * .02); g.lineTo(px - s * .06, py - s * .2); g.lineTo(px - s * .02, py + s * .14); g.closePath(); g.fill(); },
  play(g, x, y, s, c) { g.fillStyle = c; g.beginPath(); g.moveTo(x - s * .2, y - s * .3); g.lineTo(x + s * .32, y); g.lineTo(x - s * .2, y + s * .3); g.closePath(); g.fill(); },
  globe(g, x, y, s, c) { g.strokeStyle = c; g.lineWidth = s * .08; g.beginPath(); g.arc(x, y, s * .34, 0, 6.29); g.stroke(); g.beginPath(); g.ellipse(x, y, s * .15, s * .34, 0, 0, 6.29); g.stroke(); g.beginPath(); g.moveTo(x - s * .34, y); g.lineTo(x + s * .34, y); g.stroke(); },
};
// an on-screen tag (layer 1, no world ink): cream pill, plum letters, an optional icon in front. A Sprite.
function tag(scene, text, h = .1, { bg = '#fbf3df', fg = PLUM, red = false, icon = null, iconC = '#e8603f', strike = false } = {}) {
  const fs = 96, pad = 44, iw = icon ? fs * 1.05 : 0;
  const mc = document.createElement('canvas').getContext('2d'); mc.font = `900 ${fs}px ${FONT}`;
  const tw = Math.ceil(mc.measureText(text).width) + pad * 2 + iw, th = fs + pad * 1.4;
  const t = canvasTex(tw, th, (g, w, hh) => {
    g.fillStyle = D(red ? '#d8343c' : bg); g.strokeStyle = PLUM; g.lineWidth = 12; g.beginPath(); g.roundRect(6, 6, w - 12, hh - 12, hh / 2 - 6); g.fill(); g.stroke();
    if (icon) ICON[icon](g, pad + iw * .45, hh / 2, fs * 1.05, D(iconC));
    g.font = `900 ${fs}px ${FONT}`; g.fillStyle = red ? '#fff' : D(fg); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, (w + iw) / 2, hh / 2 + 4);
    if (strike) { g.strokeStyle = D('#d8343c'); g.lineWidth = 16; g.lineCap = 'round'; g.beginPath(); g.moveTo(pad * .6, hh * .62); g.lineTo(w - pad * .6, hh * .4); g.stroke(); }
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, depthWrite: false }));
  s.scale.set(h * tw / th, h, 1); s.layers.set(1); s.renderOrder = 30; s.visible = false; s.base = s.scale.clone(); scene.add(s); return s;
}
function pop(s, k, on = true) { s.visible = on && k >= 0; if (s.visible) { const f = .2 + .8 * backOut(k / .2); s.scale.set(s.base.x * f, s.base.y * f, 1); } }
// a tag that shows from word a until b
const showTag = (s, t, a, b, pos) => { if (pos) s.position.set(...pos); pop(s, t - a, t >= a && t < b); };

// ---------------------------------------------------------------- the "video": our own little fin cartoon
const fmt = n => Math.floor(n).toLocaleString('en-US');
function drawFin(g, x, y, s, t, col = '#ff9a3a') {
  g.save(); g.translate(x, y); g.rotate(Math.sin(t * 4) * .12);
  g.fillStyle = D(col); g.strokeStyle = D('#2a1a2c'); g.lineWidth = s * .06; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(-s * .5, s * .2); g.quadraticCurveTo(-s * .15, -s * .1, s * .05, -s * .75); g.quadraticCurveTo(s * .2, -s * .2, s * .55, s * .2); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = D('#ffd8a8'); g.beginPath(); g.moveTo(-s * .12, s * .1); g.quadraticCurveTo(s * .02, -s * .2, s * .05, -s * .45); g.quadraticCurveTo(s * .1, -s * .05, s * .2, s * .1); g.closePath(); g.fill();
  g.restore();
}
// mode: { title, replay (count), views, progress (upload 0..1), published }
function drawScreen(g, w, h, t, m = {}) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, D('#7fd6ff')); gr.addColorStop(.55, D('#3aa8e8')); gr.addColorStop(1, D('#1f6ac8'));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  // sun + bubbles
  g.fillStyle = D('#fff2a8'); g.beginPath(); g.arc(w * .84, h * .2, h * .1, 0, 6.29); g.fill();
  g.strokeStyle = D('#e8fbff'); g.lineWidth = h * .008;
  for (let i = 0; i < 9; i++) { const u = (t * .25 + i / 9) % 1, bx = w * (.1 + (i * .37 % 1) * .8), by = h * (.9 - u * .7); g.beginPath(); g.arc(bx + Math.sin(t * 2 + i) * 8, by, h * (.015 + (i % 3) * .008), 0, 6.29); g.stroke(); }
  // waves
  const wave = (yy, amp, ph, c) => { g.fillStyle = D(c); g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += w / 40) g.lineTo(x, yy + Math.sin(x / w * 12 + ph) * amp); g.lineTo(w, h); g.closePath(); g.fill(); };
  wave(h * .62, h * .025, t * 2.2, '#2f8fe0');
  drawFin(g, w * (.5 + Math.sin(t * 1.3) * .18), h * .64 + Math.sin(t * 4) * h * .02, h * .32, t);
  wave(h * .7, h * .03, t * 2.8 + 1, '#1f74d0');
  wave(h * .8, h * .025, t * 3.4 + 2, '#1a5fb8');
  // dancing notes
  for (let i = 0; i < 4; i++) { const u = (t * .4 + i / 4) % 1; ICON.note(g, w * (.12 + i * .2), h * (.5 - u * .32) + Math.sin(t * 5 + i) * 6, h * .14, D(['#ffffff', '#ffe27a', '#ffb8d8', '#ffffff'][i])); }
  if (m.title) {
    const k = m.title;
    g.save(); g.globalAlpha = Math.min(1, k * 3); g.translate(w / 2, h * .3); g.scale(.8 + .2 * backOut(Math.min(1, k * 2.5)), .8 + .2 * backOut(Math.min(1, k * 2.5)));
    g.font = `900 ${h * .16}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.strokeStyle = D('#2a1a2c'); g.lineWidth = h * .035; g.strokeText('BABY SHARK', 0, 0); g.fillStyle = D('#ffe27a'); g.fillText('BABY SHARK', 0, 0); g.restore();
  }
  // the player's bar
  const bar = h * .12;
  g.fillStyle = 'rgba(10,14,40,.55)'; g.fillRect(0, h - bar, w, bar);
  ICON.play(g, bar * .6, h - bar / 2, bar * .8, '#ffffff');
  const prog = m.progress != null ? m.progress : (t * .05) % 1;
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(bar * 1.2, h - bar * .55, w * .5, bar * .14);
  g.fillStyle = D('#ff4a4a'); g.fillRect(bar * 1.2, h - bar * .55, w * .5 * prog, bar * .14);
  g.font = `900 ${bar * .5}px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'right'; g.fillStyle = '#fff';
  if (m.views != null) g.fillText(fmt(m.views) + ' views', w - bar * .3, h - bar / 2);
  if (m.replay) { ICON.replay(g, w * .5 + bar * 2.1, h - bar / 2, bar * .9, '#ffe27a'); g.textAlign = 'left'; g.fillStyle = D('#ffe27a'); g.fillText('×' + m.replay, w * .5 + bar * 2.6, h - bar / 2); }
  if (m.published != null) {
    const k = m.published; g.fillStyle = `rgba(20,24,60,${.6 * Math.min(1, k * 4)})`; g.fillRect(0, 0, w, h);
    g.save(); g.translate(w / 2, h * .45); const sc = .7 + .3 * backOut(Math.min(1, k * 3)); g.scale(sc, sc);
    g.fillStyle = D('#fbf3df'); g.strokeStyle = D('#2a1a2c'); g.lineWidth = 10; g.beginPath(); g.roundRect(-w * .3, -h * .14, w * .6, h * .28, h * .06); g.fill(); g.stroke();
    g.fillStyle = D('#2a1a2c'); g.font = `900 ${h * .1}px ${FONT}`; g.textAlign = 'center'; g.fillText(k > .02 ? 'UPLOADED ✓' : '', 0, 4); g.restore();
  }
}
// a live screen: a canvas texture redrawn once per frame while its set is visible
function screen(w, h, sizeW, sizeH, gain = 1.35) {
  const t = canvasTex(w, h, () => {});
  const m = new THREE.Mesh(new THREE.PlaneGeometry(sizeW, sizeH), new THREE.MeshBasicMaterial({ map: t, color: HDR(gain, gain, gain) }));
  m.userData.noShadow = true; m.tex = t; m.last = -1;
  m.paint = (time, mode) => { const f = Math.round(time * FPS); if (f === m.last) return; m.last = f; drawScreen(t.g, w, h, time, mode); t.needsUpdate = true; };
  return m;
}

// ---------------------------------------------------------------- LIVING (x = 0)
const TV = V(0, 1.05, -2.55);
const KID_P = V(.15, 0, -.9), SOFA_P = V(-1.85, .42, -.5);
function buildLiving(scene) {
  const g = new THREE.Group(); scene.add(g);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(10, 9), painted(woodTex({ base: '#a86a3e', plank: 48, rep: [3, 3] }))); fl.rotation.x = -Math.PI / 2; g.add(fl);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4), painted(carpetTex({ base: '#c8506a', band: '#f0c050', rows: 2 }))); rug.rotation.x = -Math.PI / 2; rug.position.set(.3, .005, -.7); g.add(rug);
  // walls: a cool blue-violet paper with a pattern band, a window with the night city on the left
  const wall = (rep) => painted(wallTex({ base: '#5a6ab8', frame: '#2a2a58', cols: 1, rows: [], night: true, ashlar: [18, 9], rep }));
  const back = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.4), wall([1, 1])); back.position.set(0, 1.7, -3.2); g.add(back);
  const WIN = [-.7, 1.0, .7, 2.5];
  const lw = holedWall(9, 3.4, WIN, wall([1 / 9, 1 / 3.4])); lw.position.set(-3.6, 0, -.4); lw.rotation.y = Math.PI / 2; lw.castShadow = true; g.add(lw);
  const vm = vistaMat(nightCityTex({ seed: 5 }), { yaw: Math.atan2(-3.6 - 2.6, -.4 - .2), az: Math.PI / 2, el: [-10 * DEG, 35 * DEG], gain: 1.2 });
  const vp = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.7), vm); vp.position.set(-3.75, 1.75, -.4); vp.rotation.y = Math.PI / 2; g.add(vp);
  const cas = flat('#efe6d4');
  for (const [w, h, y, z] of [[.14, 1.64, 1.75, -1.17], [.14, 1.64, 1.75, .37], [1.68, .14, 2.57, -.4], [1.68, .12, .94, -.4]]) box(.2, h, w, cas, -3.52, y, z, g);
  const fr = frizTex({ ground: '#e8dcbc', a: '#f0b050', b: '#7ac8d8', c: '#d8506a' });
  for (const [x, z, ry, w] of [[0, -3.15, 0, 10], [-3.55, -.4, Math.PI / 2, 9]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, .42), painted(fr.clone())); m.material.map.repeat.set(w / 2, 1); m.material.map.needsUpdate = true; m.position.set(x, .42, z); m.rotation.y = ry; m.translateZ(.05); g.add(m); }
  // picture frames on the back wall (pattern on the big wall, away from the heads)
  const pics = [['#f0c050', '#3a6ab8'], ['#7ac8a0', '#d8506a'], ['#ffd8e0', '#5a4aa8']];
  pics.forEach(([a, b], i) => {
    const pt = canvasTex(256, 200, (c, w, h) => { c.fillStyle = a; c.fillRect(0, 0, w, h); c.fillStyle = b; c.beginPath(); c.arc(w * (.3 + i * .2), h * .55, h * .28, 0, 6.29); c.fill(); c.fillRect(0, h * .8, w, h * .2); });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(.56, .44), new THREE.MeshLambertMaterial({ map: pt })); p.position.set(-1.9 + i * .75 + (i === 2 ? 2.6 : 0), 2.35, -3.13); g.add(p);
    box(.64, .52, .03, flat('#e0b050'), p.position.x, 2.35, -3.155, g);
  });
  // TV on a low cabinet
  const wood = painted(woodTex({ base: '#8a5634' }));
  box(2.3, .5, .55, wood, 0, .25, -2.7, g);
  for (const x of [-.58, .58]) box(1.0, .36, .02, flat('#9a6440'), x, .25, -2.42, g);
  box(1.7, 1.0, .08, flat('#2a2a3e'), TV.x, TV.y, TV.z - .05, g);
  cyl(.04, .04, .3, flat('#3a3a4e'), 0, .62, -2.62, g);
  dyn.tv = screen(1024, 576, 1.56, .88); dyn.tv.position.copy(TV); dyn.tv.position.z += .0; g.add(dyn.tv);
  // plants and a little shelf of toys
  const pot = flat('#d8784a'), leaf = [flat('#3f9a58'), flat('#2f8a48')];
  cyl(.16, .12, .3, pot, -1.55, .65, -2.75, g); for (let k = 0; k < 5; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), leaf[k % 2]); l.position.set(-1.55 + Math.sin(k * 2.4) * .12, .95 + k * .05, -2.75 + Math.cos(k * 2.4) * .08); l.scale.set(1, 1.5, 1); g.add(l); }
  for (const [x, c] of [[1.1, '#e84a5a'], [1.35, '#ffd84a'], [1.58, '#4aa8e8']]) box(.16, .16, .16, flat(c), x, .58, -2.7, g);
  // sofa
  const sofaM = painted(carpetTex({ base: '#3f7a9a', band: '#5a96b4', rows: 1 }));
  box(.9, .42, 2.2, sofaM, SOFA_P.x - .1, .21, SOFA_P.z, g); box(.22, .5, 2.2, sofaM, SOFA_P.x - .5, .67, SOFA_P.z, g);
  for (const s of [-1, 1]) box(.9, .3, .22, sofaM, SOFA_P.x - .1, .55, SOFA_P.z + s * 1.0, g);
  // floor lamp (the warm pool)
  const brass = flat('#d9a441');
  cyl(.18, .2, .04, brass, -2.4, .02, -2.4, g); cyl(.018, .018, 1.6, brass, -2.4, .82, -2.4, g);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(.16, .28, .3, 24, 1, true), flat('#f2d6a0', { side: THREE.DoubleSide, emissive: '#7a5a20' })); sh.position.set(-2.4, 1.72, -2.4); g.add(sh); sh.userData.noShadow = true;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 10), new THREE.MeshBasicMaterial({ color: HDR(3.2, 2.3, 1.1) })); bulb.position.set(-2.4, 1.64, -2.4); bulb.userData.noShadow = true; g.add(bulb);
  const L = new THREE.Group();
  L.add(new THREE.HemisphereLight('#7a86e0', '#3a2a5a', 1.1));
  const tvL = spot('#9fe0ff', 5.5, [TV.x, TV.y, TV.z + .25], [.4, .4, 1.2], 1.05, { decay: 1, near: .1, far: 12, size: 2048 }); L.add(tvL); L.add(tvL.target); dyn.tvL = tvL;
  const lampL = new THREE.PointLight('#ffc070', 3.0, 0, 1.2); lampL.position.set(-2.4, 1.55, -2.4); L.add(lampL);
  const moon = spot('#a3b8ff', 1.8, [-9, 4.2, -.4], [0, 0, -.6], .3, { near: 3, far: 20 }); L.add(moon); L.add(moon.target);
  scene.add(L); sets.living = { g, L };
  shadows(g);
  dyn.lampGlow = glow(scene, [-2.4, 1.64, -2.4], '#ffc070', .5, .5);
  dyn.tvGlow = glow(scene, [TV.x, TV.y, TV.z + .02], '#8fd8ff', 2.4, .22);
}

// ---------------------------------------------------------------- STAGE (x = 100)
const PED = [V(98.2, 0, -1.2), V(100, 0, -1.4), V(101.8, 0, -1.2)];
const BOARD = V(100, 3.25, -2.6);
function buildStage(scene) {
  const g = new THREE.Group(); scene.add(g);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), painted(woodTex({ base: '#4a3a6a', plank: 40, rep: [4, 3] }))); fl.rotation.x = -Math.PI / 2; fl.position.set(100, 0, 0); g.add(fl);
  // the curtain: deep red folds, a gold fringe
  const ct = canvasTex(1024, 512, (c, w, h) => { for (let x = 0; x < w; x += 2) { const v = .5 + .5 * Math.sin(x / w * Math.PI * 28); c.fillStyle = shade('#b0303e', .62 + .5 * v); c.fillRect(x, 0, 2, h); } c.fillStyle = '#e0b050'; c.fillRect(0, h - 26, w, 26); c.strokeStyle = shade('#e0b050', .6); c.lineWidth = 3; for (let x = 0; x < w; x += 16) { c.beginPath(); c.moveTo(x, h - 26); c.lineTo(x + 8, h); c.stroke(); } });
  const cur = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), painted(ct)); cur.position.set(100, 3, -3.2); g.add(cur);
  // pedestals: round, gold rimmed
  const pm = flat('#f2ead8'), rim = flat('#e0b050');
  PED.forEach((p, i) => { cyl(.48, .52, .7, pm, p.x, .35, p.z, g, 32); const r = new THREE.Mesh(new THREE.TorusGeometry(.49, .03, 8, 48), rim); r.rotation.x = Math.PI / 2; r.position.set(p.x, .7, p.z); g.add(r); });
  // the three giants: a film reel + clapper, a star microphone, a pile of money
  const reel = new THREE.Group(); reel.position.set(PED[0].x, 1.15, PED[0].z); g.add(reel); dyn.reel = reel;
  const metal = flat('#9aa0b8');
  for (const z of [-.06, .06]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .03, 40), metal); d.rotation.x = Math.PI / 2; d.position.z = z; reel.add(d); }
  for (let k = 0; k < 5; k++) { const h = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .16, 16), flat('#3a3a58')); h.rotation.x = Math.PI / 2; const a = k / 5 * Math.PI * 2; h.position.set(Math.cos(a) * .24, Math.sin(a) * .24, 0); h.userData.noShadow = true; reel.add(h); }
  const film = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .1, 32), flat('#3a2a30')); film.rotation.x = Math.PI / 2; reel.add(film);
  const clap = box(.5, .34, .04, flat('#2a2a3a'), PED[0].x + .38, .88, PED[0].z + .3, g); clap.rotation.y = -.4;
  const clapTop = box(.52, .08, .05, flat('#f2f2f2'), PED[0].x + .38, 1.1, PED[0].z + .3, g); clapTop.rotation.set(0, -.4, .2);
  const mic = new THREE.Group(); mic.position.set(PED[1].x, .7, PED[1].z); g.add(mic); dyn.mic = mic;
  { const st = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 1.0, 8), metal); st.position.y = .5; mic.add(st);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.09, 16, 12), flat('#c8ccdc')); head.position.y = 1.08; mic.add(head);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.04, .03, .2, 12), flat('#2a2a3a')); handle.position.y = .95; mic.add(handle);
    const sh = new THREE.Shape(); for (let k = 0; k < 10; k++) { const r = k % 2 ? .1 : .24, a = k / 10 * Math.PI * 2 + Math.PI / 2; k ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const star = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .05, bevelEnabled: false }), flat('#ffd84a', { emissive: '#4a3a08' })); star.position.set(.3, 1.3, 0); mic.add(star); dyn.star = star; }
  const cash = new THREE.Group(); cash.position.set(PED[2].x, .7, PED[2].z); g.add(cash); dyn.cash = cash;
  { const bill = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#7ac87a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3a7a4a'; c.lineWidth = 6; c.strokeRect(10, 10, w - 20, h - 20); c.fillStyle = '#3a7a4a'; c.font = `900 64px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', w / 2, h / 2); });
    const bm = [flat('#5aa85a'), flat('#5aa85a'), new THREE.MeshLambertMaterial({ map: bill }), flat('#5aa85a'), flat('#5aa85a'), flat('#5aa85a')];
    const R = rng(3); for (let k = 0; k < 14; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.34, .09, .18), bm); const row = Math.floor(k / 4); b.position.set((k % 4 - 1.5) * .17 * (1 - row * .2), .05 + row * .09, (R() - .5) * .2); b.rotation.y = (R() - .5) * .5; cash.add(b); }
    for (let k = 0; k < 6; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .02, 16), flat('#ffd84a')); c.position.set(-.25 + k * .1, .02, .28); cash.add(c); } }
  // the simple drawing on an easel (the lesson) and the expensive rig behind it
  const easel = new THREE.Group(); easel.position.set(100, 0, .2); g.add(easel); dyn.easel = easel;
  { const wd = painted(woodTex({ base: '#b07a45' }));
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.05, 1.5, .05), wd); l.position.set(s * .3, .72, 0); l.rotation.z = -s * .12; easel.add(l); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(.05, 1.4, .05), wd); back.position.set(0, .68, -.28); back.rotation.x = .3; easel.add(back);
    const pt = canvasTex(512, 400, (c, w, h) => { c.fillStyle = '#fbf6ea'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3a8ad8'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); for (let x = 30; x < w - 30; x += 4) c.lineTo(x, h * .7 + Math.sin(x / 30) * 10); c.stroke(); drawFin(c, w / 2, h * .62, 220, .3); });
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(.78, .6), new THREE.MeshLambertMaterial({ map: pt })); pic.position.set(0, 1.15, .06); easel.add(pic);
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(.8, .04, .1), wd); ledge.position.set(0, .83, .05); easel.add(ledge); }
  const rig = new THREE.Group(); rig.position.set(101.7, 0, -.6); g.add(rig); dyn.rig = rig;
  { const dk = flat('#2a2a3a');
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2, l = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1.5, 6), dk); l.position.set(Math.cos(a) * .25, .7, Math.sin(a) * .25); l.rotation.set(Math.sin(a) * .18, 0, -Math.cos(a) * .18); rig.add(l); }
    const body = new THREE.Mesh(new THREE.BoxGeometry(.5, .32, .3), dk); body.position.y = 1.55; rig.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(.11, .13, .3, 20), flat('#4a4a5e')); lens.rotation.x = Math.PI / 2; lens.position.set(0, 1.55, .3); rig.add(lens);
    const lr = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .02, 8), flat('#e84a4a', { emissive: '#e84a4a' })); lr.position.set(.18, 1.74, .1); rig.add(lr);
    const bigL = new THREE.Group(); bigL.position.set(-3.2, 0, .3); rig.add(bigL);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 2.0, 8), dk); pole.position.y = 1.0; bigL.add(pole);
    const can = new THREE.Mesh(new THREE.BoxGeometry(.5, .4, .3), dk); can.position.y = 2.1; bigL.add(can); }
  rig.visible = false; easel.visible = false;
  // two globes (the population beat)
  dyn.globes = [];
  const gt = canvasTex(2048, 1024, (c, w, h) => drawMap(c, 0, 0, w, h, { lw: 4 }));
  for (const p of [PED[0], PED[2]]) { const s = new THREE.Mesh(new THREE.SphereGeometry(.4, 48, 32), new THREE.MeshLambertMaterial({ map: gt, emissive: '#ffffff', emissiveMap: gt, emissiveIntensity: .3 })); s.position.set(p.x, 1.15, p.z); s.visible = false; g.add(s); dyn.globes.push(s); }
  // the scoreboard: a dark panel with a gold frame, a live canvas
  box(4.6, 1.3, .12, flat('#2a2440'), BOARD.x, BOARD.y, BOARD.z - .08, g);
  for (const [w, h, x, y] of [[4.7, .08, 0, .66], [4.7, .08, 0, -.66], [.08, 1.4, -2.33, 0], [.08, 1.4, 2.33, 0]]) box(w, h, .08, flat('#e0b050'), BOARD.x + x, BOARD.y + y, BOARD.z, g);
  const bt = canvasTex(2048, 560, () => {});
  const bm = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 1.23), new THREE.MeshBasicMaterial({ map: bt, color: HDR(1.25, 1.25, 1.25) })); bm.position.set(BOARD.x, BOARD.y, BOARD.z - .01); bm.userData.noShadow = true; g.add(bm); dyn.board = { t: bt, key: '' };
  for (const s of [-1, 1]) cyl(.012, .012, 1.4, flat('#3a3a4a'), BOARD.x + s * 2, BOARD.y + 1.35, BOARD.z, g, 6);
  // a lighting truss with three cans: each pedestal has its spot
  box(7, .12, .12, flat('#3a3a4e'), 100, 4.4, .8, g);
  const L = new THREE.Group();
  L.add(new THREE.HemisphereLight('#6a6ae0', '#2a1a3a', .9));
  dyn.spots = [];
  const cans = [V(98.0, 4.3, .8), V(100, 4.3, .8), V(102.0, 4.3, .8)];
  cans.forEach((c, i) => {
    const cn = new THREE.Mesh(new THREE.CylinderGeometry(.12, .17, .32, 16), flat('#2a2a3a')); cn.position.copy(c); cn.lookAt(PED[i].x, 1, PED[i].z); cn.rotateX(Math.PI / 2); g.add(cn); cn.userData.noShadow = true;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.14, 20), new THREE.MeshBasicMaterial({ color: HDR(3, 2.6, 1.8) })); lens.position.copy(c).lerp(V(PED[i].x, 1, PED[i].z), .05); lens.lookAt(PED[i].x, 1, PED[i].z); g.add(lens);
    const sp = spot(i === 1 ? '#ffe2b0' : '#ffd090', 9, [c.x, c.y, c.z], [PED[i].x, .8, PED[i].z], .34, { decay: 0, near: 1, far: 12, size: 1024 }); L.add(sp); L.add(sp.target);
    const bm2 = beam(scene, [c.x, c.y - .1, c.z], [PED[i].x, 0, PED[i].z], { r0: .1, r1: .95, color: '#ffe8c0', strength: .16 });
    dyn.spots.push({ l: sp, beam: bm2, lens, base: 9 });
  });
  const back = new THREE.PointLight('#8a6aff', 2.2, 0, 1.2); back.position.set(100, 3, -2); L.add(back);
  scene.add(L); sets.stage = { g, L };
  shadows(g);
  // confetti
  const N = 260; const cg = new THREE.PlaneGeometry(.05, .03);
  const cm = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: '#ffffff' });
  dyn.confetti = new THREE.InstancedMesh(cg, cm, N); dyn.confetti.layers.set(1); dyn.confetti.frustumCulled = false; dyn.confetti.visible = false; scene.add(dyn.confetti);
  const cols = ['#ff5a6a', '#ffd84a', '#5ad0ff', '#7ae08a', '#ff9ae0', '#ffffff'].map(c => new THREE.Color(c).multiplyScalar(1.1));
  for (let i = 0; i < N; i++) dyn.confetti.setColorAt(i, cols[i % cols.length]);
}
function drawBoard(mode) {
  const key = JSON.stringify(mode); if (key === dyn.board.key) return; dyn.board.key = key;
  const g = dyn.board.t.g, w = 2048, h = 560;
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, D('#1a1640')); gr.addColorStop(1, D('#2a1f5a')); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = D('#3a3470'); g.lineWidth = 2; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (mode.race) {
    const [a, b] = mode.race, max = 8.2e9;
    const row = (y, name, v, c, lead) => {
      g.font = `900 70px ${FONT}`; g.textAlign = 'left'; g.fillStyle = D('#fbf3df'); g.fillText(name, 60, y);
      g.fillStyle = D('#3a3470'); g.fillRect(560, y - 40, 1100, 80);
      g.fillStyle = D(c); g.fillRect(560, y - 40, 1100 * Math.min(1, v / max), 80);
      g.textAlign = 'right'; g.fillStyle = D(lead ? '#ffe27a' : '#fbf3df'); g.font = `900 64px ${FONT}`; g.fillText((v / 1e9).toFixed(2) + ' B', w - 50, y);
    };
    row(h * .32, 'DESPACITO', a, '#8a7ae0', a > b); row(h * .7, 'BABY SHARK', b, '#ff9a3a', b > a);
    dyn.board.t.needsUpdate = true; return;
  }
  g.font = `900 ${mode.small ? 100 : 230}px ${FONT}`; g.fillStyle = D(mode.gold ? '#ffe27a' : '#fbf3df');
  g.fillText(mode.text, w / 2, h * (mode.sub ? .42 : .52));
  if (mode.sub) { g.font = `900 80px ${FONT}`; g.fillStyle = D('#9fd0ff'); g.fillText(mode.sub, w / 2, h * .82); }
  dyn.board.t.needsUpdate = true;
}

// ---------------------------------------------------------------- world map (equirectangular), coarse outlines
const LAND = [
  [[-168, 66], [-140, 70], [-110, 72], [-80, 72], [-62, 60], [-55, 50], [-66, 44], [-75, 35], [-81, 25], [-97, 26], [-97, 18], [-87, 15], [-80, 8], [-92, 14], [-105, 20], [-112, 30], [-118, 34], [-124, 40], [-125, 49], [-135, 57], [-150, 60], [-165, 62]],
  [[-50, 60], [-42, 60], [-20, 70], [-20, 80], [-45, 83], [-60, 78], [-55, 68]],
  [[-80, 8], [-72, 12], [-60, 10], [-50, 0], [-35, -6], [-40, -22], [-48, -28], [-58, -38], [-65, -42], [-68, -55], [-75, -50], [-72, -30], [-70, -18], [-76, -12], [-81, -4]],
  [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [2, 51], [5, 53], [8, 57], [5, 62], [15, 69], [28, 71], [40, 67], [60, 70], [80, 73], [100, 77], [130, 72], [160, 70], [180, 66], [175, 62], [160, 58], [140, 54], [135, 43], [129, 35], [126, 37], [122, 38], [122, 30], [110, 20], [105, 10], [100, 13], [98, 8], [92, 22], [80, 15], [77, 8], [72, 20], [66, 25], [58, 25], [52, 28], [48, 30], [56, 24], [59, 22], [52, 16], [44, 13], [38, 22], [34, 28], [35, 32], [36, 36], [27, 37], [22, 37], [18, 40], [15, 38], [12, 44], [8, 44], [3, 43], [-1, 37]],
  [[-5, 50], [1, 51], [2, 53], [-1, 55], [-2, 57], [-4, 58.5], [-6, 57], [-5, 55], [-3, 54], [-5, 52]],
  [[-17, 15], [-17, 21], [-13, 28], [-6, 36], [10, 37], [11, 33], [20, 31], [30, 31], [32, 31], [35, 28], [43, 12], [51, 12], [42, -2], [40, -15], [35, -24], [27, -34], [19, -35], [13, -20], [12, -6], [9, 4], [-8, 4], [-14, 10]],
  [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -26], [150, -37], [140, -38], [132, -32], [115, -34]],
  [[44, -25], [50, -15], [49, -12], [44, -16]],
  [[130, 31], [135, 34], [140, 36], [142, 40], [141, 45], [139, 42], [136, 36], [131, 34]],
];
function drawMap(g, x, y, w, h, { l0 = -180, l1 = 180, b0 = -90, b1 = 90, sea = '#3f7fd0', land = '#86c26c', coast = '#2a4a3a', lw = 3, ice = true } = {}) {
  const X = lon => x + (lon - l0) / (l1 - l0) * w, Y = lat => y + (b1 - lat) / (b1 - b0) * h;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = sea; g.fillRect(x, y, w, h);
  const R = rng(7); for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(255,255,255,${.03 + R() * .04})`; g.beginPath(); g.ellipse(x + R() * w, y + R() * h, w * .01 + R() * w * .03, h * .006 + R() * h * .012, 0, 0, 6.29); g.fill(); }
  const poly = (P, fill) => { g.beginPath(); P.forEach(([lo, la], i) => i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la))); g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = coast; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(); };
  for (const P of LAND) poly(P, land);
  if (ice) { g.fillStyle = '#f2f4fa'; g.fillRect(x, Y(-72), w, h); g.strokeStyle = coast; g.lineWidth = lw; g.beginPath(); g.moveTo(x, Y(-72)); g.lineTo(x + w, Y(-72)); g.stroke(); }
  g.restore();
  return { X, Y };
}
// places where the song spread (lon, lat), Seoul first
const SPOTS = [[127, 37.5], [106.8, -6.2], [139.7, 35.7], [121, 14.6], [100.5, 13.7], [77.2, 28.6], [-0.1, 51.5], [2.3, 48.9], [13.4, 52.5], [-3.7, 40.4], [12.5, 41.9], [28.9, 41], [37.6, 55.7], [31.2, 30], [3.4, 6.5], [28, -26.2], [-74, 40.7], [-118.2, 34], [-87.6, 41.9], [-79.4, 43.7], [-99.1, 19.4], [-46.6, -23.5], [-58.4, -34.6], [-77, -12], [151.2, -33.9], [174.8, -36.8], [55.3, 25.2], [44.4, 33.3], [-43.2, -22.9], [116.4, 39.9], [121.5, 31.2], [103.8, 1.35], [90.4, 23.8], [67, 24.9], [36.8, -1.3], [18.4, -33.9], [-123.1, 49.3], [-66.9, 10.5], [10.7, 59.9], [24.9, 60.2]];

// ---------------------------------------------------------------- STUDIO (x = 200)
const DESK = V(200, 0, -1.2), MON = V(200.55, 1.12, -1.25);
function seoulTex() {
  // a painted day panorama: hills, a city of towers, a slim tower on a green hill (ours, not a landmark copy), soft clouds
  const w = 4096, h = 2048, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const R = rng(41);
  const el0 = -12, el1 = 34, Y = e => h * (1 - (e - el0) / (el1 - el0));
  let gr = g.createLinearGradient(0, 0, 0, Y(0)); gr.addColorStop(0, D('#5aa0ec')); gr.addColorStop(1, D('#cfe6ff')); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = D('#ffffff', .85); for (let i = 0; i < 14; i++) { const x = R() * w, y = Y(14 + R() * 16); for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + k * 60 - 120, y + Math.sin(k) * 14, 120 + R() * 60, 40 + R() * 20, 0, 0, 6.29); g.fill(); } }
  const ridge = (base, amp, col, seed) => { const r = rng(seed); g.fillStyle = D(col); g.beginPath(); g.moveTo(0, h); let y = Y(base); for (let x = 0; x <= w; x += 40) { y = Y(base + amp * (.5 + .5 * Math.sin(x / w * 9 + seed) * Math.cos(x / w * 4 + seed * 2)) + r() * .3); g.lineTo(x, y); } g.lineTo(w, h); g.fill(); };
  ridge(3, 7, '#8aa8d8', 3); ridge(1.5, 5, '#6a9a8a', 5);
  // the slim tower on a hill
  const tx = w * .62; g.fillStyle = D('#5a8a5a'); g.beginPath(); g.ellipse(tx, Y(1), 360, Y(0) - Y(7), 0, Math.PI, 0); g.fill();
  g.fillStyle = D('#f2ece0'); g.fillRect(tx - 14, Y(16), 28, Y(6) - Y(16)); g.beginPath(); g.ellipse(tx, Y(14), 60, 26, 0, 0, 6.29); g.fill(); g.fillRect(tx - 4, Y(20), 8, Y(16) - Y(20));
  g.strokeStyle = 'rgba(30,30,60,.6)'; g.lineWidth = 4; g.strokeRect(tx - 14, Y(16), 28, Y(6) - Y(16));
  // towers
  for (let i = 0; i < 70; i++) {
    const bx = R() * w, bw = 60 + R() * 140, bh = 2 + R() * 7, col = ['#e8e2d8', '#c8d4e8', '#f2d8c0', '#b8c8e0', '#e0e8f0'][i % 5];
    g.fillStyle = D(col); g.fillRect(bx, Y(bh), bw, Y(-2) - Y(bh));
    g.fillStyle = D(shade(col, .78)); for (let yy = Y(bh) + 18; yy < Y(-1); yy += 30) for (let xx = bx + 10; xx < bx + bw - 14; xx += 22) g.fillRect(xx, yy, 12, 14);
    g.strokeStyle = 'rgba(30,30,60,.55)'; g.lineWidth = 3; g.strokeRect(bx, Y(bh), bw, Y(-2) - Y(bh));
  }
  g.fillStyle = D('#6a8ab0'); g.fillRect(0, Y(-2), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildStudio(scene) {
  const g = new THREE.Group(); scene.add(g);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(10, 9), painted(woodTex({ base: '#c89a68', plank: 40, rep: [3, 3] }))); fl.rotation.x = -Math.PI / 2; fl.position.set(200, 0, 0); g.add(fl);
  const wallM = rep => painted(wallTex({ base: '#e8d8c0', frame: '#6a4a3a', cols: 1, rows: [], ashlar: [16, 8], rep }));
  // back wall with a big window: sky, hills, towers
  const WIN = [-2.9, .9, -.4, 2.7];
  const bw = holedWall(10, 3.6, WIN, painted(wallTex({ base: '#b8d0f0', frame: '#4a5a8a', cols: 1, rows: [], ashlar: [16, 8], rep: [1 / 10, 1 / 3.6] }))); bw.position.set(200, 0, -3); bw.castShadow = true; g.add(bw);
  const vm = vistaMat(seoulTex(), { yaw: Math.atan2(-1.65 - .6, -3 - 3.5), az: 95 * DEG, el: [-12 * DEG, 34 * DEG], gain: 1.15 });
  const vp = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.0), vm); vp.position.set(198.35, 1.8, -3.15); g.add(vp);
  const cas = flat('#f6f0e4');
  for (const [w, h, x, y] of [[2.66, .12, -1.65, 2.76], [2.66, .14, -1.65, .86], [.12, 1.9, -2.96, 1.8], [.12, 1.9, -.34, 1.8], [.06, 1.8, -1.65, 1.8]]) box(w, h, .16, cas, 200 + x, y, -2.95, g);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.6), wallM([1, 1])); side.position.set(204.2, 1.8, 0); side.rotation.y = -Math.PI / 2; g.add(side);
  // a corkboard of sketches (pattern on the wall), the calendar
  const cork = canvasTex(1024, 640, (c, w, h) => { c.fillStyle = '#c8945a'; c.fillRect(0, 0, w, h); const R = rng(9); for (let i = 0; i < 600; i++) { c.fillStyle = `rgba(90,50,20,${R() * .25})`; c.fillRect(R() * w, R() * h, 3, 3); }
    for (let i = 0; i < 9; i++) { const x = 40 + (i % 3) * 320 + R() * 30, y = 40 + Math.floor(i / 3) * 200 + R() * 20; c.fillStyle = ['#fbf6ea', '#ffe8a8', '#d8ecff'][i % 3]; c.fillRect(x, y, 240, 160); c.strokeStyle = '#3a8ad8'; c.lineWidth = 5; c.beginPath(); for (let k = 0; k < 6; k++) c.lineTo(x + 20 + k * 40, y + 120 + Math.sin(k + i) * 10); c.stroke(); drawFin(c, x + 120, y + 100, 80 + R() * 30, i); c.fillStyle = '#e84a5a'; c.beginPath(); c.arc(x + 120, y + 10, 9, 0, 6.29); c.fill(); } });
  const cb = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.25), new THREE.MeshLambertMaterial({ map: cork })); cb.position.set(204.15, 1.9, -.9); cb.rotation.y = -Math.PI / 2; g.add(cb);
  box(.04, 1.33, 2.08, flat('#8a5634'), 204.17, 1.9, -.9, g);
  const cal = canvasTex(400, 480, (c, w, h) => { c.fillStyle = D('#fbf6ea'); c.fillRect(0, 0, w, h); c.fillStyle = D('#e84a5a'); c.fillRect(0, 0, w, 130); c.fillStyle = '#fff'; c.font = `900 72px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('JUNE', w / 2, 68);
    c.fillStyle = D('#2a1a2c'); c.font = `900 120px ${FONT}`; c.fillText('2016', w / 2, 250); c.font = `900 30px ${FONT}`; c.fillStyle = D('#8a7a8a'); for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) c.fillText(String(1 + r * 7 + k), 40 + k * 53, 350 + r * 42); });
  const calM = new THREE.Mesh(new THREE.PlaneGeometry(.55, .66), new THREE.MeshBasicMaterial({ map: cal, color: HDR(.92, .92, .92) })); calM.position.set(200.9, 1.95, -2.94); g.add(calM); dyn.cal = calM;
  // desk, chair, monitor, tablet, a desk lamp (warm second source)
  const wood = painted(woodTex({ base: '#f2e2c8' }));
  box(2.0, .06, .8, wood, DESK.x + .2, .76, DESK.z, g);
  for (const [dx, dz] of [[-.75, -.34], [1.15, -.34], [-.75, .34], [1.15, .34]]) box(.05, .74, .05, flat('#3a3a4e'), DESK.x + dx, .37, DESK.z + dz, g);
  box(.9, .05, .5, flat('#3a3a4e'), DESK.x - .25, .5, DESK.z - .75, g);
  const mon = new THREE.Group(); mon.position.copy(MON); mon.rotation.y = -.55; g.add(mon); dyn.mon = mon;
  { const bd = new THREE.Mesh(new THREE.BoxGeometry(.86, .54, .04), flat('#2a2a3e')); bd.position.z = -.025; mon.add(bd);
    const st = new THREE.Mesh(new THREE.BoxGeometry(.06, .3, .04), flat('#3a3a4e')); st.position.set(0, -.36, -.05); mon.add(st);
    const ft = new THREE.Mesh(new THREE.BoxGeometry(.3, .02, .2), flat('#3a3a4e')); ft.position.set(0, -.5, -.05); mon.add(ft); }
  dyn.monS = screen(768, 432, .8, .45, 1.25); mon.add(dyn.monS);
  const brass = flat('#d9a441');
  cyl(.07, .08, .02, brass, DESK.x + 1.0, .8, DESK.z - .25, g); cyl(.012, .012, .38, brass, DESK.x + 1.0, .98, DESK.z - .25, g);
  const ls = new THREE.Mesh(new THREE.ConeGeometry(.12, .14, 20, 1, true), flat('#e84a5a', { side: THREE.DoubleSide })); ls.position.set(DESK.x + 1.0, 1.2, DESK.z - .25); ls.userData.noShadow = true; g.add(ls);
  const lb = new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 8), new THREE.MeshBasicMaterial({ color: HDR(3, 2.3, 1.2) })); lb.position.set(DESK.x + 1.0, 1.14, DESK.z - .25); lb.userData.noShadow = true; g.add(lb);
  for (const [x, c] of [[-.2, '#3a6ab8'], [-.05, '#ffd84a']]) box(.22, .03, .3, flat(c), DESK.x + x, .8 + (c === '#ffd84a' ? .03 : 0), DESK.z - .1, g);
  // plant
  cyl(.15, .12, .32, flat('#3a8ab8'), 203.4, .16, -2.4, g); for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(.2, 10, 8), flat(k % 2 ? '#3f9a58' : '#2f8a48')); l.position.set(203.4 + Math.sin(k * 2.1) * .14, .5 + k * .06, -2.4 + Math.cos(k * 2.1) * .1); l.scale.set(1, 1.5, 1); g.add(l); }
  const L = new THREE.Group();
  L.add(new THREE.HemisphereLight('#c8d8ff', '#b0a0b8', 2.7));
  const sun = new THREE.DirectionalLight('#ffe0a8', 3.3); sun.position.set(196.5, 6, -8); sun.target.position.set(200.5, 0, -.5);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 }); sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; sun.shadow.radius = 3;
  L.add(sun); L.add(sun.target); dyn.stSun = V(4, -6, 7.5).normalize();
  const lampL = new THREE.PointLight('#ffc880', 1.2, 2.5, 1.5); lampL.position.set(DESK.x + 1.0, 1.1, DESK.z - .25); L.add(lampL);
  scene.add(L); sets.studio = { g, L };
  shadows(g);
  dyn.stBeam = beam(scene, [198.35, 1.8, -3.0], [199.4, 0, -.3], { r0: .9, r1: 1.2, color: '#ffe9b8', strength: .1 });
}

// ---------------------------------------------------------------- CAMP (x = 300)
const FIRE = V(300, 0, -.6);
function buildCamp(scene) {
  const g = new THREE.Group(); scene.add(g);
  const gt = canvasTex(1024, 1024, (c, w, h) => { c.fillStyle = '#3a5a5a'; c.fillRect(0, 0, w, h); const R = rng(4); for (let i = 0; i < 2500; i++) { c.fillStyle = ['#2f4f50', '#4a6a5a', '#3a5f58'][i % 3]; c.fillRect(R() * w, R() * h, 4, 10); } });
  gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(4, 4);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), painted(gt)); fl.rotation.x = -Math.PI / 2; fl.position.set(300, 0, -4); g.add(fl);
  const dirt = new THREE.Mesh(new THREE.CircleGeometry(1.9, 40), painted(stoneTex({ base: '#8a6a58', bw: 40, bh: 24 }))); dirt.rotation.x = -Math.PI / 2; dirt.position.set(FIRE.x, .004, FIRE.z); g.add(dirt);
  // stone ring, logs, flames
  const st = flat('#9a94a8');
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, s = new THREE.Mesh(new THREE.SphereGeometry(.11, 10, 8), st); s.scale.set(1.2, .7, 1); s.position.set(FIRE.x + Math.cos(a) * .42, .06, FIRE.z + Math.sin(a) * .42); g.add(s); }
  const logM = painted(woodTex({ base: '#6a4028', vertical: true }));
  for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .62, 10), logM); l.position.set(FIRE.x, .18, FIRE.z); l.rotation.set(.9, k * Math.PI / 2 + .4, 0); g.add(l); }
  dyn.flames = [];
  for (const [dx, dz, s, c] of [[0, 0, 1, [3.4, 1.7, .4]], [.08, .05, .7, [3.6, 2.4, .7]], [-.08, -.04, .75, [3.2, 1.4, .35]], [0, .02, .45, [3.8, 3.2, 1.4]]]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(.17 * s, .6 * s, 16), new THREE.MeshBasicMaterial({ color: HDR(...c), transparent: true, opacity: .95 })); f.position.set(FIRE.x + dx, .25 + .3 * s, FIRE.z + dz); f.userData.noShadow = true; f.layers.set(1); scene.add(f); dyn.flames.push({ f, s, y: f.position.y });
  }
  // log seats around the fire
  dyn.seats = [[-1.25, -.25], [-.55, .55], [.6, .55], [1.25, -.3]];
  for (const [dx, dz] of dyn.seats) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.16, .17, .8, 12), logM); l.rotation.z = Math.PI / 2; l.rotation.y = Math.atan2(dx, dz) + Math.PI / 2; l.position.set(FIRE.x + dx, .16, FIRE.z + dz); g.add(l); }
  // trees: trunks and stacked cones, dark teal against the night
  const trunk = painted(woodTex({ base: '#5a3a2a', vertical: true })), pine = [flat('#2a5a5a'), flat('#2f6a60'), flat('#245050')];
  const R = rng(23);
  for (let i = 0; i < 26; i++) {
    const a = R() * Math.PI * 2, r = 3.2 + R() * 6, x = FIRE.x + Math.cos(a) * r, z = FIRE.z - 1.5 + Math.sin(a) * r * .7 - 1;
    if (z > FIRE.z - 1.6 && Math.abs(x - FIRE.x) < 4.5) continue; if (z > 1.0) continue;
    const s = .9 + R() * .9; cyl(.1 * s, .14 * s, 1 * s, trunk, x, .5 * s, z, g, 8);
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry((1.0 - k * .25) * s, 1.3 * s, 12), pine[k]); c.position.set(x, (1.3 + k * .75) * s, z); g.add(c); }
  }
  // a tent
  const tent = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.4, 4), flat('#e8a03a')); tent.position.set(FIRE.x + 2.6, .7, FIRE.z - 2.2); tent.rotation.y = .5; g.add(tent);
  // star sky dome
  const sky = canvasTex(2048, 1024, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, D('#0f1640')); gr.addColorStop(.5, D('#1f2a6a')); gr.addColorStop(1, D('#3a3a8a')); c.fillStyle = gr; c.fillRect(0, 0, w, h); const R2 = rng(5); for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(255,255,240,${.3 + R2() * .7})`; c.beginPath(); c.arc(R2() * w, R2() * h * .5, R2() * 2.2 + .4, 0, 6.29); c.fill(); } });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, color: HDR(1.1, 1.1, 1.1) })); dome.position.set(300, 0, 0); dome.userData.noShadow = true; g.add(dome);
  const moonD = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 16), new THREE.MeshBasicMaterial({ color: HDR(2.2, 2.2, 2.0) })); moonD.position.set(280, 22, -45); moonD.userData.noShadow = true; g.add(moonD);
  const L = new THREE.Group();
  L.add(new THREE.HemisphereLight('#5a6ad8', '#2a2a4a', 1.0));
  const fireL = new THREE.PointLight('#ffa850', 7, 0, 1.3); fireL.position.set(FIRE.x, .7, FIRE.z); fireL.castShadow = true;
  fireL.shadow.mapSize.set(1024, 1024); fireL.shadow.camera.near = .1; fireL.shadow.camera.far = 20; fireL.shadow.bias = -.002; fireL.shadow.normalBias = .04; fireL.shadow.radius = 4; L.add(fireL); dyn.fireL = fireL;
  const moon = spot('#9fb4ff', 1.6, [282, 22, -40], [300, 0, -1], .2, { near: 20, far: 80 }); L.add(moon); L.add(moon.target);
  scene.add(L); sets.camp = { g, L };
  shadows(g); dome.receiveShadow = false; dome.castShadow = false;
  dyn.fireGlow = glow(scene, [FIRE.x, .55, FIRE.z], '#ffa850', 1.4, .35);
}

// ---------------------------------------------------------------- CLASS (x = 400)
const BB = V(399.0, 1.75, -2.9), MAP = V(401.9, 1.75, -2.9);
function buildClass(scene) {
  const g = new THREE.Group(); scene.add(g);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(10, 9), painted(stoneTex({ base: '#d8c8a8', bw: 64, bh: 64, rep: [5, 4] }))); fl.rotation.x = -Math.PI / 2; fl.position.set(400, 0, 0); g.add(fl);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.6), painted(wallTex({ base: '#8ac0b8', frame: '#3a6a6a', cols: 1, rows: [], ashlar: [16, 8] }))); back.position.set(400, 1.8, -3); g.add(back);
  const WIN = [-1.4, 1.0, 1.4, 2.7];
  const lw = holedWall(9, 3.6, WIN, painted(wallTex({ base: '#8ac0b8', frame: '#3a6a6a', cols: 1, rows: [], ashlar: [16, 8], rep: [1 / 9, 1 / 3.6] }))); lw.position.set(396.2, 0, 0); lw.rotation.y = Math.PI / 2; lw.castShadow = true; g.add(lw);
  const vm = vistaMat(dayGardenTex(), { yaw: Math.atan2(396.2 - 402, 0 - 3.4), az: Math.PI / 2, el: [-20 * DEG, 25 * DEG], gain: 1.1 });
  const vp = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.9), vm); vp.position.set(396.05, 1.85, 0); vp.rotation.y = Math.PI / 2; g.add(vp);
  const cas = flat('#f6f0e4');
  for (const [w, h, y, z] of [[.12, 1.8, 1.85, -1.45], [.12, 1.8, 1.85, 1.45], [.12, 1.8, 1.85, 0], [3.0, .12, 2.76, 0], [3.0, .14, .95, 0]]) box(.18, h, w, cas, 396.28, y, z, g);
  const fr = frizTex({ ground: '#f1e6c8', a: '#f0c455', b: '#e8603f', c: '#5a8ae0' });
  const band = new THREE.Mesh(new THREE.PlaneGeometry(10, .4), painted(fr)); band.material.map.repeat.set(5, 1); band.position.set(400, .5, -2.95); g.add(band);
  // blackboard (a live canvas: it fills in beat by beat)
  box(3.3, 1.5, .06, flat('#8a5634'), BB.x, BB.y, BB.z - .02, g);
  const bt = canvasTex(1600, 720, () => {});
  const bm = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.36), new THREE.MeshLambertMaterial({ map: bt })); bm.position.set(BB.x, BB.y, BB.z + .02); g.add(bm); dyn.bb = { t: bt, key: '' };
  box(3.1, .05, .1, flat('#8a5634'), BB.x, BB.y - .72, BB.z + .05, g);
  // the world map poster with spreading lights
  const mapT = canvasTex(1600, 800, () => {});
  const mm = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshBasicMaterial({ map: mapT, color: HDR(1.05, 1.05, 1.05) })); mm.position.set(MAP.x, MAP.y, MAP.z + .03); g.add(mm); dyn.map = { t: mapT, n: -1 };
  box(2.3, 1.2, .04, flat('#e0b050'), MAP.x, MAP.y, MAP.z, g);
  // desks and chairs
  const wood = painted(woodTex({ base: '#d8a868' }));
  dyn.deskP = [[398.6, .2], [400.2, .2], [398.6, 1.5], [400.2, 1.5]];
  for (const [x, z] of dyn.deskP) { box(.9, .05, .5, wood, x, .62, z - .1, g); for (const [dx, dz] of [[-.4, -.2], [.4, -.2], [-.4, .2], [.4, .2]]) box(.04, .6, .04, flat('#4a5a7a'), x + dx, .3, z - .1 + dz, g); }
  // a chart on an easel (Hot 100 beat)
  const easel = new THREE.Group(); easel.position.set(402.9, 0, -.9); easel.rotation.y = -.45; g.add(easel); dyn.chart = easel;
  { const wd = painted(woodTex({ base: '#8a5634' })); for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.05, 1.6, .05), wd); l.position.set(s * .35, .78, 0); l.rotation.z = -s * .1; easel.add(l); }
    const ct = canvasTex(600, 760, (c, w, h) => { c.fillStyle = D('#fbf6ea'); c.fillRect(0, 0, w, h); c.fillStyle = D('#2a1a2c'); c.font = `900 84px ${FONT}`; c.textAlign = 'center'; c.fillText('HOT 100', w / 2, 100);
      c.font = `900 40px ${FONT}`; c.fillStyle = D('#8a7a8a'); c.fillText('20 WEEKS', w / 2, 160); c.strokeStyle = D('#c8b8a8'); c.lineWidth = 3; for (let y = 220; y < h - 40; y += 80) { c.beginPath(); c.moveTo(60, y); c.lineTo(w - 40, y); c.stroke(); }
      c.strokeStyle = D('#ff7a2a'); c.lineWidth = 14; c.lineJoin = 'round'; c.beginPath(); const pts = [[70, 660], [140, 560], [210, 520], [280, 430], [350, 400], [420, 360], [490, 330], [550, 300]]; pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); drawFin(c, 550, 290, 70, 0); });
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(.75, .95), new THREE.MeshLambertMaterial({ map: ct })); pm.position.set(0, 1.25, .06); easel.add(pm); }
  const L = new THREE.Group();
  L.add(new THREE.HemisphereLight('#cfdcff', '#8a7aa0', 1.9));
  const sun = new THREE.DirectionalLight('#ffe0a8', 3.2); sun.position.set(390, 5.5, 2.5); sun.target.position.set(400, 0, -.5);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 }); sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; sun.shadow.radius = 3;
  L.add(sun); L.add(sun.target); dyn.clSun = V(10, -5.5, -3).normalize();
  scene.add(L); sets.cls = { g, L };
  shadows(g);
  dyn.clBeam = beam(scene, [396.1, 1.9, 0], [399, 0, -.6], { r0: 1.2, r1: 1.6, color: '#ffe9b8', strength: .08 });
}
function drawBoardChalk(stage) {
  const key = String(stage); if (key === dyn.bb.key) return; dyn.bb.key = key;
  const g = dyn.bb.t.g, w = 1600, h = 720;
  g.fillStyle = '#2f5a4a'; g.fillRect(0, 0, w, h); const R = rng(3); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${R() * .05})`; g.fillRect(R() * w, R() * h, 40, 6); }
  g.strokeStyle = '#f4f0e4'; g.fillStyle = '#f4f0e4'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
  g.font = `900 70px ${FONT}`; g.textAlign = 'center';
  if (stage >= 1) { g.fillText('REPEAT', w / 2, 100); g.beginPath(); g.arc(w / 2, 300, 120, -.4, 5.2); g.stroke(); g.beginPath(); g.moveTo(w / 2 + 120 * Math.cos(-.4) + 30, 300 + 120 * Math.sin(-.4) - 10); g.lineTo(w / 2 + 110, 240); g.lineTo(w / 2 + 120 * Math.cos(-.4) - 10, 300 + 120 * Math.sin(-.4) + 40); g.stroke(); }
  if (stage >= 2) { ICON.note(g, 260, 360, 220, '#ffe8a0'); g.font = `900 52px ${FONT}`; g.fillStyle = '#ffe8a0'; g.fillText('EASY TO REMEMBER', 270, 560); }
  if (stage >= 3) { g.strokeStyle = '#a8e0ff'; g.lineWidth = 10; const st = (x, up) => { g.beginPath(); g.arc(x, 260, 30, 0, 6.29); g.stroke(); g.beginPath(); g.moveTo(x, 290); g.lineTo(x, 400); g.moveTo(x, 400); g.lineTo(x - 30, 470); g.moveTo(x, 400); g.lineTo(x + 30, 470); g.moveTo(x, 320); g.lineTo(x - 55, up ? 250 : 360); g.moveTo(x, 320); g.lineTo(x + 55, up ? 250 : 360); g.stroke(); };
    st(1240, true); st(1400, false); g.font = `900 52px ${FONT}`; g.fillStyle = '#a8e0ff'; g.fillText('EASY TO COPY', 1320, 560); }
  if (stage >= 4) { g.font = `900 52px ${FONT}`; g.fillStyle = '#ffb8d8'; g.fillText('BRIGHT COLORS', w / 2, 560); for (let k = 0; k < 5; k++) { g.fillStyle = ['#ff6a6a', '#ffd84a', '#6ad8ff', '#8ae08a', '#ff9ae0'][k]; g.beginPath(); g.arc(w / 2 - 200 + k * 100, 640, 30, 0, 6.29); g.fill(); } }
  dyn.bb.t.needsUpdate = true;
}
function drawWorldMap(n) {
  if (n === dyn.map.n) return; dyn.map.n = n;
  const g = dyn.map.t.g, w = 1600, h = 800;
  const { X, Y } = drawMap(g, 0, 0, w, h, { lw: 4, b0: -60, b1: 80, sea: D('#3f7fd0'), land: D('#86c26c'), coast: D('#2a4a3a'), ice: false });
  for (let i = 0; i < Math.min(n, SPOTS.length); i++) { const [lo, la] = SPOTS[i]; const x = X(lo), y = Y(la);
    const gr = g.createRadialGradient(x, y, 0, x, y, 34); gr.addColorStop(0, 'rgba(255,240,160,1)'); gr.addColorStop(.35, 'rgba(255,170,60,.8)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 34, 0, 6.29); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, 7, 0, 6.29); g.fill(); }
  if (n > 0) { g.strokeStyle = 'rgba(255,220,120,.7)'; g.lineWidth = 3; g.setLineDash([10, 10]); const [l0, b0] = SPOTS[0]; for (let i = 1; i < Math.min(n, SPOTS.length); i++) { const [lo, la] = SPOTS[i]; g.beginPath(); g.moveTo(X(l0), Y(b0)); g.quadraticCurveTo((X(l0) + X(lo)) / 2, Math.min(Y(b0), Y(la)) - 80, X(lo), Y(la)); g.stroke(); } g.setLineDash([]); }
  dyn.map.t.needsUpdate = true;
}

// ---------------------------------------------------------------- CITY (x = 500)
function buildCity(scene) {
  const g = new THREE.Group(); scene.add(g);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), painted(stoneTex({ base: '#5a5a7a', bw: 128, bh: 128, rep: [10, 5] }))); road.rotation.x = -Math.PI / 2; road.position.set(500, 0, -5); g.add(road);
  const walk = new THREE.Mesh(new THREE.BoxGeometry(60, .12, 2.2), painted(stoneTex({ base: '#9a96b0', bw: 64, bh: 64, rep: [30, 1] }))); walk.position.set(500, .06, -2.3); g.add(walk);
  // apartment blocks: boxes in cool tones, with window instances
  const blocks = [[-9, -6, 5, 9, '#6a7ab8'], [-3.4, -5.2, 5.5, 12, '#8a6aa8'], [2.4, -5.8, 5, 10, '#5a8aa8'], [8, -5.3, 5.2, 13, '#7a7aa8'], [13.6, -6.2, 5, 8, '#6a8a9a'], [-14.5, -6.5, 5, 11, '#7a6a9a'],
    [-6, -16, 7, 18, '#4a5a90'], [3, -17, 7, 22, '#54508a'], [12, -15, 7, 16, '#4a6488'], [-15, -15, 7, 20, '#504a80']];
  const winList = [];
  for (const [x, z, w, h, c] of blocks) {
    const b = box(w, h, 4, painted(stoneTex({ base: c, bw: 96, bh: 48, rep: [w / 4, h / 4] })), 500 + x, h / 2, z - 2, g);
    const roof = box(w + .2, .25, 4.2, flat(shade(c, 1.2)), 500 + x, h + .12, z - 2, g);
    const cols = Math.floor(w / 1.1), rows = Math.floor((h - 1.4) / 1.3);
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) winList.push([500 + x - w / 2 + (k + .5) * w / cols, 1.4 + r * 1.3, z + .01, z < -10]);
  }
  const wg = new THREE.PlaneGeometry(.62, .8);
  const wm = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  dyn.wins = new THREE.InstancedMesh(wg, wm, winList.length); dyn.wins.userData.noShadow = true;
  const m4 = new THREE.Matrix4(); winList.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); dyn.wins.setMatrixAt(i, m4); dyn.wins.setColorAt(i, new THREE.Color('#1a2040')); });
  dyn.winList = winList; g.add(dyn.wins);
  const R = rng(77); dyn.winSeed = winList.map(() => [R(), R(), R()]);
  // street lamps
  const pole = flat('#2a2a40');
  dyn.lampPos = [V(497, 3.0, -1.6), V(504, 3.0, -1.6)];
  for (const p of dyn.lampPos) { cyl(.05, .07, 3, pole, p.x, 1.5, p.z, g, 8); box(.5, .06, .06, pole, p.x + .22, 3, p.z, g); const b = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 10), new THREE.MeshBasicMaterial({ color: HDR(3.2, 2.4, 1.1) })); b.position.set(p.x + .45, 2.92, p.z); b.userData.noShadow = true; g.add(b); }
  // a roof billboard with the counter (a live canvas)
  const bt = canvasTex(2048, 512, () => {});
  const bb = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: bt, color: HDR(1.4, 1.4, 1.4) })); bb.position.set(497.4, 14.5, -7.1); bb.userData.noShadow = true; g.add(bb); dyn.cityBoard = { t: bt, key: '' };
  box(8.2, 2.2, .1, flat('#2a2440'), 497.4, 14.5, -7.2, g);
  for (const s of [-1, 1]) box(.08, 1.6, .08, pole, 497.4 + s * 2.6, 12.6, -7.2, g);
  const sky = canvasTex(2048, 1024, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, D('#101848')); gr.addColorStop(.5, D('#283a8a')); gr.addColorStop(1, D('#6a5ab0')); c.fillStyle = gr; c.fillRect(0, 0, w, h); const R2 = rng(8); for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(255,255,240,${.3 + R2() * .6})`; c.beginPath(); c.arc(R2() * w, R2() * h * .45, R2() * 2 + .4, 0, 6.29); c.fill(); } });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide })); dome.position.set(500, 0, 0); dome.userData.noShadow = true; g.add(dome);
  const moonD = new THREE.Mesh(new THREE.SphereGeometry(2.4, 24, 16), new THREE.MeshBasicMaterial({ color: HDR(2.2, 2.2, 2.0) })); moonD.position.set(530, 40, -70); moonD.userData.noShadow = true; g.add(moonD);
  const L = new THREE.Group();
  L.add(new THREE.HemisphereLight('#6a7ae8', '#2a2a4a', 1.2));
  const moon = spot('#a8bcff', 2.2, [530, 40, -40], [500, 0, -5], .4, { near: 20, far: 120, size: 2048 }); L.add(moon); L.add(moon.target);
  for (const p of dyn.lampPos) { const l = new THREE.PointLight('#ffc070', 4, 0, 1.4); l.position.set(p.x + .45, 2.8, p.z); L.add(l); }
  scene.add(L); sets.city = { g, L };
  shadows(g); dome.receiveShadow = false;
  dyn.cityGlows = dyn.lampPos.map(p => glow(scene, [p.x + .45, 2.92, p.z], '#ffc070', .8, .45));
}
function drawCityBoard(text) {
  if (text === dyn.cityBoard.key) return; dyn.cityBoard.key = text;
  const g = dyn.cityBoard.t.g, w = 2048, h = 512;
  g.fillStyle = D('#1a1640'); g.fillRect(0, 0, w, h); drawFin(g, 220, 300, 260, 0);
  g.font = `900 200px ${FONT}`; g.fillStyle = D('#ffe27a'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2 + 120, h / 2 + 10);
  dyn.cityBoard.t.needsUpdate = true;
}

// ---------------------------------------------------------------- CAST
export const LOOK = {
  kid: { hat: 'cap', hatColor: '#ffb020', capSide: 1, cloth: '#e84a6a', height: 1.05, headW: 290, headH: 268, body: 'sit' },
  kidStand: { hat: 'cap', hatColor: '#ffb020', capSide: 1, cloth: '#e84a6a', height: 1.1, headW: 290, headH: 268 },
  mom: { cloth: '#3aa8a0', hair: '#5a3a2a', height: 1.6, body: 'sit', headW: 266, headH: 250 },
  anim: { cloth: '#5a6ad8', hair: '#2a2228', height: 1.6, body: 'sit', pocket: true, headW: 270 },
  c1: { hat: 'cap', hatColor: '#3a8ad8', capSide: -1, cloth: '#f0b030', height: 1.08, body: 'sit', headW: 286, headH: 264 },
  c2: { cloth: '#8a5ad8', hair: '#3a2a24', height: 1.02, body: 'sit', headW: 280, headH: 262 },
  c3: { hat: 'cap', hatColor: '#e8483a', capSide: 1, cloth: '#3ac0a0', height: 1.1, body: 'sit', headW: 284, headH: 266 },
  leader: { hat: 'cap', hatColor: '#2f8a5a', capSide: 1, cloth: '#e8603f', beard: '#7a4a32', beardLen: .4, height: 1.55, body: 'sit' },
  teach: { cloth: '#c8503a', hair: '#e8e2da', height: 1.66, buttons: '#f0c040', mustache: '#d8d0c6' },
};


// ---------------------------------------------------------------- CAMERA
// A long documentary: holds creep slowly (.05-.12 %/frame) and a new key comes every few seconds; glides between shots
// of one set, whip pans between sets, a few hard cuts.
const LV = { tv: [[.35, 1.08, -1.2], [0, 1.0, -2.55], 38], kid: [[1.35, .82, .45], [.12, .64, -.9], 30], room: [[3.0, 1.6, 2.2], [-.5, .85, -1.2], 42], sofa: [[.9, 1.15, 1.5], [-1.4, .75, -.7], 36] };
function cameraPath() {
  const t = W;
  const K = (tt, [pos, look, fov], o = {}) => ({ t: tt, pos, look, fov, creep: o.creep ?? .07, drift: o.drift ?? .05, ...o });
  const P = (pos, look, fov) => [pos, look, fov];
  const whip = { move: 'whip', dur: .4 };
  const keys = [
    // ---- hook: TV glow, the kid in its light, the stage of giants
    K(0, LV.tv, { creep: .14, drift: .03 }),
    K(t('popular') - .05, LV.kid, { move: 'cut', creep: .12 }),
    K(t('hollywood') + .02, P([98.4, 1.35, 2.6], [98.2, 1.05, -1.2], 30), whip),
    K(t('famous', 1) + .2, P([100.2, 1.5, 2.3], [100.0, 1.55, -1.4], 30), { dur: 1.0 }),
    K(t('uploaded') + .1, P([100, 2.1, 7.4], [100, 2.0, -1.6], 36), { dur: 1.3 }),
    K(t('seventeen', 1) + .3, P([100, 2.9, 4.2], [100, 3.15, -2.6], 30), { dur: 1.5, creep: .1 }),
    K(t('blockbuster') - .35, P([98.7, 1.35, 1.9], [98.25, 1.1, -1.2], 30), { dur: 1.0 }),
    K(t('superstar') - .6, P([100.3, 1.6, 1.8], [100.05, 1.55, -1.4], 30), { dur: 1.0 }),
    K(t('expensive', 1) - .6, P([101.6, 1.3, 1.9], [101.8, 1.0, -1.2], 30), { dur: 1.0 }),
    K(t('just') - .1, P([100, 1.3, 4.8], [100, 1.0, -.6], 32), { dur: 1.3, creep: .1 }),
    // ---- its name
    K(t('name', 1) - .1, P([.1, 1.05, -1.1], [0, 1.05, -2.55], 36), whip),
    K(t('success', 1) - .3, LV.room, { dur: 1.6, creep: .08 }),
    // ---- 2016: the studio
    K(t('story', 1) - .3, P([200.75, 1.95, -2.2], [200.9, 1.95, -2.94], 34), { move: 'whip', dur: .5, creep: .12 }),
    K(t('pinkfong', 1) - .4, P([197.6, 1.55, 2.6], [199.4, 1.25, -1.6], 38), { dur: 1.6 }),
    K(t('released') - .5, P([199.75, 1.2, -.3], [200.55, 1.12, -1.25], 30), { dur: 1.0, creep: .1 }),
    // ---- the campfire
    K(t('song', 2) - .1, P([297.4, 1.7, 3.4], [300, .7, -.8], 38), { ...whip, creep: .08 }),
    K(t('chant') - .3, P([299.4, 1.3, 2.9], [300.0, .55, -.6], 32), { dur: 1.6 }),
    K(t('decades') - .6, P([301.4, 1.35, 2.7], [300.3, .6, -.6], 34), { dur: 1.6 }),
    // ---- you see: the simple recipe
    K(t('you', 1) - .05, P([198.2, 1.35, 1.7], [199.9, 1.0, -1.5], 34), { ...whip, creep: .08 }),
    K(t('catchy') - .3, P([198.9, 1.3, .6], [200.2, 1.05, -1.4], 32), { dur: 1.2 }),
    K(t('movements', 1) - .3, P([199.2, 1.1, .3], [199.8, .95, -1.9], 30), { dur: 1.0 }),
    K(t('lyrics') - .3, P([198.6, 1.4, 1.2], [200.1, 1.15, -1.5], 34), { dur: 1.0 }),
    K(t('storyline') - .9, P([202.0, 1.85, -.4], [204.15, 1.85, -.9], 34), { dur: 1.2 }),
    K(t('cinematic') - .7, P([201.5, 1.9, .6], [203.6, 1.7, -1.2], 38), { dur: 1.0 }),
    // ---- something extraordinary: the kid watches again and again, a parent plays it
    K(t('yet') - .05, LV.tv, { ...whip, creep: .1 }),
    K(t('children', 2) - .2, LV.kid, { dur: 1.2, creep: .1 }),
    K(t('parents') - .2, LV.sofa, { dur: 1.3 }),
    // ---- schools, the map, the chart
    K(t('schools') - .05, P([403.2, 1.6, 3.6], [399.8, 1.0, -1.2], 38), { ...whip, creep: .07 }),
    K(t('spread') - .2, P([401.6, 1.75, -.6], [401.9, 1.75, -2.9], 36), { dur: 1.3, creep: .08 }),
    K(t('billboard') - .7, P([401.6, 1.4, 1.2], [402.9, 1.2, -.9], 32), { dur: 1.2 }),
    K(t('seemed') - .3, P([401.9, 1.75, .6], [401.9, 1.7, -2.9], 32), { dur: 1.3, creep: .1 }),
    // ---- why? repetition (the blackboard)
    K(t('why', 1) - .4, P([401.8, 1.5, 3.0], [399.4, 1.3, -2.0], 38), { dur: 1.8 }),
    K(t('repetition') - .4, P([399.0, 1.75, .2], [399.0, 1.75, -2.9], 40), { dur: 1.2, creep: .08 }),
    K(t('movements', 2) - .3, P([401.4, 1.25, 3.2], [399.6, .9, .2], 38), { dur: 1.2 }),
    K(t('characters', 1) - .4, P([399.0, 1.75, .4], [399.0, 1.75, -2.9], 38), { dur: 1.0 }),
    K(t('child', 1) - .4, P([399.5, 1.2, 4.0], [399.4, .85, .6], 34), { dur: 1.2, creep: .08 }),
    // ---- once vs again: the replay
    K(t('unlike') - .1, LV.tv, { ...whip, creep: .12 }),
    K(t('one', 2) - .3, LV.kid, { dur: 1.2, creep: .1 }),
    // ---- millions of children: the city at night
    K(t('millions', 1) - .1, P([500, 1.7, 6], [500, 3.2, -5], 40), { ...whip, creep: .05 }),
    K(t('number') - 1.2, P([499, 3.0, 12], [498.5, 8.0, -7], 44), { dur: 2.6, creep: .05 }),
    K(t('content') - .6, P([500, 4.5, 20], [500, 7.0, -8], 48), { dur: 3.0, creep: .04 }),
    // ---- the record race on the scoreboard
    K(t('november') - .2, P([100, 2.9, 3.8], [100, 3.2, -2.6], 32), { ...whip, creep: .08 }),
    K(t('milestone') - .5, P([100, 2.3, 6.8], [100, 2.4, -2.0], 40), { dur: 1.4, creep: .06 }),
    K(t('first') - .3, P([100, 2.85, 3.6], [100, 3.15, -2.6], 32), { dur: 1.0, creep: .08 }),
    K(t('counter') - .6, P([100, 2.6, 5.0], [100, 2.8, -2.4], 34), { dur: 1.2, creep: .1 }),
    K(t('twice') - .8, P([100, 1.7, 5.6], [100, 1.5, -1.3], 36), { dur: 1.4, creep: .07 }),
    // ---- watched repeatedly
    K(t('course') - .15, LV.sofa, { ...whip, creep: .08 }),
    // ---- the lesson
    K(t('changed') - .3, P([197.6, 1.5, 2.9], [199.6, 1.2, -1.5], 38), { ...whip, creep: .06 }),
    K(t('demonstrated') - .2, P([100.8, 1.5, 6.0], [100.6, 1.2, -.8], 38), { ...whip, creep: .06 }),
    K(t('simplicity') - .6, P([100, 1.2, 2.6], [100, 1.1, .2], 32), { dur: 1.4, creep: .1 }),
    K(t('memorable') - .3, P([100, 1.35, 3.4], [100, 1.15, .1], 36), { dur: 1.0, creep: .06 }),
    K(t('millions', 2) - .6, P([101.0, 1.3, 2.2], [101.6, 1.0, -.9], 32), { dur: 1.0 }),
    // ---- not about sharks
    K(t('biggest', 2) - .2, P([297.6, 1.5, 3.6], [300, .65, -.8], 38), { ...whip, creep: .06 }),
    K(t('understanding') - .4, LV.room, { ...whip, creep: .07 }),
    // ---- the end: the city
    K(t('because') - .1, P([500, 1.6, 5], [500.5, 3.0, -5], 38), { ...whip, creep: .05 }),
    K(t('return') - 1.0, P([500, 6, 34], [500, 7.5, -8], 52), { dur: 4.0, creep: .03 }),
  ];
  const cp = new CamPath(keys, { fps: FPS });
  cp.kick(t('overtook') + .1, .5); cp.kick(t('ten') + .03, .7);
  return cp;
}

// ---------------------------------------------------------------- SETUP
export async function setup(ctx) {
  C = ctx; W = wordTimes(ctx.words);
  DUR = Math.ceil((ctx.words[ctx.words.length - 1].end + 4.2) * FPS) / FPS;
  const { scene } = ctx;
  scene.background = new THREE.Color('#1a1f3a');
  buildLiving(scene); buildStage(scene); buildStudio(scene); buildCamp(scene); buildClass(scene); buildCity(scene);
  for (const [k, l] of Object.entries(LOOK)) cast[k] = new Toon(l, scene);
  for (const [k, l] of [['k1', LOOK.c1], ['k2', LOOK.c2], ['k3', LOOK.c3], ['k4', { ...LOOK.kid }]]) cast[k] = new Toon(l, scene);
  dyn.cam = cameraPath();
  // tags
  const T = (txt, h, o) => tag(scene, txt, h, o);
  dyn.tags = {
    blockbuster: T('BLOCKBUSTER', .16, { strike: true }), superstar: T('SUPERSTAR', .16, { strike: true }), money: T('BIG BUDGET', .16, { strike: true }),
    song: T("A CHILDREN'S SONG", .14, { icon: 'note' }),
    brain: T('THE BRAIN', .2, { icon: 'bulb', iconC: '#f0a830' }), internet: T('THE INTERNET', .2, { icon: 'globe', iconC: '#3a8ad8' }), ent: T('ENTERTAINMENT', .2, { icon: 'play', iconC: '#e84a5a' }),
    seoul: T('SEOUL, SOUTH KOREA', .13), pinkfong: T('PINKFONG', .13),
    decades: T('SUNG FOR DECADES', .13, { icon: 'note' }),
    melody: T('MELODY', .085, { icon: 'note' }), color: T('COLOR', .085, { icon: 'heart', iconC: '#ff6a9a' }), moves: T('EASY MOVES', .085, { icon: 'play', iconC: '#3ac0a0' }), repeat: T('REPEAT', .085, { icon: 'replay', iconC: '#3a8ad8' }),
    story: T('STORYLINE', .16, { strike: true }), fx: T('EFFECTS', .16, { strike: true }),
    hello: T('HELLO', .1), hola: T('HOLA', .1), merhaba: T('MERHABA', .1), bonjour: T('BONJOUR', .1),
    n1: T('♪', .1), n2: T('♪', .1), n3: T('♪', .1), n4: T('♪', .1),
    nov: T('NOVEMBER 2020', .2), first: T('FIRST EVER', .2, { red: true }),
    pop1: T('8 BILLION PEOPLE', .15), pop2: T('8 BILLION PEOPLE', .15), twice: T('× 2', .3, { red: true }),
    expensive: T('EXPENSIVE', .14), complicated: T('COMPLICATED', .14), sophisticated: T('SOPHISTICATED', .14),
    idea: T('A MEMORABLE IDEA', .17, { icon: 'bulb', iconC: '#f0a830' }), heart: T('AN EMOTIONAL CONNECTION', .17, { icon: 'heart', iconC: '#ff5a7a' }), again: T('A REASON TO WATCH AGAIN', .17, { icon: 'replay', iconC: '#3a8ad8' }),
  };
  // sparks over the fire, dust in the studio sun
  smokes.sparks = new Smoke(scene, { color: '#ffc070', maxPoints: 300, H: ctx.H, additive: true, near: .8 });
  const hash = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  smokes.sparks.wisps.push({ n: 90, size: .012, alpha: .9, speed: .35, path: (u, t, i) => [FIRE.x + (hash(i, 1) - .5) * .3 + Math.sin(u * 7 + i) * .15 * u, .4 + u * 2.4, FIRE.z + (hash(i, 2) - .5) * .3 + Math.cos(u * 6 + i) * .12 * u] });
  smokes.smoke = new Smoke(scene, { color: '#b9adb8', maxPoints: 200, H: ctx.H });
  smokes.smoke.wisps.push({ n: 80, size: .5, alpha: .12, speed: .12, path: (u, t, i) => [FIRE.x + Math.sin(u * 5 + t * .7) * .3 * u, .9 + u * 3.2, FIRE.z - u * .8 + Math.cos(u * 4 + t) * .2 * u] });
  smokes.dust = new Smoke(scene, { color: '#fff0d0', maxPoints: 300, H: ctx.H, additive: true, near: 1.2 });
  smokes.dust.wisps.push({ n: 140, size: .006, alpha: .45, speed: .04, path: (u, t, i) => [198.9 + (hash(i, 1) - .5) * 2.6 + Math.sin(t * .5 + i) * .05, .4 + hash(i, 2) * 2.2 + (u - .5) * .3, -1.6 + (hash(i, 3) - .5) * 2.4] });
  // sound cues
  const cue = (t, type, extra = {}) => CUES.push({ t: +t.toFixed(3), type, ...extra });
  cue(0, 'score', { mode: 'doc' });
  for (const w of [['story', 1], ['schools'], ['november']]) cue(W(...w) - .3, 'section');
  for (const w of [['hollywood'], ['name', 1], ['story', 1], ['song', 2], ['you', 1], ['yet'], ['schools'], ['unlike'], ['millions', 1], ['november'], ['course'], ['changed'], ['demonstrated'], ['biggest', 2], ['understanding'], ['because']]) cue(W(...w) - .1, 'rise', { dur: .45 });
  cue(W('popular') - .05, 'cut');
  for (const w of [['blockbuster'], ['superstar'], ['expensive', 1], ['storyline'], ['cinematic']]) cue(W(...w) + .1, 'lock');
  cue(W('just') + .2, 'shimmer'); cue(W('baby', 1), 'shimmer'); cue(W('released') + .5, 'shimmer');
  cue(W('chant') - .6, 'simmer', { dur: W('you', 1) - W('chant') + .3 });
  cue(W('overtook') + .1, 'boom'); cue(W('ten') + .03, 'boom'); cue(W('first') - .05, 'shimmer'); cue(W('seventeen', 2) - .05, 'shimmer'); cue(W('simplicity') + .1, 'shimmer');
  cue(W('return') - .2, 'shimmer');
}

// ---------------------------------------------------------------- PER FRAME
const vis = (set, on) => { sets[set].g.visible = on; sets[set].L.visible = on; };
const NIGHT = '#d6d1f2', DAY = '#e8e3f4', WARM = '#ffb45a', TVC = '#8fd8ff';
const SIT = h => -180 * h / 916;            // a sitting card's soles sit this far under its seat
const ALL = ['living', 'stage', 'studio', 'camp', 'cls', 'city'];
// view counts shown on screens: a smooth climb through the record beats
function viewsAt(t) {
  const T = W;
  if (t < T('seventeen', 1)) return 17.0e9 * lin(t, 0, T('seventeen', 1));
  return 17.0e9 + (t - T('seventeen', 1)) * 1.3;
}
export function frame(t, ctx) {
  const { cam } = ctx;
  const cp = dyn.cam.apply(cam, t);
  const x = cam.position.x;
  const where = x < 50 ? 'living' : x < 150 ? 'stage' : x < 250 ? 'studio' : x < 350 ? 'camp' : x < 450 ? 'cls' : 'city';
  for (const s of ALL) vis(s, s === where);
  ctx.scene.background.set(where === 'studio' || where === 'cls' ? '#9ab8e0' : '#1a1f3a');
  const T = W, A = (w, n) => W(w, n) - 2 / FPS;
  const bl = (seed, ...swaps) => blinkAt(t, seed, swaps, FPS);
  const tint = FACE[where].map((v, i) => v / GRADE[where][i]);
  for (const c of Object.values(cast)) c.hide();
  for (const s of Object.values(dyn.tags)) s.visible = false;
  dyn.lampGlow.visible = dyn.tvGlow.visible = where === 'living';
  dyn.spots.forEach(s => s.beam.visible = where === 'stage');
  dyn.stBeam.visible = where === 'studio'; dyn.clBeam.visible = where === 'cls';
  dyn.flames.forEach(f => f.f.visible = where === 'camp'); dyn.fireGlow.visible = where === 'camp';
  dyn.cityGlows.forEach(gl => gl.visible = where === 'city');
  dyn.confetti.visible = false;
  smokes.sparks.pts.visible = smokes.smoke.pts.visible = where === 'camp'; smokes.dust.pts.visible = where === 'studio';
  const at = (p, dy = 0) => [p.x, p.y + dy, p.z];

  // ---- LIVING
  if (where === 'living') {
    const titleK = t > T('name', 1) - .2 && t < T('success', 1) + 1.5 ? lin(t, T('name', 1) - .2, T('name', 1) + .6) : 0;
    // replay counts: "again and again" (1-4), "five times in a day" (1-5), "repeatedly" (6-9)
    let replay = 0;
    if (t > T('children', 2) && t < T('parents')) replay = 1 + Math.floor(lin(t, T('started'), T('again', 2) + .4) * 3.99);
    if (t > T('one', 2) - .3 && t < T('millions', 1)) replay = 1 + Math.floor(lin(t, T('one', 2), T('day') + .3) * 4.99);
    if (t > T('course')) replay = 6 + Math.floor(lin(t, T('course'), T('unusual') + .5) * 3.99);
    if (t > T('understanding') - .6) replay = 0;
    dyn.tv.paint(t, { title: titleK, views: t < T('popular') ? viewsAt(t) : null, replay });
    const flick = .9 + .1 * Math.sin(t * 13) * Math.sin(t * 5.3);
    dyn.tvL.intensity = 5.5 * flick;
    // the kid on the rug, in the TV's light; at the end, the kid comes back in and sits down again
    const back = t > T('understanding') - .6;
    if (back && t < T('makes', 2) + .3) {
      const k = ramp(t, T('understanding') - .4, T('makes', 2) + .1);
      const c = cast.kidStand; c.show(); c.place(lerpN(2.2, .2, k), Math.abs(Math.sin(t * 9)) * .03 * (1 - k), lerpN(.4, -.85, k), cam, tint); c.castFrom(TV);
      const sw = Math.sin(t * 9) * 30 * (1 - k);
      c.draw({ expr: 'smile', look: -.8, lookY: .1, blink: bl(2, A('understanding')), armL: [20 + sw, -30], armR: [20 - sw, -30], lit: -1, shade: NIGHT, rim: { color: TVC, a: .4 } });
    } else {
      const c = cast.kid; c.show(); c.place(KID_P.x, SIT(LOOK.kid.height), KID_P.z, cam, tint); c.castFrom(TV);
      const wow = (t < T('hollywood')) || (t > T('yet') && t < T('children', 2) + .3);
      const pressing = (t > T('baby', 3) - .2 && t < T('viewing') + .4) || (t > T('one', 2) && t < T('day') + .3 && Math.sin((t - T('one', 2)) * 8) > .3) || (t > T('repeatedly') - .3 && t < T('repeatedly') + .5);
      const happy = t > T('again', 1) - .2 && t < T('parents');
      const ex = wow ? 'surprised' : pressing ? 'grin' : happy ? 'laugh' : t > T('course') ? 'grin' : 'smile';
      const bounce = happy ? Math.abs(Math.sin(t * 6)) * .5 : 0;
      c.draw({ expr: ex, look: -.85, lookY: .25, blink: bl(1, A('popular'), A('yet'), A('again', 1), A('baby', 3), A('one', 2), A('course')),
        armL: happy ? [150 + Math.sin(t * 6) * 15, -20] : [30, 20], armR: pressing ? [70, -30] : happy ? [150 - Math.sin(t * 6) * 15, -20] : [30, 20], propR: pressing ? 'tablet' : null,
        bob: -bounce * 12, lit: -1, shade: NIGHT, rim: { color: TVC, a: .45 } });
    }
    // the parent on the sofa: hands the tablet over, smiles at the end
    { const c = cast.mom; c.show(); c.place(SOFA_P.x, SOFA_P.y + SIT(LOOK.mom.height), SOFA_P.z, cam, tint); c.castFrom(TV);
      const play = t > T('parents') - .1 && t < T('schools') - .2;
      c.draw({ expr: play ? 'smile' : t > T('course') ? 'smile' : 'neutral', look: .6, lookY: .15, blink: bl(3, A('parents'), A('course')),
        armR: play ? [80, -40] : [20, 40], armL: play ? [90, -50] : [20, 40], propR: play ? 'tablet' : null, lit: -1, shade: NIGHT, rim: { color: TVC, a: .38 } }); }
    // tags: brain, internet, entertainment
    showTag(dyn.tags.brain, t, T('brain'), T('story', 1) - .4, [-1.2, 2.05, -1.6]);
    showTag(dyn.tags.internet, t, T('internet', 1), T('story', 1) - .4, [.2, 2.3, -1.6]);
    showTag(dyn.tags.ent, t, T('entertainment'), T('story', 1) - .4, [1.3, 1.9, -1.0]);
  }

  // ---- STAGE
  if (where === 'stage') {
    const lesson = t > T('demonstrated') - .3;
    const race = t > T('november') - .3;
    // spotlights: each giant lit until its "Not ..."; the lesson relights them, then "simplicity" leaves one spot on the easel
    const off = [A('blockbuster') + .3, A('superstar') + .3, A('expensive', 1) + .3];
    dyn.spots.forEach((s, i) => {
      let on = 1;
      if (!race && !lesson) on = 1 - ramp(t, off[i], off[i] + .35);
      if (race && !lesson) on = .7;
      if (lesson) on = i === 1 ? 1 : 1 - ramp(t, T('simplicity') - .2, T('simplicity') + .4) * .92;
      if (!race && !lesson && t > T('just') - .2 && i === 1) on = ramp(t, T('just') - .2, T('just') + .3);
      if (i === 1) s.l.target.position.set(100, lesson ? .9 : .8, lesson ? .2 : PED[1].z);
      s.l.intensity = s.base * on; s.beam.material.uniforms.uStrength.value = .16 * on; s.lens.material.color.setRGB(3 * on + .2, 2.6 * on + .2, 1.8 * on + .2);
    });
    // which giants stand on the pedestals
    const pop2 = t > T('twice') - .6 && t < T('course');
    dyn.reel.visible = !pop2; dyn.mic.visible = !pop2 && !lesson; dyn.cash.visible = !pop2;
    dyn.reel.rotation.z = -t * .6; dyn.star.rotation.y = t * 1.2;
    dyn.globes.forEach((gl, i) => { gl.visible = pop2; gl.rotation.y = t * .3 + i; gl.scale.setScalar(backOut(lin(t, T('twice') - .6 + i * .25, T('twice') - .2 + i * .25))); });
    dyn.easel.visible = lesson; dyn.rig.visible = lesson;
    // the scoreboard
    if (!race) drawBoard({ text: fmt(viewsAt(t)), gold: t > T('seventeen', 1) + .6 });
    else if (t < T('then')) {
      const k = lin(t, T('november') - .3, T('overtook') + .3);
      drawBoard({ race: [7.04e9 + k * .01e9, 6.6e9 + k * .46e9] });
    } else if (t < T('ten') - .4) drawBoard({ text: fmt(lerpN(7.05e9, 9.99e9, ramp(t, T('then'), T('ten') - .5))) });
    else if (t < T('stop')) drawBoard({ text: '10,000,000,000', gold: true, sub: t > T('first') ? 'THE FIRST VIDEO EVER' : null });
    else if (t < T('seventeen', 2)) drawBoard({ text: fmt(lerpN(10e9, 17e9, ramp(t, T('stop'), T('seventeen', 2)))) });
    else if (t < T('demonstrated') - .3) drawBoard({ text: '17,000,000,000+', gold: true, sub: t > T('twice') - .3 ? 'MORE THAN 2 × THE WORLD' : null });
    else drawBoard({ text: 'SIMPLE WINS', gold: t > T('simplicity') });
    // confetti on ten billion
    const ck = t - T('ten');
    if (ck > 0 && ck < 5) {
      dyn.confetti.visible = true; const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (let i = 0; i < dyn.confetti.count; i++) {
        const h1 = Math.sin(i * 12.9898) * 43758.5453 % 1, h2 = Math.sin(i * 78.233) * 12543.123 % 1, h3 = Math.sin(i * 39.425) * 9631.77 % 1;
        const tt = ck - Math.abs(h3) * .6;
        const px = 100 + h1 * 4, pz = -.5 + h2 * 2, py = 4.4 - Math.max(0, tt) * (.9 + Math.abs(h2) * .4) + Math.sin(tt * 3 + i) * .05;
        e.set(tt * 5 + i, tt * 3 + i * 2, 0); q.setFromEuler(e);
        m.compose(V(px + Math.sin(tt * 2 + i) * .15, Math.max(.02, py), pz), q, V(1, 1, 1)); dyn.confetti.setMatrixAt(i, m);
      }
      dyn.confetti.instanceMatrix.needsUpdate = true;
    }
    // tags
    showTag(dyn.tags.blockbuster, t, T('blockbuster') + .1, T('just') - .2, [PED[0].x + .2, 1.72, PED[0].z + .7]);
    showTag(dyn.tags.superstar, t, T('superstar') + .1, T('just') - .2, [PED[1].x, 2.02, PED[1].z + .7]);
    showTag(dyn.tags.money, t, T('production', 1) - .2, T('just') - .2, [PED[2].x, 1.5, PED[2].z + .7]);
    showTag(dyn.tags.song, t, T('song', 1) - .3, T('name', 1) - .2, [100, 1.95, -.1]);
    showTag(dyn.tags.nov, t, T('november') + .1, T('then'), [100, 2.25, -2.2]);
    showTag(dyn.tags.first, t, T('first'), T('stop'), [101.5, 2.45, -2.0]);
    showTag(dyn.tags.pop1, t, T('population') - .2, T('course'), [PED[0].x, 1.85, PED[0].z + .4]);
    showTag(dyn.tags.pop2, t, T('population') + .1, T('course'), [PED[2].x, 1.85, PED[2].z + .4]);
    showTag(dyn.tags.twice, t, T('twice'), T('course'), [100, 1.35, -1.0]);
    showTag(dyn.tags.expensive, t, T('expensive', 3), T('simplicity') - .2, [101.7, 2.15, -.4]);
    showTag(dyn.tags.complicated, t, T('complicated', 2), T('simplicity') - .2, [98.3, 2.05, -.9]);
    showTag(dyn.tags.sophisticated, t, T('sophisticated'), T('simplicity') - .2, [100, 2.35, -1.2]);
    showTag(dyn.tags.idea, t, T('idea'), T('biggest', 2) - .3, [101.05, 1.7, .6]);
    showTag(dyn.tags.heart, t, T('connection'), T('biggest', 2) - .3, [101.05, 1.42, .6]);
    showTag(dyn.tags.again, t, T('watch', 3), T('biggest', 2) - .3, [101.05, 1.14, .6]);
    // the kid with the tablet: "just a simple children's song", and beside the easel at the end
    if ((t > T('just') - .3 && t < T('name', 1)) || lesson) {
      const c = cast.kidStand; c.show(); const px = lesson ? 99.4 : 100, pz = lesson ? .45 : -.4; c.place(px, 0, pz, cam, tint); c.castFrom(V(100, 4.3, .8));
      const win = lesson && t > T('simplicity');
      c.draw({ expr: win ? 'grin' : 'smile', look: lesson ? .6 : 0, lookY: .1, blink: bl(4, A('just'), A('simplicity')), armR: lesson ? [20, 30] : [60, -40], armL: lesson ? (win ? [150, -20] : [20, 30]) : [60, -40], propR: lesson ? null : 'tablet',
        lit: 1, shade: NIGHT, rim: { color: '#ffd8a0', a: .3 } });
    }
  }

  // ---- STUDIO
  if (where === 'studio') {
    const up = ramp(t, T('released') - .4, T('youtube') + .1);
    const published = t > T('youtube') + .1 && t < T('song', 2) ? lin(t, T('youtube') + .1, T('youtube') + .6) : null;
    dyn.monS.paint(t, { progress: t > T('released') - .4 && t < T('song', 2) ? up : null, published, views: t > T('song', 2) ? null : null });
    const c = cast.anim; c.show(); c.place(199.72, .5 + SIT(LOOK.anim.height), -1.95, cam, tint); c.castFrom(dyn.stSun, true);
    const moves = t > T('movements', 1) - .1 && t < T('repetitive') + .2;
    const proud = t > T('youtube') && t < T('song', 2) || t > T('changed') - .2;
    const sw = Math.sin((t - T('movements', 1)) * 7);
    c.draw({ expr: moves ? 'grin' : proud ? 'proud' : t > T('you', 1) ? 'smile' : 'focused', look: moves ? 0 : .7, lookY: moves ? 0 : .3, blink: bl(5, A('released'), A('youtube'), A('movements', 1), A('changed')),
      armL: moves ? [120 + sw * 30, -40 - sw * 30] : [40, 40], armR: moves ? [120 - sw * 30, -40 + sw * 30] : [60, 20], propL: null, lit: -1, shade: DAY, rim: { color: '#ffe2a0', a: .3 } });
    showTag(dyn.tags.seoul, t, T('south') - .1, T('released') - .4, [198.35, 2.95, -2.7]);
    showTag(dyn.tags.pinkfong, t, T('pinkfong') - .1, T('released') - .4, [200.6, 2.45, -1.9]);
    const M = (dx, dy) => [MON.x + dx, MON.y + dy, MON.z + .15];
    showTag(dyn.tags.melody, t, T('melody', 1) - .1, T('storyline') - .9, M(-.55, .45));
    showTag(dyn.tags.color, t, T('colorful', 1) - .1, T('storyline') - .9, M(.1, .55));
    showTag(dyn.tags.moves, t, T('movements', 1) - .1, T('storyline') - .9, M(-.65, .2));
    showTag(dyn.tags.repeat, t, T('repetitive') - .1, T('storyline') - .9, M(.25, .3));
    showTag(dyn.tags.story, t, T('storyline') - .1, T('yet'), [204.0, 2.0, -.9]);
    showTag(dyn.tags.fx, t, T('effects') - .1, T('yet'), [203.6, 1.45, -1.25]);
  }

  // ---- CAMP
  if (where === 'camp') {
    dyn.flames.forEach((f, i) => { const k = 1 + .14 * Math.sin(t * (11 + i * 3)) * Math.sin(t * (7 + i)); f.f.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k)); f.f.position.y = f.y + (k - 1) * .15 * f.s; });
    dyn.fireL.intensity = 7 * (.9 + .1 * Math.sin(t * 17) * Math.sin(t * 6.1));
    const sing = (i) => Math.max(0, Math.sin(t * 7.2 + i * .7)) * .8;
    const kids = [['c1', 0, 1], ['c2', 1, -1], ['c3', 2, 1], ['leader', 3, -1]];
    for (const [k, si, lit] of kids) {
      const [dx, dz] = dyn.seats[si], c = cast[k]; c.show(); c.place(FIRE.x + dx * 1.02, .32 + SIT(LOOK[k].height), FIRE.z + dz * 1.02 + .02, cam, tint); c.castFrom(FIRE);
      const lead = k === 'leader', end = t > T('biggest', 2) - .3;
      const sw = Math.sin(t * 3.6 + si) * 4;
      c.draw({ expr: end ? 'smile' : 'laugh', look: dx > 0 ? -.6 : .6, lookY: .2, mouth: end ? 0 : sing(si), blink: bl(6 + si), lean: end ? 0 : sw,
        armL: lead ? [60, -40] : [30 + Math.max(0, Math.sin(t * 7.2)) * 40, -20], armR: lead ? [40, 30] : [30 + Math.max(0, Math.sin(t * 7.2 + 1)) * 40, -20], propL: lead ? 'guitar' : null,
        lit: dx > 0 ? -1 : 1, shade: NIGHT, rim: { color: WARM, a: .45 } });
    }
    showTag(dyn.tags.decades, t, T('decades') - .2, T('you', 1) - .2, [FIRE.x, 2.0, FIRE.z - .4]);
  }

  // ---- CLASS
  if (where === 'cls') {
    const stage = t < T('repetition') - .1 ? 0 : t < T('melody', 2) - .1 ? 1 : t < T('movements', 2) - .1 ? 2 : t < T('characters', 1) - .1 ? 3 : 4;
    drawBoardChalk(stage);
    const n = t < T('spread') ? 0 : t < T('seemed') ? Math.floor(lin(t, T('spread'), T('cultures') + .8) * SPOTS.length) : SPOTS.length;
    drawWorldMap(Math.min(n, SPOTS.length));
    const copy = t > T('movements', 2) - .2 && t < T('characters', 1) + .2;
    const mv = Math.sin((t - T('movements', 2)) * 6.5);
    const kids = ['k1', 'k2', 'k3', 'k4'];
    kids.forEach((k, i) => {
      const [dx, dz] = dyn.deskP[i], c = cast[k]; c.show(); c.place(dx + (i % 2 ? .1 : -.1), .45 + SIT(c.look.height), dz + .32, cam, tint); c.castFrom(dyn.clSun, true);
      const lang = t > T('child', 1) - .2 && t < T('rhythm') - .1, rhythm = t >= T('rhythm') - .1 && t < T('unlike') + .5;
      const happy = rhythm || copy || t < T('but');
      c.draw({ expr: lang ? 'worried' : happy ? (rhythm ? 'laugh' : 'grin') : 'focused', look: -.4 + i * .1, lookY: .35, blink: bl(10 + i, A('movements', 2), A('rhythm')),
        mouth: rhythm ? Math.max(0, Math.sin(t * 7 + i)) * .7 : 0, lean: rhythm ? Math.sin(t * 4 + i) * 4 : 0,
        armL: copy ? [90 + mv * 60, -40] : rhythm ? [150 + Math.sin(t * 6 + i) * 15, -20] : [40, 50], armR: copy ? [90 + mv * 60, -40] : rhythm ? [150 - Math.sin(t * 6 + i) * 15, -20] : [40, 50],
        lit: -1, shade: DAY, rim: { color: '#ffe2a0', a: .3 } });
    });
    { const c = cast.teach; c.show(); c.place(400.85, 0, -2.25, cam, tint); c.castFrom(dyn.clSun, true);
      const point = (t > T('spread') - .2 && t < T('seemed')) || (t > T('repetition') - .3 && t < T('movements', 2) - .2) || (t > T('characters', 1) - .2 && t < T('child', 1));
      c.draw({ expr: copy ? 'grin' : point ? 'focused' : 'smile', look: point ? (t < T('seemed') ? .8 : -.8) : -.3, lookY: .1, blink: bl(14, A('spread'), A('repetition'), A('movements', 2)),
        armR: copy ? [90 + mv * 60, -40] : point && t < T('seemed') ? [110, -20] : [30, 20], armL: copy ? [90 + mv * 60, -40] : point && t > T('seemed') ? [110, -20] : [30, 20],
        propR: point && t < T('seemed') ? 'pointer' : null, propL: point && t > T('seemed') ? 'pointer' : null, lit: -1, shade: DAY, rim: { color: '#ffe2a0', a: .3 } }); }
    const kp = i => { const [dx, dz] = dyn.deskP[i]; return [dx + (i % 2 ? .1 : -.1), 1.4, dz + .35]; };
    const sayA = T('child', 1) - .1, sayB = T('rhythm') - .1;
    ['hello', 'hola', 'merhaba', 'bonjour'].forEach((k, i) => showTag(dyn.tags[k], t, sayA + i * .25, sayB, kp(i)));
    ['n1', 'n2', 'n3', 'n4'].forEach((k, i) => showTag(dyn.tags[k], t, sayB + i * .06, T('unlike'), kp(i)));
  }

  // ---- CITY
  if (where === 'city') {
    // windows light up blue one by one ("millions"), pulse together ("over and over"), one window first at the end
    const ws = dyn.winSeed, c = new THREE.Color();
    const fill = t < T('because') ? lin(t, T('millions', 1) - .3, T('views', 1)) : lin(t, T('getting', 2) - .3, T('entirely') - .3);
    const first = t > T('because') && t < T('getting', 2) - .3;
    const sync = t > T('content') - .5 && t < T('because');
    for (let i = 0; i < dyn.winList.length; i++) {
      const [r1, r2, r3] = ws[i]; let on = r1 < fill * 1.02 ? 1 : 0;
      if (first) on = i === 37 ? 1 : 0;
      if (on) { const fl = sync ? .75 + .25 * Math.sin(t * 5) : .78 + .22 * Math.sin(t * (6 + r2 * 9) + r3 * 20) * Math.sin(t * 2.3 + r2 * 9); c.setRGB(.45 * fl, 1.15 * fl, 1.7 * fl); }
      else c.setRGB(r2 < .25 ? .9 : .1, r2 < .25 ? .6 : .11, r2 < .25 ? .3 : .22);
      dyn.wins.setColorAt(i, c);
    }
    dyn.wins.instanceColor.needsUpdate = true;
    drawCityBoard(t < T('because') ? fmt(Math.max(1, lerpN(0, 9.9e9, lin(t, T('millions', 1), T('again', 3))))) : '17,000,000,000+');
  }

  for (const s of Object.values(smokes)) s.update(t);

  // ---- look per set / beat
  const focusOn = (p, coc, range) => ({ focus: cam.position.distanceTo(p), coc, range });
  let look;
  if (where === 'living') {
    look = cp.pos.distanceTo(TV) < 1.6 ? focusOn(TV, 5, .8) : cp.pos.x > 2.8 ? focusOn(V(.4, .8, -.8), 4, 3) : focusOn(V(.15, .7, -.9), 6, 1.2);
    Object.assign(look, { sat: 1.18, lift: [.09, .09, .18], bloom: .95, vignette: .26 });
  } else if (where === 'stage') look = { ...focusOn(V(100, 1.4, -1.2), 4, 4), sat: 1.2, lift: [.1, .08, .17], bloom: 1.0, vignette: .3 };
  else if (where === 'studio') look = { ...focusOn(V(200, 1.2, -1.5), 4, 2.6), sat: 1.22, lift: [.09, .09, .14], bloom: .75, vignette: .18 };
  else if (where === 'camp') look = { ...focusOn(FIRE, 4, 2.6), sat: 1.2, lift: [.08, .08, .19], bloom: 1.0, vignette: .3 };
  else if (where === 'cls') look = { ...focusOn(V(399.8, 1.2, -.6), 4, 3.2), sat: 1.22, lift: [.09, .09, .14], bloom: .7, vignette: .18 };
  else look = { focus: 12, coc: 0, range: 10, sat: 1.15, lift: [.08, .08, .2], bloom: 1.05, vignette: .3 };
  look.tint = GRADE[where];
  look.blur = cp.moving > .15 ? 16 : 0;
  look.flash = t >= T('popular') - .05 && t < T('popular') - .05 + 2 / FPS ? .3 : 0;
  look.captions = t < T('entirely') + 1.2;
  return look;
}
const GRADE = { living: [.99, .98, 1.04], stage: [1.02, .98, 1.0], studio: [1.02, 1.0, .97], camp: [1.03, .99, .97], cls: [1.02, 1.0, .97], city: [.98, .98, 1.05] };
const FACE = { living: [.97, .985, 1], stage: [1, .985, .97], studio: [1, 1, .985], camp: [1, .98, .95], cls: [1, 1, .985], city: [.97, .975, 1] };

// the end card: the title over a darkened frame
export function overlay(g, t, ctx) {
  const t0 = W('entirely') + 1.3, k = lin(t, t0, t0 + 1.2);
  if (k <= 0) return;
  const { W: w, H: h } = ctx;
  g.save(); g.fillStyle = `rgba(14,12,34,${.72 * k})`; g.fillRect(0, 0, w, h);
  g.globalAlpha = k; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const s = h / 1080;
  g.font = `900 ${96 * s}px ${FONT}`; g.strokeStyle = '#140c1c'; g.lineWidth = 18 * s; g.strokeText('THE VIDEO THAT', w / 2, h * .42); g.fillStyle = '#ffffff'; g.fillText('THE VIDEO THAT', w / 2, h * .42);
  g.font = `900 ${140 * s}px ${FONT}`; g.strokeText('BROKE YOUTUBE', w / 2, h * .56); g.fillStyle = '#ffd84a'; g.fillText('BROKE YOUTUBE', w / 2, h * .56);
  g.restore();
}
