import * as THREE from 'three/webgpu';

/**
 * The see-through preview of a piece being placed (see decision 0052): the
 * very same model the piece will have once built, washed over in one soft
 * colour, with an outline on the ground of the room it needs - green where it
 * fits, red where it does not.
 *
 * Built from whatever the real piece would be, handed in, so a new buildable
 * kind gets a preview for free and the two can never look different.
 */
export interface BuildGhost {
  readonly group: THREE.Group;
  /** Stand it here, turned this way, coloured for whether it fits. */
  show(x: number, z: number, yaw: number, fits: boolean): void;
  hide(): void;
  dispose(): void;
}

/** Only the shape of the model it is made from matters: its own materials and lights are set aside. */
export interface GhostSource {
  readonly group: THREE.Group;
  dispose(): void;
}

/** The room a piece needs on the ground, in the same terms as its footprint. */
export interface GhostFootprint {
  readonly radius: number;
  /** Half the length of its middle line, along its own length; zero for anything round. */
  readonly halfLength: number;
}

const FITS_COLOR = 0x8fe388;
const BLOCKED_COLOR = 0xff6f61;
/** How far out the ground outline's line sits past the footprint's edge, and how thick it is. */
const OUTLINE_WIDTH = 0.05;
/** Just clear of the ground and anything flat laid on it, like a path stone. */
const OUTLINE_HEIGHT = 0.04;

export function createBuildGhost(source: GhostSource, footprint: GhostFootprint): BuildGhost {
  const group = new THREE.Group();
  group.visible = false;

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: FITS_COLOR,
    // A little light of its own, so it still reads clearly at night.
    emissive: FITS_COLOR,
    emissiveIntensity: 0.35,
    roughness: 1,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: FITS_COLOR,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const fillMaterial = new THREE.MeshBasicMaterial({
    color: FITS_COLOR,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Every mesh keeps its shape but wears the ghost's material instead; a
  // light (a lantern's glow) would light up the ground under a piece that is
  // not there yet, so it goes entirely.
  const lights: THREE.Light[] = [];
  source.group.traverse((object) => {
    if (object instanceof THREE.Light) {
      lights.push(object);
      return;
    }
    if (object instanceof THREE.Mesh) {
      object.material = bodyMaterial;
      object.castShadow = false;
      object.receiveShadow = false;
      // Drawn after the ground outline, so the outline shows through it.
      object.renderOrder = 2;
    }
  });
  for (const light of lights) light.removeFromParent();
  group.add(source.group);

  const outlineGeometry = new THREE.ShapeGeometry(footprintRing(footprint), 12);
  const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
  outline.rotation.x = -Math.PI / 2;
  outline.position.y = OUTLINE_HEIGHT;
  outline.renderOrder = 1;
  group.add(outline);

  const fillGeometry = new THREE.ShapeGeometry(footprintShape(footprint, 0), 12);
  const fill = new THREE.Mesh(fillGeometry, fillMaterial);
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = OUTLINE_HEIGHT - 0.005;
  fill.renderOrder = 1;
  group.add(fill);

  let showingFits: boolean | null = null;

  return {
    group,
    show: (x, z, yaw, fits) => {
      group.position.set(x, 0, z);
      group.rotation.y = yaw;
      group.visible = true;
      if (fits === showingFits) return;
      showingFits = fits;
      const color = fits ? FITS_COLOR : BLOCKED_COLOR;
      bodyMaterial.color.setHex(color);
      bodyMaterial.emissive.setHex(color);
      outlineMaterial.color.setHex(color);
      fillMaterial.color.setHex(color);
    },
    hide: () => {
      group.visible = false;
    },
    dispose: () => {
      source.dispose();
      outlineGeometry.dispose();
      fillGeometry.dispose();
      bodyMaterial.dispose();
      outlineMaterial.dispose();
      fillMaterial.dispose();
    },
  };
}

/**
 * A footprint's outline as a flat shape, in the plane the ground outline is
 * drawn in before it is laid down: a circle for anything round, and a
 * rounded-off strip (two half circles joined by straight sides) for a fence.
 * `grow` pushes the edge out by that much all round.
 */
function footprintShape(footprint: GhostFootprint, grow: number): THREE.Shape {
  const radius = footprint.radius + grow;
  const half = footprint.halfLength;
  const shape = new THREE.Shape();
  // Model X runs along the piece's length; the shape's Y becomes the
  // ground's -Z once it is laid flat, which is symmetrical here anyway.
  shape.absarc(half, 0, radius, -Math.PI / 2, Math.PI / 2, false);
  shape.absarc(-half, 0, radius, Math.PI / 2, (Math.PI * 3) / 2, false);
  return shape;
}

/** Just the edge of a footprint, as a thin band, by cutting the footprint out of a slightly bigger one. */
function footprintRing(footprint: GhostFootprint): THREE.Shape {
  const ring = footprintShape(footprint, OUTLINE_WIDTH);
  const inner = footprintShape(footprint, 0);
  ring.holes.push(new THREE.Path(inner.getPoints(24).reverse()));
  return ring;
}
