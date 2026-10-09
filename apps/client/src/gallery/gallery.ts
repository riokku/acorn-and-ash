import { createFishDisplay } from '../scene/fish-display';
import { createGuardianTrophy } from '../scene/guardian-trophy';
import { createWoodlandCreature } from '../scene/woodland-creatures';
import { createDiscoveryLandmarks } from '../scene/discovery-sites';
import { createForageModel, createMealModel } from '../scene/forest-food';
import { DISCOVERIES } from '@acorn/shared';
import { createFlatTerrain } from '@acorn/shared';
import { createEncounterLandmarks } from '../scene/encounter-sites';
import * as THREE from 'three/webgpu';

import {
  PROP_KINDS,
  dayBrightness,
  isHomeKind,
  type BuildableKindId,
  type PlacedProp,
  type PropKindId,
  type WaterCircle,
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
import { createPropMeshes, placeInstance } from '../scene/props';
import { createRaccoon } from '../scene/raccoon';
import { createRenderer, type RendererSetup } from '../scene/renderer';
import { preloadDugWalls } from '../scene/dug-walls';
import { createDugEarth } from './dug-earth';
import { createDugGround } from './dug-ground';
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

const EXHIBITS: readonly Exhibit[] = [
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
      const motion = new URLSearchParams(window.location.search).get('motion') ?? 'idle';
      return {
        group: model.group,
        update: (delta: number) =>
          model.update(delta, {
            speed: motion === 'walk' ? 1.2 : motion === 'run' ? 5 : 0,
            alert: motion === 'alert',
            windup: motion === 'windup',
            attacking: motion === 'attack',
            hurt: motion === 'hurt',
            defeated: motion === 'defeat',
          }),
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
  { name: 'rabbit', x: 6.4, z: 1.4, view: 1.6, create: createCritter },
  { name: 'raccoon', x: 7.4, z: 1.1, view: 2, create: createRaccoon },
  { name: 'fox', x: 8.6, z: 1.3, view: 2, create: createFox },
  // The iron axe, made in Blender (see iron-axe.ts).
  { name: 'iron-axe', x: -16.9, z: -3.2, view: 1.4, create: createIronAxe },
  // The layers on dug tunnel walls, painted in Blender (see dug-earth.ts).
  { name: 'dug-earth', x: -16, z: 8, view: 9, create: createDugEarth },
  // A hole cut into real hillside, with the world's own ground (see dug-ground.ts).
  { name: 'dug-ground', x: 0, z: 0, view: 6, alone: true, create: createDugGround },
];

/** Places to look at that are not one exhibit: the pond, the trees, the rocks. */
const VIEWPOINTS: Record<
  string,
  { x: number; y: number; z: number; distance: number; height: number; angle?: number }
> = {
  pond: { x: 9.5, y: 0, z: -6.5, distance: 8, height: 4.5 },
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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  await Promise.all([
    preloadArtTextures(),
    preloadPropModels(),
    preloadFlowerModel(),
    preloadCampfireModels(),
    preloadFoxModel(),
    preloadIronAxe(),
    preloadDugWalls(),
  ]);

  const scene = new THREE.Scene();
  const daylight = addDaylight(scene);
  daylight.update(Number.isFinite(time) ? time : 0.42);
  const fireLights = new FireLights(scene);

  // The inside of a home is its own place (see decision 0055), shown the
  // way the game shows it: a dollhouse with the near walls cut away.
  if (focus === 'home') {
    showHomeInside(renderer, scene, fireLights, daylight, params, time);
    return;
  }
  if (focus === 'moves') {
    scene.add(createGalleryGround([]));
    const { showMoves } = await import('./moves');
    await showMoves(renderer, scene, fireLights, params);
    return;
  }
  if (focus === 'bodies') {
    scene.add(createGalleryGround([]));
    const { showBodies } = await import('./bodies');
    await showBodies(renderer, scene, fireLights, params);
    return;
  }
  if (focus === 'raiders') {
    scene.add(createGalleryGround([]));
    const { showRaiders } = await import('./raiders');
    await showRaiders(renderer, scene, fireLights, params);
    return;
  }

  const scenery: PlacedProp[] = SCENERY.map((entry, index) => ({
    id: index + 1,
    kind: entry.kind,
    x: entry.x,
    z: entry.z,
    rotationY: index * 1.3,
    scale: entry.scale,
  }));
  const alone = EXHIBITS.some((exhibit) => exhibit.name === focus && exhibit.alone === true);
  if (!alone) {
    scene.add(createGalleryGround(scenery));
    scene.add(createPond(POND).group);
    addScenery(scene, scenery);
  }

  const updaters: Array<(deltaSeconds: number) => void> = [];
  const focusedExhibits = EXHIBITS.filter((exhibit) => exhibit.name === focus);
  for (const exhibit of focusedExhibits.length > 0
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

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 300);
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
  if (params.has('height')) height = Number(params.get('height'));
  if (params.has('distance')) distance = Number(params.get('distance'));

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
    daylight.sun.position.set(target.x + 28, 40, target.z + 18);
    daylight.sun.target.position.copy(target);
    daylight.sun.target.updateMatrixWorld();
    for (const update of updaters) update(delta);
    fireLights.update(camera.position);
    renderer.render(scene, camera);
    frames += 1;
    // For screenshots: say so once a few frames have settled.
    if (frames === 8) document.body.dataset.galleryReady = 'true';
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
function createGalleryGround(scenery: readonly PlacedProp[]): THREE.Mesh {
  const size = 80;
  const geometry = new THREE.PlaneGeometry(size, size, 160, 160);
  geometry.rotateX(-Math.PI / 2);
  const shader = createGroundShader({ water: POND, props: scenery });
  const position = geometry.attributes.position;
  if (position === undefined) throw new Error('Plane geometry has no position attribute');
  const floor = new Float32Array(position.count);
  const tint = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const shade = shader.shadeAt(position.getX(i), position.getZ(i), 0);
    floor[i] = shade.floor;
    tint.set(shade.tint, i * 3);
  }
  geometry.setAttribute('floor', new THREE.BufferAttribute(floor, 1));
  // No mountain in the gallery: no rock and no snow.
  geometry.setAttribute('rock', new THREE.BufferAttribute(new Float32Array(position.count), 1));
  geometry.setAttribute('snow', new THREE.BufferAttribute(new Float32Array(position.count), 1));
  geometry.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
  const mesh = new THREE.Mesh(geometry, createGroundMaterial());
  mesh.receiveShadow = true;
  return mesh;
}

function addScenery(scene: THREE.Scene, scenery: readonly PlacedProp[]): void {
  const byKind = new Map<PropKindId, PlacedProp[]>();
  for (const prop of scenery) byKind.set(prop.kind, [...(byKind.get(prop.kind) ?? []), prop]);
  for (const [kind, props] of byKind) {
    const parts = createPropMeshes(PROP_KINDS[kind], props.length);
    props.forEach((prop, index) => placeInstance(parts, index, prop));
    for (const part of parts) {
      part.mesh.instanceMatrix.needsUpdate = true;
      scene.add(part.mesh);
    }
  }
}
