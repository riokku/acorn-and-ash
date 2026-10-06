import { PaintingBackdrop } from '../backdrop/PaintingBackdrop';
import type { HudState } from './store';

/** The progress bar reports completed preparation stages, rather than elapsed time. */
export function LoadingScreen({ state }: { state: HudState }): React.JSX.Element {
  const progress = Math.min(100, Math.max(0, state.loadingProgress));
  const detail =
    state.loadingError ??
    (state.connection === 'rejected'
      ? 'This world is full. Try again in a moment.'
      : state.connection === 'elsewhere'
        ? 'You are playing in another tab or window.'
        : state.connection === 'offline'
          ? 'Cannot reach the world server. Retrying…'
          : state.loadingStage);
  return (
    <div className="loading-screen" data-testid="loading-screen">
      <PaintingBackdrop still />
      <div className="loading-brand">
        <span className="loading-brand-mark" aria-hidden="true">
          ✦
        </span>{' '}
        Acorn &amp; Ash
      </div>
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
        {state.loadingError !== null ? (
          <button className="loading-retry" type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        ) : null}
      </div>
      <p className="loading-footer">Take a breath. The forest will be here.</p>
    </div>
  );
}
