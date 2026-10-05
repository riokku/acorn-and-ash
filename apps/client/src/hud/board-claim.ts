import type { HudState } from './store';

/**
 * What is needed to say who E belongs to. The HUD's own state fits it, and so
 * does a fresh reading from the game, which matters for the press itself:
 * the HUD only updates five times a second.
 */
export interface BoardClaimState {
  readonly atExpeditionBoard?: boolean;
  readonly craftMenuOpen: boolean;
  readonly buildMenuOpen: boolean;
  readonly inventoryOpen: boolean;
  readonly mapOpen: boolean;
  readonly placing: object | null;
  readonly nearbyItem: unknown;
  readonly nearbyPile: unknown;
  readonly nearGatherSpot: unknown;
  readonly nearBuriedCache: boolean;
  readonly nearbyDiscovery: string | null;
  readonly nearCampfire: 'lit' | 'unlit' | null;
  readonly boat: HudState['boat'];
}

/**
 * Whether a press of E right now reads the expedition board.
 *
 * E is the one key for reaching out to what is in front of you, so the board
 * answers to it like everything else does. It never takes E from something
 * that is already waiting for it - something to pick up or gather, a cache to
 * dig up, a find to inspect, a campfire, a rowboat - and the door keeps the
 * press when you are standing in the doorway (`atExpeditionBoard` already
 * leaves that case out). With a menu open or a piece in hand, E is not for
 * the board at all.
 */
export function expeditionBoardClaimsInteract(state: BoardClaimState): boolean {
  if (state.atExpeditionBoard !== true) return false;
  if (state.craftMenuOpen || state.buildMenuOpen || state.inventoryOpen || state.mapOpen)
    return false;
  if (state.placing !== null) return false;
  return (
    state.nearbyItem === null &&
    state.nearbyPile === null &&
    state.nearGatherSpot === null &&
    !state.nearBuriedCache &&
    state.nearbyDiscovery === null &&
    state.nearCampfire === null &&
    state.boat !== 'board'
  );
}

/** Whether the board itself is the page open in the field journal. */
export function expeditionBoardOpen(
  state: Pick<HudState, 'craftMenuOpen' | 'journalTab'>,
): boolean {
  return state.craftMenuOpen && state.journalTab === 'expeditions';
}
