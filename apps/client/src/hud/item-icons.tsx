import type { BuildableKindId, ItemId } from '@acorn/shared';

/** Every item or buildable kind this module can draw a shape for. */
type IconId = ItemId | BuildableKindId;

/**
 * A small flat shape per item or buildable kind, in a shared 24x24 box, built
 * from the same "two or three simple primitives" idiom every placeholder in
 * this game already uses (a stem and a sphere for a flower, a handle and a
 * blade for an axe) - nobody has real icon art yet, so these stand in for it.
 * Every shape is a single flat fill, set by the caller (normally the thing's
 * own `placeholderColor`), so a slot still reads by colour at a glance the
 * same way it always has, just as a recognisable outline now instead of a
 * plain square.
 */
const ICON_SHAPES: Record<IconId, React.JSX.Element> = {
  axe: (
    <g transform="rotate(32 12 12)">
      <rect x="10.5" y="6" width="3" height="16" rx="1.5" />
      <polygon points="6,3 18,3 12,10" />
    </g>
  ),
  log: (
    <>
      <rect x="2" y="9" width="16" height="6" rx="2" />
      <circle cx="17.5" cy="12" r="4" />
    </>
  ),
  rod: (
    <g transform="rotate(25 12 12)">
      <rect x="11" y="2" width="2" height="20" rx="1" />
      <circle cx="12" cy="7" r="2.2" />
    </g>
  ),
  perch: fish(),
  trout: fish(),
  goldenCarp: fish(),
  stick: (
    <g transform="rotate(20 12 12)">
      <rect x="11" y="3" width="2" height="18" rx="1" />
      <rect x="11" y="9" width="5" height="1.6" rx="0.8" />
    </g>
  ),
  meat: (
    <>
      <ellipse cx="9" cy="9" rx="7.5" ry="6.5" />
      <rect x="14" y="13" width="3.2" height="9" rx="1.6" transform="rotate(15 15.6 17.5)" />
      <circle cx="18.5" cy="21" r="2.6" />
    </>
  ),
  flower: (
    <>
      <circle cx="12" cy="7" r="3.5" />
      <circle cx="16.8" cy="10.5" r="3.5" />
      <circle cx="14.9" cy="16" r="3.5" />
      <circle cx="9.1" cy="16" r="3.5" />
      <circle cx="7.2" cy="10.5" r="3.5" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  bag: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="3" />
      <rect x="6" y="6" width="12" height="5" rx="2" />
    </>
  ),
  campfire: <polygon points="12,2 15,9 18,8 15,15 17,20 12,23 7,20 9,15 6,8 9,9" />,
  cabin: <polygon points="12,3 21,10 21,21 3,21 3,10" />,
  flowerBed: (
    <>
      <rect x="4" y="14" width="16" height="6" rx="1.5" />
      <circle cx="8" cy="11" r="3" />
      <circle cx="12" cy="9" r="3" />
      <circle cx="16" cy="11" r="3" />
    </>
  ),
  lantern: (
    <>
      <rect x="7" y="9" width="10" height="12" rx="2" />
      <rect x="10" y="4" width="4" height="5" rx="1" />
      <rect x="6" y="13" width="12" height="1.5" />
    </>
  ),
};

/** Body and tail, the one shape shared by every fish - only the fill colour tells them apart. */
function fish(): React.JSX.Element {
  return (
    <>
      <ellipse cx="10" cy="12" rx="7" ry="4" />
      <polygon points="17,12 22,8 22,16" />
    </>
  );
}

function GameIcon({
  id,
  color,
  className,
}: {
  id: IconId;
  color: string;
  className?: string;
}): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      {ICON_SHAPES[id]}
    </svg>
  );
}

export function ItemIcon({
  item,
  color,
  className,
}: {
  item: ItemId;
  color: string;
  className?: string;
}): React.JSX.Element {
  return <GameIcon id={item} color={color} className={className} />;
}

export function BuildableIcon({
  kind,
  color,
  className,
}: {
  kind: BuildableKindId;
  color: string;
  className?: string;
}): React.JSX.Element {
  return <GameIcon id={kind} color={color} className={className} />;
}
