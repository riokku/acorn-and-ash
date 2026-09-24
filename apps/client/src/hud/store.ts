import { HEALTH_MAX, HUNGER_MAX, type ItemId } from '@acorn/shared';

import type { RenderBackend } from '../scene/renderer';
import type { ConnectionState } from '../net/connection';

/** Our own line: none out, waiting for a bite, or a fish on right now. */
export type FishingPhase = 'waiting' | 'biting' | null;

/** Everything the HUD shows. */
export interface HudState {
  readonly connection: ConnectionState;
  readonly connectionDetail: string;
  readonly backend: RenderBackend;
  readonly forcedFallback: boolean;
  readonly fps: number;
  readonly pingMs: number;
  readonly playersOnline: number;
  readonly serverTick: number;
  readonly position: { x: number; y: number; z: number };
  readonly correctionCm: number;
  readonly pointerLocked: boolean;
  readonly ready: boolean;
  /** What the server says this player is carrying. */
  readonly carrying: readonly { readonly item: ItemId; readonly count: number }[];
  /** What is within reach right now, if anything. */
  readonly nearbyItem: ItemId | null;
  /** What a nearby patch would gather, if anything is within reach right now. */
  readonly nearGatherSpot: ItemId | null;
  /** The tree a swing would land on, and how many more it needs. */
  readonly aimedTree: { readonly name: string; readonly swingsLeft: number } | null;
  /** The animal a swing would land on, if any. A tree in reach always wins. */
  readonly aimedAnimal: { readonly name: string; readonly hitsLeft?: number } | null;
  /** Whether at least one buildable kind could be placed right where you stand. */
  readonly canBuild: boolean;
  /** Whether the build menu (opened with B) is currently showing. */
  readonly buildMenuOpen: boolean;
  /** Whether a click right now would cast a line. */
  readonly canCast: boolean;
  readonly fishing: FishingPhase;
  /** What just happened to our line, while it is still worth showing. */
  readonly fishingNews: string | null;
  /** How hungry we are, from `HUNGER_MAX` (full) down to zero. */
  readonly hunger: number;
  /** What we last ate, while it is still worth showing. */
  readonly hungerNews: string | null;
  /** How much health we have left, from `HEALTH_MAX` (full) down to zero. */
  readonly health: number;
  /** What just happened to our health, while it is still worth showing. */
  readonly healthNews: string | null;
  /** Whether a charged attack is currently winding up. */
  readonly charging: boolean;
  /** What we last made, while it is still worth showing. */
  readonly craftingNews: string | null;
  /** What we last caught, while it is still worth showing. */
  readonly huntingNews: string | null;
  /** Whether it is currently night out. */
  readonly isNight: boolean;
}

const INITIAL: HudState = {
  connection: 'connecting',
  connectionDetail: '',
  backend: 'unknown',
  forcedFallback: false,
  fps: 0,
  pingMs: 0,
  playersOnline: 0,
  serverTick: 0,
  position: { x: 0, y: 0, z: 0 },
  correctionCm: 0,
  pointerLocked: false,
  ready: false,
  carrying: [],
  nearbyItem: null,
  nearGatherSpot: null,
  aimedTree: null,
  aimedAnimal: null,
  canBuild: false,
  buildMenuOpen: false,
  canCast: false,
  fishing: null,
  fishingNews: null,
  hunger: HUNGER_MAX,
  hungerNews: null,
  health: HEALTH_MAX,
  healthNews: null,
  charging: false,
  craftingNews: null,
  huntingNews: null,
  isNight: false,
};

/**
 * A tiny store the game writes to and React reads from.
 *
 * The game loop runs every frame; React only needs to hear about it a few times
 * a second, so `publish` is called on a timer rather than per frame.
 */
export class HudStore {
  private state: HudState = INITIAL;
  private readonly listeners = new Set<() => void>();

  getSnapshot = (): HudState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  publish(changes: Partial<HudState>): void {
    this.state = { ...this.state, ...changes };
    for (const listener of this.listeners) listener();
  }
}
