import * as THREE from 'three/webgpu';
import {
  attribute,
  color,
  cos,
  float,
  mix,
  normalLocal,
  positionLocal,
  sin,
  smoothstep,
  time,
  uv,
  vec3,
} from 'three/tsl';
import type { ModelPart } from './model-loading';

/** Shader-only enchantment around the existing watch greatsword. No textures, lights or tick loops. */
export function requiemParts(source: readonly ModelPart[]): ModelPart[] {
  const parts: ModelPart[] = source.map((part) => {
    const original = part.material as THREE.MeshStandardMaterial;
    const material = original.clone();
    if (original.color.getHex() === 0x8ea79c) {
      material.color.setHex(0x695889);
      material.emissive.setHex(0x61418c);
      material.emissiveIntensity = 0.65;
      material.metalness = 0.65;
      material.roughness = 0.28;
    } else if (original.color.getHex() === 0x8a6a3a) {
      material.color.setHex(0xc4a05b);
      material.metalness = 0.7;
    }
    return { geometry: part.geometry, material };
  });
  // A soft, travelling sheen follows the real blade surface, rather than a square billboard.
  for (const part of source) {
    if ((part.material as THREE.MeshStandardMaterial).color.getHex() !== 0x8ea79c) continue;
    const material = glowMaterial();
    const y = positionLocal.y;
    const band = sin(y.mul(23).sub(time.mul(3.5)))
      .mul(0.5)
      .add(0.5)
      .pow(5);
    material.positionNode = positionLocal.add(normalLocal.mul(0.006));
    material.colorNode = mix(color(0x9050ed), color(0x9bf6ff), band).mul(1.8);
    material.opacityNode = smoothstep(0.24, 0.32, y)
      .mul(float(1).sub(smoothstep(1.08, 1.15, y)))
      .mul(band.mul(0.55).add(0.12));
    parts.push({ geometry: part.geometry, material, effect: true });
  }
  // Two tapered strands wind around the blade. Their motion stays in weapon space through a swing.
  for (let strand = 0; strand < 2; strand++) {
    const geometry = new THREE.PlaneGeometry(0.028, 0.88, 1, 40);
    geometry.translate(0, 0.7, 0);
    const material = glowMaterial();
    const y = positionLocal.y;
    const angle = y
      .mul(14)
      .sub(time.mul(2))
      .add(strand * Math.PI);
    material.positionNode = vec3(
      sin(angle).mul(0.105).add(positionLocal.x),
      y,
      cos(angle).mul(0.105),
    );
    material.colorNode = color(strand === 0 ? 0x8eeaff : 0xb06aff).mul(1.6);
    const across = float(1).sub(uv().x.sub(0.5).abs().mul(2)).pow(0.6);
    material.opacityNode = sin(uv().y.mul(Math.PI)).max(0).mul(across).mul(0.65);
    geometry.boundingBox = new THREE.Box3(
      new THREE.Vector3(-0.15, 0.24, -0.15),
      new THREE.Vector3(0.15, 1.16, 0.15),
    );
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
    parts.push({ geometry, material, effect: true });
  }
  const geometry = sparkGeometry();
  const seed = attribute('requiemSeed', 'float');
  const progress = time.mul(0.2).add(seed).fract();
  const angle = progress.mul(18).add(seed.mul(37)).add(time.mul(0.9));
  const radius = sin(seed.mul(19)).mul(0.025).add(0.13);
  const material = glowMaterial();
  material.positionNode = positionLocal.add(
    vec3(sin(angle).mul(radius), progress.mul(0.9).add(0.24), cos(angle).mul(radius)),
  );
  material.colorNode = mix(color(0xae6cff), color(0xb4fbff), seed).mul(2);
  material.opacityNode = smoothstep(0, 0.12, progress)
    .mul(float(1).sub(smoothstep(0.65, 1, progress)))
    .mul(0.85);
  parts.push({ geometry, material, effect: true });
  return parts;
}
function glowMaterial(): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  material.name = 'First Bell enchantment';
  return material;
}
/** Twelve tiny sparks share one draw. The shader supplies their orbit and upward drift. */
function sparkGeometry(): THREE.BufferGeometry {
  const spark = new THREE.IcosahedronGeometry(0.012, 0);
  const points = spark.getAttribute('position');
  const positions: number[] = [],
    seeds: number[] = [];
  for (let i = 0; i < 12; i++)
    for (let v = 0; v < points.count; v++) {
      positions.push(points.getX(v), points.getY(v), points.getZ(v));
      seeds.push(i / 12);
    }
  spark.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('requiemSeed', new THREE.Float32BufferAttribute(seeds, 1));
  geometry.boundingBox = new THREE.Box3(
    new THREE.Vector3(-0.18, 0.22, -0.18),
    new THREE.Vector3(0.18, 1.17, 0.18),
  );
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
  return geometry;
}
