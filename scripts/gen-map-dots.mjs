// One-off generator: samples a lat/lng grid against Natural Earth land polygons
// (world-atlas, public domain) and writes dot positions for the dotted world map.
// Projection: equirectangular, viewBox 720×300 (85°N … 65°S), x=(lng+180)*2, y=(85-lat)*2.
import { geoContains } from 'd3-geo';
import * as topojson from 'topojson-client';
import { readFileSync, writeFileSync } from 'node:fs';

const topo = JSON.parse(readFileSync('node_modules/world-atlas/land-110m.json', 'utf8'));
const land = topojson.feature(topo, topo.objects.land);

const STEP = 2.4;
const dots = [];
for (let lat = 85; lat >= -65; lat -= STEP) {
  for (let lng = -180; lng <= 180; lng += STEP) {
    if (geoContains(land, [lng, lat])) {
      dots.push([
        Math.round((lng + 180) * 2 * 10) / 10,
        Math.round((85 - lat) * 2 * 10) / 10,
      ]);
    }
  }
}

writeFileSync('src/data/map-dots.json', JSON.stringify(dots));
console.log(`${dots.length} land dots written to src/data/map-dots.json`);
