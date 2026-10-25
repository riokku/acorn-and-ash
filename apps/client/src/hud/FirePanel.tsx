import {
  FIRE_CAPACITY_MS,
  FIRE_LOG_MS,
  FIRE_MAX_LOGS,
  inventoryFromEntries,
  roomFor,
  type FireRequest,
} from '@acorn/shared';
import type { HudState, FirePanelState } from './store';

export function FirePanel({
  fire,
  state,
  onRequest,
  onClose,
  onOpenMeals,
}: {
  fire: FirePanelState;
  state: HudState;
  onRequest?: (request: FireRequest) => void;
  onClose?: () => void;
  onOpenMeals?: () => void;
}): React.JSX.Element {
  const logs = state.carrying.find((entry) => entry.item === 'log')?.count ?? 0;
  const available = state.connection === 'connected' && onRequest !== undefined;
  const storage = fire.mode === 'storage';
  const full = fire.remainingMs + FIRE_LOG_MS > FIRE_CAPACITY_MS;
  const seconds = Math.ceil(fire.remainingMs / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const request = (action: FireRequest['action'], amount?: number) =>
    onRequest?.({ propId: fire.propId, action, ...(amount === undefined ? {} : { amount }) });
  const room = roomFor(inventoryFromEntries(state.carrying), 'log');
  return (
    <section
      className="fire-panel"
      data-testid={storage ? 'log-storage' : 'fire-fuel'}
      style={{ left: fire.x, top: fire.y }}
      aria-label={storage ? 'Cabin log storage' : 'Fire fuel'}
    >
      {storage ? (
        <button type="button" aria-label="Close log storage" onClick={onClose}>
          Close
        </button>
      ) : null}
      <strong>{storage ? 'Log storage' : fire.lit ? 'Fire burning' : 'Fire out'}</strong>
      <span>{storage ? `${fire.storedLogs} / ${fire.capacity} logs` : `${time} remaining`}</span>
      <meter
        aria-label={storage ? 'Stored logs' : 'Fire burn time'}
        min={0}
        max={storage ? fire.capacity : FIRE_CAPACITY_MS}
        value={storage ? fire.storedLogs : fire.remainingMs}
      />
      <p>
        {storage
          ? 'Move logs to your pack to fuel a fire.'
          : `10 minutes per log · holds ${FIRE_MAX_LOGS} logs`}
      </p>
      <div className="fire-panel-actions">
        {storage ? (
          <>
            <button
              type="button"
              disabled={!available || !fire.yours || logs === 0 || fire.storedLogs >= fire.capacity}
              onClick={() => request('storeLogs', 1)}
            >
              Store 1
            </button>
            <button
              type="button"
              disabled={!available || !fire.yours || logs === 0 || fire.storedLogs >= fire.capacity}
              onClick={() => request('storeLogs', 50)}
            >
              Store all
            </button>
            <button
              type="button"
              disabled={!available || !fire.yours || fire.storedLogs === 0 || room === 0}
              onClick={() => request('takeLogs', 1)}
            >
              Take 1
            </button>
            <button
              type="button"
              disabled={!available || !fire.yours || fire.storedLogs === 0 || room === 0}
              onClick={() => request('takeLogs', 5)}
            >
              Take 5
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={!available || logs === 0 || full}
              onClick={() => request('addLog')}
            >
              {full ? 'Fire full' : fire.lit ? 'Add log · +10m' : 'Add log & light'}
            </button>
            <button
              type="button"
              disabled={!available || fire.remainingMs <= 0}
              onClick={() => request('toggle')}
            >
              {fire.lit ? 'Put out' : 'Light'}
            </button>
          </>
        )}
      </div>
      {!storage && onOpenMeals ? (
        <button type="button" className="fire-prepare-meals" onClick={onOpenMeals}>
          Prepare meals
        </button>
      ) : null}
      <small>
        {storage && !fire.yours
          ? "This is another player's log pile."
          : `${logs} log${logs === 1 ? '' : 's'} in your pack`}
      </small>
    </section>
  );
}
