import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { PaintingBackdrop } from '../backdrop/PaintingBackdrop';

/** Review the actual shared seasonal painting without an account or game world. */
export async function showBackdrop(canvas: HTMLCanvasElement): Promise<void> {
  canvas.hidden = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  flushSync(() =>
    root.render(
      <>
        <PaintingBackdrop />
        <aside
          style={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            right: 20,
            width: 'fit-content',
            maxWidth: 'calc(100vw - 40px)',
            padding: '12px 16px',
            background: '#f8edcf',
            color: '#2f2210',
            border: '2px solid #273b28',
            borderRadius: 7,
            zIndex: 1,
            font: '14px/1.5 system-ui,sans-serif',
          }}
        >
          <strong>Storybook valley</strong>
          <nav
            aria-label="Backdrop season"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 5 }}
          >
            {(['spring', 'summer', 'autumn', 'winter'] as const).map((season) => (
              <a
                key={season}
                href={`?gallery=backdrop&season=${season}`}
                style={{ color: '#304d3e' }}
              >
                {season.charAt(0).toUpperCase() + season.slice(1)}
              </a>
            ))}
          </nav>
        </aside>
      </>,
    ),
  );
  await container.querySelector<HTMLImageElement>('.painting-image')?.decode();
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
