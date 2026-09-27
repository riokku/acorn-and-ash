import * as THREE from 'three/webgpu';

import {
  ANIMAL_DENS,
  ANIMAL_KINDS,
  BUILDABLE_KINDS,
  BUILDABLE_KIND_ORDER,
  BUILD_ROTATION_STEP,
  CLEARING_TREE_LINE_INNER,
  CAST_COOLDOWN_SECONDS,
  CHARGE_SECONDS,
  DEFAULT_CHARACTER,
  DEFAULT_WORLD_SEED,
  HEALTH_MAX,
  HUNGER_MAX,
  ITEM_KINDS,
  POND_FISH,
  PROP_KINDS,
  PlayerButton,
  RECIPE_ITEMS,
  SPAWN_POSITION,
  SPRINT_REPORTING_SPEED,
  SnapshotFlag,
  TINT_COLORS,
  animalInReach,
  buildTestClearing,
  buildableFootprint,
  buildWilderness,
  castLanding,
  choppingRuleFor,
  colliderForProp,
  createCollisionWorld,
  createWildernessTerrain,
  dayProgress,
  gatherSpotInReach,
  isNight,
  exploredFraction,
  nearestBuriedCache,
  nearestCampfire,
  pickupInReach,
  replaceCollider,
  roundFootprint,
  stumpColliderFor,
  treeAtGeneration,
  treeInReach,
  vec3,
  type AnimalCaught,
  type AnimalKind,
  type AnimalKindId,
  type BuildRequest,
  type BuildableKindId,
  type BuiltPropView,
  type Footprint,
  type BuriedCacheView,
  type CacheEvent,
  type CharacterId,
  type Clearing,
  type CollisionWorld,
  type CraftedEvent,
  type FishingEvent,
  type HealthEvent,
  type HungerEvent,
  type ItemId,
  type PlacedProp,
  type RosterEntry,
  type ServerMessage,
  type SnapshotEntity,
  type Vec3,
} from '@acorn/shared';

import { FollowCamera } from './camera/follow-camera';
import { Controls } from './input/controls';
import { clickAimYaw, type ClickCandidate } from './input/click-target';
import { WorldConnection, playerKey, worldSocketUrl, type ConnectionState } from './net/connection';
import { LocalPlayer } from './net/local-player';
import { InterpolatedEntities } from './net/interpolated-entities';
import { buildClearingScene, type ClearingScene } from './scene/clearing';
import { buildWildernessScene, type WildernessScene } from './scene/wilderness';
import { preloadPropModels } from './scene/prop-models';
import { preloadFlowerModel } from './scene/flower-models';
import { preloadCampfireModels } from './scene/campfire-models';
import { preloadItemModels } from './scene/item-models';
import { preloadCharacterModels } from './scene/character-model';
import { playTreeHit, playThreatHit, playTookDamage, startAmbientMusic } from './audio/sound';
import {
  colorForPlayer,
  createCharacter,
  pickAnimationState,
  type Character,
} from './scene/character';
import { createCampfire, type Campfire } from './scene/campfire';
import { createBuriedCacheMound, type BuriedCacheMound } from './scene/buried-cache';
import { createCabin, type Cabin } from './scene/cabin';
import { createFlowerBed, type FlowerBed } from './scene/flower-bed';
import { createLantern, type Lantern } from './scene/lantern';
import { createFence, type Fence } from './scene/fence';
import { createGardenPath, type GardenPath } from './scene/garden-path';
import { createCritter, type Critter } from './scene/critter';
import { createRaccoon, type Raccoon } from './scene/raccoon';
import { createFox, type Fox } from './scene/fox';
import { preloadFoxModel } from './scene/fox-model';
import { preloadArtTextures } from './art/textures';
import { Floats, type Angler } from './scene/floats';
import { addDaylight, type DaylightRig } from './scene/lighting';
import { installBvhRaycasting } from './scene/bvh';
import { createRenderer, type RendererSetup } from './scene/renderer';
import { createBuildGhost, type BuildGhost } from './scene/build-ghost';
import { planPlacement, type PlacementPlan } from './building/placement';
import type { FishingPhase, HudStore } from './hud/store';
import { compassToOwnCache, type Compass } from './hud/cache-compass';
import { resolveHotbarSlots } from './hud/hotbar-layout';
import { MapFeed, type MapBuild } from './map/map-feed';
import { paintWorldMapImage } from './map/world-map-image';
import type { PlayerIdentity } from './home/identity';

/** Multiplied by the Settings menu's sensitivity slider - see `setLookSensitivity`. */
const BASE_MOUSE_SENSITIVITY = 0.0023;
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
/** Camera-shake strength for a swing connecting with a tree or an animal. */
const HIT_LANDED_SHAKE = 0.35;
/** Camera-shake strength for taking damage ourselves - sharper than landing one. */
const TOOK_DAMAGE_SHAKE = 0.55;
/**
 * How generous a click on a tree is. A trunk is only a hand or two across,
 * so it counts as at least this wide; a canopy counts as most of its drawn
 * width, leaving the ragged edge of the leaves to whatever is behind it.
 */
const CLICK_TRUNK_MIN_RADIUS = 0.35;
const CLICK_CANOPY_FRACTION = 0.8;
/** How big an animal is to click on - rounded up, so a darting rabbit is not a pixel hunt. */
const CLICK_ANIMAL_RADIUS = 0.55;
const CLICK_ANIMAL_HEIGHT = 0.9;
/**
 * How long a piece just placed counts as standing, for the preview's sake,
 * before the server has said so itself - long enough for any sensible round
 * trip, short enough that a piece the server refused stops getting in the way.
 */
const PENDING_PLACEMENT_MS = 3000;

/** A piece being placed: what it is, how it is turned, and its preview. */
interface Placing {
  kind: BuildableKindId;
  /** Which way the mouse wheel has turned it. */
  yaw: number;
  readonly ghost: BuildGhost;
  /** Where it would go and whether it can, as of this frame. */
  plan: PlacementPlan;
  /** Whether at least one has been placed since picking it, for knowing when materials ran out. */
  placedAny: boolean;
}

/** Wildlife rides in the same snapshot as everybody else; this is how to tell it apart. */
function isAnimalEntity(entity: SnapshotEntity): boolean {
  return (entity.flags & SnapshotFlag.Animal) !== 0;
}

/** The placeholder model for whatever kind of thing somebody built. */
function createBuiltMesh(
  kind: BuildableKindId,
): Campfire | Cabin | FlowerBed | Lantern | Fence | GardenPath {
  switch (kind) {
    case 'campfire':
      return createCampfire();
    case 'cabin':
      return createCabin();
    case 'flowerBed':
      return createFlowerBed();
    case 'lantern':
      return createLantern();
    case 'fence':
      return createFence();
    case 'gardenPath':
      return createGardenPath();
  }
}

/** The placeholder model for whichever kind of wildlife this happens to be. */
function createCritterFor(kind: AnimalKindId): Critter | Raccoon | Fox {
  switch (kind) {
    case 'rabbit':
      return createCritter();
    case 'maskedRaccoon':
      return createRaccoon();
    case 'fox':
      return createFox();
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
  /** What the Equipped list says one particular connected player has in hand, if anything. */
  remoteEquippedItem(netId: number): string | null;
  /** Every animal currently in view, wherever this browser last heard it was. */
  animals(): Array<{ id: number; kind: string; x: number; y: number; z: number }>;
  /** What the server says we carry. */
  carrying(): Array<{ item: string; count: number }>;
  /** What the server's Equipped list says we currently have in hand, if anything. */
  equippedItem(): string | null;
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
  /** Whether the craft menu (opened with C) is currently showing. */
  craftMenuOpen(): boolean;
  /** Everything anybody has built, wherever this browser last heard it was. */
  builtProps(): Array<{
    id: number;
    kind: string;
    x: number;
    z: number;
    yaw: number;
    lit: boolean;
    yours: boolean;
  }>;
  /**
   * The piece being placed, if any: which kind, where its preview stands
   * right now, and why a click would not place it, if it would not.
   */
  buildPreview(): {
    kind: string;
    spot: { x: number; z: number; yaw: number } | null;
    refusal: string | null;
  } | null;
  /** Every cache currently buried, wherever this browser last heard it was. */
  buriedCaches(): Array<{ id: number; ownerNetId: number | null; x: number; z: number }>;
  /**
   * The maps (see decision 0054): whether the painted world is ready, whether
   * the big map is open, and how much of the world this player has seen.
   */
  mapState(): { painted: boolean; open: boolean; explored: number };
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
  readonly identity: PlayerIdentity;
  readonly worldId: string;
  readonly serverUrlOverride?: string;
  readonly forceWebGL: boolean;
  /** A multiplier on `BASE_MOUSE_SENSITIVITY`, from the Settings menu. */
  readonly lookSensitivity: number;
}

/** Everything that makes up a running game. */
export class Game {
  private readonly options: GameOptions;
  /** Live-adjustable from the Settings menu - see `setLookSensitivity`. */
  private lookSensitivity: number;
  private readonly scene = new THREE.Scene();
  private readonly remotePlayers = new InterpolatedEntities();
  private readonly remoteCharacters = new Map<number, Character>();
  /** What the server's Roster says about everybody currently connected. */
  private readonly roster = new Map<number, RosterEntry>();
  /** What the server's Equipped list says everybody currently has in hand, including ourselves. */
  private readonly equipped = new Map<number, ItemId | null>();
  private readonly remoteAnimals = new InterpolatedEntities();
  private readonly critters = new Map<number, Critter | Raccoon | Fox>();
  private readonly builtMeshes = new Map<
    number,
    Campfire | Cabin | FlowerBed | Lantern | Fence | GardenPath
  >();
  private builtProps: readonly BuiltPropView[] = [];
  /** The piece being placed, if any - see decision 0052. */
  private placing: Placing | null = null;
  /**
   * Pieces this player has just placed, until the server says they are built
   * (or `PENDING_PLACEMENT_MS` passes): counted as standing already, so a
   * second click on the same spot shows red at once, and the next fence
   * piece can snap onto the one just laid without waiting for the round trip.
   */
  private pendingPlacements: { readonly request: BuildRequest; readonly sentAt: number }[] = [];
  private readonly buriedCacheMeshes = new Map<number, BuriedCacheMound>();
  private buriedCaches: readonly BuriedCacheView[] = [];
  /** Whether a cache of our own is close enough right now to dig up. */
  private nearBuriedCache = false;
  /** The way back to a buried cache of our own, once it is a real walk rather than something already in reach. */
  private ownCacheCompass: Compass | null = null;
  /** Whether a campfire is close enough right now to light or put out, and which. */
  private nearCampfire: 'lit' | 'unlit' | null = null;
  private canBuild = false;
  private buildMenuOpen = false;
  private craftMenuOpen = false;
  /** Whether the curtain has been dismissed - see `resume`/`pause`. */
  private playing = false;
  private inventoryOpen = false;
  /** Whether the big map (M) is open - see decision 0054. */
  private mapOpen = false;
  /** What the minimap and the big map draw, kept up to date every frame. */
  readonly mapFeed = new MapFeed();
  private readonly scratch: Vec3 = vec3();
  /**
   * Which way the character is aiming, set by a left click on the world and
   * let go again the moment the player walks off - null means "wherever the
   * character already faces". Never the camera's heading: only a right-button
   * drag turns the camera (see decision 0051).
   */
  private aimYaw: number | null = null;
  /** Scratch objects for `aimTowardsClickPoint` and the build preview, reused rather than allocated fresh. */
  private readonly clickRaycaster = new THREE.Raycaster();
  private readonly clickNdc = new THREE.Vector2();
  /** The clearing's ground, which is flat at zero everywhere a piece can be placed. */
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly groundHit = new THREE.Vector3();

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
    this.lookSensitivity = options.lookSensitivity;
  }

  async start(): Promise<void> {
    installBvhRaycasting();
    // Kicked off now rather than in enterWorld, so they have the whole time
    // it takes to set up the renderer and reach the server to finish loading.
    void preloadPropModels();
    void preloadFlowerModel();
    void preloadCampfireModels();
    void preloadItemModels();
    void preloadFoxModel();
    void preloadCharacterModels();

    const setup = await createRenderer(this.options.canvas, this.options.forceWebGL);
    this.setup = setup;
    setup.renderer.shadowMap.enabled = true;
    setup.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.daylight = addDaylight(this.scene);
    this.camera = new FollowCamera(window.innerWidth / window.innerHeight);
    this.controls = new Controls(this.options.canvas);

    this.options.hud.publish({
      backend: setup.backend,
      forcedFallback: setup.forcedFallback,
      playerName: this.options.identity.name,
    });
    window.addEventListener('resize', this.handleResize);

    this.offlineFallbackAt = performance.now() + OFFLINE_FALLBACK_MS;
    this.connect();

    this.lastFrameMs = performance.now();
    setup.renderer.setAnimationLoop(this.frame);
  }

  /** Called when the player clicks the curtain to start or come back to playing. */
  resume(): void {
    this.setPlaying(true);
    // Tied to this real click rather than page load: autoplay policy blocks
    // audio started without one.
    startAmbientMusic();
  }

  /**
   * Whichever menu is open closes first; only once none are does Escape
   * bring the curtain back - the same one-layer-at-a-time shape most games
   * give the key. A panel closing this way just rides the next HUD publish,
   * same as opening one with B, C or I always has; only pausing itself
   * publishes straight away, the same responsiveness the curtain always had
   * back when losing the mouse and losing the game were the same thing.
   */
  private handleEscapeInput(controls: Controls): void {
    if (!controls.takeEscapeToggle()) return;
    if (this.mapOpen) this.mapOpen = false;
    else if (this.placing !== null) this.stopPlacing();
    else if (this.craftMenuOpen) this.craftMenuOpen = false;
    else if (this.buildMenuOpen) this.buildMenuOpen = false;
    else if (this.inventoryOpen) this.inventoryOpen = false;
    else this.setPlaying(false);
  }

  private setPlaying(playing: boolean): void {
    this.playing = playing;
    if (!playing) {
      // Nothing should keep walking, swinging or charging under the curtain.
      this.controls?.releaseAll();
      this.stopPlacing();
      this.buildMenuOpen = false;
      this.craftMenuOpen = false;
      this.inventoryOpen = false;
      this.mapOpen = false;
    }
    this.options.hud.publish({
      playing: this.playing,
      mapOpen: this.mapOpen,
      buildMenuOpen: this.buildMenuOpen,
      craftMenuOpen: this.craftMenuOpen,
      inventoryOpen: this.inventoryOpen,
    });
  }

  /** Called from the HUD's own bag button - the mouse-first way to open the inventory panel. */
  toggleInventory(): void {
    this.inventoryOpen = !this.inventoryOpen;
    if (this.inventoryOpen) {
      this.stopPlacing();
      this.buildMenuOpen = false;
      this.craftMenuOpen = false;
    }
    this.options.hud.publish({
      inventoryOpen: this.inventoryOpen,
      buildMenuOpen: this.buildMenuOpen,
      craftMenuOpen: this.craftMenuOpen,
    });
  }

  /**
   * Open or put away the big map - M, or a click on the minimap or the map's
   * own close button. Everything else that fills the middle of the screen
   * steps aside for it; walking carries on underneath (see decision 0054).
   */
  toggleMap(): void {
    this.mapOpen = !this.mapOpen;
    if (this.mapOpen) {
      this.stopPlacing();
      this.buildMenuOpen = false;
      this.craftMenuOpen = false;
      this.inventoryOpen = false;
    }
    this.options.hud.publish({
      mapOpen: this.mapOpen,
      inventoryOpen: this.inventoryOpen,
      buildMenuOpen: this.buildMenuOpen,
      craftMenuOpen: this.craftMenuOpen,
    });
  }

  /**
   * Equip whatever this item is, the same as pressing its hotbar number
   * would - see `handleHotbarInput`. Its own method so a click on a hotbar
   * slot or an inventory item can ask for exactly the same thing a key
   * press does, through one shared gate. Also guards a pinned hotbar slot
   * whose item is not currently carried: a slot like that still shows so a
   * player can see what they pinned, but there is nothing yet to equip.
   */
  useItem(item: ItemId): void {
    if (!ITEM_KINDS[item].equippable) return;
    if (!this.carrying.some((entry) => entry.item === item && entry.count > 0)) return;
    this.connection?.sendUseItem(item);
  }

  /**
   * Start placing one of these, the same as pressing its number with the
   * build menu open - called when an entry in that menu is clicked.
   */
  pickBuildable(kind: BuildableKindId): void {
    this.buildMenuOpen = false;
    this.startPlacing(kind);
  }

  /** Called from the Settings menu's sensitivity slider - takes effect on the very next frame. */
  setLookSensitivity(multiplier: number): void {
    this.lookSensitivity = multiplier;
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
      remoteEquippedItem: (netId) => this.equipped.get(netId) ?? null,
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
      equippedItem: () => this.equipped.get(this.selfNetId) ?? null,
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
      craftMenuOpen: () => this.craftMenuOpen,
      builtProps: () => this.builtProps.map((prop) => ({ ...prop })),
      buildPreview: () =>
        this.placing === null
          ? null
          : {
              kind: this.placing.kind,
              spot: this.placing.plan.spot === null ? null : { ...this.placing.plan.spot },
              refusal: this.placing.plan.refusal,
            },
      buriedCaches: () => this.buriedCaches.map((cache) => ({ ...cache })),
      mapState: () => ({
        painted: this.mapFeed.image !== null,
        open: this.mapOpen,
        explored: exploredFraction(this.mapFeed.explored),
      }),
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
        // points that way: this is the angle that lines the two up. The
        // character aims the same way, as if the spot had been clicked.
        const yaw = Math.atan2(-(x - from.x), -(z - from.z));
        camera.look.yaw = yaw;
        this.aimYaw = yaw;
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
        // Every fresh connection is a clean slate on the server - this has to
        // be resent on every reconnect, not only the first one.
        const { name, character, color } = this.options.identity;
        this.connection?.sendHello(name, character, color);
        void this.enterWorld(message.seed);
        break;
      }
      case 'roster': {
        this.roster.clear();
        for (const entry of message.players) this.roster.set(entry.netId, entry);
        this.applyRoster();
        break;
      }
      case 'equipped': {
        this.equipped.clear();
        for (const entry of message.players) this.equipped.set(entry.netId, entry.item);
        this.applyEquipped();
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
        this.camera?.shake(HIT_LANDED_SHAKE);
        playTreeHit();
        // Everybody nearby hears the same chop; only play it back on our own
        // character when it was actually our swing that landed.
        if (message.netId === this.selfNetId) this.localCharacter?.swingAxe();
        break;
      }
      case 'threatHit': {
        this.threatHitsLeft.set(message.event.animalId, message.event.hitsLeft);
        this.camera?.shake(HIT_LANDED_SHAKE);
        playThreatHit();
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
        // Anything just placed that has now come back as built stops being
        // pending - it is in the list for real.
        this.pendingPlacements = this.pendingPlacements.filter(
          (pending) =>
            !message.props.some(
              (prop) =>
                prop.kind === pending.request.kind &&
                Math.abs(prop.x - pending.request.x) < 0.05 &&
                Math.abs(prop.z - pending.request.z) < 0.05,
            ),
        );
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
      case 'explored': {
        this.mapFeed.mergeFromServer(message.cells);
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
    if (event.health < this.health) {
      this.camera?.shake(TOOK_DAMAGE_SHAKE);
      playTookDamage();
    }
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
    await Promise.all([
      preloadPropModels(),
      preloadFlowerModel(),
      preloadCampfireModels(),
      preloadItemModels(),
      preloadFoxModel(),
      preloadCharacterModels(),
      preloadArtTextures(),
    ]);
    if (this.clearingScene !== null) return;

    const clearing = buildTestClearing(seed);
    const terrain = createWildernessTerrain(seed);
    const wilderness = buildWilderness(seed, terrain);

    this.clearing = clearing;
    this.clearingScene = buildClearingScene(clearing);
    this.clearingScene.setTakenPickups(this.takenPickups);
    this.scene.add(this.clearingScene.group);

    this.wildernessScene = buildWildernessScene(wilderness, terrain, clearing);
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

    this.localCharacter = createCharacter(
      this.options.identity.character,
      TINT_COLORS[this.options.identity.color].hex,
    );
    this.localCharacter.setName(this.options.identity.name);
    this.scene.add(this.localCharacter.group);

    this.mapFeed.ready = true;
    // Painted in a worker while the player gets their bearings; the minimap
    // shows blank parchment for the moment it takes.
    paintWorldMapImage(seed)
      .then((image) => {
        this.mapFeed.image = image;
      })
      .catch((error: unknown) => console.warn('Could not paint the map', error));

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
      const existing = this.builtMeshes.get(prop.id);
      if (existing !== undefined) {
        // The whole list is resent whenever anything changes, including a
        // campfire lighting up or going out, so an existing mesh needs to
        // hear about it too, not just a freshly created one.
        if ('setLit' in existing) existing.setLit(prop.lit);
        continue;
      }
      const built = createBuiltMesh(prop.kind);
      // Reflects whatever the server already thinks, not always unlit - a
      // client that joins mid-burn should see the fire going from the start.
      if ('setLit' in built) built.setLit(prop.lit);
      built.group.position.set(prop.x, 0, prop.z);
      built.group.rotation.y = prop.yaw;
      this.scene.add(built.group);
      this.builtMeshes.set(prop.id, built);
    }
    this.updateMapBuilds();
  }

  /** Your own home and builds, for the maps - only when the built list changes, not every frame. */
  private updateMapBuilds(): void {
    const builds: MapBuild[] = [];
    let home: MapFeed['home'] = null;
    for (const prop of this.builtProps) {
      if (!prop.yours) continue;
      if (BUILDABLE_KINDS[prop.kind].isHome) home = { x: prop.x, z: prop.z, yaw: prop.yaw };
      else builds.push({ kind: prop.kind, x: prop.x, z: prop.z, yaw: prop.yaw, lit: prop.lit });
    }
    this.mapFeed.home = home;
    this.mapFeed.builds = builds;
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
    this.updateMapStashes();
  }

  /** Your own buried stashes, for the maps. */
  private updateMapStashes(): void {
    this.mapFeed.stashes = this.buriedCaches
      .filter((cache) => cache.ownerNetId === this.selfNetId)
      .map((cache) => ({ x: cache.x, z: cache.z }));
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

    const entry = this.roster.get(netId);
    const character = createCharacter(this.characterKindFor(entry), this.colorFor(netId, entry));
    character.setName(entry?.name ?? null);
    character.setEquippedItem(this.equipped.get(netId) ?? null);
    this.scene.add(character.group);
    this.remoteCharacters.set(netId, character);
    return character;
  }

  /**
   * A remote player's chosen tint once the roster says what it is, or the
   * same netId-derived colour as before while we are still waiting to hear.
   */
  private colorFor(netId: number, entry: RosterEntry | undefined): THREE.ColorRepresentation {
    return entry === undefined ? colorForPlayer(netId) : TINT_COLORS[entry.color].hex;
  }

  /**
   * A remote player's chosen character once the roster says what it is, or
   * the default while we are still waiting to hear - the same brief gap
   * `colorFor` covers, just with nothing netId-derived to fall back on.
   */
  private characterKindFor(entry: RosterEntry | undefined): CharacterId {
    return entry?.character ?? DEFAULT_CHARACTER;
  }

  /**
   * Re-colour and re-label every remote character already on screen once the
   * roster changes - a Hello can arrive after the snapshot that first drew
   * somebody, not only before it.
   */
  private applyRoster(): void {
    for (const [netId, character] of this.remoteCharacters) {
      const entry = this.roster.get(netId);
      character.setColor(this.colorFor(netId, entry));
      character.setName(entry?.name ?? null);
    }
  }

  /**
   * Show every remote character holding whatever the Equipped list now says
   * it does. The local player's own hand is set every frame instead, from
   * the same map, alongside its own animation state - see `updateLocalPlayer`.
   */
  private applyEquipped(): void {
    for (const [netId, character] of this.remoteCharacters) {
      character.setEquippedItem(this.equipped.get(netId) ?? null);
    }
  }

  private removeCritter(animalId: number): void {
    const critter = this.critters.get(animalId);
    if (critter === undefined) return;
    this.scene.remove(critter.group);
    critter.dispose();
    this.critters.delete(animalId);
  }

  private critterFor(animalId: number): Critter | Raccoon | Fox {
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
    if (mouse.x !== 0 || mouse.y !== 0) {
      camera.turn(mouse.x, mouse.y, BASE_MOUSE_SENSITIVITY * this.lookSensitivity);
    }
    // A left click on the world turns the character - never the camera - to
    // face whatever is under the cursor, before the tap that comes with it is
    // read below as a swing or a cast. See decision 0051. While a piece is
    // being placed, the same click places it instead, and is never a swing.
    const clickPoint = controls.takeClickPoint();
    if (this.placing !== null) {
      if (clickPoint !== null) {
        controls.swallowLeftPress();
        this.placePiece();
      }
      this.turnPiece(controls.takeWheelSteps());
      if (controls.takeRightClickTap()) this.stopPlacing();
    } else {
      if (clickPoint !== null) this.aimTowardsClickPoint(clickPoint, camera);
      // Only a piece being placed has any use for either; left over from
      // before one was picked, they would act on it the moment it was.
      controls.takeWheelSteps();
      controls.takeRightClickTap();
    }

    // Read ahead of anything below that might forget taps for a produced
    // movement tick, so a hotbar, craft or build key pressed this frame is
    // never swallowed by that blanket clear before this gets a look at it.
    // Whichever of craft or build is open takes the same digit keys over;
    // the hotbar only gets a turn once both are closed, so every digit key
    // means one thing at a time. The inventory panel has no digit keys of
    // its own to fight over, so it does not need to join that guard.
    this.handleEscapeInput(controls);
    if (controls.takeMapToggle()) this.toggleMap();
    this.handleInventoryToggleInput(controls);
    this.handleBuildMenuInput(controls);
    this.handleCraftMenuInput(controls);
    if (!this.buildMenuOpen && !this.craftMenuOpen && this.placing === null) {
      this.handleHotbarInput(controls);
    }

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
    // Only campfires animate right now; the `in` check skips the other
    // buildable kinds sharing this map without giving them all a no-op method.
    for (const built of this.builtMeshes.values()) {
      if ('update' in built) built.update(deltaSeconds);
    }

    setup.renderer.render(this.scene, camera.camera);
    this.updateMapFeed(camera);
    this.updateHud(now, deltaSeconds);
  };

  /**
   * Where you are and which way the camera looks, for the maps, plus
   * everybody else nearby - every frame, since the minimap turns with the
   * camera. Also fills the map in around you straight away, ahead of the
   * server's own word on it (see decision 0054).
   */
  private updateMapFeed(camera: FollowCamera): void {
    const feed = this.mapFeed;
    const player = this.localPlayer;
    if (player !== null) {
      const { position, facingYaw } = player.motion;
      feed.player = { x: position.x, z: position.z, facingYaw };
      feed.revealAt(position.x, position.z);
    }
    feed.cameraYaw = camera.look.yaw;
    feed.isNight = isNight(dayProgress(this.estimatedServerTimeMs()));
    feed.others = this.remotePlayers.netIds().flatMap((netId) => {
      const pose = this.remotePlayers.poseOf(netId);
      if (pose === undefined) return [];
      return [
        {
          x: pose.x,
          z: pose.z,
          color: new THREE.Color(this.colorFor(netId, this.roster.get(netId))).getHex(),
          name: this.roster.get(netId)?.name ?? 'Somebody',
        },
      ];
    });
  }

  /**
   * B opens or closes the build menu, closing the craft menu if that was open
   * instead - only one ever shows at once, so a digit key always means one
   * thing. While it is open, a digit key picks from it and starts placing
   * that piece (see decision 0052); while a piece is being placed, the same
   * digit keys swap it for another without going back to the menu.
   */
  private handleBuildMenuInput(controls: Controls): void {
    if (controls.takeBuildMenuToggle()) {
      this.buildMenuOpen = !this.buildMenuOpen;
      if (this.buildMenuOpen) {
        this.stopPlacing();
        this.craftMenuOpen = false;
        this.inventoryOpen = false;
      }
    }
    if (!this.buildMenuOpen && this.placing === null) return;
    for (const index of controls.takeBuildTaps()) {
      const kind = BUILDABLE_KIND_ORDER[index];
      if (kind === undefined) continue;
      this.buildMenuOpen = false;
      this.startPlacing(kind);
      break;
    }
  }

  /**
   * Pick up a piece to place: its preview follows the mouse from the next
   * frame on. Swapping one piece for another keeps the way it was turned;
   * a fresh one starts squared up to the camera, so a fence runs across the
   * view and a cabin's door faces the player.
   */
  private startPlacing(kind: BuildableKindId): void {
    const yaw =
      this.placing?.yaw ??
      Math.round((this.camera?.look.yaw ?? 0) / BUILD_ROTATION_STEP) * BUILD_ROTATION_STEP;
    this.stopPlacing();
    this.craftMenuOpen = false;
    this.inventoryOpen = false;

    const ghost = createBuildGhost(createBuiltMesh(kind), buildableFootprint(kind, 0, 0, 0));
    this.scene.add(ghost.group);
    this.placing = {
      kind,
      yaw,
      ghost,
      plan: { spot: null, refusal: null, snapped: false, affordable: true },
      placedAny: false,
    };
  }

  /** Put the piece being placed away, if there is one. */
  private stopPlacing(): void {
    const placing = this.placing;
    if (placing === null) return;
    this.scene.remove(placing.ghost.group);
    placing.ghost.dispose();
    this.placing = null;
  }

  /** The mouse wheel turns the piece being placed, a step at a time. */
  private turnPiece(steps: number): void {
    if (this.placing === null || steps === 0) return;
    this.placing.yaw += steps * BUILD_ROTATION_STEP;
  }

  /**
   * Ask the server to build the piece being placed exactly where its preview
   * stands - only if the preview says it fits, since the server would only
   * refuse it anyway. A one-per-player piece puts the preview away once
   * placed; anything else stays out to place another (see decision 0052).
   */
  private placePiece(): void {
    const placing = this.placing;
    if (placing === null) return;
    const { spot, refusal } = placing.plan;
    if (spot === null || refusal !== null) return;

    const request: BuildRequest = { kind: placing.kind, x: spot.x, z: spot.z, yaw: spot.yaw };
    this.connection?.sendBuild(request);
    this.pendingPlacements.push({ request, sentAt: performance.now() });
    placing.placedAny = true;
    if (BUILDABLE_KINDS[placing.kind].capPerPlayer) this.stopPlacing();
  }

  /**
   * Move the preview to wherever the mouse points this frame, and work out
   * whether it fits. Runs after the camera has moved, so the preview never
   * trails a frame behind the view.
   */
  private updatePlacement(camera: FollowCamera, player: LocalPlayer): void {
    const placing = this.placing;
    const clearing = this.clearing;
    if (placing === null || clearing === null) return;

    const now = performance.now();
    this.pendingPlacements = this.pendingPlacements.filter(
      (pending) => now - pending.sentAt < PENDING_PLACEMENT_MS,
    );

    placing.plan = planPlacement({
      kind: placing.kind,
      yaw: placing.yaw,
      mouse: this.groundUnderPointer(camera),
      player: player.motion.position,
      snap: !(this.controls?.isShiftHeld() ?? false),
      carrying: this.carrying,
      built: this.builtProps,
      pending: this.pendingPlacements.map((pending) => pending.request),
      scenery: this.sceneryFootprints(),
      water: clearing.water,
    });

    // Placed at least one and there is nothing left to pay for the next:
    // done, the same as pressing Escape - but only once the server has
    // caught up, so the last piece's own cost is not mistaken for running out.
    if (placing.placedAny && !placing.plan.affordable && this.pendingPlacements.length === 0) {
      this.stopPlacing();
      return;
    }

    const { spot, refusal } = placing.plan;
    if (spot === null) placing.ghost.hide();
    else placing.ghost.show(spot.x, spot.z, spot.yaw, refusal === null);
  }

  /** The spot on the flat ground of the clearing under the mouse, or null if it points at the sky. */
  private groundUnderPointer(camera: FollowCamera): { x: number; z: number } | null {
    const pointer = this.controls?.pointerPosition() ?? null;
    if (pointer === null) return null;
    this.clickNdc.set(
      (pointer.x / window.innerWidth) * 2 - 1,
      -(pointer.y / window.innerHeight) * 2 + 1,
    );
    this.clickRaycaster.setFromCamera(this.clickNdc, camera.camera);
    const hit = this.clickRaycaster.ray.intersectPlane(this.groundPlane, this.groundHit);
    return hit === null ? null : { x: hit.x, z: hit.z };
  }

  /** Every tree, rock and stump, as the same footprints the server checks a build against. */
  private sceneryFootprints(): Footprint[] {
    return this.standingProps.map((prop) =>
      roundFootprint(
        prop.x,
        prop.z,
        PROP_KINDS[prop.kind].colliderRadius * prop.scale,
        this.isFelled(prop.id) ? 'stump' : PROP_KINDS[prop.kind].displayName.toLowerCase(),
      ),
    );
  }

  /**
   * C opens or closes the craft menu, closing the build menu if that was
   * open instead, the same reason opening the build menu closes this one.
   * While it is open, a digit key sends a craft request - unlike the build
   * menu this stays open afterwards, since crafting several things in a row
   * is common and nothing about a craft needs a fresh aim the way a
   * placement does.
   */
  private handleCraftMenuInput(controls: Controls): void {
    if (controls.takeCraftMenuToggle()) {
      this.craftMenuOpen = !this.craftMenuOpen;
      if (this.craftMenuOpen) {
        this.buildMenuOpen = false;
        this.inventoryOpen = false;
      }
    }
    if (!this.craftMenuOpen) return;
    for (const index of controls.takeCraftTaps()) {
      const item = RECIPE_ITEMS[index];
      if (item !== undefined) this.connection?.sendCraft(item);
    }
  }

  /** I opens or closes the inventory panel, closing craft or build if either was open. */
  private handleInventoryToggleInput(controls: Controls): void {
    if (!controls.takeInventoryToggle()) return;
    this.inventoryOpen = !this.inventoryOpen;
    if (this.inventoryOpen) {
      this.buildMenuOpen = false;
      this.craftMenuOpen = false;
    }
  }

  /**
   * Turn a hotbar slot picked this frame into a request to equip whatever
   * item is shown there - eating it too, if it is food, exactly as the
   * server's own `useItem` does. Only reached once neither menu is open, so
   * this never fires alongside a craft or a build off the very same key.
   * Resolved through `resolveHotbarSlots` so a key press always agrees with
   * whatever that same slot is showing on screen, pinned or not.
   */
  private handleHotbarInput(controls: Controls): void {
    const resolved = resolveHotbarSlots(this.carrying, this.options.hud.getSnapshot().hotbarSlots);
    for (const index of controls.takeHotbarTaps()) {
      const item = resolved[index];
      if (item !== undefined && item !== null) this.useItem(item);
    }
  }

  /**
   * Turn the character - not the camera - to face whatever is under a
   * screen-space click: the first tree or animal under the cursor, or else
   * the patch of ground or water it lands on. The same thing the debug
   * `faceTowards` does for the smoke tests, just aimed from a real click.
   * A click that lands on nothing at all (open sky, say) or right at the
   * character's own feet keeps whatever heading it already had.
   */
  private aimTowardsClickPoint(point: { x: number; y: number }, camera: FollowCamera): void {
    const from = this.motionOrOrigin();

    // `camera.camera`'s actual position and rotation only get recomputed
    // once a frame, inside `updateLocalPlayer` below - this runs earlier
    // than that, right after a right-button drag may just have changed
    // `look.yaw`. A zero-time update brings the real object in line with
    // `look` right now, with nothing else in it gated by elapsed time, so
    // the ray below starts from where the camera actually is rather than
    // wherever it last rendered a frame ago. It moves nothing the player
    // can see: the camera is only caught up, never turned.
    const wilderness = this.wildernessScene;
    const clearing = this.clearingScene;
    if (wilderness !== null && clearing !== null) {
      camera.update(from, 0, [wilderness.cameraBlockers, clearing.cameraBlockers]);
    }

    this.clickNdc.set(
      (point.x / window.innerWidth) * 2 - 1,
      -(point.y / window.innerHeight) * 2 + 1,
    );
    this.clickRaycaster.setFromCamera(this.clickNdc, camera.camera);

    const yaw = clickAimYaw(this.clickRaycaster.ray, from, from.y, this.clickCandidates());
    if (yaw !== null) this.aimYaw = yaw;
  }

  /**
   * Everything a click can land on, as upright cylinders: each standing
   * tree as a trunk and a canopy that both face its trunk, and each animal.
   * Rebuilt per click rather than kept up to date - a click is rare, and a
   * couple of hundred small objects is nothing to make once.
   */
  private clickCandidates(): ClickCandidate[] {
    const candidates: ClickCandidate[] = [];
    for (const prop of this.standingProps) {
      if (this.isFelled(prop.id)) continue;
      const kind = PROP_KINDS[prop.kind];
      if (kind.shape.family !== 'tree') continue;
      const base = prop.y ?? 0;
      const trunkTop = base + kind.shape.trunkHeight * prop.scale;
      candidates.push({
        x: prop.x,
        z: prop.z,
        radius: Math.max(kind.colliderRadius * prop.scale, CLICK_TRUNK_MIN_RADIUS),
        bottom: base,
        top: trunkTop,
      });
      candidates.push({
        x: prop.x,
        z: prop.z,
        radius: kind.shape.canopyRadius * prop.scale * CLICK_CANOPY_FRACTION,
        bottom: base + kind.shape.trunkHeight * prop.scale * 0.6,
        top: trunkTop + kind.shape.canopyHeight * prop.scale,
      });
    }
    for (const id of this.remoteAnimals.netIds()) {
      const pose = this.remoteAnimals.poseOf(id);
      if (pose === undefined) continue;
      candidates.push({
        x: pose.x,
        z: pose.z,
        radius: CLICK_ANIMAL_RADIUS,
        bottom: pose.y,
        top: pose.y + CLICK_ANIMAL_HEIGHT,
      });
    }
    return candidates;
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
    // The left button places a piece while one is out, so it is never also
    // a swing or a charge then.
    const placingMask = this.placing === null ? ~0 : ~(PlayerButton.Swing | PlayerButton.Charge);
    const buttons =
      ((this.controls?.buttons() ?? 0) & placingMask) |
      (this.fishingPhase === 'biting' ? PlayerButton.SawBite : 0);

    // A fresh press starts the same local timer the server's own charge
    // runs on - only worth starting if a swing would even do anything, which
    // needs the axe active, not merely carried.
    const chargeHeld = (buttons & PlayerButton.Charge) !== 0;
    if (chargeHeld && !this.chargeWasHeld && this.isEquipped('axe')) {
      this.chargingUntil = performance.now() + CHARGE_SECONDS * 1000;
    }
    this.chargeWasHeld = chargeHeld;

    // Walking off lets go of whatever was clicked: the character aims the
    // way it walks again. Not while charging, which roots it to the spot
    // facing whatever it is about to hit.
    if ((intent.x !== 0 || intent.z !== 0) && !chargeHeld) this.aimYaw = null;

    const produced = player.advance(
      deltaSeconds,
      intent.x,
      intent.z,
      camera.look.yaw,
      buttons,
      this.aimYaw,
    );
    const aimYaw = this.aimYaw ?? player.motion.facingYaw;
    // A tap is only forgotten once a tick has carried it, so a quick press of
    // Space between two frames still turns into a jump.
    if (produced.length > 0) this.controls?.forgetTaps();
    for (const input of produced) this.connection?.send(input);

    const position = player.renderPosition(this.scratch);
    character.group.position.set(position.x, position.y, position.z);
    character.group.rotation.y =
      this.facingWhileFishing(this.selfNetId, position) ?? player.renderYaw();

    // The same thresholds the server judges everyone else's snapshot by (see
    // SnapshotFlag), so the local player's own animation reads the same way
    // it would to someone watching them from across the clearing.
    const velocity = player.motion.velocity;
    const speedSquared = velocity.x * velocity.x + velocity.z * velocity.z;
    character.setAnimationState(
      pickAnimationState(
        speedSquared > 0.04,
        speedSquared > SPRINT_REPORTING_SPEED * SPRINT_REPORTING_SPEED,
        !player.motion.grounded,
      ),
    );
    character.setEquippedItem(this.equipped.get(this.selfNetId) ?? null);
    character.update(deltaSeconds);

    camera.update(position, deltaSeconds, [wilderness.cameraBlockers, clearing.cameraBlockers]);
    this.updatePlacement(camera, player);

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
    // A way back to it otherwise, so it is not just something to stumble
    // back onto by luck out in the wilderness - hidden the moment the hint
    // above takes over.
    this.ownCacheCompass = this.nearBuriedCache
      ? null
      : compassToOwnCache(
          player.motion.position,
          this.buriedCaches,
          this.selfNetId,
          camera.look.yaw,
        );

    // Same idea, only a hint: the server is the one that actually decides
    // whether a press lights it, puts it out, or does nothing at all.
    const nearbyCampfire = nearestCampfire(player.motion.position, this.builtProps);
    this.nearCampfire = nearbyCampfire === null ? null : nearbyCampfire.lit ? 'lit' : 'unlit';

    const target =
      this.clearing === null
        ? null
        : treeInReach(player.motion.position, aimYaw, this.standingProps, (id) =>
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
    const animalTarget = animalInReach(player.motion.position, aimYaw, animalCandidates);
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
    // gets the click first, and otherwise an active rod and some water in
    // front of you make a cast. Both need the tool active, not just carried.
    const axeHasSomethingToHit =
      (target !== null || animalTarget !== null) && this.isEquipped('axe');
    this.canCast =
      this.fishingPhase === null &&
      performance.now() >= this.castReadyAt &&
      !axeHasSomethingToHit &&
      this.isEquipped('rod') &&
      this.clearing !== null &&
      castLanding(player.motion.position, aimYaw, this.clearing.water) !== null;

    // Its own key, so it never competes with a swing or a cast for the click.
    // Offered whenever something could be afforded and the player is inside
    // the clearing, where building happens - exactly where it fits is the
    // preview's job once a piece is picked (see decision 0052).
    const canAfford = (kind: BuildableKindId): boolean =>
      BUILDABLE_KINDS[kind].costs.every(
        (cost) =>
          (this.carrying.find((entry) => entry.item === cost.item)?.count ?? 0) >= cost.amount,
      );
    this.canBuild =
      this.clearing !== null &&
      Math.hypot(player.motion.position.x, player.motion.position.z) < CLEARING_TREE_LINE_INNER &&
      BUILDABLE_KIND_ORDER.some(canAfford);

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

  /**
   * Whether this item is the one currently active - not just somewhere in
   * the pack. The server gates chopping, casting and eating on exactly this,
   * so hints and local prediction have to agree, or a hint would promise an
   * action the server then refuses.
   */
  private isEquipped(item: ItemId): boolean {
    return this.equipped.get(this.selfNetId) === item;
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
      character.setAnimationState(pickAnimationState(pose.moving, pose.sprinting, pose.airborne));
      character.update(deltaSeconds);
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
      equippedItem: this.equipped.get(this.selfNetId) ?? null,
      nearbyItem: this.nearbyItem,
      nearGatherSpot: this.nearGatherSpot,
      nearBuriedCache: this.nearBuriedCache,
      ownCacheCompass: this.ownCacheCompass,
      nearCampfire: this.nearCampfire,
      aimedTree: this.aimedTree,
      aimedAnimal: this.aimedAnimal,
      canBuild: this.canBuild,
      placing:
        this.placing === null
          ? null
          : {
              name: BUILDABLE_KINDS[this.placing.kind].displayName,
              refusal: this.placing.plan.refusal,
              canSnap: this.placing.kind === 'fence',
            },
      playing: this.playing,
      buildMenuOpen: this.buildMenuOpen,
      craftMenuOpen: this.craftMenuOpen,
      inventoryOpen: this.inventoryOpen,
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
      mapOpen: this.mapOpen,
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
