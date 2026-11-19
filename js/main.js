import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as TX from './textures.js';
import { loadAssets } from './assets.js';
import { createVTR } from './vtr.js';
import { createParts } from './parts.js';

const $ = id => document.getElementById(id);
const ldbar = $('ldbar'), ldmsg = $('ldmsg');
const prog = (p, m) => { ldbar.style.width = `${Math.round(p * 100)}%`; if (m) ldmsg.textContent = m; };
const tick = () => new Promise(r => setTimeout(r, 0));

// ---------- レンダラ ----------
const canvas = $('gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
} catch (e) {
  ldmsg.textContent = 'この端末では3D表示に使うWebGLが動かないため、表示できない。';
  throw e;
}
const DPR = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.01, 2e6);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(new THREE.Scene(), camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.5, 0.5, 0.9);
// 明るすぎて数値があふれた画素や、計算できなかった画素を、にじみの処理へ渡す前に取り除く（黒い四角のちらつきを防ぐ）
const sanitize = new ShaderPass({ uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    float fix(float v){ if (isnan(v)) return 0.0; if (isinf(v)) return v > 0.0 ? 48.0 : 0.0; return clamp(v, 0.0, 48.0); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); gl_FragColor = vec4(fix(c.r), fix(c.g), fix(c.b), 1.0); }` });
composer.addPass(renderPass); composer.addPass(sanitize); composer.addPass(bloom); composer.addPass(new OutputPass());
composer.setPixelRatio(DPR); composer.setSize(innerWidth, innerHeight);

let designFov = 40;
function setFov(f) {
  designFov = f;
  const aspect = innerWidth / innerHeight;
  const k = Math.max(1, Math.min(4, (16 / 9) / aspect));
  camera.fov = 2 * Math.atan(Math.tan(f * Math.PI / 360) * Math.pow(k, 0.62)) * 180 / Math.PI;
  camera.aspect = aspect; camera.updateProjectionMatrix();
}
function resize() {
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth / 2, innerHeight / 2);
  setFov(designFov);
}
addEventListener('resize', resize);

// ---------- UI ヘルパ ----------
const labelsEl = $('labels'), cardsEl = $('cards');
const labelList = new Set();
const ui = {
  label(text, cls, pos) {
    const el = document.createElement('div'); el.className = 'lbl ' + (cls || ''); el.innerHTML = `<span class="p"></span>`;
    labelsEl.appendChild(el);
    const h = { el, pos, set(tx, c) { el.querySelector('.p').textContent = tx; el.className = 'lbl ' + (c || ''); el.style.display = tx ? '' : 'none'; }, remove() { el.remove(); labelList.delete(h); } };
    h.set(text, cls); labelList.add(h); return h;
  },
  clearLabels() { [...labelList].forEach(h => h.remove()); },
  card(id, html, pos = 'top') {
    let el = cardsEl.querySelector(`[data-id="${id}"]`);
    if (!el) { el = document.createElement('div'); el.dataset.id = id; el.className = 'card ' + (pos || ''); cardsEl.appendChild(el); el.innerHTML = html; requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on'))); }
    else if (el._html !== html) el.innerHTML = html;
    el._html = html;
  },
  hideCard(id) { const el = cardsEl.querySelector(`[data-id="${id}"]`); if (el) { el.classList.remove('on'); setTimeout(() => el.remove(), 600); } },
  clearCards() { cardsEl.innerHTML = ''; },
  chip(k, v) { $('dk').textContent = k; $('dv').innerHTML = v; $('datachip').classList.add('on'); },
  hideChip() { $('datachip').classList.remove('on'); },
  overlay(id, html) {
    let el = document.getElementById('ov-' + id);
    if (!html) { el && el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'ov-' + id; document.body.appendChild(el); el.innerHTML = html; }
  },
  telop(n, date, title) {
    const tp = $('telop'); tp.className = '';
    $('tc').textContent = `CHAPTER ${String(n).padStart(2, '0')}`; $('td').textContent = date; $('tt').textContent = title;
    { const dl = $('dial'); dl.classList.remove('pulse'); void dl.getBoundingClientRect(); dl.classList.add('pulse'); }
    $('dialN').textContent = String(n).padStart(2, '0'); $('bugtt').textContent = title; $('hudDate').textContent = date; $('chname').textContent = `${n}. ${title}`;
    requestAnimationFrame(() => requestAnimationFrame(() => tp.classList.add('on')));
  },
  telopOff() { const tp = $('telop'); if (tp.classList.contains('on')) { tp.classList.remove('on'); tp.classList.add('off'); } },
  caption(text, live = false) {
    const c = $('caption');
    c.setAttribute('aria-live', live ? 'polite' : 'off');
    if (!text) { c.classList.add('hide'); return; }
    c.textContent = text; c.classList.remove('hide');
  },
  progress(i, n, titles) {
    const p = $('prog');
    if (p.children.length !== n) {
      p.innerHTML = '';
      for (let k = 0; k < n; k++) { const b = document.createElement('button'); b.setAttribute('aria-label', `第${k + 1}章 ${titles[k]}`); b.dataset.n = String(k + 1).padStart(2, '0'); b.innerHTML = '<i></i>'; b.onclick = () => vtr.goto(k); p.appendChild(b); }
      // 円形ゲージの外周：章の数だけ区切る
      const seg = $('dialSeg'), R = 53, gap = 3.2; let h = '';
      for (let k = 0; k < n; k++) {
        const a0 = (k * 360 / n + gap / 2 - 90) * Math.PI / 180, a1 = ((k + 1) * 360 / n - gap / 2 - 90) * Math.PI / 180;
        h += `<path class="sgm" d="M${(60 + R * Math.cos(a0)).toFixed(2)} ${(60 + R * Math.sin(a0)).toFixed(2)}A${R} ${R} 0 0 1 ${(60 + R * Math.cos(a1)).toFixed(2)} ${(60 + R * Math.sin(a1)).toFixed(2)}"/>`;
      }
      seg.innerHTML = h; $('dialT').textContent = `/ ${n}`;
    }
    [...p.children].forEach((b, k) => { b.classList.toggle('done', k < i); b.classList.toggle('cur', k === i); b.querySelector('i').style.width = k < i ? '100%' : '0'; });
    [...$('dialSeg').children].forEach((e, k) => { e.setAttribute('class', 'sgm' + (k < i ? ' done' : k === i ? ' cur' : '')); });
    $('dialProg').style.strokeDashoffset = 213.63;
  },
  progressFill(i, f) { const b = $('prog').children[i]; if (b) b.querySelector('i').style.width = `${Math.round(f * 100)}%`; $('dialProg').style.strokeDashoffset = (213.63 * (1 - Math.max(0, Math.min(1, f)))).toFixed(1); },
  // 機体の状態表示。st = { ies:'wnnn', rw:'ooo', rcs:'o', bat:'o', com:'n' }（o:正常 n:動作中 w:注意 x:故障 c:クロス運転 -:停止）
  status(st) {
    const sys = $('hudSys'); if (!st) { sys.style.visibility = 'hidden'; return; }
    sys.style.visibility = '';
    const map = { ies0: st.ies[0], ies1: st.ies[1], ies2: st.ies[2], ies3: st.ies[3], rw0: st.rw[0], rw1: st.rw[1], rw2: st.rw[2], rcs: st.rcs, bat: st.bat, com: st.com };
    sys.querySelectorAll('.si').forEach(e => { const v = map[e.dataset.k]; if (e.dataset.s !== v) { const first = e.dataset.s === undefined; e.dataset.s = v; if (!first && (v === 'x' || v === 'w' || v === 'c')) { e.classList.remove('chg'); void e.offsetWidth; e.classList.add('chg'); } } });
    $('slIes').textContent = st.ies.includes('c') ? 'イオンエンジン クロス運転' : 'イオンエンジン';
  },
  cut() { const c = $('cut'); c.style.transition = 'none'; c.style.opacity = 1; requestAnimationFrame(() => { c.style.transition = 'opacity .45s'; c.style.opacity = 0; }); },
  fade(on) { const c = $('cut'); c.style.transition = 'opacity .4s'; c.style.opacity = on ? 1 : 0; },
  playing(on) {
    $('vPlay').setAttribute('aria-label', on ? '一時停止' : '再生');
    $('playIco').innerHTML = on ? '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>' : '<path d="M7 5l12 7-12 7z"/>';
  },
  ttsState(on) { $('vTts').setAttribute('aria-pressed', on ? 'true' : 'false'); $('vTts').classList.toggle('off', !on); $('vTts').setAttribute('aria-label', on ? '読み上げ：オン' : '読み上げ：オフ'); },
  endcard(on) { const e = $('endcard'); if (on) { e.hidden = false; requestAnimationFrame(() => e.classList.add('on')); } else { e.classList.remove('on'); e.hidden = true; } },
  noise(level) {
    let cv = $('noisecv');
    if (!cv) { cv = document.createElement('canvas'); cv.id = 'noisecv'; cv.className = 'noise'; cv.width = 160; cv.height = 100; cv.style.width = '100%'; cv.style.height = '100%'; document.body.appendChild(cv); }
    cv.style.opacity = level; cv._lv = level;
  },
  signal(k) {
    const cv = $('sigcv'); if (!cv) return; const g = cv.getContext('2d'); const W = cv.width, H = cv.height;
    g.fillStyle = '#05080c'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.08)'; for (let x = 0; x < W; x += 50) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    g.strokeStyle = '#8fd0ff'; g.lineWidth = 2; g.beginPath();
    for (let x = 0; x <= W; x += 3) { const d = (x - W * 0.52) / 10; const peak = k * 95 * Math.exp(-d * d); const y = H - 28 - Math.random() * 16 - peak; x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.fillStyle = '#cfd6de'; g.font = '22px "Noto Sans JP"'; g.fillText(k > 0.6 ? 'はやぶさの電波を検出' : '探索中…', 16, 30);
  },
};
function updateOverlays() {
  for (const h of labelList) {
    if (!h.pos) continue;
    const p = h.pos(); if (!p) continue; p.project(camera);
    if (p.z > 1 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) { h.el.style.opacity = 0; continue; }
    h.el.style.opacity = 1;
    h.el.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`; h.el.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight - 14}px`;
  }
  const cv = $('noisecv');
  if (cv && cv._lv > 0) { const g = cv.getContext('2d'); const im = g.createImageData(cv.width, cv.height); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); }
}

// ---------- 読み込み ----------
let vtr, parts, mode = 'home';
const ctx = {
  renderer, camera, ui, setFov, composer, renderPass,
  setBloom(s = 0.42, r = 0.5, th = 1.1) { bloom.strength = s; bloom.radius = r; bloom.threshold = th; },
  setExposure(e) { renderer.toneMappingExposure = e; },
  snapshot(scene, cam, w, h, cutFrac = 0.62) {
    const rt = new THREE.WebGLRenderTarget(w, h); const buf = new Uint8Array(w * h * 4);
    const tm = renderer.toneMapping; renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf); renderer.setRenderTarget(null); rt.dispose(); renderer.toneMapping = tm;
    const [c, g] = TX.canvas(w, h); const im = g.createImageData(w, h);
    const cut = Math.floor(h * cutFrac);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const si = ((h - 1 - y) * w + x) * 4, di = (y * w + x) * 4;
      let v = (buf[si] * 0.3 + buf[si + 1] * 0.55 + buf[si + 2] * 0.15) / 255;
      v = Math.pow(Math.min(1, v * 1.6), 0.6) * 255 + (Math.random() - 0.5) * 26;
      if (y > cut) v = (Math.random() < 0.02 ? 40 : 0);
      im.data[di] = im.data[di + 1] = im.data[di + 2] = Math.max(0, Math.min(255, v)); im.data[di + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return c.toDataURL('image/jpeg', 0.85);
  },
};

// パーツ解説用の撮影スタジオの照明（大きな面光源を数枚）。通常の描画とレイトレーシングの両方で同じ絵を使う
function makeStudioEnv() {
  const W = 512, H = 256, d = new Uint16Array(W * H * 4), hf = THREE.DataUtils.toHalfFloat;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const boxes = [[0.9, 0.78, 0.55, 0.3, 7.5, [1.0, 0.96, 0.9]], [-1.5, 0.3, 0.5, 0.42, 3.6, [0.82, 0.9, 1.0]], [3.0, 0.5, 0.7, 0.2, 5.0, [0.9, 0.95, 1.0]], [-0.4, 1.3, 0.6, 0.16, 2.6, [1, 1, 1]]];
  // 天井の細長い照明と、壁ぎわの機材の明るさ。鏡に近いフィルムの折れ目ごとに、ちがう明るさが映る
  for (let k = 0; k < 11; k++) boxes.push([-Math.PI + k * 0.571 + 0.2, 0.98 + 0.22 * Math.sin(k * 1.7), 0.17, 0.034, 2.4, [1, 0.98, 0.95]]);
  for (let k = 0; k < 9; k++) boxes.push([-Math.PI + k * 0.698 + 0.45, 0.1 + 0.28 * Math.sin(k * 2.3 + 1), 0.11, 0.17, 0.5 + 0.45 * ((k * 7) % 5) / 4, [0.9, 0.95, 1.0]]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const az = (x + 0.5) / W * Math.PI * 2 - Math.PI, el = ((y + 0.5) / H - 0.5) * Math.PI;
    // 部屋の壁と天井のうすい明かり（鏡に近い面が真っ黒を映さないように）
    const up = Math.max(0, Math.sin(el)), wall = 0.075 + 0.085 * up;
    let r = wall * 0.95, g = wall, b = wall * 1.1;
    const fl = Math.max(0, -Math.sin(el)); r += 0.16 * fl; g += 0.14 * fl; b += 0.12 * fl;
    for (const [a0, e0, hw, hh, I, c] of boxes) {
      let da = Math.abs(az - a0); if (da > Math.PI) da = 2 * Math.PI - da;
      const k = (1 - sm(hw * 0.8, hw, da * Math.cos(el))) * (1 - sm(hh * 0.8, hh, Math.abs(el - e0))) * I;
      r += c[0] * k; g += c[1] * k; b += c[2] * k;
    }
    const i = (y * W + x) * 4; d[i] = hf(r); d[i + 1] = hf(g); d[i + 2] = hf(b); d[i + 3] = hf(1);
  }
  const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  t.mapping = THREE.EquirectangularReflectionMapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.colorSpace = THREE.LinearSRGBColorSpace; t.needsUpdate = true;
  return t;
}

async function boot() {
  prog(0.03, '画像を読み込んでいる');
  await tick();
  const T = await loadAssets(renderer, p => prog(0.03 + p * 0.62));
  prog(0.68, '機体を組み立てている'); await tick();
  const pm = new THREE.PMREMGenerator(renderer);
  ctx.envRoom = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  ctx.envStudioEq = makeStudioEnv(); ctx.envStudio = pm.fromEquirectangular(ctx.envStudioEq).texture;
  // 宇宙の場面用の映りこみ：太陽の反射は光源で出すので、ここは弱い面光だけにする
  ctx.envSpace = (() => {
    const s = new THREE.Scene();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `varying vec3 vP;
        float blob(vec3 d, float p){ return pow(max(0.0, dot(vP, normalize(d))), p); }
        void main(){ float h=vP.y; vec3 c=mix(vec3(0.03,0.032,0.04), vec3(0.11,0.12,0.14), smoothstep(-0.7,0.9,h)); c += vec3(0.5,0.46,0.4)*blob(vec3(-0.5,0.6,0.6),6.0); c += vec3(0.16,0.2,0.28)*blob(vec3(0.6,-0.2,-0.7),3.0);
          // 折れ目ごとに映りこみが変わるよう、弱い明るさのむらを散らす（自分のパドルや天体の照り返しの代わり）
          c += vec3(0.30,0.29,0.27)*(blob(vec3(0.9,0.3,0.2),40.0)+blob(vec3(-0.2,0.9,-0.4),50.0)+blob(vec3(-0.8,-0.1,-0.5),40.0)+blob(vec3(0.1,-0.8,0.6),30.0)+blob(vec3(0.5,0.5,-0.7),60.0)+blob(vec3(-0.7,0.4,0.6),60.0)+blob(vec3(0.3,0.1,0.95),45.0)+blob(vec3(-0.3,-0.6,-0.75),45.0));
          gl_FragColor=vec4(c,1.); }` }));
    s.add(sky);
    return pm.fromScene(s, 0.03).texture;
  })();
  ctx.T = T;
  vtr = createVTR(ctx); prog(0.9, '背景を用意している'); await tick();
  parts = createParts(ctx);
  prog(1, '準備ができた');
  bindUI();
  route();
  setTimeout(() => $('loading').classList.add('done'), 200);
  requestAnimationFrame(loop);
}
const PI2 = Math.PI / 2;

// ---------- 画面の切り替え ----------
function show(id) { ['home', 'vtr', 'parts'].forEach(k => $(k).hidden = k !== id); }
function unlockSpeech() { try { if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } } catch (e) { } }
function route(gesture = false) {
  const h = location.hash.replace('#', '');
  if (h === 'vtr') {
    if (mode !== 'vtr') {
      parts.leave(); mode = 'vtr'; show('vtr');
      if (!gesture) {
        // 直接開いた場合は、読み上げのために一度タップしてもらう
        const ov = document.createElement('div'); ov.id = 'tapstart';
        ov.innerHTML = '<button class="primary" style="min-height:76px;padding:14px 26px;border-radius:14px;background:linear-gradient(135deg,#e2bd72,#b8904a);color:#16120a;font-weight:900;font-size:20px">タップして再生</button>';
        $('vtr').appendChild(ov);
        ov.onclick = () => { unlockSpeech(); ov.remove(); vtr.start(0); };
      } else vtr.start(0);
    }
  } else if (h === 'parts') {
    if (mode === 'vtr') vtr.stop();
    mode = 'parts'; show('parts'); parts.enter();
  } else {
    if (mode === 'vtr') vtr.stop();
    mode = 'home'; show('home'); parts.showcase();
  }
}
addEventListener('hashchange', () => route(false));
function nav(hash, gesture) { if (location.hash === hash) route(gesture); else { history.pushState(null, '', hash || location.pathname); route(gesture); } }
addEventListener('popstate', () => route(false));

function bindUI() {
  $('goVtr').onclick = () => { unlockSpeech(); nav('#vtr', true); };
  $('goParts').onclick = () => nav('#parts', true);
  $('vBack').onclick = () => nav('#', true);
  $('pBack').onclick = () => nav('#', true);
  $('vPlay').onclick = () => vtr.toggle();
  $('vNext').onclick = () => vtr.next();
  $('vPrev').onclick = () => vtr.prev();
  $('vTts').onclick = () => { unlockSpeech(); vtr.setTTS(!vtr.tts); };
  $('endParts').onclick = () => { ui.endcard(false); nav('#parts', true); };
  $('endAgain').onclick = () => { unlockSpeech(); ui.endcard(false); vtr.start(0); };
  // 操作パネルの自動非表示
  let idleT = 0; const vc = $('vctrl');
  const wake = () => { vc.classList.remove('idle'); idleT = performance.now(); };
  $('vhit').addEventListener('pointerdown', () => { if (vc.classList.contains('idle')) wake(); else vtr.toggle(); wake(); });
  vc.addEventListener('pointerdown', wake);
  setInterval(() => { if (mode === 'vtr' && performance.now() - idleT > 4000 && !$('endcard').classList.contains('on')) vc.classList.add('idle'); }, 500);
  addEventListener('keydown', e => {
    if (mode !== 'vtr') return;
    if (e.code === 'Space') { e.preventDefault(); vtr.toggle(); wake(); }
    if (e.code === 'ArrowRight') { vtr.next(); wake(); }
    if (e.code === 'ArrowLeft') { vtr.prev(); wake(); }
  });
  ui.ttsState(true);
}

// ---------- ループ ----------
const clock = new THREE.Clock(); let T0 = 0;
function loop() {
  requestAnimationFrame(loop);
  const sp = window.__speed || 1; const dt = Math.min(0.05 * sp, clock.getDelta() * sp); T0 += dt;
  let scene;
  if (mode === 'vtr') { vtr.update(dt); scene = vtr.scene; }
  else { parts.update(dt, T0); scene = parts.scene; if (bloom.strength !== 0.2) ctx.setBloom(0.2, 0.4, 1.2); }
  renderPass.scene = scene;
  if (!(mode === 'parts' && parts.render(() => composer.render()))) composer.render();
  updateOverlays();
}
window.__hb = { get vtr() { return vtr; }, get parts() { return parts; }, ui, renderer, camera };
boot().catch(e => { console.error(e); ldmsg.textContent = '読み込み中に問題が起きた：' + e.message; });
