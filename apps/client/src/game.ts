import { fishRecordsFromSaved, type FishRecords, type ReelView } from '@acorn/shared';
import { createExpeditionBoard } from './scene/expedition-board';
import {
  emptyExpedition,
  expeditionBoardSpot,
  type ExpeditionRequest,
  type ExpeditionView,
} from '@acorn/shared';
import {
  DECORATION_KINDS,
  isDecorationKind,
  isIndoorOnlyKind,
  checkDecorationSpot,
  decorationCollider,
  canAfford,
  type HomeDecoration,
  type DecorationState,
} from '@acorn/shared';
import { createHomeDecoration } from './scene/home-decoration';
import { forestWeather } from '@acorn/shared';
import { createForestWeather } from './scene/forest-weather';
import {
  NO_MEAL,
  mealCooldown,
  type MealState,
  DODGE,
  DODGE_ATTACKS,
  TICK_HZ,
} from '@acorn/shared';
import { createAnimalTracks } from './scene/animal-tracks';
import { combineHomeSupplies, type HomeSupplies, woodlandTrackHint } from '@acorn/shared';
import { createWoodlandCreature, type WoodlandCreature } from './scene/woodland-creatures';
import { createGuardianTrophy } from './scene/guardian-trophy';
import {
  WOODLAND_ENCOUNTERS,
  homeBuildArea,
  HOME_BUILD_RADII,
  type ProtectedBuildSite,
} from '@acorn/shared';
import { createBuildBoundary } from './scene/build-boundary';
import { groundAlongRay } from './building/ground-ray';
import { createDiscoveryLandmarks } from './scene/discovery-sites';
import { homeFacilityInReach, toolKind } from '@acorn/shared';
import { emptyGarden, type GardenRequest, type GardenState } from '@acorn/shared';
import {
  DISCOVERIES,
  discoveryKnown,
  buildDiscoverySites,
  discoveryColliders,
  type DiscoverySite,
} from '@acorn/shared';
import { buildEncounterSites, encounterColliders } from '@acorn/shared';
import { createEncounterLandmarks } from './scene/encounter-sites';
import {
  knowsHome,
  blueprintHome,
  HOME_TIERS,
  homeChestSpot,
  homeRoomScale,
  isHomeKind,
  nextHome,
  type HomeKind,
} from '@acorn/shared';
import * as THREE from 'three/webgpu';

import {
  ANIMAL_DENS,
  ANIMAL_KINDS,
  BUILDABLE_KINDS,
  BUILDABLE_KIND_ORDER,
  BUILD_ROTATION_STEP,
  DOORWAY_REACH,
  HOME_ROOM,
  type ChestRequest,
  type ChestReason,
  OUTDOORS,
  ActionKind,
  CAST_COOLDOWN_SECONDS,
  DEFAULT_CHARACTER,
  DEFAULT_WORLD_SEED,
  HEALTH_MAX,
  HUNGER_MAX,
  PICKUP_REACH,
  ITEM_KINDS,
  LIGHT_COMBO,
  STRIKE,
  TICK_SECONDS,
  isFreeToInteract,
  restingPlaceInReach,
  POND_FISH,
  PROP_KINDS,
  roomFor,
  inventoryFromEntries,
  type CollectedEvent,
  treeLogSpots,
  RAIDER_KINDS,
  PlayerButton,
  SPAWN_POSITION,
  SnapshotFlag,
  TINT_COLORS,
  animalInReach,
  buildTestClearing,
  buildableFootprint,
  cabinCollider,
  cabinDoorstep,
  cabinDoorway,
  createFlatTerrain,
  homeRoomColliders,
  isEnteringDoorway,
  isLeavingRoom,
  worldMoveDirection,
  buildWilderness,
  calendarAt,
  LAKE,
  PLAYABLE_HALF_EXTENT,
  castLanding,
  clockShiftForSeason,
  type WaterCircle,
  choppingRuleFor,
  colliderForProp,
  createCollisionWorld,
  setLakeFrozen,
  createWildernessTerrain,
  dayBrightness,
  dayProgress,
  droppedPileInReach,
  gatherSpotInReach,
  isDiscardable,
  isNight,
  seasonMix,
  exploredFraction,
  nearestBuriedCache,
  nearestCampfire,
  isWithinBoardingReach,
  landingFrom,
  pickupInReach,
  isReedPatch,
  reedFootprints,
  replaceCollider,
  roundFootprint,
  stumpColliderFor,
  treeAtGeneration,
  treeInReach,
  unpackActionByte,
  createActionState,
  vec3,
  wrapAngle,
  type AnimalCaught,
  type AnimalKind,
  type AnimalKindId,
  type BuildRequest,
  type BuildableKindId,
  type BuiltPropView,
  type Footprint,
  type BuriedCacheView,
  type CacheEvent,
  type Calendar,
  type CharacterId,
  type Clearing,
  type CollisionWorld,
  type CraftedEvent,
  type SeasonId,
  type CookedEvent,
  type ActionContext,
  type DiscardedEvent,
  type DroppedPileView,
  type GatherPatchView,
  type FishingEvent,
  type GestureEvent,
  type HealthEvent,
  type HungerEvent,
  type Impact,
  type ItemId,
  type PlacedProp,
  type RaidNews,
  type RaiderHit,
  type RosterEntry,
  type ServerMessage,
  type SnapshotEntity,
  type ActionState,
  type Vec3,
} from '@acorn/shared';

import { FollowCamera } from './camera/follow-camera';
import { Controls } from './input/controls';
import { clickAimYaw, yawTowards, type ClickCandidate } from './input/click-target';
import { lootUnderRay, type LootTarget } from './input/loot-target';
import { SignInError, resumeAccount } from './net/account';
import { WorldConnection, worldSocketUrl, type ConnectionState } from './net/connection';
import { LocalPlayer, type PredictedEvent } from './net/local-player';
import { InterpolatedEntities } from './net/interpolated-entities';
import { GatheringFocus } from './scene/gathering-focus';
import { ForestAtmosphere } from './audio/forest-atmosphere';
import { ForestAudio } from './audio/forest-sounds';
import { createForestEnvironment, type ForestEnvironment } from './audio/forest-environment';
import { TreeLandingEffects } from './scene/tree-landing';
import { PickupNoticeShelf } from './hud/pickup-notice';
import {
  choosingPiece,
  craftMenuEntries,
  entriesOnTab,
  shownTab,
  type CraftAction,
  type CraftEntry,
  type CraftTabId,
} from './hud/craft-menu';
import { playPickupRefused, playTreeLanding, playCollection } from './audio/feedback';
import {
  buildClearingScene,
  type ClearingScene,
  type TreeLanding,
  type TreeAppearance,
} from './scene/clearing';
import { createGroundItems, type GroundItems } from './scene/ground-items';
import { buildWildernessScene, type WildernessScene } from './scene/wilderness';
import { createLakeScene } from './scene/lake';
import { preloadPropModels } from './scene/prop-models';
import { preloadFlowerModel } from './scene/flower-models';
import { preloadCampfireModels } from './scene/campfire-models';
import { preloadItemModels } from './scene/item-models';
import { preloadCharacterModels } from './scene/character-model';
import { preloadCharacterAnimations } from './scene/character-animations';
import { preloadRaiderModels } from './scene/raider-model';
import { RaiderCrowd, type FlatPoint } from './scene/raiders';
import { MoveMemory, boatSeatAt, restSpotFor, rollDirection } from './scene/character-driver';
import {
  playSwoosh,
  playThreatHit,
  playTookDamage,
  playTreeHit,
  startAmbientMusic,
} from './audio/sound';
import { playRaidHorn, playRaidOver, playVictory } from './audio/raid-sounds';
import {
  colorForPlayer,
  createCharacter,
  type Character,
  type FishingPose,
} from './scene/character';
import { isSweeping, type MovePose } from './scene/character-moves';
import { ImpactBursts } from './scene/impact-bursts';
import { WeaponTrail } from './scene/weapon-trail';
import { createCampfire, type Campfire } from './scene/campfire';
import { createBuriedCacheMound, type BuriedCacheMound } from './scene/buried-cache';
import { createShelter } from './scene/shelter';
import { createLargeCabin } from './scene/large-cabin';
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
import { rainShareFor } from './art/season-fall';
import { seasonUniforms } from './art/season-uniforms';
import { Floats, type Angler } from './scene/floats';
import { addDaylight, type DaylightRig } from './scene/lighting';
import { createSeasonFall } from './scene/season-fall';
import { createSeasonRig } from './scene/seasons';
import { FireLights } from './scene/fire-light';
import { installBvhRaycasting } from './scene/bvh';
import { createRenderer, type RendererSetup } from './scene/renderer';
import { createBuildGhost, type BuildGhost } from './scene/build-ghost';
import { createRowboat, type Rowboat } from './scene/rowboat';
import { RowingBoats } from './scene/rowing-boats';
import { createGrass, type GrassScene } from './scene/grass';
import { createHomeInterior, type HomeInterior } from './scene/home-interior';
import { planPlacement, type PlacementPlan } from './building/placement';
import type { BoatHint, FishingPhase, HudStore, RaidBanner } from './hud/store';
import { compassTo, compassToOwnCache, type Compass } from './hud/cache-compass';
import { CombatFeed, type ThreatMark } from './hud/combat-feed';
import { raidBannerFor } from './hud/raid-banner';
import { SignOutCountdown } from './hud/sign-out';
import {
  expeditionBoardClaimsInteract,
  expeditionBoardOpen,
  type BoardClaimState,
} from './hud/board-claim';
import { resolveHotbarSlots } from './hud/hotbar-layout';
import { amountOf } from './hud/item-words';
import { ToastShelf, packGains } from './hud/toasts';
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
 * Going through a door (see decision 0055): how long the screen stays dark
 * once we are through, so the new place has drawn before it shows, and how
 * long a fade started by walking at a door waits for the server before
 * giving up (a locked door, say) and lifting again.
 */
const DOOR_FADE_HOLD_MS = 140;
const DOOR_FADE_GIVE_UP_MS = 800;
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
/** How close to the expedition board's spot you can stand and still use it. */
const EXPEDITION_BOARD_REACH = 2.5;
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
/** How much bigger everything about a charged strike's blow is than a light one's. */
const CHARGED_BLOW = 1.6;
/** How far out from a tree's middle its bark is, near enough, where chips fly from. */
const TRUNK_FACE = 0.3;
/** How high up a blow lands on a tree, and on an animal, in metres. */
const BLOW_HEIGHT_ON_TREE = 0.9;
const BLOW_HEIGHT_ON_ANIMAL = 0.25;
/** How far an animal is knocked back by a blow, in metres, how far its head goes up, and for how long. */
const ANIMAL_JOLT_DISTANCE = 0.22;
const ANIMAL_JOLT_TILT = 0.45;
const ANIMAL_JOLT_SECONDS = 0.4;

/** An animal knocked back by a blow: which way, and how far into it. */
interface AnimalJolt {
  readonly awayX: number;
  readonly awayZ: number;
  age: number;
  readonly strength: number;
}

/** Which way a blow from `from` travels on into `to`, flat along the ground. */
function awayFrom(
  from: Readonly<{ x: number; z: number }>,
  to: Readonly<{ x: number; z: number }>,
): { x: number; z: number } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  return length < 1e-6 ? { x: 0, z: -1 } : { x: dx / length, z: dz / length };
}
/**
 * How far into a knockout the screen starts going dark, in ticks: after the
 * fall has played out, with time to go fully dark before waking up.
 */
const KNOCKOUT_DARKENS_AT_TICKS = 18;
/** Camera-shake strength for taking damage ourselves - sharper than landing one. */
const TOOK_DAMAGE_SHAKE = 0.55;

/** Buttons that count as "still playing" for the sign-out countdown (decision 0104). */
const ACTIVE_BUTTONS =
  PlayerButton.Jump |
  PlayerButton.Swing |
  PlayerButton.Charge |
  PlayerButton.Dodge |
  PlayerButton.Fish;
/**
 * Skeleton raids (see decision 0063): how far off somebody else's raid
 * still gets the horn and a banner, and how long a banner stays up - the
 * length of its own animation in styles.css.
 */
const RAID_HEARD_WITHIN = 60;
const RAID_BANNER_MS = 4600;
/** Closer than this, a skeleton is worth a hint about fighting it. */
const RAIDER_CLOSE_WITHIN = 12;
/** Further off than this, a skeleton out of sight gets no arrow pointing at it. */
const THREAT_ARROWS_WITHIN = 60;
/**
 * How far a swing reaches round to find a skeleton, and how far either side
 * of the way it was meant to go - so a fight is about timing, not about
 * lining up the camera to the degree.
 */
const SOFT_LOCK_RANGE = 3.4;
const SOFT_LOCK_HALF_ANGLE = 1.4;
/** A blow from a skeleton swinging no further off than this counts as from it, for showing where it came from. */
const HURT_FROM_WITHIN = 4;
/** How much health a blow has to take to flash the screen at full strength. */
const HURT_FULL_FLASH = 30;
/**
 * How generous a click on a tree is. A trunk is only a hand or two across,
 * so it counts as at least this wide; a canopy counts as most of its drawn
 * width, leaving the ragged edge of the leaves to whatever is behind it.
 */
const CLICK_TRUNK_MIN_RADIUS = 0.35;
const CLICK_CANOPY_FRACTION = 0.8;
/** Trees further than this from the player are not worth testing a click against. */
const CLICK_TREE_RANGE = 60;
/** How big a skeleton is to click on: about as wide and tall as one stands. */
const CLICK_RAIDER_RADIUS = 0.45;
const CLICK_RAIDER_HEIGHT = 1.5;
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

/** So do skeleton raiders (see decision 0063). */
function isRaiderEntity(entity: SnapshotEntity): boolean {
  return (entity.flags & SnapshotFlag.Raider) !== 0;
}

/** The placeholder model for whatever kind of thing somebody built. */
function createBuiltMesh(
  kind: BuildableKindId,
):
  | Campfire
  | Cabin
  | FlowerBed
  | Lantern
  | Fence
  | GardenPath
  | Rowboat
  | ReturnType<typeof createHomeDecoration> {
  if (isHomeKind(kind)) {
    const home =
      kind === 'tent' || kind === 'teepee'
        ? createShelter(kind)
        : kind === 'largeCabin'
          ? createLargeCabin()
          : createCabin();
    const board = createExpeditionBoard(),
      spot = expeditionBoardSpot({ kind, x: 0, z: 0, yaw: 0 });
    board.group.position.set(spot.x, 0, spot.z);
    home.group.add(board.group);
    const dispose = home.dispose;
    home.dispose = () => {
      dispose();
      board.dispose();
    };
    return home;
  }
  switch (kind) {
    case 'campfire':
      return createCampfire();
    case 'flowerBed':
      return createFlowerBed();
    case 'lantern':
      return createLantern();
    case 'fence':
      return createFence();
    case 'gardenPath':
      return createGardenPath();
    case 'guardianTrophy':
      return createGuardianTrophy();
    case 'rowboat':
      return createRowboat();
    case 'cedarBench':
    case 'timberTable':
    case 'wovenRug':
    case 'fernLantern':
    case 'moonLantern':
    case 'flowerPlanter':
    case 'trailPennant':
    case 'sentinelTrophy':
    case 'fishDisplay':
    case 'goldenFishDisplay':
      return createHomeDecoration(kind);
  }
}

/** The placeholder model for whichever kind of wildlife this happens to be. */
function createCritterFor(kind: AnimalKindId): Critter | Raccoon | Fox | WoodlandCreature {
  switch (kind) {
    case 'rabbit':
      return createCritter();
    case 'maskedRaccoon':
      return createRaccoon();
    case 'fox':
      return createFox();
    case 'elk':
    case 'curiousRaccoon':
    case 'woodlandGuardian':
      return createWoodlandCreature(kind);
  }
}

/** A den never moves or changes kind, so this is all a client ever needs to tell them apart. */
function animalKindOf(animalId: number): AnimalKindId | undefined {
  return ANIMAL_DENS.find((den) => den.id === animalId)?.kind;
}

/** The cabin's block as a box the camera can bump into - see `homeCameraBlockers`. */
function homeCameraBlocker(home: BuiltPropView, groundY = 0): THREE.Mesh {
  const collider = cabinCollider(home, groundY);
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(
      collider.shape === 'box' ? collider.halfX * 2 : 5,
      HOME_CAMERA_BLOCKER_HEIGHT,
      collider.shape === 'box' ? collider.halfZ * 2 : 4,
    ),
  );
  box.position.set(collider.x, groundY + HOME_CAMERA_BLOCKER_HEIGHT / 2, collider.z);
  box.rotation.y = home.yaw;
  box.updateMatrixWorld(true);
  return box;
}

/** From the ground to the ridge of the roof, and the chimney. */
const HOME_CAMERA_BLOCKER_HEIGHT = 5;

/** What the smoke tests and the browser console can read out of a running game. */
export interface GameDebug {
  selfNetId(): number;
  grassClumps(): number;
  combatMove(): { kind: number; age: number; grounded: boolean };
  weatherEffects(): { rainDrops: number; fireflies: number };
  /** How much of the ground and grass is under snow right now, from 0 to 1. */
  snowOnGround(): number;
  /** How many petals, pollen specks, leaves and snowflakes are drifting in view. */
  seasonFall(): { petals: number; pollen: number; leaves: number; snow: number };
  buildBoundaryVisible(): boolean;
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
  /**
   * Every stick and flower patch, wherever the server last said it is, and
   * how many it has left - none while it is picked clean and growing back.
   */
  gatherSpots(): Array<{ id: number; x: number; z: number; item: string; remaining: number }>;
  /** Everything anybody has dropped that is still lying about. */
  droppedPiles(): Array<{ id: number; item: string; count: number; x: number; z: number }>;
  /** What is within reach right now, if anything. */
  nearbyItem(): string | null;
  /** Something dropped within reach right now, if anything. */
  nearbyPile(): { item: string; count: number } | null;
  /** The toasts showing right now: what each one says it gained, and how many. */
  toasts(): Array<{ item: string; count: number }>;
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
  /** Every skeleton raider in sight (see decision 0063), and how many blows each still needs. */
  raiders(): Array<{ id: number; kind: string; x: number; z: number; hitsLeft: number }>;
  /** The skeleton a swing would land on right now, if any. */
  aimedRaider(): { name: string; hitsLeft: number } | null;
  /** The raid banner showing right now, if any: its big words. */
  raidBanner(): string | null;
  /** Whether at least one buildable kind could be placed right where you stand. */
  canBuild(): boolean;
  /** Whether the room-decorating panel (opened with B indoors) is currently showing. */
  buildMenuOpen(): boolean;
  /** Whether the Craft menu (opened with C, or B outdoors) is currently showing. */
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
    /** A rowboat somebody is rowing. */
    occupied?: boolean;
  }>;
  /**
   * Boats on the water (see decision 0093): how many moored ones are drawn,
   * and the ones drawn under riders, wherever they are this frame.
   */
  boats(): {
    moored: number;
    rowed: Array<{ netId: number; x: number; z: number; yaw: number }>;
  };
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
   * Where we are (see decision 0055): 0 outdoors, or the built-prop id of the
   * home we are inside.
   */
  space(): number;
  /**
   * Turn the camera towards a spot in the world.
   *
   * The same thing the mouse does, and no more: the camera heading has always
   * been the client's to choose, and is sent to the server with every input.
   * Smoke tests use it so they can walk somewhere without steering by hand.
   */
  faceTowards(x: number, z: number): void;
  /** Project a world point for browser interaction tests, without changing game state. */
  screenPoint(x: number, y: number, z: number): { x: number; y: number } | null;
  /** The pond, as the circles it is made of. */
  pond(): Array<{ x: number; z: number; radius: number }>;
  /** The lake's shape, as the world was built: its blobs of water and its islands. */
  lake(): { basin: Array<{ x: number; z: number; radius: number }>; islands: string[] };
  /** Whether the server has told us the lake is frozen over. */
  lakeFrozen(): boolean;
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
  /** The last thing said about what we cooked, if it is still on screen. */
  cookingNews(): string | null;
  /** The last thing said about what we caught, if it is still on screen. */
  huntingNews(): string | null;
  /** The last thing said about what we dropped or destroyed, if it is still on screen. */
  discardNews(): string | null;
}

export interface GameOptions {
  readonly canvas: HTMLCanvasElement;
  readonly hud: HudStore;
  readonly identity: PlayerIdentity;
  readonly worldId: string;
  readonly forceWebGL: boolean;
  /** A multiplier on `BASE_MOUSE_SENSITIVITY`, from the Settings menu. */
  readonly lookSensitivity: number;
  readonly grassDensity: number;
  /** Look at the world in this season whatever the calendar says: `?season=` in the address, for testing. */
  readonly season?: SeasonId;
  /**
   * Forget who is signed in and go back to the front page (decision 0104). Called
   * once the sign-out countdown runs out; rejects if the site could not be reached.
   */
  readonly signOut: () => Promise<void>;
}

/** Everything that makes up a running game. */
export class Game {
  private readonly options: GameOptions;
  /** Live-adjustable from the Settings menu - see `setLookSensitivity`. */
  private lookSensitivity: number;
  private grassDensity: number;
  private grass: GrassScene | null = null;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly scene = new THREE.Scene();
  private readonly remotePlayers = new InterpolatedEntities();
  private readonly remoteCharacters = new Map<number, Character>();
  /** What the server's Roster says about everybody currently connected. */
  private readonly roster = new Map<number, RosterEntry>();
  /** What the server's Equipped list says everybody currently has in hand, including ourselves. */
  private readonly equipped = new Map<number, ItemId | null>();
  private readonly remoteAnimals = new InterpolatedEntities();
  private readonly critters = new Map<number, Critter | Raccoon | Fox | WoodlandCreature>();
  private readonly builtMeshes = new Map<
    number,
    | Campfire
    | Cabin
    | FlowerBed
    | Lantern
    | Fence
    | GardenPath
    | ReturnType<typeof createHomeDecoration>
  >();
  private builtProps: readonly BuiltPropView[] = [];
  private decorations: readonly HomeDecoration[] = [];
  private decorMoveId = 0;
  private decorNote: string | null = null;
  private readonly decorModels: ReturnType<typeof createHomeDecoration>[] = [];
  private homeStoredSupplies: HomeSupplies['items'] = [];
  private meal: MealState = { ...NO_MEAL };
  private mealHeardAt = 0;
  private homeSkills = 0;
  private homeSkillsHeard = false;
  private interiorKind: HomeKind | null = null;
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
  private recoveryMarkers: readonly BuriedCacheView[] = [];
  private recoveryHeard = false;
  private buriedCaches: readonly BuriedCacheView[] = [];
  /** Whether a cache of our own is close enough right now to dig up. */
  private nearBuriedCache = false;
  /** The way back to a buried cache of our own, once it is a real walk rather than something already in reach. */
  private ownCacheCompass: Compass | null = null;
  /** Whether a campfire is close enough right now to light or put out, and which. */
  private nearCampfire: 'lit' | 'unlit' | null = null;
  /** What E would do about a rowboat right now, for the hint line. */
  private boatHint: BoatHint = null;
  private nearWorkbench = false;
  private nearGarden = false;
  private garden: GardenState = {
    homeId: 0,
    yours: false,
    plots: emptyGarden(),
    reason: 'unavailable',
  };
  private canBuild = false;
  private buildBoundary: ReturnType<typeof createBuildBoundary> | null = null;
  private protectedBuildSites: ProtectedBuildSite[] = [];
  private buildMenuOpen = false;
  private craftMenuOpen = false;
  private expedition: ExpeditionView = { ...emptyExpedition(), offers: [0, 1, 2], notice: 'none' };
  private expeditionPendingUntil = 0;
  private journalTab: 'craft' | 'discoveries' | 'garden' | 'expeditions' | 'fishing' = 'craft';
  private craftTab: CraftTabId = 'all';
  private discoveriesFound = 0;
  private discoveriesClaimed = 0;
  private discoverySites: readonly DiscoverySite[] = [];
  private animalTracks: ReturnType<typeof createAnimalTracks> | null = null;
  private discoveryLandmarks: ReturnType<typeof createDiscoveryLandmarks> | null = null;
  private receivedDiscoveryState = false;
  /** Whether the curtain has been dismissed - see `resume`/`pause`. */
  private playing = false;
  private settingsOpen = false;
  private readonly signOutCountdown: SignOutCountdown;
  private inventoryOpen = false;
  /** Whether the big map (M) is open - see decision 0054. */
  private mapOpen = false;
  /**
   * Where we are, as the server last said (see decision 0055): `OUTDOORS`,
   * or inside the home with this built-prop id, in its room's own coordinates.
   */
  private space = OUTDOORS;
  /** Word of where we are that arrived before there was a world to put us in. */
  private pendingSpace: { space: number; x: number; z: number; yaw: number } | null = null;
  /** Everything out in the world, hidden all at once while we are inside a home. */
  private readonly outdoors = new THREE.Group();
  /** The boat under everybody who is rowing one, drawn wherever they are this frame. */
  private readonly rowingBoats = new RowingBoats(this.outdoors);
  /** The room inside a home, built the first time anybody goes in. */
  private homeInterior: HomeInterior | null = null;
  /** The walls and furniture of a room, shared by every home, in its own coordinates. */
  private roomCollision = createCollisionWorld(
    createFlatTerrain(0),
    homeRoomColliders(),
    HOME_ROOM.halfWidth + HOME_ROOM.wallThickness,
  );
  /** Homes already made solid in `collision`, so a resent list never adds one twice. */
  private readonly solidHomes = new Map<number, ReturnType<typeof cabinCollider>>();
  /**
   * A plain box the size of each home, never drawn: only there so the
   * camera pulls in rather than ending up inside somebody's walls.
   */
  private readonly homeCameraBlockers: THREE.Mesh[] = [];
  /** A dark veil over the scene for going through a door, and when the dark should lift if nothing happens. */
  private sceneFade: HTMLDivElement | null = null;
  private fadeGiveUpAt: number | null = null;
  /** What a door right here would do, for the hint. */
  private doorHint: 'enter' | 'visit' | 'locked' | 'leave' | null = null;
  /** The chair or the bed close enough to use, inside a home, while free to. */
  private restingNearby: 'chair' | 'bed' | null = null;
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

  private enteringWorld = false;
  private firstWorldFrame: (() => void) | null = null;
  private lastRenderedAt = 0;
  private setup: RendererSetup | null = null;
  private camera: FollowCamera | null = null;
  private controls: Controls | null = null;
  private connection: WorldConnection | null = null;
  private daylight: DaylightRig | null = null;
  private weatherSeed = 0;
  private weatherArt: ReturnType<typeof createForestWeather> | null = null;
  private weatherCloud = 0;
  private seasonFallArt: ReturnType<typeof createSeasonFall> | null = null;
  private readonly viewDirection = new THREE.Vector3();
  private readonly fallCentre = { x: 0, z: 0 };
  private readonly seasons = createSeasonRig();
  /** How far the calendar is pushed when a season was asked for in the address, once worked out. */
  private seasonShiftMs: number | null = null;
  /** The lights every campfire, lantern and torch borrows (see fire-light.ts). */
  private fireLights: FireLights | null = null;
  /** The latest time the server told us, and our own clock when it told us - together, an estimate of the server's clock right now. */
  private latestServerTimeMs = Date.now();
  private latestServerTimeAtMs = performance.now();

  private clearingScene: ClearingScene | null = null;
  private wildernessScene: WildernessScene | null = null;
  private lakeScene: ReturnType<typeof createLakeScene> | null = null;
  /** Whether the server says the lake is ice (decision 0095); applied to the scene and the ground once they exist. */
  private lakeFrozen = false;
  /** Everywhere the pond or the lake reaches: the build ghost keeps clear of all of it. */
  private keepOutWater: readonly WaterCircle[] = [];
  private encounterLandmarks: ReturnType<typeof createEncounterLandmarks> | null = null;
  private clearing: Clearing | null = null;
  /** What the server says is gone, and what it says we carry. Never guessed. */
  private readonly takenPickups = new Set<number>();
  private carrying: readonly { item: ItemId; count: number }[] = [];
  private nearbyItem: ItemId | null = null;
  private hoveredLoot: LootTarget | null = null;
  private hoverDueAt = 0;
  private chestOpen = false;
  private chestPending = false;
  private hoveredChest = false;
  private interactionNote: string | null = null;
  private interactionNoteUntil = 0;
  private nearGatherSpot: ItemId | null = null;
  /**
   * Every stick and flower patch, and everything dropped, as the server last
   * said - drawn by `groundItems` once the world is built (see decision 0061).
   */
  private gatherPatches: readonly GatherPatchView[] = [];
  private droppedPiles: readonly DroppedPileView[] = [];
  private groundItems: GroundItems | null = null;
  private readonly forestAudio = new ForestAudio();
  private readonly forestAtmosphere = new ForestAtmosphere((event) => this.forestAudio.play(event));
  private forestEnvironment: ForestEnvironment | null = null;
  private wildernessProps: readonly PlacedProp[] = [];
  /** Where each forest tree sits in `wildernessProps` (and so in the walkable world). */
  private wildernessIndexById: ReadonlyMap<number, number> = new Map();
  private readonly gatheringFocus = new GatheringFocus();
  private nearbyPile: { item: ItemId; count: number } | null = null;
  /**
   * Whether `carrying` is this connection's first word on the pack yet. The
   * first list is what we already had, not something just gained, so it
   * never makes a toast.
   */
  private packHeardFrom = false;
  private readonly toastShelf = new ToastShelf();
  private readonly pickupNotices = new PickupNoticeShelf();
  /**
   * What the server says about every tree that is not as the seed left it, and
   * how far along the one being chopped is.
   */
  private readonly treeStates = new Map<number, TreeAppearance>();
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
  private fishRecords: FishRecords = fishRecordsFromSaved(null);
  private reel: ReelView | null = null;
  private fishingNews: { text: string; until: number } | null = null;
  /** How hungry we are, as far as the server has told us. */
  private hunger = HUNGER_MAX;
  private hungerNews: { text: string; until: number } | null = null;
  /** How much health we have left, as far as the server has told us. */
  private health = HEALTH_MAX;
  private healthNews: { text: string; until: number } | null = null;
  private craftingNews: { text: string; until: number } | null = null;
  private cookingNews: { text: string; until: number } | null = null;
  private huntingNews: { text: string; until: number } | null = null;
  private cacheNews: { text: string; until: number } | null = null;
  private discardNews: { text: string; until: number } | null = null;
  /**
   * What each character's moves need remembering between frames - which
   * swing is at a tree, which flinch is next (see `MoveMemory`) - ours, and
   * everybody else's by netId.
   */
  private readonly localMoves = new MoveMemory();
  private readonly remoteMoves = new Map<number, MoveMemory>();
  /** Where everybody's line is at, as far as drawing them goes, ours included. */
  private readonly fishingPoses = new Map<number, FishingPose>();
  private readonly scratchTip = new THREE.Vector3();
  private readonly scratchHand = new THREE.Vector3();
  private readonly scratchBlow = new THREE.Vector3();
  /** Chips, fur and dust thrown off where blows land (see decision 0056). */
  private readonly bursts = new ImpactBursts();
  private readonly treeLandingEffects = new TreeLandingEffects();
  /** Every skeleton raider in sight (see decision 0063). */
  private readonly raiders = new RaiderCrowd(this.outdoors, this.bursts);
  /** The skeleton a swing of ours would land on, as last worked out. */
  private aimedRaiderId: number | null = null;
  private aimedRaider: { name: string; hitsLeft: number } | null = null;
  /** Whether any skeleton is close enough to be worth a hint about fighting it. */
  private raidersClose = false;
  private raidBanner: { banner: RaidBanner; until: number } | null = null;
  private raidBannersShown = 0;
  /** What the combat overlay draws, every frame: see `updateCombatFeed`. */
  readonly combatFeed = new CombatFeed();
  private readonly scratchProject = new THREE.Vector3();
  /** The streak behind each character's swings, ours included, by netId. */
  private readonly trails = new Map<number, WeaponTrail>();
  /** Animals knocked back by a blow, and how far into it. */
  private readonly animalJolts = new Map<number, AnimalJolt>();
  /** The animal a swing of ours would land on, as last worked out. */
  private aimedAnimalId: number | null = null;
  /** Scratch space for reading another player's move out of a snapshot. */
  private readonly remoteAction = createActionState();
  /** Whether the screen went dark for a knockout of ours, so it knows to come back. */
  private knockoutDark = false;
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
    this.grassDensity = options.grassDensity;
    this.signOutCountdown = new SignOutCountdown({
      leave: options.signOut,
      show: (view) =>
        options.hud.publish({ signOutSecondsLeft: view.secondsLeft, signOutNotice: view.notice }),
    });
  }

  /** Sign out of the game, after a short wait that moving or getting hurt cancels. */
  beginSignOut(): void {
    this.signOutCountdown.begin();
  }

  cancelSignOut(): void {
    this.signOutCountdown.cancel('cancelled');
  }

  async start(): Promise<void> {
    this.options.hud.publish({ loadingProgress: 5, loadingStage: 'Preparing the view' });
    installBvhRaycasting();
    // Kicked off now rather than in enterWorld, so they have the whole time
    // it takes to set up the renderer and reach the server to finish loading.
    void preloadPropModels();
    void preloadFlowerModel();
    void preloadCampfireModels();
    void preloadItemModels();
    void preloadFoxModel();
    void preloadCharacterModels();
    void preloadCharacterAnimations();
    void preloadRaiderModels();

    const setup = await createRenderer(this.options.canvas, this.options.forceWebGL);
    this.setup = setup;
    setup.renderer.shadowMap.enabled = true;
    setup.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.daylight = addDaylight(this.scene);
    this.fireLights = new FireLights(this.scene);
    this.scene.add(this.outdoors);
    this.scene.add(this.bursts.group);
    this.outdoors.add(this.treeLandingEffects.group);
    this.outdoors.add(this.gatheringFocus.group);
    const fade = document.createElement('div');
    fade.className = 'scene-fade';
    this.options.canvas.insertAdjacentElement('afterend', fade);
    this.sceneFade = fade;
    this.camera = new FollowCamera(window.innerWidth / window.innerHeight);
    this.controls = new Controls(this.options.canvas, () => {
      const player = this.localPlayer;
      if (player === null || player.action.kind !== ActionKind.Dodge || this.placing !== null)
        return false;
      const context = this.actionContext(
        player.motion.position,
        this.aimYaw ?? player.motion.facingYaw,
      );
      return context.canAttack && !context.castInstead;
    });
    this.controls.setGameplayEnabled(false);

    this.options.hud.publish({
      loadingProgress: 15,
      loadingStage: 'Finding your forest',
      backend: setup.backend,
      forcedFallback: setup.forcedFallback,
      playerName: this.options.identity.name,
    });
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.handleForestVisibility);

    this.offlineFallbackAt = performance.now() + OFFLINE_FALLBACK_MS;
    this.connect();

    this.lastFrameMs = performance.now();
    setup.renderer.setAnimationLoop(this.frame);
  }

  /** Called when the player clicks the curtain to start or come back to playing. */
  resume(): void {
    this.connection?.playHere();
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
    if (this.chestOpen || this.chestPending) this.closeChest();
    else if (this.mapOpen) this.mapOpen = false;
    else if (this.placing !== null) this.stopPlacing();
    else if (this.craftMenuOpen) this.craftMenuOpen = false;
    else if (this.buildMenuOpen) this.buildMenuOpen = false;
    else if (this.inventoryOpen) this.inventoryOpen = false;
    else this.setPlaying(false);
  }

  setSettingsOpen(open: boolean): void {
    this.settingsOpen = open;
    this.controls?.setGameplayEnabled(this.playing && !this.chestOpen && !open);
  }

  private setPlaying(playing: boolean): void {
    this.playing = playing;
    if (!playing) this.closeChest();
    this.controls?.setGameplayEnabled(playing && !this.chestOpen && !this.settingsOpen);
    this.forestAudio.update(playing && !document.hidden);
    if (!playing) {
      // Nothing should keep walking, swinging or charging under the curtain.
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

  transferChest(request: ChestRequest): void {
    if (this.chestPending || !this.playing) return;
    if (this.connectionState !== 'connected') {
      this.interactionNote = 'Reconnect to use your chest.';
      this.interactionNoteUntil = performance.now() + 2800;
      return;
    }
    this.chestPending = true;
    this.options.hud.publish({ chestPending: true });
    this.connection?.sendChest(request);
  }

  closeChest(): void {
    if (!this.chestOpen && !this.chestPending) return;
    this.chestOpen = false;
    this.chestPending = false;
    this.homeInterior?.setChestOpen(false);
    this.controls?.setGameplayEnabled(this.playing && !this.settingsOpen);
    this.options.hud.publish({ chestSlots: null, chestPending: false, chestNote: null });
  }

  private chestAt(point: { x: number; y: number }, camera: FollowCamera): boolean {
    return this.interiorTargetAt(point, camera, this.homeInterior?.chest);
  }
  private interiorTargetAt(
    point: { x: number; y: number },
    camera: FollowCamera,
    target?: THREE.Object3D,
  ): boolean {
    const room = this.homeInterior;
    if (room === null || this.space === OUTDOORS) return false;
    this.clickNdc.set(
      (point.x / window.innerWidth) * 2 - 1,
      (-point.y / window.innerHeight) * 2 + 1,
    );
    this.clickRaycaster.setFromCamera(this.clickNdc, camera.camera);
    const hit = this.clickRaycaster.intersectObject(room.group, true).find((hit) => {
      for (let object: THREE.Object3D | null = hit.object; object !== null; object = object.parent)
        if (!object.visible) return false;
      return true;
    });
    for (
      let object: THREE.Object3D | null = hit?.object ?? null;
      object !== null;
      object = object.parent
    )
      if (object === target) return true;
    return false;
  }

  private chestHoverDetail(): string {
    if (this.homeHere()?.yours !== true) return 'Private · belongs to the home owner';
    const chest = homeChestSpot(this.currentHomeKind());
    const position = this.motionOrOrigin();
    if (Math.hypot(position.x - chest.x, position.z - chest.z) > 1.8)
      return 'Too far away · move closer';
    return 'Left-click to open · 10 storage slots';
  }

  /** Called from the HUD's own bag button - the mouse-first way to open the inventory panel. */
  toggleInventory(): void {
    this.closeChest();
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
    this.closeChest();
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
    const home = blueprintHome(item);
    if (home !== null && knowsHome(this.homeSkills, home)) {
      this.craftingNews = {
        text: 'You already learned this home blueprint.',
        until: performance.now() + NEWS_MS,
      };
      return;
    }
    if (!ITEM_KINDS[item].equippable && blueprintHome(item) === null) return;
    if (!this.carrying.some((entry) => entry.item === item && entry.count > 0)) return;
    this.connection?.sendUseItem(item);
  }

  /**
   * Drop or destroy some of something in the pack, from the slot menu (see
   * decision 0061). Only asked for here; the server decides whether it
   * happens, and how many that really is.
   */
  discard(item: ItemId, amount: number, destroy: boolean): void {
    if (!isDiscardable(item) || amount < 1) return;
    if (!this.carrying.some((entry) => entry.item === item && entry.count > 0)) return;
    this.connection?.sendDiscard({ item, amount: Math.floor(amount), destroy });
  }

  /**
   * Start placing one of these, the same as pressing its number with the
   * Craft menu open - called when an entry in that menu is clicked.
   */
  moveDecoration(id: number): void {
    const piece = this.decorations.find((piece) => piece.id === id && piece.homeId === this.space);
    if (piece === undefined || this.homeHere()?.yours !== true) return;
    this.buildMenuOpen = false;
    this.startPlacing(piece.kind);
    this.decorMoveId = id;
    if (this.placing !== null) this.placing.yaw = piece.yaw;
  }
  reclaimDecoration(id: number): void {
    const piece = this.decorations.find((piece) => piece.id === id && piece.homeId === this.space);
    if (piece !== undefined) this.connection?.sendDecoration({ ...piece, action: 'reclaim' });
  }
  private decorationRefusal(reason: DecorationState['reason']): string | null {
    if (reason === null) return null;
    return {
      unavailable: 'Enter your home to decorate',
      private: 'Only the homeowner can decorate',
      materials: 'Gather the listed materials first',
      blocked: 'Keep furniture, doorways, beds and stations clear',
      tooFar: 'Move closer to that spot',
      busy: 'Stand up and finish your current action first',
      limit: 'Your home can hold 16 decorations',
      missing: 'That decoration is no longer here',
      packFull: 'Make room in your backpack before packing this up',
      recipe: 'Complete three outings to learn the trail pennant recipe',
    }[reason];
  }
  private refreshDecorations(): void {
    for (const model of this.decorModels) {
      model.group.removeFromParent();
      model.dispose();
    }
    this.decorModels.length = 0;
    if (this.space === OUTDOORS || this.homeInterior === null) return;
    const pieces = this.decorations.filter((piece) => piece.homeId === this.space);
    for (const piece of pieces) {
      const model = createHomeDecoration(piece.kind);
      model.group.position.set(piece.x, 0, piece.z);
      model.group.rotation.y = piece.yaw;
      this.homeInterior.group.add(model.group);
      this.decorModels.push(model);
    }
    const colliders = pieces
      .map(decorationCollider)
      .filter((value): value is NonNullable<typeof value> => value !== null);
    this.roomCollision.colliders.splice(
      0,
      this.roomCollision.colliders.length,
      ...homeRoomColliders(this.currentHomeKind()),
      ...colliders,
    );
  }
  pickBuildable(kind: BuildableKindId): void {
    if (kind === 'trailPennant' && !(this.expedition.cosmetics & 1)) return;
    if (this.space !== OUTDOORS && (!isDecorationKind(kind) || this.homeHere()?.yours !== true))
      return;
    if (this.space === OUTDOORS && isIndoorOnlyKind(kind)) return;
    if (kind === 'cabin') {
      const home = this.builtProps.find((prop) => prop.yours && isHomeKind(prop.kind));
      const target = nextHome(home !== undefined && isHomeKind(home.kind) ? home.kind : null);
      if (target === null) return;
      kind = target;
    }
    this.buildMenuOpen = false;
    this.startPlacing(kind);
  }

  /** Called from the Settings menu's sensitivity slider - takes effect on the very next frame. */
  setGrassDensity(value: number): void {
    this.grassDensity = value;
    this.grass?.setDensity(value);
  }

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
      buildBoundaryVisible: () => this.buildBoundary?.group.visible ?? false,
      grassClumps: () => this.grass?.mesh.count ?? 0,
      combatMove: () => ({
        kind: this.localPlayer?.action.kind ?? 0,
        age: this.localPlayer?.actionAge() ?? 0,
        grounded: this.localPlayer?.motion.grounded ?? true,
      }),
      weatherEffects: () => this.weatherArt?.visibleEffects() ?? { rainDrops: 0, fireflies: 0 },
      snowOnGround: () => seasonUniforms.snow.value,
      seasonFall: () =>
        this.seasonFallArt?.visibleEffects() ?? { petals: 0, pollen: 0, leaves: 0, snow: 0 },
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
      nearbyPile: () => (this.nearbyPile === null ? null : { ...this.nearbyPile }),
      nearGatherSpot: () => this.nearGatherSpot,
      felledTrees: () => [...this.treeStates].filter(([, state]) => state.felled).map(([id]) => id),
      treeGenerations: () =>
        [...this.treeStates].map(([id, state]) => ({ id, generation: state.generation })),
      trees: () =>
        [...(this.clearing?.props ?? []), ...this.wildernessProps]
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
      raiders: () =>
        this.raiders.markers().flatMap((marker) => {
          const about = this.raiders.describe(marker.id);
          return about === null
            ? []
            : [
                {
                  id: marker.id,
                  kind: about.kind,
                  x: marker.x,
                  z: marker.z,
                  hitsLeft: about.hitsLeft,
                },
              ];
        }),
      aimedRaider: () => (this.aimedRaider === null ? null : { ...this.aimedRaider }),
      raidBanner: () => this.currentRaidBanner()?.title ?? null,
      canBuild: () => this.canBuild,
      buildMenuOpen: () => this.buildMenuOpen,
      craftMenuOpen: () => this.craftMenuOpen,
      builtProps: () => this.builtProps.map((prop) => ({ ...prop })),
      boats: () => ({
        moored: this.builtProps.filter(
          (prop) => prop.kind === 'rowboat' && this.builtMeshes.get(prop.id)?.group.visible,
        ).length,
        rowed: this.rowingBoats.drawnBoats(),
      }),
      buildPreview: () =>
        this.placing === null
          ? null
          : {
              kind: this.placing.kind,
              spot: this.placing.plan.spot === null ? null : { ...this.placing.plan.spot },
              refusal: this.placing.plan.refusal,
            },
      buriedCaches: () => this.buriedCaches.map((cache) => ({ ...cache })),
      space: () => this.space,
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
      gatherSpots: () => this.gatherPatches.map((patch) => ({ ...patch })),
      droppedPiles: () => this.droppedPiles.map((pile) => ({ ...pile })),
      toasts: () =>
        this.toastShelf
          .current(performance.now())
          .map((toast) => ({ item: toast.item, count: toast.count })),
      screenPoint: (x, y, z) => {
        if (this.camera === null) return null;
        this.scratchProject.set(x, y, z).project(this.camera.camera);
        if (this.scratchProject.z < -1 || this.scratchProject.z > 1) return null;
        return {
          x: ((this.scratchProject.x + 1) * window.innerWidth) / 2,
          y: ((1 - this.scratchProject.y) * window.innerHeight) / 2,
        };
      },
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
      lake: () => ({
        basin: LAKE.basin.map((circle) => ({ ...circle })),
        islands: LAKE.islands.map((island) => island.id),
      }),
      lakeFrozen: () => this.lakeFrozen,
      canCast: () => this.canCast,
      fishing: () => this.fishingPhase,
      fishingNews: () => this.currentNews(performance.now()),
      hunger: () => this.hunger,
      hungerNews: () => this.currentHungerNews(performance.now()),
      health: () => this.health,
      healthNews: () => this.currentHealthNews(performance.now()),
      craftingNews: () => this.currentCraftingNews(performance.now()),
      cookingNews: () => this.currentCookingNews(performance.now()),
      huntingNews: () => this.currentHuntingNews(performance.now()),
      discardNews: () => this.currentDiscardNews(performance.now()),
    };
  }

  private motionOrOrigin(): Vec3 {
    return this.localPlayer?.motion.position ?? vec3();
  }

  stop(): void {
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleForestVisibility);
    this.setup?.renderer.setAnimationLoop(null);
    this.signOutCountdown.dispose();
    this.controls?.dispose();
    this.connection?.close();
    this.clearingScene?.dispose();
    this.gatheringFocus.dispose();
    this.forestAudio.dispose();
    this.groundItems?.dispose();
    this.wildernessScene?.dispose();
    this.lakeScene?.dispose();
    this.buildBoundary?.dispose();
    this.encounterLandmarks?.dispose();
    this.discoveryLandmarks?.dispose();
    this.animalTracks?.dispose();
    for (const model of this.decorModels) model.dispose();
    this.decorModels.length = 0;
    this.weatherArt?.dispose();
    this.seasonFallArt?.dispose();
    this.grass?.dispose();
    this.floats.dispose();
    this.localCharacter?.dispose();
    for (const character of this.remoteCharacters.values()) character.dispose();
    this.remoteCharacters.clear();
    for (const critter of this.critters.values()) critter.dispose();
    this.critters.clear();
    for (const built of this.builtMeshes.values()) built.dispose();
    this.builtMeshes.clear();
    this.rowingBoats.dispose();
    for (const mound of this.buriedCacheMeshes.values()) mound.dispose();
    this.buriedCacheMeshes.clear();
    this.raiders.dispose();
    this.bursts.dispose();
    this.treeLandingEffects.dispose();
    for (const trail of this.trails.values()) trail.dispose();
    this.trails.clear();
  }

  /* ---------------------------------------------------------------------- */
  /* Networking                                                             */
  /* ---------------------------------------------------------------------- */

  private connect(): void {
    const url = worldSocketUrl(this.options.worldId, undefined, this.options.season);
    this.connection = new WorldConnection(
      url,
      {
        onMessage: (message) => this.handleMessage(message),
        onStateChange: (state, detail) => {
          if (this.connectionState === 'connected' && state !== 'connected')
            this.meal = this.currentMeal();
          this.mealHeardAt = performance.now();
          this.connectionState = state;
          if (state !== 'connected') this.closeChest();
          this.options.hud.publish({ connection: state, connectionDetail: detail ?? '' });
          // Playing in another tab now: the curtain comes down here, and
          // clicking it is how to play in this one again (see `resume`).
          if (state === 'elsewhere') this.setPlaying(false);
        },
      },
      // Checked before every attempt. A session that has ended means going back
      // to the sign-in screen, not sitting offline trying again for ever.
      { signIn: () => this.stillSignedIn() },
    );
    this.connection.connect();
  }

  private async stillSignedIn(): Promise<void> {
    try {
      await resumeAccount(window.localStorage);
    } catch (error) {
      if (error instanceof SignInError && error.status === 401) window.location.reload();
      throw error;
    }
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'chest': {
        if (!this.chestPending) break;
        this.chestPending = false;
        const text =
          message.reason === null
            ? message.moved > 0
              ? `${message.moved} item${message.moved === 1 ? '' : 's'} moved.`
              : null
            : chestReasonText(message.reason);
        if (
          message.reason === null ||
          message.reason === 'chestFull' ||
          message.reason === 'packFull' ||
          message.reason === 'empty' ||
          message.reason === 'invalid'
        ) {
          this.chestOpen = true;
          this.inventoryOpen = false;
          this.buildMenuOpen = false;
          this.craftMenuOpen = false;
          this.mapOpen = false;
          this.controls?.setGameplayEnabled(false);
          this.homeInterior?.setChestOpen(true);
          this.options.hud.publish({
            chestSlots: message.slots,
            chestPending: false,
            chestNote: text,
            inventoryOpen: false,
            buildMenuOpen: false,
            craftMenuOpen: false,
            mapOpen: false,
          });
        } else {
          this.closeChest();
          this.interactionNote = text;
          this.interactionNoteUntil = performance.now() + 3200;
        }
        break;
      }
      case 'welcome': {
        this.recoveryHeard = false;
        this.recoveryMarkers = [];
        this.buriedCaches = [];
        this.applyBuriedCaches();
        this.selfNetId = message.netId;
        this.serverTick = message.tick;
        // A fresh connection starts from a fresh pack list: what it says is
        // what we had, not what we just gained.
        this.packHeardFrom = false;
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

        const playerEntities = message.entities.filter(
          (entity) => !isAnimalEntity(entity) && !isRaiderEntity(entity),
        );
        const animalEntities = message.entities.filter(isAnimalEntity);
        this.raiders.ingest(message.serverTimeMs, message.entities.filter(isRaiderEntity));
        this.playersOnline = playerEntities.length;

        const self = playerEntities.find((entity) => entity.netId === this.selfNetId);
        if (self !== undefined) {
          this.localPlayer?.reconcile(self, message.ackSeq, message.dodgeCooldown);
        }

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
      case 'homeBuildFeedback': {
        const descriptions = {
          materials: 'You need more building materials.',
          identity: 'Reconnect to build a home.',
          blueprint: 'Learn this home blueprint first.',
          tier: 'Upgrade your home one tier at a time.',
          moved: 'Upgrade your existing home in place.',
          occupied: 'Everyone must leave the home before upgrading.',
          blocked: 'The larger home needs more clear space around it.',
          player: 'Someone is standing where the larger home will go.',
          busy: 'Wait a moment before building.',
          area: 'This home boundary needs more room away from other homes and protected sites.',
          ground: 'Choose more level ground for your home.',
        };
        this.craftingNews = {
          text:
            message.reason === null
              ? `${BUILDABLE_KINDS[message.kind].displayName} ready. Welcome home.`
              : descriptions[message.reason],
          until: performance.now() + NEWS_MS,
        };
        this.pendingPlacements = [];
        break;
      }
      case 'discoveries': {
        if (this.receivedDiscoveryState) {
          for (const definition of DISCOVERIES) {
            if (
              discoveryKnown(message.claimed, definition.id) &&
              !discoveryKnown(this.discoveriesClaimed, definition.id)
            )
              this.showJournalNotice(
                `${definition.name}: ${definition.recipe === null ? 'supplies collected' : 'recipe learned'}`,
                performance.now(),
              );
            else if (
              discoveryKnown(message.found, definition.id) &&
              !discoveryKnown(this.discoveriesFound, definition.id)
            )
              this.showJournalNotice(
                `Found ${definition.name.toLowerCase()} · noted in your journal`,
                performance.now(),
              );
          }
        }
        this.receivedDiscoveryState = true;
        this.discoveriesFound = message.found;
        this.discoveriesClaimed = message.claimed;
        if (message.notice === 'guarded')
          this.showJournalNotice('Clear the nearby skeletons before inspecting', performance.now());
        if (message.notice === 'quiet')
          this.showJournalNotice(
            'Give the animal room to settle, then inspect again',
            performance.now(),
          );
        if (message.notice === 'guardian')
          this.showJournalNotice('Help defeat the guardian to earn your trophy', performance.now());
        if (message.notice === 'full')
          this.showJournalNotice('Make room in your pack, then inspect again', performance.now());
        this.updateDiscoveryMarkers();
        break;
      }
      case 'decoration': {
        this.decorations = message.pieces;
        this.decorNote = message.reason === null ? null : this.decorationRefusal(message.reason);
        if (this.decorNote !== null)
          this.craftingNews = { text: this.decorNote, until: performance.now() + NEWS_MS };
        this.pendingPlacements = [];
        this.refreshDecorations();
        break;
      }
      case 'fishRecords': {
        this.fishRecords = fishRecordsFromSaved(message);
        this.options.hud.publish({ fishRecords: this.fishRecords });
        break;
      }
      case 'lakeIce': {
        this.applyLakeIce(message.frozen);
        break;
      }
      case 'rareReel': {
        this.reel = message;
        this.fishingPhase = 'reeling';
        this.options.hud.publish({ fishing: this.fishingPhase, reel: this.reel });
        break;
      }
      case 'expedition': {
        this.expedition = {
          cycle: message.cycle,
          completed: message.completed,
          active: message.active,
          progress: [...message.progress],
          cosmetics: message.cosmetics,
          offers: [...message.offers],
          notice: message.notice,
        };
        this.expeditionPendingUntil = 0;
        break;
      }
      case 'garden': {
        this.garden = message;
        if (message.homeId === this.space) this.homeInterior?.setGardenPlots(message.plots);
        this.options.hud.publish({ garden: message });
        break;
      }
      case 'meal': {
        this.meal = { item: message.item, ticksLeft: message.ticksLeft };
        this.mealHeardAt = performance.now();
        break;
      }
      case 'homeSupplies': {
        this.homeStoredSupplies = message.items;
        break;
      }
      case 'homeSkills': {
        if (this.homeSkillsHeard && message.skills !== this.homeSkills) {
          const learned = HOME_TIERS.filter(
            (_, index) =>
              index > 0 && (message.skills & ~this.homeSkills & (1 << (index - 1))) !== 0,
          );
          if (learned.length > 0)
            this.craftingNews = {
              text: `Learned ${learned.map((kind) => BUILDABLE_KINDS[kind].displayName.toLowerCase()).join(', ')} building.`,
              until: performance.now() + NEWS_MS,
            };
        }
        this.homeSkillsHeard = true;
        this.homeSkills = message.skills;
        break;
      }
      case 'inventory': {
        const carrying = message.items.map((entry) => ({ ...entry }));
        if (this.packHeardFrom) this.showGains(packGains(this.carrying, carrying));
        this.packHeardFrom = true;
        this.carrying = carrying;
        break;
      }
      case 'gatherPatches': {
        this.gatherPatches = message.patches;
        this.groundItems?.setGatherPatches(this.gatherPatches);
        break;
      }
      case 'droppedPiles': {
        this.droppedPiles = message.piles;
        this.groundItems?.setDroppedPiles(this.droppedPiles);
        break;
      }
      case 'pickupRefused': {
        const now = performance.now();
        if (this.pickupNotices.show(message.item, message.reason, now)) playPickupRefused();
        this.options.hud.publish({ pickupNotice: this.pickupNotices.current(now) });
        break;
      }
      case 'discarded': {
        this.hearAboutDiscard(message.event);
        break;
      }
      case 'pickupsTaken': {
        this.takenPickups.clear();
        for (const id of message.pickupIds) this.takenPickups.add(id);
        this.clearingScene?.setTakenPickups(this.takenPickups);
        break;
      }
      case 'treeStates': {
        // The whole list comes on arrival; after that, only the trees that changed.
        if (message.whole) this.treeStates.clear();
        for (const tree of message.trees) {
          this.treeStates.set(tree.treeId, {
            generation: tree.generation,
            felled: tree.felled,
            ...(tree.fall ? { fall: tree.fall } : {}),
          });
        }
        this.applyTreeStates();
        break;
      }
      case 'treeHit': {
        this.swingsLeft.set(message.treeId, message.swingsLeft);
        // Our own swing already showed itself landing, the moment it did
        // here (see `showOwnBlow`); everybody else's shows now.
        if (message.netId !== this.selfNetId) {
          playTreeHit();
          const tree = this.standingProps.find((prop) => prop.id === message.treeId);
          const from = this.remotePlayers.poseOf(message.netId);
          if (tree !== undefined && from !== undefined) this.showBlowOnTree(tree, from, 1);
        }
        break;
      }
      case 'threatHit': {
        this.threatHitsLeft.set(message.event.animalId, message.event.hitsLeft);
        if (message.event.netId !== null && message.event.netId !== this.selfNetId) {
          playThreatHit();
          const from = this.remotePlayers.poseOf(message.event.netId);
          if (from !== undefined) this.showBlowOnAnimal(message.event.animalId, from, 1);
        }
        break;
      }
      case 'raiders': {
        this.raiders.setList(message.raiders);
        break;
      }
      case 'raiderVitals': {
        this.raiders.setMaximumHits(message.id, message.maxHits);
        break;
      }
      case 'raiderHit': {
        this.hearAboutRaiderHit(message.hit);
        break;
      }
      case 'raidNews': {
        this.hearAboutRaid(message.news);
        break;
      }
      case 'collected': {
        for (const event of message.events) this.showCollection(event);
        break;
      }
      case 'gestures': {
        for (const gesture of message.gestures) this.showGesture(gesture);
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
      case 'cooked': {
        this.hearAboutCooking(message.event);
        break;
      }
      case 'caught': {
        this.hearAboutCatching(message.event);
        break;
      }
      case 'builtProps': {
        this.builtProps = message.props;
        this.grass?.setBuildings(message.props);
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
      case 'recoveryMarkers': {
        this.recoveryHeard = true;
        this.recoveryMarkers = message.caches;
        this.buriedCaches = [
          ...this.buriedCaches.filter((cache) => cache.ownerNetId !== this.selfNetId),
          ...message.caches,
        ];
        this.applyBuriedCaches();
        break;
      }
      case 'buriedCaches': {
        this.buriedCaches = this.recoveryHeard
          ? [
              ...message.caches.filter((cache) => cache.ownerNetId !== this.selfNetId),
              ...this.recoveryMarkers,
            ]
          : message.caches;
        this.applyBuriedCaches();
        break;
      }
      case 'cache': {
        this.hearAboutCache(message.event);
        break;
      }
      case 'space': {
        if (this.localPlayer === null) {
          this.pendingSpace = {
            space: message.space,
            x: message.x,
            z: message.z,
            yaw: message.yaw,
          };
        } else {
          this.moveToSpace(message.space, message.x, message.z, message.yaw);
        }
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
    // Our own cast already started when we clicked (see `showOwnCast`):
    // saying so again changes nothing.
    this.setFishingPose(
      event.netId,
      event.kind === 'cast'
        ? 'casting'
        : event.kind === 'bite'
          ? 'biting'
          : event.kind === 'caught'
            ? 'landing'
            : null,
    );

    if (event.netId !== this.selfNetId) return;
    if (event.kind === 'cast') {
      this.fishingPhase = 'waiting';
      this.fishingNews = null;
      this.camera?.lookDownTo(FISHING_CAMERA_PITCH);
    } else if (event.kind === 'bite') {
      this.fishingPhase = 'biting';
    } else {
      this.fishingPhase = null;
      this.reel = null;
      const now = performance.now();
      this.fishingNews = { text: newsFor(event), until: now + NEWS_MS };
      this.castReadyAt = now + CAST_COOLDOWN_SECONDS * 1000;
    }

    // Not left for the next frame. `updateHud` only runs from inside the render
    // loop, and that loop can stall for a while under load without the tab
    // being anywhere near crashed. A stall like that must not be able to eat
    // the whole few seconds this news is shown for, or swallow it outright, so
    // the moment this is known it goes straight to the HUD.
    this.options.hud.publish({
      fishing: this.fishingPhase,
      reel: this.reel,
      fishingNews: this.currentNews(),
    });
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
      this.signOutCountdown.noteHurt();
      this.camera?.shake(TOOK_DAMAGE_SHAKE);
      playTookDamage();
      this.combatFeed.hurt(
        (this.health - event.health) / HURT_FULL_FLASH,
        this.hurtFromYaw(),
        performance.now(),
      );
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

  /**
   * Which way the blow that just hurt us came from, as a world heading, if
   * a skeleton close by is mid-swing: the one most likely to have landed it.
   */
  private hurtFromYaw(): number | null {
    const player = this.localPlayer;
    if (player === null || this.space !== OUTDOORS) return null;
    const at = player.motion.position;
    const attacker = this.raiders.swingingNear(at, HURT_FROM_WITHIN);
    if (attacker === null) return null;
    return Math.atan2(-(attacker.x - at.x), -(attacker.z - at.z));
  }

  /**
   * A blow landed on a skeleton (see decision 0063). Our own already showed
   * itself as it landed here (see `showOwnBlow`); this only settles how many
   * more it needs. Everybody else's shows now.
   */
  private hearAboutRaiderHit(hit: RaiderHit): void {
    const ours = hit.netId === this.selfNetId;
    const from = hit.netId === null || ours ? undefined : this.remotePlayers.poseOf(hit.netId);
    this.raiders.confirmHit(hit, from, ours, this.listenerPoint());
  }

  /**
   * A skeleton raid turned up, was fought off, or is over (see decision
   * 0063): a banner, and the horn or a fanfare - for a raid on us, or on
   * somebody close enough that it is everybody's fight.
   */
  private hearAboutRaid(news: RaidNews): void {
    const ours = news.targetNetId === this.selfNetId;
    const me = this.listenerPoint();
    const near = me !== null && Math.hypot(news.x - me.x, news.z - me.z) < RAID_HEARD_WITHIN;
    if (!ours && !near) return;
    const banner = raidBannerFor(
      news,
      ours ? null : (this.roster.get(news.targetNetId)?.name ?? 'Somebody'),
      me === null ? null : compassTo(me, news, this.camera?.look.yaw ?? 0).bearingDegrees,
      (this.raidBannersShown += 1),
    );
    const now = performance.now();
    this.raidBanner = { banner, until: now + RAID_BANNER_MS };
    if (news.kind === 'incoming') playRaidHorn(ours ? 1 : 0.6);
    else if (news.kind === 'foughtOff' || news.kind === 'encounterCleared') playVictory();
    else if (news.kind === 'gaveUp') playRaidOver();
    // Same reasoning as `hearFromTheWater`: straight to the HUD.
    this.options.hud.publish({ raidBanner: banner });
  }

  private currentRaidBanner(now = performance.now()): RaidBanner | null {
    const shown = this.raidBanner;
    return shown !== null && now < shown.until ? shown.banner : null;
  }

  /** Where we are, for how loud things sound and what is close: only out of doors. */
  private listenerPoint(): FlatPoint | null {
    if (this.space !== OUTDOORS) return null;
    const position = this.localPlayer?.motion.position;
    return position === undefined ? null : { x: position.x, z: position.z };
  }

  /** Whether we are winding up a charged strike, rooted to the spot. */
  private currentlyCharging(): boolean {
    return this.localPlayer?.action.kind === ActionKind.Charge;
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

  /** Only ever about us: a small reward line for turning raw food into a better meal. */
  private hearAboutCooking(event: CookedEvent): void {
    const now = performance.now();
    const name = ITEM_KINDS[event.cooked].displayName;
    this.cookingNews = { text: `${name} ready.`, until: now + NEWS_MS };
    this.options.hud.publish({ cookingNews: this.currentCookingNews() });
  }

  private currentCookingNews(now = performance.now()): string | null {
    const news = this.cookingNews;
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
        ? 'Safe at home. Follow your recovery marker to reclaim belongings; they never expire.'
        : event.kind === 'partial'
          ? 'Some belongings recovered. Make room in your pack; the rest stays safely marked.'
          : 'All belongings recovered.';
    this.cacheNews = { text, until: now + NEWS_MS };
    this.options.hud.publish({ cacheNews: this.currentCacheNews() });
  }

  private currentCacheNews(now = performance.now()): string | null {
    const news = this.cacheNews;
    return news !== null && now < news.until ? news.text : null;
  }

  /**
   * Everything the pack just gained, as toasts (see decision 0061). Pushed
   * straight to the HUD, the same as news, so a stall in the render loop
   * cannot swallow one.
   */
  private showGains(gained: readonly { item: ItemId; count: number }[]): void {
    if (gained.length === 0) return;
    const now = performance.now();
    this.toastShelf.add(gained, now);
    this.options.hud.publish({ toasts: this.toastShelf.current(now) });
  }

  /** Only ever about us: the server only tells whoever did the dropping or destroying. */
  private hearAboutDiscard(event: DiscardedEvent): void {
    if (event.netId !== this.selfNetId || event.count <= 0) return;
    const now = performance.now();
    const what = amountOf(event.item, event.count);
    const text = event.destroyed ? `Destroyed ${what}.` : `Dropped ${what}.`;
    this.discardNews = { text, until: now + NEWS_MS };
    this.options.hud.publish({ discardNews: this.currentDiscardNews() });
  }

  private currentDiscardNews(now = performance.now()): string | null {
    const news = this.discardNews;
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
    const tip = character.heldTip(this.scratchTip);
    return {
      x,
      y,
      z,
      yaw: character.group.rotation.y,
      ...(tip === null ? {} : { rodTip: { x: tip.x, y: tip.y, z: tip.z } }),
    };
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
    if (this.clearingScene !== null || this.enteringWorld) return;
    this.enteringWorld = true;
    try {
      let loaded = 0;
      const assetReady = (): void => {
        loaded += 1;
        this.options.hud.publish({
          loadingProgress: 15 + Math.round((loaded / 9) * 55),
          loadingStage: 'Gathering the forest’s details',
        });
      };

      // Resolves immediately once loaded; only actually waits if the world is
      // entered before the fetch kicked off in start() has finished. A flower
      // bed can be built well after this, but never before, so loading it here
      // covers every place the game ever draws a flower.
      await Promise.all(
        [
          preloadPropModels(),
          preloadFlowerModel(),
          preloadCampfireModels(),
          preloadItemModels(),
          preloadFoxModel(),
          preloadCharacterModels(),
          preloadCharacterAnimations(),
          preloadRaiderModels(),
          preloadArtTextures(),
        ].map((asset) => asset.then(assetReady)),
      );
      this.options.hud.publish({ loadingProgress: 75, loadingStage: 'Growing your clearing' });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (this.clearingScene !== null) return;

      const clearing = buildTestClearing(seed);
      const terrain = createWildernessTerrain(seed);
      this.weatherSeed = seed;
      this.seasonShiftMs = null;
      this.weatherArt?.dispose();
      this.weatherArt = createForestWeather(seed, (x, z) => terrain.heightAt(x, z));
      this.outdoors.add(this.weatherArt.group);
      this.seasonFallArt?.dispose();
      this.seasonFallArt = createSeasonFall(seed, (x, z) => terrain.heightAt(x, z));
      this.outdoors.add(this.seasonFallArt.group);
      const wilderness = buildWilderness(seed, terrain);
      this.wildernessProps = wilderness.props;
      this.wildernessIndexById = wilderness.indexById;
      const encounterSites = buildEncounterSites(
        seed,
        terrain,
        [...clearing.colliders, ...wilderness.siteColliders],
        clearing.water,
        LAKE,
      );
      this.discoverySites = buildDiscoverySites(encounterSites);
      this.protectedBuildSites = [
        ...WOODLAND_ENCOUNTERS,
        ...this.discoverySites.map((site) => ({
          x: site.x,
          z: site.z,
          radius: 8,
          name: site.kind,
        })),
        ...encounterSites.map((site) => ({ x: site.x, z: site.z, radius: 12, name: site.kind })),
      ];
      this.buildBoundary = createBuildBoundary(terrain);
      this.outdoors.add(this.buildBoundary.group);
      this.updateDiscoveryMarkers();
      this.discoveryLandmarks = createDiscoveryLandmarks(this.discoverySites, terrain);
      this.outdoors.add(this.discoveryLandmarks.group);
      this.animalTracks = createAnimalTracks(seed, terrain, [
        ...clearing.colliders,
        ...wilderness.colliders,
        ...encounterColliders(encounterSites, terrain),
        ...discoveryColliders(this.discoverySites, terrain),
      ]);
      this.outdoors.add(this.animalTracks.group);
      this.encounterLandmarks = createEncounterLandmarks(encounterSites, terrain);
      this.outdoors.add(this.encounterLandmarks.group);

      this.clearing = clearing;
      this.clearingScene = buildClearingScene(clearing);
      this.clearingScene.setTakenPickups(this.takenPickups);
      this.outdoors.add(this.clearingScene.group);

      // Word of where the patches are, and anything dropped, usually beats the
      // world itself to it on arrival.
      this.groundItems = createGroundItems((x, z) => terrain.heightAt(x, z));
      this.groundItems.setGatherPatches(this.gatherPatches);
      this.groundItems.setDroppedPiles(this.droppedPiles);
      this.outdoors.add(this.groundItems.group);

      this.wildernessScene = buildWildernessScene(wilderness, terrain, clearing);
      this.outdoors.add(this.wildernessScene.group);
      this.lakeScene?.dispose();
      this.lakeScene = createLakeScene(LAKE);
      this.lakeScene.setFrozen(this.lakeFrozen);
      this.outdoors.add(this.lakeScene.group);
      this.keepOutWater = [...clearing.water, ...LAKE.basin];
      this.grass = createGrass(terrain, clearing, wilderness, this.animalTracks?.tracks);
      this.grass.setDensity(this.grassDensity);
      this.grass.setBuildings(this.builtProps);
      this.outdoors.add(this.grass.mesh);

      this.outdoors.add(this.floats.group);

      const collision = createCollisionWorld(
        terrain,
        [
          ...clearing.colliders,
          ...wilderness.colliders,
          ...encounterColliders(encounterSites, terrain),
          ...discoveryColliders(this.discoverySites, terrain),
        ],
        PLAYABLE_HALF_EXTENT,
        LAKE,
      );
      this.collision = collision;
      setLakeFrozen(collision, this.lakeFrozen);
      this.localPlayer = new LocalPlayer(SPAWN_POSITION, collision);
      this.localPlayer.setActionContext((position, aimYaw) => this.actionContext(position, aimYaw));
      this.applyTreeStates();
      this.applyBuiltProps();
      // Drawn once out of sight while loading, so the first raid turns up
      // without the game freezing to learn how to draw a skeleton.
      this.raiders.rehearse(SPAWN_POSITION);

      this.localCharacter = createCharacter(
        this.options.identity.character,
        TINT_COLORS[this.options.identity.color].hex,
      );
      this.localCharacter.setName(this.options.identity.name);
      this.scene.add(this.localCharacter.group);
      // Word of where we are can beat the world to it on arrival: waking up
      // inside our own home, say.
      const arrived = this.pendingSpace;
      this.pendingSpace = null;
      if (arrived !== null) this.moveToSpace(arrived.space, arrived.x, arrived.z, arrived.yaw);

      this.mapFeed.ready = true;
      // Painted in a worker while the player gets their bearings; the minimap
      // shows blank parchment for the moment it takes.
      paintWorldMapImage(seed)
        .then((image) => {
          this.mapFeed.image = image;
        })
        .catch((error: unknown) => console.warn('Could not paint the map', error));

      this.options.hud.publish({ loadingProgress: 90, loadingStage: 'Letting the light through' });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      // Readiness follows an actual rendered world frame. Rendering and a
      // separate shader compilation must not overlap on the same renderer.
      await new Promise<void>((resolve) => {
        this.firstWorldFrame = resolve;
      });
      this.options.hud.publish({
        ready: true,
        loadingProgress: 100,
        loadingStage: 'Your forest is ready',
      });
    } catch (error: unknown) {
      console.error('Could not prepare the forest', error);
      this.options.hud.publish({
        loadingError: 'The forest couldn’t finish loading. Please try again.',
      });
    }
  }

  /**
   * Put the trees where the server says they are, in the world we walk around
   * as well as the one we look at: a stump stops blocking like a trunk, and a
   * tree that grew back starts blocking again at its new size.
   */
  private applyTreeStates(): void {
    const now = this.estimatedServerTimeMs();
    this.clearingScene?.setTreeStates(this.treeStates, now);
    this.wildernessScene?.setTreeStates(this.treeStates, now);

    const clearing = this.clearing;
    const collision = this.collision;
    if (clearing === null || collision === null) return;

    // The clearing's trees, then the forest's, in the order the server keeps them.
    const forestFirst = clearing.props.length;
    const standing = [...clearing.props, ...this.wildernessProps];
    for (const [treeId, state] of this.treeStates) {
      const inClearing = clearing.indexById.get(treeId);
      const inForest = this.wildernessIndexById.get(treeId);
      const slot = inClearing ?? (inForest === undefined ? undefined : forestFirst + inForest);
      const original = slot === undefined ? undefined : standing[slot];
      if (slot === undefined || original === undefined) continue;

      const grown = treeAtGeneration(clearing.seed, original, state.generation);
      standing[slot] = grown;
      // Colliders are laid out the same way: the clearing's, then the forest's.
      replaceCollider(
        collision,
        inClearing ?? clearing.colliders.length + (inForest ?? 0),
        state.felled ? stumpColliderFor(grown) : colliderForProp(grown),
      );
    }
    this.standingProps = standing;
    const trees = standing.filter((prop) => !this.isFelled(prop.id));
    if (this.forestEnvironment === null) {
      this.forestEnvironment = createForestEnvironment(
        standing,
        clearing.water,
        collision.terrain,
        trees,
      );
    } else {
      this.forestEnvironment.setStandingProps(trees);
    }
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
      if (
        present.has(id) &&
        this.builtProps.find((prop) => prop.id === id)?.kind === built.group.userData.builtKind
      )
        continue;
      this.outdoors.remove(built.group);
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
        // A boat is the one piece that moves, and only when somebody climbs
        // in or out: it is hidden while it is being rowed, because the boat
        // under the rider is the one drawn.
        if (prop.kind === 'rowboat') {
          existing.group.position.set(prop.x, LAKE.level, prop.z);
          existing.group.rotation.y = prop.yaw;
          existing.group.visible = prop.occupied !== true;
        }
        continue;
      }
      const built = createBuiltMesh(prop.kind);
      // Reflects whatever the server already thinks, not always unlit - a
      // client that joins mid-burn should see the fire going from the start.
      if ('setLit' in built) built.setLit(prop.lit);
      built.group.position.set(prop.x, this.builtGroundY(prop.kind, prop.x, prop.z), prop.z);
      built.group.rotation.y = prop.yaw;
      built.group.visible = prop.occupied !== true;
      this.outdoors.add(built.group);
      built.group.userData.builtKind = prop.kind;
      this.builtMeshes.set(prop.id, built);
    }
    if (this.collision !== null) {
      const old = new Set(this.solidHomes.values());
      this.collision.colliders.splice(
        0,
        this.collision.colliders.length,
        ...this.collision.colliders.filter((collider) => !old.has(collider)),
      );
      this.solidHomes.clear();
      for (const blocker of this.homeCameraBlockers) {
        blocker.geometry.dispose();
        (blocker.material as THREE.Material).dispose();
      }
      this.homeCameraBlockers.length = 0;
      for (const prop of this.builtProps)
        if (isHomeKind(prop.kind)) {
          const groundY = this.collision.terrain.heightAt(prop.x, prop.z);
          const collider = cabinCollider(prop, groundY);
          this.collision.colliders.push(collider);
          this.solidHomes.set(prop.id, collider);
          this.homeCameraBlockers.push(homeCameraBlocker(prop, groundY));
        }
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
      this.outdoors.remove(mound.group);
      mound.dispose();
      this.buriedCacheMeshes.delete(id);
    }

    for (const cache of this.buriedCaches) {
      if (this.buriedCacheMeshes.has(cache.id)) continue;
      const mound = createBuriedCacheMound();
      mound.group.position.set(cache.x, 0, cache.z);
      this.outdoors.add(mound.group);
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
    this.remoteMoves.delete(netId);
    this.fishingPoses.delete(netId);
    const trail = this.trails.get(netId);
    if (trail !== undefined) {
      this.scene.remove(trail.mesh);
      trail.dispose();
      this.trails.delete(netId);
    }
    const character = this.remoteCharacters.get(netId);
    if (character === undefined) return;
    this.scene.remove(character.group);
    character.dispose();
    this.remoteCharacters.delete(netId);
  }

  /** The standing tree in reach from here, facing this way, if any. */
  private treeAt(position: Readonly<Vec3>, yaw: number) {
    if (this.clearing === null) return null;
    return treeInReach(position, yaw, this.standingProps, (id) => this.isFelled(id));
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

  private critterFor(animalId: number): Critter | Raccoon | Fox | WoodlandCreature {
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

  private readonly handleForestVisibility = (): void => {
    this.forestAudio.update(this.playing && !document.hidden);
  };

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
    const rightTap = controls.takeRightClickTap();
    const rightPoint = controls.takeRightClickPoint();
    const clickPoint = controls.takeClickPoint();
    if (this.placing !== null) {
      if (clickPoint !== null) {
        controls.swallowLeftPress();
        this.placePiece();
      }
      this.turnPiece(controls.takeWheelSteps());
      if (rightTap) this.stopPlacing();
    } else {
      if (clickPoint !== null && this.playing && !this.chestOpen) {
        if (
          !this.inventoryOpen &&
          !this.mapOpen &&
          !this.buildMenuOpen &&
          !this.craftMenuOpen &&
          this.chestAt(clickPoint, camera)
        ) {
          controls.swallowLeftPress();
          this.transferChest({ action: 'open' });
        } else if (
          !this.inventoryOpen &&
          !this.mapOpen &&
          !this.buildMenuOpen &&
          !this.craftMenuOpen &&
          this.currentHomeKind() === 'largeCabin' &&
          this.interiorTargetAt(clickPoint, camera, this.homeInterior?.garden)
        ) {
          controls.swallowLeftPress();
          this.craftMenuOpen = true;
          this.setJournalTab('garden');
        } else this.aimTowardsClickPoint(clickPoint, camera);
      }
      // Only a piece being placed has any use for either; left over from
      // before one was picked, they would act on it the moment it was.
      controls.takeWheelSteps();
      if (
        rightTap &&
        rightPoint !== null &&
        this.playing &&
        !this.inventoryOpen &&
        !this.mapOpen &&
        !this.craftMenuOpen &&
        !this.buildMenuOpen
      )
        this.lootAt(rightPoint, camera);
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
    this.handleExpeditionBoardInput(controls);
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
    const forestActive = this.playing && !document.hidden;
    this.forestAudio.update(forestActive);
    if (this.localPlayer !== null) {
      this.forestAtmosphere.update(
        deltaSeconds,
        {
          x: this.localPlayer.motion.position.x,
          z: this.localPlayer.motion.position.z,
          grounded: this.localPlayer.motion.grounded,
          indoors: this.space !== OUTDOORS,
          active: forestActive,
          night: isNight(dayProgress(this.estimatedServerTimeMs())),
          cameraYaw: camera.look.yaw,
        },
        this.forestEnvironment,
      );
    }
    if (this.localPlayer !== null)
      this.wildernessScene?.update(deltaSeconds, this.localPlayer.motion.position);
    if (this.localPlayer !== null && this.space === OUTDOORS)
      this.grass?.update(
        deltaSeconds,
        this.localPlayer.motion.position,
        this.reducedMotion.matches,
        forestWeather(this.weatherSeed, this.estimatedServerTimeMs()).wind,
      );
    this.updateRemotePlayers(deltaSeconds);
    // After everybody, ours included, has been placed: boats of those who stopped rowing go.
    this.rowingBoats.sweep();
    this.updateRemoteAnimals(deltaSeconds);
    this.raiders.update(deltaSeconds, this.listenerPoint(), this.aimedRaiderId);
    this.bursts.update(deltaSeconds);
    this.clearingScene?.update(deltaSeconds);
    for (const landing of [
      ...(this.clearingScene?.drainLandings() ?? []),
      ...(this.wildernessScene?.drainLandings() ?? []),
    ]) {
      this.showTreeLanding(landing, camera);
    }
    this.treeLandingEffects.update(deltaSeconds, camera.camera);
    this.floats.update(deltaSeconds, (netId) => this.anglerOf(netId));
    for (const model of this.decorModels) if ('update' in model) model.update(deltaSeconds);
    const weatherNow = this.estimatedServerTimeMs();
    const weather = forestWeather(this.weatherSeed, weatherNow);
    this.weatherCloud +=
      (weather.precipitation - this.weatherCloud) * Math.min(1, deltaSeconds * 0.5);
    const season = seasonMix(this.currentCalendar());
    this.seasons.apply(season, this.daylight);
    this.daylight?.update(dayProgress(weatherNow), this.weatherCloud);
    const watcher = this.localPlayer?.motion.position ?? { x: 0, z: 0 };
    this.weatherArt?.update(
      deltaSeconds,
      watcher,
      weatherNow,
      weather,
      this.space !== OUTDOORS,
      this.reducedMotion.matches,
      rainShareFor(season),
    );
    // Fill the air where the camera is looking, so it is the part that is seen that is full.
    camera.camera.getWorldDirection(this.viewDirection);
    this.fallCentre.x = camera.camera.position.x + this.viewDirection.x * 10;
    this.fallCentre.z = camera.camera.position.z + this.viewDirection.z * 10;
    this.seasonFallArt?.update(
      deltaSeconds,
      this.fallCentre,
      season,
      weather,
      dayBrightness(dayProgress(weatherNow)),
      this.space !== OUTDOORS,
      this.reducedMotion.matches,
    );
    // Fires and windows animate; the `in` check skips the other
    // buildable kinds sharing this map without giving them all a no-op method.
    for (const built of this.builtMeshes.values()) {
      if ('update' in built && typeof built.update === 'function') built.update(deltaSeconds);
      if ('setDaylight' in built && typeof built.setDaylight === 'function')
        built.setDaylight(dayBrightness(dayProgress(weatherNow)));
    }

    if (this.homeInterior !== null && this.space !== OUTDOORS) {
      this.homeInterior.cutAway(camera.camera.position.x, camera.camera.position.z);
      this.homeInterior.update(
        deltaSeconds,
        dayBrightness(dayProgress(this.estimatedServerTimeMs())),
      );
    }
    if (this.fadeGiveUpAt !== null && now > this.fadeGiveUpAt) {
      this.fadeGiveUpAt = null;
      this.sceneFade?.classList.remove('scene-fade-dark');
    }

    this.fireLights?.update(camera.camera.position);
    // Menus remain responsive without repeatedly drawing an unchanged view.
    // Keep the simulation and network alive; only paused drawing is throttled.
    const viewingMenu =
      !this.playing ||
      this.chestOpen ||
      this.inventoryOpen ||
      this.craftMenuOpen ||
      this.buildMenuOpen ||
      this.mapOpen;
    if (!viewingMenu || this.firstWorldFrame !== null || now - this.lastRenderedAt >= 1000) {
      setup.renderer.render(this.scene, camera.camera);
      this.lastRenderedAt = now;
      const rendered = this.firstWorldFrame;
      this.firstWorldFrame = null;
      rendered?.();
    }
    this.updateMapFeed(camera);
    this.updateCombatFeed(camera);
    this.updateHud(now, deltaSeconds);
  };

  /** One ground-contact event drives all the feedback, so it cannot drift from the fall. */
  private showTreeLanding({ tree, yaw }: TreeLanding, camera: FollowCamera): void {
    if (this.space !== OUTDOORS) return;
    this.treeLandingEffects.burst(tree, yaw);
    const spots = treeLogSpots(tree, yaw);
    for (const spot of spots) {
      this.bursts.burst(
        'wood',
        new THREE.Vector3(spot.x, (tree.y ?? 0) + 0.18, spot.z),
        Math.sin(yaw),
        Math.cos(yaw),
        0.65,
      );
    }
    const listener = this.listenerPoint();
    const center = spots[Math.floor(spots.length / 2)] ?? tree;
    if (listener !== null) {
      const volume =
        Math.max(0, 1 - Math.hypot(listener.x - center.x, listener.z - center.z) / 24) ** 2;
      playTreeLanding(volume);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        camera.shake(volume * 0.16);
    }
  }

  /**
   * What the combat overlay draws this frame (see decision 0063): an arrow
   * for every skeleton close enough to matter that is not on screen, and
   * how much health is left. Being hurt is set as it happens, in
   * `hearAboutHealth`.
   */
  private updateCombatFeed(camera: FollowCamera): void {
    const feed = this.combatFeed;
    const me = this.listenerPoint();
    feed.showing = this.playing && !this.mapOpen && me !== null;
    feed.health = this.health / HEALTH_MAX;
    feed.cameraYaw = camera.look.yaw;
    if (!feed.showing || me === null) {
      feed.threats = [];
      return;
    }
    const threats: ThreatMark[] = [];
    for (const marker of this.raiders.markers()) {
      const dx = marker.x - me.x;
      const dz = marker.z - me.z;
      const distance = Math.hypot(dx, dz);
      if (distance > THREAT_ARROWS_WITHIN) continue;
      if (this.inView(marker.x, marker.y, marker.z, camera)) continue;
      const bearing = wrapAngle(camera.look.yaw - Math.atan2(-dx, -dz));
      threats.push({ bearing, distance, attacking: marker.attacking });
    }
    feed.threats = threats;
  }

  /** Whether a point a skeleton's chest high above this spot is on screen right now. */
  private inView(x: number, y: number, z: number, camera: FollowCamera): boolean {
    const point = this.scratchProject.set(x, y + 1, z).project(camera.camera);
    return point.z > -1 && point.z < 1 && Math.abs(point.x) < 0.92 && Math.abs(point.y) < 0.9;
  }

  /** Whether a click is starting an attack this frame, or one is already under way. */
  private attackingOrAboutTo(buttons: number, kind: ActionKind): boolean {
    if (this.space !== OUTDOORS || (this.equipped.get(this.selfNetId) ?? null) === null) {
      return false;
    }
    return (
      (buttons & (PlayerButton.Swing | PlayerButton.Charge)) !== 0 ||
      kind === ActionKind.Swing ||
      kind === ActionKind.Charge ||
      kind === ActionKind.Strike ||
      kind === ActionKind.DodgeLight ||
      kind === ActionKind.DodgeHeavy
    );
  }

  /**
   * Which way to swing to find the skeleton best placed to be hit (see
   * decision 0063): close by, and roughly the way the player is pushing,
   * the camera looks, or the character already faces. Null with none.
   */
  private softLockYaw(
    position: Readonly<Vec3>,
    facingYaw: number,
    intent: { readonly x: number; readonly z: number },
    cameraYaw: number,
  ): number | null {
    const walk = worldMoveDirection(intent.x, intent.z, cameraYaw);
    const meant = walk.x !== 0 || walk.z !== 0 ? Math.atan2(-walk.x, -walk.z) : cameraYaw;
    let best: number | null = null;
    let bestScore = Infinity;
    for (const raider of this.raiders.targets()) {
      const dx = raider.x - position.x;
      const dz = raider.z - position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > SOFT_LOCK_RANGE || distance < 1e-3) continue;
      const yaw = Math.atan2(-dx, -dz);
      const off = Math.min(Math.abs(wrapAngle(yaw - meant)), Math.abs(wrapAngle(yaw - facingYaw)));
      if (off > SOFT_LOCK_HALF_ANGLE) continue;
      // A step further off is worth about forty degrees closer to the aim.
      const score = distance + off * 1.5;
      if (score < bestScore) {
        bestScore = score;
        best = yaw;
      }
    }
    return best;
  }

  /**
   * Where you are and which way the camera looks, for the maps, plus
   * everybody else nearby - every frame, since the minimap turns with the
   * camera. Also fills the map in around you straight away, ahead of the
   * server's own word on it (see decision 0054).
   */
  private updateMapFeed(camera: FollowCamera): void {
    const feed = this.mapFeed;
    const player = this.localPlayer;
    const home =
      this.space === OUTDOORS ? undefined : this.builtProps.find((prop) => prop.id === this.space);
    if (home !== undefined) {
      // Inside a home, the map shows where the home is.
      const doorstep = cabinDoorstep(home);
      feed.player = { x: doorstep.x, z: doorstep.z, facingYaw: doorstep.yaw };
    } else if (player !== null) {
      const { position, facingYaw } = player.motion;
      feed.player = { x: position.x, z: position.z, facingYaw };
      feed.revealAt(position.x, position.z);
    }
    feed.cameraYaw = camera.look.yaw;
    feed.isNight = isNight(dayProgress(this.estimatedServerTimeMs()));
    feed.raiders = this.space !== OUTDOORS ? [] : this.raiders.markers();
    feed.others =
      this.space !== OUTDOORS
        ? []
        : this.remotePlayers.netIds().flatMap((netId) => {
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
   * B outdoors opens the Craft menu, the same one C does, on its Craft page:
   * what you make and what you place are listed together (see decision 0096).
   * While it is open, a digit key picks the entry numbered beside it; picking a
   * piece starts placing it (see decision 0052), and while a piece is being
   * placed the same digit keys swap it for another without going back.
   *
   * Indoors B is the room's decorating panel, which has pieces of its own.
   */
  private handleBuildMenuInput(controls: Controls): void {
    if (this.space !== OUTDOORS) {
      if (controls.takeBuildMenuToggle()) {
        this.stopPlacing();
        this.buildMenuOpen = !this.buildMenuOpen;
        this.craftMenuOpen = false;
        this.inventoryOpen = false;
      }
      if (this.buildMenuOpen && this.homeHere()?.yours === true) {
        for (const index of controls.takeBuildTaps()) {
          const kind = DECORATION_KINDS[index];
          if (kind !== undefined) {
            this.pickBuildable(kind);
            break;
          }
        }
      }
      return;
    }
    this.buildMenuOpen = false;
    if (controls.takeBuildMenuToggle()) {
      if (this.craftMenuOpen && this.journalTab === 'craft') this.craftMenuOpen = false;
      else this.openCraftMenu();
    }
    if (this.placing === null || this.craftMenuOpen) return;
    // A piece in hand: a digit swaps it for another, the way it always has.
    for (const index of controls.takeCraftTaps()) {
      const entry = this.craftMenuEntriesShown()[index];
      if (entry === undefined || entry.locked || entry.action.kind !== 'build') continue;
      this.pickBuildable(entry.action.buildable);
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
    this.decorMoveId = 0;
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
    if (this.space !== OUTDOORS && isDecorationKind(request.kind)) {
      this.connection?.sendDecoration({
        ...request,
        kind: request.kind,
        id: this.decorMoveId,
        action: this.decorMoveId === 0 ? 'place' : 'move',
      });
      this.stopPlacing();
      return;
    }
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

    if (this.space !== OUTDOORS && isDecorationKind(placing.kind)) {
      const mouse = this.groundUnderPointer(camera);
      const affordable =
        this.decorMoveId !== 0 ||
        canAfford(inventoryFromEntries(this.carrying), BUILDABLE_KINDS[placing.kind]);
      const piece = {
        id: this.decorMoveId,
        homeId: this.space,
        kind: placing.kind,
        x: mouse?.x ?? 0,
        z: mouse?.z ?? 0,
        yaw: placing.yaw,
      };
      const reason =
        this.homeHere()?.yours !== true
          ? 'private'
          : !affordable
            ? 'materials'
            : checkDecorationSpot(
                this.currentHomeKind(),
                piece,
                this.decorations.filter((piece) => piece.homeId === this.space),
                player.motion.position,
              );
      placing.plan = {
        spot: mouse === null ? null : piece,
        refusal: this.decorationRefusal(reason),
        affordable,
        snapped: false,
      };
      if (mouse === null) placing.ghost.hide();
      else placing.ghost.show(mouse.x, mouse.z, placing.yaw, reason === null, 0);
      return;
    }
    placing.plan = planPlacement({
      kind: placing.kind,
      enforceHomeArea: true,
      terrain: this.collision!.terrain,
      protectedSites: this.protectedBuildSites,
      homeSkills: this.homeSkills,
      yaw: placing.yaw,
      mouse: this.groundUnderPointer(camera),
      player: player.motion.position,
      snap: !(this.controls?.isShiftHeld() ?? false),
      carrying: this.carrying,
      storedSupplies: this.homeStoredSupplies,
      built: this.builtProps,
      pending: this.pendingPlacements.map((pending) => pending.request),
      scenery: this.sceneryFootprints(),
      water: this.keepOutWater,
      lakeFrozen: this.lakeFrozen,
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
    else
      placing.ghost.show(
        spot.x,
        spot.z,
        spot.yaw,
        refusal === null,
        this.builtGroundY(placing.kind, spot.x, spot.z),
      );
  }

  /**
   * The server says the lake froze over or thawed (decision 0095): draw it as
   * ice or water, and let the ground under our own feet match, so walking out
   * on it is predicted the same way the server will decide it.
   */
  private applyLakeIce(frozen: boolean): void {
    this.lakeFrozen = frozen;
    this.lakeScene?.setFrozen(frozen);
    if (this.collision !== null) setLakeFrozen(this.collision, frozen);
  }

  /** Where the foot of a built piece sits: on the ground, or for a boat on the lake's surface. */
  private builtGroundY(kind: BuildableKindId, x: number, z: number): number {
    return kind === 'rowboat' ? LAKE.level : (this.collision?.terrain.heightAt(x, z) ?? 0);
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
    const ray = this.clickRaycaster.ray;
    if (this.space !== OUTDOORS) {
      if (Math.abs(ray.direction.y) < 0.00001) return null;
      const distance = -ray.origin.y / ray.direction.y;
      return distance < 0
        ? null
        : {
            x: ray.origin.x + distance * ray.direction.x,
            z: ray.origin.z + distance * ray.direction.z,
          };
    }
    // A boat is aimed at the water's surface, not the bed under it.
    return this.collision === null
      ? null
      : groundAlongRay(
          ray.origin,
          ray.direction,
          this.collision.terrain,
          this.placing?.kind === 'rowboat' ? LAKE.level : undefined,
        );
  }

  /** Every tree, rock and stump, as the same footprints the server checks a build against. */
  private sceneryFootprints(): Footprint[] {
    return [
      ...this.standingProps.map((prop) =>
        roundFootprint(
          prop.x,
          prop.z,
          PROP_KINDS[prop.kind].colliderRadius * prop.scale,
          this.isFelled(prop.id) ? 'stump' : PROP_KINDS[prop.kind].displayName.toLowerCase(),
        ),
      ),
      // Mature reeds move round the shore as they are cut and come back, so
      // this is where they stand now.
      ...reedFootprints(
        this.gatherPatches.filter((patch) => isReedPatch(patch.id) && patch.remaining > 0),
      ),
    ];
  }

  /**
   * C opens or closes the Craft menu (see decision 0096), closing the room
   * decorating panel if that was open instead. While it is open, a digit key
   * picks the entry numbered beside it. Crafting something leaves the menu
   * open, since making several things in a row is common and nothing about
   * a craft needs a fresh aim the way a placement does; picking a piece to
   * place closes it.
   */
  private showJournalNotice(text: string, now: number): void {
    this.craftingNews = { text, until: now + NEWS_MS };
    this.options.hud.publish({ craftingNews: text });
  }

  chooseExpedition(request: ExpeditionRequest): void {
    if (this.connection?.sendExpedition(request)) {
      this.expeditionPendingUntil = performance.now() + 4000;
      this.options.hud.publish({ expeditionPending: true });
    }
  }
  private nearOwnExpeditionBoard(): boolean {
    if (this.space !== OUTDOORS) return this.homeHere()?.yours === true;
    const home = this.builtProps.find((prop) => prop.yours && isHomeKind(prop.kind));
    const player = this.localPlayer;
    if (home === undefined || player === null) return false;
    const spot = expeditionBoardSpot(home);
    return (
      Math.hypot(player.motion.position.x - spot.x, player.motion.position.z - spot.z) <=
      EXPEDITION_BOARD_REACH
    );
  }
  /**
   * Standing at the board on the doorstep, free to read it with a press of E:
   * not inside, not mid-swing or mid-cast, and not in the doorway, which keeps
   * the press for the door. Reaching it from inside your home stays with the
   * button on screen, since there is no board in there to stand at.
   */
  private atOwnExpeditionBoard(): boolean {
    const player = this.localPlayer;
    if (this.space !== OUTDOORS || player === null) return false;
    if (!isFreeToInteract(player.action) || this.fishingPhase !== null) return false;
    const home = this.builtProps.find((prop) => prop.yours && isHomeKind(prop.kind));
    if (home === undefined) return false;
    const { x, z } = player.motion.position;
    const spot = expeditionBoardSpot(home);
    if (Math.hypot(x - spot.x, z - spot.z) > EXPEDITION_BOARD_REACH) return false;
    return !isEnteringDoorway(home, x, z, 0, 0, true);
  }

  /**
   * E reads the expedition board when you are standing at it, and puts it
   * away again the next time. The press is taken here so it is not also sent
   * on to the server as "interact", where it would go on to eat or sit.
   */
  private handleExpeditionBoardInput(controls: Controls): void {
    if (!this.playing) return;
    if (expeditionBoardOpen({ craftMenuOpen: this.craftMenuOpen, journalTab: this.journalTab })) {
      if (controls.claimInteractPress()) {
        this.craftMenuOpen = false;
        // Not left for the next HUD update, so a quick second press opens it again.
        this.options.hud.publish({ craftMenuOpen: false });
      }
      return;
    }
    if (expeditionBoardClaimsInteract(this.boardClaimState()) && controls.claimInteractPress()) {
      this.setJournalTab('expeditions');
    }
  }

  /** Who E belongs to right now, read fresh from the game rather than the HUD's slower copy. */
  private boardClaimState(): BoardClaimState {
    return {
      atExpeditionBoard: this.atOwnExpeditionBoard(),
      craftMenuOpen: this.craftMenuOpen,
      buildMenuOpen: this.buildMenuOpen,
      inventoryOpen: this.inventoryOpen,
      mapOpen: this.mapOpen,
      placing: this.placing,
      nearbyItem: this.nearbyItem,
      nearbyPile: this.nearbyPile,
      nearGatherSpot: this.nearGatherSpot,
      nearBuriedCache: this.nearBuriedCache,
      nearbyDiscovery: this.nearbyDiscoveryName(),
      nearCampfire: this.nearCampfire,
      boat: this.space === OUTDOORS ? this.boatHint : null,
    };
  }

  /** The name of an unclaimed find within reach, outdoors, or null. */
  private nearbyDiscoveryName(): string | null {
    const player = this.localPlayer;
    if (this.space !== OUTDOORS || player === null) return null;
    return (
      this.discoverySites.find(
        (site) =>
          !discoveryKnown(this.discoveriesClaimed, site.id) &&
          Math.hypot(player.motion.position.x - site.x, player.motion.position.z - site.z) < 2.7,
      )?.name ?? null
    );
  }

  setJournalTab(tab: 'craft' | 'discoveries' | 'garden' | 'expeditions' | 'fishing'): void {
    this.journalTab = tab;
    this.craftMenuOpen = true;
    this.buildMenuOpen = false;
    this.inventoryOpen = false;
    this.options.hud.publish({
      journalTab: tab,
      craftMenuOpen: true,
      buildMenuOpen: false,
      inventoryOpen: false,
    });
    if (tab === 'garden') this.connection?.sendGarden({ action: 'inspect' });
  }
  useGarden(request: GardenRequest): void {
    this.connection?.sendGarden(request);
  }

  /** Switch the Craft menu to another page: everything, or one kind of thing. */
  setCraftTab(tab: CraftTabId): void {
    this.craftTab = tab;
    this.options.hud.publish({ craftTab: tab });
  }

  /** Open the Craft menu on its Craft page, putting away whatever else was open. */
  private openCraftMenu(): void {
    this.journalTab = 'craft';
    this.craftMenuOpen = true;
    this.buildMenuOpen = false;
    this.inventoryOpen = false;
    this.stopPlacing();
    this.options.hud.publish({ journalTab: 'craft', craftMenuOpen: true, inventoryOpen: false });
  }

  /**
   * The entries on the page of the Craft menu that is showing, in the order
   * the number keys count them. Read from the HUD's own state, so a key always
   * agrees with what the panel lists beside its number.
   */
  private craftMenuEntriesShown(): CraftEntry[] {
    const state = this.options.hud.getSnapshot();
    const entries = craftMenuEntries(state);
    return entriesOnTab(entries, shownTab(entries, this.craftTab));
  }

  /**
   * Pick an entry from the Craft menu: make a thing into the pack, which leaves
   * the menu open for the next one, or pick up a piece to place, which closes it.
   */
  pickCraftEntry(action: CraftAction): void {
    if (action.kind === 'craft') this.connection?.sendCraft(action.item);
    else this.pickBuildable(action.buildable);
  }

  private updateDiscoveryMarkers(): void {
    this.mapFeed.discoveries = this.discoverySites
      .filter((site) => discoveryKnown(this.discoveriesFound, site.id))
      .map((site) => ({ x: site.x, z: site.z, name: site.name }));
  }

  private handleCraftMenuInput(controls: Controls): void {
    if (controls.takeCraftMenuToggle()) {
      this.craftMenuOpen = !this.craftMenuOpen;
      if (this.craftMenuOpen) {
        this.buildMenuOpen = false;
        this.inventoryOpen = false;
      }
    }
    if (!this.craftMenuOpen) return;
    const taps = controls.takeCraftTaps();
    if (this.journalTab !== 'craft') return;
    const entries = this.craftMenuEntriesShown();
    for (const index of taps) {
      const entry = entries[index];
      if (entry !== undefined && !entry.locked) this.pickCraftEntry(entry.action);
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

  /** The visible loot under a cursor ray, including solid scenery occlusion. */
  private lootTargetAt(
    point: { x: number; y: number },
    camera: FollowCamera,
  ): typeof this.hoveredLoot {
    if (this.space !== OUTDOORS || this.clearingScene === null || this.clearing === null)
      return null;
    const candidates: NonNullable<typeof this.hoveredLoot>[] = [];
    for (const pickup of this.clearing.pickups) {
      if (this.takenPickups.has(pickup.id)) continue;
      const object = this.clearingScene.pickupObject(pickup.id);
      if (object !== null)
        candidates.push({
          request: { kind: 'pickup', id: pickup.id },
          item: pickup.item,
          count: 1,
          object,
          x: pickup.x,
          z: pickup.z,
        });
    }
    for (const pile of this.droppedPiles) {
      const object = this.groundItems?.target('pile', pile.id) ?? null;
      if (object !== null)
        candidates.push({
          request: { kind: 'pile', id: pile.id },
          item: pile.item,
          count: pile.count,
          object,
          x: pile.x,
          z: pile.z,
        });
    }
    for (const patch of this.gatherPatches) {
      if (patch.remaining <= 0) continue;
      const object = this.groundItems?.patchObject(patch.id) ?? null;
      if (object !== null)
        candidates.push({
          request: { kind: 'patch', id: patch.id },
          item: patch.item,
          count: patch.remaining,
          object,
          x: patch.x,
          z: patch.z,
        });
    }
    this.clickNdc.set(
      (point.x / window.innerWidth) * 2 - 1,
      -(point.y / window.innerHeight) * 2 + 1,
    );
    this.clickRaycaster.setFromCamera(this.clickNdc, camera.camera);
    return lootUnderRay(this.clickRaycaster, candidates, [
      this.clearingScene.cameraBlockers,
      ...(this.wildernessScene?.cameraBlockers ?? []),
      ...this.homeCameraBlockers,
    ]);
  }

  private lootDetail(target: LootTarget): string {
    return (
      this.lootProblem(target) ??
      (target.request.kind === 'patch' ? 'Right-click to gather' : 'Right-click to loot')
    );
  }

  private lootProblem(target: LootTarget): string | null {
    const position = this.motionOrOrigin();
    if (Math.hypot(position.x - target.x, position.z - target.z) > PICKUP_REACH)
      return 'Too far away · move closer';
    if (
      this.localPlayer !== null &&
      (!isFreeToInteract(this.localPlayer.action) || this.fishingPhase !== null)
    )
      return 'Finish your current action first';
    const pack = inventoryFromEntries(this.carrying);
    const kind = ITEM_KINDS[target.item];
    if (roomFor(pack, target.item) === 0)
      return kind.maxCarry === 1 &&
        this.carrying.some((entry) => entry.item === target.item && entry.count > 0)
        ? `You can only carry one ${kind.displayName.toLowerCase()}`
        : 'Pack full · make room in your pack';
    return null;
  }

  private lootAt(point: { x: number; y: number }, camera: FollowCamera): void {
    const target = this.lootTargetAt(point, camera);
    if (target === null) return;
    const problem = this.lootProblem(target);
    if (problem !== null) {
      this.interactionNote = problem;
      this.interactionNoteUntil = performance.now() + 2800;
      return;
    }
    this.aimYaw = yawTowards(this.motionOrOrigin(), target);
    this.connection?.sendLoot(target.request);
  }

  /** Turn the character toward a clicked target, keeping the camera heading. */
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
      camera.update(from, 0, [
        ...wilderness.cameraBlockers,
        clearing.cameraBlockers,
        ...this.homeCameraBlockers,
      ]);
    }

    this.clickNdc.set(
      (point.x / window.innerWidth) * 2 - 1,
      -(point.y / window.innerHeight) * 2 + 1,
    );
    this.clickRaycaster.setFromCamera(this.clickNdc, camera.camera);

    // Fishing aims at the water beneath the cursor. A canopy between the
    // camera and pond must not turn a rod click into an attack at its trunk.
    const targets =
      toolKind(this.equipped.get(this.selfNetId) ?? null) === 'rod' ? [] : this.clickCandidates();
    const yaw = clickAimYaw(this.clickRaycaster.ray, from, from.y, targets);
    if (yaw !== null) this.aimYaw = yaw;
  }

  /**
   * Everything a click can land on, as upright cylinders: each standing
   * tree as a trunk and a canopy that both face its trunk, and each animal.
   * Rebuilt per click rather than kept up to date - a click is rare, and the
   * few hundred small objects within reach are nothing to make once.
   */
  private clickCandidates(): ClickCandidate[] {
    const candidates: ClickCandidate[] = [];
    // A room's own coordinates overlap the clearing's: nothing out there is clickable from in here.
    if (this.space !== OUTDOORS) return candidates;
    const here = this.localPlayer?.motion.position;
    for (const prop of this.standingProps) {
      if (this.isFelled(prop.id)) continue;
      const kind = PROP_KINDS[prop.kind];
      if (kind.shape.family !== 'tree') continue;
      if (here !== undefined && Math.hypot(prop.x - here.x, prop.z - here.z) > CLICK_TREE_RANGE) {
        continue;
      }
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
    for (const raider of this.raiders.targets()) {
      candidates.push({
        x: raider.x,
        z: raider.z,
        radius: CLICK_RAIDER_RADIUS,
        bottom: raider.y,
        top: raider.y + CLICK_RAIDER_HEIGHT,
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
   * Where in the year this world is (see decision 0089). Worked out from the
   * same shared clock as the time of day, so everybody sees the same season;
   * `?season=` only moves what this one browser shows, by whole days.
   */
  private currentCalendar(): Calendar {
    const now = this.estimatedServerTimeMs();
    if (this.options.season !== undefined && this.seasonShiftMs === null) {
      this.seasonShiftMs = clockShiftForSeason(this.weatherSeed, now, this.options.season);
    }
    return calendarAt(this.weatherSeed, now + (this.seasonShiftMs ?? 0));
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
    const placingMask =
      this.placing === null
        ? ~0
        : ~(PlayerButton.Swing | PlayerButton.Charge | PlayerButton.Fish | PlayerButton.Sit);
    const fishingClick =
      this.fishingPhase !== null ||
      this.actionContext(player.motion.position, this.aimYaw ?? player.motion.facingYaw)
        .castInstead;
    const buttons =
      ((this.controls?.buttons(fishingClick) ?? 0) & placingMask) |
      (this.fishingPhase === 'biting' ? PlayerButton.SawBite : 0);
    // Walking, jumping, swinging, rolling or casting all mean the player is still playing.
    if (
      this.signOutCountdown.counting &&
      (intent.x !== 0 || intent.z !== 0 || (buttons & ACTIVE_BUTTONS) !== 0)
    ) {
      this.signOutCountdown.noteMovement();
    }

    // Walking off lets go of whatever was clicked: the character aims the
    // way it walks again. Not while mid-move with the feet planted, which
    // keeps facing whatever it is about to hit - but creeping through a
    // wind-up does turn to walk, so the strike goes where it is facing.
    const kind = player.action.kind;
    const walksFreely = kind === ActionKind.Idle || kind === ActionKind.Charge;
    if ((intent.x !== 0 || intent.z !== 0) && walksFreely) this.aimYaw = null;
    // Swinging at a skeleton close by turns to face it, and keeps facing it
    // through the combo (see decision 0063).
    if (this.attackingOrAboutTo(buttons, kind)) {
      const locked = this.softLockYaw(
        player.motion.position,
        player.motion.facingYaw,
        intent,
        camera.look.yaw,
      );
      if (locked !== null) this.aimYaw = locked;
    }

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
    this.showOwnMoves(player.drainEvents());

    const position = player.renderPosition(this.scratch);
    character.group.position.set(position.x, position.y, position.z);
    character.group.rotation.y =
      this.facingWhileFishing(this.selfNetId, position) ?? player.renderYaw();

    // Drawn from the very move the server will judge, predicted here: see
    // `sim/actions.ts` and decision 0056.
    const action = player.action;
    const velocity = player.motion.velocity;
    const move = this.localMoves.view(
      action.kind,
      action.step,
      player.actionAge(),
      this.aimedTree !== null && this.isEquipped('axe'),
      rollDirection(action.heading, player.renderYaw()),
    );
    character.setEquippedItem(this.equipped.get(this.selfNetId) ?? null);
    character.setFishing(this.fishingPoses.get(this.selfNetId) ?? null);
    const rowing = action.kind === ActionKind.Row;
    character.setRestSpot(
      rowing
        ? boatSeatAt(position.x, position.z, player.renderYaw())
        : restSpotFor(action.kind, action.step, this.space, this.currentHomeKind()),
    );
    const speed = Math.hypot(velocity.x, velocity.z);
    if (rowing)
      this.rowingBoats.place(
        this.selfNetId,
        position.x,
        position.z,
        player.renderYaw(),
        speed,
        deltaSeconds,
      );
    const pose = character.update(deltaSeconds, {
      move,
      // Seated, so the legs never walk while the boat carries them along.
      locomotion: { speed: rowing ? 0 : speed, airborne: !player.motion.grounded && !rowing },
    });
    this.sweepTrail(this.selfNetId, character, pose, deltaSeconds);
    this.showKnockout(action.kind, action.age);

    camera.update(
      position,
      deltaSeconds,
      this.space === OUTDOORS
        ? [...wilderness.cameraBlockers, clearing.cameraBlockers, ...this.homeCameraBlockers]
        : [],
    );
    this.updatePlacement(camera, player);
    const ownHome = this.builtProps.find((prop) => prop.yours && isHomeKind(prop.kind));
    let area = ownHome === undefined ? null : homeBuildArea(ownHome);
    const proposal = this.placing?.plan.spot;
    if (
      this.placing !== null &&
      isHomeKind(this.placing.kind) &&
      proposal !== null &&
      proposal !== undefined
    )
      area = homeBuildArea({ id: ownHome?.id ?? 0, kind: this.placing.kind, ...proposal });
    // The home's boundary shows while a piece is in hand, or the Craft menu is open on a page that lists pieces.
    const choosingAPiece = choosingPiece({
      craftMenuOpen: this.craftMenuOpen,
      journalTab: this.journalTab,
      craftTab: this.craftTab,
    });
    this.mapFeed.buildArea =
      this.playing && this.space === OUTDOORS && (choosingAPiece || this.placing !== null)
        ? area
        : null;
    this.buildBoundary?.show(
      this.playing && this.space === OUTDOORS && (choosingAPiece || this.placing !== null)
        ? area
        : null,
      this.placing?.plan.refusal !== null && this.placing?.plan.refusal !== undefined,
    );

    // Walking into a door darkens the screen straight away, ahead of the
    // server's own word that we are through - see decision 0055.
    const walk = worldMoveDirection(intent.x, intent.z, camera.look.yaw);
    if (this.walkingThroughADoor(player.motion.position, walk.x, walk.z)) this.darkenForDoor();
    this.doorHint = this.doorHintAt(player.motion.position);

    if (this.space !== OUTDOORS) {
      // Nothing out in the world is within reach from in here.
      this.hoveredLoot = null;
      const pointer = this.controls?.pointerPosition() ?? null;
      this.hoveredChest =
        this.playing &&
        !this.chestOpen &&
        !this.inventoryOpen &&
        !this.mapOpen &&
        !this.craftMenuOpen &&
        !this.buildMenuOpen &&
        !this.controls?.isPointerLocked &&
        pointer !== null &&
        document.elementFromPoint(pointer.x, pointer.y) === this.options.canvas &&
        this.chestAt(pointer, camera);
      this.options.canvas.style.cursor = this.hoveredChest ? 'pointer' : '';
      this.gatheringFocus.setTarget(
        this.hoveredChest ? (this.homeInterior?.chest ?? null) : null,
        0.65,
        this.homeHere()?.yours !== true,
      );
      this.nearbyItem = null;
      this.nearbyPile = null;
      this.nearGatherSpot = null;
      this.nearBuriedCache = false;
      this.ownCacheCompass = null;
      this.nearCampfire = homeFacilityInReach(
        this.currentHomeKind(),
        'cooking',
        player.motion.position,
      )
        ? 'lit'
        : null;
      this.nearWorkbench = homeFacilityInReach(
        this.currentHomeKind(),
        'workbench',
        player.motion.position,
      );
      this.nearGarden = homeFacilityInReach(
        this.currentHomeKind(),
        'garden',
        player.motion.position,
      );
      this.aimedTree = null;
      this.aimedAnimal = null;
      this.aimedAnimalId = null;
      this.aimedRaider = null;
      this.aimedRaiderId = null;
      this.raidersClose = false;
      this.canCast = false;
      this.restingNearby = isFreeToInteract(action)
        ? (restingPlaceInReach(
            player.motion.position.x,
            player.motion.position.z,
            this.currentHomeKind(),
          )?.kind ?? null)
        : null;
      this.canBuild = false;
      this.centreSunOn(position);
      return;
    }

    this.hoveredChest = false;
    this.nearWorkbench = false;
    this.nearGarden = false;
    if (performance.now() >= this.hoverDueAt) {
      this.hoverDueAt = performance.now() + 80;
      const pointer = this.controls?.pointerPosition() ?? null;
      const overWorld =
        pointer !== null && document.elementFromPoint(pointer.x, pointer.y) === this.options.canvas;
      this.hoveredLoot =
        overWorld &&
        pointer !== null &&
        this.playing &&
        !this.controls?.isPointerLocked &&
        !this.inventoryOpen &&
        !this.mapOpen &&
        !this.craftMenuOpen &&
        !this.buildMenuOpen &&
        this.placing === null
          ? this.lootTargetAt(pointer, camera)
          : null;
      this.options.canvas.style.cursor = this.hoveredLoot === null ? '' : 'pointer';
    }
    // Only a hint. The server decides who actually gets it.
    const reachable =
      this.clearing === null
        ? null
        : pickupInReach(player.motion.position, this.clearing.pickups, (id) =>
            this.takenPickups.has(id),
          );
    this.nearbyItem = reachable?.item ?? null;

    const pile = droppedPileInReach(player.motion.position, this.droppedPiles);
    this.nearbyPile = pile === null ? null : { item: pile.item, count: pile.count };

    const patch = gatherSpotInReach(player.motion.position, this.gatherPatches);
    this.nearGatherSpot = patch?.item ?? null;
    const gatherObject =
      reachable !== null
        ? clearing.pickupObject(reachable.id)
        : pile !== null
          ? (this.groundItems?.target('pile', pile.id) ?? null)
          : patch !== null
            ? (this.groundItems?.target('patch', patch.id) ?? null)
            : null;
    const targetItem = reachable?.item ?? pile?.item ?? patch?.item;
    const blocked =
      targetItem !== undefined && roomFor(inventoryFromEntries(this.carrying), targetItem) === 0;
    this.gatheringFocus.setTarget(
      isFreeToInteract(action) && this.playing && !this.inventoryOpen && !this.mapOpen
        ? (this.hoveredLoot?.object ?? gatherObject)
        : null,
      pile !== null && reachable === null ? 0.6 : 0.28,
      this.hoveredLoot !== null ? this.lootProblem(this.hoveredLoot) !== null : blocked,
    );
    this.gatheringFocus.update(deltaSeconds);

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
    this.boatHint = this.boatHintFor(player.motion.position, action);

    // A skeleton in reach beats anything else a swing could find, the same
    // way the server's own `landBlow` decides it (see decision 0063).
    const raiders = this.raiders.targets();
    const raiderTarget = animalInReach(player.motion.position, aimYaw, raiders);
    this.aimedRaiderId = raiderTarget?.id ?? null;
    const described = raiderTarget === null ? null : this.raiders.describe(raiderTarget.id);
    this.aimedRaider =
      described === null
        ? null
        : { name: RAIDER_KINDS[described.kind].displayName, hitsLeft: described.hitsLeft };
    this.raidersClose = raiders.some(
      (raider) =>
        Math.hypot(raider.x - player.motion.position.x, raider.z - player.motion.position.z) <
        RAIDER_CLOSE_WITHIN,
    );

    const target = raiderTarget === null ? this.treeAt(player.motion.position, aimYaw) : null;
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
      raiderTarget === null && (target === null || !this.isEquipped('axe'))
        ? this.remoteAnimals.netIds().flatMap((id) => {
            const pose = this.remoteAnimals.poseOf(id);
            const kind = animalKindOf(id);
            return pose === undefined || kind === undefined
              ? []
              : [{ id, x: pose.x, z: pose.z, kind }];
          })
        : [];
    const animalTarget = animalInReach(player.motion.position, aimYaw, animalCandidates);
    this.aimedAnimalId = animalTarget?.id ?? null;
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
      castLanding(player.motion.position, aimYaw, this.clearing.water, LAKE) !== null;

    // Its own key, so it never competes with a swing or a cast for the click.
    // Offered whenever something could be afforded and the player is inside
    // the clearing, where building happens - exactly where it fits is the
    // preview's job once a piece is picked (see decision 0052).
    const canAfford = (kind: BuildableKindId): boolean =>
      BUILDABLE_KINDS[kind].costs.every(
        (cost) =>
          (combineHomeSupplies(
            inventoryFromEntries(this.carrying),
            isHomeKind(kind) && this.builtProps.some((prop) => prop.yours && isHomeKind(prop.kind))
              ? this.homeStoredSupplies
              : [],
          )[cost.item] ?? 0) >= cost.amount,
      );
    this.canBuild =
      this.clearing !== null && this.space === OUTDOORS && BUILDABLE_KIND_ORDER.some(canAfford);

    this.centreSunOn(position);
  }

  /** Keep the shadow map centred on the player instead of on the origin. */
  private centreSunOn(position: Readonly<Vec3>): void {
    const sun = this.daylight?.sun;
    if (sun === undefined) return;
    sun.position.set(position.x + 28, position.y + 40, position.z + 18);
    sun.target.position.set(position.x, position.y, position.z);
    sun.target.updateMatrixWorld();
  }

  /* ---------------------------------------------------------------------- */
  /* Going inside                                                            */
  /* ---------------------------------------------------------------------- */

  /**
   * Go somewhere else entirely, because the server says so (see decision
   * 0055): into a home's own room, or back out into the world. Everything
   * out there is hidden or shown in one go, the room is built the first
   * time it is needed, and the camera looks in like a dollhouse.
   */
  private currentHomeKind(): HomeKind {
    const kind = this.builtProps.find((prop) => prop.id === this.space)?.kind;
    return kind !== undefined && isHomeKind(kind) ? kind : 'cabin';
  }

  private moveToSpace(space: number, x: number, z: number, yaw: number): void {
    const player = this.localPlayer;
    if (player === null) return;
    const inside = space !== OUTDOORS;
    const changed = space !== this.space;
    if (changed) this.closeChest();
    this.space = space;
    if (changed && inside && this.homeHere()?.yours === true) {
      const kind = this.currentHomeKind();
      this.craftingNews = {
        text:
          kind === 'tent'
            ? 'Home again · store your finds and rest before your next outing.'
            : 'Home again · store your finds, cook a meal and settle in.',
        until: performance.now() + NEWS_MS,
      };
    }

    this.outdoors.visible = !inside;
    const kind = this.currentHomeKind();
    if (inside && (this.homeInterior === null || this.interiorKind !== kind)) {
      if (this.homeInterior !== null) {
        this.scene.remove(this.homeInterior.group);
        this.homeInterior.dispose();
      }
      this.interiorKind = kind;
      this.roomCollision = createCollisionWorld(
        createFlatTerrain(0),
        homeRoomColliders(kind),
        (HOME_ROOM.halfWidth + HOME_ROOM.wallThickness) * homeRoomScale(kind),
      );
      this.homeInterior = createHomeInterior(kind);
      this.scene.add(this.homeInterior.group);
    }
    if (this.homeInterior !== null) this.homeInterior.group.visible = inside;
    this.homeInterior?.setGardenPlots(
      this.garden.homeId === space ? this.garden.plots : emptyGarden(),
    );
    this.refreshDecorations();
    this.daylight?.setIndoors(inside);
    // Coming out, the camera looks at you from out front, with your home
    // behind you: walking back towards the camera takes you out into the world.
    this.camera?.setIndoors(inside, yaw + Math.PI);

    const collision = inside ? this.roomCollision : this.collision;
    if (collision !== null) {
      const y = inside ? 0 : collision.terrain.heightAt(x, z);
      player.moveToSpace(collision, { x, y, z }, yaw);
    }

    if (changed) {
      // Everybody we could see is somewhere else now; the next snapshot
      // brings whoever is here with us.
      for (const netId of this.remotePlayers.netIds()) {
        this.remotePlayers.remove(netId);
        this.removeRemote(netId);
      }
      for (const id of this.remoteAnimals.netIds()) {
        this.remoteAnimals.remove(id);
        this.removeCritter(id);
      }
      this.raiders.clear();
      this.stopPlacing();
      this.buildMenuOpen = false;
      this.aimYaw = null;
    }
    this.liftFade();
  }

  /** Whether walking this way, from here, is about to take us through a door. */
  private walkingThroughADoor(position: Readonly<Vec3>, walkX: number, walkZ: number): boolean {
    if (walkX === 0 && walkZ === 0) return false;
    if (this.space !== OUTDOORS)
      return isLeavingRoom(position.x, position.z, walkX, walkZ, false, this.currentHomeKind());
    return this.builtProps.some(
      (prop) =>
        BUILDABLE_KINDS[prop.kind].isHome &&
        (prop.locked !== true || prop.yours) &&
        isEnteringDoorway(prop, position.x, position.z, walkX, walkZ, false),
    );
  }

  /** What a door right here would do, if anything: for the hint along the bottom. */
  /** Sat in the chair, lying in bed or sat on the ground, if any of them. */
  private restingNow(): 'chair' | 'bed' | 'ground' | null {
    const kind = this.localPlayer?.action.kind;
    if (kind === ActionKind.Sit) return 'chair';
    if (kind === ActionKind.Lie) return 'bed';
    return kind === ActionKind.SitGround ? 'ground' : null;
  }

  /**
   * What a press of E would do about a rowboat, for the hint line. Only a
   * hint: climbing in or out is the server's call, made by the same rules
   * (see decision 0093).
   */
  private boatHintFor(position: Readonly<Vec3>, action: Readonly<ActionState>): BoatHint {
    if (action.kind === ActionKind.Row)
      return landingFrom(position.x, position.z) === null ? 'tooFar' : 'climbOut';
    if (!isFreeToInteract(action) || this.fishingPhase !== null) return null;
    let taken = false;
    for (const prop of this.builtProps) {
      if (prop.kind !== 'rowboat' || !isWithinBoardingReach(position, prop)) continue;
      if (this.lakeFrozen) return 'frozen';
      if (prop.occupied !== true) return 'board';
      taken = true;
    }
    return taken ? 'taken' : null;
  }

  private doorHintAt(position: Readonly<Vec3>): 'enter' | 'visit' | 'locked' | 'leave' | null {
    if (this.space !== OUTDOORS) {
      const scale = homeRoomScale(this.currentHomeKind());
      return position.z / scale > HOME_ROOM.halfDepth - 1.4 &&
        Math.abs(position.x / scale - HOME_ROOM.doorX) < 1.3
        ? 'leave'
        : null;
    }
    for (const prop of this.builtProps) {
      if (!BUILDABLE_KINDS[prop.kind].isHome) continue;
      const doorway = cabinDoorway(prop);
      if (Math.hypot(position.x - doorway.x, position.z - doorway.z) > DOORWAY_REACH + 1) continue;
      if (prop.yours) return 'enter';
      return prop.locked === true ? 'locked' : 'visit';
    }
    return null;
  }

  /** Start fading to dark for a door, lifting again on its own if nothing comes of it. */
  private darkenForDoor(): void {
    const fade = this.sceneFade;
    if (fade === null || fade.classList.contains('scene-fade-dark')) return;
    fade.classList.add('scene-fade-dark');
    this.fadeGiveUpAt = performance.now() + DOOR_FADE_GIVE_UP_MS;
  }

  /**
   * Now that we are through: straight to dark if it was not already (a
   * knockout, or pressing E rather than walking in), then lift, once the new
   * place has had a frame to draw.
   */
  private liftFade(): void {
    const fade = this.sceneFade;
    if (fade === null) return;
    this.fadeGiveUpAt = null;
    if (!fade.classList.contains('scene-fade-dark')) {
      fade.classList.add('scene-fade-instant', 'scene-fade-dark');
      // Read something off it, so the browser takes the jump to dark before
      // the fade back out starts.
      void fade.offsetWidth;
      fade.classList.remove('scene-fade-instant');
    }
    window.setTimeout(() => fade.classList.remove('scene-fade-dark'), DOOR_FADE_HOLD_MS);
  }

  /** Lock or unlock our own front door - from the button shown inside our home. */
  setDoorLocked(locked: boolean): void {
    this.connection?.sendSetDoorLock(locked);
  }

  /**
   * What a click of ours would do right now, as best we can tell: swing, if
   * something is in hand out in the world with no line in the water, or
   * cast, with the rod facing water - the same as the server decides it
   * (see `WorldSimulation.actionContext`).
   */
  private currentMeal(): MealState {
    if (this.meal.item === null) return { ...NO_MEAL };
    if (this.connectionState !== 'connected') return { ...this.meal };
    const left = Math.max(
      0,
      this.meal.ticksLeft - Math.floor(((performance.now() - this.mealHeardAt) * TICK_HZ) / 1000),
    );
    return left === 0 ? { ...NO_MEAL } : { item: this.meal.item, ticksLeft: left };
  }

  private actionContext(position: Readonly<Vec3>, aimYaw: number): ActionContext {
    const held = this.equipped.get(this.selfNetId) ?? null;
    const canAttack = held !== null && this.space === OUTDOORS && this.fishingPhase === null;
    const castInstead =
      canAttack &&
      toolKind(held) === 'rod' &&
      performance.now() >= this.castReadyAt &&
      this.clearing !== null &&
      castLanding(position, aimYaw, this.clearing.water, LAKE) !== null;
    return {
      canAttack,
      castInstead,
      // Anywhere there is ground underfoot; the line in hand is the one thing
      // that rules it out (see decision 0102). Standing on something is
      // checked by the caller, which knows the footing.
      canSit: this.fishingPhase === null,
      dodgeCooldown: mealCooldown(this.currentMeal(), DODGE.cooldown, 'trailRation'),
    };
  }

  /**
   * Whether somebody else's swing would be at a tree: the axe in hand and a
   * trunk in front, the same rule their own browser and the server go by.
   */
  private wouldChopAt(
    netId: number,
    pose: { x: number; y: number; z: number; yaw: number },
  ): boolean {
    if (toolKind(this.equipped.get(netId) ?? null) !== 'axe' || this.space !== OUTDOORS)
      return false;
    return this.treeAt(pose, pose.yaw) !== null;
  }

  /**
   * A knockout of ours: down where we fell, the screen going dark as we
   * lose consciousness, then lifting as we wake up - at home in bed, or in
   * the clearing (see decision 0056).
   */
  private showKnockout(kind: ActionKind, age: number): void {
    const fade = this.sceneFade;
    if (fade === null) return;
    if (kind === ActionKind.KnockedOut && age >= KNOCKOUT_DARKENS_AT_TICKS && !this.knockoutDark) {
      this.knockoutDark = true;
      fade.classList.add('scene-fade-slow', 'scene-fade-dark');
    } else if (kind !== ActionKind.KnockedOut && this.knockoutDark) {
      this.knockoutDark = false;
      fade.classList.remove('scene-fade-dark');
      window.setTimeout(() => fade.classList.remove('scene-fade-slow'), 900);
    }
  }

  private showCollection(event: CollectedEvent): void {
    const listener = this.listenerPoint();
    if (listener === null) return;
    const distance = Math.hypot(listener.x - event.x, listener.z - event.z);
    const volume = event.netId === this.selfNetId ? 1 : Math.max(0, 1 - distance / 12) ** 2 * 0.45;
    playCollection(event.item, event.depleted, volume);
    if (event.depleted && distance < 24) {
      const y = this.collision?.terrain.heightAt(event.x, event.z) ?? 0;
      this.bursts.burst('gather', new THREE.Vector3(event.x, y + 0.18, event.z), 0, 0);
    }
  }

  /** Somebody picked something up, dug, reached out or ate: show it on them. */
  private showGesture(event: GestureEvent): void {
    const character =
      event.netId === this.selfNetId ? this.localCharacter : this.remoteCharacters.get(event.netId);
    character?.playGesture(event.gesture, event.item);
  }

  private setFishingPose(netId: number, pose: FishingPose | null): void {
    if (pose === null) this.fishingPoses.delete(netId);
    else this.fishingPoses.set(netId, pose);
  }

  /** Whatever our own player just did, shown the moment it happened here rather than when the server says so. */
  private showOwnMoves(events: readonly PredictedEvent[]): void {
    for (const event of events) {
      if (event.kind === 'cast') this.setFishingPose(this.selfNetId, 'casting');
      else if (event.kind === 'impact') this.showOwnBlow(event.impact);
      else if (event.kind === 'began') this.swooshFor(event.action, event.step);
    }
  }

  /** The swish of a swing of ours, timed to peak as its blow lands. */
  private swooshFor(action: ActionKind, step: number): void {
    if (action === ActionKind.Swing) {
      const swing = LIGHT_COMBO[Math.min(Math.max(step, 1), LIGHT_COMBO.length) - 1];
      playSwoosh((swing?.impact ?? 4) * TICK_SECONDS);
    } else if (action === ActionKind.Strike) {
      playSwoosh(STRIKE.impact * TICK_SECONDS, CHARGED_BLOW);
    } else if (action === ActionKind.DodgeLight) {
      playSwoosh(DODGE_ATTACKS.light.impact * TICK_SECONDS, 1.3);
    } else if (action === ActionKind.DodgeHeavy) {
      playSwoosh(DODGE_ATTACKS.heavy.impact * TICK_SECONDS, CHARGED_BLOW * 1.3);
    }
  }

  /**
   * One of our own blows landing, on whatever our browser thinks is in
   * reach - the same way the server picks it: an axe bites a tree first,
   * and anything in hand strikes an animal. A jolt, a pause on the moment,
   * the sound and the chips or fur of it, straight away, the way it feels to
   * swing. The server's word follows and settles what it actually did.
   */
  private showOwnBlow(impact: Impact): void {
    const player = this.localPlayer;
    if (player === null) return;
    const strike = impact.kind === 'strike';
    const from = player.motion.position;
    const aimYaw = this.aimYaw ?? player.motion.facingYaw;
    const strength = strike ? CHARGED_BLOW * (impact.dodge ? 1.35 : 1) : impact.dodge ? 1.4 : 1;
    if (strike) this.showSlam(impact.dodge ? 1.5 : 1);
    if (this.aimedRaiderId !== null) {
      this.showOwnBlowOnRaider(this.aimedRaiderId, impact);
      return;
    }
    const tree = this.isEquipped('axe') ? this.treeAt(from, aimYaw) : null;
    if (tree !== null) {
      this.showBlowOnTree(tree.prop, from, strength);
      playTreeHit();
    } else if (this.aimedAnimalId !== null) {
      this.showBlowOnAnimal(this.aimedAnimalId, from, strength);
      playThreatHit();
    } else {
      return;
    }
    this.localCharacter?.hitStop(strike ? 0.14 : 0.07);
    this.camera?.shake(strike ? HIT_LANDED_SHAKE * 1.8 : HIT_LANDED_SHAKE);
  }

  /**
   * One of our own blows landing on a skeleton (see decision 0063): a whiff
   * if it is mid-roll, a clang and sparks off one that shrugs it off, or the
   * crack of bone - each with a pause on the moment, longer and harder the
   * heavier the blow, the way it feels in an action game.
   */
  private showOwnBlowOnRaider(raiderId: number, impact: Impact): void {
    const player = this.localPlayer;
    if (player === null) return;
    const strike = impact.kind === 'strike';
    const heavy = impact.kind === 'swing' && impact.step === 3;
    const landed = this.raiders.predictBlow(raiderId, player.motion.position, heavy, strike);
    if (landed === 'missed') return;
    const weight = (strike ? CHARGED_BLOW * 1.15 : heavy ? 1.4 : 1) * (impact.dodge ? 1.2 : 1);
    const shrugged = landed === 'shrugged';
    this.localCharacter?.hitStop(shrugged ? 0.05 : Math.min(0.11, 0.07 * weight));
    this.camera?.shake(HIT_LANDED_SHAKE * weight * (shrugged ? 0.6 : 1));
  }

  /** A charged strike coming down: dust thrown up where it hits the ground. */
  private showSlam(strength = 1): void {
    const player = this.localPlayer;
    const tip = this.localCharacter?.heldTip(this.scratchBlow) ?? null;
    if (player === null || tip === null) return;
    tip.y = Math.max(tip.y, player.motion.position.y + 0.05);
    const yaw = player.motion.facingYaw;
    this.bursts.burst('dust', tip, -Math.sin(yaw), -Math.cos(yaw), strength);
    this.camera?.shake(HIT_LANDED_SHAKE * 0.6 * strength);
  }

  /** A blow landing on a tree, from somebody at `from`: chips fly and the tree shivers. */
  private showBlowOnTree(tree: PlacedProp, from: Readonly<Vec3>, strength: number): void {
    const away = awayFrom(from, tree);
    // Off the near side of the trunk, about waist high, flying back out of the cut.
    const at = this.scratchBlow.set(
      tree.x - away.x * TRUNK_FACE,
      from.y + BLOW_HEIGHT_ON_TREE,
      tree.z - away.z * TRUNK_FACE,
    );
    this.bursts.burst('wood', at, -away.x, -away.z, strength);
    this.clearingScene?.shakeTree(tree.id, away.x, away.z, strength);
    this.wildernessScene?.shakeTree(tree.id, away.x, away.z, strength);
  }

  /** A blow landing on an animal, from somebody at `from`: fur flies and it is knocked back a step. */
  private showBlowOnAnimal(animalId: number, from: Readonly<Vec3>, strength: number): void {
    const pose = this.remoteAnimals.poseOf(animalId);
    if (pose === undefined) return;
    const away = awayFrom(from, pose);
    const at = this.scratchBlow.set(pose.x, pose.y + BLOW_HEIGHT_ON_ANIMAL, pose.z);
    this.bursts.burst('fur', at, away.x, away.z, strength);
    this.animalJolts.set(animalId, { awayX: away.x, awayZ: away.z, age: 0, strength });
  }

  /** Streak whatever this character is swinging behind it while it sweeps round fast. */
  private sweepTrail(
    netId: number,
    character: Character,
    pose: MovePose | null,
    deltaSeconds: number,
  ): void {
    const sweeping = pose !== null && isSweeping(pose);
    let trail = this.trails.get(netId);
    if (trail === undefined) {
      if (!sweeping) return;
      trail = new WeaponTrail();
      this.scene.add(trail.mesh);
      this.trails.set(netId, trail);
    }
    const tip = sweeping ? character.heldTip(this.scratchTip) : null;
    const hand = tip === null ? null : character.handPosition(this.scratchHand);
    trail.update(deltaSeconds, hand, tip);
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
      const action = unpackActionByte(pose.action, this.remoteAction);
      const memory = this.remoteMoves.get(netId) ?? new MoveMemory();
      this.remoteMoves.set(netId, memory);
      const move = memory.view(
        action.kind,
        action.step,
        pose.actionAge,
        action.kind === ActionKind.Swing && this.wouldChopAt(netId, pose),
        rollDirection(pose.actionHeading, pose.yaw),
      );
      character.setFishing(this.fishingPoses.get(netId) ?? null);
      const rowing = action.kind === ActionKind.Row;
      character.setRestSpot(
        rowing
          ? boatSeatAt(pose.x, pose.z, pose.yaw)
          : restSpotFor(action.kind, action.step, this.space, this.currentHomeKind()),
      );
      if (rowing) this.rowingBoats.place(netId, pose.x, pose.z, pose.yaw, pose.speed, deltaSeconds);
      const drawn = character.update(deltaSeconds, {
        move,
        locomotion: { speed: rowing ? 0 : pose.speed, airborne: pose.airborne && !rowing },
      });
      this.sweepTrail(netId, character, drawn, deltaSeconds);
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
      critter.group.rotation.set(0, pose.yaw, 0, 'YXZ');
      if ('update' in critter)
        critter.update(deltaSeconds, {
          speed: pose.action & 8 ? 0 : pose.speed,
          alert: (pose.action & 4) !== 0,
          windup: (pose.action & 3) === 1,
          attacking: (pose.action & 3) === 2 && pose.actionAge < 5,
          defeated: (pose.action & 8) !== 0,
          hurt: this.animalJolts.has(animalId),
        });
      const jolt = this.animalJolts.get(animalId);
      if (jolt === undefined) continue;
      jolt.age += deltaSeconds;
      if (jolt.age >= ANIMAL_JOLT_SECONDS) {
        this.animalJolts.delete(animalId);
        continue;
      }
      // Knocked back and its head thrown up, fast, then easing back.
      const knock = (1 - Math.exp(-jolt.age * 40)) * Math.exp(-jolt.age * 9) * jolt.strength;
      critter.group.position.x += jolt.awayX * ANIMAL_JOLT_DISTANCE * knock;
      critter.group.position.z += jolt.awayZ * ANIMAL_JOLT_DISTANCE * knock;
      critter.group.rotation.x = ANIMAL_JOLT_TILT * knock;
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
      hoveredLoot:
        this.hoveredChest && !this.chestOpen
          ? {
              name: 'Storage chest',
              count: 0,
              detail: this.chestHoverDetail(),
              x: this.controls?.pointerPosition()?.x ?? 0,
              y: this.controls?.pointerPosition()?.y ?? 0,
            }
          : this.hoveredLoot === null ||
              !this.playing ||
              this.inventoryOpen ||
              this.mapOpen ||
              this.placing !== null ||
              this.controls?.isPointerLocked
            ? null
            : {
                name:
                  this.hoveredLoot.request.kind === 'patch' && this.hoveredLoot.item === 'reed'
                    ? 'Mature reeds'
                    : ITEM_KINDS[this.hoveredLoot.item].displayName,
                count: this.hoveredLoot.count,
                detail: this.lootDetail(this.hoveredLoot),
                x: this.controls?.pointerPosition()?.x ?? 0,
                y: this.controls?.pointerPosition()?.y ?? 0,
              },
      interactionNote: now < this.interactionNoteUntil ? this.interactionNote : null,
      nearbyPile: this.nearbyPile,
      nearGatherSpot: this.nearGatherSpot,
      nearBuriedCache: this.nearBuriedCache,
      ownCacheCompass: this.ownCacheCompass,
      nearCampfire: this.nearCampfire,
      nearWorkbench: this.nearWorkbench,
      nearGarden: this.nearGarden,
      garden: this.garden,
      aimedTree: this.aimedTree,
      aimedAnimal: this.aimedAnimal,
      aimedRaider: this.aimedRaider,
      raidersInSight: this.space === OUTDOORS ? this.raiders.markers().length : 0,
      raidersClose: this.raidersClose,
      raidBanner: this.currentRaidBanner(now),
      canBuild: this.canBuild,
      homeSkills: this.homeSkills,
      homeStoredSupplies: this.homeStoredSupplies,
      discoveriesFound: this.discoveriesFound,
      discoveriesClaimed: this.discoveriesClaimed,
      discoverySites: this.discoverySites,
      journalTab: this.journalTab,
      craftTab: this.craftTab,
      expedition: this.expedition,
      expeditionPending: performance.now() < this.expeditionPendingUntil,
      nearExpeditionBoard: this.nearOwnExpeditionBoard(),
      atExpeditionBoard: this.atOwnExpeditionBoard(),
      trackHint:
        this.space === OUTDOORS && player !== null
          ? (() => {
              const track = this.animalTracks?.tracks.find(
                (track) =>
                  Math.hypot(
                    player.motion.position.x - track.x,
                    player.motion.position.z - track.z,
                  ) < 2.2,
              );
              return track === undefined ? null : woodlandTrackHint(track.kind);
            })()
          : null,
      nearbyDiscovery: this.nearbyDiscoveryName(),
      buildAreaRadius: (() => {
        const kind =
          this.placing !== null && isHomeKind(this.placing.kind)
            ? this.placing.kind
            : this.builtProps.find((prop) => prop.yours && isHomeKind(prop.kind))?.kind;
        return kind !== undefined && isHomeKind(kind) ? HOME_BUILD_RADII[kind] : null;
      })(),
      homeKind: (() => {
        const kind = this.builtProps.find((prop) => prop.yours && isHomeKind(prop.kind))?.kind;
        return kind !== undefined && isHomeKind(kind) ? kind : null;
      })(),
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
      reel: this.reel,
      fishRecords: this.fishRecords,
      fishingNews: this.currentNews(now),
      meal: this.currentMeal(),
      hunger: this.hunger,
      hungerNews: this.currentHungerNews(now),
      health: this.health,
      healthNews: this.currentHealthNews(now),
      charging: this.currentlyCharging(),
      craftingNews: this.currentCraftingNews(now),
      cookingNews: this.currentCookingNews(now),
      huntingNews: this.currentHuntingNews(now),
      cacheNews: this.currentCacheNews(now),
      discardNews: this.currentDiscardNews(now),
      toasts: this.toastShelf.current(now),
      pickupNotice: this.pickupNotices.current(now),
      canDrop: this.space === OUTDOORS,
      isNight: isNight(dayProgress(this.estimatedServerTimeMs())),
      forestWeather: forestWeather(this.weatherSeed, this.estimatedServerTimeMs()),
      season: this.currentCalendar(),
      mapOpen: this.mapOpen,
      door: this.doorHint,
      home: this.homeHere(),
      decorations: this.decorations.filter((piece) => piece.homeId === this.space),
      decorNote: this.decorNote,
      resting: this.restingNow(),
      boat: this.space === OUTDOORS ? this.boatHint : null,
      restingNearby: this.space === OUTDOORS ? null : this.restingNearby,
    });
  }

  /** The home we are inside, if any: whether it is ours, and whether its door is locked. */
  private homeHere(): { yours: boolean; locked: boolean } | null {
    if (this.space === OUTDOORS) return null;
    const home = this.builtProps.find((prop) => prop.id === this.space);
    return { yours: home?.yours ?? false, locked: home?.locked === true };
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
      if (event.added === 0)
        return `No room for another ${name}, so you let it go. Catch recorded.`;
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

function chestReasonText(reason: ChestReason): string {
  const messages: Record<ChestReason, string> = {
    unavailable: 'Your chest is inside your home.',
    private: 'This chest belongs to the home owner.',
    tooFar: 'Move closer to the chest.',
    busy: 'Finish your current action first.',
    chestFull: 'Chest full. Only items that fit were moved.',
    packFull: 'Your pack cannot carry any more of that item. Only items that fit were moved.',
    empty: 'That stack is already empty.',
    invalid: 'That item cannot be stored here.',
  };
  return messages[reason];
}
