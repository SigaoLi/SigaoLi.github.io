// 往 photos.json 的数据结构里插一条照片记录。纯函数：进出都是 JS 对象，
// 不碰文件系统，方便测试。
import { shotTime } from './photo-meta.mjs';

// 与现有 78 条记录保持一致的字段顺序
const FIELD_ORDER = ['src', 'alt', 'altZh', 'lat', 'lng', 'cityZh', 'city'];

const ordered = (entry) => {
  const out = {};
  for (const k of FIELD_ORDER) if (entry[k] !== undefined) out[k] = entry[k];
  return out;
};

/**
 * @param {Array} data                 photos.json 解析后的数组
 * @param {object} opts
 * @param {string} opts.countryId
 * @param {string} opts.countryName
 * @param {string} [opts.countryNameZh] 新国家必填
 * @param {number} [opts.countryLat]    新国家必填
 * @param {number} [opts.countryLng]    新国家必填
 * @param {object} opts.entry
 * @returns {Array} 新数组（不改原数组）
 */
export function registerPhoto(data, opts) {
  const { countryId, countryName, countryNameZh, countryLat, countryLng, entry } = opts;
  const next = data.map((c) => ({ ...c, items: [...c.items] }));

  let country = next.find((c) => c.id === countryId);
  if (!country) {
    country = {
      id: countryId,
      name: countryName,
      nameZh: countryNameZh,
      lat: countryLat,
      lng: countryLng,
      items: [],
    };
    next.push(country);
  }

  if (country.items.some((i) => i.src === entry.src)) {
    throw new Error(`${countryId}/${entry.src} 已存在于 photos.json`);
  }

  const t = shotTime(entry.src, null) ?? Infinity;
  const at = country.items.findIndex((i) => (shotTime(i.src, null) ?? Infinity) > t);
  const row = ordered(entry);
  if (at === -1) country.items.push(row);
  else country.items.splice(at, 0, row);

  return next;
}
