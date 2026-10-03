import * as THREE from 'three/webgpu';
import { ModelBuilder, placed } from '../art/shapes';
import { paintedMaterial, plainMaterial } from '../art/materials';
import { ellipsoid } from './critter';

export type WoodlandCreatureKind = 'elk' | 'curiousRaccoon' | 'woodlandGuardian';
export interface WoodlandPose {
  readonly speed: number;
  readonly alert?: boolean;
  readonly windup?: boolean;
  readonly attacking?: boolean;
  readonly hurt?: boolean;
  readonly defeated?: boolean;
}
export interface WoodlandCreature {
  readonly group: THREE.Group;
  update(deltaSeconds: number, pose: WoodlandPose): void;
  dispose(): void;
}

/** Original articulated forest creatures. Their limbs, necks and tails have
 * separate pivots, with distance-driven gait and blended encounter reactions. */
export function createWoodlandCreature(kind: WoodlandCreatureKind): WoodlandCreature {
  const group = new THREE.Group();
  group.name = kind;
  const torso = new THREE.Group();
  const head = new THREE.Group();
  const neck = new THREE.Group();
  const tail = new THREE.Group();
  const legs: { upper: THREE.Group; lower: THREE.Group; phase: number }[] = [];
  const arms: THREE.Group[] = [];
  const ears: THREE.Group[] = [];
  const eyes: THREE.Group[] = [];
  const owned: { dispose(): void }[] = [];
  const fur = paintedMaterial('fur', {
    tint: kind === 'elk' ? 0xb19770 : 0x948a7b,
    roughness: 1,
    flatShading: true,
  });
  const cream = paintedMaterial('fur', { tint: 0xe3d2b0, roughness: 1, flatShading: true });
  const dark = paintedMaterial('fur', { tint: 0x493b30, roughness: 1, flatShading: true });
  const hoof = plainMaterial(0x342e29, { roughness: 0.9, flatShading: true });
  const eye = plainMaterial(0x171e18, { roughness: 0.25 });
  const glint = plainMaterial(0xf6e9c8, { roughness: 0.2 });
  const antler = paintedMaterial('wood', { tint: 0xcfb991, roughness: 1, flatShading: true });
  const bark = paintedMaterial('bark', { tint: 0x74624b, roughness: 1, flatShading: true });
  const grain = paintedMaterial('wood', { tint: 0xb49a72, roughness: 1, flatShading: true });
  const moss = paintedMaterial('grass', { tint: 0x657e47, roughness: 1, flatShading: true });
  const leaf = plainMaterial(0x8eab68, { roughness: 1, flatShading: true });
  const amber = plainMaterial(0xf4bc69, {
    emissive: 0xe6a44d,
    emissiveIntensity: 0.5,
    roughness: 0.65,
  });
  const fungus = plainMaterial(0xc49165, { roughness: 1, flatShading: true });
  const attach = (parent: THREE.Group, builder: ModelBuilder): THREE.Group => {
    const model = builder.build();
    parent.add(model.group);
    owned.push(model);
    return model.group;
  };
  const pivot = (
    parent: THREE.Group,
    name: string,
    x: number,
    y: number,
    z: number,
  ): THREE.Group => {
    const joint = new THREE.Group();
    joint.name = name;
    joint.position.set(x, y, z);
    parent.add(joint);
    return joint;
  };
  const twig = (
    builder: ModelBuilder,
    material: THREE.Material,
    from: readonly number[],
    to: readonly number[],
    radius: number,
  ): void => {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to),
      direction = b.clone().sub(a);
    builder.add(
      material,
      new THREE.CylinderGeometry(radius * 0.55, radius, direction.length(), 5),
      new THREE.Matrix4().compose(
        a.add(b).multiplyScalar(0.5),
        new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction.normalize(),
        ),
        new THREE.Vector3(1, 1, 1),
      ),
    );
  };
  const limb = (
    parent: THREE.Group,
    x: number,
    y: number,
    z: number,
    length: number,
    width: number,
    material: THREE.Material,
    phase: number,
  ): void => {
    const upper = pivot(parent, 'leg-upper', x, y, z);
    attach(
      upper,
      new ModelBuilder().add(
        material,
        ellipsoid(width, length * 0.34, width * 1.1, 7, 4),
        placed(0, -length * 0.26, 0),
      ),
    );
    const lower = pivot(upper, 'leg-lower', 0, -length * 0.52, 0);
    attach(
      lower,
      new ModelBuilder()
        .add(
          material,
          new THREE.CylinderGeometry(width * 0.55, width * 0.45, length * 0.42, 6),
          placed(0, -length * 0.2, 0),
        )
        .add(
          hoof,
          ellipsoid(width * 0.7, length * 0.06, width * 1.35, 6, 3),
          placed(0, -length * 0.46, -width * 0.35),
        ),
    );
    legs.push({ upper, lower, phase });
  };
  group.add(torso);
  let restingHeight: number;
  if (kind === 'elk') {
    restingHeight = 1.27;
    torso.position.y = restingHeight;
    attach(
      torso,
      new ModelBuilder()
        .add(fur, ellipsoid(0.32, 0.43, 0.77, 10, 6), placed(0, 0.05, 0))
        .add(cream, ellipsoid(0.28, 0.29, 0.15, 8, 5), placed(0, 0.03, 0.66))
        .add(dark, ellipsoid(0.28, 0.48, 0.31, 8, 5), placed(0, 0.14, -0.5)),
    );
    for (const side of [-1, 1]) {
      limb(torso, side * 0.22, -0.1, -0.48, 1.17, 0.11, fur, side === -1 ? 0 : Math.PI);
      limb(torso, side * 0.23, -0.05, 0.51, 1.2, 0.13, fur, side === -1 ? Math.PI : 0);
    }
    neck.position.set(0, 0.2, -0.56);
    torso.add(neck);
    attach(
      neck,
      new ModelBuilder()
        .add(dark, ellipsoid(0.21, 0.46, 0.25, 8, 5), placed(0, 0.3, -0.1, { x: -0.42 }))
        .add(fur, ellipsoid(0.16, 0.38, 0.18, 8, 5), placed(0, 0.4, -0.2, { x: -0.42 })),
    );
    head.position.set(0, 0.68, -0.32);
    neck.add(head);
    attach(
      head,
      new ModelBuilder()
        .add(fur, ellipsoid(0.18, 0.2, 0.28, 8, 5), placed(0, 0, -0.03))
        .add(dark, ellipsoid(0.13, 0.12, 0.16, 8, 4), placed(0, -0.07, -0.26))
        .add(hoof, ellipsoid(0.11, 0.07, 0.08, 7, 4), placed(0, -0.045, -0.39))
        .add(cream, ellipsoid(0.1, 0.05, 0.15, 7, 4), placed(0, -0.14, -0.22)),
    );
    for (const side of [-1, 1]) {
      const ear = pivot(head, 'ear', side * 0.14, 0.1, 0.05);
      ears.push(ear);
      attach(
        ear,
        new ModelBuilder()
          .add(
            fur,
            ellipsoid(0.21, 0.055, 0.09, 7, 4),
            placed(side * 0.11, 0, 0, { z: side * 0.25 }),
          )
          .add(cream, ellipsoid(0.14, 0.027, 0.063, 6, 3), placed(side * 0.12, 0.03, -0.014)),
      );
      const rack = new ModelBuilder();
      const points = [
        [side * 0.12, 0.15, 0.04],
        [side * 0.21, 0.45, 0.14],
        [side * 0.41, 0.7, 0.24],
        [side * 0.58, 0.94, 0.2],
      ];
      for (let i = 0; i < points.length - 1; i++)
        twig(rack, antler, points[i]!, points[i + 1]!, 0.04 - i * 0.008);
      twig(rack, antler, points[1]!, [side * 0.24, 0.59, -0.12], 0.025);
      twig(rack, antler, points[2]!, [side * 0.47, 1.02, 0.05], 0.023);
      twig(rack, antler, points[2]!, [side * 0.66, 0.81, 0.4], 0.022);
      attach(head, rack);
    }
    tail.position.set(0, 0.04, 0.75);
    torso.add(tail);
    attach(
      tail,
      new ModelBuilder().add(cream, ellipsoid(0.09, 0.13, 0.11, 7, 4), placed(0, -0.04, 0.02)),
    );
  } else if (kind === 'curiousRaccoon') {
    restingHeight = 0.3;
    torso.position.y = restingHeight;
    attach(
      torso,
      new ModelBuilder()
        .add(fur, ellipsoid(0.18, 0.18, 0.28, 9, 5), placed(0, 0, 0.03))
        .add(cream, ellipsoid(0.12, 0.095, 0.2, 8, 4), placed(0, -0.09, -0.025)),
    );
    for (const side of [-1, 1]) {
      limb(torso, side * 0.11, -0.05, -0.15, 0.24, 0.045, dark, side === -1 ? 0 : Math.PI);
      limb(torso, side * 0.12, -0.02, 0.18, 0.27, 0.05, dark, side === -1 ? Math.PI : 0);
    }
    head.position.set(0, 0.06, -0.23);
    torso.add(head);
    attach(
      head,
      new ModelBuilder()
        .add(fur, ellipsoid(0.15, 0.13, 0.14, 9, 5), placed(0, 0.035, 0))
        .add(cream, ellipsoid(0.14, 0.09, 0.11, 8, 4), placed(0, 0.01, -0.05))
        .add(dark, ellipsoid(0.135, 0.035, 0.08, 8, 4), placed(0, 0.045, -0.085))
        .add(cream, ellipsoid(0.065, 0.05, 0.09, 8, 4), placed(0, -0.035, -0.135))
        .add(hoof, ellipsoid(0.025, 0.018, 0.02, 6, 3), placed(0, -0.02, -0.22)),
    );
    for (const side of [-1, 1]) {
      const ear = pivot(head, 'ear', side * 0.1, 0.15, 0.015);
      ears.push(ear);
      attach(
        ear,
        new ModelBuilder()
          .add(dark, ellipsoid(0.05, 0.06, 0.025, 7, 4), placed(0, 0, 0))
          .add(cream, ellipsoid(0.038, 0.045, 0.014, 6, 3), placed(0, 0, -0.02)),
      );
    }
    tail.position.set(0, 0.01, 0.25);
    torso.add(tail);
    const rings = new ModelBuilder();
    for (let ring = 0; ring < 7; ring++) {
      const t = ring / 6;
      rings.add(
        ring % 2 ? dark : fur,
        ellipsoid(0.07 - t * 0.018, 0.07 - t * 0.018, 0.055, 7, 4),
        placed(0, 0.025 + t * t * 0.12, t * 0.32),
      );
    }
    attach(tail, rings);
  } else {
    restingHeight = 1.3;
    torso.position.y = restingHeight;
    attach(
      torso,
      new ModelBuilder()
        .add(bark, ellipsoid(0.46, 0.55, 0.3, 9, 5), placed(0, 0.12, 0))
        .add(grain, ellipsoid(0.28, 0.45, 0.07, 8, 5), placed(0, 0.13, -0.28))
        .add(moss, ellipsoid(0.28, 0.12, 0.25, 8, 4), placed(-0.35, 0.56, 0))
        .add(moss, ellipsoid(0.25, 0.13, 0.24, 8, 4), placed(0.38, 0.5, 0.03)),
    );
    for (const side of [-1, 1]) {
      limb(torso, side * 0.23, -0.27, 0.03, 1.02, 0.18, bark, side === -1 ? 0 : Math.PI);
      const arm = pivot(torso, 'arm', side * 0.5, 0.45, 0);
      arms.push(arm);
      const hand = new ModelBuilder()
        .add(
          bark,
          new THREE.CylinderGeometry(0.13, 0.16, 0.76, 7),
          placed(side * 0.07, -0.32, 0.01, { z: side * 0.15 }),
        )
        .add(moss, ellipsoid(0.17, 0.13, 0.17, 7, 4), placed(side * 0.05, -0.27, 0.03))
        .add(grain, ellipsoid(0.16, 0.21, 0.16, 7, 4), placed(side * 0.11, -0.78, 0));
      for (let finger = 0; finger < 3; finger++)
        twig(
          hand,
          bark,
          [side * 0.11 + (finger - 1) * 0.09, -0.87, -0.05],
          [side * 0.13 + (finger - 1) * 0.12, -1.1, -0.12],
          0.04,
        );
      attach(arm, hand);
    }
    head.position.set(0, 0.83, 0);
    torso.add(head);
    const crown = new ModelBuilder()
      .add(bark, ellipsoid(0.28, 0.33, 0.22, 8, 5), placed(0, 0, 0))
      .add(grain, ellipsoid(0.19, 0.23, 0.045, 8, 5), placed(0, -0.04, -0.2))
      .add(moss, ellipsoid(0.26, 0.08, 0.22, 8, 4), placed(0, 0.27, 0));
    for (const side of [-1, 1]) {
      twig(crown, bark, [side * 0.16, 0.18, 0], [side * 0.37, 0.62, 0.03], 0.07);
      twig(crown, grain, [side * 0.3, 0.49, 0.03], [side * 0.57, 0.57, -0.04], 0.045);
      twig(crown, bark, [side * 0.35, 0.57, 0.03], [side * 0.24, 0.84, 0.01], 0.035);
      crown.add(
        leaf,
        new THREE.OctahedronGeometry(0.12, 0),
        placed(side * 0.34, 0.7, 0.02, { z: side * 0.4 }, { x: 0.5, y: 1, z: 0.4 }),
      );
      crown.add(
        fungus,
        new THREE.ConeGeometry(0.1, 0.045, 7),
        placed(side * 0.26, 0.02, 0.01, { z: (side * Math.PI) / 3 }),
      );
    }
    attach(head, crown);
  }
  for (const side of [-1, 1]) {
    const eyesGroup = pivot(
      head,
      'eye',
      side * (kind === 'elk' ? 0.14 : kind === 'curiousRaccoon' ? 0.06 : 0.12),
      kind === 'curiousRaccoon' ? 0.055 : 0.01,
      kind === 'elk' ? -0.16 : kind === 'curiousRaccoon' ? -0.13 : -0.267,
    );
    eyes.push(eyesGroup);
    const radius = kind === 'curiousRaccoon' ? 0.022 : 0.035;
    attach(
      eyesGroup,
      new ModelBuilder()
        .add(
          kind === 'woodlandGuardian' ? amber : eye,
          ellipsoid(radius, radius * 1.1, radius * 0.55, 7, 4),
          placed(0, 0, 0),
        )
        .add(
          glint,
          ellipsoid(radius * 0.28, radius * 0.28, radius * 0.2, 5, 3),
          placed(-side * radius * 0.15, radius * 0.3, -radius * 0.48),
        ),
    );
  }
  let time = 0,
    gait = 0,
    speed = 0,
    alert = 0,
    wound = 0,
    windup = 0,
    strike = 0,
    defeat = 0;
  return {
    group,
    update(deltaSeconds, pose): void {
      const dt = Math.max(0, Math.min(deltaSeconds, 0.1));
      time += dt;
      const blend = 1 - Math.exp(-dt * 9);
      speed += (Math.max(0, pose.speed) - speed) * blend;
      alert += ((pose.alert || pose.windup ? 1 : 0) - alert) * blend;
      wound += ((pose.hurt ? 1 : 0) - wound) * blend;
      windup += ((pose.windup ? 1 : 0) - windup) * blend;
      strike += ((pose.attacking ? 1 : 0) - strike) * blend;
      defeat = pose.defeated ? Math.min(1, defeat + dt * 1.4) : Math.max(0, defeat - dt * 3);
      const stride = kind === 'elk' ? 2.2 : kind === 'curiousRaccoon' ? 7 : 3;
      gait += speed * dt * stride;
      const moving = Math.min(1, speed / (kind === 'elk' ? 1.1 : 0.7));
      const amplitude = moving * (speed > 3 ? 0.78 : 0.4) * (1 - defeat);
      torso.position.y =
        restingHeight +
        Math.sin(time * 2.1) * 0.008 +
        Math.abs(Math.sin(gait)) * 0.025 * moving -
        defeat * restingHeight * 0.32;
      torso.rotation.x = wound * -0.17 - windup * 0.14 + strike * 0.24 + defeat * 0.45;
      torso.rotation.z = Math.sin(gait) * 0.018 * moving + defeat * 1.1;
      for (const leg of legs) {
        const step = Math.sin(gait + leg.phase);
        leg.upper.rotation.x = step * amplitude + defeat * 0.9;
        leg.lower.rotation.x = Math.max(0, -step) * amplitude * 1.25 - defeat * 0.6;
      }
      const grazing =
        Math.max(0, (Math.sin(time * 0.45 - 2) - 0.3) / 0.7) * (1 - moving) * (1 - alert);
      neck.rotation.x = kind === 'elk' ? -1.85 * grazing - alert * 0.12 : 0;
      head.rotation.y = Math.sin(time * 0.9) * (1 - moving) * 0.12;
      head.rotation.x =
        kind === 'curiousRaccoon'
          ? Math.sin(time * 2.5) * (1 - moving) * 0.07 - alert * 0.1
          : (kind === 'elk' ? grazing * 0.75 : 0) - alert * 0.08;
      tail.rotation.y = Math.sin(time * 1.8 + gait * 0.2) * 0.16;
      tail.rotation.x = kind === 'curiousRaccoon' ? alert * -0.15 : 0;
      ears.forEach((ear, index) => {
        ear.rotation.z = Math.sin(time * 0.7 + index * 2) * 0.06 + alert * (index ? -0.12 : 0.12);
      });
      arms.forEach((arm, index) => {
        arm.rotation.x =
          Math.sin(gait + (index ? 0 : Math.PI)) * amplitude * 0.55 +
          (-windup * 1.8 + strike * 1.05) -
          defeat * 0.5;
        arm.rotation.z = (index ? -1 : 1) * (0.1 + alert * 0.1);
      });
      const blink = time % 5.3 < 0.11 && kind !== 'woodlandGuardian' ? 0.12 : 1;
      eyes.forEach((eyeGroup) => {
        eyeGroup.scale.y = blink;
      });
    },
    dispose(): void {
      owned.forEach((model) => model.dispose());
    },
  };
}
