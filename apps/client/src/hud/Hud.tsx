import { useSyncExternalStore } from 'react';

import {
  BUILDABLE_KINDS,
  BUILDABLE_KIND_ORDER,
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
        <Row label="Hunger" value={<Hunger state={state} />} />
        <Row label="Carrying" value={carrying(state)} />
        <Row label="Craft" value={<Crafting state={state} />} />
        <Row label="Build" value={<Building state={state} />} />
      </div>

      {state.ready && !state.pointerLocked ? (
        <div className="hud-curtain" onClick={onPlay} role="presentation">
          <h1>Acorn &amp; Ash</h1>
          <p>Click to play</p>
          <p>WASD to walk · Shift to sprint · Space to jump · mouse to look · Esc to let go</p>
        </div>
      ) : null}

      {state.ready &&
      state.pointerLocked &&
      (state.fishingNews !== null ||
        state.hungerNews !== null ||
        state.craftingNews !== null ||
        state.huntingNews !== null) ? (
        <p className="hud-news">
          {state.fishingNews ?? state.hungerNews ?? state.craftingNews ?? state.huntingNews}
        </p>
      ) : null}

      {state.ready && state.pointerLocked ? (
        <p
          className={
            state.fishing === 'biting' || state.hunger <= 0
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
  // Empty is a clear nudge, so it beats everything but an actual bite: there
  // is nothing worse than being hungry yet, but it should not go unnoticed.
  if (state.hunger <= 0) return hungerHint(state);
  // Asked for the menu, so resolving it beats whatever else is going on -
  // it stays open until a pick closes it or B does.
  if (state.buildMenuOpen) return buildMenuHint();
  if (state.nearbyItem !== null) {
    return `Press E to pick up the ${ITEM_KINDS[state.nearbyItem].displayName.toLowerCase()}`;
  }
  if (state.nearGatherSpot) return 'Press E to gather sticks';
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
  return 'WASD to walk · Shift to sprint · Space to jump · mouse to look · Esc to let go';
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
  return `Left click to catch the ${animal.name.toLowerCase()}`;
}

/** "1 for a campfire, 2 for a cabin" - built from the same order the menu uses. */
function buildMenuHint(): string {
  const choices = BUILDABLE_KIND_ORDER.map(
    (kind, index) => `${index + 1} for a ${BUILDABLE_KINDS[kind].displayName.toLowerCase()}`,
  ).join(', ');
  return `Press ${choices} - or B to cancel`;
}

/** What the pack holds, as one short line. */
function carrying(state: HudState): string {
  if (state.carrying.length === 0) return 'nothing yet';
  return state.carrying
    .map((entry) => {
      const kind = ITEM_KINDS[entry.item];
      // A tool you either have or do not; wood and fish are worth counting.
      return kind.maxCarry === 1
        ? kind.displayName
        : `${kind.pluralName} ${entry.count}/${kind.maxCarry}`;
    })
    .join(' · ');
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
