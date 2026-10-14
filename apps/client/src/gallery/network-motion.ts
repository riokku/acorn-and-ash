import * as THREE from 'three/webgpu';
import { SnapshotFlag } from '@acorn/shared';
import { createRemotePlayback } from '../net/remote-playback';
import { createCharacter } from '../scene/character';
import { MoveMemory } from '../scene/character-driver';
import { preloadCharacterModels } from '../scene/character-model';
import { preloadCharacterAnimations } from '../scene/character-animations';
import { createWoodlandCreature } from '../scene/woodland-creatures';
import type { FireLights } from '../scene/fire-light';
import type { RendererSetup } from '../scene/renderer';

interface MotionFrame {
  readonly dt: number;
  readonly playerX: number;
  readonly animalX: number;
  readonly leg: number;
}
declare global {
  interface Window {
    acornRemoteMotion?: MotionFrame[];
    acornAdvanceRemoteMotion?: (dt: number) => void;
  }
}

/** Actual gameplay models driven by the same buffered tracker as players and wildlife. */
export async function showNetworkMotion(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  fireLights: FireLights,
): Promise<void> {
  await Promise.all([preloadCharacterModels(), preloadCharacterAnimations()]);
  const player = createCharacter('knight', 0x82955e);
  const animal = createWoodlandCreature('elk');
  scene.add(player.group, animal.group);
  const actors = [player, animal];
  const trackers = [createRemotePlayback(), createRemotePlayback()];
  const memory = new MoveMemory();
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 300);
  camera.position.set(0, 3.5, 12);
  camera.lookAt(0, 0.9, 0);
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);
  const delays = [0, 45, 10, 60, 5, 35, 0, 55];
  let elapsed = 0,
    next = 0,
    frames = 0,
    last = performance.now();
  window.acornRemoteMotion = [];
  const step = (dt: number): void => {
    elapsed += dt;
    while (next * 100 + delays[next % delays.length]! <= elapsed * 1000) {
      const seconds = next * 0.1;
      const x = Math.sin(seconds * 0.6) * 3;
      const vx = Math.cos(seconds * 0.6) * 1.8;
      trackers.forEach((tracker, index) =>
        tracker.ingest(1000 + next * 100, [
          {
            netId: index + 1,
            x,
            y: 0,
            z: index * -2,
            vx,
            vy: 0,
            vz: 0,
            yaw: vx >= 0 ? -Math.PI / 2 : Math.PI / 2,
            flags: SnapshotFlag.Moving,
            action: 0,
            actionAge: 0,
            actionHeading: 0,
          },
        ]),
      );
      next++;
    }
    trackers.forEach((tracker, index) => {
      tracker.advance(dt);
      const pose = tracker.poseOf(index + 1);
      if (!pose) return;
      const actor = actors[index]!;
      actor.group.position.set(pose.x, pose.y, pose.z);
      actor.group.rotation.y = pose.yaw;
      if (index === 0)
        player.update(dt, {
          move: memory.view(0, 0, 0, false, 'forward', false),
          locomotion: { speed: pose.travelSpeed, airborne: false },
          groundHeight: () => 0,
        });
      else animal.update(dt, { speed: pose.travelSpeed });
    });
    if (elapsed > 0.5) {
      const samples = window.acornRemoteMotion!;
      samples.push({
        dt,
        playerX: player.group.position.x,
        animalX: animal.group.position.x,
        leg: player.group.getObjectByName('upperlegl')!.quaternion.x,
      });
      if (samples.length > 300) samples.shift();
    }
  };
  window.acornAdvanceRemoteMotion = step;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    step(Math.min(0.1, (now - last) / 1000));
    last = now;
    fireLights.update(camera.position);
    renderer.render(scene, camera);
    if (++frames === 8) document.body.dataset.galleryReady = 'true';
  });
}
