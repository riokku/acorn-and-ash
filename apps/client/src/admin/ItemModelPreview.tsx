import { useEffect, useRef, useState } from 'react';
import type { ItemId } from '@acorn/shared';
import type { ItemStage } from './item-stage';

export function ItemModelPreview({
  item,
  name,
}: {
  item: ItemId;
  name: string;
}): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState<ItemStage | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  useEffect(() => {
    let disposed = false;
    let opened: ItemStage | null = null;
    import('./item-stage')
      .then((module) =>
        disposed || !canvas.current ? null : module.ItemStage.open(canvas.current),
      )
      .then((next) => {
        if (!next) return;
        if (disposed) next.dispose();
        else {
          opened = next;
          setStage(next);
        }
      })
      .catch(() => {
        if (!disposed) setStatus('unavailable');
      });
    return () => {
      disposed = true;
      opened?.dispose();
    };
  }, []);
  useEffect(() => {
    if (!stage) return;
    let active = true;
    setStatus('loading');
    stage
      .show(item)
      .then((shown) => {
        if (active && shown) setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('unavailable');
      });
    return () => {
      active = false;
    };
  }, [stage, item]);
  return (
    <section className="model-preview" aria-label="Item model">
      <div className="model-preview-heading">
        <span className="eyebrow">In-game model</span>
        <button type="button" onClick={() => stage?.reset()} disabled={status !== 'ready'}>
          Reset view
        </button>
      </div>
      <div className="model-viewport" data-state={status}>
        <canvas
          ref={canvas}
          tabIndex={0}
          aria-label={`${name} model. Drag or use arrow keys to rotate. Home resets the view.`}
        />
        {status !== 'ready' && (
          <p className="model-status">
            {status === 'loading'
              ? 'Loading model…'
              : 'Model preview unavailable. You can still edit this item.'}
          </p>
        )}
      </div>
      <p className="hint">Drag to rotate · Arrow keys to turn · Home to reset</p>
    </section>
  );
}
