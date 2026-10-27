import * as THREE from 'three/webgpu';
import { lerp, smoothstep } from '@acorn/shared';
import type { WoodlandCreature, WoodlandPose } from './woodland-creatures';

type SmallAnimal = 'rabbit' | 'maskedRaccoon' | 'fox' | 'coyote';

/** Give the existing small-animal figures secondary motion without changing their art. */
export function animateSmallAnimal(
  model: { group: THREE.Group; dispose(): void },
  kind: SmallAnimal,
  phaseSeed = 0,
): WoodlandCreature {
  const root = model.group;
  const motion = new THREE.Group();
  motion.name = `${kind}-motion`;
  motion.add(...root.children.slice());
  root.add(motion);
  let seconds = (phaseSeed * 0.173) % 7,
    phase = ((phaseSeed * 0.61803399) % 1) * Math.PI * 2,
    speed = 0,
    alert = 0,
    tense = 0,
    windup = 0,
    strike = 0,
    defeat = 0,
    recovering = 0,
    pitch = 0,
    roll = 0,
    targetPitch = 0,
    targetRoll = 0,
    probeAge = Infinity;
  return {
    group: root,
    update(deltaSeconds: number, pose: WoodlandPose) {
      const dt = Math.max(0, Math.min(deltaSeconds, 0.1));
      const blend = 1 - Math.exp(-dt * 9);
      // Follow the local ground plane without moving the network root. Sampling
      // at 10 Hz keeps terrain work bounded; orientation still blends every frame.
      probeAge += dt;
      if (pose.groundHeight !== undefined && probeAge >= 0.1) {
        probeAge = 0;
        const sample = pose.groundHeight;
        const span = 0.4 * root.scale.z;
        const x = root.position.x,
          z = root.position.z;
        const forwardX = -Math.sin(root.rotation.y) * span,
          forwardZ = -Math.cos(root.rotation.y) * span;
        const sideX = Math.cos(root.rotation.y) * span,
          sideZ = -Math.sin(root.rotation.y) * span;
        const limit = (rise: number) =>
          Math.max(-0.35, Math.min(0.35, Math.atan(rise / (2 * span))));
        targetPitch = limit(
          sample(x + forwardX, z + forwardZ) - sample(x - forwardX, z - forwardZ),
        );
        targetRoll = limit(sample(x + sideX, z + sideZ) - sample(x - sideX, z - sideZ));
      } else if (pose.groundHeight === undefined) {
        targetPitch = targetRoll = 0;
        probeAge = Infinity;
      }
      pitch += (targetPitch - pitch) * blend;
      roll += (targetRoll - roll) * blend;
      root.rotation.order = 'YXZ';
      root.rotation.x = pitch;
      root.rotation.z = roll;
      const target = pose.defeated ? 0 : Math.max(0, pose.speed);
      const distance = target * dt + ((speed - target) * blend) / 9;
      speed += (target - speed) * blend;
      seconds += dt;
      phase += distance * (kind === 'rabbit' ? 4.5 : 4);
      alert += ((pose.alert ? 1 : 0) - alert) * blend;
      tense += ((pose.tense ? 1 : 0) - tense) * blend;
      windup += ((pose.windup ? 1 : 0) - windup) * blend;
      strike += ((pose.attacking ? 1 : 0) - strike) * blend;
      defeat += ((pose.defeated ? 1 : 0) - defeat) * blend;
      recovering += ((pose.recovering ? 1 : 0) - recovering) * blend;
      const moving = smoothstep(speed, 0, 1.2) * (1 - defeat);
      const wave = kind === 'rabbit' ? Math.max(0, Math.sin(phase)) : Math.sin(phase);
      const lift = wave * wave * moving;
      const height = kind === 'rabbit' ? lerp(0.045, 0.095, smoothstep(speed, 1.4, 5)) : 0.014;
      motion.position.y = lift * height - defeat * 0.06;
      motion.rotation.x =
        wave * lift * (kind === 'rabbit' ? 0.09 : 0.025) - windup * 0.06 + strike * 0.12;
      motion.rotation.z = kind === 'rabbit' ? defeat * 0.8 : wave * lift * 0.018 + defeat * 1.1;
      // Breathing keeps feet at their original base rather than floating the idle body.
      motion.scale.y = 1 + Math.sin(seconds * 2.1) * 0.005 * (1 - moving) * (1 - defeat);
      motion.scale.x = motion.scale.z = 1 + alert * 0.006 + tense * 0.008;
      motion.scale.y -= tense * 0.035 * (1 - moving);
      motion.rotation.x -= tense * 0.04 * (1 - moving);
      if (kind === 'coyote') {
        // Keep feet rooted; the presentation never changes authoritative position or reach.
        motion.scale.y -= windup * 0.12 + recovering * 0.025;
        motion.rotation.x = -windup * 0.035 + strike * 0.045 + recovering * 0.015;
        motion.position.z = -strike * 0.24;
      }
    },
    dispose: () => model.dispose(),
  };
}
