// 画像テクスチャの読み込み。大きい画像は、メモリの少ない端末では縮めてから使う。
import * as THREE from 'three';
import { makeSoftDot, makeSmokePuff, makeGlow, makeRetro, makePanelBack } from './textures.js';

const BASE = new URL('../assets/', import.meta.url).href;
const INLINE = globalThis.__HB_INLINE || null;      // ファイルを直接開いたとき（file://）は、埋め込んだ画像を使う
const LIST = {
  mliN: ['mli_n.jpg', { rep: 0.8 }], mliOrm: ['mli_orm.jpg', { rep: 0.8 }],
  cellsC: ['cells_c.jpg', { srgb: 1 }], cellsN: ['cells_n.jpg', {}], cellsOrm: ['cells_orm.jpg', {}],
  cfrpC: ['cfrp_c.jpg', { srgb: 1, rep: 12.5 }], cfrpN: ['cfrp_n.jpg', { rep: 12.5 }],
  metalN: ['metal_n.jpg', { rep: 7 }], metalOrm: ['metal_orm.jpg', { rep: 7 }],
  fabricC: ['fabric_c.jpg', { srgb: 1, rep: 9 }], fabricN: ['fabric_n.jpg', { rep: 9 }],
  gridC: ['grid_c.jpg', { srgb: 1 }], gridE: ['grid_e.jpg', { srgb: 1 }], gridN: ['grid_n.jpg', {}],
  osrC: ['osr_c.jpg', { srgb: 1, rep: 6.25 }], osrN: ['osr_n.jpg', { rep: 6.25 }],
  dishC: ['dish_c.jpg', { srgb: 1, rep: 1 }], charC: ['char_c.jpg', { srgb: 1, rep: 1 }],
  regoC: ['rego_c.jpg', { srgb: 1, rep: 1 }], regoN: ['rego_n.jpg', { rep: 1 }],
  sandC: ['sand_c.jpg', { srgb: 1, rep: 1 }], sandN: ['sand_n.jpg', { rep: 1 }], grassC: ['grass_c.jpg', { srgb: 1, rep: 1 }],
  noise: ['noise.png', { rep: 1 }],
  earthDay: ['earth_day.jpg', { srgb: 1, big: 1 }], earthNight: ['earth_night.jpg', { srgb: 1 }], earthClouds: ['earth_clouds.jpg', {}],
  earthRough: ['earth_rough.png', {}], earthNormal: ['earth_normal.jpg', {}],
  itoMap: ['itokawa_map.jpg', { srgb: 1, big: 1, rep: 1 }], itoN: ['itokawa_normal.jpg', { rep: 1 }],
  milky: ['milkyway.jpg', { srgb: 1 }],
};

export async function loadAssets(renderer, onProgress) {
  const T = {}, keys = Object.keys(LIST);
  const lowMem = (navigator.deviceMemory && navigator.deviceMemory <= 4) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || renderer.capabilities.maxTextureSize < 8192;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  let done = 0;
  await Promise.all(keys.map(k => new Promise((res, rej) => {
    const [file, o] = LIST[k], img = new Image();
    img.onload = () => {
      let src = img;
      if (o.big && lowMem && img.width > 2048) { const c = document.createElement('canvas'); c.width = 2048; c.height = Math.round(img.height * 2048 / img.width); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); src = c; }
      const t = new THREE.Texture(src);
      if (o.srgb) t.colorSpace = THREE.SRGBColorSpace;
      if (o.rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.rep, o.rep); }
      t.anisotropy = aniso; t.needsUpdate = true; T[k] = t;
      onProgress && onProgress(++done / keys.length); res();
    };
    img.onerror = () => rej(new Error('画像を読み込めない: ' + file));
    img.src = (INLINE && INLINE[file]) || BASE + file;
  })));
  T.dot = makeSoftDot(); T.smoke = makeSmokePuff(); T.glow = makeGlow(); T.retro = makeRetro();
  T.lowMem = lowMem; T.pback = makePanelBack(lowMem ? 512 : 1024);
  return T;
}
