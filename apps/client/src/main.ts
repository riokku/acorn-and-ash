import './styles.css';

import { DEFAULT_WORLD_ID_FALLBACK, readSettings } from './settings';
import { Game } from './game';
import { HudStore } from './hud/store';
import { mountHud } from './hud/mount';
import { readHotbarLayout, writeHotbarLayout } from './hud/hotbar-layout';
import { mountFrontDoor, mountHome, mountTrouble } from './home/mount';
import { findEntrance, type Entrance } from './home/entrance';
import {
  firstTab,
  hasPassedFrontDoor,
  markFrontDoorPassed,
  resetFrontDoor,
} from './home/front-door';
import { SignInError, signInAsTestPlayer, signOut } from './net/account';
import { readIdentity, writeIdentity } from './home/identity';
import { readPreferences, writePreferences, type Preferences } from './preferences/preferences';
import { setMusicVolume, setSfxVolume } from './audio/sound';
import type { PlayerIdentity } from './home/identity';

const canvas = document.getElementById('scene');
const hudContainer = document.getElementById('hud');
const homeContainer = document.getElementById('home');

if (!(canvas instanceof HTMLCanvasElement) || hudContainer === null || homeContainer === null) {
  throw new Error('The page is missing its canvas, HUD or Home container');
}

const settings = readSettings(window.location.search);
const hud = new HudStore();
// Whatever was dragged onto the hotbar last time, before Game ever publishes
// anything else - see decision 0050.
hud.publish({ hotbarSlots: readHotbarLayout(window.localStorage) });

/**
 * Saves a choice from the Settings menu and applies its audio side straight
 * away. The one place both of those happen - the Settings menu itself only
 * reports what changed, the same way `Home` only reports the identity it
 * collected rather than writing it to storage itself.
 */
const applyPreferences = (preferences: Preferences): void => {
  writePreferences(window.localStorage, preferences);
  setMusicVolume(preferences.musicVolume);
  setSfxVolume(preferences.sfxVolume);
};

// Applied up front so the tuned defaults - or whatever was chosen last time -
// are in effect before any sound plays, whether or not the Settings menu is
// ever opened.
const startingPreferences = readPreferences(window.localStorage);
setMusicVolume(startingPreferences.musicVolume);
setSfxVolume(startingPreferences.sfxVolume);

// A read-only hook for the smoke tests and for poking at a live game while
// playtesting. It exposes nothing the server would ever trust.
declare global {
  interface Window {
    acornDebug?: ReturnType<Game['debug']>;
  }
}

const enterWorld = (identity: PlayerIdentity): void => {
  writeIdentity(window.localStorage, identity);

  // Read fresh rather than reusing startingPreferences: the Home screen's own
  // Settings menu can have changed this after the page first loaded.
  const preferencesNow = readPreferences(window.localStorage);

  const game = new Game({
    canvas,
    hud,
    identity,
    worldId: settings.worldId ?? DEFAULT_WORLD_ID_FALLBACK,
    forceWebGL: settings.forceWebGL,
    season: settings.season,
    lookSensitivity: preferencesNow.lookSensitivity,
    grassDensity: preferencesNow.grassDensity,
  });

  mountHud(
    hudContainer,
    hud,
    () => game.resume(),
    () => game.toggleInventory(),
    (item) => game.useItem(item),
    (kind) => game.pickBuildable(kind),
    (nextHotbarSlots) => {
      writeHotbarLayout(window.localStorage, nextHotbarSlots);
      hud.publish({ hotbarSlots: nextHotbarSlots });
    },
    preferencesNow,
    (preferences) => {
      applyPreferences(preferences);
      // Sensitivity has nowhere else to apply to - unlike volume, which the
      // audio module already picks up live on its own.
      game.setLookSensitivity(preferences.lookSensitivity);
      game.setGrassDensity(preferences.grassDensity);
    },
    game.mapFeed,
    () => game.toggleMap(),
    (locked) => game.setDoorLocked(locked),
    (item, amount, destroy) => game.discard(item, amount, destroy),
    game.combatFeed,
    (request) => game.transferChest(request),
    () => game.closeChest(),
    (open) => game.setSettingsOpen(open),
    {
      onTabChange: (tab) => game.setJournalTab(tab),
      onCraftTab: (tab) => game.setCraftTab(tab),
      onPickCraft: (action) => game.pickCraftEntry(action),
      onGarden: (request) => game.useGarden(request),
      onExpedition: (request) => game.chooseExpedition(request),
      onMoveDecoration: (id) => game.moveDecoration(id),
      onReclaimDecoration: (id) => game.reclaimDecoration(id),
    },
  );
  window.acornDebug = game.debug();

  game.start().catch((error: unknown) => {
    console.error('Could not start the game', error);
    hud.publish({
      connection: 'offline',
      connectionDetail: String(error),
      loadingError: 'The view couldn’t start. Please try again.',
    });
  });
};

/**
 * Why a sign-in did not work, when the login service sent the player back with
 * an error. Cleared from the address afterwards so a refresh doesn't repeat it.
 */
function takeSignInNotice(): string | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get('signin') !== 'failed') return null;
  params.delete('signin');
  params.delete('error');
  const rest = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
  return 'That sign-in didn’t go through. Please try again.';
}

let unmountEntrance: (() => void) | null = null;

/** The Home screen, with the character the player already has when they have one. */
const showCharacterScreen = (entrance: Extract<Entrance, { kind: 'home' }>): void => {
  unmountEntrance = mountHome(
    homeContainer,
    readIdentity(window.localStorage),
    {
      name: entrance.accountName,
      saved: entrance.saved,
      onSignOut: () => {
        resetFrontDoor(window.sessionStorage);
        void signOut().finally(() => window.location.reload());
      },
    },
    (identity) => {
      unmountEntrance?.();
      unmountEntrance = null;
      enterWorld(identity);
    },
    startingPreferences,
    applyPreferences,
  );
};

/**
 * The first screen (decision 0103): the front page with its Play button, then
 * either the sign-in choices or, for somebody already signed in, the character
 * screen. Run again after anything that changes who is signed in.
 *
 * Somebody who has pressed Play in this tab, or who came back from a login that
 * did not work, is not asked to press it again.
 */
const showEntrance = async (notice: string | null = null): Promise<void> => {
  unmountEntrance?.();
  unmountEntrance = null;
  const worldId = settings.worldId ?? DEFAULT_WORLD_ID_FALLBACK;

  try {
    const entrance = await findEntrance(window.localStorage, worldId);
    const pastFrontDoor =
      !entrance.frontPage || notice !== null || hasPassedFrontDoor(window.sessionStorage);

    if (entrance.kind === 'home' && pastFrontDoor) {
      showCharacterScreen(entrance);
      return;
    }

    // Coming back from a login that did not work, they already pressed Play.
    if (notice !== null) markFrontDoorPassed(window.sessionStorage);
    unmountEntrance = mountFrontDoor(homeContainer, {
      status: entrance.kind === 'sign-in' ? entrance.status : null,
      notice,
      startAtChoices: pastFrontDoor,
      firstTab: firstTab(readIdentity(window.localStorage).name),
      onPlay: () => {
        markFrontDoorPassed(window.sessionStorage);
        if (entrance.kind !== 'home') return;
        unmountEntrance?.();
        unmountEntrance = null;
        showCharacterScreen(entrance);
      },
      onTestSignIn: () => {
        signInAsTestPlayer().then(
          () => void showEntrance(),
          (error: unknown) => void showEntrance(describeSignInProblem(error)),
        );
      },
    });
  } catch (error) {
    unmountEntrance = mountTrouble(homeContainer, describeSignInProblem(error), () => {
      void showEntrance();
    });
  }
};

function describeSignInProblem(error: unknown): string {
  if (error instanceof SignInError) return error.message;
  return 'We couldn’t reach the game. Check your connection and try again.';
}

// The art gallery (see decision 0053) is its own small page: no server, no
// Home screen, no HUD - just the game's art laid out in daylight to look at.
// Loaded only when asked for, so playing never downloads it.
if (new URLSearchParams(window.location.search).has('gallery')) {
  void import('./gallery/gallery').then(({ startGallery }) => startGallery(canvas));
} else {
  void showEntrance(takeSignInNotice());
}
