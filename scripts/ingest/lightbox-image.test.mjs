import test from 'node:test';
import assert from 'node:assert/strict';
import { lightboxDisplaySize, selectLightboxVariant } from '../../src/lib/lightbox-image.mjs';
const variants = [640, 1080, 1600, 2048, 2560, 3200, 3264].map(width => ({ width, src: String(width) }));
test('手机高分屏选小图，桌面高分屏选足够清晰的大图', () => {
  const mobile = lightboxDisplaySize(3264, 1480, 390, 844, 60);
  assert.equal(selectLightboxVariant(variants, mobile.width, 3).width, 1080);
  const desktop = lightboxDisplaySize(3264, 1480, 1440, 900, 60);
  assert.equal(selectLightboxVariant(variants, desktop.width, 2).width, 3200);
});
test('需求超过原图时使用可用最大尺寸，竖图由高度约束', () => {
  const large = lightboxDisplaySize(3264, 1480, 1920, 1080, 60);
  assert.equal(selectLightboxVariant(variants, large.width, 2).width, 3264);
  const portrait = lightboxDisplaySize(2000, 4000, 1440, 900, 60);
  assert.equal(portrait.height, 738);
  assert.equal(portrait.width, 369);
});
test('长说明缩小图片以保留说明空间，小原图不被放大显示', () => {
  const photo = lightboxDisplaySize(1000, 2000, 390, 600, 200);
  assert.equal(photo.height, 332);
  const small = lightboxDisplaySize(200, 100, 1440, 900, 60);
  assert.equal(small.width, 200);
});
