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

test('国家锚点落在本土上，不被海外属地拽偏', () => {
  // 整个 feature 的质心会落海：法国含圭亚那/留尼汪等，整体质心是 43.0N 6.7W
  // （西班牙北面的大西洋）；美国被阿拉斯加和夏威夷拽到 44.8N 103.7W。
  // 所以锚点必须取面积最大的那一块。
  const fr = countryCentroid('France');
  assert.deepEqual(fr, { lat: 46.6, lng: 2.5 }, `法国锚点应在本土，得到 ${JSON.stringify(fr)}`);

  const us = countryCentroid('United States of America');
  assert.deepEqual(us, { lat: 39.9, lng: -98.8 }, `美国锚点应在本土，得到 ${JSON.stringify(us)}`);

  // 每个锚点都必须真的落在该国境内
  for (const name of ['France', 'United States of America', 'Japan', 'China']) {
    const c = countryCentroid(name);
    assert.equal(lookupCountry(c.lng, c.lat)?.name, name, `${name} 的锚点没落在自己国土上`);
  }

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
