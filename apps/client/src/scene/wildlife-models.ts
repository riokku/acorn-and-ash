import type { AnimalKindId } from '@acorn/shared';
import { createCritter } from './critter';
import { createRaccoon } from './raccoon';
import { createFox } from './fox';
import { animateSmallAnimal } from './animal-motion';
import { createWoodlandCreature, type WoodlandCreature } from './woodland-creatures';

/** The existing wildlife figure and its movement controller. */
export function createCritterFor(kind: AnimalKindId, phaseSeed = 0): WoodlandCreature {
  switch (kind) {
    case 'jackrabbit': {
      const model = animateSmallAnimal(createCritter(), 'rabbit', phaseSeed);
      model.group.scale.setScalar(1.15);
      return model;
    }
    case 'coyote': {
      const model = animateSmallAnimal(createFox(), 'coyote', phaseSeed);
      model.group.scale.setScalar(1.45);
      return model;
    }
    case 'rabbit':
      return animateSmallAnimal(createCritter(), 'rabbit', phaseSeed);
    case 'maskedRaccoon':
      return animateSmallAnimal(createRaccoon(), 'maskedRaccoon', phaseSeed);
    case 'fox':
      return animateSmallAnimal(createFox(), 'fox', phaseSeed);
    case 'elk':
    case 'curiousRaccoon':
    case 'woodlandGuardian':
      return createWoodlandCreature(kind);
  }
}
