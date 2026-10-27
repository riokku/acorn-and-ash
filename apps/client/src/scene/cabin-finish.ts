import * as THREE from 'three/webgpu';
import { ModelBuilder, placed, plankGeometry } from '../art/shapes';

/** Small, merged pieces of joinery; the established footprint and roof stay intact. */
export function cabinFinish(materials: {
  cedar: THREE.Material;
  trim: THREE.Material;
  iron: THREE.Material;
  glass: THREE.Material;
  stone: THREE.Material;
}) {
  const detail = new ModelBuilder();
  const foundation = new ModelBuilder();
  // Individual bevelled footing stones catch light along the existing masonry plinth.
  const block = (x: number, z: number, width: number, depth: number, seed: number) => {
    const shape = new THREE.Shape();
    const w = width / 2,
      h = 0.105,
      bevel = 0.035;
    shape.moveTo(-w + bevel, -h);
    shape.lineTo(w - bevel, -h);
    shape.lineTo(w, -h + bevel);
    shape.lineTo(w, h - bevel);
    shape.lineTo(w - bevel, h);
    shape.lineTo(-w + bevel, h);
    shape.lineTo(-w, h - bevel);
    shape.lineTo(-w, -h + bevel);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    // A very small height variation keeps the courses from reading as factory bricks.
    foundation.add(
      materials.stone,
      geometry,
      placed(x, 0.11 + Math.sin(seed * 2.3) * 0.008, z - depth / 2),
    );
  };
  for (const z of [-1.84, 1.84])
    for (let i = 0; i < 8; i++) block(-1.79 + i * 0.51, z, 0.49, 0.17, i + z);
  for (const x of [-2.04, 2.04])
    for (let i = 0; i < 6; i++) block(x, -1.5 + i * 0.6, 0.17, 0.57, i + x);

  // Real inset reveals, projecting sills and divided panes on the plain side/rear walls.
  const window = (x: number, z: number, yaw: number) => {
    const transform = placed(x, 1.44, z, { y: yaw });
    const part = (
      material: THREE.Material,
      width: number,
      height: number,
      depth: number,
      px: number,
      py: number,
      pz: number,
    ) =>
      detail.add(
        material,
        plankGeometry(width, height, depth, 'y', 0.9, 730),
        transform.clone().multiply(placed(px, py, pz)),
      );
    part(materials.iron, 1.02, 0.88, 0.08, 0, 0, 0);
    part(materials.glass, 0.82, 0.66, 0.03, 0, 0, 0.055);
    for (const side of [-1, 1]) {
      part(materials.trim, 0.09, 0.86, 0.14, side * 0.46, 0, 0.08);
      part(materials.cedar, 1.06, 0.09, 0.15, 0, side * 0.39, 0.08);
    }
    part(materials.trim, 0.045, 0.68, 0.065, 0, 0, 0.1);
    part(materials.trim, 0.86, 0.045, 0.065, 0, 0, 0.1);
    part(materials.cedar, 1.16, 0.08, 0.28, 0, -0.47, 0.14);
    // Weather cap projects beyond the reveal; two supports sit beneath the sill.
    part(materials.cedar, 1.18, 0.07, 0.25, 0, 0.49, 0.11);
    for (const side of [-1, 1]) part(materials.trim, 0.08, 0.19, 0.15, side * 0.36, -0.57, 0.08);
  };
  window(-2.12, -0.2, -Math.PI / 2);
  window(0.4, -1.94, Math.PI);

  // A split cedar drip cap and little corbels give the doorway a finished reveal.
  detail.add(
    materials.cedar,
    plankGeometry(1.3, 0.11, 0.34, 'x', 0.9, 760),
    placed(-0.575, 2.23, 1.98, { x: -0.12 }),
  );
  for (const x of [-1.11, -0.04]) {
    detail.add(
      materials.trim,
      plankGeometry(0.09, 0.18, 0.18, 'y', 0.9, 761),
      placed(x, 2.1, 1.94, { x: -0.3 }),
    );
  }
  // Pegged door straps, with visible hammered heads rather than a featureless bar.
  for (const y of [0.55, 1.68])
    for (const x of [-0.96, -0.77])
      detail.add(
        materials.iron,
        new THREE.CylinderGeometry(0.018, 0.02, 0.018, 6),
        placed(x, y, 2.018, { x: Math.PI / 2 }),
      );

  // Louvered attic vents sit on either side of the existing king post.
  for (const x of [-2.14, 2.14]) {
    const facing = x < 0 ? -1 : 1;
    for (const z of [-0.43, 0.43]) {
      detail.add(materials.iron, new THREE.BoxGeometry(0.025, 0.3, 0.28), placed(x, 3.08, z));
      for (let row = 0; row < 3; row++)
        detail.add(
          materials.cedar,
          plankGeometry(0.08, 0.055, 0.3, 'z', 0.8, 750 + row),
          placed(x + facing * 0.03, 3.0 + row * 0.085, z, { z: facing * 0.15 }),
        );
    }
  }
  const joinery = detail.build(),
    footing = foundation.build();
  joinery.group.name = 'cabin-finished-joinery';
  footing.group.name = 'cabin-footing-stones';
  return { joinery, footing };
}
