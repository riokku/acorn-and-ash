/** Stable woodland encounter clearings, reserved before homes can settle there. */
export const WOODLAND_ENCOUNTERS = [
  { id: 1008, kind: 'elk', x: -92, z: -74, radius: 8, name: 'Elk grove' },
  { id: 1009, kind: 'curiousRaccoon', x: 105, z: 75, radius: 6, name: 'Raccoon hollow' },
  { id: 1010, kind: 'woodlandGuardian', x: -104, z: 90, radius: 10, name: 'Guardian hollow' },
] as const;
export type WoodlandKind = (typeof WOODLAND_ENCOUNTERS)[number]['kind'];
