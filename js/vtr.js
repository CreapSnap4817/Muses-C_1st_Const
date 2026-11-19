// VTRモード：再生エンジンと、各章が使う共通の道具
import * as THREE from 'three';
import * as ENV from './env.js';
import * as CUT from './cutaways.js';
import { buildHayabusa } from './hayabusa.js';
import { makeOrbitMap } from './orbit.js';
import chaptersA from './vtr_a.js';
import chaptersB from './vtr_b.js';
import chaptersC from './vtr_c.js';

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const c01 = x => Math.max(0, Math.min(1, x));
const sm = (a, b, x) => { const t = c01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const eio = t => { t = c01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const R = Math.random;

export function createVTR(ctx) {
  const { camera, T, ui } = ctx;
  const scene = new THREE.Scene();
  scene.environment = ctx.envSpace;
  const stars = ENV.makeStars(T); stars.setPixelRatio(ctx.renderer.getPixelRatio()); scene.add(stars);
  const sunLight = new THREE.DirectionalLight(0xfff3e2, 3.4);
  sunLight.castShadow = true; sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.bias = -0.0003; sunLight.shadow.normalBias = 0.02;
  scene.add(sunLight, sunLight.target);
  const hemi = new THREE.HemisphereLight(0x9fb4d8, 0x151515, 0.12); scene.add(hemi);
  const fill = new THREE.DirectionalLight(0x8899bb, 0.25); scene.add(fill);
  const stage = new THREE.Group(); scene.add(stage);
  const sun = ENV.makeSun(T); scene.add(sun);

  const hb = buildHayabusa(T, { detail: false });
  const hold = new THREE.Group(); hold.add(hb.root);
  const M = hb.meta;

  const fx = {
    glow: new ENV.Particles(5000, T.dot, { additive: true }),
    smoke: new ENV.Particles(1800, T.smoke, { additive: false }),
    gas: new ENV.Particles(2200, T.dot, { additive: false }),
  };
  Object.values(fx).forEach(p => scene.add(p.points));

  const cache = {};
  const get = (k, fn) => (cache[k] ??= fn());
  const ito = () => get('ito', () => ENV.makeItokawa(T));
  const earth = () => get('earth', () => ENV.makeEarth(T));
  const orbitMap = () => get('map', () => makeOrbitMap(T));

  // ---------- 共通の道具 ----------
  const S = {};                       // 章ごとの作業用。章の切り替えで空にする
  const sunDir = V(-0.5, 0.6, 0.6).normalize();
  function setSun(dir, target = V(0, 0, 0), size = 5, show = true, intensity = 3.4) {
    sunDir.copy(dir).normalize();
    sunLight.intensity = intensity;
    sunLight.target.position.copy(target);
    sunLight.position.copy(target).addScaledVector(sunDir, size * 4 + 10);
    const c = sunLight.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 0.1; c.far = size * 8 + 30; c.updateProjectionMatrix();
    sun.visible = show;
    sun.position.copy(sunDir).multiplyScalar(120000); sun.core.scale.setScalar(5200); sun.halo.scale.setScalar(26000);
    fill.position.copy(sunDir).multiplyScalar(-1).add(V(0, -0.3, 0));
  }
  function followShadow(target, size) {
    sunLight.target.position.copy(target); sunLight.position.copy(target).addScaledVector(sunDir, size * 4 + 10);
    if (size && sunLight.shadow.camera.right !== size) { const c = sunLight.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.far = size * 8 + 30; c.updateProjectionMatrix(); }
  }
  // カメラ：場面が指定した位置へ、速度をなめらかに追わせて動かす（動き出しと止まりに緩急がつく）。場面の最初のコマはそのまま置く
  const CS = { p: V(0, 0, 0), t: V(0, 0, 0), up: V(0, 1, 0), fov: 40, wp: V(0, 0, 0), wt: V(0, 0, 0), wfov: 40, vp: V(0, 0, 0), vt: V(0, 0, 0), lp: V(0, 0, 0), lt: V(0, 0, 0), n: 0, ph: R() * 100 };
  const _c1 = V(0, 0, 0), _c2 = V(0, 0, 0);
  function cam(p, t, fov = 40, up) { CS.wp.copy(p); CS.wt.copy(t); CS.wfov = fov; CS.up.copy(up || V(0, 1, 0)); CS.set = true; }
  function camCut() { CS.n = 0; }
  function applyCam(dt, tt) {
    if (!CS.set) return;
    if (CS.n === 0 || dt <= 0) { if (CS.n === 0) { CS.p.copy(CS.wp); CS.t.copy(CS.wt); CS.fov = CS.wfov; CS.vp.set(0, 0, 0); CS.vt.set(0, 0, 0); } }
    else {
      _c1.copy(CS.wp).sub(CS.lp).divideScalar(dt); _c2.copy(CS.wt).sub(CS.lt).divideScalar(dt);     // 指定された動きの速度
      if (CS.n === 1) { CS.vp.copy(_c1); CS.vt.copy(_c2); }
      else { const kv = 1 - Math.exp(-dt / 0.16); CS.vp.lerp(_c1, kv); CS.vt.lerp(_c2, kv); }
      const kp = 1 - Math.exp(-dt / 0.3);
      CS.p.addScaledVector(CS.vp, dt).lerp(CS.wp, kp); CS.t.addScaledVector(CS.vt, dt).lerp(CS.wt, kp);
      CS.fov += (CS.wfov - CS.fov) * (1 - Math.exp(-dt / 0.25));
    }
    if (dt > 0 || CS.n === 0) { CS.lp.copy(CS.wp); CS.lt.copy(CS.wt); CS.n++; }
    camera.position.copy(CS.p); camera.up.copy(CS.up); camera.lookAt(CS.t); ctx.setFov(CS.fov);
    // 手持ちのような、ごく小さなゆれ
    const a = tt * 0.37 + CS.ph, k = 0.0016;
    camera.rotateX((Math.sin(a) + 0.5 * Math.sin(a * 2.3 + 1.7)) * k); camera.rotateY((Math.sin(a * 0.8 + 2.1) + 0.5 * Math.sin(a * 1.9 + 0.4)) * k);
  }
  function place(...o) { o.forEach(x => stage.add(x)); return o[0]; }

  // 材質の一時的な変更（章が終わったら元に戻す）
  const tweaked = [];
  function tweak(mat, fn) {
    if (!mat) return;
    if (!mat.userData._o) { mat.userData._o = { c: mat.color.clone(), e: mat.emissive ? mat.emissive.clone() : null, ei: mat.emissiveIntensity }; tweaked.push(mat); }
    fn(mat);
  }
  function untweak() { for (const m of tweaked) { const o = m.userData._o; m.color.copy(o.c); if (o.e) { m.emissive.copy(o.e); m.emissiveIntensity = o.ei; } m.userData._o = null; } tweaked.length = 0; }
  // 機体から部品を切り離す（章が終わったら元の場所へ戻す）
  const hidMesh = true;
  const detached = new Set();
  function detach(name) { const o = hb.named[name]; o.visible = true; hold.updateMatrixWorld(true); if (!o.userData.home) o.userData.home = o.parent; stage.attach(o); detached.add(o); return o; }
  // 切り離した物は、それより後の場面では機体から消す。[部品の名前, 章(0始まり), その章で消え始める行]
  //   11月9日 練習降下でターゲットマーカを試しに1個／11月12日 ミネルバとカバー／11月20日 名前入りのターゲットマーカ／2010年6月13日 カプセル
  const GONE = [['tm2', 6, 4], ['minervaLid', 7, 2], ['rover', 8, 0], ['tm0', 8, 1], ['capsule', 15, 2]];
  function applyMission() {
    const l = chap && shotI >= 0 ? chap.shots[shotI].at : 0;
    for (const [n, c, ln] of GONE) { const o = hb.named[n]; if (o) o.visible = !(ci > c || (ci === c && l >= ln)); }
  }
  function reattach() { for (const o of detached) o.userData.home.add(o); detached.clear(); }
  function resetHB() {
    reattach(); hb.reset(); untweak(); applyMission();
    if (hidMesh) { for (const id in hb.parts) for (const m of hb.parts[id].meshes) m.visible = true; }
    hb.root.position.set(0, 0, 0); hb.root.quaternion.identity();
    for (let i = hb.root.children.length - 1; i >= 0; i--) if (hb.root.children[i].userData.temp) hb.root.remove(hb.root.children[i]);
    hold.position.set(0, 0, 0); hold.quaternion.identity(); hold.scale.setScalar(1); hold.visible = true;
  }
  function useHB(q) { resetHB(); place(hold); if (q) hold.quaternion.copy(q); hold.updateMatrixWorld(true); return hold; }
  // 機体の向き：xd=イオンエンジンの噴射面が向く方向、zd=高利得アンテナが向く方向
  function basisQ(xd, zd) {
    const z = zd.clone().normalize(); const x = xd.clone().addScaledVector(z, -xd.dot(z)).normalize(); const y = z.clone().cross(x);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }
  const UPQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-PI / 2, 0, 0));      // アンテナが上、ホーンが下
  const upYaw = (a) => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a).multiply(UPQ);
  const L3 = (a) => Array.isArray(a) ? V(a[0], a[1], a[2]) : a.clone();
  const wpos = (local) => { hb.root.updateWorldMatrix(true, false); return hb.root.localToWorld(L3(local)); };
  const wdir = (local) => { hb.root.updateWorldMatrix(true, false); return L3(local).transformDirection(hb.root.matrixWorld); };
  const lab = (text, cls, local, dy = 0) => ui.label(text, cls, () => { const p = wpos(local); p.y += dy; return p; });

  function emitIons(dt, rate = 46) {
    const dir = wdir([1, 0, 0]), uy = wdir([0, 1, 0]), uz = wdir([0, 0, 1]);
    hb.thrusters.forEach(th => {
      if (th.intensity < 0.05) return;
      const p0 = wpos(th.exit);
      const n = Math.floor(rate * dt * th.intensity + R());
      for (let i = 0; i < n; i++) fx.glow.emit(p => {
        // グリッドの面から出て、ビームと同じ角度で少しずつ広がる細かい光の粒
        const a = R() * PI * 2, rr = Math.sqrt(R()) * 0.046, oy = Math.cos(a) * rr, oz = Math.sin(a) * rr, sp = 7 + R() * 4;
        const v = dir.clone().multiplyScalar(sp).addScaledVector(uy, oy * 4 * sp / 1).addScaledVector(uz, oz * 4 * sp / 1);
        p.pos = [p0.x + uy.x * oy + uz.x * oz, p0.y + uy.y * oy + uz.y * oz, p0.z + uy.z * oy + uz.z * oz]; p.vel = [v.x, v.y, v.z];
        p.col = [0.5, 0.78, 1.25]; p.alpha = 0.42; p.size = 0.005 + R() * 0.006; p.life = 0.16 + R() * 0.14;
      });
    });
  }
  // ガスの噴き出し（ワールド座標）
  function puff(p0, dir, n, o = {}) {
    const { speed = 1.6, spread = 0.5, col = [0.88, 0.9, 0.94], alpha = 0.5, size = 0.035, grow = 0.1, life = 1.6, sys = fx.gas } = o;
    const cnt = Math.floor(n + R());
    for (let i = 0; i < cnt; i++) sys.emit(p => {
      const v = dir.clone().multiplyScalar(speed * (0.6 + R() * 0.8)).add(V(R() - .5, R() - .5, R() - .5).multiplyScalar(spread * speed));
      p.pos = [p0.x, p0.y, p0.z]; p.vel = [v.x, v.y, v.z]; p.col = col; p.alpha = alpha * (0.6 + R() * 0.4); p.size = size * (0.7 + R() * 0.6); p.grow = grow; p.life = life * (0.7 + R() * 0.6);
    });
  }
  // 化学エンジン i 番を噴く
  function rcsFire(i, dt, k = 1) {
    const r = M.rcs[i]; const p0 = wpos(r.pos), d = wdir(r.dir);
    puff(p0, d, 140 * dt * k, { speed: 3.2, spread: 0.16, col: [1.6, 1.3, 0.9], alpha: 0.5, size: 0.03, grow: 0.25, life: 0.35, sys: fx.glow });
    puff(p0, d, 40 * dt * k, { speed: 2.2, spread: 0.25, alpha: 0.22, size: 0.05, grow: 0.3, life: 0.8 });
  }
  // 中和器からキセノンガスをそのまま噴く
  function xenonJet(i, dt, k = 1) {
    const th = hb.thrusters[i]; const p0 = wpos(th.neut), d = wdir(th.neutDir);
    puff(p0, d, 90 * dt * k, { speed: 1.5, spread: 0.2, col: [0.75, 0.86, 1.0], alpha: 0.4, size: 0.02, grow: 0.09, life: 1.5 });
  }
  function dust(center, n, speed = 1.0, up = V(0, 1, 0)) {
    for (let i = 0; i < n; i++) fx.smoke.emit(p => {
      const a = R() * PI * 2; const h = R() * 0.7;
      const v = V(Math.cos(a), 0, Math.sin(a)).multiplyScalar(speed * (0.3 + R())).addScaledVector(up, speed * h);
      p.pos = [center.x + (R() - .5) * 0.16, center.y + R() * 0.05, center.z + (R() - .5) * 0.16]; p.vel = [v.x, v.y, v.z];
      const L = 0.3 + R() * 0.12; p.col = [L, L * 0.93, L * 0.82]; p.alpha = 0.55; p.size = 0.025 + R() * 0.06; p.grow = 0.025; p.life = 3 + R() * 3;
    });
  }
  function beam(color = 0xff4030, r = 0.012, opacity = 0.6) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.userData.noPick = true; m.renderOrder = 7; return m;
  }
  function setBeam(m, a, b) { const d = b.clone().sub(a); const len = d.length(); m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(1, Math.max(1e-4, len), 1); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); }
  // ファンビームセンサの扇形の光（機体に付く）
  function fbsFans() {
    return M.fbs.map(f => {
      const pts = [0, 0, 0]; const n = 14, half = 0.62, len = 3.1;
      for (let i = 0; i <= n; i++) { const a = -half + 2 * half * i / n; pts.push(Math.sin(a) * len, Math.cos(a) * len, 0); }
      const idx = []; for (let i = 1; i <= n; i++) idx.push(0, i, i + 1);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.5, 0.15), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.position.set(f.pos[0], f.pos[1], f.pos[2] - 0.12); if (f.s < 0) m.rotation.z = PI; m.userData.temp = true; m.userData.noPick = true; m.renderOrder = 7;
      hb.root.add(m); return m;
    });
  }
  // 電波を表す輪
  const rings = [];
  function ring(pos, dir, color = 0x8fd0ff, speed = 2.5, life = 2.2, size = 0.15) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(pos); m.quaternion.setFromUnitVectors(V(0, 0, 1), dir.clone().normalize()); m.userData = { age: 0, life, speed, dir: dir.clone().normalize(), size }; m.scale.setScalar(size);
    stage.add(m); rings.push(m); return m;
  }
  function updateRings(dt) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const m = rings[i], u = m.userData; u.age += dt;
      if (u.age > u.life || !m.parent) { m.parent && m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); rings.splice(i, 1); continue; }
      m.position.addScaledVector(u.dir, u.speed * dt); m.scale.setScalar(u.size + u.age * u.speed * 0.55); m.material.opacity = 0.7 * (1 - u.age / u.life);
    }
  }
  function chip(k, v) { ui.chip(k, v); }
  // ---------- 軌道図の場面 ----------
  // 天体の名前を出し、年月・太陽からの距離・地球からの距離・進んだ道のりを表示する
  function mapScene(link = true) {
    const map = orbitMap(); place(map); map.position.set(0, 0, 0); setSun(V(0, 1, 0), V(0, 0, 0), 5, false); map.setLink(link);
    const wp = (o) => () => o.getWorldPosition(V(0, 0, 0));
    ui.label('太陽', 'flat', () => V(0, -9, 0)); ui.label('地球', '', wp(map.parts.earth)); ui.label('イトカワ', '', wp(map.parts.ito)); ui.label('火星', 'flat', wp(map.parts.mars));
    if (link) ui.label('はやぶさ', 'ok', wp(map.parts.hb));
    S.evLab = ui.label('', 'flat', () => S.evP || V(0, 0, 0)); S.evI = -2;
    return map;
  }
  // 軌道図を見下ろすカメラ。a は回りこむ角度、k は遠さ
  function mapCam(a, k = 1) { k *= 0.8; cam(V(Math.cos(a) * 330 * k, 550 * k, Math.sin(a) * 330 * k), V(Math.cos(a) * 50 * k, 0, Math.sin(a) * 50 * k), 45); }
  function mapHud(map, t, win = 150) {
    map.setTime(t); const i = map.info(t), [y, m] = map.dateOf(t);
    chip('年月', `${y}<small>年</small>${m}<small>月</small>`);
    ui.card('orb', `<div class="panel orb"><div class="stats"><div><b>${(i.r * 1.496).toFixed(2)}<small>億km</small></b><span>太陽から</span></div><div><b>${(i.de / 1e8).toFixed(2)}<small>億km</small></b><span>地球から</span></div><div><b>${(i.path / 1e8).toFixed(1)}<small>億km</small></b><span>進んだ道のり</span></div></div><p class="fine">軌道は公表値から計算で再現。天体は大きく描いてある。</p></div>`, 'top');
    // いちばん新しいできごとの名前を、その場所に出す
    let k = -1; for (let j = 0; j < map.EVENTS.length; j++) if (map.EVENTS[j].jd <= t && t - map.EVENTS[j].jd < win) k = j;
    if (k !== S.evI) { S.evI = k; const e = map.EVENTS[k]; S.evP = e ? map.localToWorld(e.pos.clone()) : null; S.evLab.set(e ? `${e.y}.${e.m}.${e.d}　${e.name}` : '', 'flat'); }
    return i;
  }
  // ---------- JAXAが公開している写真。加工せず、そのまま表示する ----------
  const JAXA = {
    minerva: ['minerva_paddle.jpg', 'ミネルバが撮影した、はやぶさの太陽電池パドルの写真。斜めに写った黒いパネルに、電池の並びが白い線で見える。', 'ミネルバが撮ったパドル　2005.11.12'],
    earth: ['earth_last.jpg', 'はやぶさが最後に撮影した地球の白黒写真。左上に地球が写り、縦に光の筋が入っている。下の4分の1は、通信が切れたため灰色のまま欠けている。', '最後に撮った地球　2010.6.13'],
  };
  // 写真のファイルを置いていない版（公開用）では、写真のかわりに説明の文を出す
  function jaxaPhoto(key) { const [f, alt, cap] = JAXA[key], url = new URL('../assets/jaxa/' + f, import.meta.url).href, im = new Image(), at = [ci, shotI];
    const live = () => at[0] === ci && at[1] === shotI;                      // 読みこみが終わる前に場面が変わっていたら出さない
    im.onload = () => { if (live()) ui.card('photo', `<div class="photo"><img src="${url}" alt="${alt}"><span class="cap">${cap}</span><span class="cr">出典：JAXA　©JAXA</span></div>`, 'top'); };
    im.onerror = () => { if (live()) ui.card('photo', `<div class="panel"><p><b>${cap}</b></p><p>${alt}</p><p class="fine">この写真はJAXAが公開している。このページには載せていない。</p></div>`, 'top'); };
    im.src = url; }
  // 上のアンテナを外して上面の機器を見せる／バッテリーのふたを外して電池を見せる（章が終わると元に戻る）
  function hideTop() { for (const id of ['hga', 'lga']) hb.parts[id].groups.forEach(o => { o.visible = false; }); }
  function openBattery() { hb.parts.battery.meshes.forEach(m => { if (m.material === hb.mats.alu) m.visible = false; }); }
  const glowSprite = (color, size) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.setScalar(size); return s; };

  // ---------- イトカワの着陸地点（ミューゼスの海）の場面 ----------
  const _v = V(0, 0, 0);
  function groundY(x, z) { const it = cache.ito, pt = it.patch; _v.set(x, 0, z); it.worldToLocal(_v); _v.sub(pt.c0); return pt.height(_v.dot(pt.t1), _v.dot(pt.t2)); }
  // 太陽はほぼ真上（2回目の着地のとき、アンテナの軸と太陽の角度は約7度だった）
  function tdScene({ yaw = 0.5, sunV = V(0.24, 0.95, 0.17), size = 12 } = {}) {
    const it = ito(); place(it); it.rotation.set(0, 0, 0); it.placeSiteUp(0); it.makePatch(); it.detail.value = 1;
    setSun(sunV, V(0, 0, 0), size);
    hemi.intensity = 1.5; hemi.color.setHex(0x06080c); hemi.groundColor.setHex(0x8f7d66); fill.intensity = 0.5;
    ctx.setBloom(0.28, 0.45, 1.3);
    useHB(upYaw(yaw));
    // イトカワの本体から離れる水平方向（広い画で地形に隠れないカメラ位置を決めるため）
    const w = V(0, 0, 1).applyQuaternion(it.quaternion); w.y = 0; w.normalize(); tdAz = Math.atan2(w.x, w.z);
    return it;
  }
  let tdAz = 0;
  // 地面と機体の両方が入る広い画。h は高度、off は方位のずらし
  function wideCam(h, off = 0.35, fov = 46, lift = 0.55) {
    const d = 8 + 1.5 * h, az = tdAz + off; const p = V(Math.sin(az) * d, h * lift + 1.6, Math.cos(az) * d);
    p.y = Math.max(p.y, groundY(p.x, p.z) + 0.8);
    const t = V(0, h * 0.38, 0);
    if (innerWidth / innerHeight > 1.4) t.addScaledVector(V(Math.cos(az), 0, -Math.sin(az)), d * 0.1);     // 横長の画面では右上のカードを避けて、被写体を左へ寄せる
    cam(p, t, fov);
  }
  // 機体の高さ：ホーンの先が地面に触れる高さを0とする
  const HORN_TIP = -M.horn.tip;
  function setAlt(h, x = 0, z = 0) { hold.position.set(x, 0, z); hold.updateMatrixWorld(true); const tip = wpos([M.horn.x, 0, M.horn.tip]); hold.position.y = groundY(tip.x, tip.z) - tip.y + h; hold.updateMatrixWorld(true); return hold.position.y; }
  function downBeams(list, beams, on = true) {
    list.forEach((b, i) => {
      const p0 = wpos(b.pos), d = wdir(b.dir || [0, 0, -1]); const gy = groundY(p0.x, p0.z);
      const t = (p0.y - gy) / Math.max(1e-3, -d.y); const p1 = p0.clone().addScaledVector(d, t); p1.y = groundY(p1.x, p1.z);
      setBeam(beams[i], p0, p1); beams[i].visible = on; b._end = p1;
    });
  }

  const K = { THREE, ENV, CUT, PI, V, c01, sm, lerp, eio, R, ctx, ui, T, camera, scene, stage, hb, M, hold, fx, S, cache, get, ito, earth, orbitMap,
    sunDir, sunLight, hemi, fill, stars, sun, setSun, followShadow, cam, place, tweak, detach, useHB, basisQ, UPQ, upYaw, wpos, wdir, lab,
    emitIons, puff, rcsFire, xenonJet, dust, beam, setBeam, fbsFans, ring, chip, glowSprite, groundY, tdScene, setAlt, downBeams, wideCam, hideTop, openBattery, HORN_TIP, camCut, mapScene, mapHud, mapCam, jaxaPhoto };

  const CH = [...chaptersA(K), ...chaptersB(K), ...chaptersC(K)];
  // 機体の状態（HUDに出す）。[何行目から, 状態] を章ごとに並べる。o:正常 n:動作中 w:注意 x:故障 c:クロス運転 -:停止
  const st = (ies, rw, rcs, bat, com) => ({ ies, rw, rcs, bat, com });
  const STATUS = [
    [[0, st('oooo', 'ooo', 'o', 'o', 'o')]], [[0, st('oooo', 'ooo', 'o', 'o', 'n')]],
    [[0, st('wnnn', 'ooo', 'o', 'o', 'n')]], [[0, st('wnnn', 'ooo', 'o', 'o', 'n')]],
    [[0, st('wooo', 'ooo', 'o', 'o', 'n')]], [[0, st('wooo', 'ooo', 'o', 'o', 'n')], [2, st('wooo', 'xxo', 'n', 'o', 'n')]],
    [[0, st('wooo', 'xxo', 'n', 'o', 'n')]], [[0, st('wooo', 'xxo', 'n', 'o', 'n')]], [[0, st('wooo', 'xxo', 'n', 'o', 'n')]],
    [[0, st('wooo', 'xxo', 'n', 'o', 'n')]], [[0, st('wooo', 'xxo', 'n', 'o', 'n')]],
    [[0, st('wooo', 'xxo', 'w', 'o', 'n')], [2, st('wooo', 'xxo', 'w', 'x', 'w')], [3, st('wooo', 'xxo', 'x', 'x', 'w')], [5, st('wooo', 'xxo', 'x', 'x', 'x')]],
    [[0, st('wooo', 'xxo', 'x', 'x', 'x')], [2, st('wooo', 'xxo', 'x', 'x', 'w')]],
    [[0, st('wooo', 'xxo', 'x', 'w', 'o')]],
    [[0, st('wwox', 'xxo', 'x', 'w', 'o')], [3, st('ccox', 'xxo', 'x', 'w', 'o')]],
    [[0, st('ccox', 'xxo', 'x', 'w', 'o')]],
    [[0, null]], [[0, null]],
  ];
  const statusFor = (c, l) => { const a = STATUS[c] || [[0, null]]; let r = a[0][1]; for (const [k, v] of a) if (l >= k) r = v; return r; };

  // ---------- 再生エンジン ----------
  let ci = 0, chap = null, t = 0, line = -1, lineStart = 0, shotI = -1, shotStart = 0, playing = false;
  let started = false, startCheck = 0, gapT = 0, endT = 0;
  let ttsOn = true, speaking = false, curUtt = null, voice = null, speakDeadline = 0, ending = false, transitioning = false;
  function pickVoice() {
    if (!window.speechSynthesis) return;
    const vs = speechSynthesis.getVoices().filter(v => /^ja/i.test(v.lang));
    const pref = ['Kyoko', 'O-Ren', 'Nanami', 'Haruka', 'Google 日本語', 'Otoya', 'Hattori'];
    voice = vs.find(v => pref.some(p => v.name.includes(p))) || vs[0] || null;
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text) {
    speaking = false;
    if (!ttsOn || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = 'ja-JP'; if (voice) u.voice = voice; u.rate = 1.06; u.pitch = 1.0;
      u.onend = u.onerror = () => { if (curUtt === u) speaking = false; };
      u.onstart = () => { if (curUtt === u) started = true; };
      curUtt = u; speaking = true; started = false; speakDeadline = t + text.length * 0.3 + 4; startCheck = t + 2.5;
      speechSynthesis.speak(u);
    } catch (e) { speaking = false; }
  }
  const minDur = (l) => 1.6 + l.t.length * 0.135;

  function clearStage() {
    stage.clear(); fx.glow.clear(); fx.smoke.clear(); fx.gas.clear(); rings.length = 0;
    if (cache.earth) cache.earth.children.filter(c => c.userData.temp).forEach(c => cache.earth.remove(c));
    if (cache.chute) cache.chute.removeFromParent();
    ui.clearLabels(); ui.overlay('finder', null); ui.noise(0);
    sunLight.color.setHex(0xfff3e2); hemi.intensity = 0.12; hemi.color.setHex(0x9fb4d8); hemi.groundColor.setHex(0x151515); fill.intensity = 0.25;
    stars.setOpacity(1); scene.environment = ctx.envSpace; fx.smoke.drag = 0.15; fx.gas.drag = 0; fx.smoke.gravity.set(0, 0, 0); fx.gas.gravity.set(0, 0, 0);
    ctx.setBloom(); ctx.setExposure(1.0);
  }
  function startShot(i) {
    shotI = i; shotStart = t; camCut();
    clearStage(); if (i > 0) ui.clearCards();
    chap.shots[i].setup();
  }
  function enter(i) {
    ci = i; chap = CH[i]; for (const k in S) delete S[k]; t = 0; line = -1; shotI = -1; ending = false; gapT = 0; endT = 0;
    ui.clearCards(); ui.hideChip();
    ui.telop(i + 1, chap.date, chap.title);
    ui.progress(i, CH.length, CH.map(c => c.title));
    ui.status(statusFor(i, 0));
    ui.caption('');
    startShot(0);
  }
  function nextLine() {
    line++;
    lineStart = t;
    const l = chap.lines[line];
    ui.status(statusFor(ci, line));
    ui.caption(l.t, !ttsOn);
    speak(l.s || l.t);
    const si = chap.shots.findIndex(s => s.at === line);
    if (si > 0 && si !== shotI) { ui.cut(); startShot(si); }
  }
  function go(i) {
    if (i < 0) i = 0;
    if (i >= CH.length) { finish(); return; }
    transitioning = true;
    ui.fade(true);
    if (window.speechSynthesis) speechSynthesis.cancel(); speaking = false;
    setTimeout(() => { enter(i); ui.fade(false); transitioning = false; }, 450);
  }
  function finish() {
    playing = false; ending = true; ui.caption(''); ui.endcard(true);
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  return {
    scene, chapters: CH,
    start(i = 0) { ui.endcard(false); playing = true; ui.playing(true); enter(i); },
    stop() { playing = false; if (window.speechSynthesis) speechSynthesis.cancel(); clearStage(); ui.clearCards(); ui.hideChip(); },
    toggle() {
      if (ending) return;
      playing = !playing; ui.playing(playing);
      if (!playing) { if (window.speechSynthesis) speechSynthesis.cancel(); speaking = false; }
      else if (line >= 0) { lineStart = t; speak(chap.lines[line].s || chap.lines[line].t); }
    },
    next() { if (!transitioning) go(ci + 1); },
    prev() { if (!transitioning) go(t > 4 || ci === 0 ? ci : ci - 1); },
    goto(i) { if (!transitioning) { ui.endcard(false); playing = true; ui.playing(true); go(i); } },
    setTTS(on) { ttsOn = on; if (!on && window.speechSynthesis) { speechSynthesis.cancel(); speaking = false; } if (on && line >= 0 && playing) speak(chap.lines[line].s || chap.lines[line].t); ui.ttsState(on); },
    get tts() { return ttsOn; },
    get state() { return { ci, line, shotI, t, playing, ending }; },
    // 検品用：章 i の、せりふ li の場面を、場面が始まって st 秒後の状態で出す
    debugSeek(i, li, st = 0) {
      ui.endcard(false); playing = true; enter(i);
      let si = 0; chap.shots.forEach((s, k) => { if (s.at <= li) si = k; });
      t = 1.3 + li * 3; startShot(si); shotStart = t; line = li - 1; nextLine(); lineStart = t;
      const sh = chap.shots[si]; const n = Math.ceil(st / 0.05);
      for (let k = 0; k < n; k++) { t += 0.05; sh.update({ t, dt: 0.05, st: t - shotStart, line, lt: t - lineStart }); applyCam(0.05, t); hb.tick(t, 0.05); for (const f in fx) fx[f].update(0.05, camera, ctx.renderer); updateRings(0.05); }
      camCut(); applyCam(0, t);
      playing = false; ui.telopOff();
    },
    update(dt) {
      if (!chap) return;
      const pdt = playing && !transitioning ? dt : 0;
      t += pdt;
      if (playing && !transitioning) {
        if (line === -1 && t > 1.3) nextLine();
        else if (line >= 0) {
          const lt = t - lineStart; const l = chap.lines[line];
          if (speaking && (t > speakDeadline || (!started && t > startCheck))) speaking = false;
          const done = ttsOn ? (!speaking && lt > Math.max(1.2, minDur(l) * 0.55)) : lt > minDur(l);
          if (done) {
            if (line < chap.lines.length - 1) { if (!gapT) gapT = t; if (t - gapT > 0.35) { gapT = 0; nextLine(); } }
            else { if (!endT) endT = t; ui.caption(''); if (t - endT > 1.4) { endT = 0; go(ci + 1); } }
          }
        }
        if (t > 4.6) ui.telopOff();
        if (line >= 0) ui.progressFill(ci, (line + c01((t - lineStart) / minDur(chap.lines[line]))) / chap.lines.length);
      }
      const sh = chap.shots[shotI];
      if (sh) sh.update({ t, dt: pdt, st: t - shotStart, line: Math.max(0, line), lt: line >= 0 ? t - lineStart : 0 });
      applyCam(pdt, t);
      hb.tick(t, pdt);
      updateRings(pdt);
      stars.position.copy(camera.position);
      for (const k in fx) fx[k].update(pdt, camera, ctx.renderer);
      if (cache.earth && cache.earth.parent) cache.earth.updateSun(sunDir, camera);
    },
  };
}
