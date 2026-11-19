import * as THREE from 'three';
import { buildHayabusaGeom } from './hb_geom.js';
import { AO, AO_COUNTS } from '../assets/ao_data.js';

// 座標系（機体ローカル）：+X=イオンエンジンの噴射面、±Y=太陽電池パドル、+Z=高利得アンテナ。単位はm。
const PI = Math.PI;
const V3 = a => new THREE.Vector3(a[0], a[1], a[2]);

// ---------- レイトレーシング用：画素ごとに、面の向き・粗さ・色を別の出力へ書き出す ----------
// gbufUniform を1にして描くと、1枚目の出力が「光を当てた色」から「材質の色と金属度」に変わる。ふだんの描画には影響しない
export const gbufUniform = { value: 0 };
function gPatch(sh) {
  sh.uniforms.uGbuf = gbufUniform;
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGbuf;\nlayout(location = 1) out highp vec4 gB1;\nlayout(location = 2) out highp vec4 gB2;')
    .replace('#include <dithering_fragment>', `#include <dithering_fragment>
      gB1 = vec4(inverseTransformDirection(normal, viewMatrix), material.roughness);
      #ifdef USE_CLEARCOAT
        gB2 = vec4(totalEmissiveRadiance, floor(material.clearcoat * 63.0 + 0.5) + min(material.clearcoatRoughness, 0.98));
      #else
        gB2 = vec4(totalEmissiveRadiance, 0.0);
      #endif
      #ifdef USE_ENVMAP
        float gEnvI = envMapIntensity;
      #else
        float gEnvI = 1.0;
      #endif
      // 4つ目の値には、映りこみの強さ（整数部）と金属度（小数部）を詰める
      if (uGbuf > 0.5) gl_FragColor = vec4(diffuseColor.rgb, floor(clamp(gEnvI, 0.0, 3.0) * 10.0 + 0.5) + clamp(metalnessFactor, 0.0, 1.0) * 0.98);`);
}
export function withG(mat) { mat.onBeforeCompile = gPatch; mat.customProgramCacheKey = () => 'g2'; return mat; }

// ---------- 事前計算したAO（頂点属性）を材質に組み込む ----------
export const aoUniform = { value: 1 };
function withAO(mat) {
  mat.onBeforeCompile = (sh) => {
    gPatch(sh);
    sh.uniforms.uAo = aoUniform;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float ao;\nvarying float vAo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAo = ao;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAo;\nuniform float uAo;')
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        float aoF = mix(1.0, vAo, uAo); float aoD = mix(1.0, aoF, 0.3);
        reflectedLight.indirectDiffuse *= aoF; reflectedLight.indirectSpecular *= aoF;
        reflectedLight.directDiffuse *= aoD; reflectedLight.directSpecular *= aoD;
        #ifdef USE_CLEARCOAT
          clearcoatSpecularIndirect *= aoF; clearcoatSpecularDirect *= aoD;
        #endif`)
      // 透かし表示に切り替えたとき、作り直しなしで半透明になるよう、アルファを1に固定しない
      .replace('#include <opaque_fragment>', 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );');
  };
  mat.customProgramCacheKey = () => 'ao4';
  return mat;
}

export function makeMaterials(T) {
  const S = p => withAO(new THREE.MeshStandardMaterial(p)), P = p => withAO(new THREE.MeshPhysicalMaterial(p));
  const ns = (x) => new THREE.Vector2(x, x);
  return {
    // 金色の断熱材：金属を蒸着したフィルム。面は鏡に近く、折れ目ごとに映りこみが変わる
    mli: () => P({ color: 0xe9b64a, metalness: 1, roughness: 1, roughnessMap: T.mliOrm, normalMap: T.mliN, normalScale: ns(1), clearcoat: 0.4, clearcoatRoughness: 0.16, clearcoatNormalMap: T.mliN, clearcoatNormalScale: ns(1), envMapIntensity: 1.2, side: THREE.DoubleSide }),
    tape: () => P({ color: 0xc9953a, metalness: 1, roughness: 1.15, roughnessMap: T.mliOrm, normalMap: T.mliN, normalScale: ns(0.35), clearcoat: 0.4, clearcoatRoughness: 0.25, envMapIntensity: 1.15, side: THREE.DoubleSide }),
    // 黒い断熱材：炭素を混ぜた黒いフィルム。つやはあるが、映りこみは弱い
    mliDark: () => P({ color: 0x0b0b0d, metalness: 0.2, roughness: 0.36, normalMap: T.mliN, normalScale: ns(1), clearcoat: 0.55, clearcoatRoughness: 0.22, clearcoatNormalMap: T.mliN, clearcoatNormalScale: ns(1), envMapIntensity: 0.9, side: THREE.DoubleSide }),
    silver: () => S({ color: 0xe2e5ea, metalness: 1, roughness: 0.32, normalMap: T.mliN, normalScale: ns(0.3) }),
    osr: () => S({ map: T.osrC, normalMap: T.osrN, metalness: 1, roughness: 0.07, envMapIntensity: 1.3 }),
    alu: () => S({ color: 0xbcc1c8, metalness: 1, roughness: 1, roughnessMap: T.metalOrm, normalMap: T.metalN, normalScale: ns(0.25) }),
    aluDark: () => S({ color: 0x51555c, metalness: 1, roughness: 1, roughnessMap: T.metalOrm, normalMap: T.metalN, normalScale: ns(0.25) }),
    steel: () => S({ color: 0x92959b, metalness: 1, roughness: 0.34 }),
    ti: () => S({ color: 0x8e8980, metalness: 1, roughness: 1, roughnessMap: T.metalOrm, normalMap: T.metalN, normalScale: ns(0.15) }),
    black: () => S({ color: 0x0e0e10, metalness: 0.2, roughness: 0.62 }),
    white: () => S({ color: 0xdedcd5, metalness: 0, roughness: 0.56 }),
    dishF: () => S({ color: 0xe9e7e0, map: T.dishC, metalness: 0, roughness: 0.58 }),
    cfrp: () => P({ map: T.cfrpC, normalMap: T.cfrpN, normalScale: ns(0.6), metalness: 0.25, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.35 }),
    cells: () => P({ color: 0xa9aec0, map: T.cellsC, normalMap: T.cellsN, roughnessMap: T.cellsOrm, metalnessMap: T.cellsOrm, roughness: 1.7, metalness: 1, envMapIntensity: 1.1, ior: 1.5, specularIntensity: 0.6 }),
    grid: () => S({ map: T.gridC, normalMap: T.gridN, emissiveMap: T.gridE, emissive: new THREE.Color(0.45, 0.7, 1.0), emissiveIntensity: 0, metalness: 0.3, roughness: 0.62 }),
    glass: () => P({ color: 0x070d16, metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 }),
    mirror: () => S({ color: 0xdfe6ee, metalness: 1, roughness: 0.03 }),
    nozzle: () => S({ color: 0xd4d8de, metalness: 1, roughness: 0.24 }),
    smirror: () => S({ color: 0xeef0f3, metalness: 1, roughness: 0.2, normalMap: T.metalN, normalScale: ns(0.05), envMapIntensity: 1.25 }),
    chrome: () => S({ color: 0xe6e9ee, metalness: 1, roughness: 0.15, envMapIntensity: 1.2 }),
    splate: () => S({ color: 0xcdd1d7, metalness: 1, roughness: 0.9, roughnessMap: T.metalOrm, normalMap: T.metalN, normalScale: ns(0.12) }),
    foil: () => P({ color: 0xdde1e7, metalness: 1, roughness: 0.9, roughnessMap: T.mliOrm, normalMap: T.mliN, normalScale: ns(1), clearcoat: 0.2, clearcoatRoughness: 0.3, envMapIntensity: 1.15, side: THREE.DoubleSide }),
    bellows: () => S({ color: 0x0b0b0d, metalness: 0.15, roughness: 0.5, side: THREE.DoubleSide }),
    dishB: () => S({ color: 0xb4b7bc, metalness: 0.1, roughness: 0.68 }),
    pback: () => S({ map: T.pback, metalness: 0.25, roughness: 0.48 }),
    hcloth: () => S({ color: 0x242426, map: T.fabricC, normalMap: T.fabricN, normalScale: ns(0.9), metalness: 0, roughness: 0.9, side: THREE.DoubleSide }),
    guard: () => S({ color: 0xb6b8bb, normalMap: T.fabricN, normalScale: ns(0.6), metalness: 0.1, roughness: 0.8, side: THREE.DoubleSide }),
    ablator: () => S({ color: 0x2b211a, metalness: 0, roughness: 0.92, normalMap: T.fabricN, normalScale: ns(0.5), side: THREE.DoubleSide }),
    ablatorB: () => S({ color: 0x4a3a2a, metalness: 0.1, roughness: 0.8, side: THREE.DoubleSide }),
    chute: () => S({ color: 0xe6e0d0, metalness: 0, roughness: 0.9, normalMap: T.fabricN, normalScale: ns(0.6), side: THREE.DoubleSide }),
    pcb: () => S({ color: 0x1d5a3c, metalness: 0.1, roughness: 0.55 }),
    gfilm: () => P({ color: 0xe3b24c, metalness: 1, roughness: 0.2, normalMap: T.mliN, normalScale: ns(0.1), clearcoat: 0.5, clearcoatRoughness: 0.1, envMapIntensity: 1.2 }),
    greenwire: () => S({ color: 0x5f7d3c, metalness: 0.1, roughness: 0.5 }),
    xwin: () => P({ color: 0x0f3a44, metalness: 0.2, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
    redwire: () => S({ color: 0xc2262c, metalness: 0, roughness: 0.5 }),
    pin: () => S({ color: 0xb08a4a, metalness: 0.9, roughness: 0.4 }),
    bead: () => S({ color: 0xd9a04a, metalness: 0, roughness: 0.6 }),
    magN: () => S({ color: 0xb23a32, metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide }),
    magS: () => S({ color: 0x2f5fae, metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide }),
    cellC: () => S({ color: 0x61758f, metalness: 0.7, roughness: 0.42 }),
    fR: () => P({ color: 0xc23a2a, metalness: 0, roughness: 0.1, clearcoat: 1 }), fG: () => P({ color: 0x2f9a4a, metalness: 0, roughness: 0.1, clearcoat: 1 }),
    fB: () => P({ color: 0x2f55c8, metalness: 0, roughness: 0.1, clearcoat: 1 }), fY: () => P({ color: 0xd8b030, metalness: 0, roughness: 0.1, clearcoat: 1 }),
    ebox: () => P({ color: 0x1c1d21, metalness: 0.65, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.4 }),
    fabric: () => S({ color: 0xc09a52, map: T.fabricC, normalMap: T.fabricN, normalScale: ns(0.8), metalness: 0, roughness: 0.86, side: THREE.DoubleSide }),
    retro: () => S({ color: 0xffffff, map: T.retro, normalMap: T.fabricN, normalScale: ns(0.35), metalness: 0.25, roughness: 0.42, emissive: 0x141414 }),
    bolt: () => S({ color: 0x9da0a6, metalness: 1, roughness: 0.4 }),
    kapton: () => S({ color: 0xb46f28, metalness: 0.4, roughness: 0.45 }),
    gold: () => S({ color: 0xd8b24a, metalness: 1, roughness: 0.28 }),
    copper: () => S({ color: 0xb87840, metalness: 1, roughness: 0.36 }),
    composite: () => P({ color: 0x1b1b1e, metalness: 0.2, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.3 }),
    cable: () => S({ color: 0x2a2a2f, metalness: 0.1, roughness: 0.72 }),
    orange: () => S({ color: 0xc8742a, metalness: 0.1, roughness: 0.6 }),
    cell: () => S({ color: 0x61758f, metalness: 0.7, roughness: 0.42 }),
    pipeA: () => S({ color: 0x9a9da3, metalness: 1, roughness: 0.35 }),
    pipeB: () => S({ color: 0x9a9da3, metalness: 1, roughness: 0.35 }),
    roverCell: () => S({ color: 0x121c3c, metalness: 0.4, roughness: 0.25 }),
  };
}

// イオンエンジンの噴射。グリッドから少しずつ広がる淡い青のビームを、視線に沿って密度を積算して描く
const PLUME = { L: 2.4, R0: 0.05, TAN: 0.2, RN: 0.11, RF: 0.72 };
function plumeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uI: { value: 0 }, uT: { value: 0 }, uGain: { value: 10.5 } },
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vPos; varying vec3 vCam;
      void main(){ vPos = position; vCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
        vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <logdepthbuf_pars_fragment>
      uniform float uI; uniform float uT; uniform float uGain; varying vec3 vPos; varying vec3 vCam;
      const float L = ${PLUME.L.toFixed(3)}, R0 = ${PLUME.R0.toFixed(3)}, TAN = ${PLUME.TAN.toFixed(3)}, RM = ${PLUME.RF.toFixed(3)};
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        #include <logdepthbuf_fragment>
        vec3 ro = vCam; vec3 dv = vPos - vCam; float tFar = length(dv); if (tFar < 1e-5) discard; vec3 rd = dv / tFar;
        float tNear = 0.0;
        float a = dot(rd.xz, rd.xz), b = dot(ro.xz, rd.xz), c = dot(ro.xz, ro.xz) - RM * RM;
        if (c > 0.0) { float h = b * b - a * c; if (h <= 0.0 || a < 1e-7) discard; tNear = max(tNear, (-b - sqrt(h)) / a); }
        if (ro.y < 0.0) { if (rd.y <= 1e-6) discard; tNear = max(tNear, -ro.y / rd.y); }
        if (ro.y > L) { if (rd.y >= -1e-6) discard; tNear = max(tNear, (L - ro.y) / rd.y); }
        if (tNear >= tFar) discard;
        const int N = 26; float dt = (tFar - tNear) / float(N), j = hash(gl_FragCoord.xy + fract(uT) * 61.0), acc = 0.0, core = 0.0;
        for (int i = 0; i < N; i++) {
          vec3 p = ro + rd * (tNear + (float(i) + j) * dt);
          float y = clamp(p.y, 0.0, L), w = R0 + y * TAN;
          vec2 q = p.xz / w; float r2 = dot(q, q);
          float d = exp(-2.3 * r2) * (R0 * R0) / (w * w);
          d *= exp(-y / (0.42 * L)) * (1.0 - smoothstep(0.55 * L, L, y)) * smoothstep(0.0, 0.012, p.y);
          float st = 0.5 + 0.5 * sin(q.x * 17.0 + sin(q.y * 11.0) * 2.0) * sin(q.y * 15.0 + 1.3);
          d *= 0.84 + 0.16 * st + 0.05 * sin(y * 34.0 - uT * 46.0 + q.x * 7.0);
          acc += d * dt; core += d * d * dt;
        }
        float v = acc * uGain * uI;
        vec3 col = mix(vec3(0.26, 0.56, 1.0), vec3(0.74, 0.93, 1.0), clamp(core * 180.0, 0.0, 1.0));
        gl_FragColor = vec4(min(col * v, vec3(6.0)), 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
  });
}

// ジオメトリは一度だけ作り、VTR用と解説用の2つのインスタンスで共有する
let cache = null;
function geomCache() {
  if (cache) return cache;
  const built = buildHayabusaGeom();
  const bin = atob(AO), n = bin.length;
  let off = 0, k = 0, ok = true;
  for (const g of built.groups) for (const m of g.meshes) {
    const cnt = m.geo.attributes.position.count, arr = new Uint8Array(cnt);
    if (AO_COUNTS[k] === cnt && off + cnt <= n) { for (let i = 0; i < cnt; i++) arr[i] = bin.charCodeAt(off + i); }
    else { arr.fill(255); ok = false; }
    off += AO_COUNTS[k] || 0; k++;
    m.geo.setAttribute('ao', new THREE.BufferAttribute(arr, 1, true));
  }
  if (!ok) console.warn('AOデータと頂点数が一致しない部分がある');
  cache = built; return built;
}

export function buildHayabusa(T, { shadows = true, detail = true } = {}) {
  const { groups, meta } = geomCache();
  const MK = makeMaterials(T), mats = {};
  const mat = (key) => (mats[key] ??= Object.assign(MK[key.split('#')[0]](), { name: key }));
  const root = new THREE.Group(); root.name = 'hayabusa';
  const parts = {}, named = {}, gobj = [], skinMats = new Set(), skinMeshes = [], internal = [];

  groups.forEach((g, i) => {
    const o = new THREE.Group();
    const par = g.parent >= 0 ? groups[g.parent] : null;
    o.position.set(g.origin[0] - (par ? par.origin[0] : 0), g.origin[1] - (par ? par.origin[1] : 0), g.origin[2] - (par ? par.origin[2] : 0));
    o.userData = { partId: g.part, base: o.position.clone(), explode: V3(g.explode), origin: V3(g.origin), internal: g.internal };
    (par ? gobj[g.parent] : root).add(o);
    gobj.push(o);
    if (g.name) named[g.name] = o;
    const P = (parts[g.part] ??= { id: g.part, groups: [], meshes: [] });
    P.groups.push(o);
    if (g.internal) internal.push(o);
    for (const m of g.meshes) {
      const key = m.mat + (m.flags.sep ? '#' + m.flags.sep : '') + (g.skin ? '#skin' : '');
      const mesh = new THREE.Mesh(m.geo, mat(key));
      mesh.castShadow = shadows; mesh.receiveShadow = shadows;
      mesh.userData.partId = g.part;
      if (g.skin) { mesh.userData.skin = true; skinMats.add(mesh.material); skinMeshes.push(mesh); }
      o.add(mesh); P.meshes.push(mesh);
    }
  });

  // ---------- イオンエンジンの噴射と中和器の光 ----------
  const thrusters = meta.thrusters.map((t) => {
    const pg = new THREE.CylinderGeometry(PLUME.RF, PLUME.RN, PLUME.L, 28, 1, false); pg.translate(0, PLUME.L / 2, 0);
    const plume = new THREE.Mesh(pg, plumeMaterial());
    plume.rotation.z = -PI / 2; plume.position.set(t.exit[0] - 0.012, t.exit[1], t.exit[2]); plume.frustumCulled = false;
    plume.renderOrder = 10; plume.userData.noPick = true; plume.visible = false; plume.layers.enable(1); root.add(plume);
    const nGlow = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.3, 0.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    nGlow.position.set(t.neut[0], t.neut[1], t.neut[2]); nGlow.userData.noPick = true; nGlow.layers.enable(1); root.add(nGlow);
    return { name: t.name, exit: V3(t.exit), neut: V3(t.neut), neutDir: V3(t.neutDir), plume, nGlow, grid: mats['grid#' + t.name], intensity: 0 };
  });

  const wheelSpeed = [9, 9, 9];
  const rotors = meta.rw.map(w => ({ obj: gobj[w.rotor], axis: V3(w.axis), c: V3(w.c), name: w.name }));
  const flex = { ok: false, p: new THREE.Vector3(), q: new THREE.Quaternion(), v: new THREE.Vector3(), w: new THREE.Vector3(), ang: [0, 0], vel: [0, 0] };
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _dq = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _a = new THREE.Vector3(), _al = new THREE.Vector3();
  const hl = [];       // 選択中パーツの発光オーバーレイ
  const hlMat = new THREE.MeshBasicMaterial({ color: 0x3a9bff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  // 透かした外側と、その中身は、選択の光を弱める（中の色や形が見えるように）
  const hlSkin = hlMat.clone(), hlIn = hlMat.clone();
  // 外に付くパーツの中身（ミネルバやカプセルの中など）。VTRでは出さず、パーツ解説だけで見せる。カプセルの容器はVTRでも使う
  for (const id in parts) { const P = parts[id]; if (P.groups.some(o => !o.userData.internal) && P.groups.some(o => o.userData.internal)) { for (const o of P.groups) if (o.userData.internal && o !== named.container) o.userData.sub = true; for (const m of P.meshes) if (m.parent.userData.internal) m.userData.sub = true; } }

  const api = {
    root, parts, named, meta, mats, thrusters, rotors, wheelSpeed, hlMat, skinMeshes,
    // 重ねて描く物（噴射、中和器の光、選択の光）。レイトレーシングでは形の記録から外し、最後に上へ重ねる
    overlays() { return thrusters.flatMap(t => [t.plume, t.nGlow]).concat(hl); },
    deploy: 1, hornExt: 1, xray: 0, explode: 0, showSub: detail,
    lw(a) { return root.localToWorld(Array.isArray(a) ? V3(a) : a.clone()); },
    // 太陽電池パドル：0=たたんだ状態、1=展開
    setDeploy(f) {
      this.deploy = f;
      // 止め金に当たって少し行きすぎ、戻って止まる動き
      const e = t => { if (t <= 0) return 0; if (t >= 1) return 1; const u = t - 1; return 1 + 2.1 * u * u * u + 1.1 * u * u; };
      const a0 = 1 - e(f / 0.55), a1 = 1 - e((f - 0.42) / 0.58);
      for (const w of meta.wings) {
        named['yoke' + w.s].rotation.x = -w.s * (PI / 2) * a0;
        named['panelC' + w.s].rotation.x = w.s * PI * a0;
        for (const sd of w.sides) named['panelS' + w.s + '_' + sd.sx].rotation.y = sd.sx * PI * a1;
      }
    },
    // サンプラーホーン：0=打ち上げ時（たたんだ状態）、1=伸展。press は着地で縮む量(m)
    setHorn(f, press = 0) {
      this.hornExt = f;
      const L = meta.horn.midLen, k = Math.max(0.1, (0.12 + 0.88 * f) - press / L);
      named.hornMid.scale.z = k;
      named.hornLow.position.z = named.hornLow.userData.base.z + (1 - k) * L;
    },
    // ミネルバの箱の下半分を開いて、中のローバを見せる（0=閉、1=開）
    setMinervaOpen(k) {
      const lid = named.minervaLid, rv = named.rover; if (!lid || !rv) return;
      // 箱の下半分は、機体の中心側のふちを軸にして扉のように開く。ローバは少し下がって全体が見える
      const th = 1.9 * k, c = Math.cos(th), s = Math.sin(th), dx = -0.084, dz = -0.0425;
      lid.position.copy(lid.userData.base).addScaledVector(lid.userData.explode, this.explode);
      lid.position.x += dx * c - dz * s - dx + 0.03 * k; lid.position.z += dx * s + dz * c - dz; lid.rotation.y = -th;
      rv.position.copy(rv.userData.base).addScaledVector(rv.userData.explode, this.explode); rv.position.z += -0.1 * Math.min(1, k * 1.6);
    },
    setThrust(arr) {
      thrusters.forEach((t, i) => {
        t.intensity = arr[i] ?? 0;
        t.plume.material.uniforms.uI.value = t.intensity; t.plume.visible = t.intensity > 0.002;
        if (t.grid) t.grid.emissiveIntensity = t.intensity * 2.2;
        t.nGlow.material.opacity = Math.min(1, t.intensity * 1.4);
      });
    },
    setXray(a) {
      this.xray = a;
      for (const m of skinMats) { m.transparent = a > 0.001; m.opacity = 1 - a * 0.93; m.depthWrite = a < 0.5; }
      for (const id of ['mli', 'radiator']) parts[id].groups.forEach(g => g.visible = a < 0.995);
      this._vis();
    },
    setExplode(f) {
      this.explode = f;
      for (const o of gobj) o.position.copy(o.userData.base).addScaledVector(o.userData.explode, f);
      aoUniform.value = 1 - 0.55 * f;
      this._vis();
    },
    _vis() { const on = this.xray > 0.01 || this.explode > 0.01 || this.showInside; for (const o of internal) o.visible = on && (this.showSub || !o.userData.sub); },
    setInside(on) { this.showInside = on; this._vis(); },
    highlight(id, strength = 0.35) {
      while (hl.length) { const h = hl.pop(); h.parent.remove(h); }
      if (!id || !parts[id]) return;
      this.setHl(strength);
      for (const m of parts[id].meshes) { const h = new THREE.Mesh(m.geometry, m.userData.skin ? hlSkin : m.userData.sub ? hlIn : hlMat); h.userData.noPick = true; h.renderOrder = 6; h.layers.enable(1); m.parent.add(h); hl.push(h); }
    },
    setHl(k) { k *= 1 - 0.7 * this.explode; hlMat.opacity = k; hlSkin.opacity = k * (1 - 0.96 * this.xray); hlIn.opacity = k * 0.2; },
    tick(t, dt) {
      for (const th of thrusters) th.plume.material.uniforms.uT.value = t;
      rotors.forEach((r, i) => r.obj.rotateOnAxis(r.axis, wheelSpeed[i] * dt));
      // パドルのしなり：機体の加速と角加速に、ばねのように遅れてついてくる
      const F = flex;
      root.updateWorldMatrix(true, false);
      _p.setFromMatrixPosition(root.matrixWorld); _q.setFromRotationMatrix(root.matrixWorld);
      if (dt > 1e-4 && dt < 0.2 && F.ok && this.deploy > 0.98 && _p.distanceToSquared(F.p) < 4 * dt * dt * 400) {
        _v.copy(_p).sub(F.p).divideScalar(dt);                                   // 速度
        _dq.copy(F.q).invert().premultiply(_q); if (_dq.w < 0) { _dq.x = -_dq.x; _dq.y = -_dq.y; _dq.z = -_dq.z; _dq.w = -_dq.w; }
        _w.set(_dq.x, _dq.y, _dq.z).multiplyScalar(2 / dt);                      // 角速度（ワールド）
        _a.copy(_v).sub(F.v).divideScalar(dt); _al.copy(_w).sub(F.w).divideScalar(dt);
        _qi.copy(_q).invert(); _a.applyQuaternion(_qi); _al.applyQuaternion(_qi);  // 機体座標へ
        const az = Math.max(-3, Math.min(3, _a.z)), ax = Math.max(-2, Math.min(2, _al.x));
        const w0 = 3.6, zeta = 0.13, n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
        for (const s of [1, -1]) {
          const i = s > 0 ? 0 : 1, force = -(az + 2.0 * s * ax) * 0.11;
          for (let k = 0; k < n; k++) { F.vel[i] += (-w0 * w0 * F.ang[i] - 2 * zeta * w0 * F.vel[i] + force) * h; F.ang[i] += F.vel[i] * h; }
          F.ang[i] = Math.max(-0.05, Math.min(0.05, F.ang[i]));
          named['wingRoot' + s].rotation.x = s * F.ang[i];
        }
        F.v.copy(_v); F.w.copy(_w);
      } else { F.v.set(0, 0, 0); F.w.set(0, 0, 0); if (this.deploy <= 0.98) { F.ang[0] = F.ang[1] = F.vel[0] = F.vel[1] = 0; named.wingRoot1.rotation.x = 0; named['wingRoot-1'].rotation.x = 0; } }
      F.p.copy(_p); F.q.copy(_q); F.ok = true;
    },
    reset() {
      this.setDeploy(1); this.setHorn(1); this.setThrust([0, 0, 0, 0]); this.setXray(0); this.setExplode(0); this.setInside(false); this.highlight(null);
      wheelSpeed[0] = wheelSpeed[1] = wheelSpeed[2] = 9;
      flex.ok = false; flex.ang[0] = flex.ang[1] = flex.vel[0] = flex.vel[1] = 0;
      for (const o of gobj) { o.position.copy(o.userData.base); o.quaternion.identity(); o.scale.set(1, 1, 1); o.visible = true; }
      this._vis();
    },
  };
  api.reset();
  root.updateMatrixWorld(true);
  return api;
}
