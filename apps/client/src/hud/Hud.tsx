import { useSyncExternalStore } from 'react';

import {
  BUILDABLE_KINDS,
  BUILDABLE_KIND_ORDER,
  HEALTH_LOW_THRESHOLD,
  HEALTH_MAX,
  HUNGER_LOW_THRESHOLD,
  HUNGER_MAX,
  ITEM_KINDS,
  RECIPE_ITEMS,
  canAfford,
  inventoryFromEntries,
  isFood,
  recipeFor,
  roomFor,
  type Recipe,
} from '@acorn/shared';

import type { HudStore, HudState } from './store';

interface HudProps {
  readonly store: HudStore;
  readonly onPlay: () => void;
}

export function Hud({ store, onPlay }: HudProps): React.JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  return (
    <>
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
        <Row label="Hunger" value={<Hunger state={state} />} />
        <Row label="Health" value={<Health state={state} />} />
        {state.craftMenuOpen ? <Row label="Craft" value={<Crafting state={state} />} /> : null}
        {state.buildMenuOpen ? <Row label="Build" value={<Building state={state} />} /> : null}
      </div>

      {state.ready && state.pointerLocked ? <Hotbar state={state} /> : null}

      {state.ready && !state.pointerLocked ? (
        <div className="hud-curtain" onClick={onPlay} role="presentation">
          <h1>Acorn &amp; Ash</h1>
          <p>
            {state.playerName ? `Welcome, ${state.playerName}. Click to play` : 'Click to play'}
          </p>
          <p>WASD to walk · Shift to sprint · Space to jump · mouse to look · Esc to let go</p>
        </div>
      ) : null}

      {state.ready &&
      state.pointerLocked &&
      (state.fishingNews !== null ||
        state.healthNews !== null ||
        state.cacheNews !== null ||
        state.hungerNews !== null ||
        state.craftingNews !== null ||
        state.huntingNews !== null) ? (
        <p className="hud-news">
          {state.fishingNews ??
            state.healthNews ??
            state.cacheNews ??
            state.hungerNews ??
            state.craftingNews ??
            state.huntingNews}
        </p>
      ) : null}

      {state.ready && state.pointerLocked ? (
        <p
          className={
            state.fishing === 'biting' || state.hunger <= 0 || state.health <= HEALTH_LOW_THRESHOLD
              ? 'hud-hint hud-hint-urgent'
              : 'hud-hint'
          }
        >
          {hint(state)}
        </p>
      ) : null}

      {!state.ready ? (
        <div className="hud-curtain">
          <h1>Acorn &amp; Ash</h1>
          <p>{loadingMessage(state)}</p>
        </div>
      ) : null}
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

/** Every recipe, with its hotkey and cost, lit up green once it could be made right now. */
function Crafting({ state }: { state: HudState }): React.JSX.Element {
  const inventory = inventoryFromEntries(state.carrying);
  return (
    <>
      {RECIPE_ITEMS.map((item, index) => {
        const recipe = recipeFor(item);
        if (recipe === null) return null;
        const ready = roomFor(inventory, item) > 0 && canAfford(inventory, recipe);
        return (
          <span key={item} className={ready ? 'hud-status-good' : undefined}>
            {index > 0 ? ' · ' : ''}[{index + 1}] {ITEM_KINDS[item].displayName} (
            {costLabel(recipe)})
          </span>
        );
      })}
    </>
  );
}

/**
 * Every buildable kind, with its menu number and cost, lit up green once it
 * could be placed right where you are standing.
 */
function Building({ state }: { state: HudState }): React.JSX.Element {
  const inventory = inventoryFromEntries(state.carrying);
  return (
    <>
      {BUILDABLE_KIND_ORDER.map((kind, index) => {
        const buildable = BUILDABLE_KINDS[kind];
        const ready = canAfford(inventory, buildable);
        return (
          <span key={kind} className={ready ? 'hud-status-good' : undefined}>
            {index > 0 ? ' · ' : ''}[{index + 1}] {buildable.displayName} ({costLabel(buildable)})
          </span>
        );
      })}
    </>
  );
}

/** "3 sticks", "2 logs" - however many costs a recipe or buildable has. */
function costLabel(recipe: { readonly costs: Recipe['costs'] }): string {
  return recipe.costs
    .map((cost) => {
      const kind = ITEM_KINDS[cost.item];
      const name = cost.amount === 1 ? kind.displayName : kind.pluralName;
      return `${cost.amount} ${name.toLowerCase()}`;
    })
    .join(', ');
}

/**
 * The strip along the bottom.
 *
 * Whatever you could do right now beats the list of what the keys are. A line
 * in the water beats everything, because the moment matters. Picking something
 * up beats chopping: you are more likely to be reaching for the thing at your
 * feet than swinging at the tree behind it. And a tree or an animal you can
 * swing at beats a cast, the same way round as the server decides it - a tree
 * beats the animal too, if somehow both are in reach at once.
 */
export function hint(state: HudState): string {
  if (state.fishing === 'biting') return "It's biting! Click!";
  if (state.fishing === 'waiting') return 'Watch the float. Click when it goes right under.';
  // Real danger, unlike being hungry: one more hit like the last one and you
  // are knocked out, so this beats everything but an actual bite.
  if (state.health <= HEALTH_LOW_THRESHOLD) return 'Hurt badly - one more hit and you are down';
  // Empty is a clear nudge, so it beats everything but an actual bite: there
  // is nothing worse than being hungry yet, but it should not go unnoticed.
  if (state.hunger <= 0) return hungerHint(state);
  // Asked for a menu, so resolving it beats whatever else is going on - it
  // stays open until a pick closes it or its own key does. Only one is ever
  // open at once, so the order between them here never actually matters.
  if (state.buildMenuOpen) return buildMenuHint();
  if (state.craftMenuOpen) return craftMenuHint();
  // Rooted to the spot until it resolves, so there is nothing else to offer
  // right now - the same reasoning a menu gets, just shorter-lived.
  if (state.charging) return 'Charging a heavy swing - rooted to the spot';
  // Nothing can be carried without a bag, so this beats every hint below
  // that would otherwise send you to press E for nothing.
  const hasBag = state.carrying.some((entry) => entry.item === 'bag');
  if (!hasBag && (state.nearbyItem !== null || state.nearGatherSpot !== null)) {
    return "You'll need something to carry things in first";
  }
  if (state.nearbyItem !== null) {
    return `Press E to pick up the ${ITEM_KINDS[state.nearbyItem].displayName.toLowerCase()}`;
  }
  if (state.nearGatherSpot !== null) {
    return `Press E to gather ${ITEM_KINDS[state.nearGatherSpot].pluralName.toLowerCase()}`;
  }
  if (state.nearBuriedCache) return 'Press E to dig up your buried stash';
  if (state.nearCampfire === 'unlit') return 'Press E to light the campfire';
  if (state.nearCampfire === 'lit') return 'Press E to put out the campfire';
  // A tree or animal only offers a hint once there is an axe to swing: without
  // one the server ignores the click outright (trySwing's own first check), so
  // hinting at it here would send you to click on something that does nothing.
  const hasAxe = state.carrying.some((entry) => entry.item === 'axe');
  if (state.aimedTree !== null && hasAxe) return chopHint(state.aimedTree);
  if (state.aimedAnimal !== null && hasAxe) return catchHint(state.aimedAnimal);
  if (state.canCast) return 'Left click to cast';
  if (state.canBuild) return 'Press B to build';
  // A gentler reminder once nothing more useful is going on.
  if (state.hunger < HUNGER_LOW_THRESHOLD) return hungerHint(state);
  return (
    'WASD to walk · Shift to sprint · Space to jump · mouse to look · Esc to let go · ' +
    'C to craft · B to build'
  );
}

function hungerHint(state: HudState): string {
  const hasFood = state.carrying.some((entry) => isFood(entry.item) && entry.count > 0);
  if (state.hunger <= 0) {
    return hasFood ? "You're hungry. Press E to eat" : "You're hungry. Go catch something to eat";
  }
  return hasFood ? 'Press E to eat · getting hungry' : 'Getting hungry';
}

function chopHint(tree: NonNullable<HudState['aimedTree']>): string {
  const swings = tree.swingsLeft === 1 ? '1 swing left' : `${tree.swingsLeft} swings left`;
  return `Left click to chop the ${tree.name.toLowerCase()} · ${swings}`;
}

function catchHint(animal: NonNullable<HudState['aimedAnimal']>): string {
  const name = animal.name.toLowerCase();
  // Only a threat reports hits left at all - prey is always caught in one.
  if (animal.hitsLeft === undefined) return `Left click to catch the ${name}`;
  const hits = animal.hitsLeft === 1 ? '1 hit left' : `${animal.hitsLeft} hits left`;
  return `Left click to fight off the ${name} · ${hits}`;
}

/** "1 for a campfire, 2 for a cabin" - built from the same order the menu uses. */
function buildMenuHint(): string {
  const choices = BUILDABLE_KIND_ORDER.map(
    (kind, index) => `${index + 1} for ${withArticle(BUILDABLE_KINDS[kind].displayName)}`,
  ).join(', ');
  return `Press ${choices} - or B to cancel`;
}

/** "1 for an axe, 2 for a fishing rod" - built from the same order the menu uses. */
function craftMenuHint(): string {
  const choices = RECIPE_ITEMS.map((item, index) => {
    const recipe = recipeFor(item);
    return recipe === null ? null : `${index + 1} for ${withArticle(ITEM_KINDS[item].displayName)}`;
  }).filter((choice) => choice !== null);
  return `Press ${choices.join(', ')} - or C to cancel`;
}

/** "a fishing rod", but "an axe" - names read oddly with the wrong one. */
function withArticle(name: string): string {
  const lower = name.toLowerCase();
  return /^[aeiou]/.test(lower) ? `an ${lower}` : `a ${lower}`;
}

const HOTBAR_SIZE = 6;

/**
 * The row of slots along the bottom: whatever you are carrying, in pack
 * order, one slot per item kind up to six. Empty slots still show their
 * number, so which key does what never depends on what you happen to be
 * holding.
 */
function Hotbar({ state }: { state: HudState }): React.JSX.Element {
  const slots = Array.from({ length: HOTBAR_SIZE }, (_, index) => state.carrying[index] ?? null);
  return (
    <div className="hotbar">
      {slots.map((entry, index) => (
        <HotbarSlot key={index} slotNumber={index + 1} entry={entry} />
      ))}
    </div>
  );
}

function HotbarSlot({
  slotNumber,
  entry,
}: {
  slotNumber: number;
  entry: HudState['carrying'][number] | null;
}): React.JSX.Element {
  const kind = entry === null ? null : ITEM_KINDS[entry.item];
  const usable = kind !== null && isFood(kind.id);
  return (
    <div
      className={usable ? 'hotbar-slot hotbar-slot-usable' : 'hotbar-slot'}
      title={kind?.displayName}
    >
      <span className="hotbar-slot-key">{slotNumber}</span>
      {kind !== null ? (
        <span
          className="hotbar-slot-icon"
          style={{ backgroundColor: colorOf(kind.placeholderColor) }}
        />
      ) : null}
      {kind !== null && entry !== null && kind.maxCarry > 1 ? (
        <span className="hotbar-slot-count">{entry.count}</span>
      ) : null}
    </div>
  );
}

/** A 0xRRGGBB placeholder colour, as a CSS colour string. */
function colorOf(placeholderColor: number): string {
  return `#${placeholderColor.toString(16).padStart(6, '0')}`;
}

function timeOfDay(state: HudState): string {
  return state.isNight ? 'Night' : 'Day';
}

function renderer(state: HudState): string {
  if (state.backend === 'unknown') return 'starting…';
  return state.forcedFallback ? `${state.backend} (forced)` : state.backend;
}

function loadingMessage(state: HudState): string {
  if (state.connection === 'offline') return 'Cannot reach the world server. Retrying…';
  if (state.connection === 'rejected') return 'This world is full. Try again in a moment.';
  return 'Waking the forest…';
}
