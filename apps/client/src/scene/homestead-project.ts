import { createDisplayTool } from './display-item';
import { createMealModel } from './forest-food';
import type { HomesteadAppearance, ItemId } from '@acorn/shared';
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
  let chestOpen = false;
  let tool: ItemId | null = null;
  let displayedTool: THREE.Group | null = null;
  const bundles: THREE.Group[] = [];
  let setPlots: (plots: readonly GardenPlot[]) => void = () => {};
  let setOpen: (open: boolean) => void = () => {};
  if (kind === 'trailPantry') {
    const chest = createStorageChest();
    group.add(chest.group);
    pieces.push(chest);
    for (let index = 0; index < 5; index++) {
      const bundle = createMealModel('trailRation');
      bundle.group.name = 'stored-supplies';
      bundle.group.position.set(
        ((index % 3) - 1) * 0.25,
        index < 3 ? 0.51 : 0.63,
        index < 3 ? 0.03 : -0.04,
      );
      if (index >= 3) bundle.group.position.x = (index === 3 ? -1 : 1) * 0.13;
      bundle.group.visible = false;
      group.add(bundle.group);
      bundles.push(bundle.group);
      pieces.push(bundle);
    }
    setOpen = (open) => {
      chestOpen = open;
      chest.lid.rotation.x = open ? -0.95 : 0;
      // Dressing is hidden while the lid opens; it never blocks the chest ray target.
      for (const bundle of bundles) bundle.visible = !open && bundle.userData.stocked === true;
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
    setAppearance(appearance: HomesteadAppearance) {
      bundles.forEach((bundle, index) => {
        bundle.userData.stocked = index < appearance.stocked;
        bundle.visible = !chestOpen && index < appearance.stocked;
      });
      setPlots(appearance.plots);
      if (kind === 'trailWorkbench' && appearance.tool !== tool) {
        tool = appearance.tool;
        if (displayedTool !== null) group.remove(displayedTool);
        displayedTool = createDisplayTool(tool);
        displayedTool.position.y += 0.81;
        displayedTool.position.z += 0.03;
        group.add(displayedTool);
      }
    },
    setGardenPlots: (plots: readonly GardenPlot[]) => setPlots(plots),
    setChestOpen: (open: boolean) => setOpen(open),
    dispose() {
      pieces.forEach((piece) => piece.dispose());
    },
  };
}
