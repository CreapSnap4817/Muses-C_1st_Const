// 機体の外装。本体の向きと寸法（イオンエンジンの面が約1.0×1.1m、パドル側の面が1.6×1.1m）、各部の形と色は、
// 実機の写真と公式の精密模型の写真に合わせた。写真から読み取れない細部は、一般的な宇宙機の作りから補っている。
import * as THREE from 'three';
import { HX, HY, HZ, PI, crinkle, uvBox, basis, circlePts, rng } from './hb_core.js';

function facePlane(w, h, center, n, u, o = {}) {
  const cell = o.cell ?? 0.032, roll = o.roll ?? 0.022;
  const sx = Math.max(2, Math.round(w / cell)), sy = Math.max(2, Math.round(h / cell));
  const geo = new THREE.PlaneGeometry(w, h, sx, sy);
  const p = geo.attributes.position, nn = geo.attributes.normal;
  if (roll > 0) for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), dx = w / 2 - Math.abs(x), dy = h / 2 - Math.abs(y);
    let z = 0, nx = 0, ny = 0;
    if (dx < roll) { const t = roll - dx, c = Math.max(roll * 0.2, Math.sqrt(Math.max(0, roll * roll - t * t))); z -= roll - c; nx = Math.sign(x) * t / c; }
    if (dy < roll) { const t = roll - dy, c = Math.max(roll * 0.2, Math.sqrt(Math.max(0, roll * roll - t * t))); z -= roll - c; ny = Math.sign(y) * t / c; }
    p.setZ(i, z); const l = Math.hypot(nx, ny, 1); nn.setXYZ(i, nx / l, ny / l, 1 / l);
  }
  const N = new THREE.Vector3(...n).normalize(), U = new THREE.Vector3(...u).normalize(), V = N.clone().cross(U);
  geo.applyMatrix4(new THREE.Matrix4().makeBasis(U, V, N).setPosition(center[0], center[1], center[2]));
  return geo;
}
const add3 = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// 面ごとに法線を立てる（角ばった部品用）
const flat = geo => { const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals(); return g; };
// X軸まわりの回転体を、角の丸い四角形の断面に変える
function squarify(geo, cy, cz, p = 5) {
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const dy = P.getY(i) - cy, dz = P.getZ(i) - cz, r = Math.hypot(dy, dz); if (r < 1e-9) continue;
    const k = 1 / Math.pow(Math.pow(Math.abs(dy / r), p) + Math.pow(Math.abs(dz / r), p), 1 / p);
    P.setY(i, cy + dy * k); P.setZ(i, cz + dz * k);
  }
  geo.computeVertexNormals(); return geo;
}
// 薄い三角板（表と裏の2面）
function triPlate(a, b, c, t = 0.0014) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), C = new THREE.Vector3(...c);
  const n = B.clone().sub(A).cross(C.clone().sub(A)).normalize();
  const pos = [], nor = [], uv = [];
  [[A, B, C, 1, 0], [A, C, B, -1, t]].forEach(([p, q, r, s, off]) => { for (const v of [p, q, r]) { pos.push(v.x - n.x * off, v.y - n.y * off, v.z - n.z * off); nor.push(n.x * s, n.y * s, n.z * s); uv.push(v.x + v.y, v.z + v.y * 0.5); } });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

export function buildExterior(K) {
  const R = rng(5), M = K.meta;
  M.dim = { HX, HY, HZ };

  // ============ 金色の断熱材（6面）と継ぎ目のテープ ============
  const faces = [
    { n: [0, 0, 1], u: [1, 0, 0], w: 2 * HX, h: 2 * HY, c: [0, 0, HZ], ex: [0, 0, 0.5] },
    { n: [0, 0, -1], u: [1, 0, 0], w: 2 * HX, h: 2 * HY, c: [0, 0, -HZ], ex: [0, 0, -0.5] },
    { n: [1, 0, 0], u: [0, 1, 0], w: 2 * HY, h: 2 * HZ, c: [HX, 0, 0], ex: [0.5, 0, 0] },
    { n: [-1, 0, 0], u: [0, 1, 0], w: 2 * HY, h: 2 * HZ, c: [-HX, 0, 0], ex: [-0.5, 0, 0] },
    { n: [0, 1, 0], u: [1, 0, 0], w: 2 * HX, h: 2 * HZ, c: [0, HY, 0], ex: [0, 0.45, 0] },
    { n: [0, -1, 0], u: [1, 0, 0], w: 2 * HX, h: 2 * HZ, c: [0, -HY, 0], ex: [0, -0.45, 0] },
  ];
  for (const f of faces) {
    const g = K.grp('mli', f.c, f.ex, { skin: true });
    K.add(g, uvBox(crinkle(facePlane(f.w + 0.012, f.h + 0.012, f.c, f.n, f.u))), 'mli');
    const N = new THREE.Vector3(...f.n), U = new THREE.Vector3(...f.u), V = N.clone().cross(U);
    const strip = (len, wid, ou, ov, alongU) => {
      const c = [f.c[0] + U.x * ou + V.x * ov + N.x * 0.0022, f.c[1] + U.y * ou + V.y * ov + N.y * 0.0022, f.c[2] + U.z * ou + V.z * ov + N.z * 0.0022];
      const geo = alongU ? facePlane(len, wid, c, f.n, f.u, { roll: 0, cell: 0.03 }) : facePlane(wid, len, c, f.n, f.u, { roll: 0, cell: 0.03 });
      K.add(g, uvBox(crinkle(geo)), 'tape');
    };
    strip(f.w - 0.05, 0.034, 0, f.h / 2 - 0.028, true); strip(f.w - 0.05, 0.034, 0, -f.h / 2 + 0.028, true);
    strip(f.h - 0.05, 0.034, f.w / 2 - 0.028, 0, false); strip(f.h - 0.05, 0.034, -f.w / 2 + 0.028, 0, false);
    strip(f.h - 0.1, 0.026, (R() - 0.5) * f.w * 0.4, 0, false);
    if (f.w > 1.2) strip(f.w - 0.1, 0.026, 0, (R() - 0.5) * f.h * 0.3, true);
  }

  // ============ 放熱面 ============
  // +X面：鏡のような銀色のパネル（イオンエンジンの電源などの熱を逃がす）。上辺は黒い断熱材
  { const g = K.grp('radiator', [HX, 0, 0], [0.55, 0, 0.05], { skin: true });
    K.add(g, K.box(0.006, 2 * HY - 0.07, 2 * HZ - 0.15, [HX + 0.005, 0, -0.005], { r: 0.002, cell: 0.12 }), 'smirror');
    K.add(g, uvBox(crinkle(facePlane(2 * HY - 0.2, 0.075, [HX + 0.0095, 0, HZ - 0.042], [1, 0, 0], [0, 1, 0], { roll: 0.006, cell: 0.025 }), 0.6)), 'mliDark'); }
  // ±Y面：銀色の放熱面が2段×4列に並ぶ。裏側に発熱する機器が付く
  const cols = [-0.57, -0.19, 0.19, 0.57], rows = [0.215, -0.225];
  const layout = { 1: [['o', 'o', 'o', 'o'], ['o', 'k', 'o', 'o']], [-1]: [['o', 'o', 's', 'o'], ['o', 'o', 'w', 'o']] };
  M.radiators = [];
  for (const s of [1, -1]) {
    const g = K.grp('radiator', [0, s * HY, 0], [0, s * 0.6, 0], { skin: true });
    const patch = (x, z, w, h) => {
      K.add(g, K.box(w, 0.006, h, [x, s * (HY + 0.0075), z], { r: 0.0015, cell: 0.08 }), 'osr');
      K.add(g, K.box(w + 0.018, 0.004, h + 0.018, [x, s * (HY + 0.003), z], { r: 0.001 }), 'alu');
    };
    rows.forEach((z, j) => cols.forEach((x, i) => {
      const t = layout[s][j][i];
      if (t === 'o') { patch(x, z, 0.31, 0.36); M.radiators.push({ s, x, z }); }
      else if (t === 's') { patch(x - 0.035, z + 0.05, 0.22, 0.25); M.radiators.push({ s, x: x - 0.035, z: z + 0.05 }); }
      else if (t === 'k') {
        K.add(g, uvBox(crinkle(K.box(0.2, 0.008, 0.26, [x, s * (HY + 0.008), z], { r: 0.003, cell: 0.03 }), 0.4)), 'mliDark');
        K.add(g, K.box(0.06, 0.004, 0.06, [x - 0.03, s * (HY + 0.014), z - 0.05], { r: 0.001 }), 'white');
      }
    }));
  }
  { const g = K.grp('radiator', [-HX, -0.26, 0.28], [-0.6, -0.1, 0.1], { skin: true });
    K.add(g, K.box(0.006, 0.3, 0.34, [-HX - 0.0075, -0.26, 0.28], { r: 0.0015, cell: 0.08 }), 'osr');
    K.add(g, K.box(0.004, 0.318, 0.358, [-HX - 0.003, -0.26, 0.28], { r: 0.001 }), 'alu');
    K.add(g, K.box(0.006, 0.12, 0.12, [-HX - 0.0075, 0.0, 0.37], { r: 0.0015, cell: 0.06 }), 'osr'); K.add(g, K.box(0.004, 0.134, 0.134, [-HX - 0.003, 0.0, 0.37], { r: 0.001 }), 'alu'); }

  // ============ 高利得アンテナ（直径1.6m。浅い皿と、金色の断熱材を巻いた4本脚） ============
  {
    const g = K.grp('hga', [0, 0, 0.8], [0, 0, 0.9]);
    const f = 0.78, z0 = HZ + 0.17, Rd = 0.8, zf = r => r * r / (4 * f);
    const front = []; for (let i = 0; i <= 30; i++) { const r = Rd - (Rd - 0.04) * i / 30; front.push([r, zf(r)]); }
    K.add(g, K.lathe(front, [0, 0, z0], [0, 0, 1], { smooth: true, seg: 96, keepUV: true }), 'dishF');
    const back = []; for (let i = 0; i <= 22; i++) { const t = i / 22, r = 0.04 + (Rd - 0.01 - 0.04) * t; back.push([r, zf(r) - 0.01 - 0.022 * (1 - t) * (1 - t)]); }
    K.add(g, K.lathe(back, [0, 0, z0], [0, 0, 1], { smooth: true, seg: 96 }), 'dishB');
    K.add(g, K.torus(Rd, 0.009, [0, 0, z0 + zf(Rd) - 0.004], [0, 0, 1], { seg: 120 }), 'white');
    for (let k = 0; k < 16; k++) {          // 背面の放射状のリブ
      const a = k / 16 * PI * 2 + 0.1, sh = new THREE.Shape(), n = 12;
      for (let i = 0; i <= n; i++) { const r = 0.12 + 0.65 * i / n; const y = zf(r) - 0.012; i ? sh.lineTo(r, y) : sh.moveTo(r, y); }
      for (let i = n; i >= 0; i--) { const t = i / n, r = 0.12 + 0.65 * t; sh.lineTo(r, zf(r) - 0.012 - (0.045 * (1 - t) + 0.012)); }
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.005, bevelEnabled: false, curveSegments: 1 });
      geo.translate(0, 0, -0.0025);
      const X = new THREE.Vector3(Math.cos(a), Math.sin(a), 0), Y = new THREE.Vector3(0, 0, 1), Z = X.clone().cross(Y);
      geo.applyMatrix4(new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(0, 0, z0));
      K.add(g, uvBox(geo), 'dishB');
    }
    for (const r of [0.34, 0.6]) K.add(g, K.torus(r, 0.011, [0, 0, z0 + zf(r) - 0.03 - 0.018 * (1 - r)], [0, 0, 1], { seg: 72 }), 'dishB');
    // 中央の支持筒と斜めの支柱（どちらも断熱材巻き）
    K.add(g, crinkle(K.lathe([[0.085, 0], [0.085, 0.04], [0.085, 0.08], [0.085, 0.12], [0.085, z0 - HZ - 0.012]], [0, 0, HZ], [0, 0, 1], { smooth: true, seg: 40 }), 0.7), 'mli');
    for (const [x, y] of [[0.52, 0.3], [0.52, -0.3], [-0.52, 0.3], [-0.52, -0.3], [0, 0.4], [0, -0.4]]) {
      const l = Math.hypot(x, y), rr = 0.47, p1 = [x / l * rr, y / l * rr, z0 + zf(rr) - 0.03];
      K.add(g, crinkle(K.tube([[x, y, HZ + 0.012], p1], 0.016, { seg: 8, rad: 10 }), 0.5), 'mli');
      K.add(g, K.cyl(0.032, 0.016, [x, y, HZ], [0, 0, 1], { seg: 16 }), 'alu');
    }
    // 皿のふちを受ける黒い枠
    for (const sy of [1, -1]) {
      const yb = sy * 0.62, zb = z0 + zf(0.62) - 0.046;
      K.add(g, K.box(0.76, 0.03, 0.022, [0, yb, zb], { r: 0.004, cell: 0.2 }), 'cfrp');
      for (const sx of [1, -1]) {
        K.add(g, K.tube([[sx * 0.36, yb, zb], [sx * 0.36, sy * (HY - 0.03), HZ + 0.014]], 0.011, { seg: 1, rad: 8 }), 'cfrp');
        K.add(g, K.tube([[sx * 0.36, yb, zb + 0.008], [sx * 0.36, sy * 0.665, z0 + zf(0.756) - 0.03]], 0.008, { seg: 1, rad: 8 }), 'cfrp');
        K.add(g, K.box(0.05, 0.05, 0.014, [sx * 0.36, sy * (HY - 0.03), HZ + 0.007]), 'aluDark');
      }
    }
    // 4本脚と頂部の一次放射器
    const za = z0 + 0.72;
    for (let k = 0; k < 4; k++) {
      const a = (k + 0.5) / 4 * PI * 2, c = Math.cos(a), s = Math.sin(a);
      for (const w of [-1, 0, 1]) K.add(g, crinkle(K.tube([[c * 0.5 - s * w * 0.036, s * 0.5 + c * w * 0.036, z0 + zf(0.5)], [c * 0.075 - s * w * 0.02, s * 0.075 + c * w * 0.02, za]], 0.015, { seg: 14, rad: 6 }), 0.5), 'mli');   // 断熱材を巻いた平たい脚
      K.add(g, K.cyl(0.024, 0.012, [c * 0.5, s * 0.5, z0 + zf(0.5) - 0.004], [-c * 0.5, -s * 0.5, 0.86], { seg: 12 }), 'alu');
    }
    K.add(g, K.mliBox(0.2, 0.2, 0.1, [0, 0, za + 0.04], { r: 0.016, cell: 0.03, amp: 0.7 }), 'mli');
    K.add(g, K.sph(0.088, [0, 0, za - 0.008], { seg: 28, th: PI / 2, axis: [0, 0, -1] }), 'white');                                  // 皿へ電波を出す口をおおう白い半球
    K.add(g, K.pipe(0.094, 0.086, 0.012, [0, 0, za - 0.004], [0, 0, -1], { seg: 32 }), 'alu');
    K.add(g, K.tube([[0.07, 0.06, za - 0.01], [0.36, 0.34, z0 + zf(0.5) + 0.014], [0.2, 0.19, z0 + zf(0.27) + 0.01], [0.06, 0.05, z0 + 0.012]], 0.006, { rad: 6 }), 'alu');
    K.add(g, K.cyl(0.05, 0.016, [0, 0, z0 + 0.001], [0, 0, 1], { seg: 28 }), 'aluDark');
    // 頂部の低利得アンテナ
    const gl = K.grp('lga', [0, 0, za + 0.1], [0, 0, 1.2]);
    K.add(gl, K.box(0.15, 0.07, 0.008, [0, 0, za + 0.094], { r: 0.002 }), 'alu');
    for (const sx of [-1, 1]) { K.add(gl, K.cyl(0.024, 0.05, [sx * 0.042, 0, za + 0.098], [0, 0, 1], { seg: 24 }), 'chrome'); K.add(gl, K.cyl(0.026, 0.006, [sx * 0.042, 0, za + 0.148], [0, 0, 1], { seg: 24 }), 'alu'); }   // 低利得アンテナの2本の筒
    M.hga = { z0, f, top: za + 0.16 };
  }

  // ============ 中利得アンテナ（黒い角すい形のホーン。+X側は首を振る） ============
  const pyrHorn = (g, p, ax) => K.add(g, flat(K.lathe([[0.02, 0], [0.02, 0.03], [0.074, 0.15], [0.07, 0.15], [0.016, 0.032], [0.016, 0]], p, ax, { seg: 4, roll: PI / 4 })), 'black');
  { const bx = HX - 0.09, g = K.grp('mga', [bx, 0, HZ], [0.35, 0, 0.75]);
    K.add(g, K.mliBox(0.11, 0.12, 0.07, [bx, 0, HZ + 0.04], { r: 0.014, cell: 0.03, amp: 0.8 }), 'mli');
    const pv = [bx + 0.03, 0, HZ + 0.105];
    K.add(g, crinkle(K.sph(0.05, pv, { seg: 22 }), 0.8), 'mli');
    const ga = K.grp('mga', pv, [0, 0, 0], { parent: g, name: 'mgaA' });
    K.add(ga, K.box(0.05, 0.045, 0.045, [pv[0] + 0.05, 0, pv[2] + 0.018], { rot: [0, -0.35, 0] }), 'black');
    pyrHorn(ga, [pv[0] + 0.062, 0, pv[2] + 0.024], [0.94, 0, 0.34]);
    K.add(g, K.mliBox(0.09, 0.075, 0.05, [HX - 0.07, 0.2, HZ + 0.03], { r: 0.012, cell: 0.03, amp: 0.7 }), 'mli');
    K.add(g, crinkle(K.tube([[bx - 0.05, 0, HZ + 0.02], [bx - 0.2, -0.03, HZ + 0.016], [0.36, -0.06, HZ + 0.016], [0.1, -0.03, HZ + 0.02]], 0.011, { rad: 8 }), 0.4), 'mli');
    M.mgaA = { pivot: pv, axis: [0, 1, 0] }; }
  { const bx = -HX + 0.09, g = K.grp('mga', [bx, 0, HZ], [-0.35, 0, 0.75]);
    K.add(g, K.mliBox(0.1, 0.11, 0.07, [bx, 0, HZ + 0.04], { r: 0.014, cell: 0.03, amp: 0.8 }), 'mli');
    K.add(g, K.box(0.05, 0.045, 0.045, [bx - 0.05, 0, HZ + 0.085], { rot: [0, 0.35, 0] }), 'black');
    pyrHorn(g, [bx - 0.062, 0, HZ + 0.09], [-0.94, 0, 0.34]); }

  // ============ 太陽電池パドル（片翼3枚。2本の黒い棒のヨークで中央のパネルを支える） ============
  M.wings = [];
  const zp = 0.45, PW = 1.4, PL = 1.3, th = 0.022, YR = HY + 0.04, YH = 1.55, BX = 0.3;
  const HOLD = [[0.2, 0.22], [0.8, 0.22], [0.2, 0.78], [0.8, 0.78], [0.5, 0.5]];
  const flipUV = geo => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 1 - uv.getX(i), 1 - uv.getY(i)); return geo; };
  const panel = (g, x0, y0, flip) => {       // x0,y0: 左下。セルの面は+Z、裏は黒い面にハーネスが走る
    const cx = x0 + PW / 2, cy = y0 + PL / 2, zt = zp + th / 2, zb = zp - th / 2;
    K.add(g, K.box(PW, PL, th, [cx, cy, zp], { r: 0.003 }), 'cfrp');
    const cells = K.plate(PW - 0.006, PL - 0.006, [cx, cy, zt + 0.0006]);
    K.add(g, flip ? flipUV(cells) : cells, 'cells');
    const back = K.plate(PW - 0.006, PL - 0.006, [cx, cy, zb - 0.0006], { rot: [PI, 0, 0] });
    K.add(g, flip ? flipUV(back) : back, 'pback');
    for (const [u, v] of HOLD) {              // 打ち上げ時にパネルを押さえる点
      const x = x0 + u * PW, y = y0 + v * PL;
      K.add(g, K.box(0.055, 0.055, 0.004, [x, y, zt + 0.002], { r: 0.001 }), 'chrome');
      K.add(g, K.cyl(0.011, 0.007, [x, y, zt + 0.003], [0, 0, 1], { seg: 6 }), 'bolt');
      K.add(g, K.pipe(0.027, 0.012, 0.012, [x, y, zb], [0, 0, -1], { seg: 16 }), 'alu');
    }
  };
  for (const s of [1, -1]) {
    const yr = s * YR, yh = s * YH, yl = YH - YR;
    const gr = K.grp('paddle', [0, s * HY, zp], [0, s * 0.8, 0], { name: 'wingRoot' + s });
    for (const x of [-BX, BX]) {
      K.add(gr, uvBox(crinkle(K.box(0.1, 0.028, 0.09, [x, s * (HY + 0.014), zp], { r: 0.008, n: 2, cell: 0.03 }), 0.4)), 'mliDark');
      K.add(gr, K.cyl(0.011, 0.07, [x - 0.035, yr, zp], [1, 0, 0], { seg: 12 }), 'steel');
    }
    const gy = K.grp('paddle', [0, yr, zp], [0, 0, 0], { parent: gr, name: 'yoke' + s });
    for (const x of [-BX, BX]) {
      K.add(gy, K.box(0.034, yl - 0.02, 0.022, [x, s * (YR + yl / 2), zp], { r: 0.004, cell: 0.25 }), 'cfrp');
      K.add(gy, K.box(0.05, 0.035, 0.03, [x, yr + s * 0.012, zp]), 'aluDark');
    }
    K.add(gy, K.box(2 * BX - 0.03, 0.03, 0.02, [0, s * (YR + yl * 0.58), zp], { r: 0.004, cell: 0.25 }), 'cfrp');
    K.add(gy, K.box(2 * BX + 0.034, 0.25, 0.006, [0, s * (YH - 0.14), zp + 0.004], { r: 0.002, cell: 0.2 }), 'cfrp');
    K.add(gy, K.cyl(0.02, 0.006, [0, s * (YH - 0.14), zp + 0.007], [0, 0, 1], { seg: 16 }), 'chrome');
    K.add(gy, K.cyl(0.02, 0.006, [0, s * (YH - 0.14), zp + 0.001], [0, 0, -1], { seg: 16 }), 'chrome');
    K.add(gy, K.tube([[BX - 0.03, yr + s * 0.03, zp - 0.016], [BX - 0.03, s * (YR + yl * 0.5), zp - 0.017], [BX - 0.05, yh - s * 0.04, zp - 0.016]], 0.006, { rad: 6 }), 'cable');
    const zh = zp + 0.03;
    for (const x of [-BX, BX]) {
      K.add(gy, K.box(0.05, 0.035, 0.05, [x, yh - s * 0.02, zp + 0.016]), 'alu');
      K.add(gy, K.cyl(0.009, 0.08, [x - 0.04, yh, zh], [1, 0, 0], { seg: 12 }), 'steel');
    }
    const gc = K.grp('paddle', [0, yh, zh], [0, 0, 0], { parent: gy, name: 'panelC' + s });
    const y0 = s > 0 ? yh + 0.006 : yh - 0.006 - PL;
    panel(gc, -PW / 2, y0, false);
    for (const x of [-BX, BX]) K.add(gc, K.box(0.045, 0.04, 0.036, [x, yh + s * 0.03, zp + 0.014]), 'alu');
    const sides = [];
    for (const sx of [1, -1]) {
      const xh = sx * (PW / 2 + 0.004), zs = zp - (sx > 0 ? 0.024 : 0.048);
      const gs = K.grp('paddle', [xh, y0 + PL / 2, zs], [sx * 0.2, 0, 0], { parent: gc, name: 'panelS' + s + '_' + sx });
      panel(gs, sx > 0 ? xh + 0.004 : xh - 0.004 - PW, y0, sx > 0);
      for (const dy of [-0.42, 0.42]) {
        K.add(gs, K.cyl(0.008, 0.07, [xh, y0 + PL / 2 + dy - 0.035, zs], [0, 1, 0], { seg: 10 }), 'steel');
        K.add(gs, K.box(0.03, 0.045, zp - zs + 0.006, [xh + sx * 0.014, y0 + PL / 2 + dy - 0.02, (zp + zs) / 2 - 0.008]), 'alu');
        K.add(gc, K.box(0.03, 0.045, zp - zs + 0.006, [xh - sx * 0.014, y0 + PL / 2 + dy + 0.03, (zp + zs) / 2 - 0.008]), 'alu');
      }
      sides.push({ idx: gs.idx, sx });
    }
    M.wings.push({ s, root: gr.idx, yoke: gy.idx, center: gc.idx, sides });
  }

  // ============ イオンエンジン（+X面の中央。首を振る板の上に4台。板と本体の間は黒い蛇腹） ============
  {
    const zc = -0.07, a = 0.245, xb = HX + 0.172, xp = HX + 0.208, PH = 0.265, N = 9;
    const gB = K.grp('gimbal', [HX + 0.09, 0, zc], [0.72, 0, 0], { skin: true });
    const bp = []; for (let i = 0; i <= 2 * N; i++) bp.push([i % 2 ? a - 0.016 : a, 0.004 + (xb - HX - 0.004) * i / (2 * N)]);
    K.add(gB, squarify(K.lathe(bp, [HX, 0, zc], [1, 0, 0], { seg: 72 }), 0, zc), 'bellows');
    const gG = K.grp('gimbal', [xp, 0, zc], [0.95, 0, 0]);
    K.add(gG, uvBox(crinkle(K.box(xb - HX - 0.012, 2 * a + 0.03, 0.006, [(HX + xb) / 2 + 0.002, 0, zc + a + 0.013], { r: 0.002, cell: 0.025 }), 0.9)), 'foil');
    K.add(gG, K.box(0.03, 2 * PH, 2 * PH, [xp - 0.015, 0, zc], { r: 0.004, cell: 0.07 }), 'splate');
    K.add(gG, K.box(0.008, 2 * PH - 0.03, 2 * PH - 0.03, [xb + 0.003, 0, zc], { r: 0.002 }), 'alu');
    K.add(gG, uvBox(crinkle(K.box(0.003, 0.27, 0.27, [xp + 0.0016, 0, zc], { r: 0.001, cell: 0.03 }), 0.2)), 'mliDark');
    K.bolts(gG, [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, 1], [0, -1], [1, 0], [-1, 0]].map(([p, q]) => [xp, p * (PH - 0.016), zc + q * (PH - 0.016)]), [1, 0, 0], { r: 0.005 });
    // 蛇腹の内側：2軸の継手と、板を傾ける2本のアクチュエータ
    const gJ = K.grp('gimbal', [HX + 0.08, 0, zc], [0.15, 0, 0], { internal: true });
    K.add(gJ, K.cyl(0.03, 0.1, [HX + 0.005, 0, zc], [1, 0, 0], { seg: 20 }), 'steel');
    K.add(gJ, K.box(0.05, 0.05, 0.05, [HX + 0.125, 0, zc]), 'aluDark');
    K.add(gJ, K.cyl(0.012, 0.14, [HX + 0.125, -0.07, zc], [0, 1, 0], { seg: 12 }), 'steel');
    K.add(gJ, K.cyl(0.012, 0.14, [HX + 0.125, 0, zc - 0.07], [0, 0, 1], { seg: 12 }), 'steel');
    for (const [y, z] of [[0, 0.2], [0.2, 0]]) {
      K.add(gJ, K.cyl(0.017, 0.085, [HX + 0.005, y, zc + z], [1, 0, 0], { seg: 14 }), 'aluDark');
      K.add(gJ, K.cyl(0.007, 0.07, [HX + 0.09, y, zc + z], [1, 0, 0], { seg: 10 }), 'steel');
      K.add(gJ, K.sph(0.011, [HX + 0.162, y, zc + z], { seg: 10 }), 'steel');
    }
    const gI = K.grp('ion', [xp, 0, zc], [1.2, 0, 0]), gIS = K.grp('ion', [xp, 0, zc], [1.2, 0, 0], { skin: true }), gII = K.grp('ion', [xp, 0, zc], [1.2, 0, 0], { internal: true }), cutPhi = PI * 0.3;
    const gN = K.grp('neutralizer', [xp + 0.03, 0, zc], [1.45, 0, 0]);
    M.thrusters = [];
    const d = 0.115, dg = 0.094;
    for (const [name, sy, sz] of [['A', 1, 1], ['B', -1, 1], ['C', 1, -1], ['D', -1, -1]]) {
      const y = sy * d, z = zc + sz * d;
      // みがいた銀色の厚い輪と、奥まった黒いグリッド
      K.add(gI, K.lathe([[0.085, 0], [0.085, 0.009], [0.079, 0.015], [0.063, 0.015], [0.058, 0.011], [0.058, -0.02]], [xp, y, z], [1, 0, 0], { seg: 56 }), 'chrome');
      K.bolts(gI, circlePts([xp + 0.015, y, z], [1, 0, 0], 0.071, 12, 0.26), [1, 0, 0], { r: 0.003, h: 0.0022 });
      K.add(gI, K.disc(0.0582, [xp + 0.0055, y, z], [1, 0, 0], { seg: 48 }), 'grid', { sep: name, keepUV: true });
      // 板の裏：放電室、磁石の輪、マイクロ波の同軸ケーブル、キセノンの細管
      K.add(gIS, K.cyl(0.07, 0.12, [xp - 0.03, y, z], [-1, 0, 0], { seg: 40 }), 'silver');
      K.add(gIS, K.torus(0.071, 0.006, [xp - 0.085, y, z], [1, 0, 0], { seg: 40 }), 'aluDark');
      // 中身：3枚のグリッド、放電室、2つの磁石の輪、マイクロ波のアンテナ（内部表示で外筒を透かすと見える）
      for (const [dx, m] of [[-0.004, 'aluDark'], [-0.009, 'aluDark']]) K.add(gII, K.cyl(0.056, 0.0014, [xp + dx, y, z], [-1, 0, 0], { seg: 40, ch: 0.0003 }), m);
      K.add(gII, K.pipe(0.064, 0.060, 0.1, [xp - 0.014, y, z], [-1, 0, 0], { seg: 40, arc: PI * 1.45, phi0: cutPhi }), 'alu');
      K.add(gII, K.pipe(0.060, 0.047, 0.016, [xp - 0.034, y, z], [-1, 0, 0], { seg: 40, arc: PI * 1.45, phi0: cutPhi }), 'magN');
      K.add(gII, K.pipe(0.060, 0.047, 0.016, [xp - 0.082, y, z], [-1, 0, 0], { seg: 40, arc: PI * 1.45, phi0: cutPhi }), 'magS');
      K.add(gII, K.cyl(0.062, 0.006, [xp - 0.114, y, z], [-1, 0, 0], { seg: 36 }), 'aluDark');
      K.add(gII, K.cyl(0.003, 0.06, [xp - 0.114, y, z], [1, 0, 0], { seg: 10 }), 'gold');
      K.add(gII, K.cyl(0.006, 0.012, [xp - 0.066, y, z], [1, 0, 0], { seg: 10 }), 'gold');
      K.add(gI, K.cyl(0.018, 0.03, [xp - 0.15, y, z], [-1, 0, 0], { seg: 14 }), 'gold');
      K.add(gI, K.tube([[xp - 0.18, y, z], [xp - 0.2, y * 0.8, zc + sz * d * 0.8], [HX - 0.02, y * 0.5, zc + sz * 0.05]], 0.006, { rad: 8 }), 'gold');
      K.add(gI, K.tube([[xp - 0.06, y + sy * 0.045, z - sz * 0.055], [xp - 0.14, y + sy * 0.03, z - sz * 0.06], [HX - 0.02, y * 0.3, zc - 0.03]], 0.003, { rad: 6 }), 'steel');
      // 中和器：外側の斜め方向に付き、ビームへ向けて45度かたむく
      const nb = [xp, y + sy * dg, z + sz * dg], ax = nrm([0.78, -sy * 0.44, -sz * 0.44]);
      K.add(gN, uvBox(crinkle(K.box(0.034, 0.062, 0.042, [xp + 0.017, nb[1], nb[2]], { rot: [Math.atan2(sz, sy), 0, 0], r: 0.006, cell: 0.02 }), 0.5)), 'foil');
      const c0 = [xp + 0.03, nb[1], nb[2]];
      K.add(gN, K.cyl(0.0125, 0.05, c0, ax, { seg: 20 }), 'chrome');
      K.add(gN, K.pipe(0.0135, 0.0045, 0.004, add3(c0, ax, 0.05), ax, { seg: 20 }), 'black');
      K.add(gN, K.tube([[xp + 0.012, nb[1] + sy * 0.03, nb[2] + sz * 0.03], [xp + 0.005, y + sy * 0.14, z + sz * 0.14], [xp - 0.02, sy * (PH + 0.004), z + sz * 0.148]], 0.0032, { rad: 6 }), 'gold');
      M.thrusters.push({ name, y, z, exit: [xp + 0.016, y, z], neut: add3(c0, ax, 0.056), neutDir: ax });
    }
    M.ies = { xp, zc, half: PH, xb };
  }

  // ============ 化学エンジン（20N級 12基。±X面のふちに6基ずつ、黒い断熱材を巻いた台に付く） ============
  {
    M.rcs = [];
    const bell = [[0.0085, 0], [0.0095, 0.006], [0.0155, 0.03], [0.023, 0.055], [0.0285, 0.076], [0.027, 0.076], [0.0215, 0.055], [0.014, 0.03], [0.008, 0.006], [0.0065, 0]];
    const unit = (base, dir, i) => {
      const d = nrm(dir), g = K.grp('rcs', base, [base[0] * 0.35 + d[0] * 0.25, base[1] * 0.5 + d[1] * 0.25, base[2] * 0.4 + d[2] * 0.25]);
      const [u, v] = basis(d), at = s => add3(base, d, s), U = [u.x, u.y, u.z], V = [v.x, v.y, v.z];
      K.add(g, uvBox(crinkle(K.box(0.092, 0.092, 0.092, base, { r: 0.012, n: 2, cell: 0.03 }), 0.45)), 'mliDark');
      K.add(g, K.cyl(0.022, 0.012, at(0.046), d, { seg: 18 }), 'steel');
      K.add(g, K.cyl(0.012, 0.022, at(0.056), d, { seg: 14 }), 'steel');
      K.add(g, K.lathe(bell, at(0.076), d, { smooth: true, seg: 32 }), 'nozzle');
      for (const sg of [1, -1]) K.add(g, triPlate(add3(at(0.046), U, sg * 0.03), add3(at(0.046), U, sg * 0.075), add3(at(0.115), U, sg * 0.06)), 'foil');   // 噴射よけの三角板
      K.add(g, K.tube([add3(at(0.05), V, 0.03), add3(at(0.02), V, 0.052), add3(at(-0.03), V, 0.049)], 0.0035, { rad: 6 }), 'steel');
      M.rcs.push({ pos: at(0.152), base: base.slice(), dir: d.slice(), sys: i % 2 ? 'B' : 'A' });
    };
    let i = 0;
    for (const sx of [1, -1]) for (const sy of [1, -1]) {
      unit([sx * (HX + 0.035), sy * (HY - 0.05), HZ + 0.04], [0, 0, 1], i++);          // 上向き
      unit([sx * (HX + 0.035), sy * (HY - 0.05), -HZ - 0.04], [0, 0, -1], i++);        // 下向き
      unit([sx * (HX + 0.05), sy * (HY - 0.045), 0.02], [sx * 0.22, sy, 0], i++);      // 横向き
    }
  }

  // ============ スタートラッカ（-X面の上部） ============
  { const y = 0.27, z = 0.27, g = K.grp('stt', [-HX, y, z], [-0.64, 0.1, 0.1], { skin: true });
    K.add(g, K.mliBox(0.1, 0.15, 0.15, [-HX - 0.035, y, z], { r: 0.012, cell: 0.03, amp: 0.6 }), 'mli');
    K.add(g, K.cyl(0.052, 0.02, [-HX - 0.08, y, z], [-1, 0, 0], { seg: 32 }), 'aluDark');
    K.add(g, K.lathe([[0.046, 0], [0.05, 0.02], [0.078, 0.17], [0.0755, 0.17], [0.0475, 0.022], [0.044, 0]], [-HX - 0.1, y, z], [-1, 0, 0], { seg: 40 }), 'black');
    for (const s of [0.05, 0.1]) K.add(g, K.pipe(0.046 + s * 0.165, 0.036 + s * 0.14, 0.002, [-HX - 0.1 - s, y, z], [-1, 0, 0], { seg: 32 }), 'black');
    K.add(g, K.cyl(0.032, 0.004, [-HX - 0.102, y, z], [-1, 0, 0], { seg: 28 }), 'glass');
    const gi = K.grp('stt', [-HX, y, z], [-0.64, 0.1, 0.1], { internal: true });
    for (const [dx, r] of [[-0.075, 0.03], [-0.06, 0.027], [-0.045, 0.024]]) K.add(gi, K.cyl(r, 0.006, [-HX + dx + 0.0, y, z], [-1, 0, 0], { seg: 20 }), 'glass');
    K.add(gi, K.pipe(0.034, 0.031, 0.06, [-HX - 0.02, y, z], [-1, 0, 0], { seg: 24, arc: PI * 1.4, phi0: PI * 0.3 }), 'aluDark');
    K.add(gi, K.box(0.004, 0.05, 0.05, [-HX - 0.012, y, z], { r: 0.001 }), 'pcb'); K.add(gi, K.box(0.003, 0.016, 0.016, [-HX - 0.015, y, z], { r: 0.0005 }), 'black');
    M.stt = { pos: [-HX - 0.27, y, z], dir: [-1, 0, 0] }; }

  // ============ 太陽センサ（±X面の上のすみ。黒い箱に白枠の窓） ============
  for (const [sx, sy] of [[1, 1], [-1, -1]]) {
    const p = [sx * (HX + 0.022), sy * (HY - 0.075), HZ - 0.125], g = K.grp('sas', p, [sx * 0.64, sy * 0.1, 0.1]);
    K.add(g, K.box(0.04, 0.062, 0.085, p), 'black');
    K.add(g, K.box(0.004, 0.042, 0.055, [p[0] + sx * 0.021, p[1], p[2]], { r: 0.001 }), 'white');
    K.add(g, K.box(0.004, 0.022, 0.03, [p[0] + sx * 0.0235, p[1], p[2]], { r: 0.001 }), 'glass');
  }

  // ============ 再突入カプセル（-X面の下寄り。後ろ半分は機体のくぼみに入り、断熱材をかぶった前面だけが外に出る） ============
  {
    const zc = -0.27, xa = -HX + 0.1, g = K.grp('capsule', [-HX, 0, zc], [-1.15, 0, 0], { name: 'capsule' });
    const gw = K.grp('capsule', [-HX, 0, zc], [-0.62, 0, 0], { parent: g, skin: true });          // 外側の断熱材。透かすと中の耐熱材と機器が見える
    const prof = [[0, 0], [0.085, 0], [0.15, 0.045], [0.196, 0.074], [0.202, 0.081]];
    for (let i = 1; i <= 6; i++) { const t = i / 6; prof.push([0.202 - 0.0606 * t, 0.081 + 0.0606 * t]); }
    for (let i = 1; i <= 9; i++) { const th = (45 - 45 * i / 9) * PI / 180; prof.push([0.2 * Math.sin(th), 0.2 * Math.cos(th) + 0.0002]); }
    K.add(gw, crinkle(K.lathe(prof, [xa, 0, zc], [-1, 0, 0], { smooth: true, seg: 72 }), 0.07), 'gfilm');
    const gs = K.grp('capsule', [-HX, 0, zc], [-0.57, 0, 0], { name: 'capMount' });
    K.add(gs, K.pipe(0.213, 0.188, 0.024, [-HX + 0.004, 0, zc], [-1, 0, 0], { seg: 72 }), 'chrome');
    K.add(gs, K.collar(0.224, [-HX - 0.004, 0, zc], [-1, 0, 0], { r: 0.014 }), 'mli');
    const gwell = K.grp('capsule', [-HX, 0, zc], [0, 0, 0], { parent: gs, skin: true });
    K.add(gwell, K.disc(0.1875, [-HX - 0.012, 0, zc], [-1, 0, 0], { seg: 56 }), 'black');          // カプセルが抜けたあとに見えるくぼみ
    circlePts([-HX - 0.02, 0, zc], [-1, 0, 0], 0.2, 3, 0.5).forEach(p => K.add(gs, K.box(0.02, 0.04, 0.03, p), 'aluDark'));
    K.bolts(gs, circlePts([-HX - 0.02, 0, zc], [-1, 0, 0], 0.2005, 12, 0.1), [-1, 0, 0]);
    K.add(gs, K.box(0.03, 0.04, 0.03, [-HX - 0.018, 0.2, zc + 0.2]), 'aluDark');
    K.add(gs, K.tube([[-HX - 0.02, 0.2, zc + 0.185], [-HX - 0.03, 0.165, zc + 0.15], [-HX - 0.03, 0.14, zc + 0.125]], 0.005, { rad: 6 }), 'kapton');
    M.capsule = { center: [xa - 0.1, 0, zc], axis: [-1, 0, 0], aft: [xa, 0, zc] };
  }

  // ============ サンプラーホーン（底面の-X寄り。上部はアルミの円すいと細い線の網、中部は布とばね、下部はアルミ） ============
  {
    const hx = -0.6, zt = -HZ, D = [0, 0, -1], UL = 0.36;
    const gu = K.grp('horn', [hx, 0, zt], [0, 0, -0.78], { name: 'hornUp' });
    K.add(gu, K.pipe(0.082, 0.036, 0.012, [hx, 0, zt], D, { seg: 48 }), 'chrome');
    K.bolts(gu, circlePts([hx, 0, zt - 0.012], D, 0.07, 8), D);
    K.add(gu, K.collar(0.09, [hx, 0, zt - 0.002], D, { r: 0.01 }), 'mli');
    K.add(gu, K.pipe(0.036, 0.034, UL, [hx, 0, zt - 0.012], D, { ro2: 0.066, ri2: 0.064, seg: 48 }), 'alu');
    for (let k = 0; k < 10; k++) for (const dirn of [1, -1]) {
      const a0 = k / 10 * PI * 2, pts = [];
      for (let j = 0; j <= 10; j++) { const t = j / 10, a = a0 + dirn * t * 2.4, r = 0.05 + t * 0.03; pts.push([hx + Math.cos(a) * r, Math.sin(a) * r, zt - 0.02 - t * (UL - 0.02)]); }
      K.add(gu, K.tube(pts, 0.0018, { rad: 4, seg: 20 }), 'steel');
    }
    for (let k = 0; k < 4; k++) { const a = (k + 0.5) / 4 * PI * 2; K.add(gu, K.cyl(0.004, UL - 0.01, [hx + Math.cos(a) * 0.088, Math.sin(a) * 0.088, zt - 0.012], D, { seg: 8 }), 'steel'); }
    K.add(gu, K.pipe(0.096, 0.064, 0.03, [hx, 0, zt - UL - 0.005], D, { seg: 48 }), 'black');
    // 弾丸の発射装置（3台。ホーンの付け根の外側から、中へ向けて斜めに付く）
    M.projectors = [];
    const gpj = K.grp('horn', [hx, 0, zt], [0, 0, 0], { parent: gu, skin: true }), gpi = K.grp('horn', [hx, 0, zt], [0, 0, 0], { parent: gu, internal: true });
    for (const deg of [90, 210, 330]) {
      const an = deg * PI / 180, c = Math.cos(an), s = Math.sin(an), p0 = [hx + c * 0.105, s * 0.105, zt - 0.03], d = [-c * 0.62, -s * 0.62, -0.78];
      K.add(gu, K.box(0.034, 0.034, 0.03, [hx + c * 0.108, s * 0.108, zt - 0.014]), 'aluDark');
      K.add(gu, K.cyl(0.013, 0.03, [hx + c * 0.118, s * 0.118, zt - 0.014], [c * 0.62, s * 0.62, 0.78], { seg: 12 }), 'aluDark');
      K.add(gpj, K.cyl(0.0085, 0.085, p0, d, { seg: 12 }), 'steel');
      const dn = nrm(d), at = (t) => [p0[0] + dn[0] * t, p0[1] + dn[1] * t, p0[2] + dn[2] * t];
      K.add(gpi, K.sph(0.005, at(0.03), { seg: 10 }), 'ti');                                         // タンタルの弾丸 5g
      K.add(gpi, K.cyl(0.0062, 0.012, at(0.012), d, { seg: 10 }), 'white');                          // 弾丸を押す台
      K.add(gpi, K.cyl(0.0062, 0.014, at(-0.004), d, { seg: 10 }), 'orange');                        // 火薬
      M.projectors.push({ pos: p0, dir: d });
    }
    const L = 0.4, zm = zt - UL - 0.035, gm = K.grp('horn', [hx, 0, zm], [0, 0, -1.1], { name: 'hornMid' });
    const prof = [], n = 10;
    for (let i = 0; i <= n * 4; i++) { const t = i / (n * 4), c = Math.cos(i / 4 * PI * 2); prof.push([0.071 + 0.011 * t + 0.0035 * c, t * L]); }
    for (let i = n * 4; i >= 0; i--) { const t = i / (n * 4), c = Math.cos(i / 4 * PI * 2); prof.push([0.069 + 0.011 * t + 0.0035 * c, t * L]); }
    K.add(gm, K.lathe(prof, [hx, 0, zm], D, { smooth: true, seg: 48 }), 'hcloth');
    const hp = []; for (let i = 0; i <= 130; i++) { const t = i / 130, a = t * PI * 2 * 6.5, r = 0.0775 + 0.011 * t; hp.push([hx + Math.cos(a) * r, Math.sin(a) * r, zm - t * L]); }
    K.add(gm, K.tube(hp, 0.0028, { rad: 5, seg: 260, tension: 0.5 }), 'copper');
    const zl = zm - L, gl = K.grp('horn', [hx, 0, zl], [0, 0, -1.42], { name: 'hornLow' });
    K.add(gl, K.pipe(0.0865, 0.0805, 0.014, [hx, 0, zl + 0.004], D, { seg: 48 }), 'black');
    K.add(gl, K.lathe([[0.0815, 0], [0.084, 0.02], [0.1, 0.11], [0.1, 0.16], [0.09, 0.205], [0.0875, 0.205], [0.0975, 0.16], [0.0975, 0.11], [0.0815, 0.022], [0.079, 0]], [hx, 0, zl], D, { seg: 56 }), 'alu');
    K.add(gl, K.torus(0.0905, 0.004, [hx, 0, zl - 0.203], D, { seg: 56 }), 'chrome');
    K.add(gl, K.lathe([[0.1, 0], [0.205, 0.07], [0.205, 0.074], [0.1, 0.005]], [hx, 0, zl - 0.085], D, { seg: 56 }), 'guard');     // ダストガード
    for (let k = 0; k < 16; k++) { const a = k / 16 * PI * 2, c = Math.cos(a), s = Math.sin(a); K.add(gl, K.tube([[hx + c * 0.101, s * 0.101, zl - 0.084], [hx + c * 0.206, s * 0.206, zl - 0.154]], 0.0022, { seg: 1, rad: 5 }), 'steel'); }
    for (let k = 0; k < 4; k++) { const a = (k + 0.5) / 4 * PI * 2, c = Math.cos(a), s = Math.sin(a);
      K.add(gl, triPlate([hx + c * 0.15, s * 0.15, zl - 0.116], [hx + c * 0.2, s * 0.2, zl - 0.15], [hx + c * 0.218, s * 0.218, zl - 0.07]), 'black'); }
    M.horn = { x: hx, y: 0, top: zt, midTop: zm, midLen: L, tip: zl - 0.205, r: 0.09 };
  }

  // ============ ロケット結合リングと、その内側の機器 ============
  {
    const D = [0, 0, -1], Rr = 0.39, g = K.grp('ring', [0, 0, -HZ], [0, 0, -0.72]);
    const wall = (r, rev) => { const p = [0, 0.0215, 0.043, 0.0645, 0.086].map(h => [r, h]); return crinkle(K.lathe(rev ? p.reverse() : p, [0, 0, -HZ + 0.002], D, { smooth: true, seg: 96 }), 0.6); };
    K.add(g, wall(Rr + 0.013, false), 'mli'); K.add(g, wall(Rr - 0.008, true), 'mli');
    K.add(g, K.pipe(Rr + 0.03, Rr - 0.014, 0.007, [0, 0, -HZ - 0.001], D, { seg: 96 }), 'alu');
    K.add(g, K.pipe(Rr + 0.022, Rr - 0.022, 0.014, [0, 0, -HZ - 0.084], D, { seg: 96 }), 'chrome');
    K.bolts(g, circlePts([0, 0, -HZ - 0.098], D, Rr, 36), D, { r: 0.0045 });
    K.bolts(g, circlePts([0, 0, -HZ - 0.008], D, Rr + 0.022, 24), D, { r: 0.004 });
    // 中央の断熱材をかぶった筒と、はしご形の電線受け
    K.add(g, crinkle(K.lathe([[0.13, 0], [0.13, 0.045], [0.13, 0.09], [0.13, 0.132], [0.122, 0.146], [0.1, 0.15], [0.05, 0.15], [0, 0.15]], [0.03, 0.04, -HZ + 0.002], D, { smooth: true, seg: 48 }), 0.7), 'mli');
    for (const dy of [-0.022, 0.022]) K.add(g, K.box(0.2, 0.006, 0.012, [0.265, 0.04 + dy, -HZ - 0.03], { r: 0.002 }), 'alu');
    for (let k = 0; k < 9; k++) K.add(g, K.box(0.006, 0.05, 0.006, [0.175 + k * 0.0225, 0.04, -HZ - 0.03], { r: 0.001 }), 'alu');
    for (const x of [0.19, 0.34]) K.add(g, K.cyl(0.006, 0.028, [x, 0.04, -HZ], D, { seg: 8 }), 'alu');
    // ターゲットマーカ3個（1個ずつ切り離せるよう別グループ）
    M.tm = [];
    [-104, -128, -152].forEach((deg, k) => {
      const a = deg * PI / 180, x = Math.cos(a) * 0.28, y = Math.sin(a) * 0.28;
      const gh = K.grp('tm', [x, y, -HZ], [0, 0, -0.95], { name: 'tmHold' + k });
      K.add(gh, K.cyl(0.03, 0.03, [x, y, -HZ], D, { seg: 20 }), 'aluDark');
      K.add(gh, K.pipe(0.05, 0.046, 0.03, [x, y, -HZ - 0.022], D, { seg: 28 }), 'alu');
      const gb = K.grp('tm', [x, y, -HZ - 0.085], [0, 0, -1.2], { name: 'tm' + k });
      const gsh = K.grp('tm', [x, y, -HZ - 0.085], [0, 0, 0], { parent: gb, skin: true });
      K.add(gsh, K.sph(0.05, [x, y, -HZ - 0.085], { seg: 28 }), 'retro');
      const gbd = K.grp('tm', [x, y, -HZ - 0.085], [0, 0, 0], { parent: gb, internal: true });        // 中の粒（勢いを吸い取る）
      for (let b = 0; b < 46; b++) { const u = R() * 2 - 1, a2 = R() * PI * 2, rr = 0.04 * Math.cbrt(R()), q2 = Math.sqrt(1 - u * u); K.add(gbd, K.sph(0.0052, [x + rr * q2 * Math.cos(a2), y + rr * q2 * Math.sin(a2), -HZ - 0.085 + rr * u], { seg: 6 }), 'bead'); }
      for (const q of [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]]) { const l = Math.sqrt(3); K.add(gb, K.cyl(0.0035, 0.03, [x + q[0] / l * 0.046, y + q[1] / l * 0.046, -HZ - 0.085 + q[2] / l * 0.046], q, { seg: 10 }), 'alu'); }   // 4本のアルミの棒
      for (const [dz, rr2] of [[0.031, 0.0395], [-0.027, 0.0424]]) K.add(gsh, K.torus(rr2, 0.0011, [x, y, -HZ - 0.085 + dz], [0, 0, 1], { seg: 36, tub: 5 }), 'white');   // 布を縫い合わせた継ぎ目
      M.tm.push({ idx: gb.idx, pos: [x, y, -HZ - 0.085] });
    });
    // フラッシュランプ
    { const x = 0.2, y = -0.17, gf = K.grp('fla', [x, y, -HZ], [0.1, -0.15, -0.95]);
      K.add(gf, K.box(0.085, 0.07, 0.045, [x, y, -HZ - 0.022]), 'black');
      K.add(gf, K.lathe([[0.012, 0], [0.03, 0.02], [0.032, 0.02], [0.014, -0.003]], [x, y, -HZ - 0.045], D, { seg: 24 }), 'alu');
      K.add(gf, K.cyl(0.028, 0.003, [x, y, -HZ - 0.064], D, { seg: 24 }), 'glass');
      M.fla = [x, y, -HZ - 0.07]; }
    // 広角カメラ ONC-W1
    { const x = 0.2, y = 0.2, gw = K.grp('oncw', [x, y, -HZ], [0.1, 0.15, -0.95]);
      K.add(gw, K.box(0.07, 0.07, 0.05, [x, y, -HZ - 0.025]), 'black');
      K.add(gw, K.cyl(0.026, 0.035, [x, y, -HZ - 0.05], D, { seg: 24 }), 'aluDark');
      K.add(gw, K.pipe(0.034, 0.027, 0.02, [x, y, -HZ - 0.08], D, { seg: 24, ro2: 0.04, ri2: 0.034 }), 'black');
      K.add(gw, K.sph(0.021, [x, y, -HZ - 0.075], { seg: 18, th: PI / 2, axis: D, scale: [1, 0.45, 1] }), 'glass');
      M.oncw1 = [x, y, -HZ - 0.1]; }
    // 低利得アンテナ（底面側）
    { const x = -0.07, y = 0.27, ga = K.grp('lga', [x, y, -HZ], [-0.1, 0.1, -0.95]);
      K.add(ga, K.cyl(0.03, 0.035, [x, y, -HZ], D, { seg: 24 }), 'white');
      K.add(ga, K.sph(0.03, [x, y, -HZ - 0.035], { seg: 20, th: PI / 2, axis: D, scale: [1, 0.6, 1] }), 'white'); }
  }

  // ============ レーザー高度計 LIDAR（底面。断熱材をかぶった筒の中に受信望遠鏡） ============
  { const x = -0.45, y = 0.33, D = [0, 0, -1], g = K.grp('lidar', [x, y, -HZ], [-0.25, 0.4, -0.8], { skin: true });
    K.add(g, K.mliBox(0.23, 0.2, 0.105, [x + 0.02, y, -HZ - 0.052], { r: 0.014, cell: 0.03, amp: 0.8 }), 'mli');
    K.add(g, crinkle(K.lathe([[0.076, 0], [0.076, 0.03], [0.074, 0.062], [0.066, 0.066]], [x - 0.012, y, -HZ - 0.1], D, { smooth: true, seg: 40 }), 0.6), 'mli');
    K.add(g, K.mliBox(0.052, 0.052, 0.05, [x + 0.075, y + 0.02, -HZ - 0.122], { r: 0.008, cell: 0.02, amp: 0.6 }), 'mli');
    for (const [u, v, w2] of [[0.1, 0.101, 0.03], [-0.03, 0.101, 0.025], [0.136, 0.04, 0.03], [0.136, -0.05, 0.022]]) K.add(g, K.box(v > 0.1 ? w2 : 0.004, v > 0.1 ? 0.004 : w2, 0.03, [x + u, y + v, -HZ - 0.04 - w2], { r: 0.0005 }), 'tape');   // 断熱材を留めるテープ
    K.add(g, K.pipe(0.064, 0.056, 0.035, [x - 0.012, y, -HZ - 0.138], D, { seg: 36 }), 'black');
    K.add(g, K.disc(0.056, [x - 0.012, y, -HZ - 0.146], D), 'mirror');
    K.add(g, K.mliBox(0.03, 0.03, 0.03, [x - 0.012, y, -HZ - 0.166], { r: 0.005, cell: 0.015, amp: 0.5 }), 'mli');
    for (let k = 0; k < 4; k++) { const a = k / 4 * PI * 2 + PI / 4; K.add(g, K.box(0.044, 0.003, 0.012, [x - 0.012 + Math.cos(a) * 0.036, y + Math.sin(a) * 0.036, -HZ - 0.168], { rot: [0, 0, a], r: 0.001 }), 'black'); }
    K.add(g, K.pipe(0.019, 0.013, 0.035, [x + 0.075, y + 0.02, -HZ - 0.138], D, { seg: 20 }), 'black');
    K.add(g, K.cyl(0.013, 0.003, [x + 0.075, y + 0.02, -HZ - 0.158], D, { seg: 16 }), 'glass');
    const gi = K.grp('lidar', [x, y, -HZ], [-0.25, 0.4, -0.8], { internal: true });        // 中身：受信望遠鏡の主鏡と検出器、レーザーの発振部
    K.add(gi, K.lathe([[0.012, 0.012], [0.03, 0.004], [0.054, 0]], [x - 0.012, y, -HZ - 0.07], D, { smooth: true, seg: 32 }), 'mirror');
    K.add(gi, K.cyl(0.011, 0.03, [x - 0.012, y, -HZ - 0.035], D, { seg: 14 }), 'aluDark');
    K.add(gi, K.box(0.03, 0.03, 0.02, [x - 0.012, y, -HZ - 0.025]), 'pcb');
    K.add(gi, K.box(0.05, 0.034, 0.09, [x + 0.07, y + 0.02, -HZ - 0.075], { r: 0.003 }), 'aluDark');
    K.add(gi, K.cyl(0.006, 0.06, [x + 0.07, y + 0.02, -HZ - 0.045], D, { seg: 10 }), 'redwire');
    M.lidar = { tx: [x + 0.075, y + 0.02, -HZ - 0.178], rx: [x - 0.012, y, -HZ - 0.178] }; }

  // ============ 望遠カメラ ONC-T（AMICA。黒い板の上の銀色の鏡筒） ============
  { const x = -0.725, y = -0.22, D = [0, 0, -1], g = K.grp('amica', [x, y, -HZ], [-0.5, -0.05, -0.8]);
    K.add(g, K.box(0.13, 0.16, 0.02, [x, y, -HZ - 0.01]), 'black');
    const gk = K.grp('amica', [x, y, -HZ], [0, 0, 0], { parent: g, skin: true });
    K.add(gk, crinkle(K.lathe([[0.074, 0], [0.074, 0.025], [0.072, 0.05], [0.05, 0.055]], [x + 0.022, y, -HZ - 0.02], D, { smooth: true, seg: 44 }), 0.6), 'mli');
    K.add(gk, K.mliBox(0.08, 0.085, 0.06, [x, y, -HZ - 0.103], { r: 0.01, cell: 0.025, amp: 0.7 }), 'mli');
    K.add(g, K.pipe(0.034, 0.028, 0.03, [x, y, -HZ - 0.13], D, { seg: 32 }), 'black');
    K.add(g, K.sph(0.028, [x, y, -HZ - 0.136], { seg: 20, th: PI / 2, axis: D, scale: [1, 0.3, 1] }), 'glass');
    K.add(g, K.box(0.05, 0.02, 0.016, [x + 0.05, y - 0.06, -HZ - 0.03], { r: 0.002 }), 'alu');
    const gi = K.grp('amica', [x, y, -HZ + 0.04], [-0.5, -0.05, -0.5], { internal: true });   // 中身：色フィルターの回転板と撮像素子
    K.add(gi, K.cyl(0.05, 0.004, [x + 0.022, y, -HZ - 0.044], [0, 0, 1], { seg: 32 }), 'aluDark');
    const fc = ['fR', 'fG', 'fB', 'fY', 'fR', 'fG', 'fB', 'glass'];
    for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; K.add(gi, K.cyl(0.011, 0.0052, [x + 0.022 + Math.cos(a) * 0.034, y + Math.sin(a) * 0.034, -HZ - 0.0444], [0, 0, 1], { seg: 14, ch: 0.0004 }), fc[k]); }
    K.add(gi, K.cyl(0.006, 0.03, [x + 0.022, y, -HZ - 0.04], [0, 0, 1], { seg: 10 }), 'steel');
    K.add(gi, K.lathe([[0.03, 0], [0.03, 0.05]], [x, y, -HZ - 0.075], D, { seg: 24 }), 'chrome');
    for (const dz of [0.085, 0.105]) K.add(gi, K.cyl(0.027, 0.004, [x, y, -HZ - dz], D, { seg: 24 }), 'glass');
    K.add(gi, K.box(0.05, 0.05, 0.02, [x - 0.012, y, -HZ + 0.055], { r: 0.003 }), 'aluDark'); K.add(gi, K.box(0.03, 0.03, 0.003, [x - 0.012, y, -HZ + 0.043], { r: 0.0005 }), 'pcb');
    K.add(gi, K.pipe(0.03, 0.027, 0.03, [x - 0.012, y, -HZ + 0.002], [0, 0, 1], { seg: 24 }), 'black');
    M.amica = [x, y, -HZ - 0.2]; }

  // ============ 蛍光X線スペクトロメータ XRS（底面の+X寄り。白い放熱板が2枚並ぶ） ============
  { const x = 0.6, y = -0.24, g = K.grp('xrs', [x, y, -HZ], [0.4, -0.3, -0.8]);
    const gs = K.grp('xrs', [x, y, -HZ], [0, 0, 0], { parent: g, skin: true });
    K.add(gs, K.mliBox(0.2, 0.17, 0.1, [x, y, -HZ - 0.045], { r: 0.012, cell: 0.03, amp: 0.7 }), 'mli');
    const gi = K.grp('xrs', [x, y, -HZ], [0, 0, 0], { parent: g, internal: true });                // 中身：X線を受けるCCDが4枚と、それを冷やす銅の板
    K.add(gi, K.box(0.13, 0.1, 0.004, [x, y, -HZ - 0.07], { r: 0.001 }), 'pcb');
    for (const [u, v] of [[-0.03, -0.024], [0.03, -0.024], [-0.03, 0.024], [0.03, 0.024]]) { K.add(gi, K.box(0.05, 0.04, 0.004, [x + u, y + v, -HZ - 0.074], { r: 0.001 }), 'black'); K.add(gi, K.box(0.03, 0.03, 0.0012, [x + u, y + v, -HZ - 0.0765], { r: 0.0004 }), 'roverCell'); }
    K.add(gi, K.box(0.14, 0.11, 0.006, [x, y, -HZ - 0.063], { r: 0.001 }), 'copper');
    K.add(gi, K.box(0.03, 0.012, 0.05, [x + 0.075, y + 0.03, -HZ - 0.035], { r: 0.002 }), 'copper');
    K.add(gi, K.box(0.1, 0.08, 0.03, [x - 0.02, y, -HZ - 0.03], { r: 0.003 }), 'ebox');
    K.add(gs, K.box(0.15, 0.12, 0.014, [x, y, -HZ - 0.1], { r: 0.003 }), 'aluDark');
    K.add(g, K.box(0.16, 0.14, 0.032, [x, y, -HZ - 0.122], { r: 0.003 }), 'ebox');
    for (let i = 0; i < 7; i++) for (const sv of [-1, 1]) { K.add(g, K.cyl(0.0035, 0.004, [x - 0.069 + i * 0.023, y + sv * 0.063, -HZ - 0.139], [0, 0, -1], { seg: 8 }), 'bolt'); if (i > 0 && i < 6) K.add(g, K.cyl(0.0035, 0.004, [x + sv * 0.073, y - 0.058 + i * 0.0193, -HZ - 0.139], [0, 0, -1], { seg: 8 }), 'bolt'); }
    K.add(g, K.box(0.04, 0.036, 0.002, [x - 0.03, y + 0.034, -HZ - 0.1385], { r: 0.0005 }), 'xwin');                                            // X線を通す窓
    for (const su of [-1, 1]) for (const sv of [-1, 1]) K.add(g, K.box(0.004, 0.05, 0.07, [x + su * 0.104, y + sv * 0.05, -HZ - 0.04], { r: 0.001, rot: [0, 0, su * sv * 0.5] }), 'alu');
    for (const yy of [-0.06, 0.065]) { K.add(g, K.box(0.11, 0.11, 0.008, [0.715, yy, -HZ - 0.007], { r: 0.002 }), 'white'); K.add(g, K.box(0.124, 0.124, 0.004, [0.715, yy, -HZ - 0.002], { r: 0.001 }), 'alu'); } }

  // ============ 近距離レーザー距離計 LRF-S1（4ビーム）と S2（ホーンの縮みを測る） ============
  { const x = 0.59, y = 0.25, g = K.grp('lrf', [x, y, -HZ], [0.4, 0.3, -0.8]);
    K.add(g, K.mliBox(0.12, 0.15, 0.04, [x, y, -HZ - 0.018], { r: 0.01, cell: 0.03, amp: 0.5 }), 'mli');
    K.add(g, K.box(0.07, 0.1, 0.014, [x, y, -HZ - 0.042]), 'black');
    M.lrf = [];
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const p = [x + sx * 0.022, y + sy * 0.035, -HZ - 0.044], dd = [sx * 0.24, sy * 0.24, -1], l = Math.hypot(...dd);
      K.add(g, K.cyl(0.011, 0.034, p, dd, { seg: 14 }), 'aluDark');
      K.add(g, K.cyl(0.008, 0.003, add3(p, dd, 0.033 / l), dd, { seg: 12 }), 'glass');
      M.lrf.push({ pos: add3(p, dd, 0.04 / l), dir: dd });
    }
    const q = [-0.5, 0.13], g2 = K.grp('lrf', [q[0], q[1], -HZ], [-0.05, 0.2, -0.8]);
    K.add(g2, K.box(0.07, 0.06, 0.045, [q[0], q[1], -HZ - 0.022], { rot: [0.4, 0, 0.6] }), 'black');
    K.add(g2, K.cyl(0.012, 0.022, [q[0] - 0.012, q[1] - 0.016, -HZ - 0.042], [-0.3, -0.4, -0.87], { seg: 14 }), 'aluDark');
    K.add(g2, K.cyl(0.009, 0.003, [q[0] - 0.019, q[1] - 0.025, -HZ - 0.062], [-0.3, -0.4, -0.87], { seg: 12 }), 'glass');
    M.lrf2 = { pos: [q[0] - 0.02, q[1] - 0.027, -HZ - 0.066], dir: [-0.09, -0.12, -1] }; }

  // ============ ミネルバ（底面の-Y寄り。断熱材を巻いた箱が上下2つに分かれ、中にローバが入る。箱と中身は実物の写真に合わせた） ============
  { const x = -0.5, y = -0.38, W = 0.168, HB = 0.07, HC = 0.085, zr = -HZ - 0.078;
    const openBox = (g, c, h, sg) => {          // sg=+1: 上が開いた箱、-1: 下が開いた箱。外は断熱材、内側は黒
      const t = 0.006, wall = (sz, p) => K.add(g, uvBox(crinkle(K.box(sz[0], sz[1], sz[2], p, { r: 0.0028, cell: 0.03 }), 0.45)), 'mli');
      wall([W, W, t], [c[0], c[1], c[2] - sg * (h / 2 - t / 2)]);
      for (const q of [1, -1]) { wall([t, W, h], [c[0] + q * (W / 2 - t / 2), c[1], c[2]]); wall([W - 2 * t, t, h], [c[0], c[1] + q * (W / 2 - t / 2), c[2]]); }
      K.add(g, K.box(W - 2 * t - 0.002, W - 2 * t - 0.002, 0.002, [c[0], c[1], c[2] - sg * (h / 2 - t - 0.001)], { r: 0.0005 }), 'black');
      for (const q of [1, -1]) { K.add(g, K.box(0.002, W - 2 * t - 0.002, h - t, [c[0] + q * (W / 2 - t - 0.001), c[1], c[2] + sg * t / 2], { r: 0.0005 }), 'black'); K.add(g, K.box(W - 2 * t - 0.006, 0.002, h - t, [c[0], c[1] + q * (W / 2 - t - 0.001), c[2] + sg * t / 2], { r: 0.0005 }), 'black'); }
    };
    const g = K.grp('minerva', [x, y, -HZ], [-0.25, -0.45, -0.8], { name: 'minervaCase', skin: true });
    openBox(g, [x, y, -HZ - HB / 2], HB, -1);
    K.add(g, K.cyl(0.0016, 0.13, [x - W / 2 + 0.01, y - W / 2 - 0.004, -HZ - 0.02], [-0.5, -0.55, -0.67], { seg: 6 }), 'steel');          // ローバと交信するアンテナ
    K.add(g, K.mliBox(0.05, 0.04, 0.04, [x - W / 2 - 0.02, y + 0.03, -HZ - 0.03], { r: 0.008, cell: 0.02, amp: 0.5 }), 'mli');       // 切り離しの装置
    const gl = K.grp('minerva', [x, y, -HZ - HB - HC / 2], [0, 0, -0.62], { parent: g, name: 'minervaLid', skin: true });
    openBox(gl, [x, y, -HZ - HB - HC / 2], HC, 1);
    // ローバ：正16角柱。側面と上下に太陽電池、ふちに16本のピン
    const gr = K.grp('minerva', [x, y, zr], [-0.25, -0.45, -1.12], { name: 'rover', inner: true });
    const gsh = K.grp('minerva', [x, y, zr], [0, -0.26, 0], { parent: gr, skin: true, inner: true });
    K.add(gsh, flat(K.pipe(0.06, 0.0575, 0.1, [x, y, zr - 0.05], [0, 0, 1], { seg: 16 })), 'kapton');
    for (const q of [1, -1]) K.add(gsh, flat(K.cyl(0.06, 0.003, [x, y, zr + q * 0.05], [0, 0, q], { seg: 16, ch: 0.0006 })), 'guard');
    const rr = 0.06 * Math.cos(PI / 16) + 0.0007;
    for (let k = 0; k < 16; k++) {
      const a = (k + 0.5) / 16 * PI * 2, c = Math.cos(a), sn = Math.sin(a);
      for (const dz of [-0.031, 0, 0.031]) K.add(gsh, K.box(0.0185, 0.0012, 0.0285, [x + c * rr, y + sn * rr, zr + dz], { axis: [c, sn, 0], r: 0.0004 }), 'roverCell');
      { const q = k % 2 ? -1 : 1; K.add(gr, K.cyl(0.0012, 0.032, [x + c * 0.057, y + sn * 0.057, zr + q * 0.049], [c * 0.72, sn * 0.72, q * 0.7], { seg: 5 }), 'pin'); }      // ピンは上下合わせて16本
    }
    for (const q of [1, -1]) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { if ((i === 0 || i === 3) && (j === 0 || j === 3)) continue; K.add(gsh, K.box(0.0195, 0.0195, 0.001, [x + (i - 1.5) * 0.021, y + (j - 1.5) * 0.021, zr + q * 0.0538], { r: 0.0004 }), 'roverCell'); }
    for (const q of [1, -1]) {                                                                                     // 上下の輪形アンテナ（短い柱で浮かせる）
      K.add(gr, K.torus(0.056, 0.0013, [x, y, zr + q * 0.066], [0, 0, 1], { seg: 48, tub: 6 }), 'greenwire');
      for (let k = 0; k < 6; k++) { const a = (k + 0.5) / 6 * PI * 2; K.add(gr, K.cyl(0.0012, 0.015, [x + Math.cos(a) * 0.056, y + Math.sin(a) * 0.056, zr + q * 0.0515], [0, 0, q], { seg: 6 }), 'pin'); }
    }
    // ローバの中：上下の板、回転台、はずみ車とモーター、カメラ3台、電気をためるコンデンサ、計算機の基板
    const gi = K.grp('minerva', [x, y, zr], [0, 0, 0], { parent: gr, internal: true });
    for (const q of [1, -1]) K.add(gi, K.cyl(0.054, 0.003, [x, y, zr + q * 0.041], [0, 0, q], { seg: 32 }), 'alu');
    for (const [u, v] of [[0.04, 0.03], [-0.04, 0.03], [0.04, -0.03], [-0.04, -0.03]]) K.add(gi, K.cyl(0.0028, 0.08, [x + u, y + v, zr - 0.04], [0, 0, 1], { seg: 8 }), 'alu');
    K.add(gi, K.cyl(0.022, 0.008, [x, y, zr - 0.038], [0, 0, 1], { seg: 24 }), 'aluDark');                         // 回転台
    for (const q of [1, -1]) K.add(gi, K.box(0.004, 0.012, 0.04, [x + q * 0.012, y, zr - 0.012], { r: 0.001 }), 'alu');
    { const sh = new THREE.Shape(); sh.absarc(0, 0, 0.03, 0, PI * 2, false);
      for (let k = 0; k < 4; k++) { const a = k / 4 * PI * 2 + PI / 4, h = new THREE.Path(); h.absarc(Math.cos(a) * 0.017, Math.sin(a) * 0.017, 0.0085, 0, PI * 2, true); sh.holes.push(h); }
      const fw = new THREE.ExtrudeGeometry(sh, { depth: 0.005, bevelEnabled: false, curveSegments: 14 }); fw.translate(0, 0, -0.0025); fw.rotateX(PI / 2); fw.translate(x, y + 0.008, zr - 0.004);
      K.add(gi, uvBox(fw), 'chrome'); }                                                                              // はずみ車（4つ穴の円板）
    K.add(gi, K.cyl(0.004, 0.012, [x, y + 0.002, zr - 0.004], [0, 1, 0], { seg: 10 }), 'steel');
    K.add(gi, K.cyl(0.011, 0.03, [x, y - 0.03, zr - 0.004], [0, 1, 0], { seg: 16 }), 'steel');                      // モーター
    for (const q of [1, -1]) {                                                                                     // 2台並んだカメラ（近くを立体的に見る）
      K.add(gi, K.box(0.018, 0.02, 0.018, [x + q * 0.038, y + 0.022, zr - 0.006], { r: 0.002 }), 'black');
      K.add(gi, K.cyl(0.006, 0.008, [x + q * 0.038, y + 0.032, zr - 0.006], [0, 1, 0], { seg: 12 }), 'black');
      K.add(gi, K.cyl(0.0042, 0.001, [x + q * 0.038, y + 0.0402, zr - 0.006], [0, 1, 0], { seg: 10 }), 'glass');
      K.add(gi, K.cyl(0.013, 0.042, [x + q * 0.036, y - 0.022, zr - 0.036], [0, 0, 1], { seg: 18 }), 'chrome');     // 電気二重層コンデンサ
    }
    K.add(gi, K.box(0.018, 0.02, 0.018, [x, y - 0.046, zr + 0.012], { r: 0.002 }), 'black');                       // 反対向きのカメラ（遠くを見る）
    K.add(gi, K.cyl(0.006, 0.006, [x, y - 0.056, zr + 0.012], [0, -1, 0], { seg: 12 }), 'black');
    K.add(gi, K.cyl(0.05, 0.0016, [x, y, zr + 0.03], [0, 0, 1], { seg: 28 }), 'pcb');                               // 計算機の基板
    for (const [u, v, w, d] of [[0.012, 0.01, 0.016, 0.016], [-0.02, -0.012, 0.012, 0.02], [0.02, -0.022, 0.01, 0.008], [-0.016, 0.024, 0.02, 0.008]]) K.add(gi, K.box(w, d, 0.003, [x + u, y + v, zr + 0.0335], { r: 0.0005 }), 'black');
    K.add(gi, K.tube([[x + 0.02, y + 0.03, zr + 0.029], [x + 0.03, y + 0.02, zr + 0.012], [x + 0.036, y + 0.022, zr + 0.004]], 0.0009, { rad: 4, seg: 8 }), 'redwire');
    K.add(gi, K.tube([[x - 0.01, y - 0.02, zr + 0.029], [x - 0.006, y - 0.03, zr + 0.016], [x, y - 0.03, zr + 0.008]], 0.0009, { rad: 4, seg: 8 }), 'redwire');
    K.add(gi, K.tube([[x - 0.02, y + 0.03, zr + 0.029], [x - 0.034, y + 0.012, zr + 0.01], [x - 0.036, y - 0.02, zr + 0.006]], 0.0009, { rad: 4, seg: 8 }), 'black');
    M.minerva = { rover: gr.idx, lid: gl.idx, pos: [x, y, zr] }; }

  // ============ 近赤外線分光器 NIRS（底面の-X側） ============
  { const x = -0.71, y = 0.27, g = K.grp('nirs', [x, y, -HZ], [-0.5, 0.3, -0.8]);
    const gs = K.grp('nirs', [x, y, -HZ], [0, 0, 0], { parent: g, skin: true });
    K.add(gs, K.mliBox(0.13, 0.17, 0.1, [x, y, -HZ - 0.048], { r: 0.012, cell: 0.03, amp: 0.7 }), 'mli');
    const gi = K.grp('nirs', [x, y, -HZ], [0, 0, 0], { parent: g, internal: true });               // 中身：集光レンズ、折り返しの鏡、回折格子、64個並んだ検出器
    K.add(gi, K.box(0.11, 0.15, 0.004, [x, y, -HZ - 0.006], { r: 0.001 }), 'aluDark');
    K.add(gi, K.cyl(0.027, 0.006, [x, y - 0.02, -HZ - 0.078], [0, 0, 1], { seg: 24 }), 'glass');
    K.add(gi, K.pipe(0.03, 0.028, 0.04, [x, y - 0.02, -HZ - 0.09], [0, 0, 1], { seg: 24, arc: PI * 1.4, phi0: PI * 0.8 }), 'black');
    K.add(gi, K.box(0.04, 0.003, 0.04, [x, y - 0.02, -HZ - 0.03], { rot: [PI / 4, 0, 0], r: 0.0005 }), 'mirror');
    K.add(gi, K.box(0.04, 0.004, 0.036, [x, y + 0.055, -HZ - 0.032], { rot: [-0.5, 0, 0], r: 0.0005 }), 'gold');          // 回折格子
    K.add(gi, K.box(0.05, 0.03, 0.004, [x, y + 0.02, -HZ - 0.074], { r: 0.0005 }), 'pcb');
    K.add(gi, K.box(0.04, 0.006, 0.003, [x, y + 0.02, -HZ - 0.071], { r: 0.0005 }), 'black');                           // 検出器
    K.add(gi, K.box(0.012, 0.03, 0.05, [x - 0.05, y + 0.03, -HZ - 0.05], { r: 0.002 }), 'copper');                       // 検出器を冷やす
    K.add(gi, K.box(0.004, 0.16, 0.085, [x + 0.058, y, -HZ - 0.047], { r: 0.001 }), 'composite'); K.add(gi, K.box(0.118, 0.004, 0.085, [x, y + 0.08, -HZ - 0.047], { r: 0.001 }), 'composite');   // 黒い箱の壁（2面だけ残して中を見せる）
    for (const [v, w2] of [[-0.06, -0.075], [0.06, -0.075], [-0.06, -0.02], [0.06, -0.02]]) K.add(gi, K.box(0.002, 0.028, 0.018, [x + 0.0605, y + v, -HZ + w2], { r: 0.0004 }), 'white');
    K.add(gi, K.cyl(0.016, 0.002, [x + 0.061, y, -HZ - 0.05], [1, 0, 0], { seg: 20 }), 'alu');
    K.add(g, K.pipe(0.036, 0.03, 0.03, [x, y - 0.02, -HZ - 0.092], [0, 0, -1], { seg: 28 }), 'black');
    K.add(g, K.cyl(0.03, 0.003, [x, y - 0.02, -HZ - 0.1], [0, 0, -1], { seg: 24 }), 'glass');
    K.add(g, K.box(0.006, 0.15, 0.09, [x - 0.072, y, -HZ - 0.05], { r: 0.002 }), 'osr'); }

  // ============ 広角カメラ ONC-W2（-Y側面） ============
  { const x = 0.19, z = -0.225, g = K.grp('oncw', [x, -HY, z], [0.1, -0.66, -0.1]);
    K.add(g, K.box(0.08, 0.03, 0.08, [x, -HY - 0.015, z]), 'black');
    K.add(g, K.cyl(0.026, 0.03, [x, -HY - 0.03, z], [0, -1, 0], { seg: 24 }), 'aluDark');
    K.add(g, K.pipe(0.032, 0.026, 0.018, [x, -HY - 0.055, z], [0, -1, 0], { seg: 24, ro2: 0.037, ri2: 0.032 }), 'black');
    K.add(g, K.sph(0.021, [x, -HY - 0.056, z], { seg: 18, th: PI / 2, axis: [0, -1, 0], scale: [1, 0.45, 1] }), 'glass');
    M.oncw2 = { pos: [x, -HY - 0.085, z], dir: [0, -1, 0] }; }

  // ============ ファンビームセンサ（±Y面の下のすみに2組ずつ。銀色の小箱） ============
  M.fbs = [];
  for (const s of [1, -1]) for (const sx of [1, -1]) {
    const p = [sx * 0.6, s * (HY + 0.024), -0.475], g = K.grp('fbs', [p[0], s * HY, p[2]], [sx * 0.2, s * 0.62, -0.25]);
    K.add(g, K.box(0.085, 0.044, 0.06, p), 'splate');
    K.add(g, K.box(0.1, 0.006, 0.075, [p[0], s * (HY + 0.004), p[2]], { r: 0.001 }), 'alu');
    K.add(g, K.box(0.055, 0.004, 0.012, [p[0], p[1] + s * 0.0225, p[2] - 0.012], { r: 0.001 }), 'glass');
    K.add(g, K.box(0.055, 0.03, 0.004, [p[0], p[1], p[2] - 0.031], { r: 0.001 }), 'glass');
    M.fbs.push({ pos: [p[0], p[1] + s * 0.024, p[2] - 0.02], s });
  }
}
