import * as THREE from 'three/webgpu';
import { ModelBuilder, placed } from '../art/shapes';
import { paintedMaterial } from '../art/materials';
import type { Character } from './character';

function crown() {
  const stone = paintedMaterial('wood', { tint: 0x8c9b8c, roughness: 1 }),
    gold = paintedMaterial('wood', { tint: 0xb0a174, roughness: 0.8 }),
    moss = paintedMaterial('grass', { tint: 0x60844a, roughness: 1 });
  const b = new ModelBuilder();
  b.add(stone, new THREE.CylinderGeometry(0.23, 0.22, 0.09, 8, 1, true), placed(0, 0.04, 0));
  b.add(gold, new THREE.TorusGeometry(0.225, 0.015, 4, 8), placed(0, 0.04, 0, { x: Math.PI / 2 }));
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5,
      x = Math.cos(a) * 0.225,
      z = Math.sin(a) * 0.225;
    b.add(stone, new THREE.ConeGeometry(0.058, 0.17, 4), placed(x, 0.16, z, { y: a }));
    b.add(moss, new THREE.IcosahedronGeometry(0.04, 0), placed(x, 0.085, z));
  }
  return b.build();
}
/** A carved crown on a slate plinth, matching the sentinel's animated crown. */
export function createSentinelTrophy() {
  const b = new ModelBuilder(),
    stone = paintedMaterial('wood', { tint: 0x7d8c80, roughness: 1 }),
    gold = paintedMaterial('wood', { tint: 0xb0a174, roughness: 0.8 });
  b.add(stone, new THREE.CylinderGeometry(0.32, 0.36, 0.13, 8), placed(0, 0.065, 0));
  b.add(stone, new THREE.CylinderGeometry(0.2, 0.25, 0.38, 8), placed(0, 0.32, 0));
  b.add(gold, new THREE.BoxGeometry(0.18, 0.06, 0.035), placed(0, 0.37, -0.205));
  const base = b.build(),
    top = crown();
  top.group.position.y = 0.55;
  base.group.add(top.group);
  return {
    group: base.group,
    dispose: () => {
      base.dispose();
      top.dispose();
    },
  };
}
/** Bone attachments follow every existing rig animation and survive figure pooling. */
export function dressSentinel(character: Character): void {
  const head = character.group.getObjectByName('head');
  if (head === undefined) return;
  const top = crown();
  top.group.scale.setScalar(1 / 0.6);
  top.group.position.y = 0.5;
  head.add(top.group);
  const b = new ModelBuilder(),
    stone = paintedMaterial('wood', { tint: 0x8b9b8a, roughness: 1 }),
    moss = paintedMaterial('grass', { tint: 0x69804e, roughness: 1 });
  for (const side of [-1, 1]) {
    b.add(
      stone,
      new THREE.IcosahedronGeometry(0.21, 0),
      placed(side * 0.38, 0.05, 0, {}, { x: 1.1, y: 0.55, z: 0.85 }),
    );
    b.add(
      moss,
      new THREE.IcosahedronGeometry(0.12, 0),
      placed(side * 0.38, 0.16, 0, {}, { x: 1, y: 0.35, z: 0.8 }),
    );
  }
  const shoulders = b.build(),
    chest = character.group.getObjectByName('chest');
  shoulders.group.scale.setScalar(1 / 0.6);
  chest?.add(shoulders.group);
  const dispose = character.dispose;
  character.dispose = () => {
    top.dispose();
    shoulders.dispose();
    dispose();
  };
}
