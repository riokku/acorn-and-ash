import { createSurveyScenery } from '../scene/sunreach-survey';
import { PLAINS_DENS } from '@acorn/shared';
import { createCritterFor } from '../scene/wildlife-models';
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
  const wildlife = PLAINS_DENS.map((den) => {
    const model = createCritterFor(den.kind, den.id);
    model.group.position.set(den.x, terrain.heightAt(den.x, den.z), den.z);
    for (let frame = 0; frame < 60; frame++)
      model.update(1 / 60, { speed: 0, groundHeight: terrain.heightAt });
    if (den.kind === 'coyote' && params.get('pose')) {
      const pose = params.get('pose');
      for (let frame = 0; frame < 60; frame++)
        model.update(1 / 60, {
          speed: 0,
          alert: true,
          windup: pose === 'windup',
          attacking: pose === 'bite',
          recovering: pose === 'recovery',
          groundHeight: terrain.heightAt,
        });
    }
    scene.add(model.group);
    return model;
  });
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
  const survey = createSurveyScenery(terrain);
  scene.add(landmarks.group, survey.group);
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
    survey: {
      label: 'Ranger outpost',
      target: [-203, terrain.heightAt(-203, -192) + 0.5, -200],
      eye: [-195, 25, -182],
    },
    vault: {
      label: 'Survey vault',
      target: [-245, terrain.heightAt(-245, -213) + 0.2, -213],
      eye: [-242, 23, -209],
    },
    tactics: {
      label: 'Coyote tells',
      target: [-258, terrain.heightAt(-258, -200) + 0.35, -200],
      eye: [-255.5, terrain.heightAt(-255.5, -202.2) + 1, -202.2],
    },
    wildlife: {
      label: 'Plains wildlife',
      target: [-258, terrain.heightAt(-258, -200) + 0.5, -200],
      eye: [-253, terrain.heightAt(-253, -195) + 2.5, -195],
    },
    plains: { label: 'Sunreach High Plains', target: [-216, 20, -202], eye: [-163, 49, -143] },
    pass: { label: 'Windbreak Pass', target: [-143, 9, -142], eye: [-109, 22, -114] },
    dunes: { label: 'Amber Dunes', target: [-233, 21, -213], eye: [-207, 30, -174] },
    cedar: { label: 'Cedar bench', target: [111, 13, 43], eye: [82, 30, 82] },
    overlook: { label: 'Lake overlook', target: [174, 17, -80], eye: [149, 35, -40] },
    mountain: { label: 'Mountain switchbacks', target: [-42, 30, 216], eye: [18, 62, 271] },
  } as const;
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Forest viewpoints');
  nav.style.cssText =
    'position:fixed;top:16px;left:16px;padding:12px;border-radius:10px;background:#18291fe8;color:#f9efca;font:14px system-ui;display:flex;gap:8px;flex-wrap:wrap;align-items:center';
  const choose = (name: keyof typeof views) => {
    document.body.dataset.galleryReady = 'false';
    if (scene.fog instanceof THREE.Fog) {
      const plainsView = [
        'plains',
        'pass',
        'dunes',
        'wildlife',
        'survey',
        'vault',
        'tactics',
      ].includes(name);
      scene.fog.near = plainsView ? 85 : 55;
      scene.fog.far = plainsView ? 240 : 120;
    }
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
      survey.dispose();
      for (const model of wildlife) model.dispose();
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
