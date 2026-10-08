import { useEffect, useRef, useState } from 'react';

import {
  GEAR_SLOT_LABELS,
  ITEM_KINDS,
  type CharacterId,
  type GearRequest,
  type GearSlot,
  type ItemId,
  type WornGear,
} from '@acorn/shared';

import { CharacterStage } from '../home/character-stage';
import type { Placement } from '../home/showcase';
import { ItemIcon } from './item-icons';
import { Tooltip } from './Tooltip';
import { itemDescription } from './item-description';

/** Set on a gear piece dragged out of the pack: which item it is. */
export const GEAR_ITEM_DRAG_TYPE = 'application/x-acorn-gear-item';
/** Set on a worn piece dragged from its slot: which slot it is in. */
export const GEAR_SLOT_DRAG_TYPE = 'application/x-acorn-gear-slot';

/** Where the character stands in the preview: centred, nearly filling it. */
const PREVIEW_PLACEMENT: Placement = { across: 0.5, feet: 0.05, share: 0.88 };

/** The slots down the left and the right of the figure, as in the old games' paper dolls. */
const LEFT_SLOTS: readonly GearSlot[] = ['helm', 'upperBody', 'lowerBody', 'feet'];
const RIGHT_SLOTS: readonly GearSlot[] = ['hands', 'mainHand', 'offHand'];

function colorOf(placeholderColor: number): string {
  return `#${placeholderColor.toString(16).padStart(6, '0')}`;
}

/**
 * The character screen, opened with Z beside the pack (decision 0113): your
 * character turning in the middle, a slot for each place something can be
 * worn, and the gear in them shown on the model. Drag a piece from the pack
 * onto a slot, or onto an occupied slot to swap; drag between slots to move or
 * swap; right-click a worn piece to take it off. Appearance only, for now.
 */
export function CharacterPanel({
  worn,
  look,
  notice,
  onChange,
}: {
  worn: Readonly<WornGear>;
  look: { readonly character: CharacterId; readonly tint: number } | null;
  notice: { readonly text: string; readonly key: number } | null;
  onChange: (request: GearRequest) => void;
}): React.JSX.Element {
  return (
    <div className="character-panel" data-testid="character-panel">
      <div className="hud-journal-header">
        <span className="hud-journal-title">Your character</span>
        <span className="hud-journal-closehint">Drag gear onto a slot · Z to close</span>
      </div>
      <div className="character-panel-body">
        <div className="gear-column">
          {LEFT_SLOTS.map((slot) => (
            <GearSlotView key={slot} slot={slot} worn={worn} onChange={onChange} />
          ))}
        </div>
        <GearPreview look={look} worn={worn} />
        <div className="gear-column">
          {RIGHT_SLOTS.map((slot) => (
            <GearSlotView key={slot} slot={slot} worn={worn} onChange={onChange} />
          ))}
        </div>
      </div>
      <p className="character-panel-note" role="status" key={notice?.key ?? 0}>
        {notice?.text ?? 'Gear changes how you look. You cannot change it in a fight.'}
      </p>
    </div>
  );
}

/** One place on the body, showing what is worn there or an empty outline. */
function GearSlotView({
  slot,
  worn,
  onChange,
}: {
  slot: GearSlot;
  worn: Readonly<WornGear>;
  onChange: (request: GearRequest) => void;
}): React.JSX.Element {
  const item = worn[slot];
  const kind = item === undefined ? null : ITEM_KINDS[item];
  const [over, setOver] = useState(false);

  const accepts = (types: readonly string[]): boolean =>
    types.includes(GEAR_ITEM_DRAG_TYPE) || types.includes(GEAR_SLOT_DRAG_TYPE);

  const classes = ['gear-slot'];
  if (item !== undefined) classes.push('gear-slot-filled');
  if (over) classes.push('gear-slot-over');

  const label =
    kind === null || item === undefined ? (
      <>
        <strong>{GEAR_SLOT_LABELS[slot]}</strong>
        <span className="item-tooltip-detail">Empty. Drag a piece here from your pack.</span>
      </>
    ) : (
      <>
        <strong>{kind.displayName}</strong>
        <span className="item-tooltip-detail">{itemDescription(item)}</span>
        <span className="item-tooltip-action">Right-click to take off · drag to swap</span>
      </>
    );

  return (
    <Tooltip label={label}>
      <div
        className={classes.join(' ')}
        data-testid={`gear-slot-${slot}`}
        data-item={item ?? ''}
        draggable={item !== undefined}
        role="button"
        tabIndex={0}
        aria-label={`${GEAR_SLOT_LABELS[slot]}: ${kind?.displayName ?? 'empty'}`}
        onDragStart={(event) => {
          if (item === undefined) return;
          event.dataTransfer.setData('text/plain', item);
          event.dataTransfer.setData(GEAR_SLOT_DRAG_TYPE, slot);
        }}
        onDragOver={(event) => {
          if (!accepts(event.dataTransfer.types)) return;
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const dragged = event.dataTransfer.getData(GEAR_ITEM_DRAG_TYPE) as ItemId | '';
          const from = event.dataTransfer.getData(GEAR_SLOT_DRAG_TYPE) as GearSlot | '';
          if (dragged !== '') onChange({ action: 'wear', item: dragged, slot });
          else if (from !== '') onChange({ action: 'swap', from, to: slot });
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          if (item !== undefined) onChange({ action: 'takeOff', slot });
        }}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && item !== undefined) {
            event.preventDefault();
            onChange({ action: 'takeOff', slot });
          }
        }}
      >
        {kind !== null && item !== undefined ? (
          <ItemIcon item={item} color={colorOf(kind.placeholderColor)} className="gear-slot-icon" />
        ) : (
          <span className="gear-slot-label">{GEAR_SLOT_LABELS[slot]}</span>
        )}
      </div>
    </Tooltip>
  );
}

/**
 * The turning model. It is the same real character the game draws, in its own
 * small canvas; if the browser cannot draw it the slots still work.
 */
function GearPreview({
  look,
  worn,
}: {
  look: { readonly character: CharacterId; readonly tint: number } | null;
  worn: Readonly<WornGear>;
}): React.JSX.Element {
  const holder = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<CharacterStage | null>(null);

  useEffect(() => {
    const parent = holder.current;
    if (parent === null) return undefined;
    const canvas = document.createElement('canvas');
    canvas.className = 'gear-preview-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Your character. Drag to turn them.');
    canvas.setAttribute('data-testid', 'gear-preview');
    canvas.dataset.state = 'loading';
    parent.append(canvas);

    let cancelled = false;
    let opened: CharacterStage | null = null;
    CharacterStage.open(canvas).then(
      (next) => {
        if (cancelled) {
          next.dispose();
          return;
        }
        opened = next;
        setStage(next);
      },
      (error: unknown) => {
        console.warn('The character could not be drawn on the character screen.', error);
        canvas.dataset.state = 'unavailable';
      },
    );
    return () => {
      cancelled = true;
      opened?.dispose();
      canvas.remove();
      setStage(null);
    };
  }, []);

  useEffect(() => {
    if (stage === null || look === null) return;
    stage.place(PREVIEW_PLACEMENT);
    stage.setGear(worn);
    stage.show(look);
  }, [stage, look?.character, look?.tint]);

  useEffect(() => {
    stage?.setGear(worn);
  }, [stage, worn]);

  return <div ref={holder} className="gear-preview" />;
}
