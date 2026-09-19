/**
 * The ground the player walks on.
 *
 * Phase 0 is a flat test clearing. The interface is here so that the generated
 * wilderness in Phase 1 can drop in a real height map without touching movement
 * or collision code.
 */
export interface Terrain {
  /** A label used in logs and save files. */
  readonly kind: string;
  /** Ground height in metres at a world position. */
  heightAt(x: number, z: number): number;
}

export function createFlatTerrain(height = 0): Terrain {
  return {
    kind: 'flat',
    heightAt: () => height,
  };
}
