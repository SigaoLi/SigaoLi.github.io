import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lookupCountry, toCountryId, countryCentroid } from './country.mjs';

test('内陆点直接命中', () => {
  const r = lookupCountry(116.379, 39.894); // 北京琉璃厂
  assert.equal(r.name, 'China');
  assert.equal(r.id, 'china');
  assert.equal(r.via, 'direct');
});

test('海岸点靠扩圈兜底', () => {
  const r = lookupCountry(118.1, 24.4); // 厦门海滨，四舍五入后落在海里
  assert.equal(r.name, 'China');
  assert.equal(r.via, 'ring 0.1°');
});

test('Maldives 坏多边形不会污染结果', () => {
  // 该多边形环绕方向反了，geoContains 判它覆盖几乎全球
  for (const [lng, lat] of [[116.4, 39.9], [-79.4, 43.6], [135.8, 35.0]]) {
    assert.notEqual(lookupCountry(lng, lat).name, 'Maldives');
  }
});

test('美国国名映射到现有 id', () => {
  assert.equal(toCountryId('United States of America'), 'united_states');
  assert.equal(toCountryId('United Kingdom'), 'united_kingdom');
  assert.equal(toCountryId('China'), 'china');
});

test('国家质心可用作新国家锚点', () => {
  const c = countryCentroid('France');
  assert.ok(c && c.lat > 40 && c.lat < 52, `法国质心纬度应在 40-52 之间，得到 ${c?.lat}`);
  assert.equal(countryCentroid('不存在的国'), null);
});

test('现有 78 条坐标全部归到正确国家', () => {
  const WANT = {
    china: 'China', japan: 'Japan', canada: 'Canada',
    united_states: 'United States of America',
    united_kingdom: 'United Kingdom', bahamas: 'Bahamas',
  };
  const photos = JSON.parse(readFileSync('src/data/photos.json', 'utf8'));
  const wrong = [];
  for (const c of photos) {
    for (const it of c.items) {
      if (typeof it.lat !== 'number') continue;
      const r = lookupCountry(it.lng, it.lat);
      if (r?.name !== WANT[c.id]) wrong.push(`${c.id}/${it.src} -> ${r?.name}`);
    }
  }
  assert.deepEqual(wrong, []);
});
