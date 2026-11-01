import * as THREE from 'three/webgpu';
import { expect, it } from 'vitest';

import { bodyShapeOf, showBeard } from '../src/scene/body-shape';

it('knows a dwarf by the mark on its skeleton', () => {
  const adventurer = new THREE.Group();
  adventurer.add(new THREE.Bone());
  expect(bodyShapeOf(adventurer)).toBe('adventurer');
  const dwarf = new THREE.Group();
  const rig = new THREE.Group();
  rig.userData.dwarf = true;
  dwarf.add(rig);
  expect(bodyShapeOf(dwarf)).toBe('dwarf');
});

it('shows only the chosen beard, including one split into parts by glTF', () => {
  const model = new THREE.Group();
  const braids = new THREE.Mesh();
  braids.name = 'dwarf1_Beard_braids';
  const long = new THREE.Group();
  long.name = 'dwarf1_Beard_long';
  const longPart = new THREE.Mesh();
  longPart.name = 'dwarf1_Beard_long_1';
  long.add(longPart);
  const head = new THREE.Mesh();
  head.name = 'dwarf1_Head';
  model.add(braids, long, head);

  showBeard(model, 'long');
  expect([braids.visible, long.visible, longPart.visible, head.visible]).toEqual([
    false,
    true,
    true,
    true,
  ]);
  showBeard(model, null);
  expect([braids.visible, long.visible, head.visible]).toEqual([false, false, true]);
});
