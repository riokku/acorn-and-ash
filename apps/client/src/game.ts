import { HandSelection, handSelectionText } from './hud/hand-selection';
import type { HomesteadAppearance } from '@acorn/shared';
import { advanceForestWind } from './art/forest-wind';
import { FreshAnimalTracks } from './scene/fresh-animal-tracks';
import { forageHabitatHint } from '@acorn/shared';
import { isPickedPlant } from './scene/harvesting-motion';
import { KingStormEffect } from './scene/king-storm';
import type { KingStormView } from '@acorn/shared';
import { KingVictoryEffect, KING_VICTORY_SECONDS } from './scene/king-victory';
import { playKingVictory } from './audio/king-victory';
import type { KingVictoryView } from './hud/KingVictory';
import type { AllyView } from '@acorn/shared';
import {
  KING_WARDS,
  kingsRoadBeat,
  KING_MUSTER,
  CROWNBREAKER_HOLD,
  KING_REMNANTS,
} from '@acorn/shared';
import { canBufferLoot } from '@acorn/shared';
import { equipmentDodgeCooldown } from '@acorn/shared';
import {
  SUNREACH_SURVEY,
  SUNREACH_REMNANTS,
  SUNREACH_NOTES,
  surveyInteraction,
} from '@acorn/shared';
import { createSurveyScenery } from './scene/sunreach-survey';
import { rehearseEffects } from './scene/effect-rehearsal';
import { createFlame } from './scene/flame';
import { placedObjectRefund } from '@acorn/shared';
import { isPack, MAX_PACK_SLOTS } from '@acorn/shared';
import { mushroomFlushHint } from '@acorn/shared';
import { buildDiscoveryLeads, discoveryLeadHint, type DiscoveryLead } from '@acorn/shared';
import { bonehollowVictory } from './hud/bonehollow-victory';
import { playConfirmedStrike, playLastBell } from './audio/feedback';
import { preloadHousingDetails } from './scene/housing-details';
import { preloadSkeletonTown } from './scene/skeleton-town';
import { SKELETON_TOWN } from '@acorn/shared';
import { nearestTreasure, type TreasureSpot } from '@acorn/shared';
import {
  FIRE_CAPACITY_MS,
  logStorageCapacity,
  logStorageSpot,
  HOME_FACILITIES,
  type FireRequest,
  type FireFuelView,
} from '@acorn/shared';
import type { FirePanelState } from './hud/store';
import { applyItemCatalog } from './item-catalog';
import { characterStats, ITEM_KINDS } from './item-catalog';

import { CombatSwoosh } from './audio/combat-swoosh';
import { footGroundHeightAt } from './scene/standing-foot-contact';
import { placedPropColliders, type Collider } from '@acorn/shared';
import { streamRockColliders } from '@acorn/shared';
import { BuildFeedback, buildReplyText } from './hud/build-feedback';
import { DecorationFeedback } from './hud/decoration-feedback';
import { CraftFeedback, craftRefusalText } from './hud/craft-feedback';
import { menuPanelState, type MenuPanel } from './input/menu-panels';
import { createWildfireArt } from './scene/wildfire';
import { groundHeightAt } from '@acorn/shared';
import type { Dig, WildfireView } from '@acorn/shared';
import {
  fishRecordsFromSaved,
  type FishRecords,
  type GearRequest,
  isWeapon,
  highPlainsWeight,
  type ReelView,
  type WornGear,
} from '@acorn/shared';
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
import { createHomesteadProject } from './scene/homestead-project';
import { isHomesteadProject, nearestHomesteadPiece } from '@acorn/shared';
import { createHomeDecoration } from './scene/home-decoration';
import { forestWeather, BLIZZARD_SPEED } from '@acorn/shared';
import { createSnowFootprints } from './scene/snow-footprints';
import { FloatingBoatMotion } from './scene/floating-boat-motion';
import { navigableWaterSurfaceAt, navigableWaterDepthAt } from '@acorn/shared';
import { WaterWake } from './scene/water-wake';
import { waterRippleUniforms } from './art/water-uniforms';
import {
  lakeDepthAt,
  isInStream,
  nearestOnStream,
  sloughSurfaceAt,
  streamSurfaceAt,
} from '@acorn/shared';
import { createForestWeather } from './scene/forest-weather';
import { NO_MEAL, mealCooldown, type MealState, DODGE, TICK_HZ } from '@acorn/shared';
import { createAnimalTracks } from './scene/animal-tracks';
import { combineHomeSupplies, type HomeSupplies, woodlandTrackHint } from '@acorn/shared';
import { type WoodlandCreature } from './scene/woodland-creatures';
import { KEEPSAKES, isKeepsake } from './hud/keepsakes';
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
  DEFAULT_SKIN_TONE,
  DEFAULT_WORLD_SEED,
  HEALTH_MAX,
  HUNGER_MAX,
  PICKUP_REACH,
  VOXEL,
  digRefusal,
  overlapsWater,
  DIG_REACH_METERS,
  supportProblem,
  cubeAtHit,
  digInReach,
  supportCellAt,
  supportInReach,
  type Support,
  type SupportCell,
  isFreeToInteract,
  restingPlaceInReach,
  outdoorSeatInReach,
  RiseFrom,
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
  whirlwindTargets,
  treesInWhirlwind,
  type WhirlwindSweep,
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
  STREAM,
  streamPools,
  STREAM_KEEP_OUT,
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
  groundItemReachable,
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
  type Terrain,
  type Vec3,
} from '@acorn/shared';

import { FollowCamera } from './camera/follow-camera';
import { Controls } from './input/controls';
import { TabTargeting, type HostileTarget } from './input/tab-target';
import { clickAimYaw, yawTowards, type ClickCandidate } from './input/click-target';
import { lootUnderCursor, type LootTarget } from './input/loot-target';
import { SignInError, resumeAccount } from './net/account';
import { WorldConnection, worldSocketUrl, type ConnectionState } from './net/connection';
import { LocalPlayer, type PredictedEvent } from './net/local-player';
import { createRemotePlayback } from './net/remote-playback';
import { GatheringFocus } from './scene/gathering-focus';
import { ForestAtmosphere } from './audio/forest-atmosphere';
import { ForestAudio } from './audio/forest-sounds';
import { readCedarHuntPin, writeCedarHuntPin } from './hud/cedar-hunt';
import { WorldAmbience } from './audio/world-ambience';
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
import { createStreamScene, riverMouthConnections } from './scene/stream';
import { createDigScene, type DigScene } from './scene/digging';
import {
  createMineSupports,
  createSupportPreview,
  preloadMineSupport,
  type MineSupports,
  type SupportPreview,
} from './scene/mine-supports';
import { preloadDugWalls } from './scene/dug-walls';
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
  playThreatHit,
  playTookDamage,
  playTreeHit,
  preloadImpactSounds,
  setImpactSoundsActive,
  startAmbientMusic,
} from './audio/sound';
import { playEarthRumble, playRaidHorn, playRaidOver, playVictory } from './audio/raid-sounds';
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
import { groundBuildingSupport } from './scene/building-ground';
import { createFlowerBed, type FlowerBed } from './scene/flower-bed';
import { createLantern, type Lantern } from './scene/lantern';
import { createFence, type Fence } from './scene/fence';
import { createGardenPath, type GardenPath } from './scene/garden-path';
import { createCritterFor } from './scene/wildlife-models';
import { preloadFoxModel } from './scene/fox-model';
import { preloadArtTextures } from './art/textures';
import { rainShareFor } from './art/season-fall';
import { seasonUniforms } from './art/season-uniforms';
import { Floats, type Angler } from './scene/floats';
import { addDaylight, type DaylightRig } from './scene/lighting';
import { centreDaylightShadow } from './scene/stable-daylight-shadow';
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
import { SpaceTransition } from './scene/space-transition';
import { planPlacement, type PlacementPlan } from './building/placement';
import type { BoatHint, FishingPhase, HudStore, RaidBanner } from './hud/store';
import { compassTo, compassToOwnCache, type Compass } from './hud/cache-compass';
import { CombatFeed, type ThreatMark } from './hud/combat-feed';
import { raidBannerFor, isKingVictoryNews } from './hud/raid-banner';
import { SignOutCountdown } from './hud/sign-out';
import {
  expeditionBoardClaimsInteract,
  expeditionBoardOpen,
  type BoardClaimState,
} from './hud/board-claim';
import { resolveHotbarSlots } from './hud/hotbar-layout';
import { amountOf } from './hud/item-words';
import { ToastShelf, packGains } from './hud/toasts';
import { digRefusalText, gearRefusalText, supportProblemText } from './hud/gear-notices';
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
 * How long a predicted door fade waits for the server before giving up
 * (a locked door, say). Confirmed transitions wait for rendered frames.
 */
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
/** How long after a gear change the pack's reply is treated as a move, not a gain. */
const GEAR_QUIET_MS = 1500;
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
  | ReturnType<typeof createHomesteadProject>
  | ReturnType<typeof createHomeDecoration> {
  if (isHomesteadProject(kind)) return createHomesteadProject(kind);
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
    const boardFeet: ReturnType<typeof groundBuildingSupport>[] = [];
    board.group.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return;
      part.geometry.computeBoundingBox();
      if (part.geometry.boundingBox!.min.y < 0.05)
        boardFeet.push(groundBuildingSupport(part, 0.15));
    });
    const groundHome = home.groundOn;
    home.groundOn = (heightAt) => {
      groundHome?.(heightAt);
      for (const fit of boardFeet) fit(heightAt);
    };
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
    case 'sunreachPennant':
    case 'trailPennant':
    case 'firstBellRelic':
    case 'lastBellTrophy':
    case 'sentinelTrophy':
    case 'fishDisplay':
    case 'goldenFishDisplay':
      return createHomeDecoration(kind);
  }
}

/** A den never moves or changes kind, so this is all a client ever needs to tell them apart. */
function animalKindOf(animalId: number): AnimalKindId | undefined {
  return ANIMAL_DENS.find((den) => den.id === animalId)?.kind;
}

/** The cabin's block as a box the camera can bump into - see `homeCameraBlockers`. */
function homeCameraBlocker(home: BuiltPropView, groundY = 0, bottomY = groundY): THREE.Mesh {
  const collider = cabinCollider(home, groundY);
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(
      collider.shape === 'box' ? collider.halfX * 2 : 5,
      groundY + HOME_CAMERA_BLOCKER_HEIGHT - bottomY,
      collider.shape === 'box' ? collider.halfZ * 2 : 4,
    ),
  );
  box.position.set(collider.x, (bottomY + groundY + HOME_CAMERA_BLOCKER_HEIGHT) / 2, collider.z);
  box.rotation.y = home.yaw;
  box.updateMatrixWorld(true);
  return box;
}

/** From the ground to the ridge of the roof, and the chimney. */
const HOME_CAMERA_BLOCKER_HEIGHT = 5;

/** What the smoke tests and the browser console can read out of a running game. */
export interface GameDebug {
  selfNetId(): number;
  selectedTargetId(): number | null;
  grassClumps(): number;
  combatMove(): { kind: number; age: number; grounded: boolean };
  snowFootprints(): number;
  footstepCount(): number;
  wildfireEffects(): { fires: number; smoke: number; embers: number; lightning: boolean };
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
  /** Whether this specific pile is reachable using the game's ground-loot rules. */
  pileInReach(id: number): boolean;
  /** The toasts showing right now: what each one says it gained, and how many. */
  toasts(): Array<{ item: string; count: number }>;
  /** What a nearby patch would gather, if anything is within reach right now. */
  nearGatherSpot(): string | null;
  /** Trees the server says are down. */
  felledTrees(): number[];
  /** How many times each changed tree has grown back. */
  treeGenerations(): Array<{ id: number; generation: number; growth: number; scale: number }>;
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
  /** Whether the room-decorating panel (opened with the Decorate button) is currently showing. */
  buildMenuOpen(): boolean;
  /** Whether the Craft menu (opened with C) is currently showing. */
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
  treasureSpots(): readonly TreasureSpot[];
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
  /** The retained outdoor detail centre, even while a room uses local coordinates. */
  outdoorFocus(): { x: number; z: number };
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
  /** Ask the world for one of every piece of gear: `?gear=all` in the address, for testing. */
  readonly gear?: boolean;
  /**
   * Forget who is signed in and go back to the front page (decision 0104). Called
   * once the sign-out countdown runs out; rejects if the site could not be reached.
   */
  readonly signOut: () => Promise<void>;
  /**
   * The world says this character was deleted, from this tab or another one
   * (decision 0108). Forget the look chosen for it and start again from the
   * character screen: there is nobody left to reconnect as.
   */
  readonly onCharacterDeleted: () => void;
}

/** Everything that makes up a running game. */
export class Game {
  private readonly options: GameOptions;
  /** Live-adjustable from the Settings menu - see `setLookSensitivity`. */
  private lookSensitivity: number;
  private grassDensity: number;
  private grass: GrassScene | null = null;
  private readonly ownSwoosh = new CombatSwoosh();
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly scene = new THREE.Scene();
  private readonly remotePlayers = createRemotePlayback();
  private readonly remoteCharacters = new Map<number, Character>();
  /** What the server's Roster says about everybody currently connected. */
  private readonly roster = new Map<number, RosterEntry>();
  /** What the server's Equipped list says everybody currently has in hand, including ourselves. */
  private readonly handSelection = new HandSelection();
  private readonly equipped = new Map<number, ItemId | null>();
  /** What the server's Worn list says everybody currently wears, including ourselves (decision 0113). */
  private readonly worn = new Map<number, Readonly<WornGear>>();
  /** Whether the character screen (Z) is open beside the pack. */
  private characterOpen = false;
  private gearNotice: { text: string; key: number } | null = null;
  private readonly remoteAnimals = createRemotePlayback();
  private readonly critters = new Map<number, WoodlandCreature>();
  private readonly builtMeshes = new Map<
    number,
    | Campfire
    | Cabin
    | FlowerBed
    | Lantern
    | Fence
    | GardenPath
    | ReturnType<typeof createHomesteadProject>
    | ReturnType<typeof createHomeDecoration>
  >();
  private builtProps: readonly BuiltPropView[] = [];
  private readonly floatingBoats = new Map<number, FloatingBoatMotion>();
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
   * Submitted pieces retained until their private result. Other previews can
   * snap to them, but another placement waits for confirmation or refusal.
   */
  private pendingPlacements: { readonly request: BuildRequest; readonly sentAt: number }[] = [];
  private readonly buriedCacheMeshes = new Map<number, BuriedCacheMound>();
  private recoveryMarkers: readonly BuriedCacheView[] = [];
  private recoveryHeard = false;
  private buriedCaches: readonly BuriedCacheView[] = [];
  private treasures: readonly TreasureSpot[] = [];
  private nearTreasure: 'shovel' | 'needsShovel' | null = null;
  /** Whether a cache of our own is close enough right now to dig up. */
  private nearBuriedCache = false;
  /** The way back to a buried cache of our own, once it is a real walk rather than something already in reach. */
  private ownCacheCompass: Compass | null = null;
  /** Whether a campfire is close enough right now to light or put out, and which. */
  private nearCampfire: 'lit' | 'unlit' | null = null;
  private fireFuelStates = new Map<number, FireFuelView>();
  private fireFuelReceivedAt = 0;
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
  private bonehollowVictoryUntil = 0;
  private lastConfirmedStrikeAt = -Infinity;
  private journalTab: 'craft' | 'discoveries' | 'garden' | 'expeditions' | 'fishing' = 'craft';
  private craftTab: CraftTabId = 'all';
  private discoveriesFound = 0;
  private discoveriesClaimed = 0;
  private discoveryLeads: readonly DiscoveryLead[] = [];
  private discoverySites: readonly DiscoverySite[] = [];
  private freshAnimalTracks: FreshAnimalTracks | null = null;
  private animalTracks: ReturnType<typeof createAnimalTracks> | null = null;
  private surveyScenery: ReturnType<typeof createSurveyScenery> | null = null;
  private discoveryLandmarks: ReturnType<typeof createDiscoveryLandmarks> | null = null;
  private receivedDiscoveryState = false;
  /** Gameplay is active once the world is ready, unless another tab takes over. */
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
  private readonly solidPlacedProps = new Map<number, Collider[]>();
  private readonly solidHomes = new Map<number, ReturnType<typeof cabinCollider>>();
  /**
   * A plain box the size of each home, never drawn: only there so the
   * camera pulls in rather than ending up inside somebody's walls.
   */
  private readonly homeCameraBlockers: THREE.Mesh[] = [];
  /** A dark veil over the scene for going through a door, and when the dark should lift if nothing happens. */
  private sceneFade: HTMLDivElement | null = null;
  private fadeGiveUpAt: number | null = null;
  private readonly spaceTransition = new SpaceTransition();
  /** The forest stays centred on its outdoor location while the room uses local coordinates. */
  private readonly outdoorFocus: { x: number; z: number } = {
    x: SPAWN_POSITION.x,
    z: SPAWN_POSITION.z,
  };
  /** What a door right here would do, for the hint. */
  private doorHint: 'enter' | 'visit' | 'locked' | 'leave' | null = null;
  /** The chair or the bed close enough to use, inside a home, while free to. */
  private restingNearby: 'chair' | 'bed' | 'bench' | 'benchFull' | null = null;
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
  private readonly targeting = new TabTargeting();
  /** Scratch objects for `aimTowardsClickPoint` and the build preview, reused rather than allocated fresh. */
  private readonly clickRaycaster = new THREE.Raycaster();
  private readonly clickNdc = new THREE.Vector2();
  /** The cube the mouse is on, as last sent to the server, and when (see `updateDigTarget`). */
  private digTargetSent: { ix: number; iy: number; iz: number } | null = null;
  private digTargetSentAt = 0;
  /** The cube a click with the shovel would dig, drawn as a faint box. */
  private digPreview: {
    group: THREE.Group;
    fill: THREE.MeshBasicMaterial;
    edges: THREE.LineBasicMaterial;
  } | null = null;
  /** The clearing's ground, which is flat at zero everywhere a piece can be placed. */

  private enteringWorld = false;
  private warmEffectsOnNextFrame = false;
  private firstWorldFrame: (() => void) | null = null;
  private lastRenderedAt = 0;
  private setup: RendererSetup | null = null;
  private camera: FollowCamera | null = null;
  private controls: Controls | null = null;
  private connection: WorldConnection | null = null;
  private daylight: DaylightRig | null = null;
  private footprints: ReturnType<typeof createSnowFootprints> | null = null;
  private wildfireArt: ReturnType<typeof createWildfireArt> | null = null;
  private wildfireState: WildfireView = { fires: [], lightning: null, now: 0 };
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
  private readonly waterWake = new WaterWake();
  private streamScene: ReturnType<typeof createStreamScene> | null = null;
  /** Ground dug out with the shovel (decision 0114), and every dig heard of so far, kept for a world still loading. */
  private digScene: DigScene | null = null;
  private digs: Dig[] = [];
  /** Mine supports (decision 0119): every one heard of, what draws them, and the see-through one for the next. */
  private supports: Support[] = [];
  private mineSupports: MineSupports | null = null;
  private supportPreview: SupportPreview | null = null;
  /** The cell a click would stand a support in right now, or null if none can go there. */
  private supportCell: SupportCell | null = null;
  private supportClickHeld = false;
  /** What to tell the player while a support is in hand: where it can go, or why not here. */
  private supportHint: string | null = null;
  /** How dark it is underground for the local player, 0 in the open to 1 deep down, eased frame by frame. */
  private undergroundDark = 0;
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
  private readonly homesteadAppearances = new Map<number, HomesteadAppearance>();
  private chestOpen = false;
  private chestPending = false;
  private chestPendingSince = 0;
  private chestDismissed = false;
  private hoveredChest = false;
  private hoveredTrophy: BuiltPropView | null = null;
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
  private readonly worldAmbience = new WorldAmbience();
  private ambienceCover = 0;
  private ambienceDangerUntil = 0;
  private ambienceCoverIn = 0;
  private forestEnvironment: ForestEnvironment | null = null;
  private wildernessProps: readonly PlacedProp[] = [];
  /** Where each forest tree sits in `wildernessProps` (and so in the walkable world). */
  private wildernessIndexById: ReadonlyMap<number, number> = new Map();
  private readonly gatheringGroundRay = new THREE.Raycaster();
  private readonly gatheringFocus = new GatheringFocus((x, z, referenceY) =>
    this.gatheringGroundAt(x, z, referenceY),
  );
  private nearbyPile: { item: ItemId; count: number } | null = null;
  /**
   * Whether `carrying` is this connection's first word on the pack yet. The
   * first list is what we already had, not something just gained, so it
   * never makes a toast.
   */
  private packHeardFrom = false;
  /** Until when a change to the pack is the player moving gear, not gaining anything (`performance.now()` ms). */
  private quietPackUntil = 0;
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
  private readonly creatureGroundHeight = (x: number, z: number): number =>
    this.collision?.terrain.heightAt(x, z) ?? 0;
  private readonly characterGroundHeight = (x: number, z: number, referenceY: number): number =>
    footGroundHeightAt(this.collision, x, z, referenceY);
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
  private readonly buildFeedback = new BuildFeedback();
  private pendingBuildPreview: Placing | null = null;
  private readonly decorationFeedback = new DecorationFeedback();
  private pendingDecorationPreview: Placing | null = null;
  private readonly craftFeedback = new CraftFeedback();
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
  private readonly raiders = new RaiderCrowd(
    this.outdoors,
    this.bursts,
    this.characterGroundHeight,
  );
  /** The skeleton a swing of ours would land on, as last worked out. */
  private aimedRaiderId: number | null = null;
  private readonly whirlwindHits = new Set<number>();
  private readonly whirlwindTrees = new Set<number>();
  private aimedRaider: { name: string; hitsLeft: number } | null = null;
  /** Whether any skeleton is close enough to be worth a hint about fighting it. */
  private raidersClose = false;
  private raidBanner: { banner: RaidBanner; until: number } | null = null;
  private raidBannersShown = 0;
  private kingVictory: KingVictoryView | null = null;
  private kingStorm: KingStormView | null = null;
  private kingStormArt: KingStormEffect | null = null;
  private kingVictoryEffect: KingVictoryEffect | null = null;
  private stopKingVictorySound: (() => void) | null = null;
  private lastKingVictoryAt = -Infinity;
  private allies: readonly AllyView[] = [];
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
    try {
      options.hud.publish({ cedarHuntPinned: readCedarHuntPin(localStorage, options.worldId) });
    } catch {
      /* Storage may be unavailable. */
    }
    this.lookSensitivity = options.lookSensitivity;
    this.grassDensity = options.grassDensity;
    this.signOutCountdown = new SignOutCountdown({
      leave: options.signOut,
      show: (view) =>
        options.hud.publish({ signOutSecondsLeft: view.secondsLeft, signOutNotice: view.notice }),
    });
  }

  setCedarHuntPinned(pinned: boolean): void {
    this.options.hud.publish({ cedarHuntPinned: pinned });
    try {
      writeCedarHuntPin(localStorage, this.options.worldId, pinned);
    } catch {
      /* Keep this session's goal. */
    }
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
    setImpactSoundsActive(false);
    preloadImpactSounds();
    // Kicked off now rather than in enterWorld, so they have the whole time
    // it takes to set up the renderer and reach the server to finish loading.
    void preloadPropModels();
    void preloadDugWalls();
    void preloadMineSupport();
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
    setup.renderer.shadowMap.type = THREE.PCFShadowMap;

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
    const arrival = document.createElement('div');
    arrival.className = 'scene-arrival';
    arrival.hidden = true;
    arrival.setAttribute('role', 'status');
    fade.append(arrival);
    this.camera = new FollowCamera(window.innerWidth / window.innerHeight);
    this.controls = new Controls(
      this.options.canvas,
      () => {
        const player = this.localPlayer;
        if (player === null || player.action.kind !== ActionKind.Dodge || this.placing !== null)
          return false;
        const context = this.actionContext(
          player.motion.position,
          this.aimYaw ?? player.motion.facingYaw,
        );
        return context.canAttack && !context.castInstead;
      },
      () => this.canTabTarget(),
    );
    this.controls.setGameplayEnabled(false);

    this.options.hud.publish({
      loadingProgress: 15,
      loadingStage: 'Finding your forest',
      backend: setup.backend,
      forcedFallback: setup.forcedFallback,
      playerName: this.options.identity.name,
      selfLook: {
        character: this.options.identity.character,
        tint: TINT_COLORS[this.options.identity.color].hex,
        skin: this.options.identity.skin,
      },
    });
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.handleForestVisibility);
    window.addEventListener('pointerdown', this.startMusicFromInput);
    window.addEventListener('keydown', this.startMusicFromInput);

    this.offlineFallbackAt = performance.now() + OFFLINE_FALLBACK_MS;
    this.connect();

    this.lastFrameMs = performance.now();
    setup.renderer.setAnimationLoop(this.frame);
  }

  private readonly startMusicFromInput = (): void => {
    if (this.playing) startAmbientMusic();
  };

  /** Reclaim play from another tab after an explicit click. */
  resume(): void {
    this.connection?.playHere();
    this.setPlaying(true);
    // Tied to this real click rather than page load: autoplay policy blocks
    // audio started without one.
    startAmbientMusic();
  }

  /** Escape closes the current panel or placement; the world stays playable. */
  private handleEscapeInput(): void {
    if (this.chestOpen || (this.chestPending && !this.chestDismissed)) this.closeChest();
    else if (this.mapOpen) this.showMenuPanel(null);
    else if (this.placing !== null) this.stopPlacing();
    else if (this.craftMenuOpen || this.buildMenuOpen || this.inventoryOpen)
      this.showMenuPanel(null);
    else if (this.targeting.id !== null) this.targeting.clear();
  }

  setSettingsOpen(open: boolean): void {
    this.settingsOpen = open;
    this.syncGameplayControls();
  }

  private syncGameplayControls(): void {
    this.controls?.setGameplayEnabled(
      this.playing && !this.chestOpen && !this.settingsOpen && !this.spaceTransition.active,
    );
  }

  private setPlaying(playing: boolean): void {
    this.playing = playing;
    if (!playing) this.closeChest();
    this.syncGameplayControls();
    this.forestAudio.update(playing && !document.hidden);
    this.worldAmbience.setActive(playing && !document.hidden);
    setImpactSoundsActive(playing && !document.hidden);
    if (!playing) {
      // Nothing should keep walking, swinging or charging under the curtain.
      this.stopPlacing();
      this.buildMenuOpen = false;
      this.craftMenuOpen = false;
      this.inventoryOpen = false;
      this.characterOpen = false;
      this.mapOpen = false;
    }
    this.options.hud.publish({
      playing: this.playing,
      mapOpen: this.mapOpen,
      buildMenuOpen: this.buildMenuOpen,
      craftMenuOpen: this.craftMenuOpen,
      inventoryOpen: this.inventoryOpen,
      characterOpen: this.characterOpen,
    });
  }

  transferChest(request: ChestRequest): void {
    if (this.chestPending || !this.playing) return;
    if (!this.submitAction('use storage', () => this.connection?.sendChest(request))) return;
    this.chestPending = true;
    this.chestDismissed = false;
    this.chestPendingSince = performance.now();
    this.options.hud.publish({
      chestPending: true,
      chestNote: this.chestWaitingText(performance.now()),
      interactionNote: this.chestOpen ? null : this.chestWaitingText(performance.now()),
    });
  }

  closeChest(): void {
    if (!this.chestOpen && !this.chestPending) return;
    this.chestOpen = false;
    // Closing a panel cannot cancel a command already sent to the server.
    this.chestDismissed = this.chestPending;
    this.homeInterior?.setChestOpen(false);
    for (const model of this.builtMeshes.values())
      if ('setChestOpen' in model) model.setChestOpen(false);
    this.syncGameplayControls();
    this.options.hud.publish({ chestSlots: null, chestPending: false, chestNote: null });
  }

  private chestAt(point: { x: number; y: number }, camera: FollowCamera): boolean {
    return this.space === OUTDOORS
      ? this.outdoorProjectAt(point, camera, 'trailPantry')
      : this.interiorTargetAt(point, camera, this.homeInterior?.chest);
  }
  private outdoorProjectAt(
    point: { x: number; y: number },
    camera: FollowCamera,
    kind: 'trailPantry' | 'kitchenGarden',
  ): boolean {
    if (this.space !== OUTDOORS) return false;
    const piece = nearestHomesteadPiece(this.builtProps, kind, this.motionOrOrigin());
    return piece !== null && this.outdoorBuiltHit(point, camera, piece.id);
  }

  private outdoorBuiltHit(
    point: { x: number; y: number },
    camera: FollowCamera,
    id: number,
  ): boolean {
    const model = this.builtMeshes.get(id);
    if (!model) return false;
    this.clickNdc.set((point.x / innerWidth) * 2 - 1, (-point.y / innerHeight) * 2 + 1);
    this.clickRaycaster.setFromCamera(this.clickNdc, camera.camera);
    model.group.updateWorldMatrix(true, true);
    const hit = this.clickRaycaster.intersectObject(model.group, true).find((entry) => {
      for (let node: THREE.Object3D | null = entry.object; node; node = node.parent)
        if (!node.visible) return false;
      return true;
    });
    if (!hit) return false;
    const previousFar = this.clickRaycaster.far;
    try {
      this.clickRaycaster.far = Math.max(0, hit.distance - 0.02);
      const blockers = [
        ...(this.wildernessScene
          ? [this.wildernessScene.cameraGround, ...this.wildernessScene.cameraBlockers]
          : []),
        ...(this.clearingScene ? [this.clearingScene.cameraBlockers] : []),
        ...(this.digScene?.cameraBlockers ?? []),
        ...this.homeCameraBlockers,
        ...[...this.builtMeshes.values()]
          .filter((other) => other !== model)
          .map((other) => other.group),
      ];
      return !blockers.some((blocker) => {
        blocker.updateWorldMatrix(true, true);
        return this.clickRaycaster.intersectObject(blocker, true).length > 0;
      });
    } finally {
      this.clickRaycaster.far = previousFar;
    }
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
    if (this.space === OUTDOORS) {
      const pantry = nearestHomesteadPiece(this.builtProps, 'trailPantry', this.motionOrOrigin());
      if (!pantry?.yours) return 'Private · belongs to the home owner';
      return Math.hypot(this.motionOrOrigin().x - pantry.x, this.motionOrOrigin().z - pantry.z) >
        1.8
        ? 'Too far away · move closer'
        : 'Left-click to open · 10 extra private slots';
    }
    if (this.homeHere()?.yours !== true) return 'Private · belongs to the home owner';
    const chest = homeChestSpot(this.currentHomeKind());
    const position = this.motionOrOrigin();
    if (Math.hypot(position.x - chest.x, position.z - chest.z) > 1.8)
      return 'Too far away · move closer';
    return 'Left-click to open · 10 storage slots';
  }

  /** Apply the same panel transition for mouse buttons, hotkeys and world interactions. */
  private showMenuPanel(panel: MenuPanel | null): void {
    if (panel !== null) {
      this.closeChest();
      this.stopPlacing();
    }
    const state = menuPanelState(panel);
    Object.assign(this, state);
    this.options.hud.publish(state);
  }

  /** Called from the HUD's own bag button or B/I. */
  toggleInventory(): void {
    this.showMenuPanel(this.inventoryOpen ? null : 'pack');
  }

  /**
   * Z, or the character button: the character screen beside the pack, so a
   * piece can be dragged from one to the other. The pack opens with it and
   * closes with it (decision 0113).
   */
  toggleCharacter(): void {
    this.showMenuPanel(this.characterOpen ? null : 'character');
  }

  /** Put something on, take it off or swap two pieces. The server decides (decision 0113). */
  changeGear(request: GearRequest): void {
    if (!this.submitAction('change gear', () => this.connection?.sendGear(request))) return;
    if (this.gearNotice !== null) {
      if (this.interactionNote === this.gearNotice.text) {
        this.interactionNote = null;
        this.interactionNoteUntil = 0;
        this.options.hud.publish({ interactionNote: null });
      }
      this.gearNotice = null;
      this.options.hud.publish({ gearNotice: null });
    }
    // Taking something off puts it back in the pack, which is moving it, not
    // finding it: the pack's reply to this must not make a toast.
    this.quietPackUntil = performance.now() + GEAR_QUIET_MS;
  }

  /**
   * Open or put away the big map - M, or a click on the minimap or the map's
   * own close button. Everything else that fills the middle of the screen
   * steps aside for it; walking carries on underneath (see decision 0054).
   */
  toggleMap(): void {
    this.showMenuPanel(this.mapOpen ? null : 'map');
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
    if (isWeapon(item)) {
      this.changeGear({ action: 'wear', item, slot: 'mainHand' });
      return;
    }
    const home = blueprintHome(item);
    if (home !== null && knowsHome(this.homeSkills, home)) {
      this.craftingNews = {
        text: 'You already learned this home blueprint.',
        until: performance.now() + NEWS_MS,
      };
      return;
    }
    if (!ITEM_KINDS[item].equippable && blueprintHome(item) === null) return;
    if (!this.carrying.some((entry) => entry.item === item && entry.count > 0)) {
      this.showActionNote(`No ${ITEM_KINDS[item].displayName.toLowerCase()} in your pack.`);
      return;
    }
    if (
      (this.equipped.get(this.selfNetId) ?? null) !== item &&
      !this.handSelection.begin(item, performance.now())
    )
      return;
    if (!this.submitAction('use this item', () => this.connection?.sendUseItem(item)))
      this.handSelection.clear();
  }

  /**
   * Drop or destroy some of something in the pack, from the slot menu (see
   * decision 0061). Only asked for here; the server decides whether it
   * happens, and how many that really is.
   */
  discard(item: ItemId, amount: number, destroy: boolean): void {
    if (!isDiscardable(item) || amount < 1) return;
    if (!this.carrying.some((entry) => entry.item === item && entry.count > 0)) return;
    this.submitAction(destroy ? 'destroy items' : 'drop items', () =>
      this.connection?.sendDiscard({ item, amount: Math.floor(amount), destroy }),
    );
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
    if (piece === undefined || this.decorationFeedback.request !== null) return;
    const request = { ...piece, action: 'reclaim' as const };
    if (!this.submitAction('decorate', () => this.connection?.sendDecoration(request))) return;
    this.decorationFeedback.begin(request, performance.now());
    this.beginDecorationFeedback(null);
  }
  private decorationRefusal(reason: DecorationState['reason']): string | null {
    if (reason === null) return null;
    return {
      occupied:
        'Someone is using this object. Wait for them to get up or leave before moving or dismantling it.',
      contents:
        'Empty storage, pack up indoor decorations, harvest crops and let the fire fuel burn out first.',
      unsupported: 'This structure cannot be moved. Dismantle it to rebuild elsewhere.',
      unavailable: 'Enter your home to decorate',
      private: 'Only the owner can change this object',
      materials: 'Gather the listed materials first',
      blocked: 'Keep furniture, doorways, beds and stations clear',
      tooFar: 'Move closer to that spot',
      busy: 'Stand up and finish your current action first',
      limit: 'Your home can hold 16 decorations',
      missing: 'That decoration is no longer here',
      packFull: 'Make room in your backpack before packing this up',
      recipe: 'Learn this decoration recipe first',
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
      model.group.userData.decorationId = piece.id;
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
      selectedTargetId: () => this.targeting.id,
      buildBoundaryVisible: () => this.buildBoundary?.group.visible ?? false,
      grassClumps: () => this.grass?.mesh.count ?? 0,
      combatMove: () => ({
        kind: this.localPlayer?.action.kind ?? 0,
        age: this.localPlayer?.actionAge() ?? 0,
        grounded: this.localPlayer?.motion.grounded ?? true,
      }),
      footstepCount: () => this.forestAtmosphere.scheduledSteps,
      snowFootprints: () => this.footprints?.visibleCount() ?? 0,
      wildfireEffects: () =>
        this.wildfireArt?.visibleEffects() ?? { fires: 0, smoke: 0, embers: 0, lightning: false },
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
      pileInReach: (id) => {
        const pile = this.droppedPiles.find((entry) => entry.id === id);
        return (
          this.localPlayer !== null &&
          pile !== undefined &&
          this.space === OUTDOORS &&
          this.canReachGroundLoot(this.localPlayer.motion.position, pile)
        );
      },
      nearGatherSpot: () => this.nearGatherSpot,
      felledTrees: () => [...this.treeStates].filter(([, state]) => state.felled).map(([id]) => id),
      treeGenerations: () =>
        [...this.treeStates].map(([id, state]) => ({
          id,
          generation: state.generation,
          growth: state.growth ?? 255,
          scale: this.standingProps.find((tree) => tree.id === id)?.scale ?? 0,
        })),
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
      treasureSpots: () => this.treasures.map((spot) => ({ ...spot })),
      buriedCaches: () => this.buriedCaches.map((cache) => ({ ...cache })),
      space: () => this.space,
      outdoorFocus: () => ({ ...this.outdoorFocus }),
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
    setImpactSoundsActive(false);
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleForestVisibility);
    window.removeEventListener('pointerdown', this.startMusicFromInput);
    window.removeEventListener('keydown', this.startMusicFromInput);
    this.setup?.renderer.setAnimationLoop(null);
    this.ownSwoosh.clear();
    this.signOutCountdown.dispose();
    this.controls?.dispose();
    this.connection?.close();
    this.clearingScene?.dispose();
    this.gatheringFocus.dispose();
    this.forestAudio.dispose();
    this.worldAmbience.dispose();
    this.groundItems?.dispose();
    this.wildernessScene?.dispose();
    this.lakeScene?.dispose();
    this.streamScene?.dispose();
    this.digScene?.dispose();
    this.mineSupports?.dispose();
    this.supportPreview?.dispose();
    this.buildBoundary?.dispose();
    this.encounterLandmarks?.dispose();
    this.discoveryLandmarks?.dispose();
    this.surveyScenery?.dispose();
    this.animalTracks?.dispose();
    this.freshAnimalTracks?.dispose();
    for (const model of this.decorModels) model.dispose();
    this.decorModels.length = 0;
    this.wildfireArt?.dispose();
    this.footprints?.dispose();
    this.waterWake.clear();
    for (const ripple of waterRippleUniforms) ripple.value.set(0, 0, 10, 0);
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
    this.floatingBoats.clear();
    this.rowingBoats.dispose();
    for (const mound of this.buriedCacheMeshes.values()) mound.dispose();
    this.buriedCacheMeshes.clear();
    this.clearKingVictory();
    this.kingVictoryEffect?.dispose();
    this.kingStormArt?.dispose();
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
    const url = worldSocketUrl(
      this.options.worldId,
      undefined,
      this.options.season,
      this.options.gear,
    );
    this.connection = new WorldConnection(
      url,
      {
        onMessage: (message) => this.handleMessage(message),
        onStateChange: (state, detail) => {
          // Clear stale gameplay at the outage/recovery boundary. Retrying an
          // already-paused connection must not swallow journal keys or the
          // fresh clicks that explain why an offline action cannot proceed.
          if (
            this.connectionState !== state &&
            (this.connectionState === 'connected' || state === 'connected')
          ) {
            this.controls?.releaseAll();
            this.localPlayer?.pause();
          }
          if (this.connectionState === 'connected' && state !== 'connected')
            this.meal = this.currentMeal();
          this.mealHeardAt = performance.now();
          this.connectionState = state;
          if (state !== 'connected') {
            const interruptedBuild = this.buildFeedback.clear();
            this.pendingBuildPreview = null;
            this.pendingPlacements = [];
            const interruptedCraft = this.craftFeedback.clear();
            const interruptedDecoration = this.decorationFeedback.clear();
            this.pendingDecorationPreview = null;
            if (interruptedCraft || interruptedDecoration || interruptedBuild) {
              this.showActionNote(
                interruptedDecoration || interruptedBuild
                  ? 'Connection interrupted. Check your surroundings and pack after reconnecting before trying again.'
                  : 'Connection interrupted. Check your pack after reconnecting before crafting again.',
              );
              this.options.hud.publish({ craftPending: null, decorationPending: false });
            }
            this.chestPending = false;
            this.closeChest();
            this.targeting.clear();
          }
          this.options.hud.publish({ connection: state, connectionDetail: detail ?? '' });
          // Playing in another tab now: the curtain comes down here, and
          // clicking it is how to play in this one again (see `resume`).
          if (state === 'elsewhere') this.setPlaying(false);
          if (state === 'deleted') {
            this.setPlaying(false);
            this.options.onCharacterDeleted();
          }
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
    if (message.type === 'welcome') this.ownSwoosh.clear();
    switch (message.type) {
      case 'itemCatalog': {
        applyItemCatalog(message);
        this.options.hud.publish({});
        break;
      }
      case 'chest': {
        if (!this.chestPending) break;
        this.chestPending = false;
        const text =
          message.reason === null
            ? message.moved > 0
              ? `${message.moved} item${message.moved === 1 ? '' : 's'} moved.`
              : null
            : chestReasonText(message.reason);
        if (this.chestDismissed) {
          this.chestDismissed = false;
          if (text) this.showActionNote(text);
          break;
        }
        if (
          message.reason === null ||
          message.reason === 'chestFull' ||
          message.reason === 'packFull' ||
          message.reason === 'empty' ||
          message.reason === 'invalid'
        ) {
          this.chestOpen = true;
          Object.assign(this, menuPanelState(null));
          this.controls?.setGameplayEnabled(false);
          this.homeInterior?.setChestOpen(true);
          const pantry = this.builtMeshes.get(message.homeId);
          if (pantry && 'setChestOpen' in pantry) pantry.setChestOpen(true);
          this.options.hud.publish({
            chestSlots: message.slots,
            chestPending: false,
            chestNote: text,
            ...menuPanelState(null),
          });
        } else {
          this.closeChest();
          this.interactionNote = text;
          this.interactionNoteUntil = performance.now() + 3200;
        }
        break;
      }
      case 'welcome': {
        this.handSelection.clear();
        this.equipped.clear();
        this.chestPending = false;
        this.chestDismissed = false;
        this.homesteadAppearances.clear();
        this.fireFuelStates.clear();
        this.options.hud.publish({ warmth: null });
        this.clearRemoteActors();
        if (this.selfNetId !== 0 && this.selfNetId !== message.netId) {
          this.floats.reelIn(this.selfNetId);
          this.fishingPhase = null;
          this.reel = null;
          this.options.hud.publish({ fishing: null, reel: null });
        }
        this.recoveryHeard = false;
        this.recoveryMarkers = [];
        this.buriedCaches = [];
        this.treasures = [];
        this.nearTreasure = null;
        this.applyBuriedCaches();
        this.allies = [];
        this.selfNetId = message.netId;
        this.serverTick = message.tick;
        // A fresh connection starts from a fresh pack list: what it says is
        // what we had, not what we just gained.
        this.packHeardFrom = false;
        this.syncServerClock(message.serverTimeMs);
        // Every fresh connection is a clean slate on the server - this has to
        // be resent on every reconnect, not only the first one.
        const { name, character, color, skin } = this.options.identity;
        this.connection?.sendHello(name, character, color, skin);
        void this.enterWorld(message.seed);
        break;
      }
      case 'animalTracks': {
        this.freshAnimalTracks?.setTracks(message.tracks);
        break;
      }
      case 'kingStorm': {
        if (
          message.storm?.phase === 'storm' &&
          (this.kingStorm?.phase !== 'storm' || this.kingStorm.wave !== message.storm.wave)
        )
          playEarthRumble(message.storm.outside ? 0.3 : 0.65);
        this.kingStorm = message.storm;
        this.raiders.setKingStorm(message.storm);
        break;
      }
      case 'allies': {
        this.allies = message.players;
        break;
      }
      case 'roster': {
        this.roster.clear();
        for (const entry of message.players) this.roster.set(entry.netId, entry);
        this.applyRoster();
        break;
      }
      case 'equipped': {
        const before = this.equipped.get(this.selfNetId);
        const own = message.players.find((entry) => entry.netId === this.selfNetId);
        if (own !== undefined) {
          this.handSelection.confirm(own.item);
          const note = handSelectionText(before, own.item);
          if (note !== null && this.playing) this.showActionNote(note);
        }
        this.equipped.clear();
        for (const entry of message.players) this.equipped.set(entry.netId, entry.item);
        this.applyEquipped();
        break;
      }
      case 'worn': {
        this.worn.clear();
        for (const entry of message.players) this.worn.set(entry.netId, entry.worn);
        this.applyWorn();
        this.options.hud.publish({ worn: this.worn.get(this.selfNetId) ?? {} });
        break;
      }
      case 'digRefused': {
        this.interactionNote = digRefusalText(message.reason);
        this.interactionNoteUntil = performance.now() + 2800;
        break;
      }
      case 'gearRefused': {
        this.handSelection.clear();
        this.gearNotice = {
          text: gearRefusalText(message.reason),
          key: (this.gearNotice?.key ?? 0) + 1,
        };
        this.options.hud.publish({ gearNotice: this.gearNotice });
        this.showActionNote(this.gearNotice.text);
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
        if (this.buildFeedback.request !== null) break;
        const descriptions = {
          materials: 'You need more building materials.',
          identity: 'Reconnect to build a home.',
          blueprint: 'Learn this home blueprint first.',
          tier: 'Upgrade your home one tier at a time.',
          moved: 'Upgrade your existing home in place.',
          occupied: 'Everyone must leave the home before upgrading.',
          blocked: 'The larger home needs more clear space around it.',
          furnishings:
            'Move or pack up furniture inside your home before upgrading; it overlaps the new room layout.',
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
        this.refreshDecorations();
        break;
      }
      case 'decorationReply': {
        const result = this.decorationFeedback.settle(message);
        if (result !== null) {
          this.decorNote = this.decorationRefusal(result.reason);
          if (result.reason === null) {
            if (this.placing === this.pendingDecorationPreview) this.stopPlacing();
            const action =
              result.request.action === 'place'
                ? 'placed'
                : result.request.action === 'move' || result.request.action === 'moveOutdoor'
                  ? 'moved'
                  : isDecorationKind(result.request.kind)
                    ? 'packed up'
                    : 'dismantled';
            this.showActionNote(`${BUILDABLE_KINDS[result.request.kind].displayName} ${action}.`);
          } else this.showActionNote(this.decorNote!);
          this.pendingDecorationPreview = null;
          this.options.hud.publish({ decorationPending: false, decorNote: this.decorNote });
        }
        break;
      }
      case 'fishRecords': {
        this.fishRecords = fishRecordsFromSaved(message);
        this.options.hud.publish({ fishRecords: this.fishRecords });
        break;
      }
      case 'wildfire':
        this.wildfireState = message;
        this.wildfireArt?.setState(message);
        this.clearingScene?.setWildfire(message);
        this.wildernessScene?.setWildfire(message);
        break;
      case 'lakeIce': {
        this.applyLakeIce(message.frozen);
        break;
      }
      case 'dug': {
        // Digs only ever add, so a full list is the old one plus more: carving
        // twice changes nothing, and it can simply be played again.
        this.digs = message.replace ? [...message.digs] : [...this.digs, ...message.digs];
        this.digScene?.apply(message.digs);
        this.grass?.setHoles((x, z) => this.digScene?.isOpenNear(x, z) ?? false);
        break;
      }
      case 'supports': {
        this.supports = message.replace
          ? [...message.supports]
          : [...this.supports, ...message.supports];
        this.mineSupports?.apply(message.supports, message.replace);
        break;
      }
      case 'rareReel': {
        this.reel = message;
        this.fishingPhase = 'reeling';
        this.options.hud.publish({ fishing: this.fishingPhase, reel: this.reel });
        break;
      }
      case 'expedition': {
        const victory = bonehollowVictory(this.expedition, message);
        if (victory) {
          const now = performance.now();
          const banner: RaidBanner = { ...victory, tone: 'victory', key: ++this.raidBannersShown };
          this.bonehollowVictoryUntil = now + RAID_BANNER_MS;
          this.raidBanner = { banner, until: this.bonehollowVictoryUntil };
          this.options.hud.publish({ raidBanner: banner });
          playLastBell();
        }
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
      case 'homesteadAppearance': {
        this.homesteadAppearances.clear();
        for (const project of message.projects) {
          this.homesteadAppearances.set(project.id, project);
          const model = this.builtMeshes.get(project.id);
          if (model && 'setAppearance' in model) model.setAppearance(project);
        }
        break;
      }
      case 'garden': {
        this.garden = message;
        if (message.homeId === this.space) this.homeInterior?.setGardenPlots(message.plots);
        const garden = this.builtMeshes.get(message.homeId);
        if (garden && 'setGardenPlots' in garden) garden.setGardenPlots(message.plots);
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
        const movedByGear = performance.now() < this.quietPackUntil;
        if (this.packHeardFrom && !movedByGear) this.showGains(packGains(this.carrying, carrying));
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
            ...(tree.growth !== undefined ? { growth: tree.growth } : {}),
            felled: tree.felled,
            ...(tree.fall ? { fall: tree.fall } : {}),
            ...(tree.burned ? { burned: true } : {}),
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
      case 'warmth': {
        this.options.hud.publish({
          warmth: {
            value: message.value,
            status: message.status,
            heat: message.heat,
            secondsToDamage: message.secondsToDamage,
          },
        });
        break;
      }
      case 'health': {
        this.hearAboutHealth(message.event);
        break;
      }
      case 'craftRefused': {
        this.craftFeedback.settle(message.item);
        this.options.hud.publish({ craftPending: this.craftFeedback.item });
        this.showActionNote(craftRefusalText(message.reason));
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
      case 'buildReply': {
        const result = this.buildFeedback.settle(message);
        if (result === null) break;
        const preview = this.pendingBuildPreview;
        if (result.reason === null && preview !== null && preview === this.placing) {
          preview.placedAny = true;
          if (BUILDABLE_KINDS[result.request.kind].capPerPlayer) this.stopPlacing();
        }
        this.pendingBuildPreview = null;
        this.pendingPlacements = [];
        this.showActionNote(
          result.reason === null
            ? `${BUILDABLE_KINDS[result.request.kind].displayName} placed.`
            : buildReplyText(result.reason),
        );
        break;
      }
      case 'fireFuel': {
        const storageChanged =
          message.fires.some(
            (fire) => this.fireFuelStates.get(fire.propId)?.storedLogs !== fire.storedLogs,
          ) || message.fires.length !== this.fireFuelStates.size;
        this.fireFuelStates = new Map(message.fires.map((fire) => [fire.propId, fire]));
        this.fireFuelReceivedAt = performance.now();
        for (const [id, mesh] of this.builtMeshes)
          if ('setStoredLogs' in mesh)
            mesh.setStoredLogs?.(this.fireFuelStates.get(id)?.storedLogs ?? 0);
        if (storageChanged) this.refreshPlacedSolids();
        break;
      }
      case 'builtProps': {
        const onlyBoatMotion =
          message.props.length === this.builtProps.length &&
          message.props.every((prop) => {
            const previous = this.builtProps.find((old) => old.id === prop.id);
            if (previous === undefined || previous.kind !== prop.kind) return false;
            const keys = new Set([...Object.keys(previous), ...Object.keys(prop)]);
            for (const key of keys) {
              if (prop.kind === 'rowboat' && (key === 'x' || key === 'z' || key === 'yaw'))
                continue;
              if (previous[key as keyof BuiltPropView] !== prop[key as keyof BuiltPropView])
                return false;
            }
            return true;
          });
        const finished = message.props.filter(
          (prop) =>
            prop.yours &&
            isHomesteadProject(prop.kind) &&
            !this.builtProps.some((old) => old.id === prop.id),
        );
        if (
          this.playing &&
          this.builtProps.some((prop) => prop.yours && isHomeKind(prop.kind)) &&
          finished.length > 0
        ) {
          const count = message.props.filter(
            (prop) => prop.yours && isHomesteadProject(prop.kind),
          ).length;
          this.craftingNews = {
            text:
              count === 3
                ? 'Trailstead established · a place to make, to keep and to grow.'
                : `${BUILDABLE_KINDS[finished[0]!.kind].displayName} complete · ${count}/3 homestead projects.`,
            until: performance.now() + NEWS_MS,
          };
        }
        this.builtProps = message.props;
        if (!onlyBoatMotion) this.grass?.setBuildings(message.props);
        this.applyBuiltProps(onlyBoatMotion);
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
      case 'treasure': {
        this.treasures = message.spots;
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
        if (this.localPlayer === null || this.enteringWorld) {
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
    if (event.health < this.health && !event.adjusted) {
      this.signOutCountdown.noteHurt();
      if (!event.cold) {
        this.ambienceDangerUntil = performance.now() + 3500;
        this.camera?.shake(TOOK_DAMAGE_SHAKE);
        playTookDamage();
      }
      if (!event.cold)
        this.combatFeed.hurt(
          (this.health - event.health) / HURT_FULL_FLASH,
          this.hurtFromYaw(),
          performance.now(),
        );
    }
    this.health = event.health;
    if (event.knockedOut) {
      const now = performance.now();
      this.healthNews = {
        text: 'Knocked out! You wake up safe. Any belongings from an earlier death are lost.',
        until: now + NEWS_MS,
      };
    } else if (event.dodged) {
      const now = performance.now();
      this.healthNews = { text: 'Dodged!', until: now + NEWS_MS };
      this.combatFeed.dodgeAtMs = now;
    }
    // Same reasoning as `hearFromTheWater`: pushed straight to the HUD rather
    // than left for the next frame, so a stall in the render loop cannot eat
    // the window this news is shown for.
    this.options.hud.publish({ health: this.health, healthNews: this.currentHealthNews() });
  }

  private currentHealthNews(now = performance.now()): string | null {
    if (this.allies.some((ally) => ally.netId === this.selfNetId && ally.downTicks > 0))
      return 'An ally can help you up. Your belongings remain where you fell.';
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
    if (hit.hitsLeft === 0) {
      const king = this.raiders.defeatedKingAt(hit.raiderId);
      if (king) this.startKingVictory(king);
    }
    const now = performance.now();
    // Whirlwinds can confirm several victims together: one quiet cue per beat.
    if (ours) this.ambienceDangerUntil = now + 3500;
    if (ours && now - this.lastConfirmedStrikeAt >= 70) {
      this.lastConfirmedStrikeAt = now;
      playConfirmedStrike(hit.heavy, hit.hitsLeft === 0);
      this.combatFeed.confirmStrike(hit.hitsLeft === 0, now);
    }
  }

  /**
   * A skeleton raid turned up, was fought off, or is over (see decision
   * 0063): a banner, and the horn or a fanfare - for a raid on us, or on
   * somebody close enough that it is everybody's fight.
   */
  private hearAboutRaid(news: RaidNews): void {
    if (
      news.kind === 'encounterCleared' &&
      !isKingVictoryNews(news) &&
      performance.now() < this.bonehollowVictoryUntil
    )
      return;
    const ours = news.targetNetId === this.selfNetId;
    const me = this.listenerPoint();
    const near = me !== null && Math.hypot(news.x - me.x, news.z - me.z) < RAID_HEARD_WITHIN;
    if (!ours && !near) return;
    if (isKingVictoryNews(news)) {
      this.startKingVictory({ ...news, y: this.collision?.terrain.heightAt(news.x, news.z) ?? 0 });
      return;
    }
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

  private startKingVictory(at: { x: number; y: number; z: number }): void {
    const now = performance.now(),
      listener = this.listenerPoint();
    if (
      !listener ||
      !this.kingVictoryEffect ||
      now - this.lastKingVictoryAt < 30000 ||
      Math.hypot(at.x - listener.x, at.z - listener.z) > 60 ||
      document.hidden
    )
      return;
    this.lastKingVictoryAt = now;
    this.clearKingStorm();
    this.kingVictory = { key: ++this.raidBannersShown, startedAt: now };
    this.kingVictoryEffect.start(at, this.reducedMotion.matches);
    this.stopKingVictorySound?.();
    this.stopKingVictorySound = playKingVictory();
    this.options.hud.publish({ kingVictory: this.kingVictory, raidBanner: null });
  }

  private nearestKingWard(): Compass | null {
    const at = this.listenerPoint();
    if (
      !at ||
      !this.kingStorm ||
      this.kingStorm.sheltered ||
      this.kingStorm.outside ||
      this.kingStorm.phase === 'recovery'
    )
      return null;
    let nearest: Compass | null = null;
    for (const ward of KING_WARDS) {
      const direction = compassTo(at, ward, this.camera?.look.yaw ?? 0);
      if (!nearest || direction.distanceMeters < nearest.distanceMeters) nearest = direction;
    }
    return nearest;
  }

  private clearKingStorm(): void {
    this.kingStorm = null;
    this.raiders.setKingStorm(null);
    this.kingStormArt?.clear();
  }

  private clearKingVictory(): void {
    this.kingVictory = null;
    this.kingVictoryEffect?.clear();
    this.stopKingVictorySound?.();
    this.stopKingVictorySound = null;
    this.options.hud.publish({ kingVictory: null });
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
    this.craftFeedback.settle(event.item);
    this.options.hud.publish({ craftPending: this.craftFeedback.item });
    this.showActionNote(`${ITEM_KINDS[event.item].displayName} ready.`);
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
      event.kind === 'treasure'
        ? 'Treasure unearthed! Supplies added to your pack.'
        : event.kind === 'treasurePartial'
          ? 'Some treasure collected. Make room in your pack; the rest stays here.'
          : event.kind === 'buried'
            ? 'Safe at home. Recover your belongings before your next death; older belongings are lost.'
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
        event.item === 'cedarHide'
          ? event.added === 0
            ? 'Old Cedar Stag caught · your hide is on the ground. Make room and collect it.'
            : 'Old Cedar Stag caught · hide secured. Stitch your Cedarstalker coat in C → Gear.'
          : event.added === 0
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
          preloadHousingDetails(),
          preloadSkeletonTown(),
          preloadPropModels(),
          preloadDugWalls(),
          preloadMineSupport(),
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

      const terrain = createWildernessTerrain(seed);
      const clearing = buildTestClearing(seed, terrain);
      this.footprints?.dispose();
      this.waterWake.clear();
      this.footprints = createSnowFootprints((x, z) =>
        (this.collision?.terrain ?? terrain).heightAt(x, z),
      );
      this.outdoors.add(this.footprints.mesh);
      this.wildfireArt?.dispose();
      this.wildfireArt = createWildfireArt();
      this.wildfireArt.setState(this.wildfireState);
      this.outdoors.add(this.wildfireArt.group);
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
      this.discoveryLeads = buildDiscoveryLeads(
        this.discoverySites,
        terrain,
        [...clearing.colliders, ...wilderness.colliders],
        [...clearing.water, ...LAKE.basin],
      );
      this.protectedBuildSites = [
        SKELETON_TOWN,
        CROWNBREAKER_HOLD,
        ...KING_REMNANTS.map((site) => ({
          x: site.x - 2.8,
          z: site.z + 2.7,
          radius: 1.5,
          name: 'stronghold cairn',
        })),
        ...SUNREACH_SURVEY.map((site) => ({ ...site, radius: 6 })),
        ...WOODLAND_ENCOUNTERS,
        ...this.discoveryLeads.map((lead) => ({
          x: lead.markerX,
          z: lead.markerZ,
          radius: 1,
          name: 'trail cairn',
        })),
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
      this.surveyScenery = createSurveyScenery(terrain);
      this.outdoors.add(this.surveyScenery.group);
      this.discoveryLandmarks = createDiscoveryLandmarks(this.discoverySites, terrain);
      this.outdoors.add(this.discoveryLandmarks.group);
      this.animalTracks = createAnimalTracks(seed, terrain, [
        ...clearing.colliders,
        ...wilderness.colliders,
        ...encounterColliders(
          [...encounterSites, ...this.discoveryLeads, ...SUNREACH_REMNANTS, ...KING_REMNANTS],
          terrain,
        ),
        ...discoveryColliders([...this.discoverySites, ...SUNREACH_NOTES], terrain),
      ]);
      this.outdoors.add(this.animalTracks.group);
      this.freshAnimalTracks = new FreshAnimalTracks((x, z) => terrain.heightAt(x, z));
      this.outdoors.add(this.freshAnimalTracks.group);
      this.encounterLandmarks = createEncounterLandmarks(
        [...encounterSites, ...this.discoveryLeads, ...KING_REMNANTS],
        terrain,
      );
      this.outdoors.add(this.encounterLandmarks.group);

      this.clearing = clearing;
      this.clearingScene = buildClearingScene(clearing, terrain);
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
      this.digScene?.dispose();
      this.digScene = createDigScene(terrain, this.wildernessScene.ground);
      this.outdoors.add(this.digScene.group);
      this.digScene.apply(this.digs);
      this.mineSupports?.dispose();
      this.mineSupports = createMineSupports();
      this.outdoors.add(this.mineSupports.group);
      this.mineSupports.apply(this.supports, true);
      this.supportPreview?.dispose();
      this.supportPreview = createSupportPreview();
      this.outdoors.add(this.supportPreview.group);
      this.lakeScene?.dispose();
      this.lakeScene = createLakeScene(
        LAKE,
        undefined,
        undefined,
        riverMouthConnections(STREAM),
        undefined,
        { groundHeightAt: (x, z) => terrain.heightAt(x, z) },
      );
      this.lakeScene.setFrozen(this.lakeFrozen);
      this.outdoors.add(this.lakeScene.group);
      this.streamScene?.dispose();
      this.streamScene = createStreamScene(STREAM, terrain);
      this.streamScene.setFrozen(this.lakeFrozen);
      this.outdoors.add(this.streamScene.group);
      this.keepOutWater = [...clearing.water, ...LAKE.basin, ...STREAM_KEEP_OUT];
      this.grass = createGrass(terrain, clearing, wilderness, this.animalTracks?.tracks);
      this.grass.setDensity(this.grassDensity);
      this.grass.setBuildings(this.builtProps);
      this.grass.setHoles((x, z) => this.digScene?.isOpenNear(x, z) ?? false);
      this.outdoors.add(this.grass.mesh);

      this.outdoors.add(this.floats.group);

      const collision = createCollisionWorld(
        terrain,
        [
          ...clearing.colliders,
          ...wilderness.colliders,
          ...encounterColliders(
            [...encounterSites, ...this.discoveryLeads, ...SUNREACH_REMNANTS, ...KING_REMNANTS],
            terrain,
          ),
          ...discoveryColliders([...this.discoverySites, ...SUNREACH_NOTES], terrain),
          ...streamRockColliders(STREAM, terrain),
        ],
        PLAYABLE_HALF_EXTENT,
        LAKE,
        true,
        STREAM,
      );
      this.solidPlacedProps.clear();
      this.collision = collision;
      collision.dug = this.digScene.grid;
      setLakeFrozen(collision, this.lakeFrozen);
      this.localPlayer = new LocalPlayer(SPAWN_POSITION, collision);
      this.localPlayer.setActionContext((position, aimYaw) => this.actionContext(position, aimYaw));
      this.applyTreeStates();
      this.applyBuiltProps();
      // Drawn once out of sight while loading, so the first raid turns up
      // without the game freezing to learn how to draw a skeleton.
      this.raiders.rehearse(SPAWN_POSITION);
      this.kingVictoryEffect?.dispose();
      this.kingStormArt?.dispose();
      this.kingStormArt = new KingStormEffect(terrain);
      this.outdoors.add(this.kingStormArt.group);
      this.kingVictoryEffect = new KingVictoryEffect();
      this.outdoors.add(this.kingVictoryEffect.group);

      this.localCharacter = createCharacter(
        this.options.identity.character,
        TINT_COLORS[this.options.identity.color].hex,
        this.options.identity.skin,
      );
      this.localCharacter.setName(this.options.identity.name);
      this.localCharacter.setGear(this.worn.get(this.selfNetId) ?? {});
      this.scene.add(this.localCharacter.group);
      // If we signed in inside a distant home, draw the forest at its door
      // once behind the initial loading screen. Otherwise its first upload
      // and shaders would wait until the player leaves the room.
      const initialHome = this.builtProps.find((prop) => prop.id === this.pendingSpace?.space);
      if (initialHome !== undefined) {
        const door = cabinDoorway(initialHome);
        this.moveToSpace(OUTDOORS, door.x, door.z, initialHome.yaw + Math.PI);
      }

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
      // Warm the outdoor view before hiding it for a room. Keep Space
      // messages queued during preparation so the latest server destination
      // still wins if it changes while either view is drawing.
      this.warmEffectsOnNextFrame = true;
      await this.waitForWorldFrame();
      while (this.pendingSpace !== null) {
        const arrived = this.pendingSpace;
        this.pendingSpace = null;
        this.moveToSpace(arrived.space, arrived.x, arrived.z, arrived.yaw);
        await this.waitForWorldFrame();
      }
      this.enteringWorld = false;
      if (this.connectionState !== 'elsewhere' && this.connectionState !== 'deleted') {
        this.setPlaying(true);
      }
      this.options.hud.publish({
        ready: true,
        loadingProgress: 100,
        loadingStage: 'Your forest is ready',
      });
    } catch (error: unknown) {
      this.enteringWorld = false;
      console.error('Could not prepare the forest', error);
      this.options.hud.publish({
        loadingError: 'The forest couldn’t finish loading. Please try again.',
      });
    }
  }

  /** Rendering and a separate shader compilation must never overlap on this renderer. */
  private waitForWorldFrame(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.firstWorldFrame = resolve;
    });
  }

  /**
   * Put the trees where the server says they are, in the world we walk around
   * as well as the one we look at: a stump stops blocking like a trunk, and a
   * tree that grew back starts blocking again at its new size.
   */
  private applyTreeStates(): void {
    const now = this.estimatedServerTimeMs();
    this.clearingScene?.setWildfire(this.wildfireState);
    this.wildernessScene?.setWildfire(this.wildfireState);
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

      const grown = treeAtGeneration(clearing.seed, original, state.generation, state.growth);
      standing[slot] = grown;
      // Colliders are laid out the same way: the clearing's, then the forest's.
      replaceCollider(
        collision,
        inClearing ?? clearing.colliders.length + (inForest ?? 0),
        state.felled
          ? stumpColliderFor(grown, collision.terrain)
          : colliderForProp(grown, collision.terrain),
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
  private applyBuiltProps(onlyBoatMotion = false): void {
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
      this.floatingBoats.delete(id);
    }

    for (const prop of this.builtProps) {
      const existing = this.builtMeshes.get(prop.id);
      if (existing !== undefined) {
        // The whole list is resent whenever anything changes, including a
        // campfire lighting up or going out, so an existing mesh needs to
        // hear about it too, not just a freshly created one.
        if ('setLit' in existing) existing.setLit?.(this.fuelFireLit(prop.id));
        // Free boats follow the current between server updates. Occupied
        // boats are hidden here because a separate boat follows the rider.
        if (prop.kind !== 'rowboat') {
          existing.group.position.set(prop.x, this.builtGroundY(prop.kind, prop.x, prop.z), prop.z);
          existing.group.rotation.y = prop.yaw;
        }
        if (prop.kind === 'rowboat') {
          if (prop.occupied === true) this.floatingBoats.delete(prop.id);
          else {
            const floating = this.floatingBoats.get(prop.id);
            if (floating !== undefined) floating.sync(prop);
            else {
              this.floatingBoats.set(prop.id, new FloatingBoatMotion(prop));
              existing.group.position.set(prop.x, navigableWaterSurfaceAt(prop.x, prop.z), prop.z);
            }
          }
          existing.group.rotation.y = prop.yaw;
          existing.group.visible = prop.occupied !== true;
        }
        continue;
      }
      const built = createBuiltMesh(prop.kind);
      const appearance = this.homesteadAppearances.get(prop.id);
      if (appearance && 'setAppearance' in built) built.setAppearance(appearance);
      if ('setGardenPlots' in built && this.garden.homeId === prop.id)
        built.setGardenPlots(this.garden.plots);
      // Reflects whatever the server already thinks, not always unlit - a
      // client that joins mid-burn should see the fire going from the start.
      if ('setLit' in built) built.setLit?.(this.fuelFireLit(prop.id));
      built.group.position.set(prop.x, this.builtGroundY(prop.kind, prop.x, prop.z), prop.z);
      built.group.rotation.y = prop.yaw;
      if ('setStoredLogs' in built)
        built.setStoredLogs?.(this.fireFuelStates.get(prop.id)?.storedLogs ?? 0);
      if ('groundOn' in built) built.groundOn?.((x, z) => this.collision!.terrain.heightAt(x, z));
      built.group.visible = prop.occupied !== true;
      this.outdoors.add(built.group);
      built.group.userData.builtKind = prop.kind;
      this.builtMeshes.set(prop.id, built);
      if (prop.kind === 'rowboat' && prop.occupied !== true)
        this.floatingBoats.set(prop.id, new FloatingBoatMotion(prop));
    }
    if (!onlyBoatMotion && this.collision !== null) {
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
          const mesh = this.builtMeshes.get(prop.id);
          const bottomY =
            mesh === undefined
              ? groundY
              : Math.min(groundY, new THREE.Box3().setFromObject(mesh.group).min.y);
          this.homeCameraBlockers.push(homeCameraBlocker(prop, groundY, bottomY));
        }
    }
    this.updateMapBuilds();
    this.refreshPlacedSolids();
  }

  /** Solid pieces are appended after the indexed forest and refreshed with their visible pose. */
  private refreshPlacedSolids(): void {
    if (this.collision === null) return;
    const old = new Set([...this.solidPlacedProps.values()].flat());
    this.collision.colliders.splice(
      0,
      this.collision.colliders.length,
      ...this.collision.colliders.filter((c) => !old.has(c)),
    );
    this.solidPlacedProps.clear();
    for (const prop of this.builtProps) {
      const mesh = this.builtMeshes.get(prop.id)?.group;
      const solidProp =
        prop.kind === 'rowboat' && prop.occupied !== true && mesh !== undefined
          ? { ...prop, x: mesh.position.x, z: mesh.position.z, yaw: mesh.rotation.y }
          : prop;
      const ground = logStorageCapacity(prop.kind) > 0 ? logStorageSpot(prop) : solidProp;
      const solids = placedPropColliders(
        { ...solidProp, storedLogs: this.fireFuelStates.get(prop.id)?.storedLogs ?? 0 },
        this.builtGroundY(prop.kind, ground.x, ground.z),
      );
      if (solids.length > 0) {
        this.solidPlacedProps.set(prop.id, solids);
        this.collision.colliders.push(...solids);
      }
    }
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
    const mounds = [
      ...this.buriedCaches,
      ...this.treasures.map((spot) => ({ ...spot, id: -spot.id })),
    ];
    const present = new Set(mounds.map((cache) => cache.id));

    for (const [id, mound] of this.buriedCacheMeshes) {
      if (present.has(id)) continue;
      this.outdoors.remove(mound.group);
      mound.dispose();
      this.buriedCacheMeshes.delete(id);
    }

    for (const cache of mounds) {
      if (this.buriedCacheMeshes.has(cache.id)) continue;
      const mound = createBuriedCacheMound();
      const terrain = this.collision?.terrain;
      const y = terrain?.heightAt(cache.x, cache.z) ?? 0;
      mound.group.position.set(cache.x, y, cache.z);
      if (terrain !== undefined) {
        const normal = new THREE.Vector3(
          terrain.heightAt(cache.x - 0.3, cache.z) - terrain.heightAt(cache.x + 0.3, cache.z),
          0.6,
          terrain.heightAt(cache.x, cache.z - 0.3) - terrain.heightAt(cache.x, cache.z + 0.3),
        ).normalize();
        mound.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      }
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
    const character = createCharacter(
      this.characterKindFor(entry),
      this.colorFor(netId, entry),
      entry?.skin,
    );
    character.setName(entry?.name ?? null);
    character.setEquippedItem(this.equipped.get(netId) ?? null);
    character.setGear(this.worn.get(netId) ?? {});
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
      character.setSkinTone(entry?.skin ?? DEFAULT_SKIN_TONE);
      character.setName(entry?.name ?? null);
    }
  }

  /**
   * Show every remote character holding whatever the Equipped list now says
   * it does. The local player's own hand is set every frame instead, from
   * the same map, alongside its own animation state - see `updateLocalPlayer`.
   */
  private applyWorn(): void {
    this.localCharacter?.setGear(this.worn.get(this.selfNetId) ?? {});
    for (const [netId, character] of this.remoteCharacters) {
      character.setGear(this.worn.get(netId) ?? {});
    }
  }

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

  private critterFor(animalId: number): WoodlandCreature {
    const existing = this.critters.get(animalId);
    if (existing !== undefined) return existing;

    const critter = createCritterFor(animalKindOf(animalId) ?? 'rabbit', animalId);
    this.scene.add(critter.group);
    this.critters.set(animalId, critter);
    return critter;
  }

  /* ---------------------------------------------------------------------- */
  /* The frame                                                               */
  /* ---------------------------------------------------------------------- */

  private readonly handleForestVisibility = (): void => {
    this.forestAudio.update(this.playing && !document.hidden);
    this.worldAmbience.setActive(this.playing && !document.hidden);
    setImpactSoundsActive(this.playing && !document.hidden);
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

    camera.setReducedMotion(this.reducedMotion.matches);
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
          ((this.space === OUTDOORS &&
            this.outdoorProjectAt(clickPoint, camera, 'kitchenGarden')) ||
            (this.currentHomeKind() === 'largeCabin' &&
              this.interiorTargetAt(clickPoint, camera, this.homeInterior?.garden)))
        ) {
          controls.swallowLeftPress();
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
      ) {
        if (!this.openPlacedObject(rightPoint, camera)) this.lootAt(rightPoint, camera);
      }
    }

    // Read ahead of anything below that might forget taps for a produced
    // movement tick, so a hotbar, craft or build key pressed this frame is
    // never swallowed by that blanket clear before this gets a look at it.
    // Whichever of craft or build is open takes the same digit keys over;
    // the hotbar only gets a turn once both are closed, so every digit key
    // means one thing at a time. The inventory panel has no digit keys of
    // its own to fight over, so it does not need to join that guard.
    this.handleMenuToggleInput(controls);
    // The character screen lives beside the pack, so it goes when the pack does.
    if (!this.inventoryOpen) this.characterOpen = false;
    this.handleBuildMenuInput(controls);
    this.handleCraftMenuInput(controls);
    this.handleExpeditionBoardInput(controls);
    if (!this.buildMenuOpen && !this.craftMenuOpen && this.placing === null) {
      this.handleHotbarInput(controls);
    }

    // If the server never answers, let the player walk about on their own rather
    // than staring at a loading screen.
    if (
      import.meta.env.DEV &&
      this.clearingScene === null &&
      this.connectionState !== 'connected' &&
      now > this.offlineFallbackAt
    ) {
      void this.enterWorld(DEFAULT_WORLD_SEED);
    }

    this.updateTargetSelection(controls);
    if (this.collision !== null)
      this.collision.movementScale = this.currentWeather().kind === 'blizzard' ? BLIZZARD_SPEED : 1;
    this.waterWake.update(deltaSeconds);
    this.updateLocalPlayer(deltaSeconds, camera);
    const forestActive = this.playing && !document.hidden;
    this.forestAudio.update(forestActive);
    if (this.localPlayer !== null) {
      this.forestAtmosphere.update(
        deltaSeconds,
        {
          x: this.localCharacter?.group.position.x ?? this.localPlayer.motion.position.x,
          z: this.localCharacter?.group.position.z ?? this.localPlayer.motion.position.z,
          grounded: this.localPlayer.motion.grounded,
          y: this.localPlayer.motion.position.y,
          stridePhase: this.localCharacter?.stridePhase(),
          snow: seasonUniforms.snow.value > 0.5,
          frozenWater: this.lakeFrozen,
          threatened: performance.now() < this.ambienceDangerUntil,
          indoors: this.space !== OUTDOORS,
          active: forestActive,
          night: isNight(dayProgress(this.estimatedServerTimeMs())),
          precipitation: this.currentWeather().precipitation,
          cameraYaw: camera.look.yaw,
        },
        this.forestEnvironment,
      );
    }
    if (this.localPlayer !== null && this.space === OUTDOORS) {
      this.outdoorFocus.x = this.localPlayer.motion.position.x;
      this.outdoorFocus.z = this.localPlayer.motion.position.z;
    }
    this.wildernessScene?.update(deltaSeconds, this.outdoorFocus);
    if (this.localPlayer !== null && this.space === OUTDOORS)
      this.grass?.update(
        deltaSeconds,
        this.localPlayer.motion.position,
        this.reducedMotion.matches,
        this.currentWeather().wind,
      );
    this.updateRemotePlayers(deltaSeconds);
    this.groundItems?.update(deltaSeconds, this.reducedMotion.matches);
    for (let index = 0; index < waterRippleUniforms.length; index++) {
      const ripple = this.waterWake.ripples[index]!;
      waterRippleUniforms[index]!.value.set(ripple.x, ripple.z, ripple.age, ripple.strength);
    }
    // After everybody, ours included, has been placed: boats of those who stopped rowing go.
    this.rowingBoats.sweep();
    for (const [id, floating] of this.floatingBoats) {
      const group = this.builtMeshes.get(id)?.group;
      if (group === undefined || !group.visible) continue;
      const pose = floating.update(deltaSeconds, this.lakeFrozen);
      group.position.set(pose.x, pose.y, pose.z);
      group.rotation.y = pose.yaw;
      const previous = this.solidPlacedProps.get(id);
      if (previous !== undefined && this.collision !== null) {
        const solids = placedPropColliders({ kind: 'rowboat', ...pose }, pose.y);
        for (let index = 0; index < previous.length; index++) {
          const slot = this.collision.colliders.indexOf(previous[index]!);
          if (slot >= 0 && solids[index] !== undefined)
            replaceCollider(this.collision, slot, solids[index]!);
        }
        this.solidPlacedProps.set(id, solids);
      }
    }
    this.updateRemoteAnimals(deltaSeconds);
    const trackWeather = this.currentWeather().kind;
    this.freshAnimalTracks?.update(
      deltaSeconds,
      trackWeather === 'storm' || trackWeather === 'blizzard'
        ? 6
        : trackWeather === 'rain'
          ? 4
          : trackWeather === 'drizzle'
            ? 2
            : 1,
      seasonUniforms.snow.value > 0.5,
    );
    this.raiders.update(
      deltaSeconds,
      this.listenerPoint(),
      this.targeting.id ?? this.aimedRaiderId,
    );
    if (this.kingVictory) {
      const age = (now - this.kingVictory.startedAt) / 1000;
      if (age >= KING_VICTORY_SECONDS) this.clearKingVictory();
      else this.kingVictoryEffect?.update(age);
    }
    this.kingStormArt?.update(
      this.space === OUTDOORS ? this.kingStorm : null,
      now / 1000,
      this.reducedMotion.matches,
    );
    this.bursts.update(deltaSeconds);
    this.clearingScene?.update(deltaSeconds);
    for (const landing of [
      ...(this.clearingScene?.drainLandings() ?? []),
      ...(this.wildernessScene?.drainLandings() ?? []),
    ]) {
      this.showTreeLanding(landing, camera);
    }
    this.treeLandingEffects.update(deltaSeconds, camera.camera);
    this.wildfireArt?.update(
      deltaSeconds,
      camera.camera,
      this.space !== OUTDOORS,
      this.reducedMotion.matches,
    );
    this.floats.update(deltaSeconds, (netId) => this.anglerOf(netId));
    for (const model of this.decorModels) if ('update' in model) model.update(deltaSeconds);
    const weatherNow = this.estimatedServerTimeMs();
    const weather = this.currentWeather();
    if (this.localPlayer) {
      const point = this.space === OUTDOORS ? this.localPlayer.motion.position : this.outdoorFocus;
      this.ambienceCoverIn -= deltaSeconds;
      if (this.ambienceCoverIn <= 0) {
        this.ambienceCoverIn = 0.25;
        this.ambienceCover = Math.min(
          1,
          (this.forestEnvironment?.treesNear(point.x, point.z).length ?? 0) / 24,
        );
      }
      this.worldAmbience.update(
        deltaSeconds,
        {
          x: point.x,
          z: point.z,
          cameraYaw: camera.look.yaw,
          wind: weather.wind,
          cover: this.ambienceCover,
          indoors: this.space !== OUTDOORS,
          frozen: this.lakeFrozen,
          underground: this.undergroundDark,
          threatened: performance.now() < this.ambienceDangerUntil,
        },
        forestActive,
      );
    }
    advanceForestWind(deltaSeconds, weather.wind, this.reducedMotion.matches);
    this.weatherCloud +=
      (weather.precipitation - this.weatherCloud) * Math.min(1, deltaSeconds * 0.5);
    const season = seasonMix(this.currentCalendar());
    this.seasons.apply(season, this.daylight, weather.kind === 'blizzard');
    this.updateUnderground(deltaSeconds);
    const outdoorPosition = this.space === OUTDOORS ? this.localPlayer?.motion.position : undefined;
    this.daylight?.update(
      dayProgress(weatherNow),
      this.weatherCloud,
      weather.kind === 'blizzard',
      outdoorPosition === undefined ? 0 : highPlainsWeight(outdoorPosition.x, outdoorPosition.z),
      deltaSeconds,
    );
    const snow = seasonUniforms.snow.value > 0.5 && this.space === OUTDOORS;
    if (this.localPlayer !== null) {
      const motion = this.localPlayer.motion;
      this.footprints?.step(
        0,
        motion.position.x,
        motion.position.z,
        motion.facingYaw,
        motion.grounded,
        snow,
      );
    }
    this.footprints?.update(deltaSeconds, snow, weather.kind === 'blizzard');
    const watcher = this.localPlayer?.motion.position ?? { x: 0, z: 0 };
    this.weatherArt?.update(
      deltaSeconds,
      watcher,
      weatherNow,
      weather,
      this.space !== OUTDOORS,
      this.reducedMotion.matches,
      weather.kind === 'blizzard' ? 0 : rainShareFor(season),
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
    for (const [id, built] of this.builtMeshes) {
      if ('setLit' in built) built.setLit?.(this.fuelFireLit(id));
      if ('update' in built && typeof built.update === 'function') built.update(deltaSeconds);
      if ('setDaylight' in built && typeof built.setDaylight === 'function')
        built.setDaylight(dayBrightness(dayProgress(weatherNow)));
    }

    if (this.homeInterior !== null && this.space !== OUTDOORS) {
      this.homeInterior.setFireLit(this.fuelFireLit(this.space));
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
    // The world keeps its normal frame rate behind every in-game panel (pack,
    // character, chest, build menu, map, journal). Only the home screen, where
    // the world is hidden behind a painting, saves drawing work.
    if (this.playing || this.firstWorldFrame !== null || now - this.lastRenderedAt >= 1000) {
      if (this.warmEffectsOnNextFrame) {
        this.warmEffectsOnNextFrame = false;
        const flame = createFlame();
        if (flame) this.scene.add(flame.root);
        try {
          rehearseEffects(
            [
              this.treeLandingEffects.group,
              ...(this.kingVictoryEffect ? [this.kingVictoryEffect.group] : []),
              ...(this.kingStormArt ? [this.kingStormArt.group] : []),
              ...(this.wildfireArt ? [this.wildfireArt.group] : []),
              ...(flame ? [flame.root] : []),
            ],
            () => setup.renderer.render(this.scene, camera.camera),
          );
        } finally {
          flame?.dispose();
        }
        // Replace the rehearsal image before the loading curtain can disappear.
        setup.renderer.render(this.scene, camera.camera);
      } else setup.renderer.render(this.scene, camera.camera);
      this.lastRenderedAt = now;
      const drawnAt = performance.now();
      if (this.spaceTransition.afterRender(drawnAt, drawnAt - now)) {
        this.sceneFade?.classList.remove('scene-fade-dark', 'scene-fade-preparing');
        const arrival = this.sceneFade?.querySelector<HTMLElement>('.scene-arrival');
        if (arrival !== null && arrival !== undefined) arrival.hidden = true;
        this.syncGameplayControls();
      }
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

  private canTabTarget(): boolean {
    return (
      this.playing &&
      this.connectionState === 'connected' &&
      this.space === OUTDOORS &&
      this.localPlayer !== null &&
      this.localPlayer.action.kind !== ActionKind.KnockedOut &&
      !this.settingsOpen &&
      !this.chestOpen &&
      !(this.chestPending && !this.chestDismissed) &&
      !this.mapOpen &&
      !this.inventoryOpen &&
      !this.buildMenuOpen &&
      !this.craftMenuOpen &&
      this.placing === null
    );
  }

  /** Adapt the existing enemy registries; peaceful wildlife and players never enter this list. */
  private hostileTargets(): HostileTarget[] {
    if (this.space !== OUTDOORS) return [];
    const targets: HostileTarget[] = this.raiders.targets().flatMap((target) => {
      const about = this.raiders.describe(target.id);
      return about === null || about.hitsLeft <= 0
        ? []
        : [{ ...target, name: RAIDER_KINDS[about.kind].displayName }];
    });
    for (const id of this.remoteAnimals.netIds()) {
      const kind = animalKindOf(id);
      const pose = this.remoteAnimals.poseOf(id);
      // Animals use bit 3 for their defeated pose, independently of player action bytes.
      if (
        kind === null ||
        kind === undefined ||
        !('threat' in ANIMAL_KINDS[kind]) ||
        pose === undefined ||
        (pose.action & 8) !== 0
      )
        continue;
      targets.push({ id, x: pose.x, y: pose.y, z: pose.z, name: ANIMAL_KINDS[kind].displayName });
    }
    return targets;
  }

  private selectedTarget(): HostileTarget | null {
    const player = this.localPlayer;
    if (
      player === null ||
      player.action.kind === ActionKind.KnockedOut ||
      this.connectionState !== 'connected' ||
      this.space !== OUTDOORS
    ) {
      this.targeting.clear();
      return null;
    }
    if (this.targeting.id === null) return null;
    return this.targeting.update(player.motion.position, this.hostileTargets());
  }

  private updateTargetSelection(controls: Controls): void {
    this.selectedTarget();
    const cycles = controls.takeTargetCycles();
    const player = this.localPlayer;
    if (!this.canTabTarget() || player === null) return;
    for (const direction of cycles) {
      this.targeting.cycle(
        player.motion.position,
        player.motion.facingYaw,
        this.hostileTargets(),
        direction,
      );
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
    const selected = this.selectedTarget();
    feed.target = null;
    feed.showing = this.playing && !this.mapOpen && me !== null;
    feed.health = this.health / characterStats(this.worn.get(this.selfNetId) ?? {}).vitality;
    feed.cameraYaw = camera.look.yaw;
    if (!feed.showing || me === null) {
      feed.threats = [];
      return;
    }
    if (selected !== null) {
      const dx = selected.x - me.x;
      const dz = selected.z - me.z;
      const point = this.scratchProject
        .set(selected.x, selected.y + 1, selected.z)
        .project(camera.camera);
      feed.target = {
        bearing: wrapAngle(camera.look.yaw - Math.atan2(-dx, -dz)),
        screen:
          point.z > -1 && point.z < 1 && Math.abs(point.x) < 0.92 && Math.abs(point.y) < 0.9
            ? { x: (point.x + 1) / 2, y: (1 - point.y) / 2 }
            : null,
      };
    }
    const threats: ThreatMark[] = [];
    for (const marker of this.raiders.markers()) {
      const dx = marker.x - me.x;
      const dz = marker.z - me.z;
      const distance = Math.hypot(dx, dz);
      if (distance > THREAT_ARROWS_WITHIN) continue;
      if (marker.attacking && distance < 14) this.ambienceDangerUntil = performance.now() + 3500;
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
    const selected = this.selectedTarget();
    if (
      selected !== null &&
      Math.hypot(selected.x - position.x, selected.y - position.y, selected.z - position.z) <=
        SOFT_LOCK_RANGE
    ) {
      return yawTowards(position, selected);
    }
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

  /** Open or close the room's decorating panel from the HUD button. */
  toggleDecorations(): void {
    if (this.space === OUTDOORS || this.homeHere()?.yours !== true) return;
    this.showMenuPanel(this.buildMenuOpen ? null : 'decorations');
  }

  /** Number keys select decorations indoors or swap a placed piece outdoors. */
  private handleBuildMenuInput(controls: Controls): void {
    if (this.space !== OUTDOORS) {
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

    const ghost = createBuildGhost(
      createBuiltMesh(kind),
      buildableFootprint(kind, 0, 0, 0),
      (x, z) => this.collision!.terrain.heightAt(x, z),
    );
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
    if (
      this.placing === null ||
      steps === 0 ||
      this.placing === this.pendingDecorationPreview ||
      this.placing === this.pendingBuildPreview
    )
      return;
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
    if ((this.space !== OUTDOORS || this.decorMoveId !== 0) && isDecorationKind(request.kind)) {
      if (this.decorationFeedback.request !== null) return;
      const decoration = {
        ...request,
        kind: request.kind,
        id: this.decorMoveId,
        action:
          this.space === OUTDOORS
            ? ('moveOutdoor' as const)
            : this.decorMoveId === 0
              ? ('place' as const)
              : ('move' as const),
      };
      if (!this.submitAction('decorate', () => this.connection?.sendDecoration(decoration))) return;
      this.decorationFeedback.begin(decoration, performance.now());
      this.beginDecorationFeedback(placing);
      return;
    }
    if (this.buildFeedback.request !== null) return;
    if (!this.submitAction('build', () => this.connection?.sendBuild(request))) return;
    this.buildFeedback.begin(request, performance.now());
    this.pendingBuildPreview = placing;
    this.pendingPlacements = [{ request, sentAt: performance.now() }];
    this.interactionNote = null;
    this.interactionNoteUntil = 0;
    this.options.hud.publish({ interactionNote: this.pendingActionText(performance.now()) });
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

    if (this.decorationFeedback.request !== null && placing === this.pendingDecorationPreview)
      return;
    const submitted = this.buildFeedback.request;
    if (submitted !== null && placing === this.pendingBuildPreview) return;

    if (this.space !== OUTDOORS && isDecorationKind(placing.kind)) {
      const pending = this.decorationFeedback.request;
      if (pending !== null && placing === this.pendingDecorationPreview) {
        placing.ghost.show(pending.x, pending.z, pending.yaw, true, 0);
        return;
      }
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
      decorations: this.decorations,
      yaw: placing.yaw,
      mouse: this.groundUnderPointer(camera),
      player: player.motion.position,
      snap: !(this.controls?.isShiftHeld() ?? false),
      carrying:
        this.decorMoveId !== 0
          ? BUILDABLE_KINDS[placing.kind].costs.map((cost) => ({
              item: cost.item,
              count: cost.amount,
            }))
          : this.carrying,
      storedSupplies: this.homeStoredSupplies,
      built: this.builtProps.filter((prop) => prop.id !== this.decorMoveId),
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
  /**
   * Underground is dark (decision 0114): the deeper the local player is below
   * the ground above them, the more the daylight is shut out, eased in and out
   * so stepping into a tunnel mouth dims the world over a moment, not a frame.
   * A torch is what lights the way.
   */
  private updateUnderground(deltaSeconds: number): void {
    const motion = this.localPlayer?.motion;
    const depth =
      motion === undefined || this.space !== OUTDOORS
        ? 0
        : (this.digScene?.depthAt(motion.position.x, motion.position.z, motion.position.y) ?? 0);
    const target = Math.min(1, Math.max(0, (depth - 1.2) / 1.5));
    this.undergroundDark +=
      (target - this.undergroundDark) *
      Math.min(1, deltaSeconds * (target > this.undergroundDark ? 3 : 5));
    this.daylight?.setUnderground(this.undergroundDark);
  }

  private applyLakeIce(frozen: boolean): void {
    this.lakeFrozen = frozen;
    this.lakeScene?.setFrozen(frozen);
    this.streamScene?.setFrozen(frozen);
    if (frozen) this.waterWake.clear();
    if (this.collision !== null) setLakeFrozen(this.collision, frozen);
  }

  private openWaterAt(x: number, z: number): number | null {
    if (this.space !== OUTDOORS) return null;
    if (!this.lakeFrozen) {
      for (const slough of streamPools(STREAM)) {
        if (lakeDepthAt(slough, x, z) > 0) return sloughSurfaceAt(STREAM, slough, x, z);
      }
      if (isInStream(STREAM, x, z)) {
        const spot = nearestOnStream(STREAM, x, z, 6)!;
        return streamSurfaceAt(STREAM, spot.along);
      }
      if (lakeDepthAt(LAKE, x, z) > 0) return LAKE.level;
    }
    return this.clearing?.water.some(
      (circle) => Math.hypot(x - circle.x, z - circle.z) < circle.radius,
    )
      ? 0.03
      : null;
  }

  /** Where the foot of a built piece sits: on the ground, or for a boat on the lake's surface. */
  private builtGroundY(kind: BuildableKindId, x: number, z: number): number {
    return kind === 'rowboat'
      ? navigableWaterSurfaceAt(x, z)
      : (this.collision?.terrain.heightAt(x, z) ?? 0);
  }

  /**
   * Digging goes where the mouse is (decision 0114). While the shovel is out,
   * the cursor is cast into the world: the first wall, floor, roof or patch of
   * ground it touches gives the cube behind it. That cube is lit up (yellow, or
   * red where it cannot be dug or is out of reach) and sent to the server, which
   * digs exactly it when the swing lands, after checking it again.
   *
   * It does not change while a swing is under way, so what was clicked is what
   * lands.
   */
  private updateDigTarget(camera: FollowCamera, feet: Readonly<Vec3>): void {
    const dug = this.digScene;
    const collision = this.collision;
    const wanted =
      dug !== null && collision !== null && this.isEquipped('shovel') && this.space === OUTDOORS;
    if (!wanted) {
      this.showDigPreview(null, false);
      this.sendDigTarget(null);
      return;
    }
    if (this.localPlayer?.action.kind === ActionKind.Swing) return;
    const cube = this.cubeUnderPointer(camera, dug, collision.terrain);
    if (cube === null) {
      this.showDigPreview(null, false);
      this.sendDigTarget(null);
      return;
    }
    const refusal = digRefusal(
      cube,
      dug.grid,
      collision.terrain,
      (x, z, margin) => overlapsWater(this.keepOutWater, x, z, margin),
      this.builtProps,
    );
    if (refusal === null && dug.grid.solidCubes(cube).length === 0) {
      this.showDigPreview(null, false);
      this.sendDigTarget(null);
      return;
    }
    this.showDigPreview(cube, refusal === null && digInReach(feet, cube));
    this.sendDigTarget(cube);
  }

  /** The cube of ground behind whatever the mouse touches, or null if it touches none. */
  private cubeUnderPointer(camera: FollowCamera, dug: DigScene, terrain: Terrain): Dig | null {
    const surface = this.surfaceUnderPointer(camera, dug, terrain);
    return surface === null ? null : cubeAtHit(surface.point, surface.normal);
  }

  /**
   * Mine supports (decision 0119). While one is in hand, the cell of tunnel the
   * mouse is on lights up, green where a support would stand and red where
   * not, and a click asks the server to stand one there.
   */
  private updateSupportTarget(camera: FollowCamera, feet: Readonly<Vec3>): void {
    const dug = this.digScene;
    const collision = this.collision;
    const preview = this.supportPreview;
    const wanted =
      dug !== null &&
      collision !== null &&
      this.isEquipped('mineSupport') &&
      this.space === OUTDOORS &&
      preview !== null;
    if (!wanted) {
      preview?.show(null, 0, false);
      this.supportCell = null;
      this.supportHint = null;
      return;
    }
    const surface = this.surfaceUnderPointer(camera, dug, collision.terrain);
    const cell = surface === null ? null : supportCellAt(dug.grid, surface.point, surface.normal);
    if (cell === null) {
      preview.show(null, 0, false);
      this.supportCell = null;
      this.supportHint =
        'Point at the floor of a tunnel two metres wide, then click to prop it up.';
      return;
    }
    const fit = supportProblem(dug.grid, cell, this.supports);
    const where = 'axis' in fit ? fit.cell : cell;
    const reachable = supportInReach(feet, where, DIG_REACH_METERS);
    const fits = 'axis' in fit && reachable;
    preview.show(where, 'axis' in fit ? fit.axis : 0, fits);
    this.supportCell = fits ? where : null;
    this.supportHint =
      'problem' in fit
        ? supportProblemText(fit.problem)
        : reachable
          ? 'Click to stand a support here.'
          : 'Too far away. Step closer.';
  }

  /** A fresh press of the left button with a support in hand stands one where the preview is. */
  private clickToPlaceSupport(holdingSupport: boolean): void {
    const pressed =
      holdingSupport && ((this.controls?.buttons(false) ?? 0) & PlayerButton.Swing) !== 0;
    if (pressed && !this.supportClickHeld && this.supportCell !== null) {
      this.connection?.sendPlaceSupport(this.supportCell);
    }
    this.supportClickHeld = pressed;
  }

  /** What the mouse touches in the world and which way it faces, or null if it touches nothing. */
  private surfaceUnderPointer(
    camera: FollowCamera,
    dug: DigScene,
    terrain: Terrain,
  ): {
    point: { x: number; y: number; z: number };
    normal: { x: number; y: number; z: number };
  } | null {
    const pointer = this.controls?.pointerPosition() ?? null;
    if (pointer === null) return null;
    this.clickNdc.set(
      (pointer.x / window.innerWidth) * 2 - 1,
      -(pointer.y / window.innerHeight) * 2 + 1,
    );
    this.clickRaycaster.setFromCamera(this.clickNdc, camera.camera);
    const ray = this.clickRaycaster.ray;
    let point: { x: number; y: number; z: number } | null = null;
    let normal = { x: 0, y: 1, z: 0 };
    let distance = Number.POSITIVE_INFINITY;
    // The walls of a hole, and the ground cut round it...
    const hit = this.clickRaycaster.intersectObjects(dug.pickables(), false)[0];
    if (hit !== undefined && hit.face !== undefined && hit.face !== null) {
      point = hit.point;
      normal = hit.face.normal;
      distance = hit.distance;
    }
    // ...or plain ground, which a hole's own ground is cut out of.
    const ground = groundAlongRay(ray.origin, ray.direction, terrain);
    if (ground !== null && !dug.isOpenNear(ground.x, ground.z)) {
      const y = terrain.heightAt(ground.x, ground.z);
      const far = Math.hypot(ground.x - ray.origin.x, y - ray.origin.y, ground.z - ray.origin.z);
      if (far < distance) {
        const slopeX =
          terrain.heightAt(ground.x - 0.5, ground.z) - terrain.heightAt(ground.x + 0.5, ground.z);
        const slopeZ =
          terrain.heightAt(ground.x, ground.z - 0.5) - terrain.heightAt(ground.x, ground.z + 0.5);
        const length = Math.hypot(slopeX, 1, slopeZ);
        point = { x: ground.x, y, z: ground.z };
        normal = { x: slopeX / length, y: 1 / length, z: slopeZ / length };
      }
    }
    return point === null ? null : { point, normal };
  }

  /** Tell the server which cube the mouse is on, when it changes and about once a second. */
  private sendDigTarget(cube: Dig | null): void {
    const now = performance.now();
    const last = this.digTargetSent;
    const same =
      cube === null
        ? last === null
        : last !== null && last.ix === cube.ix && last.iy === cube.iy && last.iz === cube.iz;
    if (same && (cube === null || now - this.digTargetSentAt < 1000)) return;
    this.digTargetSent = cube === null ? null : { ix: cube.ix, iy: cube.iy, iz: cube.iz };
    this.digTargetSentAt = now;
    this.connection?.sendDigTarget(this.digTargetSent);
  }

  /** The faint box over the cube a click would dig: yellow if it can be, red if not. */
  private showDigPreview(cube: Dig | null, allowed: boolean): void {
    const preview = this.digPreview;
    if (cube === null) {
      if (preview !== null) preview.group.visible = false;
      return;
    }
    const lit = preview ?? this.makeDigPreview();
    if (lit.group.parent === null) this.outdoors.add(lit.group);
    lit.group.visible = true;
    // A cube is two half-metre cells each way, starting at its corner cell.
    lit.group.position.set((cube.ix + 1) * VOXEL, (cube.iy + 1) * VOXEL, (cube.iz + 1) * VOXEL);
    lit.fill.color.set(allowed ? 0xffd27a : 0xff5a4a);
    lit.edges.color.set(allowed ? 0xffe9b0 : 0xff8a7a);
  }

  private makeDigPreview(): NonNullable<Game['digPreview']> {
    const group = new THREE.Group();
    group.renderOrder = 10;
    const box = new THREE.BoxGeometry(1.02, 1.02, 1.02);
    const fill = new THREE.MeshBasicMaterial({
      color: 0xffd27a,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const edges = new THREE.LineBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.9 });
    group.add(
      new THREE.Mesh(box, fill),
      new THREE.LineSegments(new THREE.EdgesGeometry(box), edges),
    );
    this.digPreview = { group, fill, edges };
    return this.digPreview;
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
          this.placing?.kind === 'rowboat'
            ? (x, z) =>
                navigableWaterDepthAt(x, z) > 0
                  ? navigableWaterSurfaceAt(x, z)
                  : Number.NEGATIVE_INFINITY
            : undefined,
        );
  }

  /** Every tree, rock and stump, as the same footprints the server checks a build against. */
  private sceneryFootprints(): Footprint[] {
    return [
      ...this.treasures.map((spot) => roundFootprint(spot.x, spot.z, 0.7, 'buried treasure')),
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

  private chestWaitingText(now: number): string | null {
    if (!this.chestPending) return null;
    return now - this.chestPendingSince >= 8000
      ? 'Storage is still waiting for confirmation. Check your connection; items will not be sent twice.'
      : 'Waiting for storage confirmation…';
  }

  private pendingActionText(now: number): string | null {
    return (
      [
        this.chestOpen ? null : this.chestWaitingText(now),
        this.craftFeedback.text(now),
        this.decorationFeedback.text(now),
        this.buildFeedback.text(now),
      ]
        .filter((text) => text !== null)
        .join(' ') || null
    );
  }

  private beginDecorationFeedback(preview: Placing | null): void {
    this.pendingDecorationPreview = preview;
    this.decorNote = null;
    this.interactionNote = null;
    this.interactionNoteUntil = 0;
    this.options.hud.publish({
      decorationPending: true,
      decorNote: null,
      interactionNote: this.pendingActionText(performance.now()),
    });
  }

  private showActionNote(text: string): void {
    this.interactionNote = text;
    this.interactionNoteUntil = performance.now() + 3200;
    this.options.hud.publish({ interactionNote: text });
  }

  /** Submission is not confirmation: only server replies change items or buildings. */
  private submitAction(purpose: string, send: () => boolean | undefined): boolean {
    if (!this.playing) return false;
    if (this.connectionState !== 'connected' || send() !== true) {
      this.interactionNote = `Reconnect to ${purpose}.`;
      this.interactionNoteUntil = performance.now() + 3200;
      this.options.hud.publish({ interactionNote: this.interactionNote });
      return false;
    }
    if (this.interactionNote?.startsWith('Reconnect to ')) {
      this.interactionNote = null;
      this.interactionNoteUntil = 0;
      this.options.hud.publish({ interactionNote: null });
    }
    return true;
  }

  /** Publish journal feedback immediately so a stalled frame cannot swallow it. */
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
      nearTreasure: this.nearTreasure,
      nearbyDiscovery: this.nearbyDiscoveryName(),
      nearCampfire: this.nearCampfire,
      boat: this.space === OUTDOORS ? this.boatHint : null,
    };
  }

  /** The name of an unclaimed find within reach, outdoors, or null. */
  private nearbyDiscoveryName(): string | null {
    const player = this.localPlayer;
    if (this.space !== OUTDOORS || player === null) return null;
    const survey = surveyInteraction(
      this.expedition,
      player.motion.position,
      this.equipped.get(this.selfNetId) ?? null,
    );
    if (survey !== null) return survey.hint;
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
    this.showMenuPanel('journal');
    this.options.hud.publish({ journalTab: tab });
    if (tab === 'garden') this.connection?.sendGarden({ action: 'inspect' });
  }
  useFire(request: FireRequest): void {
    if (!this.connection?.sendFire(request)) this.showActionNote('Reconnect to tend the fire.');
  }
  private fuelRemaining(propId: number): number {
    const fire = this.fireFuelStates.get(propId);
    return fire === undefined
      ? 0
      : Math.max(
          0,
          fire.remainingMs - (fire.lit ? performance.now() - this.fireFuelReceivedAt : 0),
        );
  }
  private fuelFireLit(propId: number): boolean {
    const fire = this.fireFuelStates.get(propId);
    return fire
      ? fire.lit && this.fuelRemaining(propId) > 0
      : this.builtProps.find((prop) => prop.id === propId)?.lit === true;
  }
  private selectedLogStorage: number | null = null;
  closeLogStorage(): void {
    this.selectedLogStorage = null;
    this.options.hud.publish({ firePanel: null });
  }
  private firePanelState(): FirePanelState | null {
    const position = this.localPlayer?.motion.position;
    if (!position || !this.camera || this.localPlayer?.action.kind !== ActionKind.Idle) return null;
    let prop: BuiltPropView | undefined,
      mode: 'fire' | 'storage' = 'fire',
      point: { x: number; z: number } | null;
    if (this.space !== OUTDOORS) {
      this.selectedLogStorage = null;
      if (!homeFacilityInReach(this.currentHomeKind(), 'cooking', position)) return null;
      prop = this.builtProps.find((p) => p.id === this.space);
      const scale = homeRoomScale(this.currentHomeKind());
      point = { x: HOME_FACILITIES.cooking.x * scale, z: HOME_FACILITIES.cooking.z * scale };
    } else {
      prop = nearestCampfire(position, this.builtProps) ?? undefined;
      point = prop ?? null;
      const home = this.builtProps.find(
        (home) => home.id === this.selectedLogStorage && logStorageCapacity(home.kind) > 0,
      );
      if (home) {
        const spot = logStorageSpot(home);
        if (Math.hypot(position.x - spot.x, position.z - spot.z) <= 2) {
          prop = home;
          point = spot;
          mode = 'storage';
        } else this.selectedLogStorage = null;
      }
    }
    if (!prop || !point) return null;
    const y =
      this.space === OUTDOORS ? (this.collision?.terrain.heightAt(point.x, point.z) ?? 0) : 0;
    if (Math.abs(position.y - y) > 2.5) return null;
    this.scratchProject.set(point.x, y + 1.3, point.z).project(this.camera.camera);
    if (this.scratchProject.z < -1 || this.scratchProject.z > 1) return null;
    return {
      propId: prop.id,
      mode,
      lit: this.fuelFireLit(prop.id),
      remainingMs: this.fuelRemaining(prop.id),
      storedLogs: this.fireFuelStates.get(prop.id)?.storedLogs ?? 0,
      capacity: mode === 'fire' ? FIRE_CAPACITY_MS : logStorageCapacity(prop.kind),
      yours: prop.yours,
      x: Math.max(
        120,
        Math.min(innerWidth - 120, (this.scratchProject.x * 0.5 + 0.5) * innerWidth),
      ),
      y: Math.max(
        110,
        Math.min(innerHeight - 180, (-this.scratchProject.y * 0.5 + 0.5) * innerHeight),
      ),
    };
  }
  useGarden(request: GardenRequest): void {
    this.connection?.sendGarden(request);
  }

  /** Switch the Craft menu to another page: everything, or one kind of thing. */
  setCraftTab(tab: CraftTabId): void {
    this.craftTab = tab;
    this.options.hud.publish({ craftTab: tab });
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
    if (action.kind === 'build') {
      this.pickBuildable(action.buildable);
      return;
    }
    if (this.craftFeedback.item !== null) return;
    if (!this.submitAction('craft', () => this.connection?.sendCraft(action.item))) return;
    this.craftFeedback.begin(action.item, performance.now());
    this.interactionNote = null;
    this.interactionNoteUntil = 0;
    this.options.hud.publish({
      craftPending: action.item,
      interactionNote: this.pendingActionText(performance.now()),
    });
  }

  private updateDiscoveryMarkers(): void {
    this.mapFeed.discoveries = [
      { ...SKELETON_TOWN, name: 'Bonehollow · Skeleton town' },
      { ...CROWNBREAKER_HOLD, name: 'Crownbreaker Hold · World boss' },
      { ...KING_MUSTER, name: 'The Last Muster · Gather before the king' },
      ...this.discoverySites
        .filter((site) => discoveryKnown(this.discoveriesFound, site.id))
        .map((site) => ({ x: site.x, z: site.z, name: site.name })),
    ];
  }

  private handleCraftMenuInput(controls: Controls): void {
    if (!this.craftMenuOpen) return;
    const taps = controls.takeCraftTaps();
    if (this.journalTab !== 'craft') return;
    const entries = this.craftMenuEntriesShown();
    for (const index of taps) {
      const entry = entries[index];
      if (entry !== undefined && !entry.locked) this.pickCraftEntry(entry.action);
    }
  }

  /** Process menu presses in the order they happened, rather than frame-order priority. */
  private handleMenuToggleInput(controls: Controls): void {
    for (const toggle of controls.takeMenuToggles()) {
      if (toggle === 'escape') this.handleEscapeInput();
      else if (toggle === 'map') this.toggleMap();
      else if (toggle === 'pack') this.toggleInventory();
      else if (toggle === 'character') this.toggleCharacter();
      else this.showMenuPanel(this.craftMenuOpen ? null : 'journal');
    }
  }

  /**
   * Turn a hotbar slot picked this frame into a request to equip whatever
   * item is shown there - eating food only if already held, exactly as the
   * server's own `useItem` does. Only reached once neither menu is open, so
   * this never fires alongside a craft or a build off the very same key.
   * Resolved through `resolveHotbarSlots` so a key press always agrees with
   * whatever that same slot is showing on screen, pinned or not.
   */
  private handleHotbarInput(controls: Controls): void {
    const resolved = resolveHotbarSlots(
      this.carrying,
      this.options.hud.getSnapshot().hotbarSlots,
      this.worn.get(this.selfNetId)?.mainHand,
    );
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
          heightOffset: pickup.y,
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
    return lootUnderCursor(
      this.clickRaycaster,
      point,
      { width: window.innerWidth, height: window.innerHeight },
      camera.camera,
      candidates,
      [
        ...(this.wildernessScene === null ? [] : [this.wildernessScene.cameraGround]),
        this.clearingScene.cameraBlockers,
        ...(this.wildernessScene?.cameraBlockers ?? []),
        ...(this.digScene?.cameraBlockers ?? []),
        ...this.homeCameraBlockers,
      ],
      this.hoveredLoot?.request,
    );
  }

  /** Fit the E marker to rendered terrain; excavated floors use their shared floor height. */
  private gatheringGroundAt(x: number, z: number, referenceY: number): number {
    if (this.space !== OUTDOORS) return 0;
    const ground = this.wildernessScene?.cameraGround;
    if (ground !== undefined) {
      this.gatheringGroundRay.ray.origin.set(x, referenceY + 1, z);
      this.gatheringGroundRay.ray.direction.set(0, -1, 0);
      this.gatheringGroundRay.far = 2;
      this.gatheringGroundRay.firstHitOnly = true;
      ground.updateWorldMatrix(true, false);
      const hit = this.gatheringGroundRay.intersectObject(ground, false)[0];
      if (hit !== undefined)
        return this.lakeFrozen && this.collision !== null
          ? Math.max(hit.point.y, groundHeightAt(this.collision, x, z, referenceY))
          : hit.point.y;
    }
    return this.collision === null ? referenceY : groundHeightAt(this.collision, x, z, referenceY);
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
    if (!this.canReachGroundLoot(position, target, target.heightOffset))
      return 'Blocked by terrain · move around it';
    if (
      this.localPlayer !== null &&
      (!canBufferLoot(
        this.localPlayer.action,
        toolKind(this.equipped.get(this.selfNetId) ?? null) === 'shovel',
      ) ||
        this.fishingPhase !== null)
    )
      return 'Finish your current action first';
    const pack = inventoryFromEntries(this.carrying);
    const kind = ITEM_KINDS[target.item];
    const owned =
      (pack[target.item] ?? 0) +
      Object.values(this.worn.get(this.selfNetId) ?? {}).filter((item) => item === target.item)
        .length;
    if (kind.maxCarry !== undefined && owned >= kind.maxCarry)
      return `You already own the maximum number of ${kind.pluralName.toLowerCase()}`;
    if (roomFor(pack, target.item) === 0 && isPack(target.item))
      return `Maximum inventory capacity reached · ${MAX_PACK_SLOTS} slots`;
    if (roomFor(pack, target.item) === 0)
      return kind.maxCarry === 1 &&
        this.carrying.some((entry) => entry.item === target.item && entry.count > 0)
        ? `You can only carry one ${kind.displayName.toLowerCase()}`
        : 'Pack full · make room in your pack';
    return null;
  }

  private canReachGroundLoot(
    position: Readonly<Vec3>,
    target: { x: number; z: number },
    heightOffset = 0,
  ): boolean {
    return (
      this.collision !== null && groundItemReachable(this.collision, position, target, heightOffset)
    );
  }

  private selectedPlacedObject: { id: number; indoor: boolean } | null = null;
  private openPlacedObject(point: { x: number; y: number }, camera: FollowCamera): boolean {
    this.clickNdc.set(
      (point.x / window.innerWidth) * 2 - 1,
      (-point.y / window.innerHeight) * 2 + 1,
    );
    this.clickRaycaster.setFromCamera(this.clickNdc, camera.camera);
    const indoor = this.space !== OUTDOORS;
    const roots = indoor
      ? this.decorModels.map((model) => model.group)
      : [...this.builtMeshes.values()].map((model) => model.group);
    for (const root of roots) root.updateWorldMatrix(true, true);
    const hits = this.clickRaycaster.intersectObjects(roots, true).filter((hit) => {
      for (let object: THREE.Object3D | null = hit.object; object; object = object.parent)
        if (!object.visible) return false;
      return true;
    });
    const hit = hits[0];
    if (!hit) return false;
    let id: number | undefined;
    let storageHit = false;
    for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) {
      if (!indoor && object.userData.logStorage === true) storageHit = true;
      if (indoor && typeof object.userData.decorationId === 'number') {
        id = object.userData.decorationId;
        break;
      }
      if (!indoor)
        for (const [key, model] of this.builtMeshes) if (model.group === object) id = key;
    }
    const piece = indoor
      ? this.decorations.find((piece) => piece.id === id && piece.homeId === this.space)
      : this.builtProps.find((piece) => piece.id === id);
    if (!piece || id === undefined) return false;
    if (storageHit && !indoor && logStorageCapacity(piece.kind) > 0) {
      const spot = logStorageSpot(piece);
      if (Math.hypot(spot.x - this.motionOrOrigin().x, spot.z - this.motionOrOrigin().z) > 2) {
        this.showActionNote('Move closer to use the log shelf.');
        return true;
      }
      this.selectedLogStorage = id;
      this.options.hud.publish({ placedObject: null, firePanel: this.firePanelState() });
      return true;
    }
    this.closeLogStorage();
    if (Math.hypot(piece.x - this.motionOrOrigin().x, piece.z - this.motionOrOrigin().z) > 6) {
      this.showActionNote('Move closer to manage this object.');
      return true;
    }
    this.selectedPlacedObject = { id, indoor };
    const yours = indoor
      ? this.homeHere()?.yours === true
      : this.builtProps.find((prop) => prop.id === id)?.yours === true;
    this.options.hud.publish({
      placedObject: {
        id,
        kind: piece.kind,
        yours,
        indoor,
        home: isHomeKind(piece.kind),
        canMove: isDecorationKind(piece.kind),
        refund:
          placedObjectRefund(piece.kind)
            .map((cost) => `${cost.amount} ${ITEM_KINDS[cost.item].displayName.toLowerCase()}`)
            .join(', ') || 'No materials',
      },
    });
    return true;
  }
  placedObjectAction(action: 'close' | 'move' | 'reclaim'): void {
    const selected = this.selectedPlacedObject;
    this.options.hud.publish({ placedObject: null });
    this.selectedPlacedObject = null;
    if (!selected || action === 'close' || this.decorationFeedback.request !== null) return;
    if (selected.indoor) {
      if (action === 'move') this.moveDecoration(selected.id);
      else this.reclaimDecoration(selected.id);
      return;
    }
    const prop = this.builtProps.find((prop) => prop.id === selected.id && prop.yours);
    if (!prop) return;
    if (action === 'move') {
      if (!isDecorationKind(prop.kind)) return;
      this.startPlacing(prop.kind);
      this.decorMoveId = prop.id;
      if (this.placing !== null) this.placing.yaw = prop.yaw;
    } else {
      const request = { ...prop, action: 'reclaimOutdoor' as const };
      if (!this.submitAction('pack up this object', () => this.connection?.sendDecoration(request)))
        return;
      this.decorationFeedback.begin(request, performance.now());
      this.beginDecorationFeedback(null);
    }
  }

  private lootAt(point: { x: number; y: number }, camera: FollowCamera): void {
    const target = this.lootTargetAt(point, camera);
    if (target === null) return;
    const problem = this.lootProblem(target);
    if (problem !== null) {
      this.showActionNote(problem);
      return;
    }
    this.aimYaw = yawTowards(this.motionOrOrigin(), target);
    this.submitAction('pick up this item', () => this.connection?.sendLoot(target.request));
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
      camera.update(
        from,
        0,
        [
          ...wilderness.cameraBlockers,
          clearing.cameraBlockers,
          ...(this.digScene?.cameraBlockers ?? []),
          ...this.homeCameraBlockers,
        ],
        this.space === OUTDOORS ? wilderness.cameraGround : null,
        this.space === OUTDOORS && (this.localPlayer?.motion.grounded ?? false),
      );
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
  private currentWeather() {
    const weather = forestWeather(
      this.weatherSeed,
      this.estimatedServerTimeMs(),
      this.currentCalendar(),
    );
    const forced = this.wildfireState.testWeather;
    return forced == null
      ? weather
      : { ...weather, kind: forced, precipitation: 1, wind: forced === 'blizzard' ? 1.6 : 0.85 };
  }

  private currentCalendar(): Calendar {
    const now = this.estimatedServerTimeMs();
    if (this.wildfireState.testWeather) {
      const season = this.wildfireState.testWeather === 'blizzard' ? 'winter' : 'summer';
      return calendarAt(this.weatherSeed, now + clockShiftForSeason(this.weatherSeed, now, season));
    }
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

    const connected = this.selfNetId === 0 || this.connectionState === 'connected';
    const intent = connected ? (this.controls?.moveIntent() ?? { x: 0, z: 0 }) : { x: 0, z: 0 };
    // While the float is under on this screen, every input says so: the server
    // counts the time to click from the first of them, so a slow connection
    // does not shorten it.
    // The left button places a piece while one is out, so it is never also
    // a swing or a charge then.
    const holdingSupport = this.isEquipped('mineSupport');
    const placingMask =
      this.placing === null && !holdingSupport
        ? ~0
        : ~(PlayerButton.Swing | PlayerButton.Charge | PlayerButton.Fish | PlayerButton.Sit);
    const fishingClick =
      this.fishingPhase !== null ||
      this.actionContext(player.motion.position, this.aimYaw ?? player.motion.facingYaw)
        .castInstead;
    const buttons =
      ((this.controls?.buttons(fishingClick) ?? 0) & placingMask) |
      (this.fishingPhase === 'biting' ? PlayerButton.SawBite : 0);
    this.updateDigTarget(camera, player.motion.position);
    this.updateSupportTarget(camera, player.motion.position);
    this.clickToPlaceSupport(holdingSupport);
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

    const produced = connected
      ? player.advance(deltaSeconds, intent.x, intent.z, camera.look.yaw, buttons, this.aimYaw)
      : [];
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
      this.isEquipped('shovel'),
    );
    this.ownSwoosh.update(move);
    character.setEquippedItem(this.equipped.get(this.selfNetId) ?? null);
    character.setFishing(this.fishingPoses.get(this.selfNetId) ?? null);
    const rowing = action.kind === ActionKind.Row;
    character.setRestSpot(
      rowing
        ? boatSeatAt(position.x, position.z, player.renderYaw())
        : restSpotFor(action.kind, action.step, this.space, this.currentHomeKind(), {
            pieces: this.builtProps,
            position: player.motion.position,
            heightAt: (x, z) => this.collision?.terrain.heightAt(x, z) ?? 0,
          }),
    );
    const speed = Math.hypot(velocity.x, velocity.z);
    const travelSpeed = player.travelSpeed();
    this.waterWake.step(
      this.selfNetId,
      position.x,
      position.y,
      position.z,
      rowing ? 0 : travelSpeed,
      this.openWaterAt(position.x, position.z),
    );
    if (rowing) this.rowingBoats.place(this.selfNetId, position.x, position.z, player.renderYaw());
    const pose = character.update(deltaSeconds, {
      move,
      ...(rowing ? { rowingSpeed: speed } : {}),
      // Seated, so the legs never walk while the boat carries them along.
      locomotion: { speed: rowing ? 0 : travelSpeed, airborne: !player.motion.grounded && !rowing },
      groundHeight: this.characterGroundHeight,
    });
    this.sweepTrail(this.selfNetId, character, pose, deltaSeconds);
    this.showKnockout(action.kind, action.age);

    camera.update(
      position,
      deltaSeconds,
      this.space === OUTDOORS
        ? [
            ...wilderness.cameraBlockers,
            clearing.cameraBlockers,
            ...(this.digScene?.cameraBlockers ?? []),
            ...this.homeCameraBlockers,
          ]
        : [],
      this.space === OUTDOORS ? wilderness.cameraGround : null,
      this.space === OUTDOORS && player.motion.grounded && !rowing,
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
      this.nearTreasure = null;
      this.ownCacheCompass = null;
      this.nearCampfire = homeFacilityInReach(
        this.currentHomeKind(),
        'cooking',
        player.motion.position,
      )
        ? this.fuelFireLit(this.space)
          ? 'lit'
          : 'unlit'
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

    this.restingNearby = null;
    if (isFreeToInteract(action) && player.motion.grounded) {
      const heightAt = (x: number, z: number) => this.collision?.terrain.heightAt(x, z) ?? 0;
      const nearby = outdoorSeatInReach(this.builtProps, player.motion.position, heightAt);
      if (nearby) {
        const free = outdoorSeatInReach(
          this.builtProps,
          player.motion.position,
          heightAt,
          (seat) =>
            !this.remotePlayers.netIds().some((id) => {
              const pose = this.remotePlayers.poseOf(id);
              if (!pose) return false;
              const move = unpackActionByte(pose.action, this.remoteAction);
              return (
                (move.kind === ActionKind.Sit ||
                  (move.kind === ActionKind.Rise && move.step === RiseFrom.Chair)) &&
                Math.hypot(pose.x - seat.stand.x, pose.z - seat.stand.z) < 0.4
              );
            }),
        );
        this.restingNearby = free ? 'bench' : 'benchFull';
      }
    }
    this.nearWorkbench =
      nearestHomesteadPiece(this.builtProps, 'trailWorkbench', player.motion.position) !== null;
    this.nearGarden =
      nearestHomesteadPiece(this.builtProps, 'kitchenGarden', player.motion.position) !== null;
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
      this.hoveredChest =
        overWorld &&
        pointer !== null &&
        this.playing &&
        !this.controls?.isPointerLocked &&
        !this.inventoryOpen &&
        !this.mapOpen &&
        !this.craftMenuOpen &&
        !this.buildMenuOpen &&
        !this.chestOpen &&
        this.placing === null &&
        this.chestAt(pointer, camera);
      this.hoveredTrophy =
        overWorld &&
        pointer !== null &&
        this.playing &&
        !this.controls?.isPointerLocked &&
        !this.inventoryOpen &&
        !this.mapOpen &&
        !this.craftMenuOpen &&
        !this.buildMenuOpen &&
        !this.chestOpen &&
        this.placing === null &&
        this.hoveredLoot === null &&
        !this.hoveredChest
          ? (this.builtProps
              .filter(
                (prop) =>
                  isKeepsake(prop.kind) &&
                  Math.hypot(
                    prop.x - player.motion.position.x,
                    prop.z - player.motion.position.z,
                  ) <= 5,
              )
              .sort(
                (a, b) =>
                  Math.hypot(a.x - position.x, a.z - position.z) -
                    Math.hypot(b.x - position.x, b.z - position.z) || a.id - b.id,
              )
              .slice(0, 8)
              .find((prop) => this.outdoorBuiltHit(pointer, camera, prop.id)) ?? null)
          : null;
      this.options.canvas.style.cursor =
        this.hoveredLoot === null && !this.hoveredChest ? '' : 'pointer';
    }
    // Only a hint. The server decides who actually gets it.
    const reachable =
      this.clearing === null
        ? null
        : pickupInReach(
            player.motion.position,
            this.clearing.pickups,
            (id) => this.takenPickups.has(id),
            (pickup) => this.canReachGroundLoot(player.motion.position, pickup, pickup.y),
          );
    this.nearbyItem = reachable?.item ?? null;

    const pile = droppedPileInReach(player.motion.position, this.droppedPiles, (pile) =>
      this.canReachGroundLoot(player.motion.position, pile),
    );
    this.nearbyPile = pile === null ? null : { item: pile.item, count: pile.count };

    const patch = gatherSpotInReach(player.motion.position, this.gatherPatches, (patch) =>
      this.canReachGroundLoot(player.motion.position, patch),
    );
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
      isFreeToInteract(action) &&
        this.nearbyDiscoveryName() === null &&
        this.playing &&
        !this.inventoryOpen &&
        !this.mapOpen &&
        !this.settingsOpen &&
        !this.chestOpen &&
        !this.craftMenuOpen &&
        !this.buildMenuOpen &&
        this.placing === null
        ? gatherObject
        : null,
      pile !== null && reachable === null ? 0.6 : 0.28,
      blocked,
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
    const nearbyTreasure = nearestTreasure(
      player.motion.position,
      this.treasures,
      (spot) =>
        this.collision !== null &&
        groundItemReachable(this.collision, player.motion.position, spot),
    );
    this.nearTreasure =
      nearbyTreasure === null
        ? null
        : this.equipped.get(this.selfNetId) === 'shovel'
          ? 'shovel'
          : 'needsShovel';
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
    this.nearCampfire =
      nearbyCampfire === null ? null : this.fuelFireLit(nearbyCampfire.id) ? 'lit' : 'unlit';
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
    centreDaylightShadow(sun, position);
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
    this.ownSwoosh.clear();
    const player = this.localPlayer;
    if (player === null) return;
    const inside = space !== OUTDOORS;
    const changed = space !== this.space;
    if (changed) this.closeChest();
    this.space = space;
    // Also covers signing in directly inside a far-away home: its outdoor
    // trees should be prepared around the doorstep, not the clearing origin.
    if (changed && inside) {
      const home = this.builtProps.find((prop) => prop.id === space);
      if (home !== undefined) {
        const doorway = cabinDoorway(home);
        this.outdoorFocus.x = doorway.x;
        this.outdoorFocus.z = doorway.z;
      }
    }
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
      this.clearRemoteActors();
      this.targeting.clear();
      this.stopPlacing();
      this.buildMenuOpen = false;
      this.aimYaw = null;
    }
    // A same-space correction must not restart a door transition.
    if (changed && !this.enteringWorld) this.liftFade(inside);
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
      // Left behind by a deleted character: nobody can climb in.
      if (prop.locked === true) continue;
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

  /** Keep the destination covered until its actual draws have settled. */
  private liftFade(inside: boolean): void {
    const fade = this.sceneFade;
    if (fade === null) return;
    this.fadeGiveUpAt = null;
    this.spaceTransition.begin(performance.now());
    this.syncGameplayControls();
    const arrival = fade.querySelector<HTMLElement>('.scene-arrival');
    if (arrival !== null) {
      arrival.textContent = inside ? 'Entering your home…' : 'Stepping outside…';
      arrival.hidden = false;
    }
    fade.classList.add('scene-fade-preparing');
    if (!fade.classList.contains('scene-fade-dark')) {
      fade.classList.add('scene-fade-instant', 'scene-fade-dark');
      void fade.offsetWidth;
      fade.classList.remove('scene-fade-instant');
    }
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
      digging: canAttack && toolKind(held) === 'shovel',
      // Anywhere there is ground underfoot; the line in hand is the one thing
      // that rules it out (see decision 0102). Standing on something is
      // checked by the caller, which knows the footing.
      canSit: this.fishingPhase === null,
      dodgeCooldown: equipmentDodgeCooldown(
        this.worn.get(this.selfNetId) ?? {},
        mealCooldown(this.currentMeal(), DODGE.cooldown, 'trailRation'),
      ),
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
    const awaitingRescue = this.allies.some(
      (ally) => ally.netId === this.selfNetId && ally.downTicks > 0,
    );
    if (
      kind === ActionKind.KnockedOut &&
      !awaitingRescue &&
      age >= KNOCKOUT_DARKENS_AT_TICKS &&
      !this.knockoutDark
    ) {
      this.knockoutDark = true;
      fade.classList.add('scene-fade-slow', 'scene-fade-dark');
    } else if (kind !== ActionKind.KnockedOut && this.knockoutDark) {
      this.knockoutDark = false;
      if (!this.spaceTransition.active) fade.classList.remove('scene-fade-dark');
      window.setTimeout(() => fade.classList.remove('scene-fade-slow'), 900);
    }
  }

  private showCollection(event: CollectedEvent): void {
    const listener = this.listenerPoint();
    if (listener === null) return;
    const distance = Math.hypot(listener.x - event.x, listener.z - event.z);
    const volume = event.netId === this.selfNetId ? 1 : Math.max(0, 1 - distance / 12) ** 2 * 0.45;
    playCollection(event.item, event.depleted, volume);
    if (this.space === OUTDOORS && distance < 24 && isPickedPlant(event.item)) {
      const character =
        event.netId === this.selfNetId
          ? this.localCharacter
          : this.remoteCharacters.get(event.netId);
      const y = this.collision?.terrain.heightAt(event.x, event.z) ?? 0;
      const target =
        this.groundItems?.collect(event, (into) => character?.handPosition(into) ?? null) ??
        new THREE.Vector3(
          event.x,
          y + (event.item === 'reed' ? 0.55 : event.item === 'flower' ? 0.3 : 0.12),
          event.z,
        );
      character?.reachForCollection(target);
    }

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
      else if (event.kind === 'began' && event.action === ActionKind.Strike) {
        this.whirlwindHits.clear();
        this.whirlwindTrees.clear();
      } else if (event.kind === 'impact') this.showOwnBlow(event.impact, event);
    }
  }

  /**
   * One of our own blows landing, on whatever our browser thinks is in
   * reach - the same way the server picks it: an axe bites a tree first,
   * and anything in hand strikes an animal. A jolt, a pause on the moment,
   * the sound and the chips or fur of it, straight away, the way it feels to
   * swing. The server's word follows and settles what it actually did.
   */
  private showOwnBlow(impact: Impact, event: Extract<PredictedEvent, { kind: 'impact' }>): void {
    const player = this.localPlayer;
    if (player === null) return;
    const strike = impact.kind === 'strike';
    const from = event.position;
    const aimYaw = this.aimYaw ?? event.yaw;
    const strength = strike ? CHARGED_BLOW * (impact.dodge ? 1.35 : 1) : impact.dodge ? 1.4 : 1;
    if (strike && impact.dodge) this.showSlam(1.5);
    if (strike && !impact.dodge) {
      this.showOwnWhirlwind(
        from,
        strength,
        impact.sweep === undefined
          ? undefined
          : { age: impact.sweep, yaw: event.yaw, previousYaw: event.previousYaw },
      );
      return;
    }
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

  /** Predict the same moving weapon arcs as the server, once per target for the whole attack. */
  private showOwnWhirlwind(from: Readonly<Vec3>, strength: number, sweep?: WhirlwindSweep): void {
    const raiders = whirlwindTargets(from, this.raiders.targets(), sweep, this.whirlwindHits);
    let landed = false;
    for (const raider of raiders) {
      this.whirlwindHits.add(raider.id);
      landed = this.raiders.predictBlow(raider.id, from, false, true) !== 'missed' || landed;
    }
    const animals = whirlwindTargets(
      from,
      this.remoteAnimals.netIds().flatMap((id) => {
        const pose = this.remoteAnimals.poseOf(id);
        const kind = animalKindOf(id);
        return pose === undefined ||
          kind === undefined ||
          kind === 'curiousRaccoon' ||
          (pose.action & 8) !== 0
          ? []
          : [{ id, x: pose.x, y: pose.y, z: pose.z }];
      }),
      sweep,
      this.whirlwindHits,
    );
    for (const animal of animals) {
      this.whirlwindHits.add(animal.id);
      this.showBlowOnAnimal(animal.id, from, strength);
    }
    if (animals.length > 0) {
      playThreatHit();
      landed = true;
    }
    if (this.isEquipped('axe') && sweep !== undefined) {
      const trees = treesInWhirlwind(
        from,
        sweep.yaw,
        sweep.age,
        this.standingProps,
        (id) => this.isFelled(id),
        this.whirlwindTrees,
        sweep.previousYaw,
      );
      for (const tree of trees) {
        this.whirlwindTrees.add(tree.prop.id);
        this.showBlowOnTree(tree.prop, from, strength);
      }
      if (trees.length > 0) {
        playTreeHit();
        landed = true;
      }
    }
    if (landed) {
      // Keep the follow-through flowing even when several creatures were hit.
      this.localCharacter?.hitStop(0.035);
      this.camera?.shake(HIT_LANDED_SHAKE * 1.3);
    }
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

  /** An aerial dodge slam coming down: dust thrown up where it hits the ground. */
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

  /** A new connection or space has no useful actor history from the old one. */
  private clearRemoteActors(): void {
    this.groundItems?.clearHarvesting();
    this.freshAnimalTracks?.clear();
    this.localCharacter?.reachForCollection(null);
    this.clearKingStorm();
    this.clearKingVictory();
    for (const id of this.remotePlayers.netIds()) this.removeRemote(id);
    for (const id of this.remoteAnimals.netIds()) this.removeCritter(id);
    this.remotePlayers.clear();
    this.remoteAnimals.clear();
    this.raiders.clear();
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
        toolKind(this.equipped.get(netId) ?? null) === 'shovel',
      );
      character.setFishing(this.fishingPoses.get(netId) ?? null);
      const rowing = action.kind === ActionKind.Row;
      this.waterWake.step(
        netId,
        pose.x,
        pose.y,
        pose.z,
        rowing ? 0 : pose.travelSpeed,
        this.openWaterAt(pose.x, pose.z),
      );
      this.footprints?.step(
        netId + 1,
        pose.x,
        pose.z,
        pose.yaw,
        !pose.airborne && !rowing,
        this.space === OUTDOORS && seasonUniforms.snow.value > 0.5,
      );
      character.setRestSpot(
        rowing
          ? boatSeatAt(pose.x, pose.z, pose.yaw)
          : restSpotFor(action.kind, action.step, this.space, this.currentHomeKind(), {
              pieces: this.builtProps,
              position: pose,
              heightAt: (x, z) => this.collision?.terrain.heightAt(x, z) ?? 0,
            }),
      );
      if (rowing) this.rowingBoats.place(netId, pose.x, pose.z, pose.yaw);
      const drawn = character.update(deltaSeconds, {
        move,
        ...(rowing ? { rowingSpeed: pose.speed } : {}),
        locomotion: { speed: rowing ? 0 : pose.travelSpeed, airborne: pose.airborne && !rowing },
        groundHeight: this.characterGroundHeight,
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
          speed: pose.action & 8 ? 0 : pose.travelSpeed,
          alert: (pose.action & 4) !== 0,
          windup: (pose.action & 3) === 1,
          attacking: (pose.action & 3) === 2 && pose.actionAge < 5,
          recovering: (pose.action & 3) === 2 && pose.actionAge >= 5,
          groundHeight: this.creatureGroundHeight,
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
      characterOpen: this.characterOpen && this.inventoryOpen,
      equippedItem: this.equipped.get(this.selfNetId) ?? null,
      nearbyItem: this.nearbyItem,
      hoveredLoot:
        this.hoveredChest && !this.chestOpen
          ? {
              name: this.space === OUTDOORS ? 'Trail pantry' : 'Storage chest',
              count: 0,
              detail: this.chestHoverDetail(),
              x: this.controls?.pointerPosition()?.x ?? 0,
              y: this.controls?.pointerPosition()?.y ?? 0,
            }
          : this.space === OUTDOORS &&
              this.hoveredTrophy !== null &&
              this.playing &&
              !this.inventoryOpen &&
              !this.mapOpen &&
              !this.craftMenuOpen &&
              !this.buildMenuOpen &&
              this.placing === null &&
              !this.controls?.isPointerLocked
            ? {
                name: BUILDABLE_KINDS[this.hoveredTrophy.kind].displayName,
                count: 0,
                detail: `${this.hoveredTrophy.yours ? 'Your keepsake' : 'A neighbor’s keepsake'} · ${KEEPSAKES.find((entry) => entry.kind === this.hoveredTrophy!.kind)?.story ?? ''}`,
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
      firePanel: this.firePanelState(),
      ...(this.chestPending && this.chestOpen ? { chestNote: this.chestWaitingText(now) } : {}),
      craftPending: this.craftFeedback.item,
      interactionNote:
        now < this.interactionNoteUntil
          ? this.interactionNote
          : (this.pendingActionText(now) ?? this.supportHint),
      nearbyPile: this.nearbyPile,
      nearGatherSpot: this.nearGatherSpot,
      nearBuriedCache: this.nearBuriedCache,
      nearTreasure: this.nearTreasure,
      ownCacheCompass: this.ownCacheCompass,
      nearCampfire: this.nearCampfire,
      nearWorkbench: this.nearWorkbench,
      nearGarden: this.nearGarden,
      garden: this.garden,
      aimedTree: this.aimedTree,
      aimedAnimal: this.aimedAnimal,
      aimedRaider: this.aimedRaider,
      raidersInSight:
        this.space === OUTDOORS
          ? this.raiders
              .markers()
              .filter((marker) => this.raiders.describe(marker.id)?.kind !== 'hollowKing').length
          : 0,
      allies:
        this.space === OUTDOORS
          ? this.allies.map((ally) => ({
              ...ally,
              name: this.roster.get(ally.netId)?.name ?? 'Adventurer',
              self: ally.netId === this.selfNetId,
            }))
          : [],
      strongholdApproach:
        this.space === OUTDOORS && player !== null
          ? kingsRoadBeat(player.motion.position.x, player.motion.position.z)
          : null,
      worldBoss:
        this.space === OUTDOORS && player !== null
          ? this.raiders.worldBossNear(player.motion.position)
          : null,
      raidersClose: this.raidersClose,
      kingStorm: this.space === OUTDOORS ? this.kingStorm : null,
      kingWard: this.nearestKingWard(),
      kingVictory: this.kingVictory,
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
              const fresh = this.freshAnimalTracks?.hintAt(
                player.motion.position.x,
                player.motion.position.z,
              );
              if (fresh) return fresh;
              const habitat = forageHabitatHint(
                this.gatherPatches,
                player.motion.position.x,
                player.motion.position.z,
              );
              if (habitat) return habitat;
              const track = this.animalTracks?.tracks.find(
                (track) =>
                  Math.hypot(
                    player.motion.position.x - track.x,
                    player.motion.position.z - track.z,
                  ) < 2.2,
              );
              const flush = mushroomFlushHint(
                this.gatherPatches,
                player.motion.position.x,
                player.motion.position.z,
              );
              if (flush) return flush;
              return track === undefined
                ? discoveryLeadHint(
                    this.discoveryLeads,
                    player.motion.position.x,
                    player.motion.position.z,
                    this.discoveriesFound,
                  )
                : woodlandTrackHint(track.kind);
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
      trophyDisplays: [
        ...this.builtProps
          .filter((prop) => prop.yours && isKeepsake(prop.kind))
          .map((prop) => prop.kind),
        ...this.decorations
          .filter((piece) => this.builtProps.some((home) => home.id === piece.homeId && home.yours))
          .map((piece) => piece.kind)
          .filter(isKeepsake),
      ],
      homesteadProjects: this.builtProps
        .filter((prop) => prop.yours)
        .map((prop) => prop.kind)
        .filter(isHomesteadProject),
      homeKind: (() => {
        const kind = this.builtProps.find((prop) => prop.yours && isHomeKind(prop.kind))?.kind;
        return kind !== undefined && isHomeKind(kind) ? kind : null;
      })(),
      placing:
        this.placing === null
          ? null
          : {
              pending:
                (this.placing === this.pendingDecorationPreview &&
                  this.decorationFeedback.request !== null) ||
                (this.placing === this.pendingBuildPreview && this.buildFeedback.request !== null),
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
      forestWeather: this.currentWeather(),
      season: this.currentCalendar(),
      mapOpen: this.mapOpen,
      door: this.doorHint,
      home: this.homeHere(),
      decorationPending: this.decorationFeedback.request !== null,
      decorations: this.decorations.filter((piece) => piece.homeId === this.space),
      decorNote: this.decorNote,
      resting: this.restingNow(),
      boat: this.space === OUTDOORS ? this.boatHint : null,
      restingNearby: this.restingNearby,
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
