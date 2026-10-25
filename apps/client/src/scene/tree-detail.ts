/** Distribute detail changes through a band, then keep each tree stable on return steps. */
export function detailedTree(id: number, distance: number, wasNear?: boolean): boolean {
  let hash = Math.imul(id ^ (id >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  const offset = ((hash >>> 0) / 0x1_0000_0000 - 0.5) * 12;
  const threshold = 80 + offset + (wasNear === undefined ? 0 : wasNear ? 4 : -4);
  return distance < threshold;
}
