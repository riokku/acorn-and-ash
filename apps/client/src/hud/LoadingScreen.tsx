import { useState } from 'react';
import { ItemIcon } from './item-icons';
import { PaintingBackdrop } from '../backdrop/PaintingBackdrop';
import type { HudState } from './store';

const TRAIL_TIPS = [
  { item: 'axe', text: 'Equip an axe from your hotbar before chopping trees.' },
  { item: 'roastedMeat', text: 'Roast meat at a lit fire, then pack a meal for your next outing.' },
  { item: 'winterJacket', text: 'Warm clothing and a lit fire help keep you safe in winter.' },
  {
    item: 'bag',
    text: 'After a knockout, follow your recovery compass to collect the belongings you left behind.',
  },
] as const;

/** The progress bar reports completed preparation stages, rather than elapsed time. */
export function LoadingScreen({ state }: { state: HudState }): React.JSX.Element {
  const [tipIndex, setTipIndex] = useState(0);
  const tip = TRAIL_TIPS[tipIndex]!;
  const showTip =
    state.loadingError === null &&
    !['rejected', 'offline', 'elsewhere', 'deleted'].includes(state.connection);
  const progress = Math.min(100, Math.max(0, state.loadingProgress));
  const detail =
    state.loadingError ??
    (state.connection === 'rejected'
      ? state.connectionDetail || 'This world is full. Try again in a moment.'
      : state.connection === 'elsewhere'
        ? 'You are playing in another tab or window.'
        : state.connection === 'deleted'
          ? 'This character was deleted. Starting over…'
          : state.connection === 'offline'
            ? 'Cannot reach the world server. Retrying…'
            : state.loadingStage);
  return (
    <div className="loading-screen" data-testid="loading-screen">
      <PaintingBackdrop still />
      <div className="loading-copy">
        <p className="loading-eyebrow">A little further from the everyday</p>
        <h1>Entering the woods…</h1>
        <p className="loading-description">There’s a place for you among the evergreens.</p>
        <div
          className="loading-progress"
          role="progressbar"
          aria-label="Entering the woods"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-valuetext={`${progress}% · ${detail}`}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="loading-status">
          <span role={state.loadingError !== null ? 'alert' : 'status'}>{detail}</span>
          <span>{progress}%</span>
        </div>
        {showTip ? (
          <aside className="loading-tip" aria-label="Trail tip">
            <ItemIcon item={tip.item} color="#496342" className="loading-tip-icon" />
            <div className="loading-tip-body">
              <div className="loading-tip-heading">
                <strong>Trail tip</strong>
                <span>
                  {tipIndex + 1} of {TRAIL_TIPS.length}
                </span>
              </div>
              <p>{tip.text}</p>
              <button
                type="button"
                onClick={() => setTipIndex((index) => (index + 1) % TRAIL_TIPS.length)}
              >
                Next tip
              </button>
            </div>
          </aside>
        ) : null}
        {state.loadingError !== null || state.connection === 'rejected' ? (
          <button className="loading-retry" type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        ) : null}
      </div>
      <p className="loading-footer">Take a breath. The forest will be here.</p>
    </div>
  );
}
