import { expect, it } from 'vitest';
import { createCabin } from '../src/scene/cabin';
import { createLargeCabin } from '../src/scene/large-cabin';
import { InstancedMesh } from 'three/webgpu';
import { triangleCount } from '../src/art/shapes';
import { BUILDABLE_KINDS } from '@acorn/shared';
it.each([
  { make: () => createCabin(), capacity: 20 },
  { make: createLargeCabin, capacity: 50 },
])('shows every stored log individually up to $capacity', ({ make, capacity }) => {
  const home = make();
  try {
    const pile = home.group.getObjectByName('cabin-log-storage')!;
    for (let count = 0; count <= capacity; count++) {
      home.setStoredLogs?.(count);
      expect(pile.visible).toBe(count > 0);
      expect(
        pile.children.reduce(
          (total, log) => total + (log instanceof InstancedMesh ? log.count : 0),
          0,
        ),
      ).toBe(count);
    }
    expect(triangleCount(home.group)).toBeLessThanOrEqual(
      capacity === 20
        ? BUILDABLE_KINDS.cabin.triangleBudget
        : BUILDABLE_KINDS.largeCabin.triangleBudget,
    );
    home.setStoredLogs?.(0);
    expect(pile.visible).toBe(false);
  } finally {
    home.dispose();
  }
});
