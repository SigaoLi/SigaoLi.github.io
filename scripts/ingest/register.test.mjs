import test from 'node:test';
import assert from 'node:assert/strict';
import { registerPhoto } from './register.mjs';

const base = () => [
  {
    id: 'china', name: 'China', nameZh: '中国', lat: 35, lng: 104,
    items: [
      { src: 'IMG_20170731_154353.jpg', alt: 'a', altZh: '甲', lat: 30.7, lng: 104, cityZh: '成都', city: 'Chengdu' },
      { src: 'IMG_20190829_094500.jpg', alt: 'b', altZh: '乙', lat: 41, lng: 117.8, cityZh: '承德', city: 'Chengde' },
    ],
  },
];

const entry = (src) => ({
  src, alt: 'new', altZh: '新', lat: 24.4, lng: 118.1, cityZh: '厦门', city: 'Xiamen',
});

test('按拍摄时间插到正确位置，不是追加到末尾', () => {
  const out = registerPhoto(base(), { countryId: 'china', countryName: 'China', entry: entry('IMG_20180101_120000.jpg') });
  assert.deepEqual(out[0].items.map((i) => i.src), [
    'IMG_20170731_154353.jpg', 'IMG_20180101_120000.jpg', 'IMG_20190829_094500.jpg',
  ]);
});

test('字段顺序与现有条目一致', () => {
  const out = registerPhoto(base(), { countryId: 'china', countryName: 'China', entry: entry('IMG20260905155409.jpg') });
  const added = out[0].items.at(-1);
  assert.deepEqual(Object.keys(added), ['src', 'alt', 'altZh', 'lat', 'lng', 'cityZh', 'city']);
});

test('没有坐标时不写 lat/lng 字段', () => {
  const e = entry('IMG20260905155409.jpg');
  delete e.lat; delete e.lng;
  const out = registerPhoto(base(), { countryId: 'china', countryName: 'China', entry: e });
  const added = out[0].items.at(-1);
  assert.deepEqual(Object.keys(added), ['src', 'alt', 'altZh', 'cityZh', 'city']);
});

test('新国家追加到末尾并带上中文名与锚点', () => {
  const out = registerPhoto(base(), {
    countryId: 'france', countryName: 'France', countryNameZh: '法国',
    countryLat: 46.6, countryLng: 2.3, entry: entry('IMG20260701120000.jpg'),
  });
  assert.equal(out.length, 2);
  assert.deepEqual(
    { id: out[1].id, name: out[1].name, nameZh: out[1].nameZh, lat: out[1].lat, lng: out[1].lng },
    { id: 'france', name: 'France', nameZh: '法国', lat: 46.6, lng: 2.3 },
  );
  assert.equal(out[1].items.length, 1);
});

test('同名文件重复登记会抛错', () => {
  assert.throws(
    () => registerPhoto(base(), { countryId: 'china', countryName: 'China', entry: entry('IMG_20170731_154353.jpg') }),
    /已存在/,
  );
});

test('不修改传入的数组', () => {
  const input = base();
  registerPhoto(input, { countryId: 'china', countryName: 'China', entry: entry('IMG20260905155409.jpg') });
  assert.equal(input[0].items.length, 2);
});
