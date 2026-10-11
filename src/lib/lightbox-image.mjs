/** Calculate the photo's displayed size with space left for its caption. */
export function lightboxDisplaySize(width, height, viewportWidth, viewportHeight, captionHeight = 0) {
  const ratio = width / height;
  const availableHeight = Math.max(1, Math.min(viewportHeight * 0.82, viewportHeight * 0.92 - captionHeight - 20));
  const displayWidth = Math.min(viewportWidth * 0.92, availableHeight * ratio, width);
  return { width: displayWidth, height: displayWidth / ratio };
}

/** Pick enough pixels for this display, capped by the photo's available variants. */
export function selectLightboxVariant(variants, displayWidth, pixelRatio = 1) {
  const requiredWidth = Math.ceil(displayWidth * Math.max(1, pixelRatio));
  return variants.find((variant) => variant.width >= requiredWidth) ?? variants.at(-1);
}
