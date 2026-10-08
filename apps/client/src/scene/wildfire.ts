import * as THREE from 'three/webgpu';
import { attribute, float, mix, sin, smoothstep, uv, vec3 } from 'three/tsl';
import {
  createRng,
  fireLifetime,
  hashSeed,
  LIGHTNING_INTERVAL_MS,
  type WildfireView,
} from '@acorn/shared';
import { flameModelTemplate } from './campfire-models';
import { instantiateAnimatedModel } from './model-loading';
import { createFireGlow } from './fire-light';

const VISIBLE_FIRES = 8;
const PUFFS = 28;
const EMBERS = 24;
const WISPS = 36;

/** Reuses the authored flame animation, with drifting smoke, ember trails and pooled firelight. */
export function createWildfireArt() {
  const group = new THREE.Group();
  group.name = 'wildfire';
  const template = flameModelTemplate();
  const pools = Array.from({ length: VISIBLE_FIRES }, () => {
    const root = new THREE.Group();
    const flames = Array.from({ length: 5 }, (_, i) => {
      if (!template) return null;
      const instance = instantiateAnimatedModel(template);
      for (const action of instance.actions) action.play();
      instance.mixer.setTime(i * 0.37);
      root.add(instance.root);
      return instance;
    });
    const light = createFireGlow(0xff823a, 38, 18);
    root.add(light.anchor);
    group.add(root);
    return { root, flames, light };
  });
  const smokeGeometry = new THREE.PlaneGeometry(1, 1);
  const lives = new Float32Array(VISIBLE_FIRES * PUFFS);
  smokeGeometry.setAttribute('puffLife', new THREE.InstancedBufferAttribute(lives, 1));
  const smokeMaterial = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const p = uv().sub(0.5).mul(2);
  // Overlapping, soft lobes break up the edge without a sprite texture or hard polygon outline.
  const radial = p
    .length()
    .add(sin(p.x.mul(9).add(p.y.mul(5))).mul(0.075))
    .add(sin(p.y.mul(12)).mul(0.045));
  const life = attribute('puffLife', 'float');
  smokeMaterial.opacityNode = float(1)
    .sub(smoothstep(0.25, 1, radial))
    .mul(smoothstep(0, 0.13, life))
    .mul(float(1).sub(smoothstep(0.5, 1, life)))
    .mul(0.28);
  smokeMaterial.colorNode = mix(vec3(0.24, 0.18, 0.16), vec3(0.48, 0.5, 0.54), life);
  const smoke = new THREE.InstancedMesh(smokeGeometry, smokeMaterial, VISIBLE_FIRES * PUFFS);
  smoke.frustumCulled = false;
  smoke.renderOrder = 2;
  group.add(smoke);
  // Soft emissive wisps add hot cores and translucent orange edges around the authored flames.
  const wispGeometry = new THREE.PlaneGeometry(1, 1);
  const wispLives = new Float32Array(VISIBLE_FIRES * WISPS);
  wispGeometry.setAttribute('wispLife', new THREE.InstancedBufferAttribute(wispLives, 1));
  const wispMaterial = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const wispLife = attribute('wispLife', 'float');
  const curl = p.x.add(sin(p.y.mul(7).add(wispLife.mul(12))).mul(0.16));
  const edge = curl.mul(curl).mul(1.8).add(p.y.mul(p.y));
  const core = float(1).sub(smoothstep(0.03, 0.7, edge));
  wispMaterial.colorNode = mix(
    vec3(1.3, 0.11, 0.012),
    vec3(2.1, 1.25, 0.3),
    core.mul(float(1).sub(wispLife.mul(0.55))),
  );
  wispMaterial.opacityNode = float(1)
    .sub(smoothstep(0.08, 1, edge))
    .mul(smoothstep(0, 0.12, wispLife))
    .mul(float(1).sub(smoothstep(0.45, 1, wispLife)))
    .mul(0.65);
  const wisps = new THREE.InstancedMesh(wispGeometry, wispMaterial, VISIBLE_FIRES * WISPS);
  wisps.frustumCulled = false;
  group.add(wisps);
  const emberGeometry = new THREE.SphereGeometry(0.025, 4, 3);
  const emberMaterial = new THREE.MeshBasicMaterial({
    color: 0xffbd67,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const embers = new THREE.InstancedMesh(emberGeometry, emberMaterial, VISIBLE_FIRES * EMBERS);
  embers.frustumCulled = false;
  group.add(embers);
  const boltGeometry = new THREE.BufferGeometry();
  const boltPositions = new Float32Array(120 * 3);
  boltGeometry.setAttribute('position', new THREE.BufferAttribute(boltPositions, 3));
  const boltMaterial = new THREE.LineBasicMaterial({
    color: 0xdbeaff,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const bolt = new THREE.LineSegments(boltGeometry, boltMaterial);
  bolt.frustumCulled = false;
  bolt.visible = false;
  group.add(bolt);
  const flash = createFireGlow(0xc8dfff, 180, 65, 0);
  flash.anchor.visible = false;
  group.add(flash.anchor);
  const dummy = new THREE.Object3D();
  let state: WildfireView = { fires: [], lightning: null, now: 0 };
  let lastSerial = -1;
  let boltAge = 10;
  let seconds = 0;
  let sinceState = 0;

  function strike(x: number, y: number, z: number, serial: number) {
    const rng = createRng(hashSeed('lightning-shape', serial));
    let at = 0;
    let previous = new THREE.Vector3(x + 4, y + 35, z - 3);
    for (let i = 1; i <= 22; i++) {
      const t = i / 22;
      const next = new THREE.Vector3(
        x + (1 - t) * (4 + rng.nextRange(-2, 2)),
        y + 35 * (1 - t),
        z + (1 - t) * (-3 + rng.nextRange(-2, 2)),
      );
      previous.toArray(boltPositions, at);
      at += 3;
      next.toArray(boltPositions, at);
      at += 3;
      if (i % 5 === 0) {
        next.toArray(boltPositions, at);
        at += 3;
        boltPositions[at++] = next.x + rng.nextRange(-4, 4);
        boltPositions[at++] = next.y - 4;
        boltPositions[at++] = next.z + rng.nextRange(-3, 3);
      }
      previous = next;
    }
    boltGeometry.setDrawRange(0, at / 3);
    boltGeometry.attributes.position!.needsUpdate = true;
    flash.anchor.position.set(x, y + 2, z);
    boltAge = 0;
  }

  return {
    group,
    setState(next: WildfireView) {
      state = next;
      sinceState = 0;
      if (next.lightning && next.lightning.serial !== lastSerial) {
        const lightning = next.lightning;
        lastSerial = lightning.serial;
        if (next.now - lightning.serial * LIGHTNING_INTERVAL_MS < 2000)
          strike(lightning.x, lightning.y, lightning.z, lightning.serial);
      }
    },
    visibleEffects: () => ({
      fires: pools.filter((pool) => pool.root.visible).length,
      smoke: smoke.count,
      embers: embers.count,
      lightning: bolt.visible,
    }),
    update(delta: number, camera: THREE.Camera, indoors: boolean, reducedMotion: boolean) {
      const dt = Math.min(delta, 0.1);
      seconds += reducedMotion ? 0 : dt;
      sinceState += dt;
      boltAge += dt;
      group.visible = !indoors;
      bolt.visible = !reducedMotion && boltAge < 0.32;
      boltMaterial.opacity = Math.max(0, 1 - boltAge / 0.32);
      flash.anchor.visible = bolt.visible;
      flash.brightness = boltMaterial.opacity;
      const fires = state.fires
        .filter((fire) => Math.hypot(fire.x - camera.position.x, fire.z - camera.position.z) < 100)
        .sort(
          (a, b) =>
            Math.hypot(a.x - camera.position.x, a.z - camera.position.z) -
            Math.hypot(b.x - camera.position.x, b.z - camera.position.z),
        )
        .slice(0, VISIBLE_FIRES);
      smoke.count = fires.length * PUFFS;
      wisps.count = fires.length * WISPS;
      embers.count = reducedMotion ? 0 : fires.length * EMBERS;
      for (let slot = 0; slot < VISIBLE_FIRES; slot++) {
        const pool = pools[slot]!;
        const fire = fires[slot];
        pool.root.visible = fire !== undefined;
        if (!fire) continue;
        const age = (state.now - fire.startedAt) / 1000 + sinceState;
        const intensity =
          Math.min(1, (age + 1) / 5) * Math.min(1, Math.max(0, fireLifetime(fire) - age) / 7);
        const height = Math.min(9, fire.height);
        pool.root.position.set(fire.x, fire.y, fire.z);
        pool.light.anchor.position.y = height * 0.4;
        pool.light.brightness = intensity;
        pool.light.update(reducedMotion ? 0 : dt);
        for (let i = 0; i < pool.flames.length; i++) {
          const flame = pool.flames[i];
          if (!flame) continue;
          const angle = i * 2.4;
          const spread = fire.kind === 'building' ? fire.radius * 0.7 : 0.35 + i * 0.13;
          flame.root.position.set(
            Math.sin(angle) * spread,
            i * height * 0.12,
            Math.cos(angle) * spread,
          );
          flame.root.rotation.y = angle;
          flame.root.scale.set(1.6 * intensity, (1.6 + height * 0.25) * intensity, 1.6 * intensity);
          flame.mixer.update(reducedMotion ? 0 : dt * (0.85 + i * 0.07));
        }
        for (let i = 0; i < WISPS; i++) {
          const phase = (seconds * (0.38 + (i % 4) * 0.04) + i / WISPS) % 1;
          const angle = i * 2.399 + Math.sin(seconds * 0.6 + i) * 0.25;
          const radius = (fire.kind === 'building' ? fire.radius * 0.65 : 0.5) + phase * 0.6;
          dummy.position.set(
            fire.x + Math.sin(angle) * radius + phase * phase * 0.8,
            fire.y + 0.4 + phase * height * 0.7 + (i % 3) * height * 0.1,
            fire.z + Math.cos(angle) * radius,
          );
          dummy.quaternion.copy(camera.quaternion);
          dummy.rotateZ(Math.sin(seconds * 1.5 + i) * 0.13);
          dummy.scale
            .set((1.4 + (i % 3) * 0.25) * (1 - phase * 0.65), 2.3 + phase * 1.8, 1)
            .multiplyScalar(intensity);
          dummy.updateMatrix();
          wisps.setMatrixAt(slot * WISPS + i, dummy.matrix);
          wispLives[slot * WISPS + i] = phase;
        }
        for (let i = 0; i < PUFFS; i++) {
          const phase = (((seconds * 0.09 + i / PUFFS + fire.id * 0.13) % 1) + 1) % 1;
          const swirl = seconds * 0.4 + i * 2.399;
          const radius = 0.4 + phase * 2.4;
          dummy.position.set(
            fire.x + phase * phase * 8 + Math.sin(swirl) * radius,
            fire.y + height * 0.3 + phase * 13,
            fire.z + phase * 2 + Math.cos(swirl) * radius * 0.5,
          );
          dummy.quaternion.copy(camera.quaternion);
          dummy.rotateZ(i * 1.7 + seconds * 0.06);
          dummy.scale.setScalar((1.2 + phase * 5) * intensity);
          dummy.updateMatrix();
          smoke.setMatrixAt(slot * PUFFS + i, dummy.matrix);
          lives[slot * PUFFS + i] = phase;
        }
        for (let i = 0; i < EMBERS; i++) {
          const phase = (((seconds * (0.24 + (i % 3) * 0.04) + i / EMBERS) % 1) + 1) % 1;
          dummy.position.set(
            fire.x + Math.sin(i * 3 + seconds * 1.6) * phase + phase * 3,
            fire.y + height * 0.3 + phase * 7,
            fire.z + Math.cos(i * 2 + seconds) * phase,
          );
          dummy.quaternion.identity();
          dummy.scale.set(1, 2.5, 1).multiplyScalar(intensity * Math.sin(phase * Math.PI));
          dummy.updateMatrix();
          embers.setMatrixAt(slot * EMBERS + i, dummy.matrix);
        }
      }
      wisps.instanceMatrix.needsUpdate = true;
      wispGeometry.attributes.wispLife!.needsUpdate = true;
      smoke.instanceMatrix.needsUpdate = true;
      smokeGeometry.attributes.puffLife!.needsUpdate = true;
      embers.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      for (const pool of pools) {
        pool.light.dispose();
        for (const flame of pool.flames) {
          flame?.mixer.stopAllAction();
          if (flame) flame.mixer.uncacheRoot(flame.root);
        }
      }
      flash.dispose();
      wisps.dispose();
      smoke.dispose();
      embers.dispose();
      for (const item of [
        wispGeometry,
        wispMaterial,
        smokeGeometry,
        smokeMaterial,
        emberGeometry,
        emberMaterial,
        boltGeometry,
        boltMaterial,
      ])
        item.dispose();
      group.removeFromParent();
    },
  };
}
