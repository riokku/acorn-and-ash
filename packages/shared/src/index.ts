/**
 * Game rules shared by the client and the server.
 *
 * Everything in here is deterministic, framework-free TypeScript: no DOM, no
 * Worker APIs and no `Math.random()`. If a rule lives here, the client and the
 * server cannot disagree about it.
 */

export * from './constants';

export * from './math/vec3';
export * from './math/angles';
export * from './rng';

export * from './world/terrain';
export * from './world/mountains';
export * from './world/stream';
export * from './world/colliders';
export * from './world/clearing';
export * from './world/water';
export * from './world/lake';
export * from './world/islands';
export * from './world/reeds';
export * from './world/boat';
export * from './world/wilderness';
export * from './world/noise';
export * from './world/animals';
export * from './world/home';

export * from './data/props';
export * from './data/items';
export * from './data/fish';
export * from './data/recipes';
export * from './data/animals';
export * from './data/buildables';
export * from './data/characters';
export * from './data/moves';
export * from './data/gear';
export * from './data/raiders';

export * from './collision/capsule';

export * from './ecs/traits';

export * from './sim/player';
export * from './sim/actions';
export * from './sim/inventory';
export * from './sim/gear';
export * from './sim/pickups';
export * from './sim/gathering';
export * from './sim/dropping';
export * from './sim/chopping';
export * from './sim/tree-fall';
export * from './sim/hunting';
export * from './sim/building';
export * from './sim/rowing';
export * from './sim/crafting';
export * from './sim/regrowth';
export * from './sim/fishing';
export * from './sim/hunger';
export * from './sim/cooking';
export * from './sim/day-night';
export * from './sim/seasons';
export * from './sim/burying';
export * from './sim/animals';
export * from './sim/exploring';
export * from './sim/raids';
export * from './sim/world-sim';
export * from './sim/identity';

export * from './net/messages';
export * from './net/protocol';

export * from './sim/chest';

export * from './data/housing';

export * from './world/encounters';

export * from './data/discoveries';

export * from './sim/build-areas';

export * from './data/tracking';
export * from './data/home-facilities';
export * from './sim/garden';

export * from './sim/home-supplies';

export * from './sim/meals';

export * from './sim/weather';

export * from './sim/decorations';

export * from './sim/expeditions';
export * from './sim/fish-records';
export * from './sim/rare-reel';

export * from './sim/wildfire';
export * from './world/digging';
