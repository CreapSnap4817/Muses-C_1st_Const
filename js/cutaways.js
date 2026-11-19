// しくみを見せるための断面モデル：イオンエンジン、サンプラー、再突入カプセル
import * as THREE from 'three';

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (p) => new THREE.MeshStandardMaterial(p);

// 回転体を角度 arc だけ作り、切り口に断面のふたを付ける。pts=[[r,y],...]（閉じた輪郭）
function cutLathe(pts, mat, { arc = PI, phi0 = 0, seg = 40, capMat } = {}) {
  const g = new THREE.Group(), P = [];
  pts.forEach((p, i) => { P.push(new THREE.Vector2(Math.max(1e-4, p[0]), p[1])); if (i > 0 && i < pts.length - 1) P.push(new THREE.Vector2(Math.max(1e-4, p[0]), p[1])); });
  P.push(P[0].clone());
  const m = new THREE.Mesh(new THREE.LatheGeometry(P, seg, phi0, arc), mat); m.castShadow = m.receiveShadow = true; g.add(m);
  if (arc < PI * 2 - 1e-3) {
    const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(Math.max(0, p[0]), p[1])));
    const cm = capMat || mat.clone(); cm.side = THREE.DoubleSide;
    for (const a of [phi0, phi0 + arc]) { const c = new THREE.Mesh(new THREE.ShapeGeometry(sh), cm); c.rotation.y = a - PI / 2; c.receiveShadow = true; g.add(c); }
  }
  return g;
}
function glowMat(color, opacity = 0.5) { return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }); }
let DOT = null;
function dots(n, color, size, additive = true) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setDrawRange(0, 0);
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: size * 1.9, map: DOT, sizeAttenuation: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  p.frustumCulled = false; p.userData = { pos, n: 0, max: n };
  return p;
}

// ================= イオンエンジン μ10 の断面（軸は+X、実寸） =================
export function makeIonCutaway(T) {
  DOT = T.dot;
  const g = new THREE.Group(), body = new THREE.Group(); body.rotation.z = -PI / 2; g.add(body);   // 回転体のY軸を+Xへ
  const alu = std({ color: 0xb9bec6, metalness: 1, roughness: 0.4 }), dark = std({ color: 0x4a4e55, metalness: 0.9, roughness: 0.5 });
  const o = { arc: PI * 1.1, phi0: PI * 0.45 };
  // 放電室と導波管
  body.add(cutLathe([[0.052, -0.105], [0.07, -0.105], [0.07, 0], [0.0665, 0], [0.0665, -0.1], [0.052, -0.1]], alu, o));
  body.add(cutLathe([[0.018, -0.16], [0.052, -0.16], [0.052, -0.1], [0.0485, -0.1], [0.0485, -0.156], [0.018, -0.156]], alu, o));
  body.add(cutLathe([[0.0, -0.2], [0.021, -0.2], [0.021, -0.156], [0.018, -0.156], [0.018, -0.197], [0.0, -0.197]], dark, o));
  // 磁石の輪（サマリウムコバルト）
  const magN = std({ color: 0xb23a32, metalness: 0.4, roughness: 0.5 }), magS = std({ color: 0x2f5fae, metalness: 0.4, roughness: 0.5 });
  body.add(cutLathe([[0.054, -0.082], [0.0665, -0.082], [0.0665, -0.066], [0.054, -0.066]], magN, o));
  body.add(cutLathe([[0.054, -0.03], [0.0665, -0.03], [0.0665, -0.014], [0.054, -0.014]], magS, o));
  // マイクロ波アンテナ
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.07, 8), std({ color: 0xd8b24a, metalness: 1, roughness: 0.3 })); ant.position.y = -0.165; body.add(ant);
  // 3枚のグリッド（間隔は見やすいよう広げてある）
  const grids = [];
  [[0.004, 0xd86a5a], [0.014, 0x5a8ad8], [0.024, 0x9aa0a8]].forEach(([y, c]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.069, 0.069, 0.0022, 48, 1, false, o.phi0, o.arc), std({ color: 0x18181a, metalness: 0.3, roughness: 0.6, emissive: c, emissiveIntensity: 0.25, side: THREE.DoubleSide }));
    m.position.y = y; body.add(m); grids.push(m);
  });
  // プラズマ
  const plasma = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), glowMat(new THREE.Color(0.35, 0.55, 1.0), 0.0)); plasma.scale.set(0.05, 0.045, 0.05); plasma.position.y = -0.048; body.add(plasma);
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), glowMat(new THREE.Color(0.8, 0.9, 1.0), 0.0)); core.scale.set(0.03, 0.022, 0.03); core.position.y = -0.048; body.add(core);
  // 中和器（45度内向き）
  const neut = new THREE.Group(); neut.position.set(0.02, -0.125, 0); neut.rotation.z = -PI / 4; g.add(neut);
  const nb = new THREE.Group(); nb.rotation.z = -PI / 2; neut.add(nb);
  nb.add(cutLathe([[0.0, 0], [0.017, 0], [0.017, 0.064], [0.004, 0.064], [0.004, 0.06], [0.0135, 0.06], [0.0135, 0.004], [0.0, 0.004]], dark, o));
  const nPlasma = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), glowMat(new THREE.Color(1.0, 0.8, 0.45), 0.0)); nPlasma.scale.set(0.011, 0.022, 0.011); nPlasma.position.y = 0.032; nb.add(nPlasma);
  // 粒子：キセノン原子、イオン、電子、マイクロ波
  const xe = dots(60, 0xb8bcc4, 0.006, false), ion = dots(260, new THREE.Color(0.45, 0.7, 1.4), 0.006), el = dots(120, new THREE.Color(1.5, 1.2, 0.5), 0.004), mw = dots(48, new THREE.Color(1.4, 1.1, 0.5), 0.005);
  g.add(xe, ion, el, mw);
  const R = Math.random, st = { ions: [], els: [], xes: [] };
  const neutTip = V(0.02 + 0.066 * Math.SQRT1_2, -0.125 + 0.066 * Math.SQRT1_2, 0);
  g.anchors = { plasma: V(-0.048, 0, 0), magnet: V(-0.074, 0.07, 0), wave: V(-0.175, 0.03, 0), grid: V(0.014, 0.074, 0), beam: V(0.16, 0.0, 0), neut: V(0.035, -0.13, 0), neutTip, xe: V(-0.11, -0.03, 0) };
  g.grids = grids;
  // power: イオン源の強さ、neutK: 中和器の働き（0で電子が出ない）、accel: 加速（グリッドに電圧がかかっているか）
  // pull: 中和器がないときの様子（出ていったイオンが機体の電気に引き戻される）
  g.update = (dt, t, { power = 1, neutK = 1, accel = 1, pull = 0 } = {}) => {
    plasma.material.opacity = 0.42 * power * (0.9 + 0.1 * Math.sin(t * 17)); core.material.opacity = 0.5 * power;
    nPlasma.material.opacity = 0.6 * neutK;
    // マイクロ波（導波管の中を進む波）
    const mp = mw.userData.pos; for (let i = 0; i < 48; i++) { const x = -0.2 + (i / 48) * 0.12; mp[i * 3] = x; mp[i * 3 + 1] = Math.sin(x * 190 - t * 14) * 0.011; mp[i * 3 + 2] = 0.0; }
    mw.geometry.setDrawRange(0, power > 0.02 ? 48 : 0); mw.geometry.attributes.position.needsUpdate = true;
    // キセノン原子（放電室に入ってくる）
    if (st.xes.length < 50 && R() < 0.5) st.xes.push({ p: V(-0.1, (R() - .5) * 0.08, (R() - .5) * 0.05 - 0.02), v: V(0.03 + R() * 0.03, (R() - .5) * 0.02, (R() - .5) * 0.02) });
    st.xes = st.xes.filter(a => { a.p.addScaledVector(a.v, dt); return a.p.x < -0.012; });
    // イオン：プラズマからグリッドを抜けて加速する
    const rate = 160 * power * accel;
    for (let k = 0; k < Math.floor(rate * dt + R()); k++) if (st.ions.length < 250) { const a = R() * PI * 2, r = Math.sqrt(R()) * 0.05; st.ions.push({ p: V(-0.004, Math.cos(a) * r, Math.sin(a) * r * 0.6 - 0.012), v: 0.05 }); }
    st.ions = st.ions.filter(a => { a.v = a.p.x < 0.026 ? a.v + dt * 3.2 : a.v - pull * dt * 0.9; a.p.x += a.v * dt; return a.p.x < 0.42 && !(a.v < 0 && a.p.x < 0.03); });
    // 電子：中和器から出てビームに混ざる
    for (let k = 0; k < Math.floor(70 * neutK * dt + R()); k++) if (st.els.length < 110) st.els.push({ p: neutTip.clone(), v: V(0.12 + R() * 0.08, 0.14 + R() * 0.1, (R() - .5) * 0.06), t: 0 });
    st.els = st.els.filter(a => { a.t += dt; a.v.y += (-a.p.y) * 9 * dt - a.v.y * 2.2 * dt; a.v.x += 0.5 * dt * power; a.p.addScaledVector(a.v, dt); return a.p.x < 0.42 && a.t < 3; });
    for (const [obj, list] of [[xe, st.xes], [ion, st.ions], [el, st.els]]) {
      const pp = obj.userData.pos; list.forEach((a, i) => { pp[i * 3] = a.p.x; pp[i * 3 + 1] = a.p.y; pp[i * 3 + 2] = a.p.z; });
      obj.geometry.setDrawRange(0, list.length); obj.geometry.attributes.position.needsUpdate = true;
    }
  };
  return g;
}

// ================= サンプラーの断面（実寸、上がY。地面はY=0） =================
export function makeSamplerCutaway(T) {
  DOT = T.dot;
  const g = new THREE.Group();
  const alu = std({ color: 0xb9bec6, metalness: 1, roughness: 0.42 }), fab = std({ color: 0xc09a52, roughness: 0.85, map: T.fabricC, normalMap: T.fabricN });
  const steel = std({ color: 0x8d9096, metalness: 1, roughness: 0.35 }), goldM = std({ color: 0xd8b24a, metalness: 1, roughness: 0.3 });
  const o = { arc: PI * 1.12, phi0: PI * 0.44, seg: 48 };
  const horn = new THREE.Group(); g.add(horn);       // 着地で上下する部分
  horn.add(cutLathe([[0.0975, 0.0], [0.1, 0.0], [0.1, 0.19], [0.0975, 0.19]], alu, o));
  horn.add(cutLathe([[0.1005, 0.135], [0.205, 0.105], [0.205, 0.101], [0.1005, 0.131]], std({ color: 0xdedcd5, roughness: 0.6 }), o));
  const bp = []; for (let i = 0; i <= 36; i++) bp.push([0.0985 + 0.0055 * Math.cos(i / 4 * PI * 2), 0.19 + i / 36 * 0.55]);
  for (let i = 36; i >= 0; i--) bp.push([0.0955 + 0.0055 * Math.cos(i / 4 * PI * 2), 0.19 + i / 36 * 0.55]);
  const bell = cutLathe(bp, fab, o); horn.add(bell);
  horn.add(cutLathe([[0.097, 0.74], [0.1, 0.74], [0.088, 0.98], [0.085, 0.98]], alu, o));
  // 本体の下面パネルと、その中の円錐・細い管
  g.add(cutLathe([[0.088, 0.98], [0.3, 0.98], [0.3, 1.0], [0.088, 1.0]], std({ color: 0xd9a548, metalness: 1, roughness: 0.4 }), o));
  g.add(cutLathe([[0.0835, 1.0], [0.086, 1.0], [0.0125, 1.3], [0.0095, 1.3]], alu, o));
  g.add(cutLathe([[0.0075, 1.3], [0.0105, 1.3], [0.0105, 1.4], [0.0075, 1.4]], steel, o));
  // キャッチャ（2室と回転ドア）
  const catcher = new THREE.Group(); catcher.position.y = 1.4; g.add(catcher);
  catcher.add(cutLathe([[0.008, 0], [0.026, 0], [0.026, 0.06], [0.0, 0.06], [0.0, 0.057], [0.0235, 0.057], [0.0235, 0.003], [0.008, 0.003]], goldM, o));
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.047, 0.054, 0.0015), steel); wall.position.y = 0.03; wall.rotation.y = PI / 2; catcher.add(wall);
  const door = new THREE.Mesh(new THREE.CylinderGeometry(0.0225, 0.0225, 0.003, 24, 1, false, 0, PI * 1.33), std({ color: 0x6f7379, metalness: 1, roughness: 0.4, side: THREE.DoubleSide })); door.position.y = 0.006; catcher.add(door);
  // プロジェクタ（発射装置）と弾
  const proj = new THREE.Group(); proj.position.set(0.0, 0.985, 0.15); proj.rotation.x = -0.42; g.add(proj);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 0.085, 16), steel); barrel.position.y = -0.03; proj.add(barrel);
  const breech = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.035, 16), std({ color: 0x4a4e55, metalness: 0.9, roughness: 0.5 })); breech.position.y = 0.03; proj.add(breech);
  const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 12, 8), std({ color: 0xcfd3d8, metalness: 1, roughness: 0.25, emissive: 0x333333 })); bullet.visible = false; g.add(bullet);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), glowMat(new THREE.Color(2, 1.5, 0.8), 0)); g.add(flash);
  // 地面
  const ground = new THREE.Mesh(new THREE.CircleGeometry(0.75, 48), std({ map: T.regoC, normalMap: T.regoN, color: 0xcbbda6, roughness: 1 }));
  ground.rotation.x = -PI / 2; ground.receiveShadow = true; g.add(ground);
  const N = 220, grains = dots(N, 0xcdbfa8, 0.011, false); g.add(grains);
  const G = []; let mode = '', tm = 0, fired = false, caught = 0;
  const rWall = y => y < 0.74 ? 0.094 : y < 1.0 ? 0.094 - (y - 0.74) / 0.26 * 0.01 : y < 1.3 ? 0.081 - (y - 1.0) / 0.3 * 0.072 : 0.0075;
  const R = Math.random;
  const burst = (n, vmin, vmax, spread) => { for (let i = 0; i < n && G.length < N; i++) { const a = R() * PI * 2, r = Math.sqrt(R()) * 0.07, th = R() * spread, ph = R() * PI * 2, sp = vmin + R() * (vmax - vmin); G.push({ p: V(Math.cos(a) * r, 0.005, Math.sin(a) * r), v: V(Math.sin(th) * Math.cos(ph) * sp, Math.cos(th) * sp, Math.sin(th) * Math.sin(ph) * sp), st: 0, room: 0 }); } };
  g.anchors = { catcher: V(0.03, 1.43, 0), projector: V(0.0, 1.0, 0.17), tip: V(0.1, 0.02, 0), cone: V(0.05, 1.15, 0), bellows: V(0.105, 0.45, 0) };
  // ホーンの長さを見張るレーザー（縮むと着地と判断する）
  const lrf = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1, 6), glowMat(new THREE.Color(2, 0.3, 0.2), 0.0)); lrf.position.set(0.07, 0.6, 0.0); lrf.scale.y = 0.72; g.add(lrf);
  g.horn = horn; g.caught = () => caught; g.door = door; g.catcher = catcher; g.lrfBeam = lrf; g.flash = flash;
  // mode: 'plan'（計画どおり弾を撃つ）/ 'actual'（弾は出ず、着地で舞った粒だけ）
  g.start = (m, room = 0) => { mode = m; tm = 0; fired = false; caught = 0; G.length = 0; g.room = room; bullet.visible = false; door.rotation.y = room ? PI * 0.67 : 0; };
  g.update = (dt) => {
    tm += dt;
    const press = mode ? Math.max(0, Math.min(1, (tm - 0.4) / 0.5)) * (tm < 2.2 ? 1 : Math.max(0, 1 - (tm - 2.2) / 0.8)) : 0;
    bell.scale.y = 1 - press * 0.07; bell.position.y = 0.19 * press * 0.07;      // 蛇腹が縮む（タッチダウン検出のもと）
    flash.material.opacity = 0;
    if (mode === 'plan') {
      if (tm > 1.0 && tm < 1.25) { const k = (tm - 1.0) / 0.25; bullet.visible = true; bullet.position.set(0, 0.95 - k * 0.94, 0.135 * (1 - k)); }
      if (tm >= 1.25 && !fired) { fired = true; bullet.visible = false; burst(200, 0.5, 2.2, 0.5); }
      if (tm > 1.25 && tm < 1.45) { flash.position.set(0, 0.02, 0); flash.material.opacity = 1 - (tm - 1.25) / 0.2; }
    } else if (mode === 'actual') {
      if (tm > 0.5 && !fired) { fired = true; burst(26, 0.12, 0.42, 0.35); }
    }
    for (const a of G) {
      if (a.st === 2) continue;
      a.p.addScaledVector(a.v, dt);
      const r = Math.hypot(a.p.x, a.p.z), rw = rWall(a.p.y);
      if (a.st === 0 && r > rw) {       // 内壁ではね返る
        const nx = a.p.x / r, nz = a.p.z / r, vn = a.v.x * nx + a.v.z * nz;
        if (vn > 0) { a.v.x -= 1.9 * vn * nx; a.v.z -= 1.9 * vn * nz; a.v.multiplyScalar(0.93); }
        a.p.x = nx * rw * 0.98; a.p.z = nz * rw * 0.98;
        if (a.p.y > 1.0) a.v.y = Math.abs(a.v.y) * 0.9 + 0.05;
      }
      if (a.p.y < 0.004 && a.v.y < 0) { a.v.set(0, 0, 0); a.p.y = 0.004; a.st = 2; }
      if (a.st === 0 && a.p.y > 1.3) { a.st = 1; a.p.x = a.p.z = 0; a.v.set(0, Math.max(0.25, a.v.y), 0); }
      if (a.st === 1 && a.p.y > 1.415) { a.st = 2; caught++; const s = g.room ? -1 : 1; a.p.set((0.006 + R() * 0.012) * s, 1.408 + R() * 0.04, (R() - .5) * 0.02); }
    }
    const pp = grains.userData.pos; G.forEach((a, i) => { pp[i * 3] = a.p.x; pp[i * 3 + 1] = a.p.y; pp[i * 3 + 2] = a.p.z; });
    grains.geometry.setDrawRange(0, G.length); grains.geometry.attributes.position.needsUpdate = true;
  };
  return g;
}

// ================= 再突入カプセル（直径40cm。先端が-Y） =================
function capProfile() {
  const p = [];
  for (let i = 0; i <= 9; i++) { const th = (i / 9 * 45) * PI / 180; p.push([0.2 * Math.sin(th), -0.2 * Math.cos(th) + 0.081]); }   // 球面（曲率半径20cm）
  for (let i = 1; i <= 5; i++) { const t = i / 5; p.push([0.1414 + 0.0606 * t, -0.0604 + 0.0606 * t]); }                              // 45度の円錐
  return p;       // 肩が y=0.0002 付近
}
export function makeCapsule(T, { cut = false } = {}) {
  const g = new THREE.Group(), o = cut ? { arc: PI * 1.2, phi0: PI * 0.4, seg: 56 } : { arc: PI * 2, phi0: 0, seg: 56 };
  const outer = capProfile(), inner = outer.map(([r, y], i) => { const k = 1 - (i / (outer.length - 1)) * 0.25; return [Math.max(0, r - 0.03 * k * (r > 0.01 ? 1 : 0)), y + 0.034 * k]; }).reverse();
  const ablM = std({ color: 0x2b2420, roughness: 0.85, emissive: new THREE.Color(1.0, 0.42, 0.12), emissiveIntensity: 0 });
  const front = new THREE.Group(); front.add(cutLathe(outer.concat(inner), ablM, { ...o, capMat: std({ color: 0x3a302a, roughness: 0.9 }) })); g.add(front);
  const insM = std({ color: 0xcfc6b4, roughness: 0.9 });
  const ins = inner.slice().reverse().map(([r, y]) => [r, y]); const ins2 = ins.map(([r, y]) => [Math.max(0, r - 0.008), y + 0.009]).reverse();
  front.add(cutLathe(ins.concat(ins2), insM, o));
  const aft = new THREE.Group(); aft.add(cutLathe([[0.202, 0.002], [0.196, 0.009], [0.085, 0.118], [0.0, 0.118], [0.0, 0.107], [0.08, 0.107], [0.186, 0.004]], std({ color: 0x4a3d33, roughness: 0.85 }), o)); g.add(aft);
  // 中身：電子機器、サンプルコンテナ、パラシュートの包み
  const core = new THREE.Group(); g.add(core);
  core.add(cutLathe([[0.045, -0.03], [0.165, -0.03], [0.175, 0.0], [0.165, 0.035], [0.045, 0.035]], std({ color: 0x6a7078, metalness: 0.8, roughness: 0.5 }), o));
  core.add(cutLathe([[0.027, -0.045], [0.034, -0.045], [0.034, 0.04], [0.027, 0.04]], std({ color: 0x9a9da3, metalness: 1, roughness: 0.3 }), o));
  core.add(cutLathe([[0.0, -0.045], [0.034, -0.045], [0.034, -0.04], [0.0, -0.04]], std({ color: 0x9a9da3, metalness: 1, roughness: 0.3 }), o));
  const pack = cutLathe([[0.04, 0.04], [0.15, 0.04], [0.13, 0.085], [0.07, 0.1], [0.04, 0.1]], std({ color: 0xd9662f, roughness: 0.9 }), o); core.add(pack);
  g.front = front; g.aft = aft; g.core = core; g.pack = pack; g.abl = ablM;
  g.anchors = { nose: V(0, -0.125, 0), shock: V(0, -0.2, 0), ablator: V(0.11, -0.085, 0), inside: V(0.1, 0.0, 0), container: V(0.03, 0.0, 0), chute: V(0.1, 0.07, 0) };
  g.setHeat = (k) => { ablM.emissiveIntensity = k * 2.2; };
  return g;
}
// 十字形のパラシュート
export function makeCrossChute() {
  const g = new THREE.Group(), w = 0.9, L = 3.0, pos = [], col = [], idx = [], nseg = 8;
  const arm = (dx, dy) => {
    const base = pos.length / 3;
    for (let j = 0; j <= nseg; j++) for (let i = 0; i <= 2; i++) {
      const s = (j / nseg - 0.5) * L, c = (i / 2 - 0.5) * w, x = dx ? s : c, z = dy ? s : c, rr = Math.hypot(x, z);
      pos.push(x * (1 - 0.1 * rr * rr / 2.25), -0.42 * rr * rr / 2.25 - 0.06 * Math.abs(c) / w, z * (1 - 0.1 * rr * rr / 2.25));
      const stripe = Math.floor((s / L + 0.5) * 6) % 2; col.push(stripe ? 0.92 : 0.9, stripe ? 0.42 : 0.88, stripe ? 0.16 : 0.84);
    }
    for (let j = 0; j < nseg; j++) for (let i = 0; i < 2; i++) { const a = base + j * 3 + i, b = a + 1, c = a + 3, d = c + 1; idx.push(a, c, b, b, c, d); }
  };
  arm(1, 0); arm(0, 1);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const canopy = new THREE.Mesh(geo, std({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide })); canopy.castShadow = true; g.add(canopy);
  const lm = new THREE.LineBasicMaterial({ color: 0xdddddd }), lp = [];
  for (const [x, z] of [[1.4, 0.4], [1.4, -0.4], [-1.4, 0.4], [-1.4, -0.4], [0.4, 1.4], [-0.4, 1.4], [0.4, -1.4], [-0.4, -1.4]]) lp.push(x * 0.9, -0.5, z * 0.9, 0, -3.2, 0);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); g.add(new THREE.LineSegments(lg, lm));
  g.hang = -3.2;
  return g;
}
