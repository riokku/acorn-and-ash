/**
 * Where wildlife lives, in the wilderness beyond the clearing's tree line.
 *
 * A short, hand-placed list for now, the same way `STICK_PATCHES` is: few
 * enough to place by hand clear of the pond, and close enough past the tree
 * line that they are not a long walk from spawn. A den's id travels on the
 * wire as that animal's network id, so it starts well past any player id a
 * world would realistically hand out, and never collides with one.
 */

import type { AnimalKindId } from '../data/animals';

export interface AnimalDen {
  readonly id: number;
  readonly kind: AnimalKindId;
  readonly x: number;
  readonly z: number;
}

export const ANIMAL_DENS: readonly AnimalDen[] = [
  { id: 1001, kind: 'rabbit', x: 0, z: -52 },
  { id: 1002, kind: 'rabbit', x: 48, z: 18 },
  { id: 1003, kind: 'rabbit', x: -45, z: -22 },
  { id: 1004, kind: 'rabbit', x: 12, z: 58 },
  { id: 1005, kind: 'maskedRaccoon', x: -30, z: 40 },
  { id: 1006, kind: 'maskedRaccoon', x: 35, z: -40 },
  // Roughly between the two nearest rabbit dens, but still forty-odd metres
  // from either - well past its own leashRadius (16). A chase only happens
  // if wandering happens to carry them together; see decision 0035.
  { id: 1007, kind: 'fox', x: 22, z: -18 },
];
