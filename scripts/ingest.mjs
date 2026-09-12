#!/usr/bin/env node
// 照片入站编排器。由 .githooks/pre-commit 调用。
//
// 收件箱为空时立即退出，所以日常提交零开销。
// 任何一张图失败都以非零码退出 → commit 被阻断 → 仓库不会留下半成品。
// 每张图走完全部步骤才从收件箱删除，中途失败重跑不会重做已完成的。
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { lookupCountry, countryCentroid } from './ingest/country.mjs';
import { listInbox, readExif, archiveAndDerive, previewB64 } from './ingest/intake.mjs';
import { writeCaption, translateCountryName } from './ingest/caption.mjs';
import { registerPhoto } from './ingest/register.mjs';
import { syncReadme } from './ingest/counts.mjs';
import { shotTime } from './ingest/photo-meta.mjs';

const INBOX = '_inbox';
const ARCHIVE = '_originals/photos';
const SERVING = 'src/assets/photos';
const PHOTOS_JSON = 'src/data/photos.json';
const README = 'README.md';

const pending = listInbox(INBOX);
if (pending.length === 0) process.exit(0);

console.log(`[照片入站] 收件箱有 ${pending.length} 张待处理`);

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => l.split(/=(.*)/s).slice(0, 2).map((s) => s.trim()))
);
if (!env.TRANSLATE_API_BASE || !env.TRANSLATE_API_KEY) {
  console.error('[照片入站] .env 里缺少 TRANSLATE_API_BASE / TRANSLATE_API_KEY');
  process.exit(1);
}
const api = { fetch, base: env.TRANSLATE_API_BASE, key: env.TRANSLATE_API_KEY };

let data = JSON.parse(readFileSync(PHOTOS_JSON, 'utf8'));
const touched = [];

for (const item of pending) {
  console.log(`  · ${item.name}`);
  const { lat, lng, shotAt } = await readExif(item.path);

  let country;
  if (item.forcedCountryId) {
    const known = data.find((c) => c.id === item.forcedCountryId);
    if (!known) {
      console.error(`    收件箱子目录 "${item.forcedCountryId}" 不是已知国家 id；新国家请让 GPS 自动判定`);
      process.exit(1);
    }
    country = { id: known.id, name: known.name, via: 'inbox 子目录' };
  } else {
    if (lat == null) {
      console.error(`    没有 GPS，无法判定国家。把它放进 _inbox/<国家id>/ 手动指定，例如 _inbox/china/`);
      process.exit(1);
    }
    country = lookupCountry(lng, lat);
    if (!country) {
      console.error(`    坐标 ${lat},${lng} 落不到任何国家上`);
      process.exit(1);
    }
  }
  console.log(`    国家：${country.name} (${country.via})`);

  const { servingPath } = await archiveAndDerive({
    file: item.path, countryId: country.id, archiveRoot: ARCHIVE, servingRoot: SERVING,
  });

  const existing = data.find((c) => c.id === country.id);
  const samples = (existing?.items ?? data.flatMap((c) => c.items))
    .slice(-5)
    .map((i) => ({ alt: i.alt, altZh: i.altZh }))
    .filter((s) => s.alt && s.altZh);

  const caption = await writeCaption(
    {
      imageB64: await previewB64(item.path),
      lat: lat == null ? null : Math.round(lat * 10) / 10,
      lng: lng == null ? null : Math.round(lng * 10) / 10,
      shotAt: shotAt
        ? new Date(shotAt).toISOString().slice(0, 10)
        : new Date(shotTime(item.name, null) ?? Date.now()).toISOString().slice(0, 10),
      samples,
    },
    api
  );
  console.log(`    文案：${caption.altZh}`);

  const entry = { src: item.name, alt: caption.alt, altZh: caption.altZh, cityZh: caption.cityZh, city: caption.city };
  // 坐标四舍五入到 1 位小数（约 11km）——够画地图，又不公开精确位置
  if (lat != null) { entry.lat = Math.round(lat * 10) / 10; entry.lng = Math.round(lng * 10) / 10; }

  // 没去过的国家：中文名找模型翻一次，锚点用国家多边形质心（与现有条目同口径，
  // 不能用首张照片的坐标——那会让画廊标题行显示成某个城市而不是国家中心）
  let newCountry = {};
  if (!existing) {
    const zh = await translateCountryName(country.name, api);
    const centroid = countryCentroid(country.name) ?? { lat: entry.lat, lng: entry.lng };
    newCountry = { countryNameZh: zh, countryLat: centroid.lat, countryLng: centroid.lng };
    console.log(`    新国家：${country.name} / ${zh}，锚点 ${centroid.lat}, ${centroid.lng}`);
  }

  data = registerPhoto(data, {
    countryId: country.id,
    countryName: country.name,
    ...newCountry,
    entry,
  });

  unlinkSync(item.path);
  touched.push(servingPath);
}

writeFileSync(PHOTOS_JSON, JSON.stringify(data, null, 2) + '\n');

const total = data.reduce((n, c) => n + c.items.length, 0);
writeFileSync(README, syncReadme(readFileSync(README, 'utf8'), { photos: total, countries: data.length }));

execFileSync('git', ['add', PHOTOS_JSON, README, ...touched], { stdio: 'inherit' });
console.log(`[照片入站] 完成 ${pending.length} 张，现共 ${total} 张 / ${data.length} 国`);
