import type { AnimalKindId } from '@acorn/shared';
import { createCritter } from './critter';
import { createRaccoon } from './raccoon';
import { createFox } from './fox';
import { animateSmallAnimal } from './animal-motion';
import { createDeerModel } from './deer-model';
import { createWoodlandCreature, type WoodlandCreature } from './woodland-creatures';

/** The coyote is drawn as a fox grown this much. */
const COYOTE_SIZE = 1.45;

/** The existing wildlife figure and its movement controller. */
export function createCritterFor(kind: AnimalKindId, phaseSeed = 0): WoodlandCreature {
  switch (kind) {
    case 'cedarStag': {
      const model = createWoodlandCreature('elk', 'cedar', phaseSeed);
      model.group.name = 'Old Cedar Stag';
      model.group.scale.setScalar(1.15);
      return model;
    }
    case 'jackrabbit': {
      const model = animateSmallAnimal(createCritter(), 'rabbit', phaseSeed);
      model.group.scale.setScalar(1.15);
      return model;
    }
    case 'coyote': {
      const model = animateSmallAnimal(createFox(COYOTE_SIZE), 'coyote', phaseSeed);
      model.group.scale.setScalar(COYOTE_SIZE);
      return model;
    }
    case 'rabbit':
      return animateSmallAnimal(createCritter(), 'rabbit', phaseSeed);
    case 'maskedRaccoon':
      return animateSmallAnimal(createRaccoon(), 'maskedRaccoon', phaseSeed);
    case 'fox':
      return animateSmallAnimal(createFox(), 'fox', phaseSeed);
    case 'elk': {
      // Polyfork's Forest Deer once it has loaded; the cedar stag keeps its own figure.
      const deer = createDeerModel();
      return deer === undefined
        ? createWoodlandCreature(kind, undefined, phaseSeed)
        : animateSmallAnimal(deer, 'elk', phaseSeed);
    }
    case 'curiousRaccoon':
    case 'woodlandGuardian':
      return createWoodlandCreature(kind, undefined, phaseSeed);
  }
}
