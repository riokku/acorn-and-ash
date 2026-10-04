import type { HomeDecoration } from '@acorn/shared';
import type { ForestWeather } from '@acorn/shared';
import { NO_MEAL, type MealState } from '@acorn/shared';
import { emptyGarden, type GardenState, type DiscoverySite } from '@acorn/shared';
import type { PickupNotice } from './pickup-notice';
import { HEALTH_MAX, HUNGER_MAX, type ItemId, type HomeKind, type ChestSlot } from '@acorn/shared';

import type { RenderBackend } from '../scene/renderer';
import type { ConnectionState } from '../net/connection';
import type { Compass } from './cache-compass';
import type { HotbarPins } from './hotbar-layout';
import type { ToastView } from './toasts';

/** Our own line: none out, waiting for a bite, or a fish on right now. */
export type FishingPhase = 'waiting' | 'biting' | null;

/**
 * The big words across the top when a skeleton raid turns up, is fought
 * off, or is over (see decision 0063). `key` is new for every banner, so
 * one following straight on from another still plays in from the start.
 */
export interface RaidBanner {
  readonly key: number;
  readonly tone: 'danger' | 'victory' | 'calm';
  readonly title: string;
  readonly detail: string;
}

/** Everything the HUD shows. */
export interface HudState {
  readonly connection: ConnectionState;
  readonly connectionDetail: string;
  readonly backend: RenderBackend;
  readonly forcedFallback: boolean;
  /** Chosen on the Home screen before the game ever connects. */
  readonly playerName: string;
  readonly fps: number;
  readonly pingMs: number;
  readonly playersOnline: number;
  readonly serverTick: number;
  readonly position: { x: number; y: number; z: number };
  readonly correctionCm: number;
  /** Whether the curtain has been dismissed - gates the HUD the same way `pointerLocked` used to. */
  readonly playing: boolean;
  readonly ready: boolean;
  /** Completed loading milestones, not an estimate of time remaining. */
  readonly loadingProgress: number;
  readonly loadingStage: string;
  readonly loadingError: string | null;
  /** What the server says this player is carrying. */
  readonly carrying: readonly { readonly item: ItemId; readonly count: number }[];
  /** What the server's Equipped list says this player currently has in hand. */
  readonly equippedItem: ItemId | null;
  /** Which item, if any, the player has dragged onto each of the six hotbar slots. */
  readonly hotbarSlots: HotbarPins;
  /** Whether the inventory panel (opened with I, or its own bag button) is currently showing. */
  readonly inventoryOpen: boolean;
  readonly chestSlots: readonly ChestSlot[] | null;
  readonly chestPending: boolean;
  readonly chestNote: string | null;
  /** What is within reach right now, if anything. */
  readonly nearbyItem: ItemId | null;
  readonly hoveredLoot: {
    readonly name: string;
    readonly count: number;
    readonly detail: string;
    readonly x: number;
    readonly y: number;
  } | null;
  readonly interactionNote: string | null;
  /** Something somebody dropped, if any is within reach right now: what, and how many. */
  readonly nearbyPile: { readonly item: ItemId; readonly count: number } | null;
  /** What a nearby patch would gather, if anything is within reach right now. */
  readonly nearGatherSpot: ItemId | null;
  readonly forestWeather?: ForestWeather;
  /** Whether a cache of our own is close enough right now to dig up. */
  readonly nearBuriedCache: boolean;
  /**
   * The way back to a buried cache of our own, whenever we have one and are
   * not already standing next to it - null the rest of the time, including
   * while `nearBuriedCache` is true, since the dig-up hint already covers
   * that moment.
   */
  readonly ownCacheCompass: Compass | null;
  /** Whether a campfire is close enough right now to light or put out, and which. */
  readonly nearCampfire: 'lit' | 'unlit' | null;
  readonly nearWorkbench: boolean;
  readonly nearGarden: boolean;
  readonly garden: GardenState;
  /** The tree a swing would land on, and how many more it needs. */
  readonly aimedTree: { readonly name: string; readonly swingsLeft: number } | null;
  /** The animal a swing would land on, if any. A tree in reach always wins. */
  readonly aimedAnimal: { readonly name: string; readonly hitsLeft?: number } | null;
  /**
   * The skeleton a swing would land on, if any, and how many blows it still
   * needs. A skeleton in reach beats a tree or an animal (see decision 0063).
   */
  readonly aimedRaider: { readonly name: string; readonly hitsLeft: number } | null;
  /** How many skeletons are still standing within sight of us. */
  readonly raidersInSight: number;
  /** Whether one is close enough to be worth fighting right now. */
  readonly raidersClose: boolean;
  /** A raid turning up, fought off or over, while it is still worth showing. */
  readonly raidBanner: RaidBanner | null;
  /** Whether at least one buildable kind could be placed right where you stand. */
  readonly canBuild: boolean;
  readonly homeStoredSupplies: readonly { readonly item: ItemId; readonly count: number }[];
  readonly homeSkills: number;
  readonly discoveriesFound: number;
  readonly discoveriesClaimed: number;
  readonly discoverySites: readonly DiscoverySite[];
  readonly trackHint: string | null;
  readonly nearbyDiscovery: string | null;
  readonly journalTab: 'craft' | 'discoveries' | 'garden';
  readonly buildAreaRadius: number | null;
  readonly homeKind: HomeKind | null;
  /** Whether the build menu (opened with B) is currently showing. */
  readonly buildMenuOpen: boolean;
  /**
   * The piece being placed, if any (see decision 0052): its name, why a
   * click would not place it right now, and whether it can snap onto others
   * of its kind.
   */
  readonly placing: {
    readonly name: string;
    readonly refusal: string | null;
    readonly canSnap: boolean;
  } | null;
  /** Whether the craft menu (opened with C) is currently showing. */
  readonly craftMenuOpen: boolean;
  /** Whether a click right now would cast a line. */
  readonly canCast: boolean;
  readonly fishing: FishingPhase;
  /** What just happened to our line, while it is still worth showing. */
  readonly fishingNews: string | null;
  /** How hungry we are, from `HUNGER_MAX` (full) down to zero. */
  readonly meal: MealState;
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
  /** What we last cooked over a campfire, while it is still worth showing. */
  readonly cookingNews: string | null;
  /** What we last caught, while it is still worth showing. */
  readonly huntingNews: string | null;
  /** What just happened to a buried cache of ours, while it is still worth showing. */
  readonly cacheNews: string | null;
  /** What we last dropped or destroyed, while it is still worth showing. */
  readonly discardNews: string | null;
  /** Everything just gained, for the toasts down the side (see decision 0061). */
  readonly toasts: readonly ToastView[];
  readonly pickupNotice: PickupNotice | null;
  /** Whether dropping something would work here: out of doors, where it has somewhere to land. */
  readonly canDrop: boolean;
  /** Whether it is currently night out. */
  readonly isNight: boolean;
  /** Whether the big map (M) is open - see decision 0054. */
  readonly mapOpen: boolean;
  /** What a door right here would do, if anything - see decision 0055. */
  readonly door: 'enter' | 'visit' | 'locked' | 'leave' | null;
  /** The home we are inside, if any: whether it is ours, and whether its door is locked. */
  readonly decorations?: readonly HomeDecoration[];
  readonly decorNote?: string | null;
  readonly home: { readonly yours: boolean; readonly locked: boolean } | null;
  /** Sat in the chair or lying in bed right now, if either - see decision 0056. */
  readonly resting: 'chair' | 'bed' | null;
  /** The chair or the bed close enough to sit or lie down on, inside a home. */
  readonly restingNearby: 'chair' | 'bed' | null;
}

const INITIAL: HudState = {
  connection: 'connecting',
  connectionDetail: '',
  backend: 'unknown',
  forcedFallback: false,
  playerName: '',
  fps: 0,
  pingMs: 0,
  playersOnline: 0,
  serverTick: 0,
  position: { x: 0, y: 0, z: 0 },
  correctionCm: 0,
  playing: false,
  ready: false,
  loadingProgress: 0,
  loadingStage: 'Preparing your journey',
  loadingError: null,
  carrying: [],
  equippedItem: null,
  hotbarSlots: [null, null, null, null, null, null],
  inventoryOpen: false,
  chestSlots: null,
  chestPending: false,
  chestNote: null,
  nearbyItem: null,
  hoveredLoot: null,
  interactionNote: null,
  nearbyPile: null,
  nearGatherSpot: null,
  nearBuriedCache: false,
  ownCacheCompass: null,
  nearCampfire: null,
  nearWorkbench: false,
  nearGarden: false,
  garden: { homeId: 0, yours: false, plots: emptyGarden(), reason: 'unavailable' },
  aimedTree: null,
  aimedAnimal: null,
  aimedRaider: null,
  raidersInSight: 0,
  raidersClose: false,
  raidBanner: null,
  canBuild: false,
  homeSkills: 0,
  homeStoredSupplies: [],
  discoveriesFound: 0,
  discoveriesClaimed: 0,
  discoverySites: [],
  trackHint: null,
  nearbyDiscovery: null,
  journalTab: 'craft',
  homeKind: null,
  buildAreaRadius: null,
  buildMenuOpen: false,
  placing: null,
  craftMenuOpen: false,
  canCast: false,
  fishing: null,
  fishingNews: null,
  meal: { ...NO_MEAL },
  hunger: HUNGER_MAX,
  hungerNews: null,
  health: HEALTH_MAX,
  healthNews: null,
  charging: false,
  craftingNews: null,
  cookingNews: null,
  huntingNews: null,
  cacheNews: null,
  discardNews: null,
  toasts: [],
  pickupNotice: null,
  canDrop: true,
  isNight: false,
  mapOpen: false,
  door: null,
  home: null,
  resting: null,
  restingNearby: null,
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
