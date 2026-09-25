import './styles.css';

import { DEFAULT_WORLD_ID_FALLBACK, readSettings } from './settings';
import { Game } from './game';
import { HudStore } from './hud/store';
import { mountHud } from './hud/mount';
import { mountHome } from './home/mount';
import { readIdentity, writeIdentity } from './home/identity';
import type { PlayerIdentity } from './home/identity';

const canvas = document.getElementById('scene');
const hudContainer = document.getElementById('hud');
const homeContainer = document.getElementById('home');

if (!(canvas instanceof HTMLCanvasElement) || hudContainer === null || homeContainer === null) {
  throw new Error('The page is missing its canvas, HUD or Home container');
}

const settings = readSettings(window.location.search);
const hud = new HudStore();

// A read-only hook for the smoke tests and for poking at a live game while
// playtesting. It exposes nothing the server would ever trust.
declare global {
  interface Window {
    acornDebug?: ReturnType<Game['debug']>;
  }
}

const enterWorld = (identity: PlayerIdentity): void => {
  writeIdentity(window.localStorage, identity);

  const game = new Game({
    canvas,
    hud,
    identity,
    worldId: settings.worldId ?? DEFAULT_WORLD_ID_FALLBACK,
    ...(settings.serverUrl === undefined ? {} : { serverUrlOverride: settings.serverUrl }),
    forceWebGL: settings.forceWebGL,
  });

  mountHud(hudContainer, hud, () => game.requestPointerLock());
  window.acornDebug = game.debug();

  game.start().catch((error: unknown) => {
    console.error('Could not start the game', error);
    hud.publish({ connection: 'offline', connectionDetail: String(error) });
  });
};

const unmountHome = mountHome(homeContainer, readIdentity(window.localStorage), (identity) => {
  unmountHome();
  enterWorld(identity);
});
