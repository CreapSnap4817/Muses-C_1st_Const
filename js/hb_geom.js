// 機体ジオメトリの組み立て。Node（AOの事前計算）とブラウザの両方から呼ぶ。
import { Kit } from './hb_core.js';
import { buildExterior } from './hb_ext.js';
import { buildInterior } from './hb_int.js';

export function buildHayabusaGeom() {
  const K = new Kit();
  buildExterior(K);
  buildInterior(K);
  return { groups: K.finalize(), meta: K.meta };
}
