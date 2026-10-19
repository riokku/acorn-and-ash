import { buildEncounterSites, buildDiscoverySites, buildDiscoveryLeads } from '@acorn/shared';
import { createEncounterLandmarks } from '../scene/encounter-sites';
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  DEFAULT_WORLD_SEED,
  LAKE,
  STREAM,
  buildTestClearing,
  buildWilderness,
  createWildernessTerrain,
} from '@acorn/shared';
import { buildWildernessScene } from '../scene/wilderness';
import { buildClearingScene } from '../scene/clearing';
import { createGrass } from '../scene/grass';
import { createStreamScene, riverMouthConnections } from '../scene/stream';
import { createLakeScene } from '../scene/lake';
import type { RendererSetup } from '../scene/renderer';
import type { FireLights } from '../scene/fire-light';
import { installBvhRaycasting } from '../scene/bvh';

/** Actual map terrain and forest, with viewpoints for reviewing the walking routes. */
export function showForestTrails(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  lights: FireLights,
  params: URLSearchParams,
): void {
  installBvhRaycasting();
  const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
  const clearing = buildTestClearing(DEFAULT_WORLD_SEED, terrain);
  const wilderness = buildWilderness(DEFAULT_WORLD_SEED, terrain);
  const forest = buildWildernessScene(wilderness, terrain, clearing);
  const home = buildClearingScene(clearing, terrain);
  const grass = createGrass(terrain, clearing, wilderness);
  const river = createStreamScene(STREAM, terrain);
  const lake = createLakeScene(
    LAKE,
    () => false,
    () => LAKE.level,
    riverMouthConnections(STREAM),
    undefined,
    { groundHeightAt: terrain.heightAt },
  );
  scene.add(forest.group, home.group, grass.mesh, river.group, lake.group);
  const sites = buildDiscoverySites(
    buildEncounterSites(
      DEFAULT_WORLD_SEED,
      terrain,
      [...clearing.colliders, ...wilderness.siteColliders],
      clearing.water,
      LAKE,
    ),
  );
  const leads = buildDiscoveryLeads(
    sites,
    terrain,
    [...clearing.colliders, ...wilderness.colliders],
    [...clearing.water, ...LAKE.basin],
  );
  const landmarks = createEncounterLandmarks(params.has('before') ? [] : leads, terrain);
  scene.add(landmarks.group);
  document.body.dataset.discoveryLeads = String(leads.length);
  const lead = leads[0];
  const lx = lead?.markerX ?? 0,
    lz = lead?.markerZ ?? 0,
    ly = terrain.heightAt(lx, lz);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 700);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = params.get('view') === 'clue' ? 1 : 4;
  controls.maxDistance = 180;
  controls.maxPolarAngle = Math.PI * 0.48;
  const views = {
    clue: {
      label: 'Discovery cairn',
      target: [lx, ly + 0.35, lz],
      eye: [lx + 1, ly + 1.2, lz + 1.6],
    },
    cedar: { label: 'Cedar bench', target: [111, 13, 43], eye: [82, 30, 82] },
    overlook: { label: 'Lake overlook', target: [174, 17, -80], eye: [149, 35, -40] },
    mountain: { label: 'Mountain switchbacks', target: [-42, 30, 216], eye: [18, 62, 271] },
  } as const;
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Forest viewpoints');
  nav.style.cssText =
    'position:fixed;top:16px;left:16px;padding:12px;border-radius:10px;background:#18291fe8;color:#f9efca;font:14px system-ui;display:flex;gap:8px;flex-wrap:wrap;align-items:center';
  const choose = (name: keyof typeof views) => {
    const view = views[name];
    controls.target.fromArray(view.target);
    camera.position.fromArray(view.eye);
    controls.update();
  };
  for (const [name, view] of Object.entries(views)) {
    const button = document.createElement('button');
    button.textContent = view.label;
    button.addEventListener('click', () => choose(name as keyof typeof views));
    nav.append(button);
  }
  const hint = document.createElement('span');
  hint.textContent =
    params.get('view') === 'clue'
      ? (lead?.hint ?? 'No suitable clue location')
      : 'Drag to look around · scroll to zoom';
  nav.append(hint);
  document.body.append(nav);
  const asked = params.get('view');
  choose(asked !== null && Object.hasOwn(views, asked) ? (asked as keyof typeof views) : 'cedar');
  let pending = 0;
  let frames = 0;
  const requestDraw = () => {
    if (pending === 0) pending = requestAnimationFrame(draw);
  };
  const draw = () => {
    pending = 0;
    forest.update(0, camera.position);
    grass.update(0, controls.target, true);
    lights.update(camera.position);
    renderer.render(scene, camera);
    if (++frames === 1) requestDraw();
    else document.body.dataset.galleryReady = 'true';
  };
  controls.addEventListener('change', requestDraw);
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    requestDraw();
  };
  window.addEventListener('resize', resize);
  resize();
  window.addEventListener(
    'pagehide',
    () => {
      cancelAnimationFrame(pending);
      controls.dispose();
      window.removeEventListener('resize', resize);
      landmarks.dispose();
      grass.dispose();
      forest.dispose();
      home.dispose();
      river.dispose();
      lake.dispose();
      nav.remove();
    },
    { once: true },
  );
}
