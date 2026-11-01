import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { CURSOR_ART, GAME_CURSOR, LOOT_CURSOR } from '../input/cursors';

/** The images show native-size artwork; hover the panels to try the OS cursor. */
export function showCursors(canvas: HTMLCanvasElement): void {
  canvas.hidden = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  flushSync(() =>
    root.render(
      <main className="cursor-review">
        <style>{`
        html, body { height: auto; min-height: 100%; overflow: auto; background: #ede2c9; color: #302719; }
        .cursor-review { max-width: 900px; margin: 0 auto; padding: 32px; font: 14px/1.5 system-ui, sans-serif; }
        .cursor-review h1 { margin: 0 0 8px; font-size: 28px; }
        .cursor-review p { margin: 0 0 20px; }
        .cursor-review-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(260px,1fr)); gap: 16px; }
        .cursor-review-panel { padding: 24px; border: 2px solid #273b28; border-radius: 7px; }
        .cursor-review-panel h2 { margin: 0 0 16px; font-size: 18px; }
        .cursor-review-paper { background: #f8edcf; color: #302719; }
        .cursor-review-fir { background: #20362f; color: #fff0d1; }
        .cursor-review-sample { min-height: 64px; display: flex; align-items: center; gap: 20px; }
        .cursor-review-sample img { flex: none; }
        .cursor-review-try { min-height: 110px; margin-top: 18px; padding: 16px; border: 1px dashed currentColor; border-radius: 5px; }
      `}</style>
        <h1>Painted cursor review</h1>
        <p>
          Artwork at actual size: a 32px pointer and 40px loot bag, both with a 3,3 hotspot. These
          images show the artwork, not a captured system cursor.
        </p>
        <div className="cursor-review-grid">
          {(['paper', 'fir'] as const).map((surface) => (
            <section className={`cursor-review-panel cursor-review-${surface}`} key={surface}>
              <h2>{surface === 'paper' ? 'Light parchment' : 'Dark fir'}</h2>
              <div className="cursor-review-sample">
                <img src={CURSOR_ART.pointer} width={32} height={32} alt="Normal pointer artwork" />
                <span>Normal pointer</span>
              </div>
              <div className="cursor-review-sample">
                <img src={CURSOR_ART.loot} width={40} height={40} alt="Loot bag cursor artwork" />
                <span>Loot target</span>
              </div>
              <div
                className="cursor-review-try"
                data-cursor="normal"
                style={{ cursor: GAME_CURSOR }}
              >
                Move your pointer here to try the normal cursor.
              </div>
              <div className="cursor-review-try" data-cursor="loot" style={{ cursor: LOOT_CURSOR }}>
                Move your pointer here to try the loot bag.
              </div>
            </section>
          ))}
        </div>
      </main>,
    ),
  );
  document.body.dataset.galleryReady = 'true';
  window.addEventListener(
    'pagehide',
    () => {
      root.unmount();
      container.remove();
    },
    { once: true },
  );
}
