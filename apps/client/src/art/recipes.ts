/**
 * Recipes for every texture the game paints for itself (see decision 0053).
 *
 * Each one is a painting done in code, in the soft, hand-painted look of the
 * Quaternius trees already in the clearing: a cloudy base of colour, then
 * brush strokes and dabs over it - grass blades, wood grain, pebbles, moss.
 * All tile seamlessly, apart from the log end, which is one round picture.
 *
 * Seeded, so every browser paints exactly the same thing on every load. No
 * DOM and no Three.js, so each can be painted and checked in a test.
 */

import { seededRandom, smoothstep, tileableCells, tileableFbm, tileableNoise } from './noise';
import { Raster, hex, mixRgb, scaleRgb, type Rgb } from './raster';

/** Pick one of a few colours, at random. */
function pick(random: () => number, colours: readonly Rgb[]): Rgb {
  return colours[Math.floor(random() * colours.length)] ?? colours[0] ?? [0, 0, 0];
}

/** A colour nudged a little lighter or darker, at random, so no two strokes match. */
function jitter(random: () => number, colour: Rgb, amount: number): Rgb {
  return scaleRgb(colour, 1 + (random() * 2 - 1) * amount);
}

/**
 * Lawn grass seen from above: soft patches of deep and fresh green, a warm
 * sun-dried tint here and there, thousands of short painted blades in tufts,
 * and a scattering of tiny white, yellow and lilac flowers.
 */
export function paintGrass(size = 512): Raster {
  const raster = new Raster(size);
  const deep = hex(0x4c7430);
  const fresh = hex(0x6c9a3f);
  const warm = hex(0x9aa84a);
  raster.fill((u, v, out) => {
    const patches = tileableFbm(u * 4, v * 4, 4, 4, 11) * 0.5 + 0.5;
    const sunny = smoothstep(0.1, 0.7, tileableFbm(u * 3, v * 3, 3, 3, 12) * 0.5 + 0.5);
    let colour = mixRgb(deep, fresh, smoothstep(0.25, 0.75, patches));
    colour = mixRgb(colour, warm, sunny * 0.28);
    // Fine speckle, like the soil showing between blades.
    colour = scaleRgb(colour, 0.92 + tileableNoise(u * 64, v * 64, 64, 13) * 0.08);
    out[0] = colour[0];
    out[1] = colour[1];
    out[2] = colour[2];
  });

  const random = seededRandom(1001);
  const bases = [hex(0x3f6528), hex(0x46702c), hex(0x527d33)];
  const tips = [hex(0x86b04f), hex(0x93bb58), hex(0xa4c663), hex(0x7aa546)];
  const scale = size / 512;
  const tufts = Math.round(1100 * scale * scale);
  for (let tuft = 0; tuft < tufts; tuft++) {
    const cx = random() * size;
    const cy = random() * size;
    // Most tufts lean the same general way, as if brushed by one hand.
    const lean = -Math.PI / 2 + (random() - 0.5) * 1.3;
    const blades = 3 + Math.floor(random() * 5);
    for (let blade = 0; blade < blades; blade++) {
      const angle = lean + (random() - 0.5) * 1.1;
      const length = (7 + random() * 11) * scale;
      const tipX = cx + Math.cos(angle) * length;
      const tipY = cy + Math.sin(angle) * length;
      const curl = (random() - 0.5) * length * 0.5;
      const bend: [number, number] = [
        (cx + tipX) / 2 + Math.cos(angle + Math.PI / 2) * curl,
        (cy + tipY) / 2 + Math.sin(angle + Math.PI / 2) * curl,
      ];
      // Dark at the root, where the tuft shades itself, light at the tip.
      raster.stroke(
        [cx, cy],
        bend,
        [(cx + tipX) / 2, (cy + tipY) / 2],
        2.6 * scale,
        2 * scale,
        jitter(random, pick(random, bases), 0.08),
        0.55,
      );
      raster.stroke(
        [(cx + tipX) / 2, (cy + tipY) / 2],
        [(bend[0] + tipX) / 2, (bend[1] + tipY) / 2],
        [tipX, tipY],
        2 * scale,
        0.8 * scale,
        jitter(random, pick(random, tips), 0.1),
        0.75,
      );
    }
  }

  // Tiny flowers, few and far between - a lawn, not a meadow.
  const petals = [hex(0xf6f1e2), hex(0xf2d24b), hex(0xcdb0e6), hex(0xf6f1e2)];
  for (let flower = 0; flower < Math.round(46 * scale * scale); flower++) {
    const x = random() * size;
    const y = random() * size;
    const colour = pick(random, petals);
    const radius = (1.6 + random() * 1.1) * scale;
    for (let petal = 0; petal < 5; petal++) {
      const angle = (petal / 5) * Math.PI * 2 + random() * 0.4;
      raster.dab(
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
        radius,
        colour,
        0.9,
        0.7,
      );
    }
    raster.dab(x, y, radius * 0.7, hex(0xe0a92c), 0.95, 0.8);
  }
  return raster;
}

/**
 * Forest floor: warm brown earth, darker in the hollows, strewn with pebbles,
 * fallen leaves in autumn colours, pine needles and the odd twig.
 */
export function paintForestFloor(size = 512): Raster {
  const raster = new Raster(size);
  const dark = hex(0x5a4330);
  const light = hex(0x88683f);
  const moss = hex(0x6b7436);
  raster.fill((u, v, out) => {
    const soil = tileableFbm(u * 5, v * 5, 5, 4, 21) * 0.5 + 0.5;
    const hollows = tileableFbm(u * 9, v * 9, 9, 3, 22) * 0.5 + 0.5;
    const mossy = smoothstep(0.6, 0.85, tileableFbm(u * 3, v * 3, 3, 4, 24) * 0.5 + 0.5);
    let colour = mixRgb(dark, light, smoothstep(0.2, 0.8, soil));
    colour = scaleRgb(colour, 0.86 + smoothstep(0.3, 0.7, hollows) * 0.14);
    colour = mixRgb(colour, moss, mossy * 0.55);
    colour = scaleRgb(colour, 0.94 + tileableNoise(u * 96, v * 96, 96, 23) * 0.06);
    out[0] = colour[0];
    out[1] = colour[1];
    out[2] = colour[2];
  });

  const random = seededRandom(2002);
  const scale = size / 512;
  const count = (base: number): number => Math.round(base * scale * scale);

  for (let i = 0; i < count(260); i++) {
    const x = random() * size;
    const y = random() * size;
    const angle = random() * Math.PI;
    const length = (5 + random() * 7) * scale;
    raster.stroke(
      [x, y],
      [x + Math.cos(angle) * length * 0.5, y + Math.sin(angle) * length * 0.5 + 0.6],
      [x + Math.cos(angle) * length, y + Math.sin(angle) * length],
      1.1 * scale,
      0.6 * scale,
      jitter(random, hex(0x9a7d45), 0.12),
      0.6,
    );
  }

  const leafColours = [hex(0xa2652b), hex(0xbb8a3d), hex(0x86542a), hex(0x7d7d3a), hex(0xc0703a)];
  for (let i = 0; i < count(230); i++) {
    const x = random() * size;
    const y = random() * size;
    const angle = random() * Math.PI * 2;
    const length = (10 + random() * 10) * scale;
    const colour = jitter(random, pick(random, leafColours), 0.1);
    // A leaf is a short fat stroke with a soft shadow under it.
    raster.dab(x + 1.5 * scale, y + 1.5 * scale, length * 0.45, hex(0x3d2c1e), 0.25, 0.2);
    raster.stroke(
      [x, y],
      [x + Math.cos(angle) * length * 0.5, y + Math.sin(angle) * length * 0.5],
      [x + Math.cos(angle) * length, y + Math.sin(angle) * length],
      length * 0.5,
      length * 0.15,
      colour,
      0.85,
      0.75,
    );
  }

  for (let i = 0; i < count(90); i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = (1.5 + random() * 2.2) * scale;
    const stone = jitter(random, pick(random, [hex(0x9a9084), hex(0x8a8173), hex(0xa89f90)]), 0.08);
    raster.dab(x + radius * 0.35, y + radius * 0.35, radius, hex(0x3a2d22), 0.35, 0.3);
    raster.dab(x, y, radius, stone, 0.95, 0.75);
    raster.dab(x - radius * 0.3, y - radius * 0.3, radius * 0.45, scaleRgb(stone, 1.18), 0.6, 0.4);
  }

  for (let i = 0; i < count(26); i++) {
    const x = random() * size;
    const y = random() * size;
    const angle = random() * Math.PI;
    const length = (18 + random() * 22) * scale;
    raster.stroke(
      [x, y],
      [x + Math.cos(angle) * length * 0.5 + 2, y + Math.sin(angle) * length * 0.5],
      [x + Math.cos(angle) * length, y + Math.sin(angle) * length],
      2.2 * scale,
      1.2 * scale,
      jitter(random, hex(0x5a4128), 0.1),
      0.9,
      0.8,
    );
  }
  return raster;
}

/**
 * Bark, with its grain running down the texture (along V): deep crevices
 * between lighter, rounded ridges. For sticks, stumps and the sides of logs.
 */
export function paintBark(size = 256): Raster {
  const raster = new Raster(size);
  const base = hex(0x6a4a31);
  const ridge = hex(0x8a6646);
  const crevice = hex(0x3b291b);
  raster.fill((u, v, out) => {
    const grain = tileableFbm(u * 10, v * 2, 10, 4, 31, 2) * 0.5 + 0.5;
    const ridges = Math.sin((u * 10 + tileableFbm(u * 4, v * 4, 4, 3, 32) * 0.8) * Math.PI * 2);
    let colour = mixRgb(base, ridge, smoothstep(0.2, 0.9, grain) * 0.7);
    colour = mixRgb(colour, crevice, smoothstep(0.55, 1, -ridges) * 0.75);
    out[0] = colour[0];
    out[1] = colour[1];
    out[2] = colour[2];
  });
  const random = seededRandom(3003);
  const scale = size / 256;
  for (let i = 0; i < Math.round(140 * scale); i++) {
    const x = random() * size;
    const y = random() * size;
    const length = (20 + random() * 40) * scale;
    const sway = (random() - 0.5) * 6 * scale;
    raster.stroke(
      [x, y],
      [x + sway, y + length / 2],
      [x - sway * 0.3, y + length],
      (1.4 + random() * 1.6) * scale,
      0.6 * scale,
      random() < 0.6 ? jitter(random, crevice, 0.15) : jitter(random, scaleRgb(ridge, 1.1), 0.1),
      0.5,
    );
  }
  return raster;
}

/**
 * Planed timber with its grain running down the texture (along V): honey
 * coloured, flowing grain lines, a couple of knots, and a little silvering
 * from the weather. For rails, planks, boards and cabin logs.
 */
export function paintWood(size = 512): Raster {
  const raster = new Raster(size);
  const light = hex(0xb07f4b);
  const mid = hex(0x98683b);
  const grainDark = hex(0x6f4a28);
  const weathered = hex(0x9a8d7c);
  const knots: { x: number; y: number; r: number }[] = [];
  const knotRandom = seededRandom(4004);
  for (let i = 0; i < 3; i++) {
    knots.push({ x: knotRandom(), y: knotRandom(), r: 0.018 + knotRandom() * 0.02 });
  }
  raster.fill((u, v, out) => {
    // Grain lines bend around each knot.
    let warp = tileableFbm(u * 3, v * 1, 3, 3, 41, 1) * 0.35;
    let knotShade = 0;
    for (const knot of knots) {
      const dx = wrapDelta(u - knot.x);
      const dy = wrapDelta(v - knot.y) * 0.45;
      const distance = Math.hypot(dx, dy);
      warp += ((knot.r * 2.5) / (distance + knot.r)) * Math.sign(dx) * 0.05;
      knotShade = Math.max(knotShade, 1 - smoothstep(knot.r * 0.4, knot.r, distance));
    }
    const lines = Math.sin((u * 26 + warp * 6) * Math.PI * 2) * 0.5 + 0.5;
    const fine = Math.sin((u * 90 + warp * 12) * Math.PI * 2) * 0.5 + 0.5;
    const tone = tileableFbm(u * 2, v * 6, 2, 3, 42, 6) * 0.5 + 0.5;
    let colour = mixRgb(mid, light, smoothstep(0.25, 0.75, tone));
    colour = mixRgb(colour, grainDark, Math.pow(lines, 5) * 0.5 + Math.pow(fine, 8) * 0.18);
    colour = mixRgb(
      colour,
      weathered,
      smoothstep(0.55, 0.9, tileableFbm(u * 2, v * 2, 2, 3, 43) * 0.5 + 0.5) * 0.3,
    );
    colour = mixRgb(colour, hex(0x4a301a), knotShade * 0.85);
    out[0] = colour[0];
    out[1] = colour[1];
    out[2] = colour[2];
  });
  return raster;
}

/**
 * The cut end of a log, as one round picture rather than a tile: growth
 * rings around a dark heart, a crack or two, and a rim of bark. Outside the
 * rim it is bark coloured, so a many-sided end cap never shows a gap.
 */
export function paintLogEnd(size = 256): Raster {
  const raster = new Raster(size);
  const random = seededRandom(5005);
  // Checks run in from the rim, where the wood dried and shrank fastest.
  const checks = [0, 1, 2].map(() => ({
    angle: random() * Math.PI * 2,
    depth: 0.35 + random() * 0.3,
  }));
  const light = hex(0xd6a86c);
  const dark = hex(0xac7847);
  const bark = hex(0x5a3e28);
  raster.fill((u, v, out) => {
    const dx = u - 0.5;
    const dy = v - 0.5;
    const r = Math.hypot(dx, dy) * 2;
    const angle = Math.atan2(dy, dx);
    const wobble = tileableNoise(Math.cos(angle) * 2 + 8, Math.sin(angle) * 2 + 8, 64, 51) * 0.012;
    // Rings grow closer together towards the bark, as they do in a real log.
    const ringCoordinate = Math.sqrt(r + wobble) * 16;
    const rings = Math.sin(ringCoordinate * Math.PI * 2) * 0.5 + 0.5;
    let colour = mixRgb(light, dark, Math.pow(rings, 4) * 0.65 + r * 0.2);
    colour = scaleRgb(colour, 0.95 + tileableNoise(u * 48, v * 48, 48, 52) * 0.05);
    colour = mixRgb(colour, hex(0x7a4f2c), 1 - smoothstep(0.02, 0.06, r));
    for (const check of checks) {
      const inward = 1 - check.depth;
      if (r < inward || r > 0.86) continue;
      const along = (r - inward) / (0.86 - inward);
      const width = 0.004 + along * 0.02;
      const off = Math.abs(wrapDelta((angle - check.angle) / (Math.PI * 2))) * Math.PI * 2 * r;
      colour = mixRgb(colour, hex(0x4b3120), (1 - smoothstep(width * 0.3, width, off)) * 0.85);
    }
    colour = mixRgb(colour, bark, smoothstep(0.86, 0.9, r));
    out[0] = colour[0];
    out[1] = colour[1];
    out[2] = colour[2];
  });
  return raster;
}

/**
 * A single weathered stone surface: soft grey with warm and cool patches,
 * fine speckle, the odd hairline crack, and pale lichen. For path stones,
 * rocks and anything carved from one piece.
 */
export function paintStone(size = 512): Raster {
  const raster = new Raster(size);
  const cool = hex(0x8a8a86);
  const warm = hex(0xa39a8a);
  const shadow = hex(0x6c675f);
  raster.fill((u, v, out) => {
    const tone = tileableFbm(u * 3, v * 3, 3, 5, 61) * 0.5 + 0.5;
    const blotch = tileableFbm(u * 6, v * 6, 6, 3, 62) * 0.5 + 0.5;
    let colour = mixRgb(cool, warm, smoothstep(0.3, 0.7, tone));
    colour = mixRgb(colour, shadow, smoothstep(0.55, 0.85, blotch) * 0.45);
    const cells = tileableCells(u * 5, v * 5, 5, 63);
    const crack = 1 - smoothstep(0.0, 0.025, cells.second - cells.nearest);
    colour = mixRgb(colour, hex(0x4f4b45), crack * 0.35 * smoothstep(0.4, 0.6, tone));
    colour = scaleRgb(colour, 0.93 + tileableNoise(u * 48, v * 48, 48, 64) * 0.07);
    out[0] = colour[0];
    out[1] = colour[1];
    out[2] = colour[2];
  });
  const random = seededRandom(6006);
  const scale = size / 512;
  const lichen = [hex(0xb9b877), hex(0xc7c08a), hex(0x9fa760)];
  for (let patch = 0; patch < Math.round(34 * scale * scale); patch++) {
    const cx = random() * size;
    const cy = random() * size;
    const colour = pick(random, lichen);
    for (let dot = 0; dot < 26; dot++) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * 16 * scale;
      raster.dab(
        cx + Math.cos(angle) * distance,
        cy + Math.sin(angle) * distance,
        (1 + random() * 2.4) * scale,
        jitter(random, colour, 0.1),
        0.55,
        0.6,
      );
    }
  }
  return raster;
}

/**
 * Rounded field stones laid together, with dark gaps between them - for a
 * chimney, and anything else built up out of many small stones.
 */
export function paintCobbles(size = 512): Raster {
  const raster = new Raster(size);
  const stones = [hex(0x9a9488), hex(0xa8a092), hex(0x8a8479), hex(0xb0a795), hex(0x928775)];
  const mortar = hex(0x4f4a3e);
  raster.fill((u, v, out) => {
    const cells = tileableCells(u * 7, v * 7, 7, 71);
    const gap = cells.second - cells.nearest;
    const stone = stones[Math.floor(cells.id * stones.length)] ?? stones[0] ?? mortar;
    // Rounded: bright in the middle of each stone, falling away to its edge.
    const dome = 1 - smoothstep(0.05, 0.75, cells.nearest);
    let colour = scaleRgb(stone, 0.72 + dome * 0.38);
    colour = scaleRgb(colour, 0.94 + tileableNoise(u * 90, v * 90, 90, 72) * 0.06);
    colour = mixRgb(mortar, colour, smoothstep(0.03, 0.09, gap));
    out[0] = colour[0];
    out[1] = colour[1];
    out[2] = colour[2];
  });
  return raster;
}

/**
 * Wooden roof shingles, running across the texture in rows that each
 * overlap the one below: every shingle its own shade of cedar, a soft
 * shadow along each row's lower edge, and moss creeping along a few of them.
 * V runs down the slope of the roof.
 */
export function paintShingles(size = 512): Raster {
  const raster = new Raster(size);
  const rows = 8;
  const cedar = [hex(0x8a5236), hex(0x7a4630), hex(0x965d3c), hex(0x6f402c), hex(0x83503a)];
  const moss = hex(0x6f7d38);
  raster.fill((u, v, out) => {
    // Half a row along, so the texture's own edge falls across the middle of
    // a row rather than right on the shadow line between two.
    const rowPosition = v * rows + 0.5;
    const row = Math.floor(rowPosition);
    const withinRow = rowPosition - row;
    // Every other row staggered by half a shingle, and all of them a quarter
    // along, so no gap between two shingles lands on the texture's own edge.
    const offset = (row % 2 === 0 ? 0 : 0.5) + 0.25;
    const across = u * 6 + offset;
    const shingle = Math.floor(across);
    const withinShingle = across - shingle;
    const seed = hashCell(((shingle % 6) + 6) % 6, ((row % rows) + rows) % rows);
    let colour = cedar[Math.floor(seed * cedar.length)] ?? cedar[0] ?? moss;
    // Darker gap between neighbouring shingles.
    const gap = Math.min(withinShingle, 1 - withinShingle);
    colour = scaleRgb(colour, 0.7 + smoothstep(0.0, 0.05, gap) * 0.3);
    // Lighter towards its exposed lower end, then a shadow cast onto the row below.
    colour = scaleRgb(colour, 0.82 + withinRow * 0.28);
    colour = scaleRgb(colour, 1 - (1 - smoothstep(0.0, 0.12, withinRow)) * 0.45);
    // Grain along each shingle.
    colour = scaleRgb(colour, 0.92 + tileableNoise(u * 80, v * 12, 80, 81, 12) * 0.1);
    const mossy = smoothstep(0.45, 0.8, tileableFbm(u * 3, v * 3, 3, 4, 82) * 0.5 + 0.5);
    colour = mixRgb(colour, moss, mossy * smoothstep(0.55, 0.95, withinRow) * 0.8);
    out[0] = colour[0];
    out[1] = colour[1];
    out[2] = colour[2];
  });
  return raster;
}

/** Dark, crumbly garden soil with tiny pebbles - for a flower bed and a freshly dug mound. */
export function paintSoil(size = 256): Raster {
  const raster = new Raster(size);
  const dark = hex(0x3a2a1e);
  const light = hex(0x5b4330);
  raster.fill((u, v, out) => {
    const clods = tileableCells(u * 14, v * 14, 14, 91);
    const lump = smoothstep(0.0, 0.5, clods.nearest);
    let colour = mixRgb(light, dark, lump * 0.8);
    colour = scaleRgb(colour, 0.88 + tileableNoise(u * 64, v * 64, 64, 92) * 0.12);
    out[0] = colour[0];
    out[1] = colour[1];
    out[2] = colour[2];
  });
  const random = seededRandom(9009);
  const scale = size / 256;
  for (let i = 0; i < Math.round(80 * scale * scale); i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = (0.8 + random() * 1.4) * scale;
    raster.dab(x, y, radius, jitter(random, hex(0x8a8070), 0.15), 0.8, 0.7);
  }
  return raster;
}

/** Coarse woven burlap - for the bag. */
export function paintBurlap(size = 256): Raster {
  const raster = new Raster(size);
  const base = hex(0xb69868);
  const thread = hex(0x9a7c4f);
  const threads = 48;
  raster.fill((u, v, out) => {
    const warp = Math.sin(u * threads * Math.PI * 2) * 0.5 + 0.5;
    const weft = Math.sin(v * threads * Math.PI * 2) * 0.5 + 0.5;
    const over = Math.floor(u * threads) + Math.floor(v * threads);
    const woven = over % 2 === 0 ? warp : weft;
    let colour = mixRgb(thread, base, woven);
    colour = scaleRgb(colour, 0.9 + tileableFbm(u * 6, v * 6, 6, 3, 101) * 0.12);
    colour = scaleRgb(colour, 0.95 + tileableNoise(u * 128, v * 128, 128, 102) * 0.05);
    out[0] = colour[0];
    out[1] = colour[1];
    out[2] = colour[2];
  });
  return raster;
}

/**
 * Short, soft fur strokes, nearly white, all lying the same way (down the
 * texture). Meant to be tinted by a material colour, so one texture serves
 * a rabbit's brown and a raccoon's grey alike.
 */
export function paintFur(size = 256): Raster {
  const raster = new Raster(size);
  raster.fill((u, v, out) => {
    const tone = 0.86 + tileableFbm(u * 4, v * 4, 4, 3, 111) * 0.08;
    out[0] = tone;
    out[1] = tone;
    out[2] = tone;
  });
  const random = seededRandom(11011);
  const scale = size / 256;
  for (let i = 0; i < Math.round(1400 * scale * scale); i++) {
    const x = random() * size;
    const y = random() * size;
    const length = (5 + random() * 6) * scale;
    const shade = random() < 0.5 ? 0.74 + random() * 0.08 : 0.98 + random() * 0.04;
    raster.stroke(
      [x, y],
      [x + (random() - 0.5) * 2, y + length / 2],
      [x + (random() - 0.5) * 3, y + length],
      1.3 * scale,
      0.5 * scale,
      [shade, shade, shade],
      0.5,
    );
  }
  return raster;
}

/**
 * Soft ripples for the pond's surface, as brightness only: the water shader
 * scrolls two copies of this past each other to catch the light.
 */
export function paintRipples(size = 256): Raster {
  const raster = new Raster(size);
  raster.fill((u, v, out) => {
    const warp = tileableFbm(u * 3, v * 3, 3, 3, 121) * 0.6;
    const cells = tileableCells(u * 5 + warp, v * 5 + warp, 5, 122);
    // Soft rounded swells, brightest along the gentle crests between them.
    const crest = 1 - smoothstep(0.0, 0.35, cells.second - cells.nearest);
    const swell = tileableFbm(u * 4, v * 4, 4, 3, 123) * 0.5 + 0.5;
    const tone = crest * 0.6 + swell * 0.4;
    out[0] = tone;
    out[1] = tone;
    out[2] = tone;
  });
  return raster;
}

/** A shortest signed distance across a texture that wraps. */
function wrapDelta(delta: number): number {
  return delta - Math.round(delta);
}

/** A repeatable number in [0, 1) for a cell of a grid. */
function hashCell(x: number, y: number): number {
  let h = Math.imul(x + 1, 0x27d4eb2d) ^ Math.imul(y + 1, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * A patchwork quilt (see decision 0055): squares of soft cotton in warm
 * reds, creams, sage and mustard, each with its own little print - dots,
 * stripes, gingham, sprigs - and a line of running stitches round every one.
 * Four squares across, so it tiles over a bed.
 */
export function paintQuilt(size = 256): Raster {
  const raster = new Raster(size);
  const squares = 4;
  const fabrics: readonly Rgb[] = [
    hex(0xb8483a),
    hex(0xefe3c8),
    hex(0x8fa679),
    hex(0xd9a441),
    hex(0x7d93a8),
    hex(0xc97b5c),
  ];
  const patterns = ['plain', 'dots', 'stripes', 'gingham', 'sprig'] as const;
  const random = seededRandom(13013);
  const cells = Array.from({ length: squares * squares }, () => ({
    fabric: pick(random, fabrics),
    print: pick(random, fabrics),
    pattern: patterns[Math.floor(random() * patterns.length)] ?? 'plain',
  }));

  raster.fill((u, v, out) => {
    const column = Math.floor(u * squares);
    const row = Math.floor(v * squares);
    const cell = cells[(row % squares) * squares + (column % squares)];
    const cu = u * squares - column;
    const cv = v * squares - row;
    let colour: Rgb = cell?.fabric ?? PLAIN_CREAM;
    const print = cell?.print ?? PLAIN_CREAM;
    switch (cell?.pattern) {
      case 'dots': {
        const dx = ((cu * 6) % 1) - 0.5;
        const dy = ((cv * 6 + Math.floor(cu * 6) * 0.5) % 1) - 0.5;
        colour = mixRgb(colour, print, 1 - smoothstep(0.12, 0.18, Math.hypot(dx, dy)));
        break;
      }
      case 'stripes':
        colour = mixRgb(
          colour,
          print,
          smoothstep(0.45, 0.55, Math.sin(cu * Math.PI * 14) * 0.5 + 0.5) * 0.6,
        );
        break;
      case 'gingham': {
        const a = Math.floor(cu * 8) % 2;
        const b = Math.floor(cv * 8) % 2;
        colour = mixRgb(colour, print, (a + b) * 0.28);
        break;
      }
      case 'sprig': {
        const sprig = tileableCells(u * 24, v * 24, 24, 13014);
        colour = mixRgb(colour, print, (1 - smoothstep(0.08, 0.16, sprig.nearest)) * 0.8);
        break;
      }
      default:
        break;
    }
    // Soft puffs where the quilting pulls the cotton in, and the weave.
    const puff = Math.sin(cu * Math.PI) * Math.sin(cv * Math.PI);
    colour = scaleRgb(colour, 0.82 + puff * 0.2);
    colour = scaleRgb(colour, 0.96 + tileableNoise(u * 96, v * 96, 96, 13015) * 0.04);
    // The seam between squares.
    const seam = Math.min(cu, 1 - cu, cv, 1 - cv);
    colour = scaleRgb(colour, 0.78 + smoothstep(0, 0.035, seam) * 0.22);
    // Running stitches just inside each square.
    const along = (cu + cv) * 40;
    const stitchLine =
      (Math.abs(cu - 0.07) < 0.008 ||
        Math.abs(cu - 0.93) < 0.008 ||
        Math.abs(cv - 0.07) < 0.008 ||
        Math.abs(cv - 0.93) < 0.008) &&
      along % 1 < 0.55;
    if (stitchLine) colour = mixRgb(colour, PLAIN_CREAM, 0.7);
    out[0] = colour[0];
    out[1] = colour[1];
    out[2] = colour[2];
  });
  return raster;
}

const PLAIN_CREAM = hex(0xf4ead3);

/**
 * A braided rag rug, round, seen from above (see decision 0055): rings of
 * plaited fabric in faded reds, creams, blues and browns, one picture rather
 * than a repeating tile - it is laid over an oval once, like a log end.
 */
export function paintRug(size = 256): Raster {
  const raster = new Raster(size);
  const braids: readonly Rgb[] = [
    hex(0xa24a3c),
    hex(0xe8d9b8),
    hex(0x5f7a92),
    hex(0x8a6a4a),
    hex(0xc98f4f),
    hex(0x7d8f6a),
  ];
  const random = seededRandom(14014);
  const ringColours = Array.from({ length: 14 }, () => pick(random, braids));
  raster.fill((u, v, out) => {
    const dx = u - 0.5;
    const dy = v - 0.5;
    const radius = Math.hypot(dx, dy) * 2;
    const angle = Math.atan2(dy, dx);
    if (radius > 1) {
      // Past the edge: the floor shows through - the mesh never draws here.
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
      return;
    }
    const rings = radius * ringColours.length;
    const ring = Math.min(ringColours.length - 1, Math.floor(rings));
    const across = rings - ring;
    let colour = ringColours[ring] ?? PLAIN_CREAM;
    // Each braid is a row of little plaits leaning one way, then the other.
    const plaits = Math.max(6, Math.round((ring + 1) * 7));
    const plait = (angle / (Math.PI * 2)) * plaits + (across > 0.5 ? 0.5 : 0);
    const lean = Math.abs((((plait % 1) + 1) % 1) - 0.5) * 2;
    colour = scaleRgb(colour, 0.78 + (1 - lean) * 0.22);
    // Rounded, like a cord.
    colour = scaleRgb(colour, 0.8 + Math.sin(across * Math.PI) * 0.25);
    colour = scaleRgb(colour, 0.95 + tileableNoise(u * 64, v * 64, 64, 14015) * 0.05);
    out[0] = colour[0];
    out[1] = colour[1];
    out[2] = colour[2];
  });
  return raster;
}
