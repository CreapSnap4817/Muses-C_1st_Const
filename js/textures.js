import * as THREE from 'three';

// ---------- 乱数とノイズ ----------
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function h3(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
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
export function fbm3(x, y, z, oct = 5, lac = 2.03, gain = 0.5) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise3(x, y, z); n += a; x *= lac; y *= lac; z *= lac; a *= gain; }
  return s / n;
}
const yieldUI = () => new Promise(r => setTimeout(r, 0));

export function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
}
function tex(c, srgb = true, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8;
  return t;
}

// ---------- MLI（金色の断熱シート）：しわの面 ----------
export function makeMLI(size = 512) {
  const [c, ctx] = canvas(size, size);
  const [cb, ctxb] = canvas(size, size);
  const img = ctx.createImageData(size, size), imb = ctxb.createImageData(size, size);
  const N = 30, r = rng(11), pts = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++)
    pts.push([(i + 0.1 + r() * 0.8) / N, (j + 0.1 + r() * 0.8) / N, r(), r() * 2 - 1, r() * 2 - 1]);
  const TAU = Math.PI * 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const ci = Math.floor(u * N), cj = Math.floor(v * N);
    let f1 = 9, f2 = 9, best = null, bx = 0, by = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      let ii = ci + di, jj = cj + dj, ox = 0, oy = 0;
      if (ii < 0) { ii += N; ox = -1; } else if (ii >= N) { ii -= N; ox = 1; }
      if (jj < 0) { jj += N; oy = -1; } else if (jj >= N) { jj -= N; oy = 1; }
      const p = pts[jj * N + ii];
      const px = p[0] + ox, py = p[1] + oy;
      const d = Math.hypot(u - px, v - py);
      if (d < f1) { f2 = f1; f1 = d; best = p; bx = px; by = py; } else if (d < f2) f2 = d;
    }
    const edge = Math.min(1, (f2 - f1) / 0.006);
    // 大きなたるみ（低周波）＋細かいしわ（ボロノイ面）
    const fold = fbm3(Math.cos(u * TAU) * 1.2 + 4, Math.sin(u * TAU) * 1.2, Math.cos(v * TAU) * 1.2 + Math.sin(v * TAU) * 0.9, 4);
    let b = 0.86 + 0.16 * (best[2] - 0.5) + (best[3] * (u - bx) + best[4] * (v - by)) * 9;
    b = b * (0.82 + 0.18 * edge) * (0.75 + 0.5 * fold);
    const L = Math.max(0.2, Math.min(1.25, b));
    const i4 = (y * size + x) * 4;
    img.data[i4] = Math.min(255, 255 * L);
    img.data[i4 + 1] = Math.min(255, 255 * L * 0.79);
    img.data[i4 + 2] = Math.min(255, 255 * L * 0.40);
    img.data[i4 + 3] = 255;
    const bb = Math.max(0, Math.min(255, 90 + 120 * (best[3] * (u - bx) + best[4] * (v - by)) * 9 + 60 * fold + 30 * edge));
    imb.data[i4] = imb.data[i4 + 1] = imb.data[i4 + 2] = bb; imb.data[i4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); ctxb.putImageData(imb, 0, 0);
  return { map: tex(c, true, true), bump: tex(cb, false, true) };
}

// ---------- 太陽電池セル ----------
export function makeSolarCells() {
  const W = 512, H = 768;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#c9ccd2'; ctx.fillRect(0, 0, W, H);
  const m = 14, cols = 8, rows = 12;
  const cw = (W - m * 2) / cols, ch = (H - m * 2) / rows;
  const r = rng(5);
  ctx.fillStyle = '#05070c'; ctx.fillRect(m - 2, m - 2, W - 2 * m + 4, H - 2 * m + 4);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = m + i * cw + 2, y = m + j * ch + 2, w = cw - 4, h = ch - 4;
    const t = r();
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, `rgb(${18 + t * 8},${34 + t * 10},${82 + t * 20})`);
    g.addColorStop(1, `rgb(${10 + t * 6},${20 + t * 8},${56 + t * 18})`);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    // フィンガー電極
    ctx.strokeStyle = 'rgba(150,170,210,0.22)'; ctx.lineWidth = 0.6;
    for (let k = 1; k < 12; k++) { ctx.beginPath(); ctx.moveTo(x, y + k * h / 12); ctx.lineTo(x + w, y + k * h / 12); ctx.stroke(); }
    // バスバー
    ctx.fillStyle = 'rgba(200,205,215,0.75)';
    ctx.fillRect(x + w * 0.3, y, 1.6, h); ctx.fillRect(x + w * 0.7, y, 1.6, h);
    // 角の欠け
    ctx.fillStyle = '#05070c';
    [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py, 3, 0, 7); ctx.fill(); });
  }
  return tex(c);
}
export function makePanelBack(S = 1024) {
  // パドルの裏面：黒い面に、細い灰色の線でハーネスと枠が走る（実機と模型の写真に合わせた）
  const [c, ctx] = canvas(S, S), k = S / 1024, r = rng(9);
  ctx.fillStyle = '#0b0b0d'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) { ctx.fillStyle = `rgba(255,255,255,${0.012 + r() * 0.02})`; ctx.fillRect(r() * S, r() * S, 2 * k + r() * 5 * k, 1 * k); }
  const line = (pts, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w * k; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0] * k, p[1] * k) : ctx.moveTo(p[0] * k, p[1] * k)); ctx.stroke(); };
  line([[14, 14], [1010, 14], [1010, 1010], [14, 1010], [14, 14]], 3, 'rgba(120,124,130,0.55)');
  for (const y of [262, 512, 762]) line([[14, y], [1010, y]], 1.5, 'rgba(110,114,120,0.38)');
  for (const x of [346, 678]) line([[x, 14], [x, 1010]], 1.5, 'rgba(110,114,120,0.3)');
  // 配線の束：パネルの各列から集まり、内側の辺のコネクタへ向かう
  const bundle = (pts, n, gap) => { for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * gap; line(pts.map(([x, y, nx, ny]) => [x + nx * o, y + ny * o]), 1.3, 'rgba(165,168,174,0.62)'); } };
  bundle([[120, 900, 0, 1], [470, 900, 0.7, 0.7], [470, 520, 1, 0], [470, 150, 0.7, -0.7], [520, 60, 0, 1]], 6, 5);
  bundle([[900, 890, 0, 1], [560, 890, -0.7, 0.7], [560, 520, 1, 0], [560, 150, -0.7, -0.7], [520, 60, 0, 1]], 6, 5);
  bundle([[150, 380, 0, 1], [420, 380, 0, 1]], 4, 5); bundle([[880, 640, 0, 1], [610, 640, 0, 1]], 4, 5);
  for (const [x, y, w, h] of [[80, 870, 60, 60], [884, 860, 60, 60], [120, 350, 50, 60], [860, 610, 50, 60]]) { ctx.strokeStyle = 'rgba(165,168,174,0.6)'; ctx.lineWidth = 1.5 * k; ctx.strokeRect(x * k, y * k, w * k, h * k); }
  ctx.fillStyle = 'rgba(190,193,198,0.7)'; ctx.fillRect(488 * k, 26 * k, 64 * k, 30 * k);
  for (let i = 0; i < 9; i++) { ctx.fillStyle = 'rgba(150,153,160,0.5)'; ctx.fillRect((210 + i * 70) * k, 986 * k, 30 * k, 10 * k); }
  return tex(c);
}
// ---------- イオンエンジンのグリッド ----------
export function makeIonGrid() {
  const S = 256; const [c, ctx] = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#8d929a'); g.addColorStop(1, '#5d6168');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#0a0b0e';
  const R = S * 0.44, step = 9;
  for (let y = -R; y <= R; y += step * 0.866) {
    const row = Math.round(y / (step * 0.866));
    for (let x = -R; x <= R; x += step) {
      const xx = x + (row % 2 ? step / 2 : 0);
      if (xx * xx + y * y < R * R) { ctx.beginPath(); ctx.arc(S / 2 + xx, S / 2 + y, 3.1, 0, 7); ctx.fill(); }
    }
  }
  ctx.strokeStyle = '#3b3f45'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.47, 0, 7); ctx.stroke();
  return tex(c);
}
// ---------- ハニカム ----------
export function makeHoneycomb() {
  const S = 256; const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#b8bcc2'; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(70,75,82,0.5)'; ctx.lineWidth = 1.4;
  const s = 12, h = s * Math.sqrt(3);
  for (let y = -h; y < S + h; y += h) for (let x = -s * 3; x < S + s * 3; x += s * 3) {
    for (const [ox, oy] of [[0, 0], [s * 1.5, h / 2]]) {
      ctx.beginPath();
      for (let k = 0; k < 7; k++) { const a = k * Math.PI / 3; const px = x + ox + s * Math.cos(a), py = y + oy + s * Math.sin(a); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
    }
  }
  return tex(c, true, true);
}
// ---------- ラジエータ（OSR） ----------
export function makeOSR() {
  const [c, ctx] = canvas(256, 128);
  ctx.fillStyle = '#d6dbe2'; ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#7d848e'; ctx.lineWidth = 1.5;
  for (let x = 0; x <= 256; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke(); }
  for (let y = 0; y <= 128; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
  return tex(c);
}
// ---------- 粒子用のぼかし円 ----------
export function makeSoftDot() {
  const S = 128; const [c, ctx] = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return tex(c, false);
}
export function makeSmokePuff() {
  const S = 128; const [c, ctx] = canvas(S, S);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2);
    const d = Math.sqrt(dx * dx + dy * dy);
    const n = fbm3(x * 0.06, y * 0.06, 1.7, 4);
    const a = Math.max(0, 1 - d) ** 1.4 * (0.45 + 0.9 * n);
    const i = (y * S + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.min(255, a * 255);
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, false);
}
export function makeGlow(inner = 'rgba(255,250,235,1)', mid = 'rgba(255,214,140,0.35)') {
  const S = 256; const [c, ctx] = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner); g.addColorStop(0.08, inner); g.addColorStop(0.25, mid);
  g.addColorStop(0.6, 'rgba(255,190,120,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return tex(c);
}
// ---------- ターゲットマーカの表面 ----------
export function makeRetro() {
  // ターゲットマーカの表面：光をはね返す灰色の布を、白い格子の縫い目で区切ってある（1枚で約10.5cm、8マス）
  const S = 256, N = 8, p = S / N; const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#e6e6e1'; ctx.fillRect(0, 0, S, S);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const g = ctx.createLinearGradient(i * p, j * p, (i + 1) * p, (j + 1) * p); g.addColorStop(0, '#8b8e92'); g.addColorStop(0.5, '#9c9fa3'); g.addColorStop(1, '#85888c');
    ctx.fillStyle = g; ctx.fillRect(i * p + 2.5, j * p + 2.5, p - 5, p - 5);
  }
  const img = ctx.getImageData(0, 0, S, S), d = img.data; let s = 12345;
  for (let k = 0; k < d.length; k += 4) { s = (s * 16807) % 2147483647; const n = (s / 2147483647 - 0.5) * 14; d[k] += n; d[k + 1] += n; d[k + 2] += n; }
  ctx.putImageData(img, 0, 0);
  const t = tex(c, true, true); t.repeat.set(9.55, 9.55); return t;
}
// ---------- 砂・草地 ----------
export function makeGround(kind = 'sand') {
  const S = 512; const [c, ctx] = canvas(S, S);
  const img = ctx.createImageData(S, S);
  const base = kind === 'sand' ? [150, 96, 66] : kind === 'grass' ? [74, 92, 46] : [120, 112, 100];
  const alt = kind === 'sand' ? [128, 84, 60] : kind === 'grass' ? [98, 104, 58] : [90, 85, 78];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S * Math.PI * 2, v = y / S * Math.PI * 2;
    const n = fbm3(Math.cos(u) * 2 + 9, Math.sin(u) * 2, Math.cos(v) * 2 + Math.sin(v) * 2.3, 4);
    const g2 = noise3(x * 0.7, y * 0.7, 2.2);
    const t = Math.min(1, Math.max(0, n * 1.6 - 0.3));
    const i = (y * S + x) * 4;
    const k = 0.82 + g2 * 0.32;
    img.data[i] = (base[0] + (alt[0] - base[0]) * t) * k;
    img.data[i + 1] = (base[1] + (alt[1] - base[1]) * t) * k;
    img.data[i + 2] = (base[2] + (alt[2] - base[2]) * t) * k;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, true, true);
}

// ---------- 天の川 ----------
export async function makeMilkyWay(onp) {
  const W = 1024, H = 512; const [c, ctx] = canvas(W, H);
  const img = ctx.createImageData(W, H);
  const ng = new THREE.Vector3(0.25, 0.85, 0.46).normalize();
  const core = new THREE.Vector3(-0.8, 0.1, 0.45).normalize();
  const d = new THREE.Vector3();
  for (let y = 0; y < H; y++) {
    const th = y / H * Math.PI;
    for (let x = 0; x < W; x++) {
      const ph = x / W * Math.PI * 2;
      d.set(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th));
      const lat = Math.asin(d.dot(ng));
      const n = fbm3(d.x * 3 + 5, d.y * 3, d.z * 3, 5);
      const n2 = fbm3(d.x * 7, d.y * 7 + 3, d.z * 7, 4);
      const coreF = Math.max(0, d.dot(core)) ** 6;
      let band = Math.exp(-((lat / (0.2 + 0.1 * coreF)) ** 2)) * (0.35 + 0.9 * n) * (0.6 + 1.6 * coreF);
      band -= Math.exp(-((lat / 0.045) ** 2)) * n2 * 0.55 * (0.5 + coreF);
      band = Math.max(0, band);
      const glow = Math.exp(-((lat / 0.7) ** 2)) * 0.05;
      const I = band * 0.22 + glow * 0.4;
      const i = (y * W + x) * 4;
      img.data[i] = Math.min(255, 255 * I * (1.0 + coreF * 0.3));
      img.data[i + 1] = Math.min(255, 255 * I * 0.93);
      img.data[i + 2] = Math.min(255, 255 * I * (1.05 - coreF * 0.2));
      img.data[i + 3] = 255;
    }
    if (y % 64 === 0) { onp && onp(y / H); await yieldUI(); }
  }
  ctx.putImageData(img, 0, 0);
  return tex(c);
}

// ---------- 地球 ----------
export async function makeEarthTextures(maskURL, onp) {
  const im = new Image(); im.src = maskURL; await im.decode();
  const W = 2048, H = 1024;
  const [mc, mctx] = canvas(W, H);
  mctx.imageSmoothingEnabled = true; mctx.drawImage(im, 0, 0, W, H);
  // ぼかしで海岸線をなめらかに
  mctx.filter = 'blur(1.2px)'; mctx.drawImage(mc, 0, 0); mctx.filter = 'none';
  const mask = mctx.getImageData(0, 0, W, H).data;
  const [c, ctx] = canvas(W, H); const img = ctx.createImageData(W, H);
  const [rc, rctx] = canvas(W / 2, H / 2); const rim = rctx.createImageData(W / 2, H / 2);
  for (let y = 0; y < H; y++) {
    const lat = 90 - (y + 0.5) / H * 180, la = lat * Math.PI / 180;
    const cl = Math.cos(la), sl = Math.sin(la);
    for (let x = 0; x < W; x++) {
      const lon = (x + 0.5) / W * 360 - 180, lo = lon * Math.PI / 180;
      const dx = cl * Math.cos(lo), dy = sl, dz = cl * Math.sin(lo);
      const m = mask[(y * W + x) * 4] / 255;
      const nc = noise3(dx * 18, dy * 18, dz * 18) - 0.5;
      const land = m + nc * 0.35 > 0.5;
      const i = (y * W + x) * 4;
      let R, G, B;
      if (land) {
        const n = fbm3(dx * 6 + 3, dy * 6, dz * 6, 3);
        const n2 = noise3(dx * 30, dy * 30, dz * 30);
        const al = Math.abs(lat);
        let dry = Math.exp(-(((al - 24) / 10) ** 2)) * 1.15 + (n - 0.5) * 1.1;
        // 地域ごとの乾燥（サハラ・アラビア・オーストラリア内陸・中央アジア）
        if (lat > 12 && lat < 34 && lon > -17 && lon < 60) dry += 0.8;
        if (lat < -18 && lat > -33 && lon > 117 && lon < 145) dry += 0.7;
        if (lat > 36 && lat < 50 && lon > 50 && lon < 115) dry += 0.35;
        if (lat > -5 && lat < 8) dry -= 0.6;
        dry = Math.max(0, Math.min(1, dry));
        let gr = [0.13, 0.22, 0.09], ds = [0.64, 0.50, 0.33];
        if (al > 50) gr = [0.22, 0.25, 0.15];
        R = gr[0] + (ds[0] - gr[0]) * dry; G = gr[1] + (ds[1] - gr[1]) * dry; B = gr[2] + (ds[2] - gr[2]) * dry;
        const k = 0.85 + 0.3 * n2; R *= k; G *= k; B *= k;
        const ice = Math.max(0, Math.min(1, (al - 64 + (n - 0.5) * 10) / 6)) + (lat < -60 ? 1 : 0) + (lat > 60 && lon > -60 && lon < -15 ? 0.9 : 0);
        const ic = Math.min(1, ice);
        R += (0.9 - R) * ic; G += (0.92 - G) * ic; B += (0.95 - B) * ic;
      } else {
        const shallow = Math.max(0, Math.min(1, (m - 0.12) / 0.38));
        const n = noise3(dx * 9, dy * 9, dz * 9);
        R = 0.012 + shallow * 0.03; G = 0.045 + shallow * 0.12 + n * 0.01; B = 0.13 + shallow * 0.12 + n * 0.02;
        if (Math.abs(lat) > 72) { const ic = Math.min(1, (Math.abs(lat) - 72) / 6); R += (0.85 - R) * ic; G += (0.88 - G) * ic; B += (0.92 - B) * ic; }
      }
      img.data[i] = Math.min(255, R * 255); img.data[i + 1] = Math.min(255, G * 255); img.data[i + 2] = Math.min(255, B * 255); img.data[i + 3] = 255;
      if ((x & 1) === 0 && (y & 1) === 0) {
        const j = ((y >> 1) * (W >> 1) + (x >> 1)) * 4;
        const rough = land ? 230 : 95;
        rim.data[j] = rough; rim.data[j + 1] = rough; rim.data[j + 2] = rough; rim.data[j + 3] = 255;
      }
    }
    if (y % 48 === 0) { onp && onp(y / H * 0.7); await yieldUI(); }
  }
  ctx.putImageData(img, 0, 0); rctx.putImageData(rim, 0, 0);
  // 雲
  const CW = 1024, CH = 512; const [cc, cctx] = canvas(CW, CH); const cim = cctx.createImageData(CW, CH);
  for (let y = 0; y < CH; y++) {
    const lat = 90 - (y + 0.5) / CH * 180, la = lat * Math.PI / 180; const cl = Math.cos(la), sl = Math.sin(la);
    const al = Math.abs(lat);
    const belt = 0.42 + 0.22 * Math.exp(-(((al - 55) / 14) ** 2)) + 0.12 * Math.exp(-((lat / 8) ** 2)) - 0.14 * Math.exp(-(((al - 25) / 9) ** 2));
    for (let x = 0; x < CW; x++) {
      const lo = ((x + 0.5) / CW * 360 - 180) * Math.PI / 180;
      let dx = cl * Math.cos(lo), dy = sl, dz = cl * Math.sin(lo);
      const w1 = fbm3(dx * 2 + 1, dy * 2, dz * 2, 3) - 0.5, w2 = fbm3(dx * 2, dy * 2 + 5, dz * 2, 3) - 0.5;
      dx += w1 * 0.6; dz += w2 * 0.6; dy += (w1 - w2) * 0.25;
      const n = fbm3(dx * 7, dy * 10, dz * 7, 6);
      let a = (n - (1 - belt) * 0.62 - 0.24) * 2.6;
      a = Math.max(0, Math.min(1, a));
      const i = (y * CW + x) * 4;
      cim.data[i] = cim.data[i + 1] = cim.data[i + 2] = 255; cim.data[i + 3] = a * 205;
    }
    if (y % 32 === 0) { onp && onp(0.7 + y / CH * 0.3); await yieldUI(); }
  }
  cctx.putImageData(cim, 0, 0);
  return { map: tex(c), rough: tex(rc, false), clouds: tex(cc) };
}
