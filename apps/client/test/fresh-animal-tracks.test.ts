import type * as THREE from 'three/webgpu';
import { expect, it, vi } from 'vitest';
import { FreshAnimalTracks } from '../src/scene/fresh-animal-tracks';
const track = { id: 1, kind: 'elk' as const, x: 4, z: 5, yaw: 0.7, freshness: 1 };
it('projects each print vertex onto slopes, ages opacity and gives readable freshness hints', () => {
  const ground = (x: number, z: number) => x * 0.3 + z * 0.2;
  const tracks = new FreshAnimalTracks(ground);
  tracks.setTracks([track]);
  const mesh = tracks.group.children[0] as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshBasicMaterial
  >;
  const vertices = mesh.geometry.getAttribute('position');
  for (let i = 0; i < vertices.count; i++)
    expect(vertices.getY(i)).toBeCloseTo(ground(vertices.getX(i), vertices.getZ(i)) + 0.022, 5);
  expect(tracks.hintAt(4, 5)).toContain('Fresh elk hoofprints');
  tracks.setTracks([{ ...track, freshness: 0.2 }]);
  expect(tracks.hintAt(4, 5)).toContain('Faint');
  const opacity = mesh.material.opacity;
  tracks.update(0.1, 6, true);
  expect(mesh.material.opacity).toBeLessThan(opacity);
  expect(mesh.material.color.getHex()).toBe(0x8194a8);
  expect(tracks.hintAt(50, 50)).toBeNull();
  tracks.dispose();
});
it('reuses unchanged marks, releases expired geometry, and clears when the viewer changes space', () => {
  const tracks = new FreshAnimalTracks(() => 0);
  tracks.setTracks([track]);
  const mesh = tracks.group.children[0] as THREE.Mesh;
  const disposed = vi.spyOn(mesh.geometry, 'dispose');
  tracks.setTracks([{ ...track, freshness: 0.5 }]);
  expect(tracks.group.children[0]).toBe(mesh);
  expect(disposed).not.toHaveBeenCalled();
  tracks.setTracks([]);
  expect(disposed).toHaveBeenCalledOnce();
  tracks.setTracks([track]);
  tracks.clear();
  expect(tracks.group.children).toHaveLength(0);
  tracks.dispose();
});
