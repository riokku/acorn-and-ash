import { advanceForestWind, forestWind } from '../art/forest-wind';
import * as THREE from 'three/webgpu';
import { PROP_KINDS, treeAtGeneration, type PropKindId } from '@acorn/shared';
import { createPropMeshes, placeInstance } from '../scene/props';
import type { RendererSetup } from '../scene/renderer';
import type { FireLights } from '../scene/fire-light';

/** Inspect the shipped near/distant trees, including their usually hidden trunk joins. */
export function showTreeModels(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  lights: FireLights,
  params: URLSearchParams,
): void {
  const kinds = ['pine', 'birch', 'oak', 'maple', 'alder'] as const;
  const names = ['Douglas-fir', 'Western redcedar', 'Sitka spruce', 'Bigleaf maple', 'Red alder'];
  const requested = params.get('kind');
  const chosen = kinds.find((kind) => kind === requested);
  const variant = Math.max(0, Math.min(2, Math.floor(Number(params.get('variant')) || 0)));
  const close = params.has('close');
  const growth = params.has('growth')
    ? Math.max(0, Math.min(255, Number(params.get('growth')) || 0))
    : undefined;
  const displayed: readonly PropKindId[] = chosen ? [chosen] : kinds;
  displayed.forEach((kind, index) => {
    const parts = createPropMeshes(PROP_KINDS[kind], 1, params.has('distant'), undefined, variant);
    const tree = {
      id: index + 1,
      kind,
      x: (index - (displayed.length - 1) / 2) * 10,
      z: 0,
      scale: 1,
      rotationY: 0,
    };
    placeInstance(parts, 0, growth === undefined ? tree : treeAtGeneration(1, tree, 1, growth));
    for (const part of parts) {
      if (params.has('bark') && !part.mesh.geometry.getAttribute('uv')) continue;
      scene.add(part.mesh);
    }
  });
  const toolbar = document.createElement('div');
  toolbar.style.cssText =
    'position:fixed;top:12px;left:12px;padding:10px;background:#17221de6;color:white;font:14px system-ui;z-index:10;border-radius:8px';
  toolbar.textContent = 'Tree models · drag to orbit · scroll to zoom ';
  const select = document.createElement('select');
  for (const [value, text] of [['', 'All species'], ...kinds.map((kind, i) => [kind, names[i]!])]) {
    const option = document.createElement('option');
    option.value = value!;
    option.textContent = text!;
    option.selected = value === (chosen ?? '');
    select.append(option);
  }
  select.onchange = () => {
    const url = new URL(location.href);
    url.searchParams.set('kind', select.value);
    location.href = url.href;
  };
  select.setAttribute('aria-label', 'Tree species');
  toolbar.append(select);
  for (const [key, label, values] of [
    ['variant', 'Shape', ['0', '1', '2']],
    ['season', 'Season', ['spring', 'summer', 'autumn', 'winter']],
    ['growth', 'Growth', ['', '0', '127', '255']],
  ] as const) {
    const control = document.createElement('select');
    control.setAttribute('aria-label', label);
    for (const value of values) {
      const option = document.createElement('option');
      option.value = value;
      const growthNames: Record<string, string> = {
        '': 'Original tree',
        '0': 'Sapling',
        '127': 'Half grown',
        '255': 'Mature regrowth',
      };
      option.textContent =
        key === 'growth'
          ? growthNames[value]!
          : key === 'variant'
            ? `Shape ${Number(value) + 1}`
            : value;
      option.selected =
        value === (params.get(key) ?? (key === 'variant' ? '0' : key === 'growth' ? '' : 'summer'));
      control.append(option);
    }
    control.onchange = () => {
      const url = new URL(location.href);
      if (control.value) url.searchParams.set(key, control.value);
      else url.searchParams.delete(key);
      location.href = url.href;
    };
    toolbar.append(control);
  }
  for (const [key, text] of [
    ['distant', 'Distant mesh'],
    ['close', 'Trunk close-up'],
  ] as const) {
    const label = document.createElement('label');
    const control = document.createElement('input');
    control.type = 'checkbox';
    control.checked = params.has(key);
    control.onchange = () => {
      const url = new URL(location.href);
      if (control.checked) url.searchParams.set(key, '');
      else url.searchParams.delete(key);
      if (key === 'close' && control.checked && !chosen) url.searchParams.set('kind', 'pine');
      location.href = url.href;
    };
    label.append(control, text);
    toolbar.append(label);
  }
  document.body.append(toolbar);
  const target = new THREE.Vector3(0, close ? 1.7 : 7, 0);
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 160);
  let angle = Number(params.get('angle') ?? '0.8');
  let distance = close ? 3.4 : chosen ? 27 : 60;
  let elevation = 0.15;
  let drag = false;
  renderer.domElement.addEventListener('pointerdown', (event) => {
    drag = true;
    renderer.domElement.setPointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener('pointerup', () => {
    drag = false;
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!drag) return;
    angle -= event.movementX * 0.007;
    elevation = Math.max(-0.2, Math.min(1, elevation + event.movementY * 0.005));
  });
  renderer.domElement.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      distance = Math.max(1.2, Math.min(90, distance * Math.exp(event.deltaY * 0.001)));
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
  let frames = 0;
  let last = performance.now();
  const windPreview = params.has('wind');
  if (windPreview) {
    forestWind.seconds.value = Number(params.get('at')) || 0;
    forestWind.strength.value = params.has('before') ? 0 : 0.8;
    toolbar.append(' · Shared breeze');
  }
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    if (windPreview && !params.has('still') && !params.has('before'))
      advanceForestWind(
        (now - last) / 1000,
        0.8,
        matchMedia('(prefers-reduced-motion: reduce)').matches,
      );
    last = now;
    camera.position.set(
      Math.sin(angle) * distance,
      target.y + elevation * distance,
      Math.cos(angle) * distance,
    );
    camera.lookAt(target);
    lights.update(camera.position);
    renderer.render(scene, camera);
    if (++frames === 8) {
      document.body.dataset.galleryReady = 'true';
      if (params.has('still')) renderer.setAnimationLoop(null);
    }
  });
}
