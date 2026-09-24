import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export interface ModelPart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
}

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

/**
 * Loads a glTF/glb and pulls out its drawable parts, scaled uniformly so the
 * model is `targetHeight` metres tall and grounded with its base at y = 0 -
 * so it drops into this game's placement code (position, yaw, one scale
 * factor) the same as a placeholder shape, whatever size the source pack
 * happened to model it at.
 */
export async function loadScaledModel(url: string, targetHeight: number): Promise<ModelPart[]> {
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;

  const box = new THREE.Box3().setFromObject(root);
  const nativeHeight = box.max.y - box.min.y;
  const scale = nativeHeight > 0 ? targetHeight / nativeHeight : 1;
  const align = new THREE.Matrix4()
    .makeScale(scale, scale, scale)
    .premultiply(new THREE.Matrix4().makeTranslation(0, -box.min.y * scale, 0));

  const parts: ModelPart[] = [];
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geometry = child.geometry.clone();
    geometry.applyMatrix4(child.matrixWorld);
    geometry.applyMatrix4(align);
    const material = Array.isArray(child.material) ? child.material[0] : child.material;
    if (material !== undefined) parts.push({ geometry, material });
  });
  return parts;
}
