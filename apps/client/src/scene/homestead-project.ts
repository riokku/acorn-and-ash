import * as THREE from 'three/webgpu';
import { HOME_FACILITIES, type HomesteadProject, type GardenPlot } from '@acorn/shared';
import { createHomeFacilities } from './home-facilities';
import { createHomeDecoration } from './home-decoration';
import { createStorageChest } from './storage-chest';
/** Reuses the actual table, workbench fittings, chest and growing boxes already in cabins. */
export function createHomesteadProject(kind: HomesteadProject) {
  const group = new THREE.Group();
  group.name = kind;
  const pieces: { dispose(): void }[] = [];
  let setPlots: (plots: readonly GardenPlot[]) => void = () => {};
  let setOpen: (open: boolean) => void = () => {};
  if (kind === 'trailPantry') {
    const chest = createStorageChest();
    group.add(chest.group);
    pieces.push(chest);
    setOpen = (open) => {
      chest.lid.rotation.x = open ? -0.95 : 0;
    };
  } else {
    const facility = kind === 'trailWorkbench' ? 'workbench' : 'garden';
    const fittings = createHomeFacilities('largeCabin', facility);
    const spot = HOME_FACILITIES[facility];
    fittings.group.position.set(-spot.x, kind === 'trailWorkbench' ? 0.085 : 0, -spot.z);
    group.add(fittings.group);
    pieces.push(fittings);
    setPlots = fittings.setGardenPlots;
    if (kind === 'trailWorkbench') {
      const table = createHomeDecoration('timberTable');
      group.add(table.group);
      pieces.push(table);
    }
  }
  return {
    group,
    setGardenPlots: (plots: readonly GardenPlot[]) => setPlots(plots),
    setChestOpen: (open: boolean) => setOpen(open),
    dispose() {
      pieces.forEach((piece) => piece.dispose());
    },
  };
}
