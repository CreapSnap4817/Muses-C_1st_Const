// 機体ジオメトリを組むための道具箱。Node（AOの事前計算）とブラウザの両方で同じ結果になるよう、乱数は種つきにしている。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const HX = 0.8, HY = 0.5, HZ = 0.55;   // 本体の半寸法（X:イオンエンジン軸 1.6m、Y:パドル軸 1.0m、Z:アンテナ軸 1.1m）
export const PI = Math.PI;

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function h3(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
export function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const u = fade(x - ix), v = fade(y - iy), w = fade(z - iz);
  const a = h3(ix, iy, iz), b = h3(ix + 1, iy, iz), c = h3(ix, iy + 1, iz), d = h3(ix + 1, iy + 1, iz);
  const e = h3(ix, iy, iz + 1), f = h3(ix + 1, iy, iz + 1), g = h3(ix, iy + 1, iz + 1), k = h3(ix + 1, iy + 1, iz + 1);
  const x1 = a + (b - a) * u, x2 = c + (d - c) * u, x3 = e + (f - e) * u, x4 = g + (k - g) * u;
  const y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
  return y1 + (y2 - y1) * w;
}
export function fbm3(x, y, z, oct = 4) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise3(x, y, z); n += a; x *= 2.03; y *= 2.03; z *= 2.03; a *= 0.5; }
  return s / n;
}
// 断熱材（MLI）のふくらみ・しわ・縫い目。位置(m)→法線方向の変位(m)
const groove = t => { const f = t / 0.27; const d = (f - Math.round(f)) * 0.27; return Math.exp(-(d * d) / (0.007 * 0.007)); };
export function mliDisp(x, y, z) {
  return (fbm3(x * 4.1 + 11.3, y * 4.1 + 2.7, z * 4.1 + 6.1, 3) - 0.5) * 0.016
    + (fbm3(x * 17 + 3, y * 17 + 5, z * 17 + 7, 2) - 0.5) * 0.005
    - 0.0035 * (groove(x + 0.07) + groove(y + 0.11) + groove(z + 0.05));
}

const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _n = new THREE.Vector3(), _e = new THREE.Euler();
function orient(geo, axis, roll) {
  if (roll) geo.rotateY(roll);
  if (axis) { _v.set(axis[0], axis[1], axis[2]).normalize(); _q.setFromUnitVectors(_up, _v); geo.applyQuaternion(_q); }
  return geo;
}
function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv; if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geo;
}
// 面の向きごとに平面投影したUV（単位はm）
export function uvBox(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ax >= ay && ax >= az) uv.setXY(i, p.getY(i), p.getZ(i));
    else if (ay >= az) uv.setXY(i, p.getX(i), p.getZ(i));
    else uv.setXY(i, p.getX(i), p.getY(i));
  }
  return geo;
}
// 任意のジオメトリを断熱材らしく波打たせる（法線は変位の勾配から解析的に求め、継ぎ目を出さない）
export function crinkle(geo, amp = 1) {
  const p = geo.attributes.position, n = geo.attributes.normal, e = 0.004;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    _n.set(n.getX(i), n.getY(i), n.getZ(i));
    const d = mliDisp(x, y, z) * amp;
    const gx = (mliDisp(x + e, y, z) - mliDisp(x - e, y, z)) / (2 * e) * amp;
    const gy = (mliDisp(x, y + e, z) - mliDisp(x, y - e, z)) / (2 * e) * amp;
    const gz = (mliDisp(x, y, z + e) - mliDisp(x, y, z - e)) / (2 * e) * amp;
    const gn = gx * _n.x + gy * _n.y + gz * _n.z;
    p.setXYZ(i, x + _n.x * d, y + _n.y * d, z + _n.z * d);
    _v.set(_n.x - (gx - gn * _n.x), _n.y - (gy - gn * _n.y), _n.z - (gz - gn * _n.z)).normalize();
    n.setXYZ(i, _v.x, _v.y, _v.z);
  }
  return geo;
}
// 角を丸めた箱（頂点を共有する軽い作り）。n: 丸みの分割数、cell: 平らな部分の分割の目安(m)
function axisSamples(L, r, n, cell) {
  const h = L / 2, a = [];
  for (let i = 0; i < n; i++) a.push(-h + r * i / n);
  const mid = L - 2 * r, m = cell > 0 ? Math.max(1, Math.round(mid / cell)) : 1;
  for (let i = 0; i <= m; i++) a.push(-h + r + mid * i / m);
  for (let i = 1; i <= n; i++) a.push(h - r + r * i / n);
  return a;
}
export function rbox(w, h, d, r = 0.004, n = 1, cell = 0) {
  const dim = [w, h, d]; r = Math.max(1e-5, Math.min(r, Math.min(w, h, d) * 0.499));
  const S = dim.map(L => axisSamples(L, r, n, cell));
  const pos = [], nor = [], uv = [], idx = [], p = [0, 0, 0], c = [0, 0, 0];
  for (const [na, ua, va, sg] of [[0, 1, 2, 1], [0, 2, 1, -1], [1, 2, 0, 1], [1, 0, 2, -1], [2, 0, 1, 1], [2, 1, 0, -1]]) {
    const su = S[ua], sv = S[va], base = pos.length / 3;
    for (let j = 0; j < sv.length; j++) for (let i = 0; i < su.length; i++) {
      p[na] = sg * dim[na] / 2; p[ua] = su[i]; p[va] = sv[j];
      let l = 0;
      for (let k = 0; k < 3; k++) { const lim = dim[k] / 2 - r; c[k] = Math.max(-lim, Math.min(lim, p[k])); l += (p[k] - c[k]) * (p[k] - c[k]); }
      l = Math.sqrt(l) || 1;
      for (let k = 0; k < 3; k++) { const q = (p[k] - c[k]) / l; nor.push(q); pos.push(c[k] + q * r); }
      uv.push(0, 0);
    }
    for (let j = 0; j < sv.length - 1; j++) for (let i = 0; i < su.length - 1; i++) {
      const a = base + j * su.length + i, b = a + 1, e = a + su.length, f = e + 1;
      idx.push(a, b, f, a, f, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}
export function basis(axis) {
  const a = new THREE.Vector3(axis[0], axis[1], axis[2]).normalize();
  const u = new THREE.Vector3(0, 0, 1).cross(a); if (u.lengthSq() < 1e-6) u.set(1, 0, 0).cross(a); u.normalize();
  const v = a.clone().cross(u).normalize();
  return [u, v, a];
}
export function circlePts(c, axis, R, n, phase = 0) {
  const [u, v] = basis(axis), out = [];
  for (let i = 0; i < n; i++) { const t = phase + i / n * PI * 2; out.push([c[0] + (u.x * Math.cos(t) + v.x * Math.sin(t)) * R, c[1] + (u.y * Math.cos(t) + v.y * Math.sin(t)) * R, c[2] + (u.z * Math.cos(t) + v.z * Math.sin(t)) * R]); }
  return out;
}

export class Kit {
  constructor() { this.groups = []; this.meta = {}; }
  // part: 解説上のパーツID。origin: 回転や分解の基準点。explode: 分解表示での移動量
  grp(part, origin, explode = [0, 0, 0], opt = {}) {
    const g = { part, origin: origin.slice(), explode: explode.slice(), parent: opt.parent ? opt.parent.idx : -1, name: opt.name || '', internal: !!opt.internal, skin: !!opt.skin, inner: !!opt.inner, items: [], idx: this.groups.length };
    this.groups.push(g); return g;
  }
  add(g, geo, mat, flags) { g.items.push({ geo, mat, flags: flags || null }); return geo; }
  // 角を丸めた箱。寸法は X,Y,Z。o.axis を与えると箱のY軸をその向きに合わせる
  box(w, h, d, pos, o = {}) {
    const r = o.r ?? Math.min(0.006, Math.min(w, h, d) * 0.18);
    const geo = rbox(w, h, d, r, o.n ?? 1, o.cell ?? (Math.max(w, h, d) > 0.11 ? 0.055 : 0));
    if (o.rot) { _e.set(o.rot[0], o.rot[1], o.rot[2]); geo.applyQuaternion(_q.setFromEuler(_e)); }
    if (o.axis) orient(geo, o.axis, o.roll);
    geo.translate(pos[0], pos[1], pos[2]);
    return uvBox(geo);
  }
  // 回転体。pts=[[半径,軸方向の位置],...]。既定では折れ点を硬いエッジにする
  lathe(pts, pos, axis, o = {}) {
    const P = [];
    pts.forEach((p, i) => {
      const cur = new THREE.Vector2(Math.max(p[0], 1e-5), p[1]);
      if (i > 0) {      // 長い母線は途中にも頂点を置く（AOや波打ちを面の途中でも表現するため）
        const prev = P[P.length - 1], L = prev.distanceTo(cur), n = Math.ceil(L / 0.045) - 1;
        for (let k = 1; k <= n; k++) P.push(prev.clone().lerp(cur, k / (n + 1)));
      }
      P.push(cur); if (!o.smooth && i > 0 && i < pts.length - 1) P.push(cur.clone());
    });
    const geo = new THREE.LatheGeometry(P, o.seg ?? 32, o.phi0 ?? 0, o.arc ?? PI * 2);
    if (!o.keepUV) {
      // UVをm単位にする（u=周長、v=母線に沿った長さ）
      let len = 0, rs = 0; const cum = [0];
      for (let i = 1; i < P.length; i++) { len += P[i].distanceTo(P[i - 1]); cum.push(len); rs += P[i].x; }
      const rAvg = rs / Math.max(1, P.length - 1), uv = geo.attributes.uv, row = P.length;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * PI * rAvg, cum[i % row]);
    }
    orient(geo, axis, o.roll);
    geo.translate(pos[0], pos[1], pos[2]);
    return geo;
  }
  // 面取りした円柱（中実）。pos から axis 方向へ h だけ伸びる
  cyl(r, h, pos, axis, o = {}) {
    const r2 = o.r2 ?? r, c = Math.min(o.ch ?? 0.0025, r * 0.3, h * 0.3);
    return this.lathe([[0, 0], [r - c, 0], [r, c], [r2, h - c], [r2 - c, h], [0, h]], pos, axis, o);
  }
  // 中空の筒
  pipe(ro, ri, h, pos, axis, o = {}) {
    const ro2 = o.ro2 ?? ro, ri2 = o.ri2 ?? ri;
    return this.lathe([[ri, 0], [ro, 0], [ro2, h], [ri2, h], [ri, 0]], pos, axis, o);
  }
  sph(r, pos, o = {}) {
    const geo = new THREE.SphereGeometry(r, o.seg ?? 28, o.seg2 ?? Math.round((o.seg ?? 28) * 0.6), 0, PI * 2, o.th0 ?? 0, o.th ?? PI);
    scaleUV(geo, 2 * PI * r, PI * r);
    if (o.scale) geo.scale(o.scale[0], o.scale[1], o.scale[2]);
    orient(geo, o.axis); geo.translate(pos[0], pos[1], pos[2]);
    return geo;
  }
  torus(R, r, pos, axis, o = {}) {
    const geo = new THREE.TorusGeometry(R, r, o.tub ?? 8, o.seg ?? 40, o.arc ?? PI * 2);
    geo.rotateX(PI / 2); scaleUV(geo, 2 * PI * R, 2 * PI * r);
    orient(geo, axis); geo.translate(pos[0], pos[1], pos[2]);
    return geo;
  }
  // 配管・ケーブル。pts は絶対座標の通過点
  tube(pts, r, o = {}) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', o.tension ?? 0.35);
    const len = curve.getLength();
    const geo = new THREE.TubeGeometry(curve, o.seg ?? Math.max(8, Math.round(len / 0.02)), r, o.rad ?? 6, false);
    return scaleUV(geo, len, 2 * PI * r);
  }
  // 円板（テクスチャのUVは0..1のまま）
  disc(r, pos, axis, o = {}) {
    const geo = new THREE.CircleGeometry(r, o.seg ?? 48);
    geo.rotateX(-PI / 2); orient(geo, axis, o.roll); geo.translate(pos[0], pos[1], pos[2]);
    return geo;
  }
  // 平板（UVは0..1）。法線が axis を向く。w は u 方向、h は v 方向
  plate(w, h, pos, o = {}) {
    const geo = new THREE.PlaneGeometry(w, h, o.sx ?? 1, o.sy ?? 1);
    if (o.rot) { _e.set(o.rot[0], o.rot[1], o.rot[2]); geo.applyQuaternion(_q.setFromEuler(_e)); }
    geo.translate(pos[0], pos[1], pos[2]);
    return geo;
  }
  // 六角ボルトの頭をまとめて置く
  bolts(g, pts, axis, o = {}) {
    for (const p of pts) {
      const geo = new THREE.CylinderGeometry(o.r ?? 0.0038, o.r ?? 0.0038, o.h ?? 0.003, 6);
      geo.translate(0, (o.h ?? 0.003) / 2, 0); orient(geo, axis); geo.translate(p[0], p[1], p[2]);
      this.add(g, geo, o.mat ?? 'bolt');
    }
  }
  // 断熱材で包んだ箱
  mliBox(w, h, d, pos, o = {}) {
    const geo = rbox(w, h, d, o.r ?? 0.014, 2, o.cell ?? 0.035);
    geo.translate(pos[0], pos[1], pos[2]);
    crinkle(geo, o.amp ?? 1);
    return uvBox(geo);
  }
  // 機器の付け根を覆う断熱材の襟
  collar(R, pos, axis, o = {}) {
    const geo = this.torus(R, o.r ?? 0.012, pos, axis, { seg: 36, tub: 8 });
    return crinkle(geo, 0.6);
  }
  finalize() {
    return this.groups.map(g => {
      const by = new Map();
      for (const it of g.items) {
        const key = it.mat + (it.flags && it.flags.sep ? '#' + it.flags.sep : '');
        if (!by.has(key)) by.set(key, []);
        by.get(key).push(it);
      }
      const meshes = [];
      for (const [, list] of by) {
        const geos = list.map(it => {
          let geo = it.geo;
          for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
          if (!geo.index) { const idx = new Uint32Array(geo.attributes.position.count); for (let i = 0; i < idx.length; i++) idx[i] = i; geo.setIndex(new THREE.BufferAttribute(idx, 1)); }
          geo.translate(-g.origin[0], -g.origin[1], -g.origin[2]);
          return geo;
        });
        const geo = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
        if (!geo) throw new Error('merge failed: ' + g.part + '/' + list[0].mat);
        meshes.push({ mat: list[0].mat, geo, flags: list[0].flags || {} });
      }
      return { part: g.part, name: g.name, origin: g.origin, explode: g.explode, parent: g.parent, internal: g.internal, skin: g.skin, inner: g.inner, meshes };
    });
  }
}
