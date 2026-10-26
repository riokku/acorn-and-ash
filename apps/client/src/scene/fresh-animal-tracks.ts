import * as THREE from 'three/webgpu';
import { MAX_VISIBLE_TRACKS, freshTrackHint, type FreshAnimalTrack } from '@acorn/shared';
import { ModelBuilder } from '../art/shapes';
import { addAnimalTrack } from './animal-tracks';

/** Uses the existing hoof/paw impressions, projected onto the actual ground at each vertex. */
export class FreshAnimalTracks {
  readonly group = new THREE.Group();
  private readonly drawn = new Map<
    number,
    { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; track: FreshAnimalTrack }
  >();
  private readonly templates = new Map<string, THREE.BufferGeometry>();

  constructor(private readonly heightAt: (x: number, z: number) => number) {
    this.group.name = 'fresh-animal-tracks';
    for (const kind of ['elk', 'paw', 'cedarStag'] as const) {
      const builder = new ModelBuilder();
      const material = new THREE.MeshBasicMaterial();
      for (const side of [-1, 1])
        addAnimalTrack(
          builder,
          material,
          () => 0,
          side * 0.14,
          0,
          0,
          kind === 'paw' ? 'curiousRaccoon' : kind,
        );
      const model = builder.build();
      const mesh = model.group.children[0] as THREE.Mesh;
      this.templates.set(kind, mesh.geometry);
      material.dispose();
    }
  }
  setTracks(tracks: readonly FreshAnimalTrack[]): void {
    const present = new Set<number>();
    for (const track of tracks.slice(-MAX_VISIBLE_TRACKS)) {
      present.add(track.id);
      let drawn = this.drawn.get(track.id);
      if (
        drawn &&
        (drawn.track.x !== track.x || drawn.track.z !== track.z || drawn.track.kind !== track.kind)
      ) {
        this.remove(track.id);
        drawn = undefined;
      }
      if (!drawn) {
        const geometry = this.templates
          .get(track.kind === 'cedarStag' ? 'cedarStag' : track.kind === 'elk' ? 'elk' : 'paw')!
          .clone();
        const material = new THREE.MeshBasicMaterial({
          color: 0x392f24,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `fresh-track-${track.id}`;
        const vertices = geometry.getAttribute('position');
        const c = Math.cos(track.yaw),
          s = Math.sin(track.yaw);
        for (let i = 0; i < vertices.count; i++) {
          const x = vertices.getX(i),
            z = vertices.getZ(i);
          const wx = track.x + x * c + z * s,
            wz = track.z - x * s + z * c;
          vertices.setXYZ(i, wx, this.heightAt(wx, wz) + 0.022, wz);
        }
        vertices.needsUpdate = true;
        geometry.computeBoundingSphere();
        this.group.add(mesh);
        drawn = { mesh, track };
        this.drawn.set(track.id, drawn);
      }
      drawn.track = track;
      drawn.mesh.material.opacity = 0.75 * Math.sqrt(track.freshness);
    }
    for (const id of this.drawn.keys()) if (!present.has(id)) this.remove(id);
  }
  update(seconds: number, erosion: number, snow: boolean): void {
    for (const [id, drawn] of this.drawn) {
      const freshness = Math.max(
        0,
        drawn.track.freshness - (Math.min(0.1, seconds) * erosion) / 180,
      );
      if (freshness <= 0) {
        this.remove(id);
        continue;
      }
      drawn.track = { ...drawn.track, freshness };
      drawn.mesh.material.color.set(
        snow ? 0x8194a8 : drawn.track.kind === 'cedarStag' ? 0x4e5530 : 0x392f24,
      );
      drawn.mesh.material.opacity = 0.75 * Math.sqrt(freshness);
    }
  }
  hintAt(x: number, z: number): string | null {
    let nearest: FreshAnimalTrack | null = null,
      distance = 2.2;
    for (const { track } of this.drawn.values()) {
      const gap = Math.hypot(track.x - x, track.z - z);
      if (gap < distance) {
        nearest = track;
        distance = gap;
      }
    }
    return nearest ? freshTrackHint(nearest) : null;
  }
  clear(): void {
    for (const id of this.drawn.keys()) this.remove(id);
  }
  dispose(): void {
    this.clear();
    for (const geometry of this.templates.values()) geometry.dispose();
    this.group.removeFromParent();
  }
  private remove(id: number): void {
    const drawn = this.drawn.get(id);
    if (!drawn) return;
    drawn.mesh.removeFromParent();
    drawn.mesh.geometry.dispose();
    drawn.mesh.material.dispose();
    this.drawn.delete(id);
  }
}
