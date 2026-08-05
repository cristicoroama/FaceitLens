/**
 * Bakes the world map into a plain JS module of SVG paths.
 *
 *   node scripts/gen-world-map.mjs
 *
 * Source is Natural Earth (public domain) via world-atlas. Projecting at build
 * time means the app ships path strings and no mapping library at runtime —
 * same trade as the flag SVGs in public/flags.
 *
 * Re-run only when the source data or the projection changes; the output is
 * committed.
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const world = require("world-atlas/countries-110m.json");
const detailed = require("world-atlas/countries-50m.json");
const iso = require("i18n-iso-countries");

// Nothing to colour in and it eats a fifth of the frame.
const ANTARCTICA = "010";
const SIZE = [1000, 520];
const OUT = new URL("../src/world-map-data.js", import.meta.url);
// Names live apart from the shapes: the leaderboard wants them too, and it has
// no business pulling 119 KB of coastline to label a dropdown.
const OUT_NAMES = new URL("../src/country-names.js", import.meta.url);

const all = feature(world, world.objects.countries).features;
const shapes = all.filter((f) => f.id !== ANTARCTICA);
const collection = { type: "FeatureCollection", features: shapes };

const projection = geoNaturalEarth1().fitSize(SIZE, collection);
// 1 decimal at this scale is a tenth of a pixel — invisible, and it roughly
// halves the file.
const path = geoPath(projection).digits(1);

const countries = [];
for (const f of shapes) {
  const d = path(f);
  if (!d) continue;
  // Disputed or unrecognised territories come through with id "-99" and no ISO
  // code. They stay on the map as plain land — dropping them would punch
  // holes in it — but they can't be coloured or hovered.
  const code = iso.isValid(f.id) ? iso.numericToAlpha2(f.id).toLowerCase() : null;
  countries.push({ code, name: f.properties?.name || "", d });
}
countries.sort((a, b) => (a.code || "zz").localeCompare(b.code || "zz"));

// 1:110m has no polygon for a country smaller than a few pixels, so Singapore,
// Malta, Luxembourg and ~60 others simply wouldn't exist on the map. Stepping
// up to 1:50m fixes that at the cost of 1 MB of path data — nine times the
// whole file — and they'd still render as unclickable specks. Instead take
// just their centroids from 1:50m and mark them with a dot.
const have = new Set(countries.map((c) => c.code).filter(Boolean));
const dots = [];
for (const f of feature(detailed, detailed.objects.countries).features) {
  if (!iso.isValid(f.id)) continue;
  const code = iso.numericToAlpha2(f.id).toLowerCase();
  if (have.has(code)) continue;
  const [x, y] = path.centroid(f);
  if (!Number.isFinite(x)) continue;
  dots.push({ code, name: f.properties?.name || "", x: round(x), y: round(y) });
  have.add(code);
}
dots.sort((a, b) => a.code.localeCompare(b.code));

const [[x0, y0], [x1, y1]] = path.bounds(collection);
const viewBox = [x0, y0, x1 - x0, y1 - y0].map(round).join(" ");

function round(n) {
  return Math.round(n * 10) / 10;
}

/* At world zoom the countries with the strongest scenes are the ones you can't
   see — Denmark and the Netherlands are a few pixels across while empty desert
   takes a third of the frame. These are the lon/lat windows worth jumping to.
   "Europe" runs east to 62° so it keeps western Russia, which FACEIT counts in
   the EU ladder.

   Each window is kept roughly as wide as the world frame already is, because a
   tall one has to be padded so far sideways to match that it drags whole
   neighbouring continents into shot — Asia and Oceania as one view pulled in
   Africa. Longitudes stay inside ±180 for the same reason: 182° wraps around
   the antimeridian and projects to the far left of the map, which stretched
   Oceania across the entire world.

   The windows line up with FACEIT's own regions, since clicking a country
   opens that region's ladder. */
const WINDOWS = [
  ["world", "World", null],
  ["europe", "Europe", [-13, 34, 62, 71]],
  ["na", "N. America", [-168, 7, -52, 72]],
  ["sa", "S. America", [-82, -56, -33, 13]],
  ["asia", "Asia", [60, 3, 152, 56]],
  ["oceania", "Oceania", [110, -48, 180, -6]],
];

// A lon/lat rectangle doesn't project to a rectangle, so sample along its edges
// and take the bounds of the result rather than just the four corners.
function windowBox([w, s, e, n]) {
  const ring = [];
  const STEPS = 24;
  for (let i = 0; i <= STEPS; i++) ring.push([w + ((e - w) * i) / STEPS, n]);
  for (let i = 0; i <= STEPS; i++) ring.push([e, n + ((s - n) * i) / STEPS]);
  for (let i = 0; i <= STEPS; i++) ring.push([e + ((w - e) * i) / STEPS, s]);
  for (let i = 0; i <= STEPS; i++) ring.push([w, s + ((n - s) * i) / STEPS]);
  const [[a, b], [c, d]] = path.bounds({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [ring] },
  });

  // Every window is padded out to the world map's aspect ratio, so switching
  // views pans and zooms inside a frame that never changes height. Letting
  // each keep its natural shape made the panel jump by hundreds of pixels.
  let [w2, h2] = [c - a, d - b];
  const aspect = (x1 - x0) / (y1 - y0);
  if (w2 / h2 < aspect) w2 = h2 * aspect;
  else h2 = w2 / aspect;
  return [a - (w2 - (c - a)) / 2, b - (h2 - (d - b)) / 2, w2, h2]
    .map(round)
    .join(" ");
}

const views = WINDOWS.map(([key, label, box]) => ({
  key, label, viewBox: box ? windowBox(box) : viewBox,
}));

const body = `// GENERATED by scripts/gen-world-map.mjs — do not edit by hand.
// Natural Earth 1:110m (public domain), Natural Earth I projection.
export const WORLD_VIEWBOX = ${JSON.stringify(viewBox)};

// Preset zoom windows; the first is the whole map.
export const WORLD_VIEWS = ${JSON.stringify(views)};

export const COUNTRY_SHAPES = ${JSON.stringify(countries)};

// Countries too small to have a polygon at this resolution.
export const COUNTRY_DOTS = ${JSON.stringify(dots)};
`;

writeFileSync(OUT, body);

// Natural Earth's names are cartographic ("United States of America"); ISO's
// short names read better in a tooltip and a dropdown.
// ...though a few of ISO's short names are still the legal form. These are the
// ones nobody would recognise on a leaderboard.
const RENAME = {
  kr: "South Korea", kp: "North Korea", md: "Moldova", sy: "Syria",
  la: "Laos", va: "Vatican City", fm: "Micronesia", fk: "Falkland Islands",
  vg: "British Virgin Islands", vi: "U.S. Virgin Islands",
  mf: "Saint Martin", sx: "Sint Maarten", io: "British Indian Ocean Terr.",
};
iso.registerLocale(require("i18n-iso-countries/langs/en.json"));
const names = {};
for (const code of [...have].sort()) {
  const name = RENAME[code] || iso.getName(code.toUpperCase(), "en", { select: "alias" });
  if (name) names[code] = name;
}
writeFileSync(
  OUT_NAMES,
  `// GENERATED by scripts/gen-world-map.mjs — do not edit by hand.\n` +
  `export const COUNTRY_NAMES = ${JSON.stringify(names, null, 0)};\n`
);

const withCode = countries.filter((c) => c.code).length;
console.log(
  `${countries.length} shapes (${withCode} with an ISO code) + ${dots.length} dots, ` +
  `${have.size} countries reachable, viewBox "${viewBox}", ` +
  `${(body.length / 1024).toFixed(0)} KB`
);
