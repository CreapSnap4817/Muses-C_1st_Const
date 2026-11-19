// 軌道図。地球・イトカワ・金星・火星は軌道要素から、はやぶさは公表されている日付と距離から計算で再現する。
//   イトカワの要素（元期 2005年8月18日）：a=1.324AU e=0.280 i=1.622° Ω=69.095° ω=162.760° M=294.502° 周期556.355日
//   はやぶさ：打ち上げ 2003/5/9、スイングバイ 2004/5/19、到着 2005/9/12、出発 2007/4/25、帰還 2010/6/13
//     1年目は近日点0.86AUの楕円（長軸の向きを少しずつ回して1年後の地球に合わせる）
//     スイングバイ後と帰り道は、両端の位置と飛行日数を満たす楕円（ランベルト問題の解）
//   再現した軌道は、道のりの合計が約59億km、2006年3月6日の地球からの距離が3.3億km、
//   2010年6月9日の地球からの距離が約190万kmになり、公表値と合う。
import * as THREE from 'three';

const D = Math.PI / 180, K2 = 0.01720209895 ** 2, AUKM = 1.495978707e8, J2000 = 2451545.0;
export const AU = 100;
const jd = (y, m, d, h = 0) => { const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045 - 0.5 + h / 24; };
export const dateOf = (t) => { const Z = Math.floor(t + 0.5 + 9 / 24), al = Math.floor((Z - 1867216.25) / 36524.25), A = Z + 1 + al - Math.floor(al / 4), B = A + 1524,
  C = Math.floor((B - 122.1) / 365.25), Dd = Math.floor(365.25 * C), E = Math.floor((B - Dd) / 30.6001);
  const d = B - Dd - Math.floor(30.6001 * E), m = E < 14 ? E - 1 : E - 13, y = m > 2 ? C - 4716 : C - 4715; return [y, m, d]; };   // 日本時間の年月日
const kepE = (M, e) => { M = ((M + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; let E = M + e * Math.sin(M);
  for (let i = 0; i < 12; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; };
// 軌道要素 → 黄道座標（AU）
function pos(a, e, i, Om, w, M, out) {
  const E = kepE(M, e), x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cO = Math.cos(Om), sO = Math.sin(Om), ci = Math.cos(i), si = Math.sin(i), cw = Math.cos(w), sw = Math.sin(w);
  out[0] = x * (cO * cw - sO * sw * ci) + y * (-cO * sw - sO * cw * ci);
  out[1] = x * (sO * cw + cO * sw * ci) + y * (-sO * sw + cO * cw * ci);
  out[2] = x * (sw * si) + y * (cw * si);
  return out;
}
const nOf = a => Math.sqrt(K2 / (a * a * a));
const planet = (a, e0, i, L0, Ld, wb, Om) => (t, o) => { const T = (t - J2000) / 36525; return pos(a, e0, i * D, Om * D, (wb - Om) * D, (L0 + Ld * T - wb) * D, o); };
const earthAt = planet(1.00000261, 0.01671123, 0, 100.46457166, 35999.37244981, 102.93768193, 0);
const venusAt = planet(0.72333566, 0.00677672, 3.39467605, 181.9790995, 58517.81538729, 131.60246718, 76.67984255);
const marsAt = planet(1.52371034, 0.0933941, 1.84969142, -4.55343205, 19140.30268499, -23.94362959, 49.55953891);
const itoAt = (t, o) => pos(1.324, 0.280, 1.622 * D, 69.095 * D, 162.760 * D, 294.502 * D + 2 * Math.PI / 556.355 * (t - 2453600.5), o);
export const TM = { L: 2452768.687, SB: 2453144.765, A: 2453625.542, D: 2454215.75, R: 2455361.077 };
function hbAt(t, o) {
  if (t <= TM.SB) { const a = 1.018049, s = (t - TM.L) / (TM.SB - TM.L); return pos(a, 0.155247, 0, 0, -3.974372 + 0.167325 * s, 1.361275 + nOf(a) * (t - TM.L), o); }
  if (t <= TM.A) return pos(1.33956, 0.25005, 0.028199, 1.022056, 2.874037, 0.156161 + nOf(1.33956) * (t - TM.SB), o);
  if (t <= TM.D) return itoAt(t, o);
  return pos(1.293114, 0.245104, 0.026256, 1.436553, 2.502707, 5.836822 + nOf(1.293114) * (t - TM.D), o);
}
// 主なできごと（日付は公表されているもの。場所は再現した軌道の上）
export const EVENTS = [
  ['launch', 2003, 5, 9, '打ち上げ'], ['flare', 2003, 11, 4, '太陽フレア'], ['peri', 2004, 2, 27, '太陽に最も近づく'], ['swingby', 2004, 5, 19, '地球スイングバイ'],
  ['aph', 2005, 2, 20, '太陽から最も遠ざかる'], ['conj', 2005, 7, 14, '太陽の向こう側'], ['arrive', 2005, 9, 12, 'イトカワ到着'], ['td', 2005, 11, 26, '着地'],
  ['lost', 2005, 12, 8, '通信がとだえる'], ['found', 2006, 1, 23, '電波をとらえる'], ['depart', 2007, 4, 25, '地球へ出発'], ['p1', 2007, 10, 18, '1回目の加速を終える'],
  ['p2', 2009, 2, 4, '2回目の加速を始める'], ['dstop', 2009, 11, 4, 'エンジンDが停止'], ['p2e', 2010, 3, 27, '加速を終える'], ['return', 2010, 6, 13, '地球へ帰還'],
].map(([id, y, m, d, name]) => ({ id, jd: jd(y, m, d, 3), name, y, m, d }));
const EV = Object.fromEntries(EVENTS.map(e => [e.id, e]));
// 区間の色分け：加速中 / 慣性で飛ぶ / イトカワのそば / 通信がとだえた期間
const phaseOf = (t) => t < TM.A ? 0 : t < EV.lost.jd ? 2 : t < EV.found.jd ? 3 : t < TM.D ? 2 : t < EV.p1.jd ? 0 : t < EV.p2.jd ? 1 : 0;
const PCOL = [[1.25, 0.8, 0.28], [0.4, 0.62, 1.0], [1.0, 0.95, 0.8], [1.3, 0.25, 0.2]];

export function makeOrbitMap(T) {
  const g = new THREE.Group();
  const v3 = (p, o = new THREE.Vector3()) => o.set(p[0] * AU, p[2] * AU, -p[1] * AU);
  const tmp = [0, 0, 0];
  // 点列に沿った細い管（時間について等間隔）
  function tube(pts, rad, radial, colors) {
    const n = pts.length, P = new Float32Array(n * radial * 3), C = colors ? new Float32Array(n * radial * 3) : null, I = [];
    const tan = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(), b = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      tan.copy(pts[Math.min(n - 1, i + 1)]).sub(pts[Math.max(0, i - 1)]).normalize(); s.crossVectors(tan, up).normalize(); b.crossVectors(s, tan);
      for (let j = 0; j < radial; j++) { const a = j / radial * Math.PI * 2, k = (i * radial + j) * 3, c = Math.cos(a) * rad, d = Math.sin(a) * rad;
        P[k] = pts[i].x + s.x * c + b.x * d; P[k + 1] = pts[i].y + s.y * c + b.y * d; P[k + 2] = pts[i].z + s.z * c + b.z * d;
        if (C) { C[k] = colors[i][0]; C[k + 1] = colors[i][1]; C[k + 2] = colors[i][2]; } }
      if (i < n - 1) for (let j = 0; j < radial; j++) { const a = i * radial + j, b2 = i * radial + (j + 1) % radial, c = a + radial, d = b2 + radial; I.push(a, c, b2, b2, c, d); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); if (C) geo.setAttribute('color', new THREE.BufferAttribute(C, 3)); geo.setIndex(I);
    return geo;
  }
  const basic = (o) => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, ...o });
  const ring = (fn, period, t0, color, op, rad = 0.34) => { const pts = []; for (let i = 0; i <= 360; i++) pts.push(v3(fn(t0 + period * i / 360, tmp)));
    const m = new THREE.Mesh(tube(pts, rad, 5), basic({ color, opacity: op })); g.add(m); return m; };
  // 距離の目盛り（0.5AUごとの円と、30度ごとの放射線）
  { const P = []; for (const r of [0.5, 1, 1.5, 2]) for (let i = 0; i < 180; i++) { const a = i / 180 * Math.PI * 2, b = (i + 1) / 180 * Math.PI * 2; P.push(Math.cos(a) * r * AU, -0.6, Math.sin(a) * r * AU, Math.cos(b) * r * AU, -0.6, Math.sin(b) * r * AU); }
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; P.push(Math.cos(a) * 0.5 * AU, -0.6, Math.sin(a) * 0.5 * AU, Math.cos(a) * 2 * AU, -0.6, Math.sin(a) * 2 * AU); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x4be1ff, transparent: true, opacity: 0.1, depthWrite: false }))); }
  const rings = {
    venus: ring(venusAt, 224.701, TM.L, 0x8f8a7c, 0.25, 0.2), mars: ring(marsAt, 686.98, TM.L, 0xb5694a, 0.32, 0.2),
    earth: ring(earthAt, 365.256, TM.L, 0x3d8bff, 0.6), ito: ring(itoAt, 556.355, TM.L, 0xb69a6a, 0.6),
  };
  // はやぶさの軌跡（2日きざみ）と、進んだ道のりの表
  const STEP = 2, N = Math.ceil((TM.R - TM.L) / STEP), pts = [], cols = [], cum = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) { const t = Math.min(TM.R, TM.L + i * STEP); pts.push(v3(hbAt(t, tmp))); cols.push(PCOL[phaseOf(t)]); if (i) cum[i] = cum[i - 1] + pts[i].distanceTo(pts[i - 1]) / AU * AUKM; }
  const traj = new THREE.Mesh(tube(pts, 0.7, 6, cols), new THREE.MeshBasicMaterial({ vertexColors: true })); g.add(traj);
  const total = cum[N];
  // 天体
  const glow = (color, size) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(size); g.add(s); return s; };
  const ball = (r, color) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12), new THREE.MeshBasicMaterial({ color })); g.add(m); return m; };
  const sun = glow(new THREE.Color(3, 2.6, 2), 26); glow(new THREE.Color(2.5, 1.6, 0.7), 60).material.opacity = 0.35;
  const earth = ball(2.6, 0x5aa7ff), ito = ball(1.7, 0xd8c39a), venus = ball(1.3, 0x8f8a7c), mars = ball(1.3, 0xb5694a);
  const eGlow = glow(new THREE.Color(0.5, 0.9, 2.2), 12);
  const hb = glow(new THREE.Color(3, 2.4, 1.2), 9);
  const core = ball(0.8, 0xfff2d0);
  // 地球とはやぶさを結ぶ線（電波の通り道）
  const linkGeo = new THREE.BufferGeometry(); linkGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  const link = new THREE.Line(linkGeo, new THREE.LineBasicMaterial({ color: 0x4be1ff, transparent: true, opacity: 0.45, depthWrite: false })); link.frustumCulled = false; g.add(link);
  // できごとの印
  const marks = EVENTS.map(e => { const m = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.22, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })); m.rotation.x = Math.PI / 2;
    v3(hbAt(e.jd, tmp), m.position); m.visible = false; g.add(m); e.pos = m.position; return m; });
  const idxPer = 6 * 6;
  let now = TM.L;
  g.setTime = (t) => {
    now = t = Math.max(TM.L, Math.min(TM.R, t));
    traj.geometry.setDrawRange(0, Math.floor((t - TM.L) / STEP) * idxPer);
    v3(earthAt(t, tmp), earth.position); eGlow.position.copy(earth.position); v3(itoAt(t, tmp), ito.position); v3(venusAt(t, tmp), venus.position); v3(marsAt(t, tmp), mars.position);
    v3(hbAt(t, tmp), hb.position); core.position.copy(hb.position);
    const lp = linkGeo.attributes.position; lp.setXYZ(0, earth.position.x, earth.position.y, earth.position.z); lp.setXYZ(1, hb.position.x, hb.position.y, hb.position.z); lp.needsUpdate = true;
    marks.forEach((m, i) => { m.visible = t >= EVENTS[i].jd - 1; });
  };
  // その時刻の数値：太陽からの距離（AU）、地球からの距離（km）、進んだ道のり（km、合計は公表値の60億kmに合わせて表示する）
  g.info = (t = now) => { t = Math.max(TM.L, Math.min(TM.R, t)); const h = hbAt(t, [0, 0, 0]), e = earthAt(t, [0, 0, 0]); const f = (t - TM.L) / STEP, i = Math.min(N - 1, Math.floor(f));
    return { r: Math.hypot(h[0], h[1], h[2]), de: Math.hypot(h[0] - e[0], h[1] - e[1], h[2] - e[2]) * AUKM, path: (cum[i] + (cum[i + 1] - cum[i]) * (f - i)) / total * 6.0e9 }; };
  g.setLink = (on) => { link.visible = on; };
  g.setMarks = (on) => { marks.forEach(m => { m.material.opacity = on ? 0.9 : 0; }); };
  g.setProgress = (s) => g.setTime(TM.L + (TM.R - TM.L) * Math.max(0, Math.min(1, s)));
  g.years = (s) => s * (TM.R - TM.L) / 365.25;
  g.now = () => now; g.TM = TM; g.EVENTS = EVENTS; g.EV = EV; g.dateOf = dateOf; g.jd = jd; g.total = total; g.AU = AU;
  g.parts = { earth, ito, hb, sun, venus, mars }; g.rings = rings;
  g.posAt = (t, o = new THREE.Vector3()) => v3(hbAt(t, tmp), o);
  g.earthAt = (t, o = new THREE.Vector3()) => v3(earthAt(t, tmp), o);
  g.itoAt = (t, o = new THREE.Vector3()) => v3(itoAt(t, tmp), o);
  g.setTime(TM.L);
  return g;
}
