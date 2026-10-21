import * as THREE from 'three/webgpu';
import {
  buildTestClearing,
  DEFAULT_WORLD_SEED,
  fireLifetime,
  PROP_KINDS,
  propHeight,
  type FireTarget,
  type PlacedProp,
  type Wildfire,
} from '@acorn/shared';
import { buildClearingScene, type TreeAppearance } from '../scene/clearing';
import { installBvhRaycasting } from '../scene/bvh';
import { createWildfireArt } from '../scene/wildfire';
import type { FireLights } from '../scene/fire-light';
import type { RendererSetup } from '../scene/renderer';

/** The shipped scenery and fire pools, across small, ordinary and mature trees. */
export function showTreeFires(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  lights: FireLights,
  params: URLSearchParams,
): void {
  installBvhRaycasting();
  const trees: PlacedProp[] = [
    { id: 1, kind: 'pine', x: -8, z: 0, scale: 0.6, rotationY: 0.4 },
    { id: 2, kind: 'pine', x: 0, z: 0, scale: 1, rotationY: 1.2 },
    { id: 3, kind: 'pine', x: 9, z: -2, scale: 1.8, rotationY: 2 },
    { id: 4, kind: 'oak', x: -16, z: -8, scale: 1, rotationY: 0 },
  ];
  const clearing = buildClearingScene({
    ...buildTestClearing(DEFAULT_WORLD_SEED),
    props: trees,
    pickups: [],
    water: [],
  });
  scene.add(clearing.group);
  const art = createWildfireArt();
  scene.add(art.group);
  const targets: FireTarget[] = trees.slice(0, 3).map((tree) => ({
    id: tree.id,
    kind: 'tree',
    x: tree.x,
    y: 0,
    z: tree.z,
    height: propHeight(PROP_KINDS[tree.kind]) * tree.scale,
    radius: PROP_KINDS.pine.shape.canopyRadius * tree.scale,
  }));
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 200);
  const close = params.has('close');
  const target = new THREE.Vector3(0, close ? 7 : 10, 0);
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
  };
  addEventListener('resize', resize);
  resize();
  let elapsed = 0;
  let last = performance.now();
  let frames = 0;
  const frozen = params.has('at');
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const delta = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!frozen) elapsed += delta;
    const age = frozen ? Math.max(0, Number(params.get('at')) || 0) : elapsed % 80;
    const fires: Wildfire[] = targets
      .filter((tree) => age < fireLifetime(tree))
      .map((tree) => ({
        ...tree,
        startedAt: 1000,
        spread: true,
        generation: 0,
      }));
    const states = new Map<number, TreeAppearance>();
    for (const tree of targets)
      if (age >= fireLifetime(tree))
        states.set(tree.id, {
          generation: 0,
          felled: true,
          burned: true,
          fall: { yaw: 0.7, startedAtMs: 1000 + fireLifetime(tree) * 1000 },
        });
    const state = { fires, lightning: null, now: 1000 + age * 1000 };
    clearing.setWildfire(state);
    clearing.setTreeStates(states, state.now);
    clearing.update(delta);
    art.setState(state);
    if (close) camera.position.set(3, 7, 7);
    else camera.position.set(18, 16, 42);
    camera.lookAt(target);
    art.update(delta, camera, false, matchMedia('(prefers-reduced-motion: reduce)').matches);
    lights.update(camera.position);
    renderer.render(scene, camera);
    if (++frames === 8) {
      document.body.dataset.galleryReady = 'true';
      if (params.has('still')) renderer.setAnimationLoop(null);
    }
  });
}
