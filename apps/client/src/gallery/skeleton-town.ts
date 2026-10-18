import * as THREE from 'three/webgpu';
import {
  ActionKind,
  SKELETON_TOWN,
  TOWN_DISTRICTS,
  DEFAULT_WORLD_SEED,
  createWildernessTerrain,
} from '@acorn/shared';
import { createSkeletonTown } from '../scene/skeleton-town';
import { preloadRaiderModels } from '../scene/raider-model';
import { preloadCharacterAnimations } from '../scene/character-animations';
import { RaiderFigure } from '../scene/raider-figure';
import { ImpactBursts } from '../scene/impact-bursts';
import { MoveMemory } from '../scene/character-driver';
import type { FireLights } from '../scene/fire-light';
import type { RendererSetup } from '../scene/renderer';

/** Inspect the real settlement modules and animated resident archetypes. */
export async function showSkeletonTown(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  lights: FireLights,
  params: URLSearchParams,
) {
  await Promise.all([preloadRaiderModels(), preloadCharacterAnimations()]);
  const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
  const { x, z } = SKELETON_TOWN;
  const y = terrain.heightAt(x, z);
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.near = 100;
    scene.fog.far = 220;
  }
  scene.add(createSkeletonTown(terrain));
  const bursts = new ImpactBursts();
  scene.add(bursts.group);
  const residents = TOWN_DISTRICTS.flatMap((district) =>
    district.lineup.map((kind, i) => ({
      figure: RaiderFigure.create(kind, scene, bursts),
      memory: new MoveMemory(),
      x: x + district.x + (i - (district.lineup.length - 1) / 2) * 1.8,
      z: z + district.z,
    })),
  );
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 240);
  const target = new THREE.Vector3(x, y + 2, z);
  let angle = Number(params.get('angle') ?? '0.45'),
    distance = Number(params.get('distance') ?? '75'),
    elevation = 0.62;
  const toolbar = document.createElement('div');
  toolbar.style.cssText =
    'position:fixed;top:12px;left:12px;padding:12px;border-radius:8px;background:#18221de8;color:white;font:14px system-ui;z-index:10';
  toolbar.textContent =
    'The Last Bell of Bonehollow · captain + 12 watch · drag to orbit · scroll to zoom ';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Town viewpoint');
  for (const [name, dx, dz, d] of [
    ['Overview', 0, 0, 75],
    ['Gateway', 0, 20, 12],
    ['Market', -13, 1, 18],
    ['Graveyard', 19, -1, 19],
    ['Bell hall', 0, -22, 30],
    ['Captain', -0.9, -18, 6],
  ] as const) {
    const option = document.createElement('option');
    option.textContent = name;
    option.selected = params.get('view') === name.toLowerCase().replace(' ', '-');
    select.append(option);
    option.dataset.view = JSON.stringify([dx, dz, d]);
  }
  select.onchange = () => {
    const [dx, dz, d] = JSON.parse(select.selectedOptions[0]!.dataset.view!) as number[];
    target.set(x + dx!, y + 1.5, z + dz!);
    distance = d!;
    angle = select.selectedOptions[0]!.textContent === 'Graveyard' ? -0.5 : 0.3;
    elevation = 0.35;
  };
  if (params.has('view')) select.dispatchEvent(new Event('change'));
  toolbar.append(select);
  document.body.append(toolbar);
  let drag = false;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    drag = true;
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointerup', () => {
    drag = false;
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (drag) {
      angle -= e.movementX * 0.007;
      elevation = Math.max(0.1, Math.min(1.2, elevation + e.movementY * 0.005));
    }
  });
  renderer.domElement.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      distance = Math.max(5, Math.min(120, distance * Math.exp(e.deltaY * 0.001)));
    },
    { passive: false },
  );
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
  };
  addEventListener('resize', resize);
  resize();
  let frames = 0,
    last = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now(),
      dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    camera.position.set(
      target.x + Math.sin(angle) * distance,
      target.y + distance * elevation,
      target.z + Math.cos(angle) * distance,
    );
    camera.lookAt(target);
    for (const resident of residents)
      resident.figure?.draw(
        dt,
        { x: resident.x, y, z: resident.z, yaw: 0 },
        {
          move: resident.memory.view(ActionKind.Idle, 0, 0, false, 'backward'),
          locomotion: { speed: 0, airborne: false },
          groundHeight: (xx, zz) => terrain.heightAt(xx, zz),
        },
        0,
      );
    bursts.update(dt);
    lights.update(camera.position);
    renderer.render(scene, camera);
    if (++frames === 8) {
      document.body.dataset.galleryReady = 'true';
      if (params.has('still')) renderer.setAnimationLoop(null);
    }
  });
}
