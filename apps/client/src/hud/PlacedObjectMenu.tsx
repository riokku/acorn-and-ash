import { useEffect, useState } from 'react';
import { BUILDABLE_KINDS } from '@acorn/shared';
import type { HudState } from './store';

export function PlacedObjectMenu({
  target,
  pending,
  onAction,
}: {
  target: NonNullable<HudState['placedObject']>;
  pending: boolean;
  onAction?: (action: 'close' | 'move' | 'reclaim') => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onAction?.('close');
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onAction]);
  const label = target.canMove ? 'Pack up' : 'Dismantle';
  return (
    <section
      role="dialog"
      aria-label="Manage placed object"
      style={{
        position: 'fixed',
        right: 24,
        top: '25%',
        zIndex: 100,
        pointerEvents: 'auto',
        maxWidth: 320,
        padding: 20,
        borderRadius: 12,
        background: '#20291e',
        color: '#fff4db',
        border: '1px solid #b6a474',
      }}
    >
      <h2>{BUILDABLE_KINDS[target.kind].displayName}</h2>
      <button type="button" onClick={() => onAction?.('close')}>
        Close
      </button>
      {!target.yours ? (
        <p>Only the owner can move or remove this object.</p>
      ) : (
        <>
          <p>
            {target.canMove
              ? 'Pack up returns all building materials so you can rebuild it.'
              : 'Dismantling returns half the building materials, rounded down.'}
          </p>
          <p>Returns: {target.refund}</p>
          {target.home ? (
            <p>
              Everyone must leave first. Empty the chest and log storage, pack up decorations,
              harvest crops and let fire fuel burn out.
            </p>
          ) : null}
          {!confirming ? (
            <>
              {target.canMove ? (
                <button type="button" disabled={pending} onClick={() => onAction?.('move')}>
                  Move
                </button>
              ) : null}
              <button type="button" disabled={pending} onClick={() => setConfirming(true)}>
                {label}…
              </button>
            </>
          ) : (
            <>
              <p>
                {label} this {BUILDABLE_KINDS[target.kind].displayName.toLowerCase()}?
              </p>
              {target.home ? (
                <label>
                  Type DISMANTLE to confirm{' '}
                  <input
                    autoFocus
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </label>
              ) : null}
              <button type="button" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || (target.home && confirmation !== 'DISMANTLE')}
                onClick={() => onAction?.('reclaim')}
              >
                Confirm {label.toLowerCase()}
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
