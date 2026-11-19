// 実データを使う背景：星（実際の位置と明るさ）、地球（NASAの画像）、イトカワ（実測の形状と地図）、M-Vロケット
import * as THREE from 'three';
import { STARS, STAR_N } from '../assets/stars_data.js';
import { ITO_MIN, ITO_MAX, ITO_NV, ITO_POS, ITO_NOR, ITO_UV, ITO_IDX } from '../assets/itokawa_data.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm3, noise3, rng } from './hb_core.js';

const LOGV = `#include <common>
#include <logdepthbuf_pars_vertex>`;
const LOGF = `#include <logdepthbuf_pars_fragment>`;
const PI = Math.PI;
function b64(s) { const bin = atob(s), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; }

// ================= 太陽 =================
export function makeSun(T) {
  const g = new THREE.Group();
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  core.material.color.setScalar(4);
  core.scale.setScalar(1);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: 0xffe2b0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.32 }));
  halo.scale.setScalar(4);
  g.add(halo, core);
  g.core = core; g.halo = halo;
  return g;
}

// ================= 汎用パーティクル =================
export class Particles {
  constructor(max, tex, { additive = true, sizeScale = 1 } = {}) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3); this.alpha = new Float32Array(max); this.size = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.grow = new Float32Array(max); this.a0 = new Float32Array(max);
    this.drag = 0; this.gravity = new THREE.Vector3();
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3); this.aPos.setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3); this.aCol.setUsage(THREE.DynamicDrawUsage);
    this.aA = new THREE.BufferAttribute(this.alpha, 1); this.aA.setUsage(THREE.DynamicDrawUsage);
    this.aS = new THREE.BufferAttribute(this.size, 1); this.aS.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos); geo.setAttribute('pcolor', this.aCol); geo.setAttribute('palpha', this.aA); geo.setAttribute('psize', this.aS);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uScale: { value: 500 }, uMax: { value: 600 } },
      vertexShader: `${LOGV}
        attribute vec3 pcolor; attribute float palpha; attribute float psize; uniform float uScale; uniform float uMax;
        varying vec3 vC; varying float vA;
        void main(){ vC=pcolor; vA=palpha; vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_PointSize = min(uMax, psize*uScale/max(0.001,-mv.z)); gl_Position=projectionMatrix*mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `${LOGF}
        uniform sampler2D map; varying vec3 vC; varying float vA;
        void main(){
        #include <logdepthbuf_fragment>
        vec4 t=texture2D(map, gl_PointCoord); gl_FragColor=vec4(vC*t.rgb, t.a*vA); if(gl_FragColor.a<0.003) discard; }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    geo.setDrawRange(0, 0);
    this.sizeScale = sizeScale;
  }
  emit(fn) {
    if (this.n >= this.max) { this._kill(0); }
    const i = this.n++;
    const p = { pos: [0, 0, 0], vel: [0, 0, 0], col: [1, 1, 1], alpha: 1, size: 1, life: 1, grow: 0 };
    fn(p);
    this.pos.set(p.pos, i * 3); this.vel.set(p.vel, i * 3); this.col.set(p.col, i * 3);
    this.a0[i] = p.alpha; this.size[i] = p.size; this.life[i] = 0; this.maxLife[i] = p.life; this.grow[i] = p.grow;
  }
  _kill(i) {
    const j = --this.n;
    if (i !== j) {
      this.pos.copyWithin(i * 3, j * 3, j * 3 + 3); this.vel.copyWithin(i * 3, j * 3, j * 3 + 3); this.col.copyWithin(i * 3, j * 3, j * 3 + 3);
      this.a0[i] = this.a0[j]; this.size[i] = this.size[j]; this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j]; this.grow[i] = this.grow[j];
    }
  }
  clear() { this.n = 0; this.points.geometry.setDrawRange(0, 0); }
  update(dt, camera, renderer) {
    const d = Math.exp(-this.drag * dt);
    for (let i = 0; i < this.n; i++) {
      this.life[i] += dt;
      if (this.life[i] >= this.maxLife[i]) { this._kill(i); i--; continue; }
      const k = i * 3;
      this.vel[k] = this.vel[k] * d + this.gravity.x * dt; this.vel[k + 1] = this.vel[k + 1] * d + this.gravity.y * dt; this.vel[k + 2] = this.vel[k + 2] * d + this.gravity.z * dt;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = this.a0[i] * Math.min(1, t * 8) * (1 - t) * (1 - t * 0.3);
      this.size[i] = Math.max(0.001, this.size[i] + this.grow[i] * dt);
    }
    this.points.geometry.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aA.needsUpdate = this.aS.needsUpdate = true;
    if (camera && renderer) {
      const h = renderer.domElement.height;
      this.mat.uniforms.uScale.value = this.sizeScale * h * 0.5 / Math.tan(camera.fov * Math.PI / 360);
    }
  }
}

// 緯度経度から地球表面の向き（SphereGeometryのUVに合わせる）
export function latLonDir(lat, lon) {
  const th = (90 - lat) * Math.PI / 180, ph = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th));
}

// ================= 空（昼→宇宙） =================
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uDark: { value: 0 }, uSun: { value: new THREE.Vector3(0.3, 0.6, -0.7).normalize() }, uTint: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: `${LOGV}
      varying vec3 vD; void main(){ vD = normalize(position); vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `${LOGF}
      uniform float uDark; uniform vec3 uSun; uniform vec3 uTint; varying vec3 vD;
      void main(){
      #include <logdepthbuf_fragment>
      float h = vD.y;
      vec3 zen = vec3(0.06,0.18,0.48), hor = vec3(0.50,0.62,0.78);
      vec3 c = mix(hor, zen, pow(max(h,0.0),0.55));
      if(h<0.0) c = mix(hor, vec3(0.25,0.33,0.40), min(1.0,-h*6.0));
      float s = max(0.0, dot(vD, uSun)); c += vec3(1.0,0.9,0.7)*pow(s,40.0)*0.6 + vec3(1.0,0.85,0.6)*pow(s,4.0)*0.15;
      c *= uTint;
      c = mix(c, vec3(0.0), uDark*smoothstep(-0.2,0.6,h+uDark*0.5));
      gl_FragColor = vec4(c, 1.0); }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(300000, 48, 24), mat); m.renderOrder = -12; m.frustumCulled = false;
  return m;
}

// ================= 打ち上げ場（内之浦：海に面した丘の上の発射場） =================
export function makeLaunchSite(T) {
  const g = new THREE.Group(), PIv = Math.PI;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  // 地形：中央は平らな台地、海側（-Z）は崖、まわりは丘
  const gt = T.grassC.clone(); gt.repeat.set(160, 160); gt.needsUpdate = true;
  const tg = new THREE.PlaneGeometry(5000, 5000, 150, 150), tp = tg.attributes.position, tc = new Float32Array(tp.count * 3);
  const hAt = (x, z) => {
    const d = Math.hypot(x, z), flat = Math.min(1, Math.max(0, (d - 70) / 260)), sea = Math.min(1, Math.max(0, (-z - 420) / 260));
    const hills = (fbm3(x * 0.0016 + 4, z * 0.0016, 2.2, 4) - 0.42) * 420 * flat * flat + Math.max(0, z) * 0.05 * flat;
    return hills * (1 - sea) - sea * 62;
  };
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = -tp.getY(i), h = hAt(x, z); tp.setZ(i, h);
    const k = 0.75 + 0.5 * fbm3(x * 0.004 + 9, z * 0.004, 1.3, 3), rock = h < -8 ? 1 : 0;
    tc.set(rock ? [0.55, 0.5, 0.42] : [0.72 * k, 0.9 * k, 0.6 * k], i * 3);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(tc, 3)); tg.computeVertexNormals();
  const ground = new THREE.Mesh(tg, std({ map: gt, roughness: 1, vertexColors: true })); ground.rotation.x = -PIv / 2; ground.receiveShadow = true; g.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(90000, 90000), std({ color: 0x163a5a, roughness: 0.22, metalness: 0.35 }));
  sea.rotation.x = -PIv / 2; sea.position.set(0, -55, -30000); g.add(sea);
  // 発射台のコンクリート面と火炎をそらす溝
  const conc = std({ color: 0x77766f, roughness: 0.95 }), steel = std({ color: 0xc4c6ca, metalness: 0.6, roughness: 0.4 }), red = std({ color: 0xa82a20, roughness: 0.55 }), white = std({ color: 0xb9b8b2, roughness: 0.7 });
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  box(70, 1, 70, conc, 0, 0.5, 0); box(9, 0.4, 26, std({ color: 0x55544f, roughness: 1 }), 0, 1.05, -10);
  // ---------- M型ロケット発射装置：旋回台、傾けて使う赤いブーム、整備塔 ----------
  const redD = std({ color: 0x8e2019, roughness: 0.6 }), yellow = std({ color: 0xd9a21b, roughness: 0.6 }), darkM = std({ color: 0x2a2c30, roughness: 0.7, metalness: 0.3 }), glass = std({ color: 0x1c2a36, roughness: 0.2, metalness: 0.6 });
  const strutTo = (parent, p0, p1, r, mat, seg = 6) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, p0.distanceTo(p1), seg), mat); m.position.copy(p0).add(p1).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(P(0, 1, 0), p1.clone().sub(p0).normalize()); m.castShadow = true; parent.add(m); return m; };
  const boxTo = (parent, w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  const turn = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 9.2, 3.4, 40), steel); turn.position.y = 2.7; turn.castShadow = turn.receiveShadow = true; g.add(turn);
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 9.6, 0.5, 40), conc); m.position.y = 1.25; m.receiveShadow = true; g.add(m); }
  for (let i = 0; i < 24; i++) { const a = i / 24 * PIv * 2; boxTo(g, 0.5, 0.5, 0.5, darkM, Math.cos(a) * 8.9, 4.45, Math.sin(a) * 8.9); }
  const boom = new THREE.Group(); boom.position.set(0, 4.4, 0); g.add(boom);
  { const x0 = -2.6, x1 = -5.4, zz = 1.3, HB = 37, nb = 10, dy = HB / nb, C = [[x0, -zz], [x0, zz], [x1, zz], [x1, -zz]];
    for (const [x, z] of C) strutTo(boom, P(x, 0, z), P(x, HB, z), 0.24, red, 8);                                    // 4本の主柱
    for (let i = 0; i <= nb; i++) { const y = i * dy; for (let k = 0; k < 4; k++) { const a = C[k], b = C[(k + 1) % 4]; strutTo(boom, P(a[0], y, a[1]), P(b[0], y, b[1]), 0.13, red);
        if (i < nb) { const up = (i + k) % 2; strutTo(boom, P(a[0], y + (up ? 0 : dy), a[1]), P(b[0], y + (up ? dy : 0), b[1]), 0.1, redD); } } }
    boxTo(boom, 0.5, HB - 1.5, 0.7, steel, x0 + 0.55, HB / 2 + 0.4, 0);                                                // ロケットが滑るレール
    for (const y of [3.1, 13.8]) { boxTo(boom, 0.9, 0.7, 1.5, darkM, -1.75, y, 0); boxTo(boom, 0.5, 1.1, 1.9, steel, -2.3, y, 0); }   // レールの上でロケットを支える金具
    for (const y of [9.5, 17, 23.5, 30]) { boxTo(boom, 0.14, 2.8, 4.4, steel, x1 - 0.5, y + 1.2, 0); strutTo(boom, P(x1, y, -1.6), P(x1 - 0.5, y, -1.6), 0.07, darkM); strutTo(boom, P(x1, y, 1.6), P(x1 - 0.5, y, 1.6), 0.07, darkM); }   // 整備のときに倒す足場（たたんだ状態）
    for (const z of [-0.9, 0.9]) { strutTo(boom, P(-11.5, -0.6, z * 2.2), P(x1, 15.5, z), 0.34, steel, 12); strutTo(boom, P(-11.5, -0.6, z * 2.2), P(x1, 15.5, z).lerp(P(-11.5, -0.6, z * 2.2), 0.45), 0.5, darkM, 12); }   // ブームを傾ける油圧シリンダ
    for (let i = 0; i < 3; i++) strutTo(boom, P(x0 + 0.2, 1, -1.05 + i * 0.3), P(x0 + 0.2, 26 - i * 4, -1.05 + i * 0.3), 0.045, darkM);     // 配線の束
    boxTo(boom, 6.5, 2.6, 6, std({ color: 0x6d7075, roughness: 0.8 }), -8.6, 0.6, 0); boxTo(boom, 3.2, 0.5, 3.4, steel, (x0 + x1) / 2, HB + 0.25, 0);
    strutTo(boom, P((x0 + x1) / 2, HB + 0.5, 0), P((x0 + x1) / 2, HB + 4.5, 0), 0.06, steel); }
  // 整備塔：打ち上げ前はこの中でロケットを立てて組み立てる。発射台の側に、背の高い出入り口がある
  { const tx = -36, tz = 12, tw = 20, th = 47;
    box(tw, th, tw, white, tx, th / 2, tz);
    for (let i = 1; i < 10; i++) box(tw + 0.12, 0.16, tw + 0.12, std({ color: 0x8f959c, roughness: 0.7 }), tx, i * 4.7, tz);
    for (const k of [-1, 1]) for (let i = 0; i < 4; i++) box(0.14, th, 0.5, std({ color: 0x9aa0a8, roughness: 0.7 }), tx + tw / 2 + 0.05, th / 2, tz + k * (2.5 + i * 2.2) + k * 3.2);
    box(0.5, 41, 9.6, darkM, tx + tw / 2 - 0.1, 20.5, tz);                                         // 出入り口（開いている）
    for (const k of [-1, 1]) box(0.5, 41, 4.9, std({ color: 0xc9c8c1, roughness: 0.7 }), tx + tw / 2 + 0.35, 20.5, tz + k * 7.4);   // 左右へ引いた扉
    box(tw + 0.2, 4.2, tw + 0.2, red, tx, th - 2.4, tz); box(tw + 0.2, 1.2, tw + 0.2, std({ color: 0xe9e8e2, roughness: 0.7 }), tx, th - 5.2, tz);
    box(7, 3.4, 6, white, tx - 3, th + 1.7, tz + 3); box(1.4, 1.4, 12, yellow, tx + 5, th + 1.2, tz);             // 屋上の機械室とクレーンの梁
    strutTo(g, P(tx - 8, th, tz - 8), P(tx - 8, th + 9, tz - 8), 0.09, steel);
    for (let i = 0; i < 9; i++) box(2.4, 0.2, 5.4, std({ color: 0x8f959c, roughness: 0.7 }), tx - tw / 2 - 1.2, 2.6 + i * 5, tz - 4 + (i % 2) * 0.01);   // 外階段の踊り場
    for (let i = 0; i < 9; i++) strutTo(g, P(tx - tw / 2 - 1.2, 2.6 + i * 5, tz - 6.4 + (i % 2) * 4.8), P(tx - tw / 2 - 1.2, 7.6 + i * 5, tz - 1.6 - (i % 2) * 4.8), 0.14, steel);
    for (let i = 0; i < 6; i++) box(0.2, 1.6, 2.6, glass, tx + tw / 2 + 0.02, 6 + i * 7, tz - 8.2); }
  // 火炎をそらす斜面と溝
  { const def = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 5.4, 4.6, 4, 1), std({ color: 0x4f4d48, roughness: 1 })); def.rotation.y = PIv / 4; def.scale.set(1, 1, 1.6); def.position.set(0, 1.9, -13.5); def.castShadow = def.receiveShadow = true; g.add(def);
    box(11, 0.5, 30, std({ color: 0x3b3a37, roughness: 1 }), 0, 1.0, -24); for (const k of [-1, 1]) box(0.8, 2.2, 30, conc, k * 5.9, 1.6, -24); }
  // 組立室、門型クレーン、管制の建物、道路
  { const hall = std({ color: 0xd9d6cc, roughness: 0.8 }), roof = std({ color: 0x7c8a93, roughness: 0.6, metalness: 0.3 });
    box(34, 13, 20, hall, 58, 6.5, -46); const rfG = new THREE.Group(); rfG.position.set(58, 13, -46); rfG.scale.y = 0.34; const rf = new THREE.Mesh(new THREE.BoxGeometry(34.6, 14.4, 14.4), roof); rf.rotation.x = PIv / 4; rf.castShadow = true; rfG.add(rf); g.add(rfG);
    box(0.3, 10, 9, darkM, 40.9, 5, -46); for (let i = 0; i < 6; i++) box(3, 2, 0.2, glass, 46 + i * 4.8, 9, -35.95);
    box(16, 6, 11, std({ color: 0xcfccc2, roughness: 0.8 }), 62, 3, 6); for (let i = 0; i < 5; i++) box(2, 1.4, 0.2, glass, 56.5 + i * 2.8, 4, 0.45);
    for (const z of [-50, -22]) { for (const x of [24, 42]) strutTo(g, P(x, 1, z), P(x, 20, z), 0.5, yellow, 8); strutTo(g, P(22, 20, z), P(44, 20, z), 0.6, yellow, 8); }
    for (const x of [24, 42]) strutTo(g, P(x, 20, -50), P(x, 20, -22), 0.45, yellow, 8); box(3, 2.2, 3, yellow, 33, 19.4, -36); strutTo(g, P(33, 18.3, -36), P(33, 11, -36), 0.05, darkM);
    box(9, 0.12, 120, std({ color: 0x3e3f42, roughness: 1 }), 21, 1.02, 70); box(120, 0.12, 8, std({ color: 0x3e3f42, roughness: 1 }), 70, 1.02, 58);
    for (let i = 0; i < 26; i++) { const a = PIv * 0.15 + i / 26 * PIv * 1.7, r = 33.5; strutTo(g, P(Math.cos(a) * r, 1, Math.sin(a) * r), P(Math.cos(a) * r, 2.3, Math.sin(a) * r), 0.06, steel); }
    const rail = new THREE.Mesh(new THREE.TorusGeometry(33.5, 0.05, 6, 120, PIv * 1.7), steel); rail.rotation.x = PIv / 2; rail.rotation.z = -PIv * 0.15 - PIv * 1.7; rail.position.y = 2.3; g.add(rail); }
  // 避雷鉄塔（上へ細くなる骨組み）
  for (const [x, z] of [[30, -26], [-30, -30], [-62, 52]]) { const H2 = 64, n = 10; const cnr = (k, t) => { const w = 2.6 * (1 - t) + 0.3; return P(x + (k % 2 ? w : -w), 1 + t * H2, z + (k < 2 ? w : -w)); };
    for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n; for (let k = 0; k < 4; k++) { strutTo(g, cnr(k, t0), cnr(k, t1), 0.13, i % 2 ? white : red); const k2 = [1, 3, 0, 2][k]; strutTo(g, cnr(k, t0), cnr(k2, t1), 0.06, steel); strutTo(g, cnr(k, t1), cnr(k2, t1), 0.06, steel); } }
    strutTo(g, P(x, 1 + H2, z), P(x, H2 + 8, z), 0.07, steel); }
  // 森（丘の木立ち）
  let tg2 = new THREE.IcosahedronGeometry(1, 2); tg2.deleteAttribute('normal'); tg2.deleteAttribute('uv'); tg2 = mergeVertices(tg2);
  { const p2 = tg2.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p2.count; i++) { v.fromBufferAttribute(p2, i); const k = 0.75 + 0.5 * fbm3(v.x * 2.2 + 1, v.y * 2.2, v.z * 2.2, 3); p2.setXYZ(i, v.x * k, v.y * k, v.z * k); } tg2.computeVertexNormals(); }
  const trees = new THREE.InstancedMesh(tg2, std({ color: 0xffffff, roughness: 1 }), 1500);
  const R = rng(31), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(); let n = 0, guard = 0;
  while (n < 1500 && guard++ < 40000) {
    const a = R() * PIv * 2, d = 150 + Math.pow(R(), 0.7) * 1300, x = Math.cos(a) * d, z = Math.sin(a) * d, h = hAt(x, z); if (h < -4) continue;
    if (fbm3(x * 0.006 + 2, z * 0.006, 7.7, 3) < 0.5) continue;                    // 木立ちはかたまって生える
    const s = 4 + R() * 6; m4.compose(P(x, h + s * 0.6, z), q.setFromEuler(new THREE.Euler(0, R() * 6, 0)), P(s * (0.9 + R() * 0.5), s * (0.9 + R() * 0.6), s * (0.9 + R() * 0.5)));
    trees.setMatrixAt(n, m4); const L = 0.5 + R() * 0.5; trees.setColorAt(n, col.setRGB(0.1 * L, 0.2 * L, 0.08 * L)); n++;
  }
  trees.count = n; trees.castShadow = true; g.add(trees);
  g.boom = boom;
  return g;
}

// ================= 臼田64mアンテナ =================
export function makeBigAntenna() {
  const g = new THREE.Group(), PIv = Math.PI;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const white = std({ color: 0xe4e5e2, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide });
  const steel = std({ color: 0xaeb2b8, roughness: 0.5, metalness: 0.45 });
  const dark = std({ color: 0x4d5158, roughness: 0.6, metalness: 0.4 });
  const conc = std({ color: 0x8b8a84, roughness: 0.9 });
  const Rd = 32, F = 27, zp = (r) => r * r / (4 * F);
  const box = (w, h, d, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = m.receiveShadow = true; return m; };
  const strut = (p0, p1, r, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, p0.distanceTo(p1), 8), mat); m.position.copy(p0).add(p1).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize()); m.castShadow = true; return m; };
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  const dishG = new THREE.Group(); dishG.position.set(0, 40, 0); g.add(dishG);
  // 主鏡
  const pts = []; for (let i = 0; i <= 48; i++) { const r = 2.6 + (Rd - 2.6) * i / 48; pts.push(new THREE.Vector2(r, zp(r))); }
  const dish = new THREE.Mesh(new THREE.LatheGeometry(pts, 120), white); dish.castShadow = dish.receiveShadow = true; dishG.add(dish);
  // 鏡面パネルの継ぎ目と、裏側の骨組み（線で描く）
  const seam = [], truss = [];
  for (const r of [6, 10, 14, 18, 22, 26, 29.5, 32]) for (let k = 0; k < 96; k++) { const a0 = k / 96 * PIv * 2, a1 = (k + 1) / 96 * PIv * 2; seam.push(Math.cos(a0) * r, zp(r) + 0.04, Math.sin(a0) * r, Math.cos(a1) * r, zp(r) + 0.04, Math.sin(a1) * r); }
  for (let k = 0; k < 48; k++) { const a = k / 48 * PIv * 2, r0 = k % 2 ? 10 : 2.6; for (let i = 0; i < 12; i++) { const ra = r0 + (Rd - r0) * i / 12, rb = r0 + (Rd - r0) * (i + 1) / 12; seam.push(Math.cos(a) * ra, zp(ra) + 0.04, Math.sin(a) * ra, Math.cos(a) * rb, zp(rb) + 0.04, Math.sin(a) * rb); } }
  const low = (r) => -7.5 + (zp(31) - 1.0 + 7.5) * Math.pow((r - 3) / 28, 1.25);
  for (let k = 0; k < 32; k++) {
    const a = k / 32 * PIv * 2, c = Math.cos(a), sn = Math.sin(a), n = 9;
    for (let i = 0; i < n; i++) {
      const ra = 3 + 28 * i / n, rb = 3 + 28 * (i + 1) / n, ua = zp(ra) - 0.35, ub = zp(rb) - 0.35, la = low(ra), lb = low(rb);
      truss.push(c * ra, la, sn * ra, c * rb, lb, sn * rb, c * ra, ua, sn * ra, c * ra, la, sn * ra, c * ra, la, sn * ra, c * rb, ub, sn * rb);
      if (i === n - 1) truss.push(c * rb, ub, sn * rb, c * rb, lb, sn * rb);
      const a2 = (k + 1) / 32 * PIv * 2; truss.push(c * rb, lb, sn * rb, Math.cos(a2) * rb, lb, Math.sin(a2) * rb);
    }
  }
  const lineOf = (arr, color, op) => { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); return new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })); };
  dishG.add(lineOf(seam, 0x7b8088, 0.55), lineOf(truss, 0x9aa0a8, 0.8));
  for (const r of [10, 20, 31]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.28, 6, 96), steel); t.rotation.x = PIv / 2; t.position.y = low(r); dishG.add(t); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 3.4, 8, 32), steel); hub.position.y = -4; hub.castShadow = true; dishG.add(hub);
  // 副鏡と4本の支柱、給電部
  const subY = F - 3.5;
  for (let k = 0; k < 4; k++) { const a = k * PIv / 2 + PIv / 4; dishG.add(strut(P(Math.cos(a) * 21, zp(21), Math.sin(a) * 21), P(Math.cos(a) * 3.0, subY + 0.6, Math.sin(a) * 3.0), 0.32, steel)); }
  const sub = new THREE.Mesh(new THREE.SphereGeometry(5.2, 40, 12, 0, PIv * 2, 0, 0.66), white); sub.rotation.x = PIv; sub.position.y = subY + 4.1; dishG.add(sub);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.6, 8.5, 28), white); feed.position.y = 4.2; feed.castShadow = true; dishG.add(feed);
  // 仰角を変える歯車と軸
  const gear = new THREE.Mesh(new THREE.TorusGeometry(15, 0.55, 8, 64, PIv), dark); gear.rotation.set(0, PIv / 2, PIv); gear.position.y = -7.5; dishG.add(gear);
  for (const a of [-0.9, 0, 0.9]) dishG.add(strut(P(0, -7.5, 0), P(0, -7.5 - Math.cos(a) * 15, Math.sin(a) * 15), 0.3, dark));
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 30, 20), steel); axle.rotation.z = PIv / 2; axle.position.y = -7.5; dishG.add(axle);
  dishG.rotation.set(0.72, 0, 0); dishG.rotation.order = 'YXZ'; dishG.rotation.y = 0.5;
  // 架台（左右の支柱と回転台）
  const mount = new THREE.Group(); mount.rotation.y = 0.5; g.add(mount);
  const topY = 40 - 7.5 * Math.cos(0.72);
  for (const sx of [-1, 1]) {
    const tp = P(sx * 13.5, topY, -7.5 * Math.sin(0.72) * 0 - 5.2);
    mount.add(strut(P(sx * 13.5, 4, 10), tp, 1.0, steel), strut(P(sx * 13.5, 4, -17), tp, 1.0, steel), strut(P(sx * 13.5, 4, 10), P(sx * 13.5, 4, -17), 0.7, steel));
    mount.add(strut(P(sx * 13.5, 18, 2.6), P(sx * 13.5, 18, -11), 0.5, steel), strut(P(sx * 13.5, 4, -3.5), tp, 0.55, steel));
    const bx = box(3.2, 3.2, 4.4, dark); bx.position.copy(tp); mount.add(bx);
  }
  for (const z of [10, -17]) mount.add(strut(P(-13.5, 4, z), P(13.5, 4, z), 0.7, steel));
  mount.add(strut(P(-13.5, 4, 10), P(13.5, 4, -17), 0.45, steel), strut(P(13.5, 4, 10), P(-13.5, 4, -17), 0.45, steel));
  const cabin = box(9, 5, 7, white); cabin.position.set(0, 7, -3.5); mount.add(cabin);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(19, 20, 3.4, 64), conc); base.position.y = 1.7; base.receiveShadow = true; g.add(base);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(17.5, 0.25, 6, 96), steel); rail.rotation.x = PIv / 2; rail.position.y = 3.5; g.add(rail);
  const bld = box(22, 7, 12, std({ color: 0x9c9a94, roughness: 0.9 })); bld.position.set(-44, 3.5, 14); g.add(bld);
  for (let i = 0; i < 5; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.9, 1.0) })); w.position.set(-52 + i * 4, 4.4, 20.02); g.add(w); }
  for (const [x, z] of [[-30, 26], [26, 30]]) { const l = new THREE.PointLight(0xffc98a, 900, 120, 1.6); l.position.set(x, 9, z); g.add(l); }
  // 地面と山
  const ground = new THREE.Mesh(new THREE.CircleGeometry(3000, 64), std({ color: 0x232a1e, roughness: 1 }));
  ground.rotation.x = -PIv / 2; ground.receiveShadow = true; g.add(ground);
  const Rr = rng(8), hg = new THREE.ConeGeometry(1, 1, 9, 3), hp = hg.attributes.position;
  for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i), k = 1 + (fbm3(x * 2 + 5, y * 2, z * 2, 3) - 0.5) * 0.7; hp.setXYZ(i, x * k, y, z * k); }
  hg.computeVertexNormals();
  const hills = new THREE.InstancedMesh(hg, std({ color: 0x10160f, roughness: 1 }), 46), m4 = new THREE.Matrix4();
  for (let i = 0; i < 46; i++) { const a = Rr() * PIv * 2, d = 650 + Rr() * 1300, w = 260 + Rr() * 420, h = 120 + Rr() * 330; m4.compose(P(Math.cos(a) * d, h / 2 - 6, Math.sin(a) * d), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Rr() * 6, 0)), P(w, h, w)); hills.setMatrixAt(i, m4); }
  g.add(hills);
  g.dish = dishG;
  return g;
}

// ================= 砂漠（ウーメラ） =================
export function makeDesert(T, night = false) {
  const g = new THREE.Group();
  const st = T.sandC.clone(); st.repeat.set(260, 260); st.needsUpdate = true; const sn = T.sandN.clone(); sn.repeat.set(260, 260); sn.needsUpdate = true;
  const geo = new THREE.PlaneGeometry(4000, 4000, 160, 160);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const d = Math.hypot(x, y); p.setZ(i, (fbm3(x * 0.004, y * 0.004, 1, 4) - 0.5) * 18 * Math.min(1, d / 60)); }
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: st, normalMap: sn, roughness: 1, color: night ? new THREE.Color(0.4, 0.75, 1.6) : new THREE.Color(0.7, 1.5, 3.2) }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
  // 低木（ソルトブッシュ）
  const bushGeo = new THREE.IcosahedronGeometry(1, 1);
  const bush = new THREE.InstancedMesh(bushGeo, new THREE.MeshStandardMaterial({ color: night ? 0x1a1e1a : 0x6f7a5c, roughness: 1, flatShading: true }), 700);
  const R = rng(17), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < 700; i++) {
    const a = R() * Math.PI * 2, d = 6 + Math.pow(R(), 0.7) * 600; v.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    v.y = (fbm3(v.x * 0.004, -v.z * 0.004, 1, 4) - 0.5) * 18 * Math.min(1, d / 60);
    const k = 0.4 + R() * 0.9; s.set(k * 1.3, k * 0.7, k * 1.2); q.setFromEuler(new THREE.Euler(0, R() * 6, 0));
    m.compose(v, q, s); bush.setMatrixAt(i, m);
  }
  bush.castShadow = true; bush.receiveShadow = true; g.add(bush);
  return g;
}
export function makeLandedCapsule() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.15, 0], [0.17, 0.08], [0.15, 0.16], [0.08, 0.2], [0, 0.21]].map(a => new THREE.Vector2(...a)), 48),
    new THREE.MeshStandardMaterial({ color: 0xc79a45, roughness: 0.42, metalness: 0.85 }));
  body.castShadow = true; body.receiveShadow = true; body.rotation.z = 0.5; body.position.y = 0.1; g.add(body);
  // パラシュート（地面に広がった布）
  const geo = new THREE.RingGeometry(0.04, 1.35, 48, 14); geo.scale(1.25, 0.82, 1); const p = geo.attributes.position;
  const cols = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const fold = Math.sin(x * 7 + fbm3(x, y, 1, 2) * 4) * 0.035 + (fbm3(x * 1.4, y * 1.4, 2, 3) - 0.45) * 0.22;
    const edge = Math.max(0, Math.hypot(x / 1.69, y / 1.1) - 0.7);
    p.setZ(i, Math.max(0.01, fold + 0.08 - edge * 0.35));
    const gore = Math.floor((Math.atan2(y, x) + Math.PI) / (Math.PI / 6)) % 2;
    const c = gore ? [0.82, 0.32, 0.16] : [0.78, 0.76, 0.72];
    cols.set(c, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const chute = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }));
  chute.rotation.x = -Math.PI / 2; chute.rotation.z = 0.3; chute.position.set(-2.6, 0.0, 0.7); chute.receiveShadow = true; chute.castShadow = true; g.add(chute);
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.3, 4), new THREE.MeshStandardMaterial({ color: 0x55524c, roughness: 0.9 }));
  line.rotation.z = Math.PI / 2; line.rotation.y = -0.3; line.position.set(-0.85, 0.06, 0.25); g.add(line);
  return g;
}

// ================= 微粒子（電子顕微鏡風） =================
export function makeGrains() {
  const g = new THREE.Group();
  let rg = new THREE.IcosahedronGeometry(1, 4); rg.deleteAttribute('normal'); rg.deleteAttribute('uv'); rg = mergeVertices(rg);
  const v = new THREE.Vector3(); const rp = rg.attributes.position;
  const geos = [];
  for (let s = 0; s < 4; s++) {
    const gg = rg.clone(); const pp = gg.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      v.fromBufferAttribute(rp, i);
      const ridge = 1 - Math.abs(noise3(v.x * 2.2 + s * 3, v.y * 2.2, v.z * 2.2) * 2 - 1);
      const k = 0.62 + 0.6 * fbm3(v.x * 1.3 + s * 7, v.y * 1.3, v.z * 1.3, 3) + 0.22 * ridge + 0.05 * noise3(v.x * 9, v.y * 9, v.z * 9);
      pp.setXYZ(i, v.x * k * 1.25, v.y * k * 0.8, v.z * k);
    }
    gg.computeVertexNormals(); geos.push(gg);
  }
  const mat = new THREE.MeshStandardMaterial({ color: 0x8c8880, roughness: 0.75, metalness: 0.0 });
  const R = rng(33);
  const list = [];
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Mesh(geos[i % 4], mat);
    const s = 0.15 + Math.pow(R(), 2.5) * 1.2;
    m.scale.setScalar(s); m.position.set((R() - 0.5) * 16, (R() - 0.5) * 9, (R() - 0.5) * 4 - 1);
    m.rotation.set(R() * 6, R() * 6, R() * 6); m.castShadow = m.receiveShadow = true;
    m.userData.spin = (R() - 0.5) * 0.2;
    g.add(m); list.push(m);
  }
  const big = new THREE.Mesh(geos[1], mat); big.scale.setScalar(2.3); big.position.set(0, 0, 0.5); big.castShadow = true; big.userData.spin = 0.08; g.add(big); list.push(big);
  g.grains = list;
  return g;
}

// ================= 軌道図（模式図） =================
// 1AU = 100
export function makeOrbitMap(T) {
  const g = new THREE.Group();
  const AU = 100;
  const yrs = [[0, 0], [0.25, 1.03], [0.45, 2.34], [0.56, 3.96], [1, 7.1]]; // s → 経過年
  const years = s => { for (let i = 1; i < yrs.length; i++) if (s <= yrs[i][0]) { const [s0, y0] = yrs[i - 1], [s1, y1] = yrs[i]; return y0 + (y1 - y0) * (s - s0) / (s1 - s0); } return 7.1; };
  const thE = s => years(s) * Math.PI * 2;
  const a = 1.324, e = 0.28, w = 3.53;
  const rI = th => a * (1 - e * e) / (1 + e * Math.cos(th - w));
  const thArr = 2 * Math.PI + 4.2;
  const thI = s => thArr + (years(s) - 2.34) * Math.PI * 2 / 1.52 * 0.9;
  const thDep = thI(0.56);
  let dTarget = 1.6 * Math.PI * 2; let delta = thE(1) - thDep; delta += Math.PI * 2 * Math.round((dTarget - delta) / (Math.PI * 2));
  function hayabusa(s) {
    let th, r;
    if (s <= 0.25) { const u = s / 0.25; th = u * 2 * Math.PI; r = 1 + 0.13 * Math.sin(u * Math.PI); }
    else if (s <= 0.45) { const u = (s - 0.25) / 0.2; th = 2 * Math.PI + u * 4.2; r = 1 + (rI(thArr) - 1) * u + 0.16 * Math.sin(u * Math.PI); }
    else if (s <= 0.56) { th = thI(s); r = rI(th); }
    else { const u = (s - 0.56) / 0.44; th = thDep + delta * u; r = rI(thDep) + (1 - rI(thDep)) * u + 0.1 * Math.sin(u * Math.PI); }
    return new THREE.Vector3(Math.cos(th) * r * AU, 0, -Math.sin(th) * r * AU);
  }
  const ring = (fn, color, rad = 0.35, seg = 512) => {
    const pts = []; for (let i = 0; i <= seg; i++) pts.push(fn(i / seg * Math.PI * 2));
    const curve = new THREE.CatmullRomCurve3(pts, true);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, seg, rad, 6, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }));
  };
  g.add(ring(th => new THREE.Vector3(Math.cos(th) * AU, 0, -Math.sin(th) * AU), 0x3d8bff));
  g.add(ring(th => { const r = rI(th); return new THREE.Vector3(Math.cos(th) * r * AU, Math.sin(th - w) * 2.5, -Math.sin(th) * r * AU); }, 0xb69a6a));
  const tp = []; for (let i = 0; i <= 1400; i++) tp.push(hayabusa(i / 1400));
  const trajGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tp), 1400, 0.32, 6, false);
  const traj = new THREE.Mesh(trajGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.72, 0.36) }));
  g.add(traj);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: new THREE.Color(3, 2.6, 2), blending: THREE.AdditiveBlending, depthWrite: false }));
  sun.scale.setScalar(40); g.add(sun);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(3.2, 32, 16), new THREE.MeshBasicMaterial({ color: 0x5aa7ff }));
  const ito = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 8), new THREE.MeshBasicMaterial({ color: 0xd8c39a }));
  const hb = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: new THREE.Color(3, 2.4, 1.2), blending: THREE.AdditiveBlending, depthWrite: false }));
  hb.scale.setScalar(9);
  g.add(earth, ito, hb);
  const idxCount = trajGeo.index.count;
  g.setProgress = (s) => {
    s = Math.max(0, Math.min(1, s));
    traj.geometry.setDrawRange(0, Math.floor(idxCount * s / 6) * 6);
    const te = thE(s); earth.position.set(Math.cos(te) * AU, 0, -Math.sin(te) * AU);
    const ti = thI(Math.max(s, 0.2)); const r = rI(ti); ito.position.set(Math.cos(ti) * r * AU, Math.sin(ti - w) * 2.5, -Math.sin(ti) * r * AU);
    hb.position.copy(hayabusa(s));
  };
  g.years = years;
  g.parts = { earth, ito, hb, sun };
  g.setProgress(0);
  return g;
}

// ================= 星空（等級7.6までの約2万8千個と天の川） =================
export function makeStars(T) {
  const g = new THREE.Group(), u8 = b64(STARS), dv = new DataView(u8.buffer);
  const pos = new Float32Array(STAR_N * 3), col = new Float32Array(STAR_N * 3), size = new Float32Array(STAR_N);
  const ramp = [[-0.4, 0.62, 0.74, 1.0], [0.0, 0.82, 0.88, 1.0], [0.4, 1.0, 0.98, 0.95], [0.8, 1.0, 0.9, 0.74], [1.4, 1.0, 0.74, 0.5], [2.2, 1.0, 0.62, 0.4]];
  for (let i = 0; i < STAR_N; i++) {
    const ra = dv.getUint16(i * 6, true) / 65535 * PI * 2, de = (dv.getUint16(i * 6 + 2, true) / 65535 - 0.5) * PI;
    const mag = u8[i * 6 + 4] / 25 - 2, bv = u8[i * 6 + 5] / 100 - 0.5;
    pos[i * 3] = Math.cos(de) * Math.cos(ra); pos[i * 3 + 1] = Math.sin(de); pos[i * 3 + 2] = -Math.cos(de) * Math.sin(ra);
    let k = 0; while (k < ramp.length - 2 && bv > ramp[k + 1][0]) k++;
    const a = ramp[k], b = ramp[k + 1], t = Math.max(0, Math.min(1, (bv - a[0]) / (b[0] - a[0])));
    const I = Math.max(0.1, Math.min(4.5, Math.pow(Math.pow(10, -0.4 * (mag - 3.2)), 0.6)));
    for (let c = 0; c < 3; c++) col[i * 3 + c] = (a[c + 1] + (b[c + 1] - a[c + 1]) * t) * I;
    size[i] = 1.0 + Math.max(0, 6.3 - mag) * 0.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('pcolor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('psize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPR: { value: 1 }, uO: { value: 1 } },
    vertexShader: `${LOGV}
      attribute vec3 pcolor; attribute float psize; uniform float uPR; varying vec3 vC;
      void main(){ vC=pcolor; vec4 mv = modelViewMatrix*vec4(position*400000.0,1.0); gl_PointSize = psize*uPR; gl_Position = projectionMatrix*mv;
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `${LOGF}
      varying vec3 vC; uniform float uO;
      void main(){
      #include <logdepthbuf_fragment>
      float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.05,d); gl_FragColor = vec4(vC*a*uO, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = -10; g.add(pts);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(450000, 48, 24), new THREE.MeshBasicMaterial({ map: T.milky, color: 0x9a9a9a, side: THREE.BackSide, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
  sky.renderOrder = -11; sky.frustumCulled = false; g.add(sky);
  g.setOpacity = (o) => { mat.uniforms.uO.value = o; sky.material.opacity = o; g.visible = o > 0.01; };
  g.setPixelRatio = (pr) => { mat.uniforms.uPR.value = pr; };
  return g;
}

// ================= 地球（NASA Blue Marble / Black Marble） =================
export function makeEarth(T, R = 6371) {
  const g = new THREE.Group(), sunV = { value: new THREE.Vector3(1, 0, 0) };
  const sm = new THREE.MeshStandardMaterial({ map: T.earthDay, roughnessMap: T.earthRough, roughness: 1, metalness: 0, normalMap: T.earthNormal, normalScale: new THREE.Vector2(0.7, 0.7), emissiveMap: T.earthNight, emissive: new THREE.Color(1.0, 0.82, 0.55), emissiveIntensity: 1 });
  sm.onBeforeCompile = (sh) => {
    sh.uniforms.uSunV = sunV;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSunV;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= smoothstep(0.08, -0.22, dot(normalize(vNormal), uSunV)) * 1.6;');
  };
  const surf = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 80), sm);
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.0045, 128, 64), new THREE.MeshStandardMaterial({ color: 0xffffff, alphaMap: T.earthClouds, transparent: true, depthWrite: false, roughness: 1, metalness: 0 }));
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: { uSun: sunV, uI: { value: 1 } },
    vertexShader: `${LOGV}
      varying vec3 vN; varying vec3 vV;
      void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv;
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `${LOGF}
      uniform vec3 uSun; uniform float uI; varying vec3 vN; varying vec3 vV;
      void main(){
      #include <logdepthbuf_fragment>
      float f = 1.0-max(0.0,dot(vN,vV)); float rim = pow(f,2.6);
      float sd = dot(vN,uSun); float l = smoothstep(-0.3,0.45,sd);
      vec3 c = mix(vec3(1.0,0.42,0.18), vec3(0.30,0.58,1.0), smoothstep(-0.12,0.35,sd));
      gl_FragColor = vec4(c*(rim*1.9+0.06)*l*uI, (rim+0.05)*l); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.025, 96, 48), atmoMat);
  const haloMat = atmoMat.clone(); haloMat.uniforms.uSun = sunV; haloMat.side = THREE.BackSide;
  haloMat.fragmentShader = `${LOGF}
      uniform vec3 uSun; uniform float uI; varying vec3 vN; varying vec3 vV;
      void main(){
      #include <logdepthbuf_fragment>
      float f = max(0.0,dot(-vN,vV)); float rim = pow(f, 5.0);
      float l = smoothstep(-0.25,0.4,dot(-vN,uSun));
      gl_FragColor = vec4(vec3(0.32,0.58,1.0)*rim*l*1.5*uI, rim*l); }`;
  const halo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.055, 96, 48), haloMat);
  g.add(surf, clouds, atmo, halo);
  g.surf = surf; g.clouds = clouds; g.R = R;
  const tmp = new THREE.Vector3();
  g.updateSun = (sunDirWorld, camera) => { tmp.copy(sunDirWorld).transformDirection(camera.matrixWorldInverse); sunV.value.copy(tmp); };
  return g;
}

// ================= イトカワ（Gaskell形状モデル＋Stookeの写真地図） =================
// 座標はモデルのまま：Xが長軸、Yが自転軸。単位はm。なめらかな「ミューゼスの海」は、くびれの南側から +Z 側の斜面に広がる。
const SITE_DIR = new THREE.Vector3(-60, -30, 82).normalize();
const ITO_TINT = [1.0, 0.9, 0.78], MAP_MEAN = 0.238, REGO_MEAN = [0.261, 0.229, 0.192];
export function makeItokawa(T) {
  const q = new Uint16Array(b64(ITO_POS).buffer), nq = new Int8Array(b64(ITO_NOR).buffer), uq = new Uint16Array(b64(ITO_UV).buffer), idx = new Uint16Array(b64(ITO_IDX).buffer);
  const pos = new Float32Array(ITO_NV * 3), nor = new Float32Array(ITO_NV * 3), uv = new Float32Array(ITO_NV * 2);
  for (let i = 0; i < ITO_NV; i++) {
    for (let c = 0; c < 3; c++) { pos[i * 3 + c] = (ITO_MIN[c] + q[i * 3 + c] / 65535 * (ITO_MAX[c] - ITO_MIN[c])) * 1000; nor[i * 3 + c] = nq[i * 3 + c] / 127; }
    uv[i * 2] = uq[i * 2] / 65535 * 2; uv[i * 2 + 1] = 1 - uq[i * 2 + 1] / 65535;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ map: T.itoMap, normalMap: T.itoN, normalScale: new THREE.Vector2(1.5, 1.5), color: new THREE.Color(...ITO_TINT), roughness: 0.97, metalness: 0 });
  // 近づいたときは、写真地図の粗さを抑えて、小石の質感を三方向から重ねる
  const U = { uDet: { value: T.regoC }, uDetK: { value: 1 }, uFlatC: { value: new THREE.Vector3(MAP_MEAN, MAP_MEAN, MAP_MEAN) }, uDetM: { value: new THREE.Vector3(...REGO_MEAN) } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position; vON = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON; uniform sampler2D uDet; uniform float uDetK; uniform vec3 uFlatC; uniform vec3 uDetM;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 w = pow(abs(normalize(vON)), vec3(4.0)); w /= (w.x + w.y + w.z);
          float dist = length(vViewPosition);
          float kN = uDetK * smoothstep(380.0, 45.0, dist);
          float kF = uDetK * smoothstep(2200.0, 500.0, dist) * 0.45;
          vec3 d1 = texture2D(uDet, vOP.yz * 0.21).rgb * w.x + texture2D(uDet, vOP.zx * 0.21).rgb * w.y + texture2D(uDet, vOP.xy * 0.21).rgb * w.z;
          vec3 d2 = texture2D(uDet, vOP.yz * 0.027 + 0.37).rgb * w.x + texture2D(uDet, vOP.zx * 0.027 + 0.37).rgb * w.y + texture2D(uDet, vOP.xy * 0.027 + 0.37).rgb * w.z;
          vec3 tint = diffuse;
          float kS = uDetK * smoothstep(1100.0, 160.0, dist);
          vec3 base = mix(diffuseColor.rgb, uFlatC * tint, 0.85 * kS);
          diffuseColor.rgb = base * mix(vec3(1.0), d1 / uDetM, kN) * mix(vec3(1.0), d2 / uDetM, kF);
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float kq = uDetK * smoothstep(1100.0, 160.0, length(vViewPosition)); normal = normalize(mix(normal, nonPerturbedNormal, 0.9 * kq)); }`);
  };
  mat.customProgramCacheKey = () => 'ito3';
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
  const g = new THREE.Group(); g.add(mesh); g.mesh = mesh; g.detail = U.uDetK;
  // 岩塊：形状モデルが粗い場所（岩の多い場所）ほど多く置く。着陸地点のまわりには置かない
  function rockGeo(detail, seed) {
    let rg = new THREE.IcosahedronGeometry(1, detail); rg.deleteAttribute('normal'); rg.deleteAttribute('uv'); rg = mergeVertices(rg);
    const p = rg.attributes.position, c = new Float32Array(p.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n1 = fbm3(v.x * 1.3 + seed, v.y * 1.3, v.z * 1.3, 3), rid = 1 - Math.abs(noise3(v.x * 2.6 + seed * 2, v.y * 2.6, v.z * 2.6) * 2 - 1);
      const k = 0.55 + 0.7 * n1 + 0.22 * rid + (detail > 1 ? 0.07 * noise3(v.x * 7, v.y * 7, v.z * 7) : 0);
      p.setXYZ(i, v.x * k, v.y * k * 0.72, v.z * k); const L = 0.72 + 0.56 * n1 * (0.5 + 0.5 * rid); c.set([L, L, L], i * 3);
    }
    rg.setAttribute('color', new THREE.BufferAttribute(c, 3)); rg.computeVertexNormals(); return rg;
  }
  function addBoulders(siteP) {
    const rough = new Float32Array(ITO_NV), acc = new Float32Array(ITO_NV * 3);
    for (let k = 0; k < idx.length; k += 3) for (let e = 0; e < 3; e++) { const a = idx[k + e], b = idx[k + (e + 1) % 3]; for (let c = 0; c < 3; c++) { acc[a * 3 + c] += nor[b * 3 + c]; acc[b * 3 + c] += nor[a * 3 + c]; } }
    for (let i = 0; i < ITO_NV; i++) { const x = acc[i * 3], y = acc[i * 3 + 1], z = acc[i * 3 + 2], l = Math.hypot(x, y, z) || 1; rough[i] = 1 - (x * nor[i * 3] + y * nor[i * 3 + 1] + z * nor[i * 3 + 2]) / l; }
    const low = T.lowMem ? 0.55 : 1, NBig = Math.round(220 * low), NSmall = Math.round(1800 * low);
    const rm = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, vertexColors: true });
    const big = new THREE.InstancedMesh(rockGeo(3, 3.1), rm(), NBig), small = new THREE.InstancedMesh(rockGeo(1, 8.7), rm(), NSmall);
    const R = rng(4242), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), sc = new THREE.Vector3(), p3 = new THREE.Vector3(), nn = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    const nt = idx.length / 3; let nb = 0, ns = 0, guard = 0;
    while ((nb < NBig || ns < NSmall) && guard++ < 400000) {
      const t = Math.floor(R() * nt) * 3, a = idx[t], b = idx[t + 1], c = idx[t + 2];
      const rr = (rough[a] + rough[b] + rough[c]) / 3; if (R() > Math.min(1, rr * 520)) continue;
      let u = R(), v = R(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
      for (let k = 0; k < 3; k++) { p3.setComponent(k, pos[a * 3 + k] * (1 - u - v) + pos[b * 3 + k] * u + pos[c * 3 + k] * v); nn.setComponent(k, nor[a * 3 + k] + nor[b * 3 + k] + nor[c * 3 + k]); }
      const ds = p3.distanceTo(siteP); if (ds < 58) continue;
      const isBig = nb < NBig && (ns >= NSmall || R() < 0.12);
      nn.normalize(); let sz = isBig ? 3 + Math.pow(R(), 3) * 9 : 0.6 + Math.pow(R(), 3) * 2.6; if (ds < 110) sz *= 0.25 + 0.75 * (ds - 58) / 52;
      p3.addScaledVector(nn, sz * 0.15);
      qq.setFromUnitVectors(up, nn).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - .5) * 0.9, R() * 6.28, (R() - .5) * 0.9)));
      sc.set(sz * (0.8 + R() * 0.6), sz * (0.6 + R() * 0.5), sz * (0.8 + R() * 0.6));
      m4.compose(p3, qq, sc);
      const L = MAP_MEAN * (0.8 + R() * 0.45); col.setRGB(L * ITO_TINT[0], L * ITO_TINT[1], L * ITO_TINT[2]);
      if (isBig) { big.setMatrixAt(nb, m4); big.setColorAt(nb, col); nb++; } else if (ns < NSmall) { small.setMatrixAt(ns, m4); small.setColorAt(ns, col); ns++; }
    }
    big.count = nb; small.count = ns;
    for (const m of [big, small]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
    g.boulders = [big, small];
  }
  const ray = new THREE.Ray(), tri = new THREE.Triangle(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), hit = new THREE.Vector3();
  function castTris(list, origin, dir) {
    let best = Infinity, bn = null; ray.origin.copy(origin); ray.direction.copy(dir);
    for (let k = 0; k < list.length; k += 3) {
      A.fromArray(pos, list[k] * 3); B.fromArray(pos, list[k + 1] * 3); C.fromArray(pos, list[k + 2] * 3);
      if (ray.intersectTriangle(A, B, C, false, hit)) { const d = hit.distanceTo(origin); if (d < best) { best = d; bn = tri.set(A, B, C).getNormal(new THREE.Vector3()); } }
    }
    return best < Infinity ? { point: origin.clone().addScaledVector(dir, best), normal: bn } : null;
  }
  // 中心から dir の方向にある表面の点と法線（ローカル座標）
  g.surface = (dir) => { const d = dir.clone().normalize(); return castTris(idx, d.clone().multiplyScalar(900), d.clone().negate()); };
  const s = g.surface(SITE_DIR);
  // 法線は周囲の平均（面の細かい傾きに左右されないように）
  const nAvg = new THREE.Vector3();
  for (let k = 0; k < idx.length; k += 3) { A.fromArray(pos, idx[k] * 3); if (A.distanceToSquared(s.point) < 18 * 18) { B.fromArray(pos, idx[k + 1] * 3); C.fromArray(pos, idx[k + 2] * 3); nAvg.add(tri.set(A, B, C).getNormal(hit).multiplyScalar(tri.getArea())); } }
  g.site = { point: s.point, normal: nAvg.lengthSq() > 0 ? nAvg.normalize() : s.normal };
  addBoulders(g.site.point);
  // 着陸地点が原点、その法線が+Y になるようにイトカワを置く
  g.placeSiteUp = (yaw = 0) => {
    const qq = new THREE.Quaternion().setFromUnitVectors(g.site.normal, new THREE.Vector3(0, 1, 0));
    qq.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    g.quaternion.copy(qq); g.position.copy(g.site.point).applyQuaternion(qq).negate(); g.updateMatrixWorld(true);
  };
  // 着陸地点まわりの細かい地面。イトカワの子として付く（ローカル座標）
  g.makePatch = (Rp = 46) => {
    if (g.patch) return g.patch;
    const n = g.site.normal, t1 = new THREE.Vector3(1, 0, 0).cross(n).normalize(), t2 = n.clone().cross(t1).normalize(), c0 = g.site.point;
    const near = []; const lim = (Rp * 1.8) ** 2;
    for (let k = 0; k < idx.length; k += 3) { A.fromArray(pos, idx[k] * 3); if (A.distanceToSquared(c0) < lim) near.push(idx[k], idx[k + 1], idx[k + 2]); }
    const N = 64, hf = new Float32Array((N + 1) * (N + 1)), o = new THREE.Vector3(), dn = n.clone().negate();
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = (i / N * 2 - 1) * Rp, y = (j / N * 2 - 1) * Rp;
      o.copy(c0).addScaledVector(t1, x).addScaledVector(t2, y).addScaledVector(n, 60);
      const h = castTris(near, o, dn); hf[j * (N + 1) + i] = h ? 60 - h.point.distanceTo(o) : -5;
    }
    // 格子点のまわりで一番高い値をとる（元の面より下にもぐらないように）
    const hm = new Float32Array(hf.length), w = N + 1;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { let m = -1e9; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = Math.min(N, Math.max(0, i + di)), b = Math.min(N, Math.max(0, j + dj)); m = Math.max(m, hf[b * w + a]); } hm[j * w + i] = m; }
    const hsm = (i, j) => hm[Math.min(N, Math.max(0, j)) * w + Math.min(N, Math.max(0, i))];
    const base = (x, y) => {
      const fx = Math.max(0, Math.min(N - 1e-4, (x / Rp + 1) / 2 * N)), fy = Math.max(0, Math.min(N - 1e-4, (y / Rp + 1) / 2 * N));
      const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
      return (hsm(i, j) * (1 - su) + hsm(i + 1, j) * su) * (1 - sv) + (hsm(i, j + 1) * (1 - su) + hsm(i + 1, j + 1) * su) * sv;
    };
    const h0 = base(0, 0);
    // 中心付近は平らな小石の原。外側ほど元の地形に近づける
    const height = (x, y) => {
      const r = Math.hypot(x, y), k = Math.min(1, r / 14); const kk = k * k * (3 - 2 * k);
      return h0 + (base(x, y) - h0) * kk + 0.12 + (fbm3(x * 0.33 + 3, y * 0.33, 1.7, 3) - 0.5) * 0.22 * (0.35 + 0.65 * kk) + (noise3(x * 2.3, y * 2.3, 5.2) - 0.5) * 0.035;
    };
    const M = 170, pg = new THREE.PlaneGeometry(2 * Rp, 2 * Rp, M, M), pp = pg.attributes.position, colA = new Float32Array(pp.count * 4), puv = pg.attributes.uv;
    const basisM = new THREE.Matrix4().makeBasis(t1, t2, n).setPosition(c0);
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i), y = pp.getY(i), r = Math.hypot(x, y) / Rp;
      pp.setZ(i, height(x, y)); puv.setXY(i, x / 4.76, y / 4.76);
      const a = 1 - Math.max(0, Math.min(1, (r - 0.6) / 0.36)), L = 0.86 + 0.28 * fbm3(x * 0.09 + 7, y * 0.09, 3.1, 3);
      colA.set([L, L, L, a * a * (3 - 2 * a)], i * 4);
    }
    pg.setAttribute('color', new THREE.BufferAttribute(colA, 4)); pg.computeVertexNormals(); pg.applyMatrix4(basisM);
    const fc = [ITO_TINT[0] * MAP_MEAN / REGO_MEAN[0], ITO_TINT[1] * MAP_MEAN / REGO_MEAN[1], ITO_TINT[2] * MAP_MEAN / REGO_MEAN[2]];
    const pm = new THREE.MeshStandardMaterial({ map: T.regoC, normalMap: T.regoN, normalScale: new THREE.Vector2(1.5, 1.5), color: new THREE.Color(...fc), roughness: 1, metalness: 0, vertexColors: true, transparent: true });
    const patch = new THREE.Mesh(pg, pm); patch.receiveShadow = true; patch.renderOrder = 1; g.add(patch);
    // 立体の小石と岩
    let rg = new THREE.IcosahedronGeometry(1, 1); rg.deleteAttribute('normal'); rg.deleteAttribute('uv'); rg = mergeVertices(rg);
    const rp = rg.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < rp.count; i++) { v.fromBufferAttribute(rp, i); const k = 0.62 + 0.75 * fbm3(v.x * 1.7 + 3, v.y * 1.7, v.z * 1.7, 3); rp.setXYZ(i, v.x * k, v.y * k * 0.62, v.z * k); }
    rg.computeVertexNormals();
    const NP = 2200, peb = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, flatShading: true }), NP);
    const R = rng(77), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), sc = new THREE.Vector3(), p3 = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 0, 1);
    const qb = new THREE.Quaternion().setFromRotationMatrix(basisM);
    for (let i = 0; i < NP; i++) {
      const a = R() * PI * 2, rr = 0.6 + Math.pow(R(), 0.75) * Rp * 0.9, x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      let sz = 0.012 + Math.pow(R(), 5) * (rr < 9 ? 0.07 : 0.5);
      p3.copy(c0).addScaledVector(t1, x).addScaledVector(t2, y).addScaledVector(n, height(x, y) + sz * 0.22);
      qq.copy(qb).multiply(new THREE.Quaternion().setFromAxisAngle(up, R() * 6.28)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - .5) * 0.5, (R() - .5) * 0.5, 0)));
      sc.set(sz * (0.8 + R() * 0.5), sz * (0.8 + R() * 0.5), sz * (0.75 + R() * 0.4));
      m4.compose(p3, qq, sc); peb.setMatrixAt(i, m4);
      const L = 0.16 + R() * 0.1; peb.setColorAt(i, col.setRGB(L * 1.06, L * 0.96, L * 0.84));
    }
    peb.castShadow = true; peb.receiveShadow = true; g.add(peb);
    g.patch = { patch, peb, height, t1, t2, n, c0 };
    return g.patch;
  };
  return g;
}

// ================= M-Vロケット5号機（全長約31m、直径2.5m）と、フェアリングの中身 =================
export { makeMV } from './rocket.js';
