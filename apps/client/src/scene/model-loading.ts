import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export interface ModelPart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
}

/** A loaded-once template; instantiate a playable copy with `instantiateAnimatedModel`. */
export interface AnimatedModel {
  readonly root: THREE.Group;
  readonly clips: readonly THREE.AnimationClip[];
}

export interface AnimatedModelInstance {
  readonly root: THREE.Group;
  readonly mixer: THREE.AnimationMixer;
  readonly actions: readonly THREE.AnimationAction[];
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

/**
 * Loads a glTF/glb that carries its own animation clips and keeps its live
 * node hierarchy intact, unlike `loadScaledModel`: baking each mesh's world
 * transform into flattened geometry (as that does) would destroy the very
 * per-node transforms an `AnimationMixer` needs to play keyframes back.
 * Assumes the model was authored at the scale it should appear in the game.
 *
 * This loads one shared template. Every place that wants to actually show
 * and play it (e.g. one burning campfire among several) needs its own copy
 * of the node hierarchy - a `THREE.Object3D` can only sit in one place in
 * the scene at a time - so call `instantiateAnimatedModel` on the result for
 * each instance rather than adding `root` to the scene directly.
 */
export async function loadAnimatedModel(url: string): Promise<AnimatedModel> {
  const gltf = await loader.loadAsync(url);
  return { root: gltf.scene, clips: gltf.animations };
}

/** A playable, independently-animatable copy of a template loaded by `loadAnimatedModel`. */
export function instantiateAnimatedModel(template: AnimatedModel): AnimatedModelInstance {
  const root = template.root.clone(true);
  const mixer = new THREE.AnimationMixer(root);
  const actions = template.clips.map((clip) => mixer.clipAction(clip));
  return { root, mixer, actions };
}
