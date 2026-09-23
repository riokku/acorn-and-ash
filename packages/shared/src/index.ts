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
export * from './world/colliders';
export * from './world/clearing';
export * from './world/water';
export * from './world/wilderness';
export * from './world/noise';
export * from './world/animals';

export * from './data/props';
export * from './data/items';
export * from './data/fish';
export * from './data/recipes';
export * from './data/animals';

export * from './collision/capsule';

export * from './ecs/traits';

export * from './sim/player';
export * from './sim/inventory';
export * from './sim/pickups';
export * from './sim/gathering';
export * from './sim/chopping';
export * from './sim/crafting';
export * from './sim/regrowth';
export * from './sim/fishing';
export * from './sim/hunger';
export * from './sim/animals';
export * from './sim/world-sim';

export * from './net/messages';
export * from './net/protocol';
