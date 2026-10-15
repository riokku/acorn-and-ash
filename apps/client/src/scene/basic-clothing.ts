import * as THREE from 'three/webgpu';

const caps = new Map<string, readonly THREE.BufferGeometry[]>();

/** First-pass wool cap fitted to each body's existing head and rig. See decision 0190. */
export function woolCapGeometry(
  heads: readonly THREE.SkinnedMesh[],
): readonly THREE.BufferGeometry[] {
  const source = heads[0];
  if (source === undefined) return [];
  const key = heads.map((mesh) => mesh.geometry.uuid).join(':');
  const cached = caps.get(key);
  if (cached !== undefined) return cached;
  const bounds = new THREE.Box3();
  for (const head of heads) {
    head.geometry.computeBoundingBox();
    if (head.geometry.boundingBox !== null) bounds.union(head.geometry.boundingBox);
  }
  if (bounds.isEmpty()) return [];
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.z) * 0.53;
  const base = bounds.max.y - size.y * 0.17;
  const crown = new THREE.SphereGeometry(radius, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  crown.scale(1, 0.65, 0.98);
  crown.translate(center.x, base, center.z);
  const cuff = new THREE.CylinderGeometry(radius * 1.03, radius * 1.01, radius * 0.22, 12, 1, true);
  cuff.scale(1, 1, 0.98);
  cuff.translate(center.x, base + radius * 0.01, center.z);
  const found = source.skeleton.bones.findIndex((bone) => bone.name.toLowerCase() === 'head');
  const bone = found >= 0 ? found : source.geometry.getAttribute('skinIndex').getX(0);
  for (const geometry of [crown, cuff]) {
    const count = geometry.getAttribute('position').count;
    const indices = new Uint16Array(count * 4);
    const weights = new Float32Array(count * 4);
    for (let vertex = 0; vertex < count; vertex++) {
      indices[vertex * 4] = bone;
      weights[vertex * 4] = 1;
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    geometry.computeVertexNormals();
  }
  caps.set(key, [crown, cuff]);
  return [crown, cuff];
}
