/** Dark water should be recognizable near the shared walking limit, with a smooth approach. */
export function depthColourRange(wadingDepth: number): readonly [number, number] {
  return [wadingDepth * 0.4, wadingDepth * 1.2];
}
