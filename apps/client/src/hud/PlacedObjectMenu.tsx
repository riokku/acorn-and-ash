import { useEffect, useState } from 'react';
import { BUILDABLE_KINDS } from '@acorn/shared';
import type { HudState } from './store';
import { BuildableIcon } from './item-icons';

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
    <section className="placed-object-panel" role="dialog" aria-label="Manage placed object">
      <header className="placed-object-header">
        <BuildableIcon kind={target.kind} color="#496342" className="placed-object-icon" />
        <h2>{BUILDABLE_KINDS[target.kind].displayName}</h2>
        <button type="button" onClick={() => onAction?.('close')}>
          Close
        </button>
      </header>
      <div className="placed-object-body">
        {!target.yours ? (
          <p>Only the owner can move or remove this object.</p>
        ) : (
          <>
            <p className={target.canMove ? undefined : 'placed-object-loss'}>
              {target.canMove
                ? 'Pack up returns all building materials so you can rebuild it.'
                : 'Dismantling returns half the building materials, rounded down.'}
            </p>
            <p className="placed-object-refund">Returns: {target.refund}</p>
            {target.home ? (
              <p className="placed-object-prerequisites">
                Everyone must leave first. Empty the chest and log storage, pack up decorations,
                harvest crops and let fire fuel burn out.
              </p>
            ) : null}
            {!confirming ? (
              <div className="placed-object-actions">
                {target.canMove ? (
                  <button
                    className="placed-object-primary"
                    type="button"
                    disabled={pending}
                    onClick={() => onAction?.('move')}
                  >
                    Move
                  </button>
                ) : null}
                <button
                  className={target.canMove ? undefined : 'placed-object-danger'}
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirming(true)}
                >
                  {label}…
                </button>
              </div>
            ) : (
              <div className="placed-object-confirmation">
                <p>
                  {label} this {BUILDABLE_KINDS[target.kind].displayName.toLowerCase()}?
                </p>
                {target.home ? (
                  <label className="placed-object-confirm-label">
                    Type DISMANTLE to confirm{' '}
                    <input
                      autoFocus
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                    />
                  </label>
                ) : null}
                <div className="placed-object-actions">
                  <button type="button" onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                  <button
                    className={target.canMove ? 'placed-object-primary' : 'placed-object-danger'}
                    type="button"
                    disabled={pending || (target.home && confirmation !== 'DISMANTLE')}
                    onClick={() => onAction?.('reclaim')}
                  >
                    Confirm {label.toLowerCase()}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
