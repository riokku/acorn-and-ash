import { DAYS_PER_SEASON, fishDisplayLearned, fishRecordsFromSaved } from '@acorn/shared';
import { FishingJournal, RareReelHint } from './FishingJournal';
import { ExpeditionPanel } from './ExpeditionPanel';
import type { ExpeditionRequest } from '@acorn/shared';
import { DECORATION_KINDS } from '@acorn/shared';
import { MEAL_BENEFITS, TICK_HZ } from '@acorn/shared';
import { DiscoveryJournal, JournalTabs } from './DiscoveryJournal';
import { GardenJournal } from './GardenJournal';
import type { GardenRequest } from '@acorn/shared';
import { isHomeKind, toolKind } from '@acorn/shared';
import { PickupNotice } from './PickupNotice';
import {
  CRAFT_GROUPS,
  CRAFT_HOTKEY_COUNT,
  choosingPiece,
  craftMenuEntries,
  craftTabs,
  entriesOnTab,
  shownTab,
  type CraftAction,
  type CraftEntry,
  type CraftTabId,
} from './craft-menu';
import { LoadingScreen } from './LoadingScreen';
import { ChestPanel } from './ChestPanel';
import type { ChestRequest } from '@acorn/shared';
import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  BUILDABLE_KINDS,
  HEALTH_LOW_THRESHOLD,
  HEALTH_MAX,
  HUNGER_LOW_THRESHOLD,
  HUNGER_MAX,
  ITEM_KINDS,
  canCook,
  cookedItemFor,
  hasItem,
  inventoryFromEntries,
  isDiscardable,
  isFood,
  roomFor,
  type BuildableKindId,
  type ItemId,
} from '@acorn/shared';

import type { HudStore, HudState, RaidBanner } from './store';
import { BuildableIcon, ItemIcon } from './item-icons';
import { CombatOverlay } from './CombatOverlay';
import type { CombatFeed } from './combat-feed';
import {
  InventoryPanel,
  PackButton,
  HOTBAR_SLOT_DRAG_TYPE,
  type SlotMenuTarget,
} from './InventoryPanel';
import { Minimap } from './Minimap';
import { Tooltip } from './Tooltip';
import { vitalsThrob } from './vitals';
import { expeditionBoardClaimsInteract } from './board-claim';
import { WorldMap } from './WorldMap';
import { assignSlot, clearSlot, resolveHotbarSlots, type HotbarPins } from './hotbar-layout';
import { amountOf, gainedLabel } from './item-words';
import { itemDescription, itemUseHint } from './item-description';
import type { ToastView } from './toasts';
import { SettingsMenu } from '../preferences/SettingsMenu';
import { SIGN_OUT_SECONDS } from './sign-out';
import { SEASON_NAMES, seasonBannerView } from './season-banner';
import { SignOutBanner } from './SignOutBanner';
import type { Preferences } from '../preferences/preferences';
import { FogCache } from '../map/draw-map';
import type { MapFeed } from '../map/map-feed';

interface HudProps {
  readonly onExpedition?: (request: ExpeditionRequest) => void;
  readonly onMoveDecoration?: (id: number) => void;
  readonly onReclaimDecoration?: (id: number) => void;
  readonly onGardenUse?: (request: GardenRequest) => void;
  readonly onJournalTabChange?: (
    tab: 'craft' | 'discoveries' | 'garden' | 'expeditions' | 'fishing',
  ) => void;
  readonly onPickCraft?: (action: CraftAction) => void;
  readonly onCraftTabChange?: (tab: CraftTabId) => void;
  readonly store: HudStore;
  readonly onPlay: () => void;
  readonly onToggleInventory: () => void;
  readonly onUseItem: (item: ItemId) => void;
  readonly onPickBuildable: (kind: BuildableKindId) => void;
  readonly onHotbarSlotsChange: (next: HotbarPins) => void;
  readonly initialPreferences: Preferences;
  readonly onSettingsOpenChange?: (open: boolean) => void;
  readonly onSettingsChange: (preferences: Preferences) => void;
  /** What the minimap and the big map draw - see decision 0054. */
  readonly mapFeed: MapFeed;
  readonly onToggleMap: () => void;
  /** Lock or unlock our own front door - see decision 0055. */
  readonly onSetDoorLock: (locked: boolean) => void;
  /** Drop or destroy some of something in the pack - see decision 0061. */
  readonly onDiscard: (item: ItemId, amount: number, destroy: boolean) => void;
  /** What the combat overlay draws - see decision 0063. */
  readonly combatFeed: CombatFeed;
  readonly onChestTransfer: (request: ChestRequest) => void;
  readonly onCloseChest: () => void;
  /** Start and cancel signing out from inside the game - see decision 0104. */
  readonly onSignOut?: () => void;
  readonly onCancelSignOut?: () => void;
  /** Delete this player's character (decision 0108). Rejects when it could not be done. */
  readonly onDeleteCharacter?: () => Promise<void>;
}

export function Hud({
  onExpedition,
  store,
  onPlay,
  onToggleInventory,
  onUseItem,
  onPickBuildable,
  onHotbarSlotsChange,
  initialPreferences,
  onSettingsChange,
  onSettingsOpenChange,
  mapFeed,
  onToggleMap,
  onSetDoorLock,
  onDiscard,
  combatFeed,
  onChestTransfer,
  onCloseChest,
  onSignOut,
  onCancelSignOut,
  onDeleteCharacter,
  onJournalTabChange,
  onPickCraft,
  onCraftTabChange,
  onGardenUse,
  onMoveDecoration,
  onReclaimDecoration,
}: HudProps): React.JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  // One parchment layer for both maps, so it is only ever worked out once.
  const [fog] = useState(() => new FogCache());
  const [slotMenu, setSlotMenu] = useState<SlotMenuTarget | null>(null);
  const showingWorld = state.ready && state.playing && !state.mapOpen && state.chestSlots === null;
  // Gone the moment there is nothing left of it to drop - used up, eaten, or
  // dropped already from the other copy of the same slot.
  const menuTarget =
    showingWorld &&
    slotMenu !== null &&
    state.carrying.some((entry) => entry.item === slotMenu.item && entry.count > 0)
      ? slotMenu
      : null;

  return (
    <>
      {/* First, so it sits under everything else: it is part of the world, not a panel. */}
      <CombatOverlay feed={combatFeed} />
      <div className="hud-panel">
        <p className="hud-title">Acorn &amp; Ash</p>
        <Row label="Server" value={<Connection state={state} />} />
        <Row label="Players" value={state.playersOnline} />
        <Row label="Ping" value={`${state.pingMs} ms`} />
        <Row label="Tick" value={state.serverTick} />
        <Row label="Renderer" value={renderer(state)} />
        <Row label="FPS" value={state.fps} />
        <Row
          label="Position"
          value={`${state.position.x.toFixed(1)}, ${state.position.z.toFixed(1)}`}
        />
        <Row label="Correction" value={`${state.correctionCm.toFixed(0)} cm`} />
        <Row label="Time" value={timeOfDay(state)} />
        <Row label="Season" value={seasonLine(state)} />
        <Row label="Hunger" value={<Hunger state={state} />} />
        <Row label="Health" value={<Health state={state} />} />
      </div>

      {showingWorld &&
      state.nearExpeditionBoard &&
      !state.craftMenuOpen &&
      !state.buildMenuOpen &&
      !state.inventoryOpen ? (
        <button
          type="button"
          className="expedition-board-open"
          onClick={() => onJournalTabChange?.('expeditions')}
        >
          Read expedition board{expeditionBoardClaimsInteract(state) ? ' · E' : ''}
        </button>
      ) : null}
      {state.craftMenuOpen ? (
        state.journalTab === 'fishing' ? (
          <FishingJournal state={state} onChange={onJournalTabChange} />
        ) : state.journalTab === 'expeditions' ? (
          <ExpeditionPanel state={state} onChange={onJournalTabChange} onRequest={onExpedition} />
        ) : state.journalTab === 'garden' ? (
          <GardenJournal state={state} onChange={onJournalTabChange} onUse={onGardenUse} />
        ) : state.journalTab === 'discoveries' ? (
          <DiscoveryJournal state={state} onChange={onJournalTabChange} />
        ) : (
          <CraftPanel
            state={state}
            onPick={onPickCraft}
            onTabChange={onCraftTabChange}
            navigation={
              <JournalTabs
                selected="craft"
                onChange={onJournalTabChange}
                hasGarden={state.garden.homeId !== 0}
              />
            }
          />
        )
      ) : null}
      {state.ready &&
      state.playing &&
      state.home === null &&
      (choosingPiece(state) || state.placing !== null) &&
      state.placing?.name !== BUILDABLE_KINDS.rowboat.displayName ? (
        <p className="build-area-note" role="status">
          {state.buildAreaRadius === null
            ? 'Place your first tent to establish a 12 m building area'
            : `Your home boundary · ${state.buildAreaRadius} m radius`}
        </p>
      ) : null}
      {state.buildMenuOpen && state.home !== null ? (
        <section className="decor-panel" aria-label="Home decoration">
          <h2>Make yourself at home</h2>
          <p>
            Pick a piece, point at the floor and scroll to rotate. Click to place. B or right-click
            to cancel.
          </p>
          {state.home.yours ? (
            <>
              <div className="build-groups decor-groups">
                {['Furniture', 'Lighting', 'Finishing touches'].map((group) => (
                  <section className="build-group" key={group} aria-label={group}>
                    <h3>{group}</h3>
                    <div className="decor-options">
                      {DECORATION_KINDS.flatMap((kind, index) =>
                        buildGroup(kind, true) !== group
                          ? []
                          : [
                              <button
                                type="button"
                                key={kind}
                                disabled={
                                  (kind === 'trailPennant' &&
                                    !((state.expedition?.cosmetics ?? 0) & 1)) ||
                                  !fishDisplayLearned(kind, fishRecordsFromSaved(state.fishRecords))
                                }
                                onClick={() => onPickBuildable(kind)}
                              >
                                <BuildableIcon kind={kind} color="#a6bea5" />
                                <strong>
                                  {index < 6 ? `${index + 1} · ` : ''}
                                  {BUILDABLE_KINDS[kind].displayName}
                                  {kind === 'trailPennant' &&
                                  !((state.expedition?.cosmetics ?? 0) & 1)
                                    ? ' · complete three outings'
                                    : !fishDisplayLearned(
                                          kind,
                                          fishRecordsFromSaved(state.fishRecords),
                                        )
                                      ? ' · earn through fishing'
                                      : ''}
                                </strong>
                                <span>
                                  {BUILDABLE_KINDS[kind].costs
                                    .map(
                                      (cost) =>
                                        `${cost.amount} ${ITEM_KINDS[cost.item].pluralName.toLowerCase()}`,
                                    )
                                    .join(' · ')}
                                </span>
                              </button>,
                            ],
                      )}
                    </div>
                  </section>
                ))}
              </div>
              <h3>Your decorations · {state.decorations?.length ?? 0}/16</h3>
              {(state.decorations ?? []).map((piece) => (
                <div className="decor-owned" key={piece.id}>
                  <span>{BUILDABLE_KINDS[piece.kind].displayName}</span>
                  <button type="button" onClick={() => onMoveDecoration?.(piece.id)}>
                    Move
                  </button>
                  <button type="button" onClick={() => onReclaimDecoration?.(piece.id)}>
                    Pack up
                  </button>
                </div>
              ))}
              <p>Pack up returns the materials to your backpack.</p>
            </>
          ) : (
            <p>Only the homeowner can decorate this room.</p>
          )}
          {state.decorNote ? <p role="status">{state.decorNote}</p> : null}
        </section>
      ) : null}
      {state.ready && state.playing && !state.mapOpen && state.home?.yours === true ? (
        <DoorLock locked={state.home.locked} onSetDoorLock={onSetDoorLock} />
      ) : null}

      {state.ready && state.playing && !state.mapOpen && state.ownCacheCompass !== null ? (
        <CacheCompass compass={state.ownCacheCompass} />
      ) : null}

      {state.ready && state.playing && !state.mapOpen && state.chestSlots === null ? (
        <Minimap
          feed={mapFeed}
          fog={fog}
          season={
            state.season === undefined
              ? undefined
              : seasonBannerView(state.season, { showYear: false })
          }
          onOpenMap={onToggleMap}
        />
      ) : null}

      {state.ready && state.playing && state.chestSlots !== null ? (
        <ChestPanel
          slots={state.chestSlots}
          carrying={state.carrying}
          pending={state.chestPending}
          note={state.chestNote}
          onTransfer={onChestTransfer}
          onClose={onCloseChest}
        />
      ) : null}
      {showingWorld ? (
        <div className="vitals">
          <HungerBar hunger={state.hunger} />
          <HealthBar health={state.health} />
        </div>
      ) : null}
      {showingWorld && state.meal.item !== null && state.meal.ticksLeft > 0 ? (
        <div
          className="meal-benefit"
          role="status"
          tabIndex={0}
          aria-label={`Active meal benefit: ${MEAL_BENEFITS[state.meal.item]}`}
          title={`${MEAL_BENEFITS[state.meal.item]} · eating another special meal replaces this benefit`}
        >
          <ItemIcon item={state.meal.item} color="#b8c58d" className="meal-benefit-icon" />
          <span>{ITEM_KINDS[state.meal.item].displayName}</span>
          <span>{Math.ceil(state.meal.ticksLeft / TICK_HZ / 60)} min</span>
        </div>
      ) : null}
      {showingWorld && state.raidBanner !== null ? (
        <RaidBannerView key={state.raidBanner.key} banner={state.raidBanner} />
      ) : null}
      {showingWorld && state.raidBanner === null && state.raidersInSight > 0 ? (
        <RaidTracker count={state.raidersInSight} />
      ) : null}
      {state.ready && state.playing && !state.mapOpen && state.chestSlots === null ? (
        <>
          {state.inventoryOpen ? <div className="inventory-scrim" /> : null}
          <Hotbar
            state={state}
            onUseItem={onUseItem}
            onHotbarSlotsChange={onHotbarSlotsChange}
            onToggleInventory={onToggleInventory}
            onOpenSlotMenu={setSlotMenu}
          />
          <InventoryPanel
            open={state.inventoryOpen}
            carrying={state.carrying}
            equippedItem={state.equippedItem}
            onUseItem={onUseItem}
            onUnpinFromHotbar={(slotIndex) =>
              onHotbarSlotsChange(clearSlot(state.hotbarSlots, slotIndex))
            }
            onOpenSlotMenu={setSlotMenu}
          />
        </>
      ) : null}

      {showingWorld && !state.inventoryOpen && state.hoveredLoot !== null ? (
        <div
          className="loot-hover"
          style={{
            left: Math.max(8, Math.min(state.hoveredLoot.x + 18, window.innerWidth - 260)),
            top: Math.max(8, Math.min(state.hoveredLoot.y + 18, window.innerHeight - 110)),
          }}
        >
          <strong>
            {state.hoveredLoot.name}
            {state.hoveredLoot.count > 1 ? ` ×${state.hoveredLoot.count}` : ''}
          </strong>
          <span>{state.hoveredLoot.detail}</span>
        </div>
      ) : null}
      {showingWorld && state.interactionNote !== null ? (
        <p className="interaction-note" role="status">
          {state.interactionNote}
        </p>
      ) : null}
      {showingWorld && !state.inventoryOpen && state.pickupNotice !== null ? (
        <PickupNotice
          notice={state.pickupNotice}
          onOpenPack={() => {
            if (!state.inventoryOpen) onToggleInventory();
          }}
        />
      ) : null}
      {showingWorld && state.toasts.length > 0 ? <Toasts toasts={state.toasts} /> : null}

      {state.ready ? (
        <div className={state.playing ? 'game-settings' : undefined}>
          <SettingsMenu
            initial={initialPreferences}
            onChange={onSettingsChange}
            onOpenChange={onSettingsOpenChange}
            account={
              onSignOut !== undefined && onCancelSignOut !== undefined
                ? {
                    waitSeconds: SIGN_OUT_SECONDS,
                    secondsLeft: state.signOutSecondsLeft,
                    onSignOut,
                    onCancelSignOut,
                    deleteCharacter:
                      onDeleteCharacter !== undefined && state.playerName !== ''
                        ? { characterName: state.playerName, onDelete: onDeleteCharacter }
                        : undefined,
                  }
                : undefined
            }
          />
        </div>
      ) : null}
      <SignOutBanner
        secondsLeft={state.signOutSecondsLeft}
        notice={state.signOutNotice}
        onCancel={onCancelSignOut}
      />

      {state.ready && !state.playing ? (
        <div className="hud-curtain" onClick={onPlay} role="presentation">
          <h1>Acorn &amp; Ash</h1>
          <p>{curtainMessage(state)}</p>
          <p>Find your controls in Settings → Keybindings.</p>
        </div>
      ) : null}

      {showingWorld && !state.mapOpen ? <RareReelHint state={state} /> : null}
      {state.ready &&
      state.playing &&
      !state.mapOpen &&
      (state.fishingNews !== null ||
        state.healthNews !== null ||
        state.cacheNews !== null ||
        state.hungerNews !== null ||
        state.craftingNews !== null ||
        state.cookingNews !== null ||
        state.huntingNews !== null ||
        state.discardNews !== null) ? (
        <p className="hud-news">
          {state.fishingNews ??
            state.healthNews ??
            state.cacheNews ??
            state.hungerNews ??
            state.craftingNews ??
            state.cookingNews ??
            state.huntingNews ??
            state.discardNews}
        </p>
      ) : null}

      {state.ready &&
      state.playing &&
      !state.mapOpen &&
      !state.inventoryOpen &&
      hint(state) !== '' ? (
        <p
          className={
            state.fishing === 'biting' || state.hunger <= 0 || state.health <= HEALTH_LOW_THRESHOLD
              ? 'hud-hint hud-hint-urgent'
              : (state.placing?.refusal ?? null) !== null && !state.buildMenuOpen
                ? 'hud-hint hud-hint-blocked'
                : 'hud-hint'
          }
        >
          {hint(state)}
        </p>
      ) : null}

      {menuTarget !== null ? (
        <SlotMenu
          key={`${menuTarget.item}-${menuTarget.x}-${menuTarget.y}`}
          target={menuTarget}
          canDrop={state.canDrop}
          onDiscard={onDiscard}
          onClose={() => setSlotMenu(null)}
        />
      ) : null}

      {/* Last, so the big map's page sits over everything else on screen. */}
      {state.ready && state.playing && state.mapOpen ? (
        <WorldMap feed={mapFeed} fog={fog} onClose={onToggleMap} />
      ) : null}

      {!state.ready ? <LoadingScreen state={state} /> : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div className="hud-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Connection({ state }: { state: HudState }): React.JSX.Element {
  const labels: Record<HudState['connection'], [string, string]> = {
    connecting: ['Connecting', 'hud-status-warn'],
    connected: ['Connected', 'hud-status-good'],
    offline: ['Offline', 'hud-status-bad'],
    rejected: ['World full', 'hud-status-bad'],
    elsewhere: ['Playing elsewhere', 'hud-status-warn'],
    deleted: ['Character deleted', 'hud-status-bad'],
  };
  const entry = labels[state.connection];
  return <span className={entry[1]}>{entry[0]}</span>;
}

function Hunger({ state }: { state: HudState }): React.JSX.Element {
  const className =
    state.hunger <= 0
      ? 'hud-status-bad'
      : state.hunger < HUNGER_LOW_THRESHOLD
        ? 'hud-status-warn'
        : undefined;
  return (
    <span className={className}>
      {Math.round(state.hunger)}/{HUNGER_MAX}
    </span>
  );
}

function Health({ state }: { state: HudState }): React.JSX.Element {
  const className = state.health <= HEALTH_LOW_THRESHOLD ? 'hud-status-bad' : undefined;
  return (
    <span className={className}>
      {Math.round(state.health)}/{HEALTH_MAX}
    </span>
  );
}

/**
 * How full you are, just above the health bar in the bottom left corner. It
 * throbs once it is nearly empty, so it is noticed before the nudge along the
 * bottom has to say anything.
 */
function HungerBar({ hunger }: { hunger: number }): React.JSX.Element {
  const fraction = Math.min(1, Math.max(0, hunger / HUNGER_MAX));
  const low = vitalsThrob(hunger, HEALTH_MAX).hunger;
  return (
    <div
      className={low ? 'hunger-bar hunger-bar-low' : 'hunger-bar'}
      data-testid="hunger-bar"
      role="meter"
      aria-label="Hunger"
      aria-valuemin={0}
      aria-valuemax={HUNGER_MAX}
      aria-valuenow={Math.round(hunger)}
    >
      {/* A drumstick: meat on a bone. */}
      <svg className="hunger-bar-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path className="hunger-bar-bone" d="M10.2 13.8 5.4 18.6" />
        <circle className="hunger-bar-bone-end" cx="4.6" cy="19.4" r="1.9" />
        <circle className="hunger-bar-meat" cx="15" cy="9" r="6.6" />
      </svg>
      <div className="hunger-bar-track">
        <div className="hunger-bar-fill" style={{ width: `${fraction * 100}%` }} />
      </div>
      <span className="hunger-bar-number">{Math.round(hunger)}</span>
    </div>
  );
}

/**
 * How much health is left, in the bottom left corner where it is always in
 * view (see decision 0063): the bar drops the moment a blow lands, a pale
 * strip behind it shows what that blow took and catches up a beat later,
 * and the whole thing flashes. Red and throbbing once there is little left.
 */
function HealthBar({ health }: { health: number }): React.JSX.Element {
  const fraction = Math.min(1, Math.max(0, health / HEALTH_MAX));
  const low = vitalsThrob(HUNGER_MAX, health).health;
  // Counts every blow taken, so the flash plays again for each one.
  const [hits, setHits] = useState(0);
  const [last, setLast] = useState(health);
  if (health !== last) {
    if (health < last) setHits(hits + 1);
    setLast(health);
  }
  return (
    <div className={low ? 'health-bar health-bar-low' : 'health-bar'} data-testid="health-bar">
      <svg className="health-bar-heart" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.5C6 16 2.5 12.5 2.5 8.6c0-2.8 2.2-4.8 4.8-4.8 1.9 0 3.6 1.1 4.7 2.8 1.1-1.7 2.8-2.8 4.7-2.8 2.6 0 4.8 2 4.8 4.8 0 3.9-3.5 7.4-9.5 11.9z" />
      </svg>
      <div className="health-bar-track">
        <div className="health-bar-trail" style={{ width: `${fraction * 100}%` }} />
        <div className="health-bar-fill" style={{ width: `${fraction * 100}%` }} />
        {hits > 0 ? <div key={hits} className="health-bar-flash" /> : null}
      </div>
      <span className="health-bar-number">{Math.round(health)}</span>
    </div>
  );
}

/** A skeleton raid turning up, fought off, or over: big, then gone again (see decision 0063). */
function RaidBannerView({ banner }: { banner: RaidBanner }): React.JSX.Element {
  return (
    <div className={`raid-banner raid-banner-${banner.tone}`} data-testid="raid-banner">
      <p className="raid-banner-title">{banner.title}</p>
      <p className="raid-banner-detail">{banner.detail}</p>
    </div>
  );
}

/** Once the banner has gone: how many are still standing, while any are. */
function RaidTracker({ count }: { count: number }): React.JSX.Element {
  return (
    <div className="raid-tracker" data-testid="raid-tracker">
      <span className="raid-tracker-skull" aria-hidden="true">
        ☠
      </span>
      {count === 1 ? '1 skeleton left' : `${count} skeletons left`}
    </div>
  );
}

/**
 * Inside your own home (see decision 0055): whether the door is open to
 * visitors, and a click to change that. Only ever shown to the owner.
 */
function DoorLock({
  locked,
  onSetDoorLock,
}: {
  readonly locked: boolean;
  readonly onSetDoorLock: (locked: boolean) => void;
}): React.JSX.Element {
  return (
    <div className="door-lock">
      <span className="door-lock-icon" aria-hidden="true">
        {locked ? '🔒' : '🔓'}
      </span>
      <span>{locked ? 'Door locked to visitors' : 'Visitors welcome'}</span>
      <button type="button" onClick={() => onSetDoorLock(!locked)} data-testid="door-lock">
        {locked ? 'Unlock' : 'Lock'}
      </button>
    </div>
  );
}

/**
 * A small arrow back to a buried stash, once it is far enough away that
 * stumbling onto it again would be luck rather than memory. The arrow
 * rotates to keep pointing the right way as the camera turns; the number
 * below it is how far.
 */
function CacheCompass({
  compass,
}: {
  compass: NonNullable<HudState['ownCacheCompass']>;
}): React.JSX.Element {
  return (
    <div
      className="cache-compass"
      role="status"
      title="Your buried belongings never expire. Make room in your backpack before digging; anything that does not fit stays safely here."
    >
      <span
        className="cache-compass-arrow"
        style={{ transform: `rotate(${compass.bearingDegrees}deg)` }}
      >
        ▲
      </span>
      Recover belongings · {Math.round(compass.distanceMeters)} m
    </div>
  );
}

/** Group related pieces without changing their existing shortcut indices. */
function buildGroup(kind: BuildableKindId, indoors = false): string {
  if (isHomeKind(kind)) return 'Home';
  if (kind === 'cedarBench' || kind === 'timberTable') return 'Furniture';
  if (kind === 'lantern' || kind === 'fernLantern' || kind === 'moonLantern')
    return indoors ? 'Lighting' : 'Camp & lighting';
  if (kind === 'campfire') return 'Camp & lighting';
  if (kind === 'rowboat') return 'Lake';
  if (
    kind === 'flowerBed' ||
    kind === 'fence' ||
    kind === 'gardenPath' ||
    (!indoors && kind === 'flowerPlanter')
  )
    return 'Garden & boundaries';
  return indoors ? 'Finishing touches' : 'Trophies';
}

/**
 * The Craft menu (C, or B outside): one page of the field journal listing
 * everything you can make, whether it goes into your pack or onto the ground
 * (see decision 0096). Each entry is a stamped icon, a name, its ingredients
 * (each with its own small icon) and a mark saying whether it is ready or
 * exactly what is in the way (see `CraftStatusId`).
 *
 * The title, the page tabs and the category pills stay put while the list
 * scrolls, so a small screen never hides the way to another category.
 */
function CraftPanel({
  state,
  onPick,
  onTabChange,
  navigation,
}: {
  state: HudState;
  /** Clicking an entry does the same as pressing its number. */
  onPick?: (action: CraftAction) => void;
  onTabChange?: (tab: CraftTabId) => void;
  navigation: React.ReactNode;
}): React.JSX.Element {
  const entries = craftMenuEntries(state);
  const tab = shownTab(entries, state.craftTab);
  const shown = entriesOnTab(entries, tab);
  const renderEntry = (entry: CraftEntry, index: number): React.JSX.Element => {
    const pick = (): void => {
      if (!entry.locked) onPick?.(entry.action);
    };
    const color =
      'item' in entry.icon
        ? colorOf(ITEM_KINDS[entry.icon.item].placeholderColor)
        : colorOf(BUILDABLE_KINDS[entry.icon.buildable].placeholderColor);
    return (
      <div
        className="hud-journal-entry hud-journal-entry-pickable"
        key={`${entry.action.kind}-${'item' in entry.action ? entry.action.item : entry.action.buildable}`}
        aria-disabled={entry.locked || undefined}
        onClick={pick}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            pick();
          }
        }}
      >
        <div className="hud-journal-stamp">
          {'item' in entry.icon ? (
            <ItemIcon item={entry.icon.item} color={color} className="hud-journal-stamp-icon" />
          ) : (
            <BuildableIcon
              kind={entry.icon.buildable}
              color={color}
              className="hud-journal-stamp-icon"
            />
          )}
        </div>
        <div className="hud-journal-entry-main">
          <div className="hud-journal-entry-name">
            {index < CRAFT_HOTKEY_COUNT ? (
              <kbd className="craft-key" aria-label={`Key ${index + 1}`}>
                {index + 1}
              </kbd>
            ) : null}
            {entry.displayName}
          </div>
          {entry.benefitNote && <div className="hud-journal-supply-note">{entry.benefitNote}</div>}
          {entry.supplyNote && <div className="hud-journal-supply-note">{entry.supplyNote}</div>}
          <div className="hud-journal-ingredients">
            {entry.costs.map((cost) => {
              const costKind = ITEM_KINDS[cost.item];
              const name = cost.amount === 1 ? costKind.displayName : costKind.pluralName;
              const short = entry.shortfalls.find((shortfall) => shortfall.item === cost.item);
              return (
                <span
                  className={
                    short === undefined
                      ? 'hud-journal-ingredient'
                      : 'hud-journal-ingredient hud-journal-ingredient-missing'
                  }
                  key={cost.item}
                >
                  <ItemIcon
                    item={cost.item}
                    color="#7a6a4d"
                    className="hud-journal-ingredient-icon"
                  />
                  {/* What is missing says how much of it there is: 2/6 logs. */}
                  {short === undefined ? cost.amount : `${short.have}/${cost.amount}`}{' '}
                  {name.toLowerCase()}
                </span>
              );
            })}
          </div>
        </div>
        <span
          className={
            entry.ready
              ? 'hud-journal-status hud-journal-status-ready'
              : entry.status === 'needMore' || entry.status === 'locked'
                ? 'hud-journal-status'
                : 'hud-journal-status hud-journal-status-blocked'
          }
        >
          {entry.statusLabel}
        </span>
      </div>
    );
  };
  return (
    <div className="hud-journal craft-panel">
      <div className="hud-journal-header">
        <span className="hud-journal-title">Field journal · Crafting</span>
        <span className="hud-journal-closehint">Keys 1-9 pick · C to close</span>
      </div>
      {navigation}
      <nav className="craft-tabs" aria-label="Craft categories">
        {craftTabs(entries).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => onTabChange?.(id)}
          >
            {id === 'all' ? 'All' : (CRAFT_GROUPS.find((group) => group.id === id)?.tab ?? id)}
          </button>
        ))}
      </nav>
      <div className="craft-list">
        {CRAFT_GROUPS.map((group) => {
          const items = shown.filter((entry) => entry.group === group.id);
          return items.length === 0 ? null : (
            <section className="craft-group" key={group.id} aria-label={group.heading}>
              <h2>{group.heading}</h2>
              {items.map((entry) => renderEntry(entry, shown.indexOf(entry)))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The strip along the bottom.
 *
 * Whatever you could do right now beats the list of what the keys are. A line
 * in the water beats everything, because the moment matters. Picking something
 * up beats chopping: you are more likely to be reaching for the thing at your
 * feet than swinging at the tree behind it. And the rest goes the same way
 * round as the server decides a click: the axe chops a tree before anything
 * else, the rod casts at water in front of it, and anything else in hand
 * takes a swing at an animal (see decision 0056).
 */
export function hint(state: HudState): string {
  if (state.fishing === 'reeling') return '';
  if (state.fishing === 'biting') return "It's biting! Click!";
  if (state.fishing === 'waiting') return 'Watch the float. Click when it goes right under.';
  // Real danger, unlike being hungry: one more hit like the last one and you
  // are knocked out, so this beats everything but an actual bite.
  if (state.health <= HEALTH_LOW_THRESHOLD) return 'Hurt badly - one more hit and you are down';
  // A fight beats everything else that is merely useful, but not a menu
  // the player opened on purpose, which says how to close itself.
  const fighting =
    state.buildMenuOpen || state.craftMenuOpen || state.placing !== null ? null : fightHint(state);
  if (fighting !== null) return fighting;
  // Settled in, E gets you up rather than doing anything else it would.
  if (state.resting === 'chair')
    return 'Resting at home · safe and sheltered · move or press E to get up';
  if (state.resting === 'bed')
    return 'Snug in bed · safe and sheltered · move or press E to get up';
  // Sat on the bare ground is only a rest for the eyes: nothing is sheltered.
  if (state.resting === 'ground') return 'Sitting on the ground · move, or press X or E to get up';
  // Out on the water, the oars are all there is to think about.
  if (state.boat === 'climbOut')
    return 'Rowing · move to steer, Shift to pull harder · press E to climb out here';
  if (state.boat === 'tooFar')
    return 'Rowing · move to steer, Shift to pull harder · row up to a shore to climb out';
  // A held raw food beside a lit campfire is deliberately saved for cooking
  // even while hungry, so say what E will really do before the hunger nudge.
  const cookingNow = campfireCookingHint(state);
  if (cookingNow !== null) return cookingNow;
  // Empty is a clear nudge, so it beats everything but an actual bite: there
  // is nothing worse than being hungry yet, but it should not go unnoticed.
  if (state.hunger <= 0) return hungerHint(state);
  // Asked for a menu, so resolving it beats whatever else is going on - it
  // stays open until a pick closes it or its own key does. Only one is ever
  // open at once, so the order between them here never actually matters.
  if (state.buildMenuOpen) return buildMenuHint();
  // The same goes for a piece picked from it and being placed.
  if (state.placing !== null) return placingHint(state.placing);
  if (state.craftMenuOpen)
    return state.journalTab === 'garden'
      ? 'Choose a garden box · C to close'
      : state.journalTab === 'discoveries'
        ? 'Follow a lead · C to close'
        : craftMenuHint();
  if (state.charging) return 'Charging a heavy swing · release to strike';
  if (state.nearbyItem !== null) return pickupHint(state, state.nearbyItem);
  // The same order the server tries a press of E in: something lying in the
  // clearing to be found, then something dropped, then a patch.
  if (state.nearbyPile !== null) return pileHint(state, state.nearbyPile);
  if (state.nearGatherSpot !== null) return gatherHint(state, state.nearGatherSpot);
  // A boat comes after the reeds: the press cuts them first, the way the server does.
  if (state.boat === 'board') return 'Press E to climb into the rowboat';
  if (state.boat === 'taken') return 'Somebody is already rowing this boat';
  if (state.boat === 'frozen')
    return 'The rowboat is frozen in the ice · it floats again in spring';
  if (state.nearBuriedCache) return 'Press E to recover belongings · leftovers stay safely here';
  if (state.nearbyDiscovery === 'The elk grove')
    return 'Press E to sketch the elk · give it room to settle';
  if (state.nearbyDiscovery !== null)
    return `Press E to inspect ${state.nearbyDiscovery.toLowerCase()}`;
  if (state.nearCampfire === 'unlit') return 'Press E to light the campfire';
  if (state.nearGarden) return 'Click a garden box, or open Garden in the C journal';
  if (state.nearWorkbench) return 'Cabin workbench · C to refine your tools';
  if (state.nearCampfire === 'lit')
    return state.home === null
      ? 'Press E to put out the campfire'
      : 'Cooking station · C for learned recipes';
  // The board on the doorstep answers to E like anything else, once nothing
  // above has already claimed the press.
  if (expeditionBoardClaimsInteract(state)) return 'Press E to read the expedition board';
  // Doors - see decision 0055.
  if (state.door === 'enter') return 'Walk in, or press E, to go inside';
  if (state.door === 'visit') return 'Walk in, or press E, to visit';
  if (state.door === 'locked') return "The door's locked";
  if (state.door === 'leave') return 'Walk out through the door to leave';
  // Food picked out and room for it is eaten first, even beside these (the
  // hunger hint above and below says so); otherwise E sits or lies down.
  const eatsInstead =
    state.hunger < HUNGER_MAX && state.equippedItem !== null && isFood(state.equippedItem);
  if (state.restingNearby !== null && eatsInstead) return 'Press E to eat';
  if (state.restingNearby === 'chair') return 'Press E to sit down';
  if (state.restingNearby === 'bed') return 'Press E to lie down';
  // Only the axe chops, so a tree only offers a hint once it is the active
  // item - carrying it is not enough, it has to be equipped. Anything in hand
  // takes a swing at an animal, though, even a fish (see decision 0056) -
  // unless it is the rod facing water, which casts instead.
  if (state.aimedTree !== null && toolKind(state.equippedItem) === 'axe')
    return chopHint(state.aimedTree);
  if (state.canCast) return 'Left click to cast';
  if (state.aimedAnimal !== null && state.equippedItem !== null) {
    return catchHint(state.aimedAnimal);
  }

  if (state.trackHint !== null) return state.trackHint;

  // A gentler reminder once nothing more useful is going on.
  if (state.hunger < HUNGER_LOW_THRESHOLD) return hungerHint(state);
  if (state.home !== null) {
    return state.home.yours
      ? 'Home, sweet home · the door out is behind you'
      : 'Visiting · the door out is behind you';
  }
  return '';
}

/**
 * What E would do with something at your feet - or why it would not, once
 * every slot is taken or it is a second of something you only ever carry
 * one of (see decision 0060).
 */
function pickupHint(state: HudState, item: ItemId): string {
  const kind = ITEM_KINDS[item];
  const name = kind.displayName.toLowerCase();
  const pack = inventoryFromEntries(state.carrying);
  if (roomFor(pack, item) > 0) return `Right-click or press E to pick up the ${name}`;
  if (kind.maxCarry === 1 && hasItem(pack, item)) return `You can only carry one ${name}`;
  return `Your pack is full · no room for the ${name}`;
}

/**
 * What E would do beside something dropped: pick up as much of it as there
 * is room for, or nothing until a slot frees up.
 */
function pileHint(state: HudState, pile: NonNullable<HudState['nearbyPile']>): string {
  const kind = ITEM_KINDS[pile.item];
  const pack = inventoryFromEntries(state.carrying);
  if (roomFor(pack, pile.item) > 0)
    return `Right-click or press E to pick up ${amountOf(pile.item, pile.count)}`;
  const name = kind.displayName.toLowerCase();
  if (kind.maxCarry === 1 && hasItem(pack, pile.item)) return `You can only carry one ${name}`;
  return `Your pack is full · no room for ${amountOf(pile.item, pile.count)}`;
}

/** What E would do beside a patch: gather from it, or nothing until a slot frees up. */
function gatherHint(state: HudState, item: ItemId): string {
  // What grows in the shallows and can be cut is called mature reeds, to tell it from the scenery.
  const plural = item === 'reed' ? 'mature reeds' : ITEM_KINDS[item].pluralName.toLowerCase();
  if (roomFor(inventoryFromEntries(state.carrying), item) > 0)
    return `Right-click or press E to gather ${plural}${item === 'mushroom' && state.forestWeather?.mushroomsAbundant ? ' · rain-fed clusters yield up to two' : ''}`;
  return `Your pack is full · no room for more ${plural}`;
}

function campfireCookingHint(state: HudState): string | null {
  if (state.nearCampfire !== 'lit' || state.equippedItem === null) return null;
  const raw = state.equippedItem;
  const cooked = cookedItemFor(raw);
  if (cooked === null) return null;
  const pack = inventoryFromEntries(state.carrying);
  if (canCook(pack, raw)) {
    return `Press E to roast the ${ITEM_KINDS[raw].displayName.toLowerCase()}`;
  }
  return `Your pack is full · no room for ${ITEM_KINDS[cooked].displayName.toLowerCase()}`;
}

function hungerHint(state: HudState): string {
  // E only eats whatever is already active - press its hotbar number first
  // to make some other food the active one, the same as a swing needs the
  // axe active and a cast needs the rod active.
  const activeFood = state.equippedItem !== null && isFood(state.equippedItem);
  const hasFood =
    activeFood || state.carrying.some((entry) => isFood(entry.item) && entry.count > 0);
  if (state.hunger <= 0) {
    if (activeFood) return "You're hungry. Press E to eat";
    return hasFood
      ? "You're hungry. Press its hotbar number to eat"
      : "You're hungry. Go catch something to eat";
  }
  if (activeFood) return 'Press E to eat · getting hungry';
  return hasFood ? 'Press its hotbar number to eat · getting hungry' : 'Getting hungry';
}

function chopHint(tree: NonNullable<HudState['aimedTree']>): string {
  const swings = tree.swingsLeft === 1 ? '1 swing left' : `${tree.swingsLeft} swings left`;
  return `Left click to chop the ${tree.name.toLowerCase()} · ${swings}`;
}

/**
 * What to do about skeletons close by (see decision 0063): fight the one in
 * front, turn to face one, or get something in hand first - a blow needs
 * something to strike with. Always with the roll, the way out of a swing.
 * Null with none close.
 */
function fightHint(state: HudState): string | null {
  if (state.aimedRaider === null && !state.raidersClose) return null;
  if (state.charging) return 'Charging a heavy blow · let go to strike';
  if (state.equippedItem === null) {
    return 'Skeletons! Pick something from your hotbar to fight back · Ctrl to roll';
  }
  const raider = state.aimedRaider;
  if (raider === null) return 'Face a skeleton and left click to fight · Ctrl to roll';
  const name = raider.name.toLowerCase();
  const hits = raider.hitsLeft === 1 ? '1 hit left' : `${raider.hitsLeft} hits left`;
  return `Left click to fight the ${name} · ${hits} · Ctrl to roll`;
}

function catchHint(animal: NonNullable<HudState['aimedAnimal']>): string {
  const name = animal.name.toLowerCase();
  // Only a threat reports hits left at all - prey is always caught in one.
  if (animal.hitsLeft === undefined) return `Left click to catch the ${name}`;
  const hits = animal.hitsLeft === 1 ? '1 hit left' : `${animal.hitsLeft} hits left`;
  return `Left click to fight off the ${name} · ${hits}`;
}

/** Decorating a room: the panel shows every choice by name, so this stays short. */
function buildMenuHint(): string {
  return 'Pick one below, or B to close';
}

/**
 * What is stopping a click from placing the piece, if anything - otherwise
 * how to place it, turn it, and put it away.
 */
function placingHint(placing: NonNullable<HudState['placing']>): string {
  if (placing.refusal !== null) return `${placing.refusal} · Esc to stop`;
  const name = placing.name.toLowerCase();
  const free = placing.canSnap ? ' · hold Shift to place freely' : '';
  return `Click to place the ${name} · scroll to turn${free} · Esc to stop`;
}

function craftMenuHint(): string {
  return 'Pick one below, or C to close';
}

/**
 * The row of slots along the bottom, one per item kind up to six, then the
 * bag button that opens the pack. A slot shows whatever has been dragged
 * onto it from the pack, or failing that whatever wire order would put
 * there - see `resolveHotbarSlots`. Empty slots still show their number, so
 * which key does what never depends on what you happen to be holding.
 */
function Hotbar({
  state,
  onUseItem,
  onHotbarSlotsChange,
  onToggleInventory,
  onOpenSlotMenu,
}: {
  state: HudState;
  onUseItem: (item: ItemId) => void;
  onHotbarSlotsChange: (next: HotbarPins) => void;
  onToggleInventory: () => void;
  onOpenSlotMenu: (target: SlotMenuTarget) => void;
}): React.JSX.Element {
  const resolved = resolveHotbarSlots(state.carrying, state.hotbarSlots);
  return (
    <div className="hotbar">
      {resolved.map((item, index) => (
        <HotbarSlot
          key={index}
          slotNumber={index + 1}
          item={item}
          count={state.carrying.find((entry) => entry.item === item)?.count ?? 0}
          equipped={item !== null && item === state.equippedItem}
          onUseItem={onUseItem}
          onAssign={(dropped) => onHotbarSlotsChange(assignSlot(state.hotbarSlots, index, dropped))}
          onOpenSlotMenu={onOpenSlotMenu}
        />
      ))}
      <span className="hotbar-divider" aria-hidden="true" />
      <PackButton
        carrying={state.carrying}
        open={state.inventoryOpen}
        onToggle={onToggleInventory}
      />
    </div>
  );
}

function HotbarSlot({
  slotNumber,
  item,
  count,
  equipped,
  onUseItem,
  onAssign,
  onOpenSlotMenu,
}: {
  slotNumber: number;
  item: ItemId | null;
  count: number;
  equipped: boolean;
  onUseItem: (item: ItemId) => void;
  onAssign: (item: ItemId) => void;
  onOpenSlotMenu: (target: SlotMenuTarget) => void;
}): React.JSX.Element {
  const kind = item === null ? null : ITEM_KINDS[item];
  const usable = kind !== null && kind.equippable;
  const classes = ['hotbar-slot'];
  if (usable) classes.push('hotbar-slot-usable');
  if (equipped) classes.push('hotbar-slot-equipped');
  if (item !== null && count === 0) classes.push('hotbar-slot-unavailable');

  const label =
    kind === null ? (
      'Empty - drag an item here from your pack'
    ) : (
      <>
        <strong>{kind.displayName}</strong>
        <span className="item-tooltip-detail">{itemDescription(kind.id)}</span>
        <span className="item-tooltip-action">
          {count > 0 ? itemUseHint(kind.id) : 'Not in your pack · find more to use this slot'}
        </span>
      </>
    );

  return (
    <Tooltip label={label}>
      <div
        className={classes.join(' ')}
        draggable={item !== null}
        onDragStart={(event) => {
          if (item === null) return;
          event.dataTransfer.setData('text/plain', item);
          event.dataTransfer.setData(HOTBAR_SLOT_DRAG_TYPE, String(slotNumber - 1));
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const dropped = event.dataTransfer.getData('text/plain');
          if (dropped !== '') onAssign(dropped as ItemId);
        }}
        onClick={() => {
          if (item !== null) onUseItem(item);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          if (item === null || count === 0) return;
          onOpenSlotMenu({ item, count, x: event.clientX, y: event.clientY });
        }}
      >
        <span className="hotbar-slot-key">{slotNumber}</span>
        {kind !== null && item !== null ? (
          <ItemIcon
            item={item}
            color={colorOf(kind.placeholderColor)}
            className="hotbar-slot-icon"
          />
        ) : null}
        {kind !== null && kind.stackSize > 1 && count > 0 ? (
          <span className="hotbar-slot-count">{count}</span>
        ) : null}
      </div>
    </Tooltip>
  );
}

/**
 * Everything just gained, down the right-hand side: one small note per kind
 * of thing, "+3 Sticks", fading out a few seconds after the last one went in
 * (see decision 0061).
 */
function Toasts({ toasts }: { toasts: readonly ToastView[] }): React.JSX.Element {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={toast.fading ? 'toast toast-fading' : 'toast'}
          data-testid="toast"
        >
          <ItemIcon
            item={toast.item}
            color={colorOf(ITEM_KINDS[toast.item].placeholderColor)}
            className="toast-icon"
          />
          <span>{gainedLabel(toast.item, toast.count)}</span>
        </div>
      ))}
    </div>
  );
}

/** How wide the slot menu is, so it can be kept from running off the side of the screen. */
const SLOT_MENU_WIDTH = 200;

/**
 * The small menu a right-click on a slot opens: drop one, drop the lot, or
 * destroy it - the last only once it has been asked a second time, since
 * there is no getting it back (see decision 0061). The bag never offers any
 * of it: it is what the extra slots hang off.
 */
function SlotMenu({
  target,
  canDrop,
  onDiscard,
  onClose,
}: {
  target: SlotMenuTarget;
  canDrop: boolean;
  onDiscard: (item: ItemId, amount: number, destroy: boolean) => void;
  onClose: () => void;
}): React.JSX.Element {
  const [confirming, setConfirming] = useState(false);
  const { item, count } = target;
  const kind = ITEM_KINDS[item];

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const act = (amount: number, destroy: boolean): void => {
    onDiscard(item, amount, destroy);
    onClose();
  };

  // Opened upwards from anywhere in the bottom half, which is where the
  // hotbar is, so it never hangs off the bottom of the screen.
  const opensUp = target.y > window.innerHeight / 2;
  const style: React.CSSProperties = {
    left: Math.max(8, Math.min(target.x, window.innerWidth - SLOT_MENU_WIDTH - 8)),
    top: target.y,
    width: SLOT_MENU_WIDTH,
    transform: opensUp ? 'translateY(-100%)' : undefined,
  };

  let body: React.ReactNode;
  if (!isDiscardable(item)) {
    body = <p className="slot-menu-note">Your bag stays with you. It holds your extra slots.</p>;
  } else if (confirming) {
    body = (
      <>
        <p className="slot-menu-note">
          Destroy {amountOf(item, count)}? You can&apos;t get {count === 1 ? 'it' : 'them'} back.
        </p>
        <button
          type="button"
          className="slot-menu-danger"
          onClick={() => act(count, true)}
          data-testid="slot-menu-confirm-destroy"
        >
          Yes, destroy
        </button>
        <button type="button" onClick={() => setConfirming(false)}>
          Keep {count === 1 ? 'it' : 'them'}
        </button>
      </>
    );
  } else {
    body = (
      <>
        {count > 1 ? (
          <button
            type="button"
            disabled={!canDrop}
            onClick={() => act(1, false)}
            data-testid="slot-menu-drop-one"
          >
            Drop one
          </button>
        ) : null}
        <button
          type="button"
          disabled={!canDrop}
          onClick={() => act(count, false)}
          data-testid="slot-menu-drop-all"
        >
          {count > 1 ? `Drop all ${count}` : 'Drop'}
        </button>
        {canDrop ? null : <p className="slot-menu-note">Nowhere to drop things indoors.</p>}
        <button
          type="button"
          className="slot-menu-danger"
          onClick={() => setConfirming(true)}
          data-testid="slot-menu-destroy"
        >
          Destroy…
        </button>
      </>
    );
  }

  return (
    <>
      <div
        className="slot-menu-backdrop"
        role="presentation"
        onMouseDown={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
      />
      <div
        className="slot-menu"
        role="menu"
        style={style}
        onContextMenu={(event) => event.preventDefault()}
        data-testid="slot-menu"
      >
        <div className="slot-menu-title">
          <ItemIcon item={item} color={colorOf(kind.placeholderColor)} className="toast-icon" />
          <span>{count === 1 ? kind.displayName : `${count} ${kind.pluralName}`}</span>
        </div>
        {body}
      </div>
    </>
  );
}

/** A 0xRRGGBB placeholder colour, as a CSS colour string. */
function colorOf(placeholderColor: number): string {
  return `#${placeholderColor.toString(16).padStart(6, '0')}`;
}

function timeOfDay(state: HudState): string {
  const time = state.isNight ? 'Night' : 'Day';
  const kind = state.forestWeather?.kind;
  return kind === undefined || kind === 'clear' ? time : `${time} · ${kind}`;
}

/** "Autumn, day 3 of 6": where in the year the world is. */
function seasonLine(state: HudState): string {
  const calendar = state.season;
  if (calendar === undefined) return '…';
  return `${SEASON_NAMES[calendar.season]}, day ${calendar.dayOfSeason} of ${DAYS_PER_SEASON}`;
}

function renderer(state: HudState): string {
  if (state.backend === 'unknown') return 'starting…';
  return state.forcedFallback ? `${state.backend} (forced)` : state.backend;
}

/** What the paused curtain says: welcome back, or that you are playing in another tab. */
export function curtainMessage(state: HudState): string {
  if (state.connection === 'elsewhere') {
    return 'You are playing in another tab or window. Click to play here instead';
  }
  if (state.connection === 'deleted') return 'This character was deleted. Starting over…';
  return state.playerName ? `Welcome, ${state.playerName}. Click to play` : 'Click to play';
}
