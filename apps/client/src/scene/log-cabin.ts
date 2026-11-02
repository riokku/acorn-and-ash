import * as THREE from 'three/webgpu';

import { paintedMaterial, plainMaterial } from '../art/materials';
import { ModelBuilder, placed, plankGeometry } from '../art/shapes';
import { groundBuildingSupport, groundLooseBuildingPart } from './building-ground';
import type { Cabin } from './cabin';
import { createFireGlow } from './fire-light';
import { createLogsModel } from './ground-items';
import { createHomeDecoration } from './home-decoration';
import { polyforkGroup, polyforkPiece, splitByPaint } from './polyfork-piece';

/**
 * Polyfork's free Log Cabin (decision 0272), fitted to the cabin's place in
 * the world: its door, in the middle of its gable end, is moved onto our
 * doorway, and it is narrowed and shortened front to back to the cabin's
 * walls. It keeps its full height so its door stays tall enough to walk
 * through. The woodpile, the fire-lit windows and the stone footing are ours.
 */
const DOOR_X = -0.575;
const SQUEEZE_X = 0.8;
const SQUEEZE_Z = 0.625;
/** Polyfork's walls, before squeezing: 5.28 m wide and 6.28 m deep. */
const HALF_WIDTH = 2.64 * SQUEEZE_X;
const HALF_DEPTH = 3.14 * SQUEEZE_Z;
/** The dark blue Polyfork paints its window panes, swapped for glass that lights up. */
const WINDOW_PAINT = new THREE.Color(0.05, 0.074, 0.091);

const logCabin = polyforkPiece(
  'log-cabin',
  new THREE.Matrix4()
    .makeTranslation(DOOR_X, 0, 0)
    .multiply(new THREE.Matrix4().makeScale(SQUEEZE_X, 1, SQUEEZE_Z)),
);
let pieces: { walls: THREE.BufferGeometry[]; glass: THREE.BufferGeometry } | undefined;

/** The real cabin's walls and window glass, or undefined to keep building the placeholder. */
function cabinPieces(): typeof pieces {
  const parts = logCabin.parts();
  const shell = parts?.get('log-cabin-shell');
  if (pieces !== undefined || shell === undefined) return pieces;
  const [walls, glass] = splitByPaint(shell, WINDOW_PAINT);
  const door = parts?.get('log-cabin-door');
  pieces = { walls: door === undefined ? [walls] : [walls, door], glass };
  return pieces;
}

/** The Polyfork cabin with room for this many stored logs, or undefined if it hasn't loaded. */
export function createLogCabin(logCapacity: number): Cabin | undefined {
  const real = cabinPieces();
  if (real === undefined) return undefined;
  const group = new THREE.Group();
  group.name = 'log-cabin';
  const walls = polyforkGroup('log-cabin-walls', real.walls);
  // Windows reflect the actual fireplace, including paused or exhausted fuel.
  const glassMaterial = plainMaterial(0xffd79a, {
    roughness: 0.3,
    emissive: 0xffb45c,
    emissiveIntensity: 0,
  }).clone();
  group.add(walls.group, new THREE.Mesh(real.glass, glassMaterial));

  // A low stone footing that settles into slopes, as the old cabin's did.
  const cobbles = paintedMaterial('cobbles', { tint: 0xf1e6d6, roughness: 1 });
  const footing = new ModelBuilder()
    .add(
      cobbles,
      plankGeometry(HALF_WIDTH * 2 + 0.1, 0.12, HALF_DEPTH * 2 + 0.1, 'x', 0.9, 3),
      placed(DOOR_X, 0.06, 0),
    )
    .build();
  group.add(footing.group);
  const groundFooting = footing.group.children.map((part) =>
    groundBuildingSupport(part as THREE.Mesh, 0.09),
  );

  const woodpile = createLogsModel(logCapacity, true);
  woodpile.show(0);
  const shelf = createHomeDecoration('cedarBench', false);
  shelf.group.rotation.y = Math.PI / 2;
  shelf.group.scale.set(((logCapacity > 20 ? 10 : 5) * 0.28) / 1.7, 0.85, 0.95 / 0.46);
  const storage = new THREE.Group();
  storage.name = 'cabin-log-storage';
  storage.userData.logStorage = true;
  storage.position.x = DOOR_X - HALF_WIDTH - 0.45;
  woodpile.group.position.y = 0.42;
  storage.add(shelf.group, woodpile.group);
  group.add(storage);

  const glow = createFireGlow(0xffbb72, 2.5, 5, 0.04);
  // Just outside the window in the right-hand wall, near the front.
  glow.anchor.position.set(DOOR_X + HALF_WIDTH + 0.3, 1.6, 0.4);
  glow.anchor.visible = false;
  group.add(glow.anchor);
  let fireLit = false;
  let daylight = 1;
  const updateWindows = () => {
    const night = 1 - Math.max(0, Math.min(1, daylight));
    glassMaterial.color.set(fireLit ? 0xffd79a : 0x58636a);
    glassMaterial.emissiveIntensity = fireLit ? 0.35 + night * 1.2 : 0;
    glow.anchor.visible = fireLit;
    glow.brightness = fireLit ? 0.15 + night * 0.85 : 0;
  };
  updateWindows();
  return {
    group,
    setStoredLogs: (count) => woodpile.show(count),
    groundOn(heightAt) {
      for (const fit of groundFooting) fit(heightAt);
      groundLooseBuildingPart(storage, heightAt);
    },
    setLit(lit) {
      if (lit !== fireLit) {
        fireLit = lit;
        updateWindows();
      }
    },
    setDaylight(brightness) {
      daylight = brightness;
      updateWindows();
    },
    update(deltaSeconds) {
      glow.update(deltaSeconds);
    },
    dispose() {
      glow.dispose();
      glassMaterial.dispose();
      footing.dispose();
      woodpile.dispose();
      shelf.dispose();
    },
  };
}
