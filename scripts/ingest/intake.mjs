// 唯一碰文件系统的模块：列收件箱、读 EXIF、归档原图、派生服务母版。
//
// 两级结构沿用 compress-photos.mjs 当初定下的约定：
//   _originals/photos/<国家>/  全分辨率原图，gitignore，只在本机
//   src/assets/photos/<国家>/  2560px 母版，EXIF 剥光，进 git
import { readdirSync, existsSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import sharp from 'sharp';
import exifr from 'exifr';

const MAX_EDGE = 2560;
const QUALITY = 82;
const IS_JPEG = /\.jpe?g$/i;

/**
 * 列出收件箱里待处理的图。根目录下的图靠 GPS 判国；
 * 以国家 id 命名的子目录（_inbox/china/）里的图强制归到该国。
 * @returns {Array<{path: string, name: string, forcedCountryId: string|null}>}
 */
export function listInbox(root) {
  if (!existsSync(root)) return [];
  const out = [];
  for (const e of readdirSync(root, { withFileTypes: true })) {
    if (e.isDirectory()) {
      for (const f of readdirSync(join(root, e.name))) {
        if (IS_JPEG.test(f)) out.push({ path: join(root, e.name, f), name: f, forcedCountryId: e.name });
      }
    } else if (IS_JPEG.test(e.name)) {
      out.push({ path: join(root, e.name), name: e.name, forcedCountryId: null });
    }
  }
  return out;
}

/** 读 GPS 与拍摄时间。读不到就返回空值，由调用方决定怎么办。 */
export async function readExif(file) {
  const gps = await exifr.gps(file).catch(() => null);
  const meta = await exifr.parse(file, ['DateTimeOriginal']).catch(() => null);
  return {
    lat: gps && Number.isFinite(gps.latitude) ? gps.latitude : null,
    lng: gps && Number.isFinite(gps.longitude) ? gps.longitude : null,
    shotAt: meta?.DateTimeOriginal ?? null,
  };
}

/**
 * 归档原图 + 派生服务母版。
 * @returns {{archivePath: string, servingPath: string}}
 */
export async function archiveAndDerive({ file, countryId, archiveRoot, servingRoot }) {
  const name = basename(file);
  const archivePath = join(archiveRoot, countryId, name);
  const servingPath = join(servingRoot, countryId, name);

  if (existsSync(servingPath)) throw new Error(`${countryId}/${name} 已存在于 ${servingRoot}，拒绝覆盖`);
  if (existsSync(archivePath)) throw new Error(`${countryId}/${name} 已存在于 ${archiveRoot}，拒绝覆盖`);

  mkdirSync(join(archiveRoot, countryId), { recursive: true });
  copyFileSync(file, archivePath);

  const meta = await sharp(file).metadata();
  const pipeline = sharp(file).rotate(); // 先把 EXIF 方向烘焙进像素，再剥元数据
  if (Math.max(meta.width ?? 0, meta.height ?? 0) > MAX_EDGE) {
    pipeline.resize({
      width: meta.width >= meta.height ? MAX_EDGE : null,
      height: meta.height > meta.width ? MAX_EDGE : null,
    });
  }
  const buf = await pipeline.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();

  mkdirSync(join(servingRoot, countryId), { recursive: true });
  writeFileSync(servingPath, buf);

  return { archivePath, servingPath };
}

/** 给模型看的缩略图：1024px JPEG 的 base64 */
export async function previewB64(file) {
  const buf = await sharp(file).resize({ width: 1024 }).jpeg({ quality: 80 }).toBuffer();
  return buf.toString('base64');
}
