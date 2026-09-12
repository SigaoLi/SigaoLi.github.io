// 拍摄时间解析 —— photos.json 的条目按拍摄时间排列，不能按文件名字典序：
// 历史上两种命名并存（IMG_20170731_154353 / IMG20260905155409），而 ASCII 里
// '_'(95) 大于数字(48-57)，字典序会把 2017 年的排到 2026 年之后。

const FROM_NAME = /(20\d{2})_?(\d{2})_?(\d{2})/;

/**
 * @param {string} filename
 * @param {Date|string|null} exifDate  EXIF DateTimeOriginal
 * @returns {number|null} 毫秒时间戳
 */
export function shotTime(filename, exifDate) {
  if (exifDate) {
    const t = new Date(exifDate).getTime();
    if (Number.isFinite(t)) return t;
  }
  const m = filename.match(FROM_NAME);
  if (!m) return null;
  const [, y, mo, d] = m;
  return Date.UTC(Number(y), Number(mo) - 1, Number(d));
}
