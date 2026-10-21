import { preloadHousingDetails } from '../scene/housing-details';
import { installBvhRaycasting } from '../scene/bvh';
import { buildClearingScene } from '../scene/clearing';
import { SKELETON_TOWN } from '@acorn/shared';
import { preloadSkeletonTown } from '../scene/skeleton-town';
import { createForestWeather } from '../scene/forest-weather';
import { DAY_LENGTH_MS } from '@acorn/shared';
import { createRiverExhibit } from './river';
import { animateSmallAnimal } from '../scene/animal-motion';
import { STREAM, streamPointAt, streamSurfaceAt } from '@acorn/shared';
import { createFishDisplay } from '../scene/fish-display';
import { createGuardianTrophy } from '../scene/guardian-trophy';
import { createWoodlandCreature } from '../scene/woodland-creatures';
import { createDiscoveryLandmarks } from '../scene/discovery-sites';
import { createForageModel, createMealModel } from '../scene/forest-food';
import { DISCOVERIES, parseSeason } from '@acorn/shared';
import { createSeasonRig } from '../scene/seasons';
import { createSeasonFall } from '../scene/season-fall';
import { createFlatTerrain } from '@acorn/shared';
import { createEncounterLandmarks } from '../scene/encounter-sites';
import * as THREE from 'three/webgpu';

import {
  PROP_KINDS,
  POND as CLEARING_POND,
  DEFAULT_WORLD_SEED,
  buildTestClearing,
  createWildernessTerrain,
  buildWilderness,
  pondGroundHeight,
  dayBrightness,
  isHomeKind,
  type BuildableKindId,
  type PlacedProp,
  type PropKindId,
  type WaterCircle,
  type Terrain,
} from '@acorn/shared';

import { createGroundShader } from '../art/ground-shading';
import { createGroundMaterial } from '../art/materials';
import { preloadArtTextures } from '../art/textures';
import { createBuriedCacheMound } from '../scene/buried-cache';
import { createShelter } from '../scene/shelter';
import { createLargeCabin } from '../scene/large-cabin';
import { createCabin } from '../scene/cabin';
import { createCampfire } from '../scene/campfire';
import { preloadCampfireModels } from '../scene/campfire-models';
import { createCritter } from '../scene/critter';
import { createFence } from '../scene/fence';
import { createFlowerBed } from '../scene/flower-bed';
import { preloadFlowerModel } from '../scene/flower-models';
import { createFox } from '../scene/fox';
import { preloadFoxModel } from '../scene/fox-model';
import { createGardenPath } from '../scene/garden-path';
import { createLantern } from '../scene/lantern';
import { createHomeInterior } from '../scene/home-interior';
import { addDaylight, type DaylightRig } from '../scene/lighting';
import { FireLights } from '../scene/fire-light';
import { createSatchel, createStickPileModel } from '../scene/pickup-models';
import { createPond } from '../scene/pond';
import { preloadPropModels } from '../scene/prop-models';
import { treeVariant } from '../scene/prop-models';
import { createPropMeshes, placeInstance } from '../scene/props';
import { createRaccoon } from '../scene/raccoon';
import { createRenderer, type RendererSetup } from '../scene/renderer';
import { preloadDugWalls } from '../scene/dug-walls';
import { createDugEarth } from './dug-earth';
import { createMineSupportsExhibit } from './mine-supports';
import { createMineLantern, preloadMineLantern } from './mine-lantern';
import { preloadMineSupport } from '../scene/mine-supports';
import { createDugGround, createDugRamp } from './dug-ground';
import { createIronAxe, preloadIronAxe } from './iron-axe';

/**
 * The art gallery: every piece of the game's own art laid out in daylight on
 * a patch of painted ground, with no server and no Home screen - open the
 * game with `?gallery` to see it (see decision 0053).
 *
 * `?gallery=cabin` looks at one piece up close; `?gallery=moves` and
 * `?gallery=raiders` play the characters' and the skeletons' moves (see
 * moves.ts and raiders.ts); `?gallery=bodies` shows the six bodies before
 * and after their outfits became gear (see bodies.ts); `&time=0.3` picks a time of
 * day from 0 (midnight) through 0.5 (noon); `&spin` turns the view slowly
 * round. Only ever used to look at the art: nothing here is part of playing.
 */

interface Exhibit {
  readonly name: string;
  readonly x: number;
  readonly z: number;
  readonly yaw?: number;
  /** How far back the camera stands to look at it on its own. */
  readonly view: number;
  /** Brings its own ground, so it is shown only when asked for by name. */
  readonly alone?: boolean;
  create(): {
    group: THREE.Group;
    update?(deltaSeconds: number): void;
    setDaylight?(brightness: number): void;
  };
}

const POND: WaterCircle[] = [
  { x: 9, z: -7, radius: 3 },
  { x: 11.5, z: -5.5, radius: 2 },
];

function smallAnimalExhibit(
  kind: 'rabbit' | 'maskedRaccoon' | 'fox',
  model: { group: THREE.Group; dispose(): void },
) {
  const art = animateSmallAnimal(model, kind);
  const params = new URLSearchParams(window.location.search);
  const motion = params.get('motion') ?? 'idle';
  const pose = {
    speed: motion === 'walk' ? 1.3 : motion === 'run' ? 6 : 0,
    alert: motion === 'alert',
    windup: motion === 'windup',
    attacking: motion === 'attack',
    defeated: motion === 'defeat',
  };
  const frozen = params.has('at');
  if (frozen) {
    let remaining = Math.max(0, Math.min(5, Number(params.get('at')) || 0));
    while (remaining > 0.000001) {
      const step = Math.min(1 / 60, remaining);
      art.update(step, pose);
      remaining -= step;
    }
  }
  return {
    group: art.group,
    update: (delta: number) => {
      if (!frozen) art.update(delta, pose);
    },
  };
}

const EXHIBITS: readonly Exhibit[] = [
  { name: 'mountain-spring', x: 0, z: 0, view: 15, alone: true, create: createRiverExhibit },
  { name: 'river-banks', x: 0, z: 0, view: 24, alone: true, create: createRiverExhibit },
  { name: 'fish-display', x: 26, z: 20, view: 2.2, create: () => createFishDisplay() },
  { name: 'golden-fish-display', x: 26, z: 23, view: 2.2, create: () => createFishDisplay(true) },
  { name: 'guardian-trophy', x: 26, z: 16, view: 2.3, create: createGuardianTrophy },
  ...(['elk', 'curiousRaccoon', 'woodlandGuardian'] as const).map((kind, index) => ({
    name: kind,
    x: 27,
    z: -5 + index * 5,
    view: kind === 'curiousRaccoon' ? 1.8 : kind === 'elk' ? 6 : 5.5,
    yaw: Math.PI,
    create: () => {
      const model = createWoodlandCreature(kind);
      const params = new URLSearchParams(window.location.search);
      const motion = params.get('motion') ?? 'idle';
      const pose = {
        speed: motion === 'walk' ? 1.2 : motion === 'run' ? 5 : 0,
        alert: motion === 'alert',
        windup: motion === 'windup',
        attacking: motion === 'attack',
        hurt: motion === 'hurt',
        defeated: motion === 'defeat',
      };
      const frozen = params.has('at');
      if (frozen) {
        let remaining = Math.max(0, Math.min(5, Number(params.get('at')) || 0));
        while (remaining > 0.000001) {
          const step = Math.min(1 / 60, remaining);
          model.update(step, pose);
          remaining -= step;
        }
      }
      return {
        group: model.group,
        update: (delta: number) => {
          if (!frozen) model.update(delta, pose);
        },
      };
    },
  })),
  ...DISCOVERIES.filter((definition) => definition.id !== 4 && definition.id !== 6).map(
    (definition, index) => ({
      name: `discovery-${definition.kind}`,
      x: 22,
      z: -10 + index * 5,
      view: 4,
      create: () => createDiscoveryLandmarks([{ ...definition, x: 0, z: 0 }], createFlatTerrain()),
    }),
  ),
  {
    name: 'forest-food',
    x: 24,
    z: 12,
    view: 2,
    create: () => {
      const group = new THREE.Group();
      for (const [index, item] of (
        ['berry', 'mushroom', 'trailRation', 'forestStew', 'berryTea'] as const
      ).entries()) {
        const model =
          item === 'berry' || item === 'mushroom' ? createForageModel(item) : createMealModel(item);
        model.show(item === 'berry' || item === 'mushroom' ? 4 : 1);
        model.group.position.x = (index - 2) * 0.4;
        group.add(model.group);
      }
      return { group };
    },
  },
  {
    name: 'ruins',
    x: 15,
    z: 10,
    view: 9,
    create: () =>
      createEncounterLandmarks([{ id: 1, kind: 'ruins', x: 0, z: 0, yaw: 0 }], createFlatTerrain()),
  },
  {
    name: 'patrolTrail',
    x: 15,
    z: 17,
    view: 7,
    create: () =>
      createEncounterLandmarks(
        [{ id: 1, kind: 'patrol', x: -2.8, z: -2.7, yaw: 0 }],
        createFlatTerrain(),
      ),
  },
  { name: 'tent', x: -15, z: 7, view: 7, create: () => createShelter('tent') },
  { name: 'teepee', x: -8, z: 9, view: 8, create: () => createShelter('teepee') },
  { name: 'largeCabin', x: 2, z: 10, view: 12, create: createLargeCabin },
  { name: 'cabin', x: -11, z: -1, yaw: 0.35, view: 11, create: createCabin },
  { name: 'fence', x: -4.9, z: 0, view: 4.5, create: createFence },
  { name: 'fence', x: -3.5, z: 0, view: 4.5, create: createFence },
  { name: 'fence', x: -2.8, z: -0.7, yaw: Math.PI / 2, view: 4.5, create: createFence },
  { name: 'flowerBed', x: -1.2, z: 1.2, view: 3, create: createFlowerBed },
  { name: 'lantern', x: 0.4, z: 0.2, view: 3, create: createLantern },
  { name: 'campfire', x: 2, z: 1.2, view: 3, create: createCampfire },
  { name: 'gardenPath', x: 3.4, z: 1.6, view: 2, create: createGardenPath },
  { name: 'gardenPath', x: 3.9, z: 1.9, view: 2, create: createGardenPath },
  { name: 'gardenPath', x: 4.35, z: 2.3, view: 2, create: createGardenPath },
  { name: 'buriedCache', x: 5.3, z: 0.8, view: 2, create: createBuriedCacheMound },
  { name: 'bag', x: -5.6, z: 3.4, yaw: 0.4, view: 1.3, create: createSatchel },
  { name: 'sticks', x: -4.6, z: 3.6, view: 1.4, create: createStickPileModel },
  // Yaw 0 for all three, so it is plain which way each one faces: yaw 0
  // walks towards -Z, away from the camera's usual spot.
  {
    name: 'rabbit',
    x: 6.4,
    z: 1.4,
    view: 1.6,
    create: () => smallAnimalExhibit('rabbit', createCritter()),
  },
  {
    name: 'raccoon',
    x: 7.4,
    z: 1.1,
    view: 2,
    create: () => smallAnimalExhibit('maskedRaccoon', createRaccoon()),
  },
  { name: 'fox', x: 8.6, z: 1.3, view: 2, create: () => smallAnimalExhibit('fox', createFox()) },
  // The iron axe, made in Blender (see iron-axe.ts).
  { name: 'iron-axe', x: -16.9, z: -3.2, view: 1.4, create: createIronAxe },
  // The layers on dug tunnel walls, painted in Blender (see dug-earth.ts).
  { name: 'dug-earth', x: -16, z: 8, view: 9, create: createDugEarth },
  // A tunnel propped with mine supports (see mine-supports.ts).
  { name: 'mine-supports', x: -16, z: 20, view: 9, create: createMineSupportsExhibit },
  // The hanging mine lantern, made in Blender (see mine-lantern.ts).
  { name: 'mine-lantern', x: -17, z: 14, view: 1, create: createMineLantern },
  // A hole cut into real hillside, with the world's own ground (see dug-ground.ts).
  { name: 'dug-ground', x: 0, z: 0, view: 6, alone: true, create: createDugGround },
  { name: 'dug-ramp', x: 0, z: 0, view: 6, alone: true, create: createDugRamp },
];

/** Places to look at that are not one exhibit: the pond, the trees, the rocks. */
const VIEWPOINTS: Record<
  string,
  { x: number; y: number; z: number; distance: number; height: number; angle?: number }
> = {
  'mountain-spring': {
    ...streamPointAt(STREAM, 0),
    y: streamSurfaceAt(STREAM, 0),
    distance: 17,
    height: 9,
    angle: 2.5,
  },
  'river-banks': {
    ...streamPointAt(STREAM, Math.round(STREAM.count * 0.6)),
    y: streamSurfaceAt(STREAM, STREAM.length * 0.6),
    distance: 24,
    height: 20,
    angle: 0.5,
  },
  pond: { x: 14, y: 0, z: -5.5, distance: 17, height: 13, angle: -0.7 },
  trees: { x: -2, y: 3, z: -10, distance: 13, height: 1.5 },
  rocks: { x: 4, y: 0.4, z: -4, distance: 5, height: 2 },
  ground: { x: -2, y: 0, z: 4, distance: 5, height: 2.2 },
  animals: { x: 7.5, y: 0.25, z: 1.2, distance: 3.2, height: 0.9, angle: 0.9 },
  stump: { x: -6.5, y: 0.3, z: 2.4, distance: 2, height: 0.9 },
};

/** Scenery behind the exhibits, drawn exactly the way the clearing draws it. */
const SCENERY: readonly { kind: PropKindId; x: number; z: number; scale: number }[] = [
  { kind: 'oak', x: -8, z: -9, scale: 1 },
  { kind: 'birch', x: -3, z: -11, scale: 0.9 },
  { kind: 'pine', x: 1.5, z: -10, scale: 1.1 },
  { kind: 'pine', x: 4, z: -13, scale: 0.95 },
  { kind: 'oak', x: 15, z: -10, scale: 1.1 },
  { kind: 'maple', x: -13, z: -8, scale: 1 },
  { kind: 'alder', x: 9, z: -12, scale: 1 },
  { kind: 'boulder', x: 2.5, z: -4.5, scale: 1 },
  { kind: 'mossyRock', x: 5.8, z: -3.2, scale: 1 },
  { kind: 'stump', x: -6.5, z: 2.4, scale: 1 },
];

export async function startGallery(canvas: HTMLCanvasElement): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const focus = params.get('gallery') ?? '';
  const time = Number(params.get('time') ?? '0.42');
  const spin = params.has('spin');

  const setup = await createRenderer(canvas, params.get('renderer') === 'webgl2');
  const renderer = setup.renderer;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  await Promise.all([
    preloadArtTextures(),
    preloadHousingDetails(),
    preloadSkeletonTown(),
    preloadPropModels(),
    preloadFlowerModel(),
    preloadCampfireModels(),
    preloadFoxModel(),
    preloadIronAxe(),
    preloadDugWalls(),
    preloadMineSupport(),
    preloadMineLantern(),
  ]);

  const scene = new THREE.Scene();
  const daylight = addDaylight(scene);
  daylight.update(Number.isFinite(time) ? time : 0.42);
  // `?season=autumn` (or spring, summer, winter) shows the trees dressed for that season.
  const season = parseSeason(params.get('season'));
  if (season !== undefined)
    createSeasonRig().apply({ from: season, to: season, amount: 0 }, daylight);
  const fireLights = new FireLights(scene);

  if (focus === 'skeleton-town') {
    installBvhRaycasting();
    const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
    const ground = createGalleryGround(
      [],
      (x, z) => terrain.heightAt(x + SKELETON_TOWN.x, z + SKELETON_TOWN.z),
      110,
      160,
      [],
      SKELETON_TOWN,
    );
    ground.position.set(SKELETON_TOWN.x, 0, SKELETON_TOWN.z);
    scene.add(ground);
    const props = buildWilderness(DEFAULT_WORLD_SEED, terrain).props.filter(
      (p) => Math.hypot(p.x - SKELETON_TOWN.x, p.z - SKELETON_TOWN.z) < 62,
    );
    scene.add(
      buildClearingScene(
        { ...buildTestClearing(DEFAULT_WORLD_SEED), props, pickups: [], water: [] },
        terrain,
      ).group,
    );
    daylight.sun.position.set(SKELETON_TOWN.x + 28, 60, SKELETON_TOWN.z + 18);
    daylight.sun.target.position.set(SKELETON_TOWN.x, 0, SKELETON_TOWN.z);
    daylight.sun.target.updateMatrixWorld();
    const { showSkeletonTown } = await import('./skeleton-town');
    await showSkeletonTown(renderer, scene, fireLights, params);
    return;
  }

  if (focus === 'tree-models') {
    scene.add(createGalleryGround([]));
    const { showTreeModels } = await import('./tree-models');
    showTreeModels(renderer, scene, fireLights, params);
    return;
  }

  if (focus === 'tree-fires') {
    scene.add(createGalleryGround([]));
    const { showTreeFires } = await import('./tree-fires');
    showTreeFires(renderer, scene, fireLights, params);
    return;
  }

  if (focus === 'canoe') {
    const { showCanoe } = await import('./canoe');
    await showCanoe(renderer, scene, fireLights, params);
    return;
  }

  if (focus === 'forest-trails') {
    const { showForestTrails } = await import('./forest-trails');
    showForestTrails(renderer, scene, fireLights, params);
    return;
  }

  // The inside of a home is its own place (see decision 0055), shown the
  // way the game shows it: a dollhouse with the near walls cut away.
  if (focus === 'home') {
    showHomeInside(renderer, scene, fireLights, daylight, params, time);
    return;
  }
  if (focus === 'winter-gear' || focus === 'basic-clothing') {
    scene.add(createGalleryGround([]));
    const { showWinterGear } = await import('./winter-gear');
    await showWinterGear(renderer, scene, fireLights, params);
    return;
  }
  if (focus === 'footing') {
    const { showFooting, galleryLedgeHeight } = await import('./footing');
    scene.add(createGalleryGround([], galleryLedgeHeight, 4, 160));
    await showFooting(renderer, scene, fireLights, params);
    return;
  }
  if (focus === 'moves') {
    scene.add(createGalleryGround([]));
    if (params.get('demo') === 'network') {
      const { showNetworkMotion } = await import('./network-motion');
      await showNetworkMotion(renderer, scene, fireLights);
    } else {
      const { showMoves } = await import('./moves');
      await showMoves(renderer, scene, fireLights, params);
    }
    return;
  }
  if (focus === 'bodies') {
    scene.add(createGalleryGround([]));
    const { showBodies } = await import('./bodies');
    await showBodies(renderer, scene, fireLights, params);
    return;
  }
  if (focus === 'raiders') {
    const slope = Math.max(-0.3, Math.min(0.3, Number(params.get('slope') ?? 0))) || 0;
    scene.add(createGalleryGround([], (x) => x * slope));
    const { showRaiders } = await import('./raiders');
    await showRaiders(renderer, scene, fireLights, params);
    return;
  }

  const scenery: readonly PlacedProp[] =
    focus === 'pond'
      ? buildTestClearing(DEFAULT_WORLD_SEED).props
      : SCENERY.map((entry, index) => ({
          id: index + 1,
          kind: entry.kind,
          x: entry.x,
          z: entry.z,
          rotationY: index * 1.3,
          scale: entry.scale,
        }));
  const alone = EXHIBITS.some((exhibit) => exhibit.name === focus && exhibit.alone === true);
  if (!alone) {
    const water = focus === 'pond' ? CLEARING_POND : POND;
    scene.add(
      createGalleryGround(
        scenery,
        (x, z) => pondGroundHeight(water, x, z),
        undefined,
        focus === 'pond' ? 400 : undefined,
        water,
      ),
    );
    scene.add(createPond(water).group);
    addScenery(
      scene,
      scenery,
      focus === 'pond'
        ? {
            kind: 'pond-gallery',
            heightAt: (x, z) => pondGroundHeight(water, x, z),
          }
        : undefined,
    );
  }

  const updaters: Array<(deltaSeconds: number) => void> = [];
  const focusedExhibits = EXHIBITS.filter((exhibit) => exhibit.name === focus);
  for (const exhibit of focus === 'pond'
    ? []
    : focusedExhibits.length > 0
      ? focusedExhibits
      : EXHIBITS.filter((entry) => entry.alone !== true)) {
    const made = exhibit.create();
    made.group.position.set(exhibit.x, 0, exhibit.z);
    made.group.rotation.y = exhibit.yaw ?? 0;
    made.setDaylight?.(dayBrightness(Number.isFinite(time) ? time : 0.42));
    if ('setLit' in made && typeof made.setLit === 'function') made.setLit(true);
    scene.add(made.group);
    if (made.update !== undefined) updaters.push(made.update);
  }

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.05,
    1500,
  );
  const target = new THREE.Vector3(0, 0.6, 0);
  let distance = 17;
  let height = 8;
  const chosen = EXHIBITS.find((exhibit) => exhibit.name === focus);
  if (chosen !== undefined) {
    target.set(chosen.x, chosen.view * 0.18, chosen.z);
    distance = chosen.view;
    height = chosen.view * 0.45;
  }
  const viewpoint = VIEWPOINTS[focus];
  if (viewpoint !== undefined) {
    target.set(viewpoint.x, viewpoint.y, viewpoint.z);
    distance = viewpoint.distance;
    height = viewpoint.height;
  }
  let angle = Number(params.get('angle') ?? viewpoint?.angle ?? 0.35);
  // Aim somewhere beside the exhibit: metres along x, y and z from where it looks by default.
  target.add(
    new THREE.Vector3(
      Number(params.get('tx') ?? 0),
      Number(params.get('ty') ?? 0),
      Number(params.get('tz') ?? 0),
    ),
  );
  if (params.has('height')) height = Number(params.get('height'));
  if (params.has('distance')) distance = Number(params.get('distance'));

  const seasonFall =
    focus === 'trees' && season !== undefined ? createSeasonFall(123, () => 0) : null;
  if (seasonFall !== null) scene.add(seasonFall.group);
  const forestWeather =
    focus === 'trees' && Number.isFinite(time) ? createForestWeather(123, () => 0) : null;
  if (forestWeather !== null) scene.add(forestWeather.group);
  const fallDirection = new THREE.Vector3();
  const fallCentre = new THREE.Vector3();

  const resize = (): void => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  let last = performance.now();
  let frames = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const delta = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (spin) angle += delta * 0.15;
    camera.position.set(
      target.x + Math.sin(angle) * distance,
      target.y + height,
      target.z + Math.cos(angle) * distance,
    );
    camera.lookAt(target);
    camera.getWorldDirection(fallDirection);
    fallCentre.copy(camera.position).addScaledVector(fallDirection, 10);
    forestWeather?.update(
      delta,
      fallCentre,
      time * DAY_LENGTH_MS,
      { kind: 'clear', cycle: 0, precipitation: 0, wind: 0.2, mushroomsAbundant: false },
      false,
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    if (seasonFall !== null && season !== undefined) {
      seasonFall.update(
        delta,
        fallCentre,
        { from: season, to: season, amount: 0 },
        { kind: 'clear', cycle: 0, precipitation: 0, wind: 0.2, mushroomsAbundant: false },
        dayBrightness(Number.isFinite(time) ? time : 0.42),
        false,
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      );
    }
    daylight.sun.position.set(target.x + 28, 40, target.z + 18);
    daylight.sun.target.position.copy(target);
    daylight.sun.target.updateMatrixWorld();
    for (const update of updaters) update(delta);
    fireLights.update(camera.position);
    renderer.render(scene, camera);
    frames += 1;
    // For screenshots: say so once a few frames have settled.
    if (frames === 8) {
      document.body.dataset.galleryReady = 'true';
      if (params.has('still')) renderer.setAnimationLoop(null);
    }
  });
}

/** The room inside a home, looked into from above the cut-away front wall. */
function showHomeInside(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  fireLights: FireLights,
  daylight: DaylightRig,
  params: URLSearchParams,
  time: number,
): void {
  daylight.setIndoors(true);
  const requested = params.get('tier') as BuildableKindId | null;
  const inside = createHomeInterior(
    requested !== null && isHomeKind(requested) ? requested : 'cabin',
  );
  if (requested === 'largeCabin')
    inside.setGardenPlots([
      { crop: 'berry', growTicks: 0 },
      { crop: 'mushroom', growTicks: 0 },
      { crop: 'flower', growTicks: 0 },
    ]);
  scene.add(inside.group);
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 100);
  // `&x=` and `&z=` look somewhere else in the room, up close.
  const target = new THREE.Vector3(
    Number(params.get('x') ?? 0),
    0.7,
    Number(params.get('z') ?? -0.3),
  );
  let angle = Number(params.get('angle') ?? 0.25);
  const distance = Number(params.get('distance') ?? 8.8);
  const height = Number(params.get('height') ?? 6.2);
  const spin = params.has('spin');
  const resize = (): void => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);
  const daylightAmount = dayBrightness(Number.isFinite(time) ? time : 0.42);
  // `&resting` sits somebody in the chair and lies somebody on the bed.
  let drawResting: ((deltaSeconds: number) => void) | null = null;
  if (params.has('resting')) {
    void import('./moves')
      .then(({ addRestingCharacters }) =>
        addRestingCharacters(scene, Number(params.get('at') ?? 60)),
      )
      .then((draw) => {
        drawResting = draw;
      });
  }
  let last = performance.now();
  let frames = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const delta = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (params.has('resting') && drawResting === null) return;
    drawResting?.(params.has('at') ? 0 : delta);
    if (spin) angle += delta * 0.25;
    camera.position.set(
      target.x + Math.sin(angle) * distance,
      target.y + height,
      target.z + Math.cos(angle) * distance,
    );
    camera.lookAt(target);
    inside.cutAway(camera.position.x, camera.position.z);
    inside.update(delta, daylightAmount);
    fireLights.update(camera.position);
    renderer.render(scene, camera);
    frames += 1;
    if (frames === 8) document.body.dataset.galleryReady = 'true';
  });
}

/** A patch of the same painted ground the world uses, bare under the trees and lush by the pond. */
function createGalleryGround(
  scenery: readonly PlacedProp[],
  heightAt = (_x: number, _z: number) => 0,
  size = 80,
  segments = 160,
  water: readonly WaterCircle[] = POND,
  origin = { x: 0, z: 0 },
): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const shader = createGroundShader({ water, props: scenery });
  const position = geometry.attributes.position;
  if (position === undefined) throw new Error('Plane geometry has no position attribute');
  const floor = new Float32Array(position.count);
  const tint = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    position.setY(i, heightAt(position.getX(i), position.getZ(i)));
    const shade = shader.shadeAt(position.getX(i) + origin.x, position.getZ(i) + origin.z, 0);
    floor[i] = shade.floor;
    tint.set(shade.tint, i * 3);
  }
  geometry.computeVertexNormals();
  geometry.setAttribute('floor', new THREE.BufferAttribute(floor, 1));
  // No mountain in the gallery: no rock and no snow.
  geometry.setAttribute('rock', new THREE.BufferAttribute(new Float32Array(position.count), 1));
  geometry.setAttribute('snow', new THREE.BufferAttribute(new Float32Array(position.count), 1));
  geometry.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
  geometry.setAttribute('bank', new THREE.BufferAttribute(new Float32Array(position.count * 2), 2));
  const mesh = new THREE.Mesh(geometry, createGroundMaterial());
  mesh.receiveShadow = true;
  return mesh;
}

function addScenery(scene: THREE.Scene, scenery: readonly PlacedProp[], terrain?: Terrain): void {
  const byKind = new Map<string, PlacedProp[]>();
  for (const prop of scenery) {
    const key = `${prop.kind}:${treeVariant(prop)}`;
    byKind.set(key, [...(byKind.get(key) ?? []), prop]);
  }
  for (const [key, props] of byKind) {
    const [kind = '', variantText = '0'] = key.split(':');
    const parts = createPropMeshes(
      PROP_KINDS[kind as PropKindId],
      props.length,
      false,
      terrain,
      Number(variantText),
    );
    props.forEach((prop, index) => placeInstance(parts, index, prop));
    for (const part of parts) {
      part.mesh.instanceMatrix.needsUpdate = true;
      scene.add(part.mesh);
    }
  }
}
