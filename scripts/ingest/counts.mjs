// README 里硬编码了照片总数与国家数，需跟着 photos.json 走。
// verify-facts.mjs 的计数已改为从 photos.json 动态计算，不需要同步。
const PATTERN = /(\d+) GPS-extracted photo footprints across (\d+) countries/;

/**
 * @param {string} readme
 * @param {{photos: number, countries: number}} counts
 * @returns {string}
 */
export function syncReadme(readme, { photos, countries }) {
  if (!PATTERN.test(readme)) {
    throw new Error('README.md 里未找到照片计数那句话——句式可能被改过，请同步更新 counts.mjs 的正则');
  }
  return readme.replace(PATTERN, `${photos} GPS-extracted photo footprints across ${countries} countries`);
}
