import * as THREE from 'three/webgpu';

import { paintedMaterial, plainMaterial } from '../art/materials';
import { ModelBuilder, logGeometry, placed, uvAround } from '../art/shapes';

/**
 * Small things lying about the clearing to be found or gathered (see
 * decision 0053), built from the same painted parts as everything else.
 */

/**
 * A little burlap sack sitting on the grass: a plump body slumped a little
 * under its own weight, gathered at the neck and tied with a cord, with the
 * cloth above the tie flared out in a ruffle. The very first thing anybody
 * finds, so it stays plain and friendly rather than competing with the axe
 * or the rod for attention.
 */
export function createSatchel(): { group: THREE.Group; dispose(): void } {
  const burlap = paintedMaterial('burlap', { roughness: 1, flatShading: true });
  const ruffle = paintedMaterial('burlap', { tint: 0xd8c7a6, roughness: 1, flatShading: true });
  const cord = plainMaterial(0x7a5a3a, { roughness: 1, flatShading: true });

  // A lathe-turned profile: wide and slumped at the bottom, narrowing to a
  // pinched neck, then flaring out again above the tie.
  const profile = [
    [0.0, 0.0],
    [0.12, 0.01],
    [0.17, 0.06],
    [0.175, 0.12],
    [0.15, 0.18],
    [0.09, 0.23],
    [0.045, 0.26],
  ].map(([r, y]) => new THREE.Vector2(r ?? 0, y ?? 0));
  const body = new THREE.LatheGeometry(profile, 12);
  body.scale(1, 1, 0.85);
  uvAround(body, 0.22, 0.17);

  const flare = [
    [0.04, 0.26],
    [0.07, 0.3],
    [0.085, 0.33],
    [0.05, 0.34],
    [0.0, 0.332],
  ].map(([r, y]) => new THREE.Vector2(r ?? 0, y ?? 0));
  const top = new THREE.LatheGeometry(flare, 9);
  uvAround(top, 0.2, 0.08);

  return (
    new ModelBuilder()
      .add(burlap, body, placed(0, 0, 0))
      .add(ruffle, top, placed(0, 0, 0))
      .add(
        cord,
        new THREE.TorusGeometry(0.047, 0.01, 4, 10),
        placed(0, 0.262, 0, { x: Math.PI / 2 }),
      )
      // The loose end of the cord, hanging down the front.
      .add(
        cord,
        new THREE.CylinderGeometry(0.007, 0.007, 0.09, 4),
        placed(0.02, 0.22, -0.05, { x: 0.5, z: 0.2 }),
      )
      .build()
  );
}

/**
 * A little pile of fallen branches: a few forked sticks lying crossed on the
 * grass, their bark on and their broken ends showing.
 */
export function createStickPileModel(): { group: THREE.Group; dispose(): void } {
  const bark = paintedMaterial('bark', { roughness: 1 });
  const ends = paintedMaterial('logEnd', { tint: 0xe8d4b4, roughness: 1 });
  const builder = new ModelBuilder();
  const sticks = [
    { turn: 0.3, length: 0.58, radius: 0.024, y: 0.03 },
    { turn: -0.45, length: 0.5, radius: 0.02, y: 0.05 },
    { turn: 0.95, length: 0.46, radius: 0.022, y: 0.07 },
    { turn: 2.1, length: 0.36, radius: 0.016, y: 0.03 },
  ];
  sticks.forEach((stick, index) => {
    const log = logGeometry(stick.length, stick.radius, {
      sides: 5,
      seed: 600 + index,
      wobble: 0.15,
      taper: 0.35,
      tile: 0.35,
      ringEvery: 0.2,
    });
    const matrix = placed(0, stick.y, 0, { y: stick.turn, z: (index % 2 === 0 ? 1 : -1) * 0.08 });
    builder.add(bark, log.side, matrix).add(ends, log.ends, matrix);
    // A short twig forking off each of the longer ones.
    if (stick.length > 0.45) {
      const twig = logGeometry(0.16, stick.radius * 0.5, {
        sides: 4,
        seed: 620 + index,
        tile: 0.3,
      });
      const along = stick.length * 0.2;
      const twigMatrix = placed(
        Math.cos(-stick.turn) * along,
        stick.y + 0.01,
        Math.sin(-stick.turn) * along,
        { y: stick.turn + 0.6 },
      ).multiply(new THREE.Matrix4().makeTranslation(0.08, 0, 0));
      builder.add(bark, twig.side, twigMatrix).add(ends, twig.ends, twigMatrix);
    }
  });
  return builder.build();
}

/**
 * A felled tree's stump: a short, flaring trunk with bark on and roots
 * reaching into the grass, and a sawn top showing its growth rings. Made to
 * the stump's own radius and height, for the instanced scenery to scale.
 */
export function stumpGeometries(
  radius: number,
  height: number,
): { bark: THREE.BufferGeometry; top: THREE.BufferGeometry } {
  const sides = 10;
  const rings = [
    { y: -0.02, r: 1.28 },
    { y: 0.08, r: 1.08 },
    { y: 0.35, r: 0.98 },
    { y: 1, r: 0.94 },
  ];
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const circumference = Math.PI * 2 * radius;
  rings.forEach((ring, index) => {
    for (let corner = 0; corner <= sides; corner++) {
      const angle = (corner / sides) * Math.PI * 2;
      // Roots push the base out in a few places.
      const root = index === 0 ? 1 + 0.25 * Math.max(0, Math.cos(angle * 3 + 0.4)) : 1;
      const bump = 1 + 0.04 * Math.sin(angle * 5 + index * 2.1);
      const r = radius * ring.r * root * bump;
      positions.push(Math.cos(angle) * r, ring.y * height, Math.sin(angle) * r);
      uvs.push(((corner / sides) * circumference) / 0.6, (ring.y * height) / 0.6);
    }
  });
  const stride = sides + 1;
  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let corner = 0; corner < sides; corner++) {
      const a = ring * stride + corner;
      indices.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
    }
  }
  const bark = new THREE.BufferGeometry();
  bark.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  bark.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  bark.setIndex(indices);
  bark.computeVertexNormals();

  // The sawn top, with the rings picture laid on it.
  const top = new THREE.CircleGeometry(radius * 0.94, sides);
  top.rotateX(-Math.PI / 2);
  top.translate(0, height, 0);
  const topUv = top.attributes.uv;
  const topPosition = top.attributes.position;
  if (topUv !== undefined && topPosition !== undefined) {
    for (let i = 0; i < topUv.count; i++) {
      topUv.setXY(
        i,
        0.5 + (topPosition.getX(i) / (radius * 0.94)) * 0.45,
        0.5 + (topPosition.getZ(i) / (radius * 0.94)) * 0.45,
      );
    }
  }
  return { bark, top };
}
