import * as THREE from 'three/webgpu';

import {
  ANIMAL_DENS,
  ANIMAL_KINDS,
  BUILDABLE_KINDS,
  BUILDABLE_KIND_ORDER,
  CAST_COOLDOWN_SECONDS,
  CHARGE_SECONDS,
  DEFAULT_WORLD_SEED,
  HEALTH_MAX,
  HUNGER_MAX,
  ITEM_KINDS,
  POND_FISH,
  PROP_KINDS,
  PlayerButton,
  RECIPE_ITEMS,
  SPAWN_POSITION,
  SnapshotFlag,
  animalInReach,
  buildSpotFor,
  buildTestClearing,
  buildWilderness,
  castLanding,
  choppingRuleFor,
  colliderForProp,
  createCollisionWorld,
  createWildernessTerrain,
  dayProgress,
  gatherSpotInReach,
  isNight,
  nearestBuriedCache,
  pickupInReach,
  replaceCollider,
  stumpColliderFor,
  treeAtGeneration,
  treeInReach,
  vec3,
  type AnimalCaught,
  type AnimalKind,
  type AnimalKindId,
  type BuildableKindId,
  type BuildBlocker,
  type BuiltProp,
  type BuriedCacheView,
  type CacheEvent,
  type Clearing,
  type CollisionWorld,
  type CraftedEvent,
  type FishingEvent,
  type HealthEvent,
  type HungerEvent,
  type ItemId,
  type PlacedProp,
  type ServerMessage,
  type SnapshotEntity,
  type Vec3,
} from '@acorn/shared';

import { FollowCamera } from './camera/follow-camera';
import { Controls } from './input/controls';
import { WorldConnection, playerKey, worldSocketUrl, type ConnectionState } from './net/connection';
import { LocalPlayer } from './net/local-player';
import { InterpolatedEntities } from './net/interpolated-entities';
import { buildClearingScene, type ClearingScene } from './scene/clearing';
import { buildWildernessScene, type WildernessScene } from './scene/wilderness';
import { preloadPropModels } from './scene/prop-models';
import { preloadFlowerModel } from './scene/flower-models';
import { colorForPlayer, createCharacter, type Character } from './scene/character';
import { createCampfire, type Campfire } from './scene/campfire';
import { createBuriedCacheMound, type BuriedCacheMound } from './scene/buried-cache';
import { createCabin, type Cabin } from './scene/cabin';
import { createFlowerBed, type FlowerBed } from './scene/flower-bed';
import { createLantern, type Lantern } from './scene/lantern';
import { createCritter, type Critter } from './scene/critter';
import { createRaccoon, type Raccoon } from './scene/raccoon';
import { Floats, type Angler } from './scene/floats';
import { addDaylight, type DaylightRig } from './scene/lighting';
import { installBvhRaycasting } from './scene/bvh';
import { createRenderer, type RendererSetup } from './scene/renderer';
import type { FishingPhase, HudStore } from './hud/store';

const MOUSE_SENSITIVITY = 0.0023;
/** How often the HUD is refreshed. Every frame would be wasted work. */
const HUD_INTERVAL_MS = 200;
/** If the server cannot be reached, let the player walk about on their own. */
const OFFLINE_FALLBACK_MS = 4000;
/**
 * How long news from the water stays on screen.
 *
 * Generous, for the same reason `BITE_GIVE_UP_SECONDS` is: it is measured from
 * the moment the event happens, but showing it depends on the render loop
 * getting a turn, and that loop can stall for a while under load. A short
 * window can elapse entirely during a stall like that, so the message never
 * appears on screen at all rather than merely appearing late.
 */
const NEWS_MS = 8000;
/**
 * How far down the camera looks while a line is out. At the usual angle a
 * float five metres out sits right behind your own back; from a little higher
 * it shows over your head.
 */
const FISHING_CAMERA_PITCH = 0.62;
/** The fish that bites least often, for a word of congratulation. */
const RAREST_FISH = [...POND_FISH].sort((a, b) => a.weight - b.weight)[0]?.item ?? null;

/** Wildlife rides in the same snapshot as everybody else; this is how to tell it apart. */
function isAnimalEntity(entity: SnapshotEntity): boolean {
  return (entity.flags & SnapshotFlag.Animal) !== 0;
}

/** The placeholder model for whatever kind of thing somebody built. */
function createBuiltMesh(kind: BuildableKindId): Campfire | Cabin | FlowerBed | Lantern {
  switch (kind) {
    case 'campfire':
      return createCampfire();
    case 'cabin':
      return createCabin();
    case 'flowerBed':
      return createFlowerBed();
    case 'lantern':
      return createLantern();
  }
}

/** The placeholder model for whichever kind of wildlife this happens to be. */
function createCritterFor(kind: AnimalKindId): Critter | Raccoon {
  switch (kind) {
    case 'rabbit':
      return createCritter();
    case 'maskedRaccoon':
      return createRaccoon();
  }
}

/** A den never moves or changes kind, so this is all a client ever needs to tell them apart. */
function animalKindOf(animalId: number): AnimalKindId | undefined {
  return ANIMAL_DENS.find((den) => den.id === animalId)?.kind;
}

/** What the smoke tests and the browser console can read out of a running game. */
export interface GameDebug {
  selfNetId(): number;
  localPosition(): Vec3;
  remotePlayers(): Array<{ netId: number; x: number; y: number; z: number }>;
  /** Every animal currently in view, wherever this browser last heard it was. */
  animals(): Array<{ id: number; kind: string; x: number; y: number; z: number }>;
  /** What the server says we carry. */
  carrying(): Array<{ item: string; count: number }>;
  /** Which pickups the server says are gone. */
  takenPickups(): number[];
  /** Everything the clearing has lying about to be found. */
  pickups(): Array<{ id: number; item: string; x: number; z: number }>;
  /** Every patch you could gather from, and what it offers. */
  gatherSpots(): Array<{ x: number; z: number; item: string }>;
  /** What is within reach right now, if anything. */
  nearbyItem(): string | null;
  /** What a nearby patch would gather, if anything is within reach right now. */
  nearGatherSpot(): string | null;
  /** Trees the server says are down. */
  felledTrees(): number[];
  /** How many times each changed tree has grown back. */
  treeGenerations(): Array<{ id: number; generation: number }>;
  /** Every tree in the clearing, with what it takes to fell it. */
  trees(): Array<{ id: number; kind: string; x: number; z: number; swingsToFell: number }>;
  /** The tree a swing would land on right now, if any. */
  aimedTree(): { name: string; swingsLeft: number } | null;
  /** The animal a swing would land on right now, if any. A tree in reach always wins. */
  aimedAnimal(): { name: string; hitsLeft?: number } | null;
  /** Whether at least one buildable kind could be placed right where you stand. */
  canBuild(): boolean;
  /** Whether the build menu (opened with B) is currently showing. */
  buildMenuOpen(): boolean;
  /** Everything anybody has built, wherever this browser last heard it was. */
  builtProps(): Array<{ id: number; kind: string; x: number; z: number }>;
  /** Every cache currently buried, wherever this browser last heard it was. */
  buriedCaches(): Array<{ id: number; ownerNetId: number | null; x: number; z: number }>;
  /**
   * Turn the camera towards a spot in the world.
   *
   * The same thing the mouse does, and no more: the camera heading has always
   * been the client's to choose, and is sent to the server with every input.
   * Smoke tests use it so they can walk somewhere without steering by hand.
   */
  faceTowards(x: number, z: number): void;
  /** The pond, as the circles it is made of. */
  pond(): Array<{ x: number; z: number; radius: number }>;
  /** Whether a click right now would cast. */
  canCast(): boolean;
  /** Where our own line is at: none out, waiting, or a fish on. */
  fishing(): FishingPhase;
  /** The last thing said about our fishing, if it is still on screen. */
  fishingNews(): string | null;
  /** How hungry we are, from `HUNGER_MAX` (full) down to zero. */
  hunger(): number;
  /** The last thing said about what we ate, if it is still on screen. */
  hungerNews(): string | null;
  /** How much health we have left, from `HEALTH_MAX` (full) down to zero. */
  health(): number;
  /** The last thing said about our health, if it is still on screen. */
  healthNews(): string | null;
  /** The last thing said about what we crafted, if it is still on screen. */
  craftingNews(): string | null;
  /** The last thing said about what we caught, if it is still on screen. */
  huntingNews(): string | null;
}

export interface GameOptions {
  readonly canvas: HTMLCanvasElement;
  readonly hud: HudStore;
  readonly worldId: string;
  readonly serverUrlOverride?: string;
  readonly forceWebGL: boolean;
}

/** Everything that makes up a running game. */
export class Game {
  private readonly options: GameOptions;
  private readonly scene = new THREE.Scene();
  private readonly remotePlayers = new InterpolatedEntities();
  private readonly remoteCharacters = new Map<number, Character>();
  private readonly remoteAnimals = new InterpolatedEntities();
  private readonly critters = new Map<number, Critter | Raccoon>();
  private readonly builtMeshes = new Map<number, Campfire | Cabin | FlowerBed | Lantern>();
  private builtProps: readonly BuiltProp[] = [];
  private readonly buriedCacheMeshes = new Map<number, BuriedCacheMound>();
  private buriedCaches: readonly BuriedCacheView[] = [];
  /** Whether a cache of our own is close enough right now to dig up. */
  private nearBuriedCache = false;
  private canBuild = false;
  private buildMenuOpen = false;
  private readonly scratch: Vec3 = vec3();

  private setup: RendererSetup | null = null;
  private camera: FollowCamera | null = null;
  private controls: Controls | null = null;
  private connection: WorldConnection | null = null;
  private daylight: DaylightRig | null = null;
  /** The latest time the server told us, and our own clock when it told us - together, an estimate of the server's clock right now. */
  private latestServerTimeMs = Date.now();
  private latestServerTimeAtMs = performance.now();

  private clearingScene: ClearingScene | null = null;
  private wildernessScene: WildernessScene | null = null;
  private clearing: Clearing | null = null;
  /** What the server says is gone, and what it says we carry. Never guessed. */
  private readonly takenPickups = new Set<number>();
  private carrying: readonly { item: ItemId; count: number }[] = [];
  private nearbyItem: ItemId | null = null;
  private nearGatherSpot: ItemId | null = null;
  /**
   * What the server says about every tree that is not as the seed left it, and
   * how far along the one being chopped is.
   */
  private readonly treeStates = new Map<number, { generation: number; felled: boolean }>();
  private readonly swingsLeft = new Map<number, number>();
  /** Same idea as `swingsLeft`, for whichever wildlife fights back. */
  private readonly threatHitsLeft = new Map<number, number>();
  /** The props as they stand: a regrown tree is a different size from the seeded one. */
  private standingProps: readonly PlacedProp[] = [];
  private collision: CollisionWorld | null = null;
  private aimedTree: { name: string; swingsLeft: number } | null = null;
  private aimedAnimal: { name: string; hitsLeft?: number } | null = null;
  /** Every float in the pond, ours and everybody else's. */
  private readonly floats = new Floats();
  /** Our own line, as far as the server has told us. */
  private fishingPhase: FishingPhase = null;
  private fishingNews: { text: string; until: number } | null = null;
  /** How hungry we are, as far as the server has told us. */
  private hunger = HUNGER_MAX;
  private hungerNews: { text: string; until: number } | null = null;
  /** How much health we have left, as far as the server has told us. */
  private health = HEALTH_MAX;
  private healthNews: { text: string; until: number } | null = null;
  private craftingNews: { text: string; until: number } | null = null;
  private huntingNews: { text: string; until: number } | null = null;
  private cacheNews: { text: string; until: number } | null = null;
  /**
   * Read purely from our own held key, not anything the server has
   * confirmed - the same as `aimedTree`/`aimedAnimal` are only ever a hint,
   * this just says a charge is under way for exactly as long as the
   * server's own `CHARGE_SECONDS` would have it resolve after.
   */
  private chargeWasHeld = false;
  private chargingUntil: number | null = null;
  /** The server takes a breath after every cast ends; so does the hint. */
  private castReadyAt = 0;
  private canCast = false;
  private localPlayer: LocalPlayer | null = null;
  private localCharacter: Character | null = null;
  private selfNetId = 0;

  private lastFrameMs = 0;
  private frames = 0;
  private framesSince = 0;
  private fps = 0;
  private hudDueAt = 0;
  private serverTick = 0;
  private playersOnline = 0;
  private connectionState: ConnectionState = 'connecting';
  private offlineFallbackAt = 0;

  constructor(options: GameOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    installBvhRaycasting();
    // Kicked off now rather than in enterWorld, so they have the whole time
    // it takes to set up the renderer and reach the server to finish loading.
    void preloadPropModels();
    void preloadFlowerModel();

    const setup = await createRenderer(this.options.canvas, this.options.forceWebGL);
    this.setup = setup;
    setup.renderer.shadowMap.enabled = true;
    setup.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.daylight = addDaylight(this.scene);
    this.camera = new FollowCamera(window.innerWidth / window.innerHeight);
    this.controls = new Controls(this.options.canvas, (locked) =>
      this.options.hud.publish({ pointerLocked: locked }),
    );

    this.options.hud.publish({ backend: setup.backend, forcedFallback: setup.forcedFallback });
    window.addEventListener('resize', this.handleResize);

    this.offlineFallbackAt = performance.now() + OFFLINE_FALLBACK_MS;
    this.connect();

    this.lastFrameMs = performance.now();
    setup.renderer.setAnimationLoop(this.frame);
  }

  /** Called when the player clicks the curtain. */
  requestPointerLock(): void {
    this.controls?.requestPointerLock();
  }

  /**
   * A read-only window into the running game.
   *
   * The smoke tests use this to check that one tab really can see another tab's
   * player move, which is not something you can tell from the HUD alone.
   */
  debug(): GameDebug {
    return {
      selfNetId: () => this.selfNetId,
      localPosition: () => ({ ...this.motionOrOrigin() }),
      remotePlayers: () =>
        this.remotePlayers.netIds().map((netId) => {
          const pose = this.remotePlayers.poseOf(netId);
          return { netId, x: pose?.x ?? 0, y: pose?.y ?? 0, z: pose?.z ?? 0 };
        }),
      animals: () =>
        this.remoteAnimals.netIds().map((id) => {
          const pose = this.remoteAnimals.poseOf(id);
          return {
            id,
            kind: animalKindOf(id) ?? 'rabbit',
            x: pose?.x ?? 0,
            y: pose?.y ?? 0,
            z: pose?.z ?? 0,
          };
        }),
      carrying: () => this.carrying.map((entry) => ({ ...entry })),
      takenPickups: () => [...this.takenPickups],
      nearbyItem: () => this.nearbyItem,
      nearGatherSpot: () => this.nearGatherSpot,
      felledTrees: () => [...this.treeStates].filter(([, state]) => state.felled).map(([id]) => id),
      treeGenerations: () =>
        [...this.treeStates].map(([id, state]) => ({ id, generation: state.generation })),
      trees: () =>
        (this.clearing?.props ?? [])
          .map((prop) => ({
            id: prop.id,
            kind: prop.kind,
            x: prop.x,
            z: prop.z,
            swingsToFell: choppingRuleFor(PROP_KINDS[prop.kind])?.swingsToFell ?? 0,
          }))
          .filter((tree) => tree.swingsToFell > 0),
      aimedTree: () => (this.aimedTree === null ? null : { ...this.aimedTree }),
      aimedAnimal: () => (this.aimedAnimal === null ? null : { ...this.aimedAnimal }),
      canBuild: () => this.canBuild,
      buildMenuOpen: () => this.buildMenuOpen,
      builtProps: () => this.builtProps.map((prop) => ({ ...prop })),
      buriedCaches: () => this.buriedCaches.map((cache) => ({ ...cache })),
      pickups: () =>
        (this.clearing?.pickups ?? []).map((entry) => ({
          id: entry.id,
          item: entry.item,
          x: entry.x,
          z: entry.z,
        })),
      gatherSpots: () => (this.clearing?.gatherSpots ?? []).map((spot) => ({ ...spot })),
      faceTowards: (x, z) => {
        const camera = this.camera;
        if (camera === null) return;
        const from = this.motionOrOrigin();
        // Walking forward means walking down -Z, so a heading of zero already
        // points that way: this is the angle that lines the two up.
        camera.look.yaw = Math.atan2(-(x - from.x), -(z - from.z));
      },
      pond: () => (this.clearing?.water ?? []).map((circle) => ({ ...circle })),
      canCast: () => this.canCast,
      fishing: () => this.fishingPhase,
      fishingNews: () => this.currentNews(performance.now()),
      hunger: () => this.hunger,
      hungerNews: () => this.currentHungerNews(performance.now()),
      health: () => this.health,
      healthNews: () => this.currentHealthNews(performance.now()),
      craftingNews: () => this.currentCraftingNews(performance.now()),
      huntingNews: () => this.currentHuntingNews(performance.now()),
    };
  }

  private motionOrOrigin(): Vec3 {
    return this.localPlayer?.motion.position ?? vec3();
  }

  stop(): void {
    window.removeEventListener('resize', this.handleResize);
    this.setup?.renderer.setAnimationLoop(null);
    this.controls?.dispose();
    this.connection?.close();
    this.clearingScene?.dispose();
    this.wildernessScene?.dispose();
    this.floats.dispose();
    this.localCharacter?.dispose();
    for (const character of this.remoteCharacters.values()) character.dispose();
    this.remoteCharacters.clear();
    for (const critter of this.critters.values()) critter.dispose();
    this.critters.clear();
    for (const built of this.builtMeshes.values()) built.dispose();
    this.builtMeshes.clear();
    for (const mound of this.buriedCacheMeshes.values()) mound.dispose();
    this.buriedCacheMeshes.clear();
  }

  /* ---------------------------------------------------------------------- */
  /* Networking                                                             */
  /* ---------------------------------------------------------------------- */

  private connect(): void {
    const url = worldSocketUrl(
      this.options.worldId,
      playerKey(window.localStorage),
      this.options.serverUrlOverride,
    );
    this.connection = new WorldConnection(url, {
      onMessage: (message) => this.handleMessage(message),
      onStateChange: (state, detail) => {
        this.connectionState = state;
        this.options.hud.publish({ connection: state, connectionDetail: detail ?? '' });
      },
    });
    this.connection.connect();
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome': {
        this.selfNetId = message.netId;
        this.serverTick = message.tick;
        this.syncServerClock(message.serverTimeMs);
        void this.enterWorld(message.seed);
        break;
      }
      case 'snapshot': {
        this.serverTick = message.tick;
        this.syncServerClock(message.serverTimeMs);

        const playerEntities = message.entities.filter((entity) => !isAnimalEntity(entity));
        const animalEntities = message.entities.filter(isAnimalEntity);
        this.playersOnline = playerEntities.length;

        const self = playerEntities.find((entity) => entity.netId === this.selfNetId);
        if (self !== undefined) this.localPlayer?.reconcile(self, message.ackSeq);

        this.remotePlayers.ingest(message.serverTimeMs, playerEntities, this.selfNetId);
        const present = new Set(
          playerEntities
            .filter((entity) => entity.netId !== this.selfNetId)
            .map((entity) => entity.netId),
        );
        for (const netId of this.remotePlayers.retainOnly(present)) this.removeRemote(netId);

        this.remoteAnimals.ingest(message.serverTimeMs, animalEntities);
        const presentAnimals = new Set(animalEntities.map((entity) => entity.netId));
        for (const id of this.remoteAnimals.retainOnly(presentAnimals)) this.removeCritter(id);
        break;
      }
      case 'playerLeft': {
        this.remotePlayers.remove(message.netId);
        this.removeRemote(message.netId);
        this.floats.reelIn(message.netId);
        break;
      }
      case 'inventory': {
        this.carrying = message.items.map((entry) => ({ ...entry }));
        break;
      }
      case 'pickupsTaken': {
        this.takenPickups.clear();
        for (const id of message.pickupIds) this.takenPickups.add(id);
        this.clearingScene?.setTakenPickups(this.takenPickups);
        break;
      }
      case 'treeStates': {
        this.treeStates.clear();
        for (const tree of message.trees) {
          this.treeStates.set(tree.treeId, {
            generation: tree.generation,
            felled: tree.felled,
          });
        }
        this.applyTreeStates();
        break;
      }
      case 'treeHit': {
        this.swingsLeft.set(message.treeId, message.swingsLeft);
        break;
      }
      case 'threatHit': {
        this.threatHitsLeft.set(message.event.animalId, message.event.hitsLeft);
        break;
      }
      case 'fishing': {
        this.hearFromTheWater(message.event);
        break;
      }
      case 'hunger': {
        this.hearAboutHunger(message.event);
        break;
      }
      case 'health': {
        this.hearAboutHealth(message.event);
        break;
      }
      case 'crafted': {
        this.hearAboutCrafting(message.event);
        break;
      }
      case 'caught': {
        this.hearAboutCatching(message.event);
        break;
      }
      case 'builtProps': {
        this.builtProps = message.props;
        this.applyBuiltProps();
        break;
      }
      case 'buriedCaches': {
        this.buriedCaches = message.caches;
        this.applyBuriedCaches();
        break;
      }
      case 'cache': {
        this.hearAboutCache(message.event);
        break;
      }
      case 'rejected': {
        this.connectionState = 'rejected';
        this.options.hud.publish({ connection: 'rejected' });
        break;
      }
      default:
        break;
    }
  }

  /**
   * Something happened at the water.
   *
   * Every float is drawn, whoever it belongs to. Only news about our own line
   * changes what the HUD says.
   */
  private hearFromTheWater(event: FishingEvent): void {
    if (event.kind === 'cast') this.floats.cast(event.netId, event.x, event.z);
    else if (event.kind === 'bite') this.floats.bite(event.netId);
    else this.floats.reelIn(event.netId);

    if (event.netId !== this.selfNetId) return;
    if (event.kind === 'cast') {
      this.fishingPhase = 'waiting';
      this.fishingNews = null;
      this.camera?.lookDownTo(FISHING_CAMERA_PITCH);
    } else if (event.kind === 'bite') {
      this.fishingPhase = 'biting';
    } else {
      this.fishingPhase = null;
      const now = performance.now();
      this.fishingNews = { text: newsFor(event), until: now + NEWS_MS };
      this.castReadyAt = now + CAST_COOLDOWN_SECONDS * 1000;
    }

    // Not left for the next frame. `updateHud` only runs from inside the render
    // loop, and that loop can stall for a while under load without the tab
    // being anywhere near crashed. A stall like that must not be able to eat
    // the whole few seconds this news is shown for, or swallow it outright, so
    // the moment this is known it goes straight to the HUD.
    this.options.hud.publish({ fishing: this.fishingPhase, fishingNews: this.currentNews() });
  }

  private currentNews(now = performance.now()): string | null {
    const news = this.fishingNews;
    return news !== null && now < news.until ? news.text : null;
  }

  /** Only ever about us: nobody else's hunger is any of our business. */
  private hearAboutHunger(event: HungerEvent): void {
    this.hunger = event.hunger;
    if (event.ate !== null) {
      const now = performance.now();
      const name = ITEM_KINDS[event.ate].displayName.toLowerCase();
      this.hungerNews = { text: `You ate a ${name}.`, until: now + NEWS_MS };
    }
    // Same reasoning as `hearFromTheWater`: pushed straight to the HUD rather
    // than left for the next frame, so a stall in the render loop cannot eat
    // the window this news is shown for.
    this.options.hud.publish({ hunger: this.hunger, hungerNews: this.currentHungerNews() });
  }

  private currentHungerNews(now = performance.now()): string | null {
    const news = this.hungerNews;
    return news !== null && now < news.until ? news.text : null;
  }

  /** Only ever about us: nobody else's health is any of our business. */
  private hearAboutHealth(event: HealthEvent): void {
    this.health = event.health;
    if (event.knockedOut) {
      const now = performance.now();
      this.healthNews = { text: 'Knocked out! You wake up safe.', until: now + NEWS_MS };
    } else if (event.dodged) {
      const now = performance.now();
      this.healthNews = { text: 'Dodged!', until: now + NEWS_MS };
    }
    // Same reasoning as `hearFromTheWater`: pushed straight to the HUD rather
    // than left for the next frame, so a stall in the render loop cannot eat
    // the window this news is shown for.
    this.options.hud.publish({ health: this.health, healthNews: this.currentHealthNews() });
  }

  private currentHealthNews(now = performance.now()): string | null {
    const news = this.healthNews;
    return news !== null && now < news.until ? news.text : null;
  }

  private currentlyCharging(now = performance.now()): boolean {
    return this.chargingUntil !== null && now < this.chargingUntil;
  }

  /** Only ever about us: nobody else has any reason to know what we just made. */
  private hearAboutCrafting(event: CraftedEvent): void {
    const now = performance.now();
    const name = ITEM_KINDS[event.item].displayName.toLowerCase();
    this.craftingNews = { text: `You made ${article(name)} ${name}.`, until: now + NEWS_MS };
    // Same reasoning as `hearFromTheWater`: pushed straight to the HUD rather
    // than left for the next frame, so a stall in the render loop cannot eat
    // the window this news is shown for.
    this.options.hud.publish({ craftingNews: this.currentCraftingNews() });
  }

  private currentCraftingNews(now = performance.now()): string | null {
    const news = this.craftingNews;
    return news !== null && now < news.until ? news.text : null;
  }

  /**
   * Only ever about us: nobody else has any reason to know what we lost or
   * found. A burial lands the same tick as the knockout itself, so its own
   * toast usually loses out to "Knocked out!" - the dig-up is the one this
   * mostly exists for, since nothing else says that happened.
   */
  private hearAboutCache(event: CacheEvent): void {
    const now = performance.now();
    const text =
      event.kind === 'buried'
        ? 'Knocked out! Some of what you carried is buried where you fell.'
        : 'You dug up what you buried.';
    this.cacheNews = { text, until: now + NEWS_MS };
    this.options.hud.publish({ cacheNews: this.currentCacheNews() });
  }

  private currentCacheNews(now = performance.now()): string | null {
    const news = this.cacheNews;
    return news !== null && now < news.until ? news.text : null;
  }

  /** Only ever about us: nobody else has any reason to know what we just caught. */
  private hearAboutCatching(event: AnimalCaught): void {
    const now = performance.now();
    // A threat fought off with nothing to show for it - the same reason a
    // caught event can even have a null item now.
    if (event.item === null) {
      this.huntingNews = { text: 'You fought it off!', until: now + NEWS_MS };
      this.options.hud.publish({ huntingNews: this.currentHuntingNews() });
      return;
    }
    const name = ITEM_KINDS[event.item].displayName.toLowerCase();
    // No article: a catch pays out in meat, hide and the like, not one more
    // countable thing the way a fish or a craft does.
    this.huntingNews = {
      text:
        event.added === 0
          ? `No room for more ${name}, so you let it go.`
          : `You caught some ${name}!`,
      until: now + NEWS_MS,
    };
    // Same reasoning as `hearFromTheWater`: pushed straight to the HUD rather
    // than left for the next frame, so a stall in the render loop cannot eat
    // the window this news is shown for.
    this.options.hud.publish({ huntingNews: this.currentHuntingNews() });
  }

  private currentHuntingNews(now = performance.now()): string | null {
    const news = this.huntingNews;
    return news !== null && now < news.until ? news.text : null;
  }

  /**
   * Where somebody holding a line is drawn, so their rod and line start from
   * them. Read off the drawn character rather than the network, because that
   * is already turned to face the float.
   */
  private anglerOf(netId: number): Angler | undefined {
    const character =
      netId === this.selfNetId ? this.localCharacter : this.remoteCharacters.get(netId);
    if (character === null || character === undefined) return undefined;
    const { x, y, z } = character.group.position;
    return { x, y, z, yaw: character.group.rotation.y };
  }

  /* ---------------------------------------------------------------------- */
  /* Building the world                                                      */
  /* ---------------------------------------------------------------------- */

  /**
   * Build the clearing and the wilderness around it from the seed the server
   * gave us.
   *
   * Neither is ever sent over the network: the same seed run through the same
   * code produces the same trees, the same hills and the same forest on the
   * server and in every browser.
   */
  private async enterWorld(seed: number): Promise<void> {
    if (this.clearingScene !== null) return;

    // Resolves immediately once loaded; only actually waits if the world is
    // entered before the fetch kicked off in start() has finished. A flower
    // bed can be built well after this, but never before, so loading it here
    // covers every place the game ever draws a flower.
    await Promise.all([preloadPropModels(), preloadFlowerModel()]);
    if (this.clearingScene !== null) return;

    const clearing = buildTestClearing(seed);
    const terrain = createWildernessTerrain(seed);
    const wilderness = buildWilderness(seed, terrain);

    this.clearing = clearing;
    this.clearingScene = buildClearingScene(clearing);
    this.clearingScene.setTakenPickups(this.takenPickups);
    this.scene.add(this.clearingScene.group);

    this.wildernessScene = buildWildernessScene(wilderness, terrain);
    this.scene.add(this.wildernessScene.group);

    this.scene.add(this.floats.group);

    const collision = createCollisionWorld(terrain, [
      ...clearing.colliders,
      ...wilderness.colliders,
    ]);
    this.collision = collision;
    this.localPlayer = new LocalPlayer(SPAWN_POSITION, collision);
    this.applyTreeStates();
    this.applyBuiltProps();

    this.localCharacter = createCharacter(colorForPlayer(this.selfNetId || 1));
    this.scene.add(this.localCharacter.group);

    this.options.hud.publish({ ready: true });
  }

  /**
   * Put the trees where the server says they are, in the world we walk around
   * as well as the one we look at: a stump stops blocking like a trunk, and a
   * tree that grew back starts blocking again at its new size.
   */
  private applyTreeStates(): void {
    this.clearingScene?.setTreeStates(this.treeStates);

    const clearing = this.clearing;
    const collision = this.collision;
    if (clearing === null || collision === null) return;

    const standing = [...clearing.props];
    for (const [treeId, state] of this.treeStates) {
      const index = clearing.indexById.get(treeId);
      const original = index === undefined ? undefined : clearing.props[index];
      if (index === undefined || original === undefined) continue;

      const grown = treeAtGeneration(clearing.seed, original, state.generation);
      standing[index] = grown;
      replaceCollider(
        collision,
        index,
        state.felled ? stumpColliderFor(grown) : colliderForProp(grown),
      );
    }
    this.standingProps = standing;
  }

  private isFelled(treeId: number): boolean {
    return this.treeStates.get(treeId)?.felled === true;
  }

  /**
   * Put every built prop where the server says it is.
   *
   * Sent whole each time, so this reconciles rather than only ever adding:
   * anything drawn that is no longer in the list is torn down. Nothing is
   * ever actually removed yet, but a client that reconnects mid-session
   * should not have to care whether that stays true forever.
   */
  private applyBuiltProps(): void {
    if (this.clearingScene === null) return;
    const present = new Set(this.builtProps.map((prop) => prop.id));

    for (const [id, built] of this.builtMeshes) {
      if (present.has(id)) continue;
      this.scene.remove(built.group);
      built.dispose();
      this.builtMeshes.delete(id);
    }

    for (const prop of this.builtProps) {
      if (this.builtMeshes.has(prop.id)) continue;
      const built = createBuiltMesh(prop.kind);
      built.group.position.set(prop.x, 0, prop.z);
      this.scene.add(built.group);
      this.builtMeshes.set(prop.id, built);
    }
  }

  /** Put every buried cache's mound where the server says it is, the same reconciling way as `applyBuiltProps`. */
  private applyBuriedCaches(): void {
    if (this.clearingScene === null) return;
    const present = new Set(this.buriedCaches.map((cache) => cache.id));

    for (const [id, mound] of this.buriedCacheMeshes) {
      if (present.has(id)) continue;
      this.scene.remove(mound.group);
      mound.dispose();
      this.buriedCacheMeshes.delete(id);
    }

    for (const cache of this.buriedCaches) {
      if (this.buriedCacheMeshes.has(cache.id)) continue;
      const mound = createBuriedCacheMound();
      mound.group.position.set(cache.x, 0, cache.z);
      this.scene.add(mound.group);
      this.buriedCacheMeshes.set(cache.id, mound);
    }
  }

  private removeRemote(netId: number): void {
    const character = this.remoteCharacters.get(netId);
    if (character === undefined) return;
    this.scene.remove(character.group);
    character.dispose();
    this.remoteCharacters.delete(netId);
  }

  private characterFor(netId: number): Character {
    const existing = this.remoteCharacters.get(netId);
    if (existing !== undefined) return existing;

    const character = createCharacter(colorForPlayer(netId));
    this.scene.add(character.group);
    this.remoteCharacters.set(netId, character);
    return character;
  }

  private removeCritter(animalId: number): void {
    const critter = this.critters.get(animalId);
    if (critter === undefined) return;
    this.scene.remove(critter.group);
    critter.dispose();
    this.critters.delete(animalId);
  }

  private critterFor(animalId: number): Critter | Raccoon {
    const existing = this.critters.get(animalId);
    if (existing !== undefined) return existing;

    const critter = createCritterFor(animalKindOf(animalId) ?? 'rabbit');
    this.scene.add(critter.group);
    this.critters.set(animalId, critter);
    return critter;
  }

  /* ---------------------------------------------------------------------- */
  /* The frame                                                               */
  /* ---------------------------------------------------------------------- */

  private readonly frame = (): void => {
    const setup = this.setup;
    const camera = this.camera;
    const controls = this.controls;
    if (setup === null || camera === null || controls === null) return;

    const now = performance.now();
    // A frame longer than a quarter second means the tab was asleep; do not try
    // to simulate all of it at once.
    const deltaSeconds = Math.min((now - this.lastFrameMs) / 1000, 0.25);
    this.lastFrameMs = now;

    const mouse = controls.takeMouseDelta();
    if (mouse.x !== 0 || mouse.y !== 0) camera.turn(mouse.x, mouse.y, MOUSE_SENSITIVITY);

    // Read ahead of anything below that might forget taps for a produced
    // movement tick, so a craft or build key pressed this frame is never
    // swallowed by that blanket clear before this gets a look at it. The
    // build menu takes the same digit keys over while it is open, so it
    // reads first and craft only gets a turn once it is closed.
    this.handleBuildMenuInput(controls);
    if (!this.buildMenuOpen) this.handleCraftInput(controls);

    // If the server never answers, let the player walk about on their own rather
    // than staring at a loading screen.
    if (
      this.clearingScene === null &&
      this.connectionState !== 'connected' &&
      now > this.offlineFallbackAt
    ) {
      void this.enterWorld(DEFAULT_WORLD_SEED);
    }

    this.updateLocalPlayer(deltaSeconds, camera);
    this.updateRemotePlayers(deltaSeconds);
    this.updateRemoteAnimals(deltaSeconds);
    this.floats.update(deltaSeconds, (netId) => this.anglerOf(netId));
    this.daylight?.update(dayProgress(this.estimatedServerTimeMs()));

    setup.renderer.render(this.scene, camera.camera);
    this.updateHud(now, deltaSeconds);
  };

  /**
   * B opens or closes the build menu. While it is open, a digit key picks
   * from it and sends the request, the same moment a craft key would - the
   * server still places it wherever this player currently stands and looks.
   */
  private handleBuildMenuInput(controls: Controls): void {
    if (controls.takeBuildMenuToggle()) this.buildMenuOpen = !this.buildMenuOpen;
    if (!this.buildMenuOpen) return;
    for (const index of controls.takeBuildTaps()) {
      const kind = BUILDABLE_KIND_ORDER[index];
      if (kind === undefined) continue;
      this.connection?.sendBuild(kind);
      this.buildMenuOpen = false;
      break;
    }
  }

  /** Turn any craft hotkeys pressed this frame into requests to the server. */
  private handleCraftInput(controls: Controls): void {
    for (const index of controls.takeCraftTaps()) {
      const item = RECIPE_ITEMS[index];
      if (item !== undefined) this.connection?.sendCraft(item);
    }
  }

  /** Records what the server just told us its clock reads, and when we heard it. */
  private syncServerClock(serverTimeMs: number): void {
    this.latestServerTimeMs = serverTimeMs;
    this.latestServerTimeAtMs = performance.now();
  }

  /**
   * The server's clock right now, as best guessed from the last time it told
   * us plus however long ago that was. Day and night only need to be smooth
   * and shared, not exact to the millisecond, so this needs no reconciling
   * the way position prediction does.
   */
  private estimatedServerTimeMs(): number {
    return this.latestServerTimeMs + (performance.now() - this.latestServerTimeAtMs);
  }

  private updateLocalPlayer(deltaSeconds: number, camera: FollowCamera): void {
    const player = this.localPlayer;
    const character = this.localCharacter;
    const clearing = this.clearingScene;
    const wilderness = this.wildernessScene;
    if (player === null || character === null || clearing === null || wilderness === null) return;

    const intent = this.controls?.moveIntent() ?? { x: 0, z: 0 };
    // While the float is under on this screen, every input says so: the server
    // counts the time to click from the first of them, so a slow connection
    // does not shorten it.
    const buttons =
      (this.controls?.buttons() ?? 0) | (this.fishingPhase === 'biting' ? PlayerButton.SawBite : 0);

    // A fresh press starts the same local timer the server's own charge
    // runs on - only worth starting if a swing would even do anything.
    const chargeHeld = (buttons & PlayerButton.Charge) !== 0;
    if (chargeHeld && !this.chargeWasHeld && this.isCarrying('axe')) {
      this.chargingUntil = performance.now() + CHARGE_SECONDS * 1000;
    }
    this.chargeWasHeld = chargeHeld;

    const produced = player.advance(deltaSeconds, intent.x, intent.z, camera.look.yaw, buttons);
    // A tap is only forgotten once a tick has carried it, so a quick press of
    // Space between two frames still turns into a jump.
    if (produced.length > 0) this.controls?.forgetTaps();
    for (const input of produced) this.connection?.send(input);

    const position = player.renderPosition(this.scratch);
    character.group.position.set(position.x, position.y, position.z);
    character.group.rotation.y =
      this.facingWhileFishing(this.selfNetId, position) ?? player.renderYaw();

    camera.update(position, deltaSeconds, [wilderness.cameraBlockers, clearing.cameraBlockers]);

    // Only a hint. The server decides who actually gets it.
    const reachable =
      this.clearing === null
        ? null
        : pickupInReach(player.motion.position, this.clearing.pickups, (id) =>
            this.takenPickups.has(id),
          );
    this.nearbyItem = reachable?.item ?? null;

    this.nearGatherSpot =
      this.clearing === null
        ? null
        : (gatherSpotInReach(player.motion.position, this.clearing.gatherSpots)?.item ?? null);

    // Only a hint here too: the server decides whether it is really this
    // player's to dig up.
    this.nearBuriedCache =
      nearestBuriedCache(
        player.motion.position,
        this.buriedCaches,
        (cache) => cache.ownerNetId === this.selfNetId,
      ) !== null;

    const target =
      this.clearing === null
        ? null
        : treeInReach(player.motion.position, camera.look.yaw, this.standingProps, (id) =>
            this.isFelled(id),
          );
    this.aimedTree =
      target === null
        ? null
        : {
            name: PROP_KINDS[target.prop.kind].displayName,
            swingsLeft: this.swingsLeft.get(target.prop.id) ?? target.rule.swingsToFell,
          };

    // A tree in reach always wins a swing over an animal behind it, the same
    // way the server's own `trySwing` decides it, so this is only worth
    // working out when there is no tree to claim the click first.
    const animalCandidates =
      target === null
        ? this.remoteAnimals.netIds().flatMap((id) => {
            const pose = this.remoteAnimals.poseOf(id);
            const kind = animalKindOf(id);
            return pose === undefined || kind === undefined
              ? []
              : [{ id, x: pose.x, z: pose.z, kind }];
          })
        : [];
    const animalTarget = animalInReach(player.motion.position, camera.look.yaw, animalCandidates);
    this.aimedAnimal =
      animalTarget === null
        ? null
        : (() => {
            // Widened from the narrow per-kind literal `as const` gives it,
            // so an optional field like `threat` reads the same regardless
            // of which kind this happens to be.
            const kind: AnimalKind = ANIMAL_KINDS[animalTarget.kind];
            return {
              name: kind.displayName,
              hitsLeft: this.threatHitsLeft.get(animalTarget.id) ?? kind.threat?.hitsToDefeat,
            };
          })();

    // The same rule the server uses: a tree or an animal you could swing at
    // gets the click first, and otherwise a rod and some water in front of
    // you make a cast.
    const axeHasSomethingToHit =
      (target !== null || animalTarget !== null) && this.isCarrying('axe');
    this.canCast =
      this.fishingPhase === null &&
      performance.now() >= this.castReadyAt &&
      !axeHasSomethingToHit &&
      this.isCarrying('rod') &&
      this.clearing !== null &&
      castLanding(player.motion.position, camera.look.yaw, this.clearing.water) !== null;

    // Its own key, so it never competes with a swing or a cast for the click.
    const clearingData = this.clearing;
    const canAfford = (kind: BuildableKindId): boolean =>
      BUILDABLE_KINDS[kind].costs.every(
        (cost) =>
          (this.carrying.find((entry) => entry.item === cost.item)?.count ?? 0) >= cost.amount,
      );
    const buildBlockers: BuildBlocker[] =
      clearingData === null
        ? []
        : [
            ...this.standingProps.map((prop) => ({
              x: prop.x,
              z: prop.z,
              footprintRadius: PROP_KINDS[prop.kind].colliderRadius * prop.scale,
            })),
            ...this.builtProps.map((prop) => ({
              x: prop.x,
              z: prop.z,
              footprintRadius: BUILDABLE_KINDS[prop.kind].footprintRadius,
            })),
          ];
    // Any one of them being placeable right now is enough to offer the hint -
    // the build menu is where you pick which.
    this.canBuild =
      clearingData !== null &&
      BUILDABLE_KIND_ORDER.some(
        (kind) =>
          canAfford(kind) &&
          buildSpotFor(
            player.motion.position,
            camera.look.yaw,
            BUILDABLE_KINDS[kind].footprintRadius,
            clearingData.water,
            buildBlockers,
          ) !== null,
      );

    // Keep the shadow map centred on the player instead of on the origin.
    const sun = this.daylight?.sun;
    if (sun !== undefined) {
      sun.position.set(position.x + 28, position.y + 40, position.z + 18);
      sun.target.position.set(position.x, position.y, position.z);
      sun.target.updateMatrixWorld();
    }
  }

  /**
   * Somebody with a line out faces their float, whichever way they last walked.
   * Only how they are drawn: which way they face is not something the server
   * needs to hear about.
   */
  private facingWhileFishing(netId: number, at: Readonly<Vec3>): number | undefined {
    const float = this.floats.floatOf(netId);
    if (float === undefined) return undefined;
    return Math.atan2(-(float.x - at.x), -(float.z - at.z));
  }

  private isCarrying(item: ItemId): boolean {
    return this.carrying.some((entry) => entry.item === item && entry.count > 0);
  }

  private updateRemotePlayers(deltaSeconds: number): void {
    if (this.clearingScene === null) return;
    this.remotePlayers.advance(deltaSeconds);

    for (const netId of this.remotePlayers.netIds()) {
      const pose = this.remotePlayers.poseOf(netId);
      if (pose === undefined) continue;
      const character = this.characterFor(netId);
      character.group.position.set(pose.x, pose.y, pose.z);
      character.group.rotation.y = this.facingWhileFishing(netId, pose) ?? pose.yaw;
    }
  }

  private updateRemoteAnimals(deltaSeconds: number): void {
    if (this.clearingScene === null) return;
    this.remoteAnimals.advance(deltaSeconds);

    for (const animalId of this.remoteAnimals.netIds()) {
      const pose = this.remoteAnimals.poseOf(animalId);
      if (pose === undefined) continue;
      const critter = this.critterFor(animalId);
      critter.group.position.set(pose.x, pose.y, pose.z);
      critter.group.rotation.y = pose.yaw;
    }
  }

  private updateHud(now: number, deltaSeconds: number): void {
    this.frames += 1;
    this.framesSince += deltaSeconds;
    if (now < this.hudDueAt) return;
    this.hudDueAt = now + HUD_INTERVAL_MS;

    this.fps = this.framesSince > 0 ? Math.round(this.frames / this.framesSince) : 0;
    this.frames = 0;
    this.framesSince = 0;

    const player = this.localPlayer;
    this.options.hud.publish({
      fps: this.fps,
      pingMs: this.connection?.pingMs ?? 0,
      playersOnline: Math.max(this.playersOnline, this.clearingScene === null ? 0 : 1),
      serverTick: this.serverTick,
      position: player === null ? { x: 0, y: 0, z: 0 } : { ...player.motion.position },
      correctionCm: (player?.stats.lastCorrection ?? 0) * 100,
      carrying: this.carrying,
      nearbyItem: this.nearbyItem,
      nearGatherSpot: this.nearGatherSpot,
      nearBuriedCache: this.nearBuriedCache,
      aimedTree: this.aimedTree,
      aimedAnimal: this.aimedAnimal,
      canBuild: this.canBuild,
      buildMenuOpen: this.buildMenuOpen,
      canCast: this.canCast,
      fishing: this.fishingPhase,
      fishingNews: this.currentNews(now),
      hunger: this.hunger,
      hungerNews: this.currentHungerNews(now),
      health: this.health,
      healthNews: this.currentHealthNews(now),
      charging: this.currentlyCharging(now),
      craftingNews: this.currentCraftingNews(now),
      huntingNews: this.currentHuntingNews(now),
      cacheNews: this.currentCacheNews(now),
      isNight: isNight(dayProgress(this.estimatedServerTimeMs())),
    });
  }

  private readonly handleResize = (): void => {
    const setup = this.setup;
    if (setup === null || this.camera === null) return;
    setup.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.resize(window.innerWidth, window.innerHeight);
  };
}

/** What to say when a line comes in. */
function newsFor(event: FishingEvent): string {
  switch (event.kind) {
    case 'caught': {
      const name = ITEM_KINDS[event.item].displayName.toLowerCase();
      if (event.added === 0) return `No room for another ${name}, so you let it go.`;
      return event.item === RAREST_FISH ? `A ${name}! That's a rare one.` : `You caught a ${name}!`;
    }
    case 'tooSoon':
      return 'Too soon. It swam off.';
    case 'tooLate':
      return 'Too slow. It got away.';
    case 'walkedAway':
      return 'You reeled in.';
    default:
      return '';
  }
}

/** "a" or "an", for a lower-cased item name. Good enough for everything the item table holds. */
function article(name: string): string {
  return /^[aeiou]/i.test(name) ? 'an' : 'a';
}
