// M-Vロケット5号機（全長30.8m、直径2.5m）。5号機からの構成：第1段 M-14、第2段 M-25、第3段 M-34b、キックモータ KM-V2。
//   y=0 は第1段の後部筒の下端。ノズルの出口は y=-0.9、フェアリングの先端は y=29.9。
//   第1段 14.6m・第2段 6.35m・第3段 3.45m（直径2.2m）という公表寸法に合わせて割りふった。細部の寸法は写真と図からの推定。
import * as THREE from 'three';

const PI = Math.PI;
export const MVY = { fair: 20.7, b3: 20.8, kick: 24.6, sc: 26.75, joint: 13.0, b2: 14.6, top: 29.9, nozzle: -0.9 };

// 塗装した外板の模様（円周1周 × 高さ2mぶん）。溶接の継ぎ目、縦の筋、うすい汚れ
function paintTex(seed, base = [236, 235, 230]) {
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.fillStyle = `rgb(${base})`; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { const px = rnd() * W, w = 1 + rnd() * 5, a = 0.012 + rnd() * 0.03; x.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`; x.fillRect(px, 0, w, H); }
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(60,55,45,${0.01 + rnd() * 0.025})`; const r = 2 + rnd() * 14; x.beginPath(); x.arc(rnd() * W, rnd() * H, r, 0, 7); x.fill(); }
  x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(0, H - 14, W, 3); x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(0, H - 11, W, 2);
  for (let i = 0; i < 64; i++) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.arc((i + 0.5) / 64 * W, H - 24, 2.2, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

export function makeMV(T) {
  const g = new THREE.Group();
  const std = (o) => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...o });
  const tex = paintTex(7), texF = paintTex(91, [240, 239, 235]);
  const nrm = T.metalN ? T.metalN.clone() : null; if (nrm) { nrm.repeat.set(3, 3); nrm.needsUpdate = true; }
  const skin = (len, t = tex) => { const m = t.clone(); m.repeat.set(1, Math.max(1, Math.round(len / 2))); m.needsUpdate = true; return std({ map: m, roughness: 0.52, metalness: 0.04, normalMap: nrm, normalScale: new THREE.Vector2(0.12, 0.12) }); };
  const white = std({ color: 0xeeede8, roughness: 0.5, metalness: 0.05 });
  const silver = std({ color: 0xc9ccd1, roughness: 0.36, metalness: 0.85 });
  const alu = std({ color: 0xa9adb3, roughness: 0.48, metalness: 0.8 });
  const dark = std({ color: 0x1b1c20, roughness: 0.62, metalness: 0.2 });
  const carbon = std({ color: 0x24262a, roughness: 0.5, metalness: 0.25, map: T.cfrpC || null });
  const char = std({ color: 0x2c2420, roughness: 0.85 });
  const red = std({ color: 0xa3261e, roughness: 0.55 });
  const gold = std({ color: 0xd9a441, roughness: 0.32, metalness: 0.9 });
  const blanket = std({ color: 0xb9ae93, roughness: 0.9, side: THREE.DoubleSide });
  const sh = (m) => { m.castShadow = m.receiveShadow = true; return m; };
  // 回転体。模様が伸び縮みしないように、縦の座標は輪郭の長さに比例させる
  const lathe = (pts, mat, y = 0, seg = 64, arc, phi0) => {
    const geo = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg, phi0 ?? 0, arc ?? PI * 2), uv = geo.attributes.uv, n = pts.length, L = [0];
    for (let j = 1; j < n; j++) L.push(L[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
    for (let i = 0; i <= seg; i++) for (let j = 0; j < n; j++) uv.setY(i * n + j, L[j] / (L[n - 1] || 1));
    const m = sh(new THREE.Mesh(geo, mat)); m.position.y = y; return m;
  };
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  const strut = (p0, p1, r, mat, seg = 8) => { const m = sh(new THREE.Mesh(new THREE.CylinderGeometry(r, r, p0.distanceTo(p1), seg), mat)); m.position.copy(p0).add(p1).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(P(0, 1, 0), p1.clone().sub(p0).normalize()); return m; };
  const box = (w, h, d, mat, x, y, z, ry = 0) => { const m = sh(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)); m.position.set(x, y, z); m.rotation.y = ry; return m; };
  const pol = (a, r, y) => P(Math.cos(a) * r, y, Math.sin(a) * r);
  const Rb = 1.25;
  // 円周に沿って置く部品：a は角度。部品の +X が外向きになる
  const around = (parent, a, r, y, build) => { const h = new THREE.Group(); h.position.copy(pol(a, r, y)); h.rotation.y = -a; build(h); parent.add(h); return h; };

  // ---------- 第1段 M-14 ----------
  const lower = new THREE.Group(); g.add(lower);
  const b1 = new THREE.Group(); lower.add(b1);
  b1.add(lathe([[1.27, 0], [Rb, 0.25], [Rb, 1.9]], skin(2)));                                   // 後部筒
  b1.add(lathe([[Rb, 0], [Rb, 10.5]], skin(10.5), 1.9));                                         // モータケース
  b1.add(lathe([[Rb, 12.4], [Rb, 13.0]], dark));                                                 // 前部スカート
  for (const y of [1.9, 7.1, 12.4]) b1.add(lathe([[Rb + 0.012, 0], [Rb + 0.02, 0.03], [Rb + 0.02, 0.11], [Rb + 0.012, 0.14]], alu, y - 0.07));   // 継ぎ目の帯
  for (const y of [0.55, 4.4, 9.6]) b1.add(lathe([[Rb + 0.006, 0], [Rb + 0.006, 0.26]], dark, y));
  // ノズル（出口の半頂角15度の円すい）。上は後部筒の中に入っている
  b1.add(lathe([[0.31, 1.6], [0.98, -0.9]], char, 0, 56)); b1.add(lathe([[0.985, -0.9], [0.33, 1.6]], carbon, 0, 56));
  b1.add(lathe([[0.98, -0.9], [1.0, -0.9], [1.0, -0.78], [0.985, -0.78]], alu, 0, 56));
  b1.add(lathe([[0.34, 1.55], [0.62, 1.75], [0.9, 1.85], [1.22, 1.88]], dark, 0, 40));           // 後部筒の底板
  for (let i = 0; i < 2; i++) { const a = PI / 4 + i * PI / 2; b1.add(strut(pol(a, 1.12, 1.7), pol(a, 0.86, -0.35), 0.05, silver)); b1.add(strut(pol(a, 1.12, 1.7), pol(a, 0.98, 0.9), 0.085, alu)); }   // ノズルを振る2本の腕
  // ロール制御の小型モータ（SMRC）：後部筒の両側。左右に噴き口を持つ
  const smrc = (parent, a, y, s = 1) => around(parent, a, Rb + 0.13 * s, y, (h) => {
    const body = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.11 * s, 0.75 * s, 6, 14), white)); h.add(body);
    for (const k of [-1, 1]) { const n = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.07 * s, 0.16 * s, 12), dark)); n.rotation.x = PI / 2; n.position.set(0.02, 0.25 * s, k * 0.15 * s); h.add(n); }
    h.add(box(0.1 * s, 0.9 * s, 0.26 * s, alu, -0.1 * s, 0, 0));
  });
  for (const a of [0, PI]) smrc(b1, a, 1.0);
  // 配線を通す細長い覆い（2本）と、ランチャのレールにかかる金具
  for (const a of [PI / 2, -PI / 2]) around(b1, a, Rb + 0.045, 7.2, (h) => { h.add(box(0.09, 11.6, 0.2, white, 0, 0, 0)); for (let i = 0; i < 7; i++) h.add(box(0.1, 0.05, 0.24, alu, 0, -5.4 + i * 1.8, 0)); });
  for (const y of [1.2, 11.9]) for (const k of [-1, 1]) around(b1, PI + k * 0.2, Rb + 0.06, y, (h) => { h.add(box(0.14, 0.34, 0.2, alu, 0, 0, 0)); h.add(box(0.1, 0.12, 0.3, dark, 0.07, 0, 0)); });
  // ---------- 1/2段接手：すき間のある格子。第2段の炎をここから逃がす ----------
  const joint = new THREE.Group(); b1.add(joint);
  joint.add(lathe([[Rb, 0], [Rb, 0.16], [Rb - 0.1, 0.16], [Rb - 0.1, 0]], alu, 13.0)); joint.add(lathe([[Rb, 0], [Rb, 0.14], [Rb - 0.1, 0.14], [Rb - 0.1, 0]], alu, 14.46));
  { const n = 16; for (let i = 0; i < n; i++) { const a0 = i / n * PI * 2, a1 = (i + 1) / n * PI * 2, r = Rb - 0.05;
      joint.add(strut(pol(a0, r, 13.16), pol(a1, r, 14.46), 0.045, silver)); joint.add(strut(pol(a1, r, 13.16), pol(a0, r, 14.46), 0.045, silver)); joint.add(strut(pol(a0, r, 13.16), pol(a0, r, 14.46), 0.035, alu)); } }
  // ---------- 第2段 M-25 ----------
  const b2 = new THREE.Group(); lower.add(b2);
  b2.add(lathe([[Rb, 0], [Rb, 0.5]], dark, 14.6)); b2.add(lathe([[Rb, 0], [Rb, 5.1]], skin(5.1), 15.1));
  b2.add(lathe([[Rb, 0], [Rb, 0.5]], silver, 20.2));
  b2.add(lathe([[Rb + 0.006, 0], [Rb + 0.006, 0.3]], red, 19.5));
  for (const y of [15.1, 20.2]) b2.add(lathe([[Rb + 0.012, 0], [Rb + 0.02, 0.03], [Rb + 0.02, 0.11], [Rb + 0.012, 0.14]], alu, y - 0.07));
  // ノズル（つりがね形）。格子の中にのぞく
  { const pts = [], pin = []; for (let i = 0; i <= 14; i++) { const t = i / 14, r = 0.24 + 0.62 * Math.pow(t, 0.62), y = 14.95 - 1.75 * t; pts.push([r, y]); pin.push([r - 0.02, y]); }
    b2.add(lathe(pts, carbon, 0, 56)); b2.add(lathe(pin.reverse(), char, 0, 56)); b2.add(lathe([[0.24, 14.95], [0.6, 15.1], [1.2, 15.1]], dark, 0, 40)); }
  for (let i = 0; i < 4; i++) around(b2, PI / 4 + i * PI / 2, 0.98, 14.82, (h) => { h.add(box(0.22, 0.3, 0.34, gold, 0, 0, 0)); const n = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.12, 10), dark)); n.rotation.z = PI / 2; n.position.set(0.16, 0, 0); h.add(n); });   // 姿勢制御の小型モータ（SMSJ）
  for (const a of [PI / 2, -PI / 2]) smrc(b2, a, 15.75, 0.7);
  around(b2, 0.6, Rb + 0.045, 17.7, (h) => { h.add(box(0.09, 5.0, 0.18, white, 0, 0, 0)); for (let i = 0; i < 4; i++) h.add(box(0.1, 0.05, 0.22, alu, 0, -2.1 + i * 1.4, 0)); });
  // ---------- ノーズフェアリング（2つ割り、長さ9.2m） ----------
  const fp = [[Rb, 0], [Rb, 5.9]]; for (let i = 1; i <= 18; i++) { const t = i / 18; fp.push([Rb * Math.pow(Math.cos(t * PI / 2), 0.62), 5.9 + 3.3 * Math.sin(t * PI / 2)]); }
  const fin = fp.slice().reverse().map(p => [Math.max(0.001, p[0] - 0.045), p[1]]);
  const halves = [0, 1].map(k => {
    const h = new THREE.Group(); h.position.y = MVY.fair;
    const outer = lathe(fp, skin(9.2, texF), 0, 48, PI, k * PI); outer.material.side = THREE.FrontSide; h.add(outer);
    const inner = lathe(fin, blanket, 0, 48, PI, k * PI); h.add(inner);
    h.add(lathe([[Rb + 0.006, 0.25], [Rb + 0.006, 0.6]], red, 0, 48, PI, k * PI));
    h.add(lathe([[Rb, 0], [Rb + 0.02, 0.02], [Rb + 0.02, 0.12], [Rb, 0.14], [Rb - 0.045, 0.14], [Rb - 0.045, 0]], alu, 0, 48, PI, k * PI));
    // 割れ目に沿った枠と、内側の補強の輪
    for (const sgn of [-1, 1]) { const e = new THREE.Group(); e.rotation.y = sgn * PI / 2; e.position.x = k ? -0.035 : 0.035; for (let i = 0; i < fp.length - 1; i++) { const a = P(fp[i][0] - 0.03, fp[i][1], 0), b = P(fp[i + 1][0] - 0.03, fp[i + 1][1], 0); e.add(strut(a, b, 0.035, alu, 6)); } h.add(e); }
    for (const y of [1.6, 3.1, 4.6]) h.add(lathe([[Rb - 0.05, y], [Rb - 0.12, y], [Rb - 0.12, y + 0.06], [Rb - 0.05, y + 0.06]], alu, 0, 48, PI, k * PI));
    g.add(h); return h;
  });
  // ---------- 第3段 M-34b（直径2.2m）：伸展ノズル、計器部、姿勢制御の噴射装置 ----------
  const upper = new THREE.Group(); upper.position.y = MVY.b3; g.add(upper);
  upper.add(lathe([[0.2, 0.9], [0.5, 0.75], [0.82, 0.35], [1.02, 0.02], [1.02, 0.1], [0.84, 0.42], [0.52, 0.82], [0.22, 0.97]], carbon, 0, 56));          // ノズル本体
  const cone = lathe([[0.72, 0.62], [1.06, 0.05], [1.07, 0.05], [0.735, 0.64]], char, 0, 56); upper.add(cone);                                              // 伸びる前の外側の筒
  for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2 + 0.3; upper.add(strut(pol(a, 1.0, 0.95), pol(a, 1.07, 0.1), 0.02, silver)); }
  { const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20, th = -1.12 + t * 2.24; pts.push([1.1 * Math.cos(th) * (1 - 0.08 * Math.abs(Math.sin(th))), 1.9 + 1.02 * Math.sin(th)]); } pts.unshift([0.25, 0.95]); pts.push([0.55, 3.02]);
    upper.add(lathe(pts, carbon, 0, 56)); }
  upper.add(lathe([[1.1, 1.75], [1.115, 1.75], [1.115, 2.05], [1.1, 2.05]], gold, 0, 56));
  upper.add(lathe([[1.1, 2.9], [1.1, 3.3], [1.0, 3.3], [1.0, 2.9]], alu, 0, 56));                                                                           // 計器部（B3PL）
  for (let i = 0; i < 8; i++) around(upper, i / 8 * PI * 2, 0.72, 3.12, (h) => h.add(box(0.3, 0.26, 0.36, i % 2 ? gold : alu, 0, 0, 0)));
  for (let i = 0; i < 2; i++) around(upper, i * PI + 0.4, 1.13, 3.1, (h) => { h.add(box(0.1, 0.22, 0.24, alu, 0, 0, 0)); for (const k of [-1, 1]) { const n = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.09, 8), dark)); n.rotation.x = k * PI / 2; n.position.set(0.02, 0, k * 0.16); h.add(n); } });   // サイドジェット
  for (let i = 0; i < 2; i++) { const s = sh(new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 12), silver)); s.position.copy(pol(i * PI + 1.6, 0.78, 3.45)); upper.add(s); }
  upper.add(lathe([[1.0, 3.3], [0.52, 3.85], [0.5, 3.85], [0.98, 3.3]], alu, 0, 56));                                                                        // 3/4段接手
  for (let i = 0; i < 2; i++) around(upper, i * PI + 2.2, 0.8, 3.6, (h) => { const n = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 10), white)); n.rotation.x = PI / 2; h.add(n); });   // スピンモータ
  // ---------- キックモータ KM-V2 と衛星接手 ----------
  const kick = new THREE.Group(); kick.position.y = MVY.kick; g.add(kick);
  { const pts = [[0.2, -0.38]]; for (let i = 0; i <= 18; i++) { const th = -1.25 + i / 18 * 2.5; pts.push([0.62 * Math.cos(th), 0.62 + 0.62 * Math.sin(th)]); } pts.push([0.3, 1.24]);
    kick.add(lathe(pts, white, 0, 48)); }
  kick.add(lathe([[0.62, 0.5], [0.632, 0.5], [0.632, 0.74], [0.62, 0.74]], gold, 0, 48));
  kick.add(lathe([[0.13, -0.3], [0.3, -0.52], [0.4, -0.7], [0.41, -0.7], [0.32, -0.5], [0.15, -0.26]], carbon, 0, 40));
  kick.add(lathe([[0.33, -0.45], [0.47, -0.74], [0.48, -0.74], [0.345, -0.43]], char, 0, 40));
  kick.add(lathe([[0.3, 1.2], [0.46, 1.34], [0.46, 1.5], [0.44, 1.5], [0.44, 1.36], [0.28, 1.24]], alu, 0, 48));                                             // 衛星接手
  kick.add(lathe([[0.455, 1.47], [0.48, 1.47], [0.48, 1.53], [0.455, 1.53]], silver, 0, 48));                                                               // 締め付けのバンド
  g.lower = lower; g.b1 = b1; g.b2 = b2; g.joint = joint; g.halves = halves; g.upper = upper; g.kick = kick; g.b3cone = cone;
  g.resetParts = () => {
    lower.visible = b1.visible = b2.visible = upper.visible = kick.visible = true;
    for (const o of [lower, b1, b2]) { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); }
    upper.position.set(0, MVY.b3, 0); upper.rotation.set(0, 0, 0); kick.position.set(0, MVY.kick, 0); kick.rotation.set(0, 0, 0); cone.position.y = 0;
    halves.forEach(h => { h.visible = true; h.position.set(0, MVY.fair, 0); h.rotation.set(0, 0, 0); });
  };
  g.Y = MVY; g.scY = MVY.sc; g.nozzleY = MVY.nozzle;
  return g;
}
