import { BUILDABLE_KINDS, BUILDABLE_KIND_ORDER, ITEM_KINDS, ITEM_ORDER } from '@acorn/shared';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { BuildableIcon, ItemIcon, SystemIcon } from '../hud/item-icons';
import { SYSTEM_ICONS, type SystemIconId } from '../hud/painted-icons';

const SIZES = [13, 24, 30, 40] as const;

export function showItemIcons(canvas: HTMLCanvasElement): void {
  canvas.hidden = true;
  const container = document.createElement('div');
  container.className = 'icon-review';
  document.body.append(container);
  const root = createRoot(container);
  flushSync(() =>
    root.render(
      <>
        <style>{`
        html, body { height: auto; min-height: 100%; overflow: auto; background: #ede2c9; color: #302719; }
        .icon-review { max-width: 1450px; margin: auto; padding: 32px; }
        .icon-review h1 { margin: 0 0 8px; font-size: 28px; }
        .icon-review p { margin: 0 0 24px; color: #635440; }
        .icon-review-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
        .icon-review-card { background: #fff9eb; border: 1px solid #d0bea0; border-radius: 8px; padding: 14px; }
        .icon-review-card h2 { margin: 0 0 10px; font-size: 15px; }
        .icon-review-row { display: flex; gap: 8px; padding: 8px; border-radius: 4px; align-items: end; }
        .icon-review-row + .icon-review-row { margin-top: 6px; }
        .icon-review-sample { width: 53px; height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: end; gap: 3px; font-size: 10px; }
        .icon-review-sample svg { display: block; }
        .icon-review-paper { background: #f8edcf; color: #534329; }
        .icon-review-fir { background: #496342; color: #f8edcf; }
      `}</style>
        <main>
          <h1>Item icon review</h1>
          <p>Paper and fir backgrounds at 13, 24, 30 and 40 pixels.</p>
          <div className="icon-review-grid">
            {ITEM_ORDER.map((item) => (
              <section className="icon-review-card" key={item}>
                <h2>{ITEM_KINDS[item].displayName}</h2>
                {(['paper', 'fir'] as const).map((background) => (
                  <div
                    className={`icon-review-row icon-review-${background}`}
                    key={background}
                    aria-label={`${background} background`}
                  >
                    {SIZES.map((size) => (
                      <div className="icon-review-sample" key={size}>
                        <div style={{ width: size, height: size }}>
                          <ItemIcon
                            item={item}
                            color={background === 'paper' ? '#534329' : '#f8edcf'}
                            className="icon-review-image"
                          />
                        </div>
                        <span>{size}px</span>
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            ))}
            {BUILDABLE_KIND_ORDER.map((kind) => (
              <section className="icon-review-card" key={`buildable-${kind}`}>
                <h2>{BUILDABLE_KINDS[kind].displayName} (buildable)</h2>
                {(['paper', 'fir'] as const).map((background) => (
                  <div
                    className={`icon-review-row icon-review-${background}`}
                    key={background}
                    aria-label={`${background} background`}
                  >
                    {SIZES.map((size) => (
                      <div className="icon-review-sample" key={size}>
                        <div style={{ width: size, height: size }}>
                          <BuildableIcon
                            kind={kind}
                            color={background === 'paper' ? '#534329' : '#f8edcf'}
                            className="icon-review-image"
                          />
                        </div>
                        <span>{size}px</span>
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            ))}
            {(Object.keys(SYSTEM_ICONS) as SystemIconId[]).map((icon) => (
              <section className="icon-review-card" key={`system-${icon}`}>
                <h2>{icon} (system)</h2>
                {(['paper', 'fir'] as const).map((background) => (
                  <div
                    className={`icon-review-row icon-review-${background}`}
                    key={background}
                    aria-label={`${background} background`}
                  >
                    {SIZES.map((size) => (
                      <div className="icon-review-sample" key={size}>
                        <SystemIcon icon={icon} size={size} />
                        <span>{size}px</span>
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </div>
        </main>
        <style>{`.icon-review-image { width: 100%; height: 100%; }`}</style>
      </>,
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
