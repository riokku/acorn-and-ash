import * as THREE from 'three/webgpu';

import {
  paintBark,
  paintBurlap,
  paintCobbles,
  paintForestFloor,
  paintFur,
  paintGrass,
  paintLogEnd,
  paintRipples,
  paintShingles,
  paintSoil,
  paintStone,
  paintWood,
} from './recipes';
import type { Raster } from './raster';

/**
 * Every texture the game paints for itself (see decision 0053), painted once
 * while the world loads and shared by everything that uses it.
 *
 * Painting happens on the main thread, a texture at a time with a breath in
 * between, so the loading screen never freezes solid; together they take a
 * fraction of a second.
 */
export type ArtTextureId =
  | 'grass'
  | 'forestFloor'
  | 'bark'
  | 'wood'
  | 'logEnd'
  | 'stone'
  | 'cobbles'
  | 'shingles'
  | 'soil'
  | 'burlap'
  | 'fur'
  | 'ripples';

interface Recipe {
  readonly paint: () => Raster;
  /** Whether it repeats (almost all do), or is one picture to be used once, like a log end. */
  readonly tiles: boolean;
  /** Colour, or plain brightness data a shader reads (ripples). */
  readonly colour: boolean;
}

const RECIPES: Record<ArtTextureId, Recipe> = {
  grass: { paint: () => paintGrass(512), tiles: true, colour: true },
  forestFloor: { paint: () => paintForestFloor(512), tiles: true, colour: true },
  bark: { paint: () => paintBark(256), tiles: true, colour: true },
  wood: { paint: () => paintWood(512), tiles: true, colour: true },
  logEnd: { paint: () => paintLogEnd(256), tiles: false, colour: true },
  stone: { paint: () => paintStone(512), tiles: true, colour: true },
  cobbles: { paint: () => paintCobbles(256), tiles: true, colour: true },
  shingles: { paint: () => paintShingles(512), tiles: true, colour: true },
  soil: { paint: () => paintSoil(256), tiles: true, colour: true },
  burlap: { paint: () => paintBurlap(256), tiles: true, colour: true },
  fur: { paint: () => paintFur(256), tiles: true, colour: true },
  ripples: { paint: () => paintRipples(256), tiles: true, colour: false },
};

/**
 * How sharp a texture stays when seen at a glancing angle - most of all the
 * ground, stretching off towards the tree line. Eight is plenty, and cheap
 * on anything with a graphics chip made this decade.
 */
const ANISOTROPY = 8;

const painted = new Map<ArtTextureId, THREE.DataTexture>();
let preloadPromise: Promise<void> | null = null;

/** Paint every texture, a little at a time. Resolves at once if already done. */
export function preloadArtTextures(): Promise<void> {
  preloadPromise ??= (async () => {
    for (const id of Object.keys(RECIPES) as ArtTextureId[]) {
      artTexture(id);
      // A breath between paintings, so a loading screen keeps animating.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  })();
  return preloadPromise;
}

/**
 * One of the painted textures, painted now if it has not been yet. Shared:
 * whoever uses it must never dispose of it.
 */
export function artTexture(id: ArtTextureId): THREE.DataTexture {
  const existing = painted.get(id);
  if (existing !== undefined) return existing;

  const recipe = RECIPES[id];
  const raster = recipe.paint();
  const texture = new THREE.DataTexture(
    raster.toBytes(),
    raster.size,
    raster.size,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.colorSpace = recipe.colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  const wrap = recipe.tiles ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapS = wrap;
  texture.wrapT = wrap;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = ANISOTROPY;
  // Rows were painted top to bottom; a data texture is read bottom to top,
  // which only matters for the one picture that is not symmetrical anyway.
  texture.flipY = false;
  texture.name = `painted-${id}`;
  texture.needsUpdate = true;
  painted.set(id, texture);
  return texture;
}
