// 機体の内部。機器の種類と数は公開資料に合わせた。内部の置き場所は公表されていないため、外から見える放熱面の位置
// （発熱する機器はその裏に付く）、重心、配管の取り回しを手がかりに配置している。試料の搬送機構は公開されている図に合わせた。
import * as THREE from 'three';
import { HX, HY, HZ, PI, crinkle, basis, circlePts } from './hb_core.js';

const add3 = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

// 電子機器の箱。m: 取り付け面の向き（箱から壁へ）、k: コネクタが並ぶ面の向き。どちらも軸方向の単位ベクトル
function ebox(K, g, c, sz, m, k, o = {}) {
  K.add(g, K.box(sz[0], sz[1], sz[2], c, { r: 0.005 }), o.mat || 'ebox');
  const ax = v => v.findIndex(q => q !== 0), im = ax(m), ik = ax(k), it = 3 - im - ik;
  const hm = sz[im] / 2, hk = sz[ik] / 2, ht = sz[it] / 2;
  for (const a of [-1, 1]) for (const b of [-1, 1]) {          // 取り付け足とボルト
    const p = c.slice(); p[im] += m[im] * (hm - 0.004); p[ik] += a * (hk + 0.012); p[it] += b * (ht - 0.02);
    const d = [0, 0, 0]; d[im] = 0.008; d[ik] = 0.03; d[it] = 0.03;
    K.add(g, K.box(d[0], d[1], d[2], p, { r: 0.002 }), 'alu');
    const bp = p.slice(); bp[im] -= m[im] * 0.004; bp[ik] += a * 0.004;
    K.bolts(g, [bp], m.map(q => -q), { r: 0.004 });
  }
  const n = o.conn ?? 3;
  for (let i = 0; i < n; i++) {                                 // コネクタ
    const p = c.slice(); p[ik] += k[ik] * (hk + 0.006); p[it] += (i - (n - 1) / 2) * Math.min(0.05, (2 * ht - 0.04) / n); p[im] -= m[im] * hm * 0.25;
    const d = [0, 0, 0]; d[ik] = 0.012; d[it] = 0.034; d[im] = 0.014;
    K.add(g, K.box(d[0], d[1], d[2], p, { r: 0.002 }), i % 3 === 2 ? 'gold' : 'steel');
  }
  if (o.fins) for (let i = 0; i < o.fins; i++) {                // 放熱のひれ
    const p = c.slice(); p[im] -= m[im] * (hm + 0.006); p[it] += (i - (o.fins - 1) / 2) * (2 * ht - 0.03) / o.fins;
    const d = [0, 0, 0]; d[im] = 0.012; d[ik] = 2 * hk - 0.03; d[it] = 0.004;
    K.add(g, K.box(d[0], d[1], d[2], p, { r: 0.001 }), 'alu');
  } else {                                                       // 銘板
    const lp = c.slice(); lp[im] -= m[im] * (hm + 0.0006); lp[it] += ht * 0.35; lp[ik] -= k[ik] * hk * 0.3;
    const ld = [0, 0, 0]; ld[im] = 0.0012; ld[it] = 0.05; ld[ik] = 0.022;
    K.add(g, K.box(ld[0], ld[1], ld[2], lp, { r: 0.0004 }), 'white');
  }
}

export function buildInterior(K) {
  const M = K.meta, I = { internal: true };
  const WX = HX - 0.02, WY = HY - 0.02, WZ = HZ - 0.02;       // パネルの内面

  // ============ 構体（骨組み・パネルの補強・タンクの台・電線の束） ============
  {
    const g = K.grp('structure', [0, 0, 0], [0, 0, 0], I), t = 0.028;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) K.add(g, K.box(t, t, 2 * HZ - 0.05, [sx * (HX - 0.03), sy * (HY - 0.03), 0], { r: 0.004 }), 'alu');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.add(g, K.box(t, 2 * HY - 0.09, t, [sx * (HX - 0.03), 0, sz * (HZ - 0.03)], { r: 0.004 }), 'alu');
    for (const sy of [-1, 1]) for (const sz of [-1, 1]) K.add(g, K.box(2 * HX - 0.09, t, t, [0, sy * (HY - 0.03), sz * (HZ - 0.03)], { r: 0.004 }), 'alu');
    for (const sy of [-1, 1]) {                    // 側面パネルの補強（放熱面の区切りに沿う）
      for (const x of [-0.38, 0, 0.38]) K.add(g, K.box(0.012, 0.016, 2 * HZ - 0.1, [x, sy * (WY - 0.008), 0], { r: 0.002 }), 'alu');
      K.add(g, K.box(2 * HX - 0.1, 0.016, 0.012, [0, sy * (WY - 0.008), -0.005], { r: 0.002 }), 'alu');
    }
    for (const sz of [-1, 1]) for (const x of [-0.4, 0.4]) K.add(g, K.box(0.012, 2 * HY - 0.1, 0.016, [x, 0, sz * (WZ - 0.008)], { r: 0.002 }), 'alu');
    // 結合リングから立ち上がる円すいと、キセノンタンクの受け
    K.add(g, K.pipe(0.385, 0.377, 0.17, [0, 0, -HZ + 0.02], [0, 0, 1], { ro2: 0.262, ri2: 0.254, seg: 72 }), 'cfrp');
    K.add(g, K.pipe(0.272, 0.236, 0.012, [0, 0, -HZ + 0.19], [0, 0, 1], { seg: 64 }), 'alu');
    K.bolts(g, circlePts([0, 0, -HZ + 0.202], [0, 0, 1], 0.254, 16), [0, 0, 1]);
    for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; K.add(g, K.tube([[Math.cos(a) * 0.254, Math.sin(a) * 0.254, -HZ + 0.2], [Math.cos(a + 0.3) * 0.236, Math.sin(a + 0.3) * 0.236, -0.26]], 0.008, { seg: 1, rad: 8 }), 'cfrp'); }
    // カプセルが入るくぼみの枠と、イオンエンジンの開口の枠
    K.add(g, K.pipe(0.228, 0.206, 0.02, [-WX, 0, -0.27], [1, 0, 0], { seg: 56 }), 'alu');
    for (const s of [-1, 1]) { K.add(g, K.box(0.016, 0.56, 0.02, [WX - 0.008, 0, -0.07 + s * 0.27], { r: 0.002 }), 'alu'); K.add(g, K.box(0.016, 0.02, 0.56, [WX - 0.008, s * 0.27, -0.07], { r: 0.002 }), 'alu'); }
    // 側面の筋交い
    for (const sy of [-1, 1]) for (const sx of [-1, 1]) K.add(g, K.tube([[sx * (HX - 0.045), sy * (WY - 0.02), -HZ + 0.05], [sx * 0.38, sy * (WY - 0.02), HZ - 0.05]], 0.008, { seg: 1, rad: 8 }), 'alu');
    // 電線の束と、束ねるひも
    const trunk = (pts, r) => K.add(g, K.tube(pts, r, { rad: 8 }), 'cable');
    for (const sy of [-1, 1]) {
      trunk([[-0.72, sy * 0.4, 0.5], [-0.3, sy * 0.405, 0.505], [0.3, sy * 0.405, 0.505], [0.7, sy * 0.4, 0.5]], 0.013);
      for (const x of [-0.6, -0.36, -0.12, 0.12, 0.36, 0.6]) K.add(g, K.torus(0.0145, 0.0028, [x, sy * 0.403, 0.503], [1, 0, 0], { seg: 12, tub: 5 }), 'white');
      for (const x of [-0.385, 0.005]) trunk([[x, sy * 0.405, 0.5], [x + 0.006, sy * 0.44, 0.4], [x + 0.006, sy * 0.45, 0], [x + 0.006, sy * 0.44, -0.44]], 0.008);
    }
    trunk([[-0.4, -0.4, 0.5], [-0.41, -0.15, 0.508], [-0.41, 0.15, 0.508], [-0.4, 0.4, 0.5]], 0.011);
    trunk([[0.7, 0.4, 0.5], [0.755, 0.3, 0.495], [0.76, 0, 0.5], [0.755, -0.3, 0.495], [0.7, -0.4, 0.5]], 0.011);
    trunk([[-0.7, 0.4, 0.5], [-0.75, 0.3, 0.45], [-0.76, 0.26, 0.1], [-0.72, 0.16, -0.1]], 0.009);
  }

  // ============ キセノンタンク（チタン合金、容量51L）と流量制御 ============
  {
    const c = [0, 0, -0.26], g = K.grp('xetank', c, [0, 0, 0.1], I);
    K.add(g, K.sph(0.23, c, { seg: 56, seg2: 36 }), 'ti');
    K.add(g, K.torus(0.2315, 0.006, c, [0, 0, 1], { seg: 72 }), 'ti');                 // 溶接の継ぎ目
    K.add(g, K.pipe(0.24, 0.231, 0.03, [0, 0, c[2] - 0.015], [0, 0, 1], { seg: 72 }), 'alu');   // 取り付けの帯
    for (const s of [1, -1]) { K.add(g, K.cyl(0.04, 0.02, [0, 0, c[2] + s * 0.222], [0, 0, s], { seg: 24 }), 'steel'); K.add(g, K.cyl(0.014, 0.03, [0, 0, c[2] + s * 0.24], [0, 0, s], { seg: 14 }), 'steel'); }
    for (const dz of [0.11, -0.11]) K.add(g, K.torus(Math.sqrt(0.23 * 0.23 - dz * dz) + 0.0012, 0.0032, [0, 0, c[2] + dz], [0, 0, 1], { seg: 64, tub: 6 }), 'kapton');   // ヒーターの帯
    // 流量制御の箱と弁、イオンエンジンへの細管
    const f = [0.58, 0, -0.455];
    K.add(g, K.box(0.14, 0.2, 0.07, f), 'aluDark');
    for (let i = 0; i < 4; i++) { K.add(g, K.cyl(0.012, 0.035, [f[0] - 0.045 + i * 0.03, f[1] - 0.06, f[2] + 0.035], [0, 0, 1], { seg: 12 }), 'steel'); K.add(g, K.box(0.02, 0.03, 0.02, [f[0] - 0.045 + i * 0.03, f[1] - 0.06, f[2] + 0.08]), 'gold'); }
    K.add(g, K.cyl(0.02, 0.06, [f[0] + 0.02, f[1] + 0.05, f[2] + 0.035], [0, 0, 1], { seg: 16 }), 'steel');
    K.add(g, K.tube([[0, 0, c[2] + 0.268], [0.12, 0.02, c[2] + 0.3], [0.3, 0.03, -0.2], [0.46, 0.02, -0.4], [f[0] - 0.07, 0, f[2]]], 0.004, { rad: 6 }), 'steel');
    K.add(g, K.tube([[f[0] + 0.07, 0, f[2]], [0.72, 0, -0.42], [0.76, 0, -0.2], [WX, 0, -0.1]], 0.004, { rad: 6 }), 'steel');
    M.xetank = { c, r: 0.23, top: [0, 0, c[2] + 0.268] };
  }

  // ============ 化学エンジンのタンク（燃料：ゴム袋式、酸化剤：金属ベローズ式、加圧ガス） ============
  {
    const cf = [0.4, 0.2, -0.1], co = [0.4, -0.22, -0.3], he = [0.4, -0.04, 0.3], g = K.grp('chemtank', [0.4, 0, 0], [0.05, 0, 0.1], I);
    K.add(g, K.sph(0.18, cf, { seg: 48, seg2: 32 }), 'ti');
    K.add(g, K.torus(0.181, 0.005, cf, [0, 0, 1], { seg: 64 }), 'ti');
    for (const s of [1, -1]) K.add(g, K.cyl(0.03, 0.022, [cf[0], cf[1], cf[2] + s * 0.174], [0, 0, s], { seg: 18 }), 'steel');
    K.add(g, K.pipe(0.145, 0.138, 0.3, [cf[0], cf[1], -WZ], [0, 0, 1], { ro2: 0.122, ri2: 0.115, seg: 44 }), 'alu');      // 台
    const cap = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * PI / 2; cap.push([0.13 * Math.sin(a), 0.13 * (1 - Math.cos(a))]); }
    const body = cap.concat([[0.13, 0.13 + 0.07]]); for (let i = 8; i >= 0; i--) { const a = i / 8 * PI / 2; body.push([0.13 * Math.sin(a), 0.2 + 0.13 * Math.cos(a)]); }
    K.add(g, K.lathe(body, co, [0, 0, 1], { smooth: true, seg: 48 }), 'ti');
    for (const z of [0.13, 0.2]) K.add(g, K.torus(0.131, 0.004, [co[0], co[1], co[2] + z], [0, 0, 1], { seg: 56 }), 'ti');
    K.add(g, K.cyl(0.028, 0.022, co, [0, 0, -1], { seg: 18 }), 'steel');
    K.add(g, K.cyl(0.028, 0.022, [co[0], co[1], co[2] + 0.33], [0, 0, 1], { seg: 18 }), 'steel');
    K.add(g, K.pipe(0.11, 0.103, 0.26, [co[0], co[1], -WZ], [0, 0, 1], { ro2: 0.1, ri2: 0.093, seg: 40 }), 'alu');
    // 加圧ガス（ヘリウム）の球と、調圧器を通ってタンクの上へ行く管
    K.add(g, K.sph(0.085, he, { seg: 32 }), 'composite');
    K.add(g, K.torus(0.086, 0.004, he, [1, 0, 0], { seg: 40 }), 'alu');
    K.add(g, K.box(0.05, 0.05, 0.04, [he[0] + 0.02, he[1], he[2] - 0.12]), 'aluDark');
    K.add(g, K.tube([[he[0], he[1], he[2] - 0.085], [he[0] + 0.02, he[1], he[2] - 0.1]], 0.004, { seg: 2, rad: 6 }), 'steel');
    K.add(g, K.tube([[he[0] + 0.02, he[1] + 0.025, he[2] - 0.12], [0.42, 0.12, 0.16], [cf[0], cf[1], cf[2] + 0.196]], 0.004, { rad: 6 }), 'steel');
    K.add(g, K.tube([[he[0] + 0.02, he[1] - 0.025, he[2] - 0.12], [0.42, -0.15, 0.14], [co[0], co[1], co[2] + 0.352]], 0.004, { rad: 6 }), 'steel');
    for (const p of [[0.3, 0.37], [0.5, 0.37]]) K.add(g, K.tube([[p[0], p[1], WZ], [he[0] + (p[0] - 0.4) * 0.6, he[1] + 0.06, he[2] + 0.05]], 0.006, { seg: 1, rad: 6 }), 'alu');
    M.chem = { fuel: cf, ox: co, he };
  }

  // ============ 化学エンジンの配管（A系とB系が隣り合って通る）と弁 ============
  {
    const g = K.grp('pipes', [0, 0, 0], [0, 0, 0], I);
    const twin = (pts, o = {}) => {       // 2系統を1.4cm離して並べる
      const off = o.off ?? [0, 0, 0.014];
      K.add(g, K.tube(pts, 0.0042, { rad: 6, tension: 0.2 }), 'pipeA');
      K.add(g, K.tube(pts.map(p => add3(p, off)), 0.0042, { rad: 6, tension: 0.2 }), 'pipeB');
    };
    const L = 0.73, W = 0.43, c = 0.07, zt = 0.47, zb = -0.47;
    const loop = z => [[L, -W + c, z], [L, 0, z], [L, W - c, z], [L - c, W, z], [0, W, z], [-L + c, W, z], [-L, W - c, z], [-L, 0, z], [-L, -W + c, z], [-L + c, -W, z], [0, -W, z], [L - c, -W, z], [L, -W + c, z]];
    twin(loop(zt), { off: [0, 0, -0.014] }); twin(loop(zb));
    // 輪を壁に留める金具と、系統を切り替える弁
    for (const z of [zt, zb]) {
      for (const x of [-0.5, -0.2, 0.2, 0.5]) for (const sy of [-1, 1]) K.add(g, K.box(0.022, 0.04, 0.036, [x, sy * (W + 0.02), z + (z > 0 ? -0.007 : 0.007)], { r: 0.003 }), 'alu');
      for (const sx of [-1, 1]) for (const y of [-0.2, 0.2]) K.add(g, K.box(0.04, 0.022, 0.036, [sx * (L + 0.02), y, z + (z > 0 ? -0.007 : 0.007)], { r: 0.003 }), 'alu');
      for (const [x, sy] of [[0.1, 1], [-0.1, -1]]) for (const dz of [0, z > 0 ? -0.014 : 0.014]) {
        K.add(g, K.cyl(0.011, 0.045, [x - 0.0225, sy * W, z + dz], [1, 0, 0], { seg: 12 }), 'steel');
        K.add(g, K.box(0.026, 0.02, 0.012, [x, sy * (W - 0.016), z + dz], { r: 0.002 }), 'aluDark');
      }
    }
    // タンクから集合部、集合部から上下の輪へ
    const mf = [0.58, 0, -0.39];
    twin([[0.4, 0.2, -0.296], [0.47, 0.14, -0.36], [mf[0] - 0.05, 0.04, mf[2]]]); twin([[0.4, -0.22, -0.322], [0.47, -0.14, -0.37], [mf[0] - 0.05, -0.04, mf[2]]]);
    twin([[mf[0] + 0.05, 0, mf[2]], [0.68, 0.06, -0.43], [L, 0.1, zb]], { off: [0, 0.014, 0] });
    twin([[-L, 0.3, zb], [-0.757, 0.37, -0.2], [-0.757, 0.37, 0.25], [-L, 0.3, zt]], { off: [0, 0.014, 0] });
    K.add(g, K.box(0.1, 0.13, 0.05, mf), 'aluDark');
    for (const dy of [-0.04, 0.0, 0.04]) { K.add(g, K.cyl(0.013, 0.05, [mf[0] - 0.02, mf[1] + dy, mf[2] + 0.02], [0, 0, 1], { seg: 12 }), 'steel'); K.add(g, K.box(0.02, 0.02, 0.014, [mf[0] - 0.02, mf[1] + dy, mf[2] + 0.076]), 'gold'); }
    for (const dy of [-0.045, 0.045]) K.add(g, K.cyl(0.016, 0.06, [mf[0] + 0.03, mf[1] + dy, mf[2] + 0.02], [0, 0, 1], { seg: 14 }), 'steel');    // フィルタ
    // 各スラスタへの枝（パネルを抜けて外の台へ出る）
    M.branches = [];
    (M.rcs || []).forEach((t, i) => {
      const b = t.base, d = t.dir, sx = Math.sign(b[0]), sy = Math.sign(b[1]);
      let pts;
      if (d[2] !== 0) { const z = d[2] > 0 ? zt : zb; pts = [[sx * (L - 0.01), sy * (W - 0.03), z], [sx * (WX - 0.015), sy * (W - 0.005), z + d[2] * 0.02], [sx * (HX - 0.004), b[1], b[2] - d[2] * 0.03]]; }
      else pts = [[sx * L, sy * (W - 0.09), zb], [sx * (WX - 0.012), sy * W, zb + 0.26], [sx * (HX - 0.004), b[1], b[2]]];
      twin(pts, { off: d[2] !== 0 ? [0, -sy * 0.012, 0] : [0, 0, 0.012] });
      K.add(g, K.cyl(0.012, 0.03, [sx * (WX - 0.02), pts[1][1], pts[1][2]], [sx, 0, 0], { seg: 12 }), 'steel');
      M.branches.push({ rcs: i, pts });
    });
    M.loops = { top: loop(zt), bot: loop(zb), mf };
  }

  // ============ リアクションホイール（X・Y・Z軸の3台。中のはずみ車が見えるよう外装を一部切ってある） ============
  {
    M.rw = [];
    const defs = [['X', [-0.06, 0.3, 0.28], [1, 0, 0], [0, 0, 1]], ['Y', [-0.12, -0.36, 0.28], [0, 1, 0], [0, -1, 0]], ['Z', [-0.02, 0.02, 0.46], [0, 0, 1], [0, 0, 1]]];
    for (const [name, c, ax, wall] of defs) {
      const g = K.grp('rw', c, [ax[0] * 0.1, ax[1] * 0.1, ax[2] * 0.02 + 0.06], { internal: true, name: 'rw' + name });
      const base = add3(c, ax, -0.0375);
      K.add(g, K.lathe([[0, 0], [0.106, 0], [0.106, 0.055], [0.085, 0.075], [0, 0.075]], base, ax, { seg: 48, arc: PI * 1.45, phi0: 0.6 }), 'aluDark');
      K.add(g, K.pipe(0.118, 0.1, 0.008, base, ax, { seg: 48 }), 'alu');
      K.bolts(g, circlePts(add3(base, ax, 0.008), ax, 0.11, 8), ax);
      K.add(g, K.box(0.05, 0.04, 0.03, add3(add3(c, basis(ax)[0].toArray(), 0.12), ax, -0.02)), 'aluDark');
      // 壁へ留める台
      if (name === 'X') { K.add(g, K.box(0.012, 0.2, 0.14, [c[0] - 0.044, c[1], c[2] + 0.17], { r: 0.003 }), 'alu'); K.add(g, K.box(0.07, 0.2, 0.012, [c[0] - 0.015, c[1], WZ - 0.006], { r: 0.003 }), 'alu'); }
      if (name === 'Y') K.add(g, K.pipe(0.09, 0.075, 0.082, [c[0], -WY, c[2]], [0, 1, 0], { seg: 32 }), 'alu');
      if (name === 'Z') K.add(g, K.pipe(0.09, 0.075, 0.032, [c[0], c[1], WZ], [0, 0, -1], { seg: 32 }), 'alu');
      K.add(g, K.torus(0.05, 0.011, add3(c, ax, -0.022), ax, { seg: 32, tub: 8 }), 'copper');                 // モーターの巻線
      const gr = K.grp('rw', c, [0, 0, 0], { parent: g, internal: true, name: 'rotor' + name });
      K.add(gr, K.pipe(0.097, 0.075, 0.036, add3(c, ax, -0.018), ax, { seg: 48 }), 'steel');
      K.add(gr, K.cyl(0.02, 0.05, add3(c, ax, -0.025), ax, { seg: 18 }), 'steel');
      const [u, v] = basis(ax);
      for (let k = 0; k < 3; k++) { const a = k / 3 * PI, dir = [u.x * Math.cos(a) + v.x * Math.sin(a), u.y * Math.cos(a) + v.y * Math.sin(a), u.z * Math.cos(a) + v.z * Math.sin(a)]; K.add(gr, K.cyl(0.006, 0.16, add3(c, dir, -0.08), dir, { seg: 8 }), 'copper'); }
      M.rw.push({ name, c, axis: ax, group: g.idx, rotor: gr.idx });
    }
  }

  // ============ リチウムイオン電池（11セル直列） ============
  {
    const c = [0.36, 0.25, 0.43], g = K.grp('battery', c, [0, 0.05, 0.08], I);
    K.add(g, K.box(0.38, 0.17, 0.012, [c[0], c[1], c[2] + 0.058], { r: 0.003 }), 'alu');
    for (const sx of [-1, 1]) K.add(g, K.box(0.012, 0.16, 0.1, [c[0] + sx * 0.181, c[1], c[2] + 0.003], { r: 0.003 }), 'aluDark');
    for (const sy of [-1, 1]) for (const dz of [-0.03, 0.03]) K.add(g, K.cyl(0.004, 0.37, [c[0] - 0.185, c[1] + sy * 0.072, c[2] + 0.003 + dz], [1, 0, 0], { seg: 8 }), 'steel');
    M.cells = [];
    for (let i = 0; i < 11; i++) {
      const x = c[0] - 0.155 + i * 0.031;
      K.add(g, K.box(0.027, 0.132, 0.092, [x, c[1], c[2] + 0.004], { r: 0.004 }), 'cell', { sep: 'c' + i });
      K.add(g, K.cyl(0.005, 0.006, [x, c[1] - 0.04, c[2] - 0.042], [0, 0, -1], { seg: 10 }), 'copper');
      K.add(g, K.cyl(0.005, 0.006, [x, c[1] + 0.04, c[2] - 0.042], [0, 0, -1], { seg: 10 }), 'steel');
      if (i < 10) K.add(g, K.box(0.03, 0.012, 0.003, [x + 0.0155, c[1] + (i % 2 ? 0.04 : -0.04), c[2] - 0.049], { r: 0.001 }), 'copper');
      M.cells.push([x, c[1], c[2] + 0.004]);
    }
    K.add(g, K.box(0.05, 0.06, 0.03, [c[0] - 0.22, c[1], c[2] + 0.03]), 'aluDark');
    K.add(g, K.tube([[c[0] - 0.24, c[1], c[2] + 0.03], [c[0] - 0.3, c[1] + 0.08, 0.49], [c[0] - 0.33, 0.4, 0.5]], 0.006, { rad: 6 }), 'orange');
  }

  // ============ イオンエンジン電源 IPPU（3台）とマイクロ波増幅器（4台）。どちらも鏡面の+Xパネルの裏に付く ============
  {
    const g = K.grp('ppu', [WX - 0.05, 0, 0.31], [0.1, 0, 0.1], I);
    M.ippu = [];
    for (const y of [-0.3, 0, 0.3]) {
      const c = [WX - 0.045, y, 0.31];
      ebox(K, g, c, [0.085, 0.2, 0.22], [1, 0, 0], [0, 0, -1], { fins: 7, mat: 'aluDark', conn: 3 });
      K.add(g, K.tube([[c[0], y, 0.194], [0.7, y * 0.7, 0.12], [0.74, y * 0.4, 0.02]], 0.007, { rad: 6 }), 'orange');
      M.ippu.push(c);
    }
    const gm = K.grp('mwamp', [WX - 0.04, 0, -0.1], [0.12, 0, 0], I);
    for (const [y, z] of [[0.36, 0.06], [-0.36, 0.06], [0.36, -0.3], [-0.36, -0.3]]) {
      const c = [WX - 0.037, y, z], s = Math.sign(y);
      ebox(K, gm, c, [0.07, 0.12, 0.22], [1, 0, 0], [0, -s, 0], { mat: 'aluDark', conn: 2 });
      K.add(gm, K.cyl(0.02, 0.2, [c[0] - 0.058, y, z - 0.1], [0, 0, 1], { seg: 16 }), 'copper');              // 進行波管
      K.add(gm, K.tube([[c[0] - 0.058, y, z + 0.1], [0.7, y * 0.75, z * 0.6 - 0.02], [0.745, y * 0.42, z * 0.5 - 0.035]], 0.006, { rad: 6 }), 'gold');
    }
  }

  // ============ 搭載コンピュータ（データ処理・姿勢軌道制御）と電源制御、慣性基準装置 ============
  {
    const g = K.grp('computer', [-0.5, 0.42, 0.1], [-0.05, 0.12, 0], I);
    ebox(K, g, [-0.57, WY - 0.055, 0.215], [0.26, 0.11, 0.2], [0, 1, 0], [0, 0, 1], { conn: 4 });
    ebox(K, g, [-0.57, WY - 0.06, -0.225], [0.26, 0.12, 0.22], [0, 1, 0], [0, 0, 1], { conn: 4 });
    ebox(K, g, [-0.21, WY - 0.045, 0.19], [0.2, 0.09, 0.16], [0, 1, 0], [0, 0, 1], { conn: 3 });
    ebox(K, g, [0.19, WY - 0.045, -0.3], [0.2, 0.09, 0.14], [0, 1, 0], [-1, 0, 0], { conn: 2 });
    // 慣性基準装置（底面の内側）
    K.add(g, K.box(0.14, 0.14, 0.09, [-0.3, 0.3, -WZ + 0.045]), 'ebox');
    K.add(g, K.cyl(0.03, 0.02, [-0.3, 0.3, -WZ + 0.09], [0, 0, 1], { seg: 16 }), 'alu');
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) K.bolts(g, [[-0.3 + a * 0.08, 0.3 + b * 0.08, -WZ]], [0, 0, 1], { r: 0.005 });
  }

  // ============ 通信機（Xバンド送受信機と電力増幅器） ============
  {
    const g = K.grp('transponder', [-0.5, -0.42, 0.1], [-0.05, -0.12, 0], I);
    ebox(K, g, [-0.57, -WY + 0.05, 0.215], [0.24, 0.1, 0.2], [0, -1, 0], [0, 0, 1], { conn: 4 });
    ebox(K, g, [-0.57, -WY + 0.05, -0.225], [0.24, 0.1, 0.2], [0, -1, 0], [0, 0, 1], { conn: 4 });
    ebox(K, g, [-0.19, -WY + 0.045, -0.3], [0.18, 0.09, 0.13], [0, -1, 0], [0, 0, 1], { fins: 6, conn: 2 });
    ebox(K, g, [0.57, -WY + 0.04, 0.215], [0.2, 0.08, 0.16], [0, -1, 0], [-1, 0, 0], { conn: 2 });
    // アンテナへ行く同軸ケーブル
    K.add(g, K.tube([[-0.57, -WY + 0.06, 0.33], [-0.5, -0.3, 0.45], [-0.2, -0.08, 0.5], [0, 0, WZ]], 0.006, { rad: 6 }), 'gold');
    K.add(g, K.tube([[-0.19, -WY + 0.06, -0.23], [-0.3, -0.36, 0.1], [-0.45, -0.34, 0.42], [-0.2, -0.1, 0.495], [0.02, 0.02, WZ]], 0.005, { rad: 6 }), 'gold');
  }

  // ============ サンプラーの内部（上部ホーンの奥・細い管・キャッチャ・搬送機構・発射装置） ============
  {
    const hx = M.horn.x, zc = M.capsule.center[2], xa = M.capsule.aft[0], g = K.grp('catcher', [hx, 0, -0.4], [0.08, 0, 0.05], I);
    K.add(g, K.pipe(0.036, 0.034, 0.15, [hx, 0, -HZ + 0.002], [0, 0, 1], { ro2: 0.0145, ri2: 0.0125, seg: 40 }), 'alu');
    K.add(g, K.pipe(0.06, 0.036, 0.008, [hx, 0, -WZ], [0, 0, 1], { seg: 32 }), 'alu');
    // 搬送機構の台と案内棒、端板、切り離し用の装置
    const xe = hx + 0.215;
    for (const sy of [-1, 1]) K.add(g, K.cyl(0.004, 0.19, [hx + 0.03, sy * 0.042, zc], [1, 0, 0], { seg: 8 }), 'steel');
    K.add(g, K.box(0.012, 0.11, 0.09, [xe, 0, zc], { r: 0.003 }), 'alu');
    K.add(g, K.box(0.06, 0.1, 0.012, [xe - 0.03, 0, zc - 0.05], { r: 0.003 }), 'alu');
    K.add(g, K.box(0.014, 0.09, zc - 0.05 + WZ, [xe - 0.01, 0, (zc - 0.05 - WZ) / 2], { r: 0.003 }), 'alu');
    K.add(g, K.box(0.04, 0.04, 0.04, [xe + 0.028, 0, zc + 0.02]), 'aluDark');                       // 保持を解く装置
    K.add(g, K.cyl(0.006, 0.02, [xe + 0.048, 0, zc + 0.02], [1, 0, 0], { seg: 10 }), 'gold');
    K.add(g, K.box(0.03, 0.022, 0.028, [hx + 0.11, 0, zc - 0.034]), 'steel');                       // ワイヤカッタ
    K.add(g, K.tube([[hx + 0.045, 0, zc - 0.012], [hx + 0.11, 0, zc - 0.022], [xe - 0.008, 0, zc - 0.02]], 0.0012, { rad: 4, seg: 8 }), 'steel');
    // 管を下げる機構
    K.add(g, K.box(0.03, 0.03, 0.05, [hx + 0.04, 0.035, -0.36]), 'aluDark');
    K.add(g, K.box(0.03, 0.008, 0.008, [hx + 0.018, 0.02, -0.345], { rot: [0, 0, 0.7] }), 'steel');
    // 細い管（搬送の前に下へ退く）
    const gt = K.grp('catcher', [hx, 0, -0.35], [0, 0, 0], { parent: g, internal: true, name: 'samplerTube' });
    K.add(gt, K.pipe(0.0095, 0.0075, zc - 0.026 + 0.4, [hx, 0, -0.4], [0, 0, 1], { seg: 16 }), 'steel');
    K.add(gt, K.pipe(0.016, 0.0095, 0.006, [hx, 0, -0.352], [0, 0, 1], { seg: 16 }), 'steel');
    // キャッチャ（カプセルのふたと一体。-X方向へ押し込まれる）
    const CUTC = PI * 0.5;
    const gc = K.grp('catcher', [hx, 0, zc], [0, 0, 0], { parent: g, internal: true, name: 'catcherBody' });
    K.add(gc, K.pipe(0.024, 0.0222, 0.057, [hx + 0.0285, 0, zc], [-1, 0, 0], { seg: 28, arc: PI, phi0: CUTC }), 'gold');     // 上半分を切って、A室とB室を見せる
    for (const dx of [0.0275, -0.0275]) K.add(gc, K.cyl(0.024, 0.002, [hx + dx + 0.001, 0, zc], [-1, 0, 0], { seg: 28 }), 'gold');
    K.add(gc, K.cyl(0.0222, 0.0016, [hx + 0.0008, 0, zc], [-1, 0, 0], { seg: 24 }), 'steel');                                       // 2つの部屋の仕切り
    K.add(gc, K.pipe(0.011, 0.0095, 0.05, [hx + 0.025, 0, zc], [-1, 0, 0], { seg: 16, arc: PI * 1.2, phi0: PI * 0.4 }), 'chrome');      // 部屋を切りかえる回転筒
    K.add(gc, K.pipe(0.0265, 0.024, 0.01, [hx - 0.012, 0, zc], [-1, 0, 0], { seg: 28 }), 'steel');
    K.add(gc, K.pipe(0.012, 0.009, 0.008, [hx, 0, zc - 0.022], [0, 0, -1], { seg: 14 }), 'steel');
    K.add(gc, K.cyl(0.05, 0.01, [hx + 0.03, 0, zc], [1, 0, 0], { seg: 36 }), 'alu');                   // カプセルのふた
    K.add(gc, K.torus(0.044, 0.0028, [hx + 0.029, 0, zc], [1, 0, 0], { seg: 36, tub: 6 }), 'black');   // Oリング
    circlePts([hx + 0.035, 0, zc], [1, 0, 0], 0.05, 3, 0.4).forEach(p => K.add(gc, K.box(0.016, 0.014, 0.014, p), 'steel'));   // ラッチ
    K.add(gc, K.cyl(0.008, 0.035, [hx + 0.04, 0, zc], [1, 0, 0], { seg: 12 }), 'steel');
    K.add(gc, K.cyl(0.03, 0.006, [hx + 0.075, 0, zc], [1, 0, 0], { seg: 24 }), 'aluDark');
    // 押し出すばね（形状記憶合金）。端板側を固定端にして伸びる
    const sl = 0.125, gsp = K.grp('catcher', [xe - 0.006, 0, zc], [0, 0, 0], { parent: g, internal: true, name: 'smaSpring' });
    const hp = []; for (let i = 0; i <= 120; i++) { const t = i / 120, a = t * PI * 2 * 9; hp.push([xe - 0.006 - t * sl, Math.cos(a) * 0.02, zc + Math.sin(a) * 0.02]); }
    K.add(gsp, K.tube(hp, 0.0022, { rad: 5, seg: 240, tension: 0.5 }), 'copper');
    // カプセル側のサンプルコンテナ（カプセルと一緒に動く）
    const cap = K.groups.find(q => q.name === 'capsule');
    const gk = K.grp('capsule', [xa - 0.05, 0, zc], [0, 0, 0.32], { parent: cap, internal: true, name: 'container' });
    K.add(gk, K.pipe(0.034, 0.0275, 0.1, [xa - 0.004, 0, zc], [-1, 0, 0], { seg: 32 }), 'steel');
    K.add(gk, K.cyl(0.034, 0.006, [xa - 0.104, 0, zc], [-1, 0, 0], { seg: 32 }), 'steel');
    K.add(gk, K.pipe(0.058, 0.034, 0.008, [xa - 0.004, 0, zc], [-1, 0, 0], { seg: 32 }), 'alu');
    K.add(gk, K.pipe(0.046, 0.034, 0.03, [xa - 0.012, 0, zc], [-1, 0, 0], { seg: 32 }), 'aluDark');
    // ---------- カプセルの中身（カプセルと一緒に動く。外の断熱材を透かすと見える。前後の耐熱材と中の器は、中が見えるよう一部を切ってある） ----------
    {
      const A = [-1, 0, 0], O = [xa, 0, zc], cut = { smooth: true, seg: 64, arc: PI, phi0: PI * 0.25 };
      // 前面ヒートシールド（炭素繊維と樹脂の耐熱材。厚さ約3cm）
      const gf = K.grp('capsule', [xa - 0.14, 0, zc], [-0.3, 0, 0], { parent: cap, internal: true, skin: true });
      const fo = [[0.172, 0.084], [0.198, 0.084]], fi = [];
      for (let i = 1; i <= 5; i++) { const t = i / 5; fo.push([0.198 - 0.0585 * t, 0.084 + 0.0565 * t]); }
      for (let i = 1; i <= 8; i++) { const th = (45 - 45 * i / 8) * PI / 180; fo.push([0.197 * Math.sin(th), 0.197 * Math.cos(th)]); }
      for (let i = 0; i <= 8; i++) { const th = 45 * i / 8 * PI / 180; fi.push([0.166 * Math.sin(th), 0.166 * Math.cos(th)]); }
      fi.push([0.172, 0.084]);
      K.add(gf, K.lathe(fo.concat(fi), O, A, cut), 'ablator');
      // 背面ヒートシールド（パラシュートのふたを兼ねる。開くときにパラシュートを引き出す）。中央の穴から試料の容器を受け取る
      const ga = K.grp('capsule', [xa - 0.03, 0, zc], [0.24, 0, 0], { parent: cap, internal: true });
      K.add(ga, K.lathe([[0.061, 0.002], [0.083, 0.002], [0.197, 0.079], [0.186, 0.081], [0.079, 0.013], [0.061, 0.013], [0.061, 0.002]], O, A, { ...cut, smooth: false }), 'ablatorB');
      // インスツルメントモジュール（中央に試料容器が入る筒、まわりに電子機器と電池）
      const gm = K.grp('capsule', [xa - 0.1, 0, zc], [0, 0, 0], { parent: cap, internal: true });
      const gms = K.grp('capsule', [xa - 0.1, 0, zc], [-0.07, 0, 0], { parent: cap, internal: true, skin: true });      // 器の外側（透かすと中の機器が見える）
      K.add(gms, K.lathe([[0.15, 0.086], [0.15, 0.092], [0.098, 0.125], [0, 0.125], [0, 0.12], [0.095, 0.12], [0.145, 0.092], [0.145, 0.086]], O, A, { ...cut, smooth: false }), 'alu');
      K.add(gm, K.pipe(0.041, 0.038, 0.076, [xa - 0.044, 0, zc], A, { seg: 32 }), 'alu');
      K.add(gm, K.pipe(0.15, 0.041, 0.004, [xa - 0.088, 0, zc], A, { seg: 48 }), 'alu');
      const eq = (deg, r, sz, m) => { const a = deg * PI / 180; K.add(gm, K.box(sz[0], sz[1], sz[2], [xa - 0.092 - sz[0] / 2, Math.cos(a) * r, zc + Math.sin(a) * r], { rot: [a, 0, 0], r: 0.002 }), m); };
      eq(200, 0.08, [0.02, 0.044, 0.04], 'ebox'); eq(255, 0.08, [0.018, 0.04, 0.036], 'aluDark'); eq(310, 0.08, [0.02, 0.044, 0.04], 'ebox');      // ビーコンの送信機、タイマー、加速度の検出
      for (const deg of [20, 42, 64, 86]) { const a = deg * PI / 180; K.add(gm, K.cyl(0.012, 0.022, [xa - 0.093, Math.cos(a) * 0.083, zc + Math.sin(a) * 0.083], A, { seg: 14 }), 'cellC'); }   // 電池
      for (const deg of [120, 150]) { const a = deg * PI / 180; K.add(gm, K.box(0.014, 0.04, 0.03, [xa - 0.1, Math.cos(a) * 0.08, zc + Math.sin(a) * 0.08], { rot: [a, 0, 0], r: 0.002 }), 'pcb'); }
      for (const [d0, d1, m] of [[200, 255, 'cable'], [255, 310, 'cable'], [310, 20, 'redwire'], [86, 120, 'redwire'], [150, 200, 'cable']]) {      // 機器どうしをつなぐ配線
        const a0 = d0 * PI / 180, a1 = d1 * PI / 180, am = (a0 + a1 + (a1 < a0 ? 2 * PI : 0)) / 2;
        K.add(gm, K.tube([[xa - 0.096, Math.cos(a0) * 0.08, zc + Math.sin(a0) * 0.08], [xa - 0.094, Math.cos(am) * 0.115, zc + Math.sin(am) * 0.115], [xa - 0.096, Math.cos(a1) * 0.08, zc + Math.sin(a1) * 0.08]], 0.0016, { rad: 5, seg: 10 }), m);
      }
      // パラシュート（たたんで背面側に収める）と、つり索
      const gp = K.grp('capsule', [xa - 0.05, 0, zc], [0.12, 0, 0], { parent: cap, internal: true });
      const pp = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * PI * 2; pp.push([0.09 + 0.04 * Math.cos(a) * (0.94 + 0.06 * Math.cos(a * 7)), 0.06 + 0.02 * Math.sin(a)]); }
      K.add(gp, crinkle(K.lathe(pp, O, A, { smooth: true, seg: 56, arc: PI, phi0: PI * 0.25 }), 0.3), 'chute');
      for (let k = 0; k < 6; k++) { const a = (k / 6 + 0.05) * PI * 2; K.add(gp, K.tube([[xa - 0.082, Math.cos(a) * 0.1, zc + Math.sin(a) * 0.1], [xa - 0.086, Math.cos(a) * 0.118, zc + Math.sin(a) * 0.118], [xa - 0.089, Math.cos(a) * 0.14, zc + Math.sin(a) * 0.14]], 0.0014, { rad: 4, seg: 6 }), 'orange'); }
    }
    M.sampler = { hx, zc, coneTip: [hx, 0, -0.4], catcher: [hx, 0, zc], container: [xa - 0.055, 0, zc], spring: [xe - 0.07, 0, zc], travel: hx + 0.03 - xa, springLen: sl, tubeDrop: 0.06 };
  }
}
