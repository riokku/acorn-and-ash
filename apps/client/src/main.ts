import './styles.css';

import { DEFAULT_WORLD_ID_FALLBACK, readSettings } from './settings';
import { Game } from './game';
import { HudStore } from './hud/store';
import { mountHud } from './hud/mount';

const canvas = document.getElementById('scene');
const hudContainer = document.getElementById('hud');

if (!(canvas instanceof HTMLCanvasElement) || hudContainer === null) {
  throw new Error('The page is missing its canvas or its HUD container');
}

const settings = readSettings(window.location.search);
const hud = new HudStore();

const game = new Game({
  canvas,
  hud,
  worldId: settings.worldId ?? DEFAULT_WORLD_ID_FALLBACK,
  ...(settings.serverUrl === undefined ? {} : { serverUrlOverride: settings.serverUrl }),
  forceWebGL: settings.forceWebGL,
});

mountHud(hudContainer, hud, () => game.requestPointerLock());

// A read-only hook for the smoke tests and for poking at a live game while
// playtesting. It exposes nothing the server would ever trust.
declare global {
  interface Window {
    acornDebug?: ReturnType<Game['debug']>;
  }
}
window.acornDebug = game.debug();

game.start().catch((error: unknown) => {
  console.error('Could not start the game', error);
  hud.publish({ connection: 'offline', connectionDetail: String(error) });
});
