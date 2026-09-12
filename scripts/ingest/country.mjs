// 坐标 → 国家。纯几何判定，不用模型。
//
// 两个实测坑（见 docs/photo-ingest-design.md §4）：
// 1. countries-10m 里 Maldives 的环绕方向反了，geoContains 判它覆盖几乎全球。
//    255 个国家里仅此一例，拉黑即可。代价是马尔代夫本身从此判不出来——
//    现有 6 国不含它，将来去了走 _inbox/maldives/ 手动通道。
// 2. 78 张真实照片里有 16 张落在陆地多边形之外——海岸取景 + 坐标四舍五入
//    到 1 位小数（约 11km）会把临海点推进海里。故无命中时向外扩圈找最近陆地。
//    用的是陆地国界而非领海/EEZ：语义是「离哪国陆地最近」，对旅行照片更准。
import { geoContains, geoCentroid, geoArea } from 'd3-geo';
import * as topojson from 'topojson-client';
import { readFileSync } from 'node:fs';

const BAD_POLYGONS = ['Maldives'];
const ID_OVERRIDES = { 'United States of America': 'united_states' };
const RINGS = [0.1, 0.25, 0.5, 1.0];
const BEARINGS = 16;

let cached = null;
function features() {
  if (!cached) {
    const topo = JSON.parse(readFileSync('node_modules/world-atlas/countries-10m.json', 'utf8'));
    cached = topojson
      .feature(topo, topo.objects.countries)
      .features.filter((f) => !BAD_POLYGONS.includes(f.properties.name));
  }
  return cached;
}

export const toCountryId = (name) =>
  ID_OVERRIDES[name] ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const at = (lng, lat) => features().find((f) => geoContains(f, [lng, lat]))?.properties.name ?? null;

/**
 * 国家锚点，用作新国家在画廊标题行显示的坐标。
 *
 * 取**面积最大的那一块**的质心，不是整个 feature 的。有海外属地的国家整体
 * 质心会落到海里——实测法国（含圭亚那/留尼汪/马提尼克等）整体质心是
 * 43.0°N 6.7°W，在西班牙北面的大西洋上；只取本土则是 46.6°N 2.5°E。
 * 美国同理：整体 44.8/-103.7（被阿拉斯加和夏威夷拽偏）vs 本土 39.9/-98.8。
 */
export function countryCentroid(name) {
  const f = features().find((x) => x.properties.name === name);
  if (!f) return null;
  const g = f.geometry;
  const polygons = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
  const mainland = polygons
    .map((coordinates) => ({ type: 'Polygon', coordinates }))
    .sort((a, b) => geoArea(b) - geoArea(a))[0];
  const [lng, lat] = geoCentroid(mainland);
  return { lat: Math.round(lat * 10) / 10, lng: Math.round(lng * 10) / 10 };
}

/** @returns {{name: string, id: string, via: string} | null} */
export function lookupCountry(lng, lat) {
  const direct = at(lng, lat);
  if (direct) return { name: direct, id: toCountryId(direct), via: 'direct' };

  for (const r of RINGS) {
    const tally = new Map();
    for (let i = 0; i < BEARINGS; i++) {
      const a = (i / BEARINGS) * 2 * Math.PI;
      // 经度按纬度收缩，保证采样圈在地表近似等距
      const dLng = (r * Math.cos(a)) / Math.cos((lat * Math.PI) / 180);
      const name = at(lng + dLng, lat + r * Math.sin(a));
      if (name) tally.set(name, (tally.get(name) ?? 0) + 1);
    }
    if (tally.size) {
      const [name] = [...tally].sort((a, b) => b[1] - a[1])[0];
      return { name, id: toCountryId(name), via: `ring ${r}°` };
    }
  }
  return null;
}
