// パーツ解説の「レイトレ」（パソコン向け）。動かしているあいだも毎フレーム、画素ごとに光線を追って、影・映りこみ・照り返しを求める。
// 手順：①面の向き・粗さ・色・奥行きを画素ごとに記録する → ②その面から光線を飛ばす（少し粗い解像度で）
//       → ③前のフレームの結果と重ねてざらつきを消す → ④光と材質から色を組み立てる
//       → ⑤止まっているあいだは少しずつ位置をずらして重ね続け、輪郭までなめらかにする
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { MeshBVH, MeshBVHUniformStruct, FloatVertexAttributeTexture, BVHShaderGLSL } from 'three-mesh-bvh';
import { gbufUniform } from './hayabusa.js';

const hf = THREE.DataUtils.toHalfFloat, fh = THREE.DataUtils.fromHalfFloat;
const MAXN = 160;                                  // 止まってから重ねる回数。これを過ぎたら計算を止めて結果だけを映す
const STEPS = [0.3, 0.36, 0.43, 0.5, 0.6, 0.7];    // 光線を追う解像度（画面に対する比）。重ければ下げ、軽ければ上げる

// 絵柄のある材質が光線に当たったときの、代表の色と粗さ（光線の先では絵柄までは引かない）
const AVG = { cells: [0.03, 0.04, 0.1], pback: [0.03, 0.03, 0.03], cfrp: [0.03, 0.03, 0.035], dishF: [0.8, 0.8, 0.77], osr: [0.75, 0.78, 0.8], grid: [0.06, 0.06, 0.07], retro: [0.8, 0.82, 0.84], hcloth: [0.02, 0.02, 0.02], fabric: [0.45, 0.33, 0.14] };
const ROUGH = { mli: 0.3, tape: 0.34, foil: 0.3, alu: 0.45, aluDark: 0.45, ti: 0.45, splate: 0.4, cells: 0.3 };
function matInfo(m) {
  const key = (m.name || '').split('#')[0], c = AVG[key] || (m.color ? [m.color.r, m.color.g, m.color.b] : [0.5, 0.5, 0.5]);
  return [c[0], c[1], c[2], m.metalness ?? 0, ROUGH[key] ?? Math.min(1, m.roughness ?? 0.5)];
}

// 背景の明かり：粗さに合わせてぼかして引ける写しと、面の向きごとの明るさ（まわり全体から届く光）の小さな表
function makeEnv(eq) {
  const W = eq.image.width, H = eq.image.height, src = eq.image.data;
  const mip = new THREE.DataTexture(src, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  mip.wrapS = THREE.RepeatWrapping; mip.wrapT = THREE.ClampToEdgeWrapping; mip.magFilter = THREE.LinearFilter; mip.minFilter = THREE.LinearMipmapLinearFilter; mip.generateMipmaps = true; mip.needsUpdate = true;
  const sw = 64, sh = 32, bx = W / sw, by = H / sh, low = new Float32Array(sw * sh * 3), dir = new Float32Array(sw * sh * 4);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < by; j++) for (let i = 0; i < bx; i++) { const k = ((y * by + j) * W + x * bx + i) * 4; r += fh(src[k]); g += fh(src[k + 1]); b += fh(src[k + 2]); }
    const o = y * sw + x, n = bx * by; low[o * 3] = r / n; low[o * 3 + 1] = g / n; low[o * 3 + 2] = b / n;
    const az = (x + 0.5) / sw * 2 * Math.PI - Math.PI, el = ((y + 0.5) / sh - 0.5) * Math.PI, c = Math.cos(el);
    dir[o * 4] = c * Math.cos(az); dir[o * 4 + 1] = Math.sin(el); dir[o * 4 + 2] = c * Math.sin(az); dir[o * 4 + 3] = c * (2 * Math.PI / sw) * (Math.PI / sh);
  }
  const iw = 32, ih = 16, out = new Uint16Array(iw * ih * 4);
  for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
    const az = (x + 0.5) / iw * 2 * Math.PI - Math.PI, el = ((y + 0.5) / ih - 0.5) * Math.PI, c = Math.cos(el), nx = c * Math.cos(az), ny = Math.sin(el), nz = c * Math.sin(az);
    let r = 0, g = 0, b = 0;
    for (let k = 0; k < sw * sh; k++) { const w = (nx * dir[k * 4] + ny * dir[k * 4 + 1] + nz * dir[k * 4 + 2]) * dir[k * 4 + 3]; if (w > 0) { r += low[k * 3] * w; g += low[k * 3 + 1] * w; b += low[k * 3 + 2] * w; } }
    const o = (y * iw + x) * 4; out[o] = hf(r / Math.PI); out[o + 1] = hf(g / Math.PI); out[o + 2] = hf(b / Math.PI); out[o + 3] = hf(1);
  }
  const irr = new THREE.DataTexture(out, iw, ih, THREE.RGBAFormat, THREE.HalfFloatType);
  irr.wrapS = THREE.RepeatWrapping; irr.wrapT = THREE.ClampToEdgeWrapping; irr.magFilter = irr.minFilter = THREE.LinearFilter; irr.needsUpdate = true;
  return { mip, irr };
}

const VS = /* glsl */`precision highp float; in vec3 position; void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const COMMON = /* glsl */`
precision highp float; precision highp int; precision highp sampler2D; precision highp usampler2D; precision highp isampler2D;
const float PI = 3.14159265, INV_PI = 0.31830989;
uniform sampler2D tAlbedo, tNormal, tDepth;
uniform mat4 uCamWorld; uniform vec4 uProj; uniform vec3 uCamPos; uniform float uLogK; uniform vec2 uFull;
// 画面上の位置と奥行きから、その点の位置を求める（奥行きは対数で記録されている）
vec3 viewRay(ivec2 fp){ vec2 ndc = (vec2(fp) + 0.5) / uFull * 2.0 - 1.0; return vec3((ndc.x + uProj.z) / uProj.x, (ndc.y + uProj.w) / uProj.y, -1.0); }
vec3 worldAt(ivec2 fp, float d){ float w = exp2(d * uLogK) - 1.0; return (uCamWorld * vec4(viewRay(fp) * w, 1.0)).xyz; }
vec2 dirUv(vec3 d){ return vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * INV_PI + 0.5); }
`;

// ---------- ②光線を追う ----------
const TRACE_FS = /* glsl */`${COMMON}
${BVHShaderGLSL.common_functions}
${BVHShaderGLSL.bvh_struct_definitions}
${BVHShaderGLSL.bvh_ray_functions}
uniform BVH bvh;
uniform sampler2D tAttrA, tAttrN, tEnv, tIrr;
uniform vec2 uSize; uniform float uFrame, uEnvI;
uniform vec3 uKeyDir, uKeyCol, uRimDir, uRimCol, uSky, uGround;
layout(location = 0) out vec4 oD; layout(location = 1) out vec4 oS;

uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float rnd(inout uint st){ st = pcg(st); return float(st >> 8) * (1.0 / 16777216.0); }
vec3 envL(vec3 d, float lod){ return textureLod(tEnv, dirUv(d), lod).rgb * uEnvI; }
vec3 envIrr(vec3 n){ return textureLod(tIrr, dirUv(n), 0.0).rgb * uEnvI; }
float specLod(float rough){ return clamp(log2(max(162.6 * rough * rough, 1.0)), 0.0, 7.0); }
void basis(vec3 n, out vec3 t, out vec3 b){ float s = n.z >= 0.0 ? 1.0 : -1.0, a = -1.0 / (s + n.z), c = n.x * n.y * a; t = vec3(1.0 + s * n.x * n.x * a, s * c, -s * n.x); b = vec3(c, s + n.y * n.y * a, -n.y); }

// 途中に何かあるかだけを調べる（影用。最初に当たった時点で打ち切る）
bool anyHit(vec3 ro, vec3 rd, float maxD){
  int ptr = 0; uint stack[BVH_STACK_DEPTH]; stack[0] = 0u;
  while (ptr > -1 && ptr < BVH_STACK_DEPTH) {
    uint cur = stack[ptr]; ptr--;
    float bd;
    if (!intersectsBVHNodeBounds(ro, rd, bvh.bvhBounds, cur, bd) || bd > maxD) continue;
    uvec2 info = uTexelFetch1D(bvh.bvhContents, cur).xy;
    if (bool(info.x & 0xffff0000u)) {
      uint count = info.x & 0x0000ffffu, offset = info.y;
      for (uint i = offset, l = offset + count; i < l; i++) {
        uvec3 ix = uTexelFetch1D(bvh.index, i).xyz;
        vec3 a = texelFetch1D(bvh.position, ix.x).rgb, b = texelFetch1D(bvh.position, ix.y).rgb, c = texelFetch1D(bvh.position, ix.z).rgb;
        vec3 bc, nn; float d, sd;
        if (intersectsTriangle(ro, rd, a, b, c, bc, nn, d, sd) && d < maxD && d > 0.0) return true;
      }
    } else { ptr++; stack[ptr] = info.y; ptr++; stack[ptr] = cur + 1u; }
  }
  return false;
}
// 光線が当たった先の面の明るさ。主光源への影は調べるが、そこから先の映りこみは背景の明かりで代える
vec3 shadeHit(vec3 P, vec3 N, vec4 a, float rough, vec3 wi){
  vec3 dc = a.rgb * (1.0 - a.a), f0 = mix(vec3(0.04), a.rgb, a.a);
  float nl = dot(N, uKeyDir), vis = 0.0;
  if (nl > 0.0) vis = anyHit(P + N * 0.003, uKeyDir, 50.0) ? 0.0 : 1.0;
  vec3 irr = uKeyCol * max(nl, 0.0) * vis + uRimCol * max(dot(N, uRimDir), 0.0) + mix(uGround, uSky, N.y * 0.5 + 0.5);
  return dc * (irr * INV_PI + envIrr(N) * 0.6) + f0 * envL(reflect(wi, N), max(specLod(rough), 5.0)) * 0.6;
}
// 光線を飛ばす。何かに当たればその面の明るさ、当たらなければ miss を返す
vec3 trace(vec3 ro, vec3 rd, vec3 miss, float cap){
  uvec4 fi = uvec4(0u); vec3 fn = vec3(0.0), bc = vec3(0.0); float side = 1.0, dist = 0.0;
  if (bvhIntersectFirstHit(bvh, ro, rd, fi, fn, bc, side, dist)) {
    vec4 a = texelFetch1D(tAttrA, fi.x), nr = textureSampleBarycoord(tAttrN, bc, fi.xyz);
    vec3 N = normalize(nr.xyz); if (dot(N, rd) > 0.0) N = -N;
    return min(shadeHit(ro + rd * dist, N, a, nr.a, rd), vec3(cap));
  }
  return miss;
}
void main(){
  ivec2 px = ivec2(gl_FragCoord.xy), fp = ivec2((vec2(px) + 0.5) / uSize * uFull);
  float d = texelFetch(tDepth, fp, 0).r;
  if (d >= 0.99999) { oD = vec4(0.0, 0.0, 0.0, 1.0); oS = vec4(0.0, 0.0, 0.0, 6.0e4); return; }
  vec4 gA = texelFetch(tAlbedo, fp, 0), gN = texelFetch(tNormal, fp, 0);
  vec3 P = worldAt(fp, d), toC = uCamPos - P; float dist = length(toC); vec3 V = toC / dist;
  vec3 N = normalize(gN.xyz); float nv = dot(N, V); if (nv < 0.04) N = normalize(N + V * (0.04 - nv));
  float rough = clamp(gN.a, 0.04, 1.0), metal = clamp(fract(gA.a) / 0.98, 0.0, 1.0), eI = floor(gA.a) * 0.1;
  uint st = pcg(uint(px.x) + pcg(uint(px.y) + pcg(uint(uFrame))));
  vec3 Po = P + N * (0.0012 + dist * 0.0008), t, b;
  // 主光源の影。光源の大きさのぶんだけ向きを散らして、ふちをやわらかくする
  float nl = dot(N, uKeyDir), vis = 0.0;
  if (nl > 0.0) { basis(uKeyDir, t, b); float r = sqrt(rnd(st)) * 0.03, a = rnd(st) * 6.2831853; vis = anyHit(Po, normalize(uKeyDir + (t * cos(a) + b * sin(a)) * r), 50.0) ? 0.0 : 1.0; }
  vec3 D = (uKeyCol * max(nl, 0.0) * vis + uRimCol * max(dot(N, uRimDir), 0.0) + mix(uGround, uSky, N.y * 0.5 + 0.5)) * INV_PI;
  // まわりから届く光。さえぎる物がなければ背景の明るさ、あればその面からの照り返し
  if (metal < 0.9) { basis(N, t, b); float r = sqrt(rnd(st)), a = rnd(st) * 6.2831853; D += trace(Po, normalize(t * (r * cos(a)) + b * (r * sin(a)) + N * sqrt(max(0.0, 1.0 - r * r))), envIrr(N) * eI, 2.0); }
  else D += envIrr(N) * eI;
  // 映りこみ。粗い面ほど向きを散らす。何にも当たらなければ、粗さに合わせてぼかした背景を映す
  vec3 R = reflect(-V, N), Lr = envL(R, specLod(rough)) * eI;
  if (metal > 0.5 || rough < 0.55) {
    basis(N, t, b); float al = rough * rough * 0.75, u1 = rnd(st), u2 = rnd(st) * 6.2831853, ct = sqrt((1.0 - u1) / (1.0 + (al * al - 1.0) * u1)), sn = sqrt(max(0.0, 1.0 - ct * ct));
    vec3 Rs = reflect(-V, normalize(t * (sn * cos(u2)) + b * (sn * sin(u2)) + N * ct)); if (dot(Rs, N) < 0.02) Rs = R;
    Lr = trace(Po, Rs, Lr, 8.0);
  } else Lr *= 0.8;
  oD = vec4(min(D, vec3(20.0)), vis); oS = vec4(min(Lr, vec3(14.0)), dist);
}`;

// ---------- ③前のフレームと重ねる ----------
const TEMPORAL_FS = /* glsl */`${COMMON}
uniform sampler2D tCD, tCS, tPD, tPS; uniform vec2 uSize; uniform mat4 uPrevVP; uniform vec3 uPrevCam; uniform float uAlpha, uStill, uReset;
layout(location = 0) out vec4 oD; layout(location = 1) out vec4 oS;
void main(){
  ivec2 px = ivec2(gl_FragCoord.xy); vec4 cd = texelFetch(tCD, px, 0), cs = texelFetch(tCS, px, 0);
  oD = cd; oS = cs; float dist = cs.a; if (uReset > 0.5 || dist > 5.0e4) return;
  ivec2 fp = ivec2((vec2(px) + 0.5) / uSize * uFull);
  vec4 hd = cd, hs = cs; bool ok = false;
  if (uStill > 0.5) { hd = texelFetch(tPD, px, 0); hs = texelFetch(tPS, px, 0); ok = abs(hs.a - dist) < 0.03 * dist + 0.01; }
  else {
    // 視点が動いたときは、同じ点が前のフレームで画面のどこにあったかを求めて、そこの結果を引く
    vec3 P = uCamPos + mat3(uCamWorld) * normalize(viewRay(fp)) * dist; vec4 pc = uPrevVP * vec4(P, 1.0);
    if (pc.w > 0.0) { vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
      if (all(greaterThan(puv, vec2(0.0))) && all(lessThan(puv, vec2(1.0)))) { hd = textureLod(tPD, puv, 0.0); hs = textureLod(tPS, puv, 0.0); ok = abs(hs.a - length(P - uPrevCam)) < 0.03 * dist + 0.01; } }
  }
  if (!ok) return;
  // 鏡に近い面の映りこみは視点とともに動くので、動いているあいだは前の結果を軽く扱う
  float as = uStill > 0.5 ? uAlpha : max(uAlpha, mix(0.6, uAlpha, smoothstep(0.04, 0.4, texelFetch(tNormal, fp, 0).a)));
  oD = mix(hd, cd, uAlpha); oS = vec4(mix(hs.rgb, cs.rgb, as), dist);
}`;

// ---------- ④色を組み立てる ----------
const COMPOSE_FS = /* glsl */`${COMMON}
uniform sampler2D tEmis, tHD, tHS; uniform vec2 uSize; uniform vec3 uKeyDir, uKeyCol, uRimDir, uRimCol, uBg; uniform float uFloorY;
out vec4 oC;
float D_GGX(float a, float nh){ float a2 = a * a, q = nh * nh * (a2 - 1.0) + 1.0; return a2 / (PI * q * q); }
float V_Smith(float a, float nl, float nv){ float a2 = a * a; return 0.5 / max(nl * sqrt(a2 + (1.0 - a2) * nv * nv) + nv * sqrt(a2 + (1.0 - a2) * nl * nl), 1e-5); }
vec3 specL(vec3 N, vec3 V, vec3 L, vec3 f0, float rough){
  float nl = dot(N, L); if (nl <= 0.0) return vec3(0.0);
  vec3 h = normalize(V + L); float a = max(rough * rough, 0.0025), nv = max(dot(N, V), 1e-4);
  return (f0 + (1.0 - f0) * pow(1.0 - max(dot(V, h), 0.0), 5.0)) * min(V_Smith(a, nl, nv) * D_GGX(a, max(dot(N, h), 0.0)) * nl, 60.0);
}
vec3 envBRDF(vec3 f0, float rough, float nv){ vec4 r = rough * vec4(-1.0, -0.0275, -0.572, 0.022) + vec4(1.0, 0.0425, 1.04, -0.04); float a = min(r.x * r.x, exp2(-9.28 * nv)) * r.x + r.y; vec2 ab = vec2(-1.04, 1.04) * a + r.zw; return f0 * ab.x + ab.y; }
void main(){
  ivec2 fp = ivec2(gl_FragCoord.xy); float d = texelFetch(tDepth, fp, 0).r;
  if (d >= 0.99999) { oC = vec4(uBg, 1.0); return; }
  vec4 gA = texelFetch(tAlbedo, fp, 0), gN = texelFetch(tNormal, fp, 0), gE = texelFetch(tEmis, fp, 0);
  vec3 P = worldAt(fp, d), toC = uCamPos - P; float dist = length(toC); vec3 V = toC / dist, N = normalize(gN.xyz);
  float rough = clamp(gN.a, 0.04, 1.0), metal = clamp(fract(gA.a) / 0.98, 0.0, 1.0), nv = max(dot(N, V), 1e-3);
  // 粗い解像度で求めた光を、奥行きと面の向きが近い画素どうしでつないで引きのばす
  vec2 f = (vec2(fp) + 0.5) / uFull * uSize - 0.5; ivec2 c0 = ivec2(floor(f + 0.5)), mx = ivec2(uSize) - 1; vec2 fr = f - vec2(c0);
  vec4 sd = vec4(0.0), ss = vec4(0.0); float ws = 0.0, wd = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 q = clamp(c0 + ivec2(i, j), ivec2(0), mx); vec4 hs = texelFetch(tHS, q, 0);
    vec3 qn = normalize(texelFetch(tNormal, ivec2((vec2(q) + 0.5) / uSize * uFull), 0).xyz);
    float sim = exp(-abs(hs.a - dist) / (0.01 + 0.015 * dist)) * pow(max(dot(qn, N), 0.0), 16.0) + 1e-4;
    vec2 o = vec2(float(i), float(j)) - fr; float g = dot(o, o), w2 = exp(-g * 2.6) * sim, w4 = exp(-g * 0.9) * sim;      // 映りこみは狭く、まわりからの光は広くつなぐ
    ss += hs * w2; ws += w2; sd += texelFetch(tHD, q, 0) * w4; wd += w4;
  }
  sd /= wd; ss /= ws;
  vec3 f0 = mix(vec3(0.04), gA.rgb, metal); float vis = sd.a;
  vec3 col = gA.rgb * (1.0 - metal) * sd.rgb + envBRDF(f0, rough, nv) * ss.rgb + specL(N, V, uKeyDir, f0, rough) * uKeyCol * vis + specL(N, V, uRimDir, f0, rough) * uRimCol;
  // 表面のうすい透明の層（フィルムや塗装のつや）
  float cc = floor(gE.a) / 63.0;
  if (cc > 0.0) { float cr = max(fract(gE.a), 0.04), fc = (0.04 + 0.96 * pow(1.0 - nv, 5.0)) * cc;
    col = col * (1.0 - fc) + cc * (envBRDF(vec3(0.04), cr, nv) * ss.rgb + specL(N, V, uKeyDir, vec3(0.04), cr) * uKeyCol * vis + specL(N, V, uRimDir, vec3(0.04), cr) * uRimCol); }
  col += gE.rgb;
  if (abs(P.y - uFloorY) < 0.02) col = mix(col, uBg, smoothstep(2.6, 6.6, length(P.xz)));      // 床は遠くで背景へとけこませる
  oC = vec4(col, 1.0);
}`;
const COPY_FS = /* glsl */`precision highp float; precision highp sampler2D; uniform sampler2D tSrc; uniform float uA; out vec4 oC; void main(){ oC = vec4(texelFetch(tSrc, ivec2(gl_FragCoord.xy), 0).rgb, uA); }`;
const PRESENT_FS = /* glsl */`precision highp float; precision highp sampler2D; uniform sampler2D tSrc, tDepth; out vec4 oC; void main(){ ivec2 p = ivec2(gl_FragCoord.xy); oC = vec4(texelFetch(tSrc, p, 0).rgb, 1.0); gl_FragDepth = texelFetch(tDepth, p, 0).r; }`;

const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };

export function createLiveRT({ renderer, scene, camera, composer, renderPass, envEq, key, rim, hemi, floor, hb }) {
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 がない');
  const env = makeEnv(envEq), bvhU = new MeshBVHUniformStruct(), tA = new FloatVertexAttributeTexture(), tN = new FloatVertexAttributeTexture();
  const cam = { uCamWorld: { value: new THREE.Matrix4() }, uProj: { value: new THREE.Vector4() }, uCamPos: { value: new THREE.Vector3() }, uLogK: { value: 1 }, uFull: { value: new THREE.Vector2() },
    tAlbedo: { value: null }, tNormal: { value: null }, tDepth: { value: null } };
  const lit = { uKeyDir: { value: new THREE.Vector3() }, uKeyCol: { value: new THREE.Vector3() }, uRimDir: { value: new THREE.Vector3() }, uRimCol: { value: new THREE.Vector3() } };
  const raw = (fs, uniforms, o = {}) => new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, ...o });
  const mTrace = raw(TRACE_FS, { ...cam, ...lit, bvh: { value: bvhU }, tAttrA: { value: tA }, tAttrN: { value: tN }, tEnv: { value: env.mip }, tIrr: { value: env.irr },
    uSize: { value: new THREE.Vector2() }, uFrame: { value: 0 }, uEnvI: { value: 1 }, uSky: { value: new THREE.Vector3() }, uGround: { value: new THREE.Vector3() } });
  const mTemporal = raw(TEMPORAL_FS, { ...cam, tCD: { value: null }, tCS: { value: null }, tPD: { value: null }, tPS: { value: null }, uSize: mTrace.uniforms.uSize,
    uPrevVP: { value: new THREE.Matrix4() }, uPrevCam: { value: new THREE.Vector3() }, uAlpha: { value: 1 }, uStill: { value: 0 }, uReset: { value: 1 } });
  const mCompose = raw(COMPOSE_FS, { ...cam, ...lit, tEmis: { value: null }, tHD: { value: null }, tHS: { value: null }, uSize: mTrace.uniforms.uSize, uBg: { value: new THREE.Vector3() }, uFloorY: { value: floor.position.y } });
  const mCopy = raw(COPY_FS, { tSrc: { value: null }, uA: { value: 1 } }, { transparent: true });
  const mPresent = raw(PRESENT_FS, { tSrc: { value: null }, tDepth: { value: null } }, { depthTest: true, depthFunc: THREE.AlwaysDepth, depthWrite: true });
  const quad = new FullScreenQuad(mTrace);

  let gbuf = null, tr = null, hA = null, hB = null, color = null, acc = null, W = 0, H = 0, rw = 0, rh = 0;
  let si = 2, cool = 30, ema = 16, lastT = 0, still = 0, reset = true, frameNo = 0, ghosts = [], built = false, failed = false, jitOn = false;
  const lastM = new Float32Array(16), lastP = new Float32Array(16), prevVP = new THREE.Matrix4(), prevCam = new THREE.Vector3(), inv = new THREE.Matrix4(), cc = new THREE.Color(), v3 = new THREE.Vector3();
  const mrt = (w, h, n, f) => new THREE.WebGLMultipleRenderTargets(w, h, n, { type: THREE.HalfFloatType, minFilter: f, magFilter: f, depthBuffer: false });
  const one = (w, h) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
  function ensure(w, h) {
    if (w !== W || h !== H) {
      for (const t of [gbuf, color, acc]) t && t.dispose();
      gbuf = new THREE.WebGLMultipleRenderTargets(w, h, 3, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
      gbuf.depthTexture = new THREE.DepthTexture(w, h); gbuf.depthTexture.minFilter = gbuf.depthTexture.magFilter = THREE.NearestFilter;
      color = one(w, h); acc = one(w, h); W = w; H = h; rw = 0; reset = true;
    }
    const s = window.__rtScale || STEPS[si], nw = Math.max(8, Math.round(w * s)), nh = Math.max(8, Math.round(h * s));
    if (nw !== rw || nh !== rh) { for (const t of [tr, hA, hB]) t && t.dispose(); tr = mrt(nw, nh, 2, THREE.NearestFilter); hA = mrt(nw, nh, 2, THREE.LinearFilter); hB = mrt(nw, nh, 2, THREE.LinearFilter); rw = nw; rh = nh; reset = true; }
  }
  const draw = (mat, target, clear = true) => { quad.material = mat; renderer.setRenderTarget(target); const ac = renderer.autoClear; renderer.autoClear = clear; quad.render(renderer); renderer.autoClear = ac; };

  // 光線が当たる相手（いま見えている機体と床）を1つにまとめ、探しやすい木の形に並べる
  function build({ ghost = false } = {}) {
    const t0 = performance.now(); scene.updateMatrixWorld(true);
    const list = [];
    hb.root.traverse(o => { if (!o.isMesh || o.userData.noPick || (ghost && o.userData.skin)) return; for (let v = o; v; v = v.parent) if (!v.visible) return; list.push(o); });
    list.push(floor);
    for (const m of hb.skinMeshes) { if (ghost) m.layers.enable(1); else m.layers.disable(1); }
    ghosts = ghost ? hb.skinMeshes : [];
    let nv = 0, ni = 0; for (const m of list) { const g = m.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const pos = new Float32Array(nv * 3), an = new Float32Array(nv * 4), aa = new Float32Array(nv * 4), idx = new Uint32Array(ni), nm = new THREE.Matrix3();
    let vo = 0, io = 0;
    for (const m of list) {
      const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, e = m.matrixWorld.elements, ne = nm.getNormalMatrix(m.matrixWorld).elements, info = matInfo(m.material);
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i), a = N.getX(i), b = N.getY(i), c = N.getZ(i), o = vo + i;
        pos[o * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; pos[o * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; pos[o * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        const nx = ne[0] * a + ne[3] * b + ne[6] * c, ny = ne[1] * a + ne[4] * b + ne[7] * c, nz = ne[2] * a + ne[5] * b + ne[8] * c, l = Math.hypot(nx, ny, nz) || 1;
        an[o * 4] = nx / l; an[o * 4 + 1] = ny / l; an[o * 4 + 2] = nz / l; an[o * 4 + 3] = info[4];
        aa[o * 4] = info[0]; aa[o * 4 + 1] = info[1]; aa[o * 4 + 2] = info[2]; aa[o * 4 + 3] = info[3];
      }
      if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) idx[io + i] = ia[i] + vo; io += ia.length; } else { for (let i = 0; i < P.count; i++) idx[io + i] = vo + i; io += P.count; }
      vo += P.count;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
    bvhU.updateFrom(new MeshBVH(geo, { maxLeafTris: 6 }));
    tN.updateFrom(new THREE.BufferAttribute(an, 4)); tA.updateFrom(new THREE.BufferAttribute(aa, 4));
    built = true; reset = true;
    return { tris: ni / 3, ms: Math.round(performance.now() - t0) };
  }

  function frame(out) {
    const now = performance.now();
    if (still === 0 && lastT) ema = ema * 0.9 + Math.min(now - lastT, 400) * 0.1;      // 動かしているあいだの1フレームの時間
    lastT = now;
    if (!window.__rtScale && still === 0 && --cool <= 0) { if (ema > 36 && si > 0) { si--; cool = 45; } else if (ema < 21 && si < STEPS.length - 1) { si++; cool = 120; } }
    ensure(Math.floor(out.width), Math.floor(out.height));
    camera.updateMatrixWorld();
    const m = camera.matrixWorld.elements, p = camera.projectionMatrix.elements; let same = !reset;
    for (let i = 0; i < 16; i++) { if (Math.abs(m[i] - lastM[i]) > 1e-6 || Math.abs(p[i] - lastP[i]) > 1e-6) same = false; lastM[i] = m[i]; lastP[i] = p[i]; }
    still = same ? still + 1 : 0;
    if (still <= MAXN) {
      // 止まっているあいだは、画素の中で位置を少しずつずらして重ね、輪郭のぎざぎざを消す
      jitOn = still >= 2 && !(camera.view && camera.view.enabled);
      const asp = camera.aspect;
      if (jitOn) camera.setViewOffset(W, H, halton(still - 1, 2) - 0.5, halton(still - 1, 3) - 0.5, W, H);
      const pe = camera.projectionMatrix.elements;
      // ① 面の向き・粗さ・色・奥行きを記録する（重ねて描く物と、透かした外側は外す）
      const ov = hb.overlays().concat(ghosts), vis = ov.map(o => o.visible); ov.forEach(o => { o.visible = false; });
      const bg = scene.background, ca = renderer.getClearAlpha(); renderer.getClearColor(cc);
      scene.background = null; renderer.setClearColor(0x000000, 0); gbufUniform.value = 1;
      renderer.setRenderTarget(gbuf); renderer.render(scene, camera);
      gbufUniform.value = 0; scene.background = bg; renderer.setClearColor(cc, ca); ov.forEach((o, i) => { o.visible = vis[i]; });
      cam.uCamWorld.value.copy(camera.matrixWorld); cam.uProj.value.set(pe[0], pe[5], pe[8], pe[9]); cam.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
      cam.uLogK.value = Math.log2(camera.far + 1); cam.uFull.value.set(W, H);
      cam.tAlbedo.value = gbuf.texture[0]; cam.tNormal.value = gbuf.texture[1]; cam.tDepth.value = gbuf.depthTexture;
      lit.uKeyDir.value.copy(key.position).sub(key.target.position).normalize(); lit.uKeyCol.value.set(key.color.r, key.color.g, key.color.b).multiplyScalar(key.intensity);
      lit.uRimDir.value.copy(rim.position).sub(rim.target.position).normalize(); lit.uRimCol.value.set(rim.color.r, rim.color.g, rim.color.b).multiplyScalar(rim.intensity);
      // ② 光線を追う
      const u = mTrace.uniforms; u.uSize.value.set(rw, rh); u.uFrame.value = ++frameNo;
      u.uSky.value.set(hemi.color.r, hemi.color.g, hemi.color.b).multiplyScalar(hemi.intensity); u.uGround.value.set(hemi.groundColor.r, hemi.groundColor.g, hemi.groundColor.b).multiplyScalar(hemi.intensity);
      draw(mTrace, tr);
      // ③ 前のフレームと重ねる
      const t = mTemporal.uniforms; t.tCD.value = tr.texture[0]; t.tCS.value = tr.texture[1]; t.tPD.value = hA.texture[0]; t.tPS.value = hA.texture[1];
      t.uPrevVP.value.copy(prevVP); t.uPrevCam.value.copy(prevCam); t.uStill.value = still >= 1 ? 1 : 0; t.uReset.value = reset ? 1 : 0; t.uAlpha.value = still >= 1 ? 1 / (still + 9) : 0.11;
      draw(mTemporal, hB); [hA, hB] = [hB, hA];
      prevVP.multiplyMatrices(camera.projectionMatrix, inv.copy(camera.matrixWorld).invert()); prevCam.setFromMatrixPosition(camera.matrixWorld);
      // ④ 色を組み立てる
      const c = mCompose.uniforms; c.tEmis.value = gbuf.texture[2]; c.tHD.value = hA.texture[0]; c.tHS.value = hA.texture[1];
      if (bg && bg.isColor) c.uBg.value.set(bg.r, bg.g, bg.b);
      draw(mCompose, color);
      if (jitOn) { camera.aspect = asp; camera.clearViewOffset(); }
      // ⑤ 止まっているあいだは重ね続ける
      if (still >= 2) { mCopy.uniforms.tSrc.value = color.texture; mCopy.uniforms.uA.value = 1 / (still - 1); draw(mCopy, acc, false); }
      reset = false;
    }
    mPresent.uniforms.tSrc.value = (still >= 2 ? acc : color).texture; mPresent.uniforms.tDepth.value = gbuf.depthTexture;
    draw(mPresent, out);
    // 選択の光や、透かした外側は、仕上がった絵の上に重ねて描く
    const ac = renderer.autoClear, bg2 = scene.background; renderer.autoClear = false; scene.background = null; camera.layers.set(1);
    renderer.setRenderTarget(out); renderer.render(scene, camera);
    camera.layers.set(0); scene.background = bg2; renderer.autoClear = ac;
  }

  class LivePass extends Pass {
    constructor() { super(); this.needsSwap = false; this.enabled = false; }
    render(r, writeBuffer, readBuffer) { frame(readBuffer); }
  }
  const pass = new LivePass();
  composer.insertPass(pass, 0);

  return {
    build,
    get built() { return built; },
    get failed() { return failed; },
    invalidate() { reset = true; },
    // 1フレームを描く。シェーダーが作れなかったときは false を返す
    render() {
      const prev = renderer.debug.onShaderError; renderer.debug.onShaderError = (gl, prog, vs, fs) => { failed = true; console.warn('レイトレーシングのシェーダーを作れなかった：' + (gl.getProgramInfoLog(prog) || '') + ' ' + (gl.getShaderInfoLog(fs) || '').slice(0, 600) + ' ' + (gl.getShaderInfoLog(vs) || '').slice(0, 300)); };
      renderPass.enabled = false; pass.enabled = true;
      try { composer.render(); } catch (e) { console.warn(e); failed = true; }
      pass.enabled = false; renderPass.enabled = true; renderer.debug.onShaderError = prev;
      if (jitOn && camera.view && camera.view.enabled && failed) camera.clearViewOffset();
      return !failed;
    },
    off() { for (const m of hb.skinMeshes) m.layers.disable(1); ghosts = []; camera.layers.set(0); },
    status() {
      const pc = Math.round((window.__rtScale || STEPS[si]) * 100);
      return still > MAXN ? 'レイトレーシング：仕上がった' : still >= 2 ? `レイトレーシング：重ねて仕上げている ${Math.min(still - 1, MAXN)} / ${MAXN}` : `レイトレーシング：動きに合わせて光線を追っている（解像度 ${pc}%、毎秒 ${Math.max(1, Math.round(1000 / ema))} コマ）`;
    },
    info() { return { still, scale: window.__rtScale || STEPS[si], ema, rw, rh, W, H }; },
  };
}
