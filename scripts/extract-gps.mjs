// Extracts GPS EXIF from photo originals and merges into photos.json.
// Coordinates are rounded to 1 decimal (~11 km) — enough for a world map,
// coarse enough to avoid publishing precise locations.
import exifr from 'exifr';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const data = JSON.parse(readFileSync('src/data/photos.json', 'utf8'));
let withGps = 0, without = 0;

for (const country of data) {
  for (const item of country.items) {
    const file = join('src/assets/photos', country.id, item.src);
    try {
      const gps = await exifr.gps(file);
      if (gps && Number.isFinite(gps.latitude)) {
        item.lat = Math.round(gps.latitude * 10) / 10;
        item.lng = Math.round(gps.longitude * 10) / 10;
        withGps++;
      } else {
        delete item.lat; delete item.lng;
        without++;
      }
    } catch {
      without++;
    }
  }
}

writeFileSync('src/data/photos.json', JSON.stringify(data, null, 2));
console.log(`GPS found: ${withGps}, missing: ${without}`);
for (const c of data) {
  const n = c.items.filter((i) => i.lat !== undefined).length;
  console.log(`  ${c.id}: ${n}/${c.items.length}`);
}
