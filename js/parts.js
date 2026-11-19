import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildHayabusa, withG } from './hayabusa.js';
import { PARTS, CATS, PART_BY_ID } from './partsdata.js';
import { DETAIL } from './partsdetail.js';
import * as ENV from './env.js';

const PI = Math.PI;
// レイトレーシングのライブラリが読む、背景と映りこみの向き（このバージョンのthree.jsには無いので補う）
for (const k of ['backgroundRotation', 'environmentRotation']) if (!(k in THREE.Scene.prototype)) { const e = new THREE.Euler(); Object.defineProperty(THREE.Scene.prototype, k, { get() { return e; }, configurable: true }); }
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);

export function createParts(ctx) {
  const { camera, renderer, T } = ctx;
  const scene = new THREE.Scene();
  scene.environment = ctx.envStudio;
  scene.background = new THREE.Color(0x06080c);
  // 背景
  const bg = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vP; void main(){ vP=normalize(position); vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <logdepthbuf_pars_fragment>
      varying vec3 vP; void main(){
      #include <logdepthbuf_fragment>
      float h=vP.y; vec3 a=vec3(0.035,0.045,0.07), b=vec3(0.006,0.007,0.01);
      vec3 c=mix(b,a,smoothstep(-0.4,0.8,h)); c+=vec3(0.06,0.05,0.03)*pow(max(0.0,1.0-abs(h+0.05)*3.0),3.0);
      gl_FragColor=vec4(c,1.0);} `,
    side: THREE.BackSide, depthWrite: false,
  }));
  scene.add(bg);
  const key = new THREE.DirectionalLight(0xfff1df, 1.7); key.position.set(3, 6, 2.5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 20 }); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02;
  const rim = new THREE.DirectionalLight(0x9cc4ff, 0.9); rim.position.set(-4, 2, -4);
  const hemi = new THREE.HemisphereLight(0xc8d6ff, 0x221a10, 0.35);
  scene.add(key, rim, hemi);
  for (const l of [key, rim, hemi]) l.layers.enable(1);        // レイトレーシングで、あとから重ねて描く物にも同じ光を当てる
  // 台座
  const shadowPlane = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.ShadowMaterial({ opacity: 0.45 }));
  shadowPlane.rotation.x = -PI / 2; shadowPlane.position.y = -1.62; shadowPlane.receiveShadow = true; scene.add(shadowPlane);
  const rasterOnly = [bg, shadowPlane], studioOnly = [bg, shadowPlane];
  for (let i = 1; i <= 4; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(i * 0.9, i * 0.9 + 0.006, 128), new THREE.MeshBasicMaterial({ color: 0xe2bd72, transparent: true, opacity: 0.22 / i, side: THREE.DoubleSide }));
    ring.rotation.x = -PI / 2; ring.position.y = -1.6; scene.add(ring); rasterOnly.push(ring); studioOnly.push(ring);
  }

  const hb = buildHayabusa(T);
  const holder = new THREE.Group(); holder.add(hb.root); hb.root.rotation.x = -PI / 2; scene.add(holder);
  hb.setThrust([0, 0, 0, 0]);
  hb.mats.cells.envMapIntensity = 0.3; hb.mats.osr.envMapIntensity = 0.6;             // スタジオ照明の映りこみで白く飛ばないように

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 0.45; controls.maxDistance = 16;
  controls.autoRotate = true; controls.autoRotateSpeed = 0.8; controls.enablePan = true; controls.enabled = false;
  controls.target.set(0, 0, 0);

  // ---------- UI ----------
  const chips = document.getElementById('chips');
  const info = document.getElementById('pinfo');
  const plabel = document.getElementById('plabel'), plabelT = document.getElementById('plabelT');
  const btnX = document.getElementById('tXray'), btnE = document.getElementById('tExp'), btnR = document.getElementById('tRot'), btnReset = document.getElementById('tReset');
  const order = [...PARTS].sort((a, b) => CATS.indexOf(a.cat) - CATS.indexOf(b.cat));
  order.forEach(p => {
    const b = document.createElement('button'); b.className = 'chip'; b.setAttribute('role', 'option'); b.dataset.id = p.id;
    b.innerHTML = `<span class="c">${p.cat}</span>${p.name}`; b.setAttribute('aria-selected', 'false');
    b.onclick = () => select(p.id, true);
    chips.appendChild(b);
  });
  function renderInfo() {
    if (!sel) {
      info.innerHTML = `<p class="hint">機体のパーツをタップするか、上の一覧から選ぶと、<b>はたらき</b>、<b>しくみ</b>、<b>式と数値</b>を切り替えて見られる。<b>内部</b>で外板を透かし、<b>分解</b>でパーツを離す。<b>大きさ</b>で人や物差しと比べ、<b>背景</b>で宇宙と着地の場面に切り替える。<b>レイトレ</b>は、${LIVE.ok ? '光線を追って反射と影を描く。動かしているあいだも計算を続ける' : '止めているあいだに光の反射と影を計算して描く'}。</p>`;
      return;
    }
    const p = PART_BY_ID[sel], d = DETAIL[sel] || {}; const i = order.findIndex(x => x.id === sel);
    info.innerHTML = `<div class="info">
      <div><div class="cat">${p.cat}${p.internal ? '　/　機体の内部' : ''}</div><h3>${p.name}</h3><div class="sub">${p.sub}</div></div>
      <div class="nav"><button class="ib" id="pPrev" aria-label="前のパーツ"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><button class="ib" id="pNext" aria-label="次のパーツ"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div>
      <div class="tabs" role="tablist">${['はたらき', 'しくみ', '式と数値'].map((n, k) => `<button role="tab" data-t="${k}" aria-selected="${k === tab}">${n}</button>`).join('')}</div>
      <div class="pane" data-t="0"${tab === 0 ? '' : ' hidden'}><p class="txt">${p.text}</p><p class="ep"><b>はやぶさの旅では</b>${p.ep}</p></div>
      <div class="pane" data-t="1"${tab === 1 ? '' : ' hidden'}><ol class="how">${(d.how || []).map((h, k) => `<li><b>${k + 1}</b><span>${h}</span></li>`).join('')}</ol></div>
      <div class="pane" data-t="2"${tab === 2 ? '' : ' hidden'}>${(d.fx || []).map(([f, e]) => `<div class="fx"><div class="f">${f}</div><div class="d">${e}</div></div>`).join('')}<div class="nums">${(d.nums || []).map(([l, v, u]) => `<div><i>${l}</i><b${/[0-9]/.test(v) ? '' : ' class="w"'}>${v}${u ? `<small>${u}</small>` : ''}</b></div>`).join('')}</div></div></div>`;
    info.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
      tab = +b.dataset.t;
      info.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', x === b ? 'true' : 'false'));
      info.querySelectorAll('.pane').forEach(x => { x.hidden = +x.dataset.t !== tab; });
    });
    document.getElementById('pPrev').onclick = () => select(order[(i - 1 + order.length) % order.length].id, true);
    document.getElementById('pNext').onclick = () => select(order[(i + 1) % order.length].id, true);
  }

  // ---------- 状態 ----------
  let sel = null, selAt = -1, tab = 0, mOpen = 0, vOff = 0, xray = 0, xrayT = 0, exp = 0, expT = 0, active = false, showcase = false, hlId = null;
  let fly = null;
  const box = new THREE.Box3(), tmpB = new THREE.Box3(), center = new THREE.Vector3(), size = new THREE.Vector3();
  function partBox(id) {
    box.makeEmpty();
    hb.parts[id].meshes.forEach(m => { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); tmpB.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); box.union(tmpB); });
    return box;
  }
  function setEmissive(id, on, k = 0.4) { if (on) { if (hlId !== id) { hb.highlight(id, k); hlId = id; } hb.setHl(k); } else if (hlId) { hb.highlight(null); hlId = null; } }
  function select(id, focus) {
    if (sel === id) { focus && flyTo(id); return; }
    setEmissive(null, false);
    sel = id; selAt = -1;
    chips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-selected', c.dataset.id === id ? 'true' : 'false'));
    if (id) {
      const c = chips.querySelector(`[data-id="${id}"]`); c && c.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      if (PART_BY_ID[id].internal && xrayT < 1) setXray(true);
      if (id === 'mli' && xrayT > 0) setXray(false);
      plabelT.textContent = PART_BY_ID[id].name;
      setBtn(btnR, false); controls.autoRotate = false;
      if (focus) flyTo(id);
    }
    renderInfo();
  }
  function flyTo(id) {
    holder.updateMatrixWorld(true);
    partBox(id).getCenter(center); box.getSize(size);
    const dist = Math.min(6.5, Math.max(0.9, size.length() * 2.2 + 0.55));
    const dir = camera.position.clone().sub(controls.target).normalize();
    // 外側に付くパーツは、そのパーツが向いている側から見る（パドルやアンテナにさえぎられないように）
    if (!PART_BY_ID[id].internal && id !== 'paddle' && id !== 'mli' && id !== 'radiator' && id !== 'structure') {
      const out = center.clone(); if (out.length() > 0.35) { out.normalize(); dir.multiplyScalar(0.45).addScaledVector(out, 0.9); if (Math.abs(out.y) < 0.5) dir.y = Math.max(dir.y, 0.12) * 0.6; dir.normalize(); }
    }
    // 下面の機器は下から、上面の機器は上から見る
    if (center.y < -0.6 && dir.y > -0.1) dir.y = -0.35;
    if (center.y > 0.6 && dir.y < 0.25) dir.y = 0.5;
    dir.normalize();
    fly = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), t1: center.clone(), p1: center.clone().addScaledVector(dir, dist) };
  }
  function resetView() {
    select(null);
    fly = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), t1: new THREE.Vector3(0, 0, 0), p1: new THREE.Vector3(4.6, 2.3, 5.6) };
    plabel.classList.remove('on');
  }
  function setBtn(b, on) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  function setXray(on) { xrayT = on ? 1 : 0; setBtn(btnX, on); }
  btnX.onclick = () => setXray(xrayT < 1);
  let refly = 0;                                   // 分解の切り替えでパーツが動くので、動き終わったら選択中のパーツへ視点を合わせ直す
  btnE.onclick = () => { expT = expT < 1 ? 1 : 0; setBtn(btnE, expT === 1); if (sel) refly = 1.2; };
  btnR.onclick = () => { controls.autoRotate = !controls.autoRotate; setBtn(btnR, controls.autoRotate); };
  btnReset.onclick = resetView;

  // ---------- レイトレーシング（止めているあいだ、光の反射と影を1本ずつ追って描く） ----------
  const btnRt = document.getElementById('tRt'), rtStat = document.getElementById('rtstat');
  const RT = { on: false, pt: null, ready: false, dirty: true, busy: false, camDirty: true, wait: 0, max: T.lowMem ? 240 : 500 };
  const rtFloor = new THREE.Mesh(new THREE.CircleGeometry(7, 48), withG(new THREE.MeshStandardMaterial({ color: 0x25272c, roughness: 0.62, metalness: 0 })));
  rtFloor.rotation.x = -PI / 2; rtFloor.position.y = -1.62; rtFloor.visible = false; scene.add(rtFloor);
  function rtMsg(text, hold = 0) { rtStat.textContent = text; rtStat.classList.add('on'); if (hold) setTimeout(() => { if (!RT.on) rtStat.classList.remove('on'); }, hold); }
  // 既定は、止めているあいだに時間をかけて仕上げる方式。パソコンでは、動かしているあいだも毎フレーム光線を追う方式へ切り替えられる
  const LIVE = { can: !T.lowMem && renderer.capabilities.isWebGL2 && matchMedia('(pointer: fine)').matches, ok: false, on: false, rt: null, dirty: true, wait: 0, busy: false };
  const btnLive = document.getElementById('tLive');
  const liveBtn = () => { const on = RT.on || LIVE.on; btnLive.hidden = !(on && LIVE.can); btnLive.textContent = LIVE.on ? '時間をかけて仕上げる方式へ' : '動かしながら描く方式へ'; };
  btnLive.onclick = async () => { const want = !LIVE.on; await rtEnable(false); LIVE.ok = want; await rtEnable(true); };
  function liveLook(on) { rasterOnly.forEach(o => { o.visible = !on && SC.mode === 0; }); rtFloor.visible = on; renderer.shadowMap.autoUpdate = true; renderer.shadowMap.needsUpdate = true; if (!on && LIVE.rt) LIVE.rt.off(); }
  async function liveEnable(on) {
    if (LIVE.busy || on === LIVE.on) return;
    if (!on) { LIVE.on = false; setBtn(btnRt, false); rtStat.classList.remove('on'); liveLook(false); return; }
    LIVE.busy = true; setBtn(btnRt, true); rtMsg('レイトレーシングを準備している');
    try {
      if (!LIVE.rt) { const { createLiveRT } = await import('./rtlive.js'); LIVE.rt = createLiveRT({ renderer, scene, camera, composer: ctx.composer, renderPass: ctx.renderPass, envEq: ctx.envStudioEq, key, rim, hemi, floor: rtFloor, hb }); }
      LIVE.busy = false;
      if (!active) { setBtn(btnRt, false); rtStat.classList.remove('on'); return; }       // 準備のあいだに画面を離れていたら、始めない
      LIVE.on = true; LIVE.dirty = true; LIVE.wait = 0; LIVE.sig = ''; liveLook(true);
    } catch (e) { console.warn(e); liveFail(); }
  }
  // この方式が使えない環境では、止めているあいだに計算する方式へ切り替える
  function liveFail() { LIVE.ok = false; LIVE.can = false; LIVE.on = false; LIVE.busy = false; liveLook(false); rtEnable(true); }
  async function rtEnable(on) {
    if (LIVE.ok || LIVE.on) return liveEnable(on);
    if (RT.busy || on === RT.on) return;
    if (!on) { RT.on = false; setBtn(btnRt, false); rtStat.classList.remove('on'); return; }
    RT.busy = true; setBtn(btnRt, true); rtMsg('レイトレーシングを準備している');
    try {
      if (!RT.pt) {
        const { WebGLPathTracer } = await import('three-gpu-pathtracer');
        const pt = new WebGLPathTracer(renderer);
        pt.bounces = 5; pt.filterGlossyFactor = 0.4; pt.tiles.set(T.lowMem ? 3 : 2, T.lowMem ? 3 : 2);
        pt.renderScale = T.lowMem ? 0.5 : Math.min(1, 1.3 / renderer.getPixelRatio());
        pt.minSamples = 3; pt.renderDelay = 80; pt.fadeDuration = 350; pt.dynamicLowRes = false; pt.rasterizeScene = true;
        pt.textureSize.set(T.lowMem ? 512 : 1024, T.lowMem ? 512 : 1024);
        RT.pt = pt;
      }
      RT.on = true; RT.dirty = true; RT.wait = 0; controls.autoRotate = false; setBtn(btnR, false);
    } catch (e) { console.warn(e); RT.on = false; setBtn(btnRt, false); rtMsg('この端末ではレイトレーシングを使えない', 4000); }
    RT.busy = false;
  }
  function rtBuild() {
    // 光を追う計算に使えない表示用の物（背景の球、影の受け皿、選択の発光）を外してから、形と材質を渡す
    setEmissive(null, false);
    const vis = rasterOnly.map(o => o.visible); rasterOnly.forEach(o => { o.visible = false; }); rtFloor.visible = true;
    const env = scene.environment; scene.environment = ctx.envStudioEq;
    try { scene.updateMatrixWorld(true); RT.pt.setScene(scene, camera); RT.ready = true; }
    catch (e) { console.warn(e); RT.ready = false; RT.on = false; setBtn(btnRt, false); rtMsg('この端末ではレイトレーシングを使えない', 4000); }
    scene.environment = env; rasterOnly.forEach((o, i) => { o.visible = vis[i]; }); rtFloor.visible = false;
    RT.dirty = false; RT.camDirty = false;
  }
  btnRt.onclick = () => rtEnable(!(RT.on || LIVE.on));
  setInterval(liveBtn, 400);
  controls.addEventListener('change', () => { RT.camDirty = true; });

  // ---------- 背景：スタジオ／宇宙を飛ぶ／イトカワに着地 ----------
  const btnBg = document.getElementById('tBg'), btnSize = document.getElementById('tSize');
  const SC = { mode: 0, names: ['スタジオ', '宇宙', '着地'], long: ['スタジオ', '宇宙を飛んでいるところ', 'イトカワに着地したところ'], stars: null, sun: null, ito: null };
  const FLOOR = -1.62;
  function setScene(m) {
    if (m !== 0 && (RT.on || LIVE.on)) rtEnable(false);            // レイトレーシングはスタジオでだけ使う
    SC.mode = m;
    studioOnly.forEach(o => { o.visible = m === 0; });
    if (m > 0 && !SC.stars) { SC.stars = ENV.makeStars(T); SC.stars.setPixelRatio(renderer.getPixelRatio()); scene.add(SC.stars);
      SC.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: new THREE.Color(9, 8, 6.5), blending: THREE.AdditiveBlending, depthWrite: false })); SC.sun.scale.setScalar(60000); SC.sun.frustumCulled = false; scene.add(SC.sun); }
    if (m === 2 && !SC.ito) { SC.ito = ENV.makeItokawa(T); SC.ito.placeSiteUp(0); const pt = SC.ito.makePatch(); SC.ito.detail.value = 1; scene.add(SC.ito);
      // ホーンの先が地面に触れる高さへ、地面を合わせる
      const tip = new THREE.Vector3(hb.meta.horn.x, hb.meta.horn.y, hb.meta.horn.tip); holder.updateMatrixWorld(true); hb.root.localToWorld(tip);
      const v = new THREE.Vector3(tip.x, 0, tip.z); SC.ito.worldToLocal(v); v.sub(pt.c0); SC.dy = tip.y - pt.height(v.dot(pt.t1), v.dot(pt.t2)) + 0.01; SC.ito.position.y += SC.dy; SC.ito.updateMatrixWorld(true);
      SC.gy = (x, z) => { const q = new THREE.Vector3(x, 0, z); SC.ito.worldToLocal(q); q.sub(pt.c0); return pt.height(q.dot(pt.t1), q.dot(pt.t2)) + SC.dy; }; }
    if (SC.stars) { SC.stars.setOpacity(m ? 1 : 0); SC.sun.visible = m > 0; }
    if (SC.ito) SC.ito.visible = m === 2;
    scene.environment = m ? ctx.envSpace : ctx.envStudio;
    const sd = m === 2 ? [0.24, 0.95, 0.17] : m === 1 ? [-0.45, 0.62, 0.64] : [3, 6, 2.5];
    key.position.set(sd[0], sd[1], sd[2]).normalize().multiplyScalar(m ? 9 : 7.2); key.intensity = m ? 3.3 : 1.7; key.color.setHex(m ? 0xfff6ea : 0xfff1df);
    if (SC.sun) SC.sun.position.copy(key.position).normalize().multiplyScalar(400000);
    rim.intensity = m ? 0.12 : 0.9;
    hemi.intensity = m === 2 ? 1.2 : m === 1 ? 0.07 : 0.35; hemi.color.setHex(m === 2 ? 0x06080c : 0xc8d6ff); hemi.groundColor.setHex(m === 2 ? 0x8f7d66 : 0x221a10);
    hb.mats.cells.envMapIntensity = m ? 1.1 : 0.3; hb.mats.osr.envMapIntensity = m ? 1.3 : 0.6;
    hb.setThrust(m === 1 ? [0, 0.75, 0.75, 0.75] : [0, 0, 0, 0]);
    controls.maxPolarAngle = m === 2 ? PI * 0.53 : PI;
    btnBg.lastChild.textContent = SC.names[m]; setBtn(btnBg, m > 0); btnBg.setAttribute('aria-label', `背景を切り替える。今は、${SC.long[m]}`);
    btnRt.disabled = m !== 0; btnRt.style.opacity = m ? 0.4 : 1;
    // 明るい地面の上では、寸法の線と人の形を濃い色にして見分けやすくする
    if (SZ.fig) { SZ.fig.position.y = m === 2 ? SC.gy(SZ.fig.position.x, SZ.fig.position.z) : SZ.y0; SZ.figLab.y = SZ.fig.position.y + 1.86; }      // 人の形は地面の高さに立たせる
    cyan.color.setHex(m === 2 ? 0x064a63 : 0x4be1ff); if (SZ.fm) { SZ.fm.color.setHex(m === 2 ? 0x0b6f8f : 0x4be1ff); SZ.fm.opacity = m === 2 ? 0.72 : 0.26; }
    renderer.shadowMap.needsUpdate = true;
  }
  btnBg.onclick = () => { setScene((SC.mode + 1) % 3); rtMsg(`背景：${SC.long[SC.mode]}`, 2600); };

  // ---------- 大きさ：人との比較、機体の寸法、選んだパーツの物差し ----------
  const dimsEl = document.getElementById('dims');
  const SZ = { on: false, g: new THREE.Group(), labels: [], bar: null, barLab: null };
  const cyan = new THREE.LineBasicMaterial({ color: 0x4be1ff, transparent: true, opacity: 0.95, depthTest: false });
  const mkLab = (html) => { const el = document.createElement('div'); el.className = 'dim'; el.innerHTML = html; el.hidden = true; dimsEl.appendChild(el); return el; };
  const putLab = (el, p, dy = 0) => { tmpV.copy(p).project(camera); const show = SZ.on && active && tmpV.z < 1; el.hidden = !show; if (show) { el.style.left = `${(tmpV.x * 0.5 + 0.5) * innerWidth}px`; el.style.top = `${(-tmpV.y * 0.5 + 0.5) * innerHeight + dy}px`; } };
  const tmpV = new THREE.Vector3();
  { SZ.g.visible = false; SZ.g.renderOrder = 20; scene.add(SZ.g);
    // 機体の外寸（公表値：パドルの端から端まで約5.7m、パドルの長さ約4.2m、高さ約2.8m）
    holder.updateMatrixWorld(true); const bb = new THREE.Box3(); for (const id in hb.parts) if (!PART_BY_ID[id] || !PART_BY_ID[id].internal) bb.union(partBox(id));
    const o = 0.32, y0 = bb.min.y, P = [], seg = (a, b) => P.push(a.x, a.y, a.z, b.x, b.y, b.z), V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const dimLine = (a, b, n) => { seg(a, b); for (const e of [a, b]) seg(e.clone().addScaledVector(n, 0.09), e.clone().addScaledVector(n, -0.09)); };
    const xo = bb.min.x - o, zo = bb.max.z + o;                 // 初めの視点で、解説のパネルに隠れない左手前の側に置く
    dimLine(V3(xo, y0, bb.min.z), V3(xo, y0, bb.max.z), V3(1, 0, 0)); dimLine(V3(bb.min.x, y0, zo), V3(bb.max.x, y0, zo), V3(0, 0, 1)); dimLine(V3(xo, bb.min.y, zo), V3(xo, bb.max.y, zo), V3(-0.7, 0, 0.7));
    for (const [x, z] of [[bb.min.x, bb.min.z], [bb.max.x, bb.min.z], [bb.min.x, bb.max.z], [bb.max.x, bb.max.z]]) seg(V3(x, y0, z), V3(x, y0 + 0.12, z));
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); SZ.g.add(new THREE.LineSegments(lg, cyan));
    SZ.labels.push([mkLab('<small>幅</small>約5.7m'), V3(xo, y0, 0)], [mkLab('<small>奥行き</small>約4.2m'), V3(0, y0, zo)], [mkLab('<small>高さ</small>約2.8m'), V3(xo, (bb.min.y + bb.max.y) / 2, zo)]);
    // 1mごとの床の目盛り
    const G = []; for (let i = -5; i <= 5; i++) { G.push(i, y0, -5, i, y0, 5, -5, y0, i, 5, y0, i); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(G, 3)); SZ.grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x4be1ff, transparent: true, opacity: 0.16, depthWrite: false })); SZ.g.add(SZ.grid);
    // 身長1.7mの人の形（いつもこちらを向く）
    const poly = (pts) => { const sh = new THREE.Shape(); pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])); return sh; };
    const body = [[0.03, 0], [0.13, 0], [0.14, 0.45], [0.17, 0.86], [0.18, 1.1], [0.2, 1.36], [0.16, 1.43], [0.06, 1.46], [0.05, 1.5], [-0.05, 1.5], [-0.06, 1.46], [-0.16, 1.43], [-0.2, 1.36], [-0.18, 1.1], [-0.17, 0.86], [-0.14, 0.45], [-0.13, 0], [-0.03, 0], [-0.02, 0.45], [0, 0.8], [0.02, 0.45]];
    const arm = [[0.215, 1.36], [0.27, 1.32], [0.285, 1.0], [0.275, 0.72], [0.235, 0.72], [0.225, 1.0], [0.21, 1.28]];
    const hd = new THREE.Shape(); hd.absarc(0, 1.6, 0.1, 0, PI * 2);
    const fig = new THREE.Group(), fm = new THREE.MeshBasicMaterial({ color: 0x4be1ff, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false });
    for (const s2 of [poly(body), poly(arm), poly(arm.map(p => [-p[0], p[1]])), hd]) { fig.add(new THREE.Mesh(new THREE.ShapeGeometry(s2, 24), fm)); fig.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(s2.getPoints(24)), cyan)); }
    fig.position.set(bb.min.x - 0.2, y0, bb.max.z + 0.95); SZ.fig = fig; SZ.fm = fm; SZ.g.add(fig);
    SZ.y0 = y0; SZ.figLab = V3(fig.position.x, y0 + 1.86, fig.position.z); SZ.labels.push([mkLab('<small>人</small>1.7m'), SZ.figLab]);
    // 選んだパーツの物差し
    const bgm = new THREE.BufferGeometry(); bgm.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(18), 3)); SZ.bar = new THREE.LineSegments(bgm, cyan); SZ.bar.frustumCulled = false; SZ.bar.visible = false; scene.add(SZ.bar);
    SZ.barLab = mkLab('');
    SZ.g.traverse(o2 => { o2.layers.enable(1); o2.renderOrder = 5; }); SZ.bar.layers.enable(1); SZ.bar.renderOrder = 5; }      // 地面の細かい模様（あとから重ねて描く面）より後に描く
  const RULES = [[0.01, '1cm'], [0.02, '2cm'], [0.05, '5cm'], [0.1, '10cm'], [0.2, '20cm'], [0.5, '50cm'], [1, '1m'], [2, '2m']];
  function sizeUpdate() {
    const on = SZ.on && active && exp < 0.02;
    SZ.g.visible = on; SZ.grid.visible = SC.mode !== 2;
    if (on) SZ.fig.rotation.y = Math.atan2(camera.position.x - SZ.fig.position.x, camera.position.z - SZ.fig.position.z);
    for (const [el, p] of SZ.labels) { if (on) putLab(el, p); else el.hidden = true; }
    const showBar = SZ.on && active && !!sel;
    SZ.bar.visible = showBar;
    if (showBar) {
      const b = partBox(sel); b.getCenter(center); b.getSize(size); const L = Math.max(size.x, size.y, size.z), r = size.length() / 2;
      let rule = RULES[0]; for (const q of RULES) if (q[0] <= L * 0.8) rule = q;
      const right = tmpV.set(1, 0, 0).applyQuaternion(camera.quaternion).clone(), up = tmpV.set(0, 1, 0).applyQuaternion(camera.quaternion).clone();
      const c = center.clone().addScaledVector(up, -(r * 0.75 + 0.02)), a = c.clone().addScaledVector(right, -rule[0] / 2), e = c.clone().addScaledVector(right, rule[0] / 2), t = Math.max(0.004, rule[0] * 0.08);
      const pa = SZ.bar.geometry.attributes.position; [a, e, a.clone().addScaledVector(up, t), a.clone().addScaledVector(up, -t), e.clone().addScaledVector(up, t), e.clone().addScaledVector(up, -t)].forEach((v, i) => pa.setXYZ(i, v.x, v.y, v.z)); pa.needsUpdate = true;
      SZ.barLab.innerHTML = `<small>物差し</small>${rule[1]}`; putLab(SZ.barLab, c, 20);
    } else SZ.barLab.hidden = true;
  }
  btnSize.onclick = () => { SZ.on = !SZ.on; setBtn(btnSize, SZ.on); if (SZ.on && (RT.on || LIVE.on)) rtEnable(false);
    // 人の形と寸法の数字が入るところまで、視点を引く
    if (SZ.on && !sel) { setBtn(btnR, false); controls.autoRotate = false; fly = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), t1: new THREE.Vector3(-0.5, -0.45, 0.7), p1: new THREE.Vector3(5.6, 3.0, 8.4) }; } };

  // ---------- タップで選択 ----------
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { if (!active) return; down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!active || !down) return;
    const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]); down = null;
    if (moved > 8) return;
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObject(hb.root, true).filter(h => {
      const o = h.object; if (o.userData.noPick || !o.userData.partId) return false;
      let v = o; while (v) { if (!v.visible) return false; v = v.parent; }
      if (o.material.transparent && o.material.opacity < 0.5) return false;
      return true;
    });
    if (hits.length) select(hits[0].object.userData.partId, true);
    else select(null);
  });

  renderInfo();
  const tmp = new THREE.Vector3();
  return {
    scene, controls, hb, get live() { return LIVE.rt; }, get liveBuild() { return LIVE.last; }, get sc() { return SC; }, get sz() { return SZ; },
    enter() {
      camera.clearViewOffset(); active = true; showcase = false; controls.enabled = true; controls.autoRotate = !sel; setBtn(btnR, controls.autoRotate);
      camera.position.set(4.6, 2.3, 5.6); controls.target.set(0, 0, 0); camera.lookAt(0, 0, 0); ctx.setFov(38);
      controls.update();
    },
    showcase() {
      active = false; showcase = true; controls.enabled = false; setEmissive(null, false); sel = null; renderInfo();
      chips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-selected', 'false'));
      xrayT = 0; expT = 0; setBtn(btnX, false); setBtn(btnE, false); rtEnable(false); if (SC.mode) setScene(0); sizeUpdate();
    },
    leave() { camera.clearViewOffset(); active = false; controls.enabled = false; plabel.classList.remove('on'); rtEnable(false); sizeUpdate(); },
    // レイトレーシングで描いたら true を返す。drawRaster は、計算がたまるまでの通常の描画
    render(drawRaster) {
      if (LIVE.on && active) {
        if (xray !== xrayT || exp !== expT || (mOpen !== 0 && mOpen !== 1)) { LIVE.dirty = true; LIVE.wait = 0; renderer.shadowMap.autoUpdate = true; rtMsg('レイトレーシング：形が動き終わるのを待っている'); return false; }
        const sig = xray + ',' + exp + ',' + mOpen;        // 透かし・分解・箱の開閉が前に読みこんだときと違えば、形を読みこみ直す
        if (sig !== LIVE.sig) { LIVE.dirty = true; LIVE.sig = sig; LIVE.wait = 0; }
        if (LIVE.dirty) {
          rtMsg('レイトレーシング：形を読みこんでいる'); if (++LIVE.wait < 3) return false;
          try { LIVE.last = LIVE.rt.build({ ghost: xray > 0.5 }); } catch (e) { console.warn(e); liveFail(); return false; }
          LIVE.dirty = false; renderer.shadowMap.autoUpdate = false;
        }
        if (!LIVE.rt.render()) { liveFail(); return false; }
        rtMsg(LIVE.rt.status());
        return true;
      }
      if (!RT.on || !RT.pt || !active) return false;
      const moving = Math.abs(xray - xrayT) > 0.004 || Math.abs(exp - expT) > 0.004 || !!fly || (mOpen > 0.004 && mOpen < 0.996);
      if (moving) { RT.dirty = true; RT.wait = 0; rtMsg('レイトレーシング：動きが止まるのを待っている'); return false; }
      if (RT.dirty) { rtMsg('レイトレーシング：形を読みこんでいる'); if (++RT.wait < 5) return false; rtBuild(); if (!RT.ready) return false; }
      if (RT.camDirty) { RT.pt.updateCamera(); RT.camDirty = false; }
      const pt = RT.pt; pt.rasterizeSceneCallback = drawRaster; pt.pausePathTracing = pt.samples >= RT.max;
      pt.renderSample();
      rtMsg(pt.isCompiling ? 'レイトレーシング：準備している' : pt.samples >= RT.max ? `レイトレーシング：${RT.max}回の計算を終えた` : `レイトレーシング：${Math.floor(pt.samples)} / ${RT.max} 回`);
      return true;
    },
    update(dt, t) {
      xray += (xrayT - xray) * Math.min(1, dt * 5);
      exp += (expT - exp) * Math.min(1, dt * 4);
      const mT = sel === 'minerva' && !showcase ? 1 : 0;
      mOpen += (mT - mOpen) * Math.min(1, dt * 3.5);
      // 目標のすぐ近くまで来たら、ぴったり合わせて止める（レイトレーシングが「形が動いているか」を確かめるため）
      if (Math.abs(xray - xrayT) < 0.004) xray = xrayT; if (Math.abs(exp - expT) < 0.004) exp = expT; if (Math.abs(mOpen - mT) < 0.004) mOpen = mT;
      hb.setXray(xray); hb.setExplode(ease(exp));
      hb.setMinervaOpen(ease(mOpen) * (1 - ease(exp)));          // 選ぶと箱が開いて、中のローバが見える
      hb.tick(t, dt);
      if (SC.stars) SC.stars.position.copy(camera.position);
      if (refly > 0 && (refly -= dt) <= 0 && sel && !showcase) flyTo(sel);
      if (showcase) {
        const a = t * 0.12;
        const r = innerWidth < innerHeight ? 8.2 : 7.6;
        const port = innerWidth < innerHeight;
        camera.position.set(Math.cos(a) * r, 2.2, Math.sin(a) * r);
        camera.lookAt(0, 0, 0); ctx.setFov(38);
        if (port) camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * 0.22, innerWidth, innerHeight);
        else camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.2, innerHeight * 0.06, innerWidth, innerHeight);
        return;
      }
      // 横向きのスマホでは右半分が解説パネルになるので、模型を左へ寄せて描く
      const side = innerWidth > innerHeight && innerHeight <= 520 && innerWidth < 900;
      // 縦向きのスマホでは下半分が解説パネルになるので、パーツを選んでいるあいだは模型を上へ寄せて描く
      const port = innerWidth < innerHeight && innerWidth < 700, v0 = vOff;
      vOff += ((port && sel ? 0.2 : 0) - vOff) * Math.min(1, dt * 5); if (Math.abs(vOff - (port && sel ? 0.2 : 0)) < 0.002) vOff = port && sel ? 0.2 : 0;
      if (side) camera.setViewOffset(innerWidth, innerHeight, innerWidth * 0.24, 0, innerWidth, innerHeight);
      else if (vOff > 0) camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * vOff, innerWidth, innerHeight);
      else if (camera.view) camera.clearViewOffset();
      if (side !== RT.side || v0 !== vOff) { RT.side = side; RT.camDirty = true; }
      if (fly) {
        fly.t = Math.min(1, fly.t + dt / 0.9); const k = ease(fly.t);
        controls.target.lerpVectors(fly.t0, fly.t1, k); camera.position.lerpVectors(fly.p0, fly.p1, k);
        if (fly.t >= 1) fly = null;
      }
      controls.update();
      if (sel) {
        // 選んだ直後は強く光らせて場所を知らせ、そのあとは弱めて、パーツ本来の色と形が見えるようにする
        if (selAt < 0) selAt = t;
        const f = Math.exp(-(t - selAt) / 0.9), pulse = (0.09 + 0.03 * Math.sin(t * 3)) * (1 - f) + (0.34 + 0.14 * Math.sin(t * 9)) * f;
        setEmissive(sel, true, pulse);
        partBox(sel).getCenter(tmp);
        tmp.project(camera);
        if (tmp.z < 1) {
          plabel.style.left = `${(tmp.x * 0.5 + 0.5) * innerWidth}px`;
          plabel.style.top = `${(-tmp.y * 0.5 + 0.5) * innerHeight - 22}px`;
          plabel.classList.add('on');
        } else plabel.classList.remove('on');
      } else plabel.classList.remove('on');
      sizeUpdate();
    },
  };
}
