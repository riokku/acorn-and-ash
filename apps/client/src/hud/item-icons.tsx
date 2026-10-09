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
  refinedAxe: (
    <>
      <g transform="rotate(32 12 12)">
        <rect x="10.5" y="6" width="3" height="16" rx="1.5" />
        <polygon points="6,3 18,3 12,10" />
      </g>
      <path d="M19 14L20 17L23 18L20 19L19 22L18 19L15 18L18 17Z" />
    </>
  ),
  refinedRod: (
    <>
      <g transform="rotate(25 12 12)">
        <rect x="11" y="2" width="2" height="20" rx="1" />
        <circle cx="12" cy="7" r="2.2" />
      </g>
      <path d="M19 14L20 17L23 18L20 19L19 22L18 19L15 18L18 17Z" />
    </>
  ),
  rowboat: (
    <>
      <path d="M1 12H23C22 18 17 21 12 21C7 21 2 18 1 12Z" />
      <g transform="rotate(-38 12 8)">
        <rect x="11" y="1" width="2" height="14" rx="1" />
        <ellipse cx="12" cy="2.5" rx="2.2" ry="2.8" />
      </g>
    </>
  ),
  fishDisplay: (
    <path d="M3 21H21V19H13V16Q5 17 3 10Q7 3 15 7L22 4V15L16 12Q15 15 13 16V19H11V16H9V19H3Z" />
  ),
  goldenFishDisplay: (
    <path d="M3 21H21V19H13V16Q5 17 3 10Q7 3 15 7L22 4V15L16 12Q15 15 13 16V19H11V16H9V19H3ZM10 1L12 4L10 7L8 4Z" />
  ),
  sentinelTrophy: (
    <>
      <path d="M4 21H20V18H4ZM8 17V11L5 7L7 2L10 5L12 2L14 5L17 2L19 7L16 11V17Z" />
    </>
  ),
  trailPennant: (
    <>
      <path d="M4 2H6V22H4ZM7 4H21V16L14 12L7 16Z" />
    </>
  ),
  guardianTrophy: (
    <>
      <path d="M4 21H20V18H4ZM9 18V12L4 7V2H6V6L10 9H14L18 6V2H20V7L15 12V18Z" />
    </>
  ),
  berry: (
    <>
      <circle cx="8" cy="14" r="4" />
      <circle cx="16" cy="14" r="4" />
      <path d="M8 8L12 3L16 8Z" />
    </>
  ),
  mushroom: (
    <>
      <path d="M2 12C3 1 21 1 22 12Z" />
      <rect x="9" y="12" width="6" height="10" rx="2" />
    </>
  ),
  trailRation: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="3" />
      <path d="M11 4H13V22H11Z" />
    </>
  ),
  forestStew: (
    <>
      <path d="M3 11H21C21 24 3 24 3 11Z" />
      <path d="M7 3H9V8H7ZM15 2H17V8H15Z" />
    </>
  ),
  berryTea: (
    <>
      <path d="M4 8H17V20H4Z" />
      <path d="M17 10H22V17H17V14H19V12H17Z" />
      <path d="M9 2H11V6H9Z" />
    </>
  ),
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
  roastedPerch: roastedFish(),
  roastedTrout: roastedFish(),
  roastedGoldenCarp: roastedFish(),
  stick: (
    <g transform="rotate(20 12 12)">
      <rect x="11" y="3" width="2" height="18" rx="1" />
      <rect x="11" y="9" width="5" height="1.6" rx="0.8" />
    </g>
  ),
  reed: (
    <>
      <rect x="6" y="6" width="2" height="16" rx="1" />
      <rect x="11" y="2" width="2" height="20" rx="1" />
      <rect x="16" y="8" width="2" height="14" rx="1" />
      <ellipse cx="7" cy="5.5" rx="1.8" ry="3.2" />
      <ellipse cx="12" cy="3" rx="1.8" ry="3.2" />
      <ellipse cx="17" cy="7.5" rx="1.8" ry="3.2" />
    </>
  ),
  rope: (
    <>
      <path
        d="M12 1.5A8.5 8.5 0 1 1 12 18.5A8.5 8.5 0 1 1 12 1.5ZM12 3.7A6.3 6.3 0 1 0 12 16.3A6.3 6.3 0 1 0 12 3.7Z"
        fillRule="evenodd"
      />
      <path
        d="M12 5.7A4.3 4.3 0 1 1 12 14.3A4.3 4.3 0 1 1 12 5.7ZM12 7.9A2.1 2.1 0 1 0 12 12.1A2.1 2.1 0 1 0 12 7.9Z"
        fillRule="evenodd"
      />
      <path d="M10.8 17.5H13.2V20.4Q13.2 21 13.8 21H19V23H13.2Q10.8 23 10.8 20.6Z" />
    </>
  ),
  meat: meat(),
  roastedMeat: roastedMeat(),
  bone: (
    <g transform="rotate(-35 12 12)">
      <rect x="5" y="10.2" width="14" height="3.6" rx="1.4" />
      <circle cx="4.6" cy="9.6" r="2.6" />
      <circle cx="4.6" cy="14.4" r="2.6" />
      <circle cx="19.4" cy="9.6" r="2.6" />
      <circle cx="19.4" cy="14.4" r="2.6" />
    </g>
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
  fernLantern: (
    <>
      <rect x="8" y="5" width="8" height="13" rx="2" />
      <path d="M5 20H19V22H5ZM12 2V5M12 7L9 12L12 15L15 12Z" stroke="currentColor" />
    </>
  ),
  moonLantern: (
    <>
      <rect x="8" y="5" width="8" height="13" rx="2" />
      <path d="M5 20H19V22H5ZM12 2V5M13 8C8 8 8 15 13 15C10 12 10 10 13 8Z" stroke="currentColor" />
    </>
  ),
  flowerPlanter: (
    <>
      <path d="M5 14H19L17 22H7Z" />
      <path d="M12 14V7M8 10L12 13L16 10" stroke="currentColor" />
      <circle cx="12" cy="5" r="4" />
    </>
  ),
  cedarBench: (
    <>
      <rect x="3" y="9" width="18" height="4" rx="1" />
      <path d="M5 13H8V21H5ZM16 13H19V21H16Z" />
    </>
  ),
  timberTable: (
    <>
      <rect x="2" y="6" width="20" height="5" rx="1" />
      <path d="M4 11H7V22H4ZM17 11H20V22H17Z" />
    </>
  ),
  wovenRug: (
    <>
      <path d="M3 5H21V19H3Z" />
      <path d="M0 7H3M0 11H3M0 15H3M21 7H24M21 11H24M21 15H24" stroke="currentColor" />
      <path d="M8 12L12 8L16 12L12 16Z" fill="var(--parchment,#e8dbc2)" />
    </>
  ),
  campfire: <polygon points="12,2 15,9 18,8 15,15 17,20 12,23 7,20 9,15 6,8 9,9" />,
  tent: <polygon points="12,3 23,21 1,21 9,16 12,8 15,16" />,
  teepee: <polygon points="10,1 12,5 14,1 15,2 13,7 22,22 14,22 12,15 10,22 2,22 11,7 9,2" />,
  largeCabin: <polygon points="8,3 15,9 15,13 20,8 24,13 24,21 2,21 2,9" />,
  teepeeBlueprint: blueprint(),
  cabinBlueprint: blueprint(),
  largeCabinBlueprint: blueprint(),
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
  fence: (
    <>
      <rect x="3" y="4" width="2.5" height="17" rx="1" />
      <rect x="18.5" y="4" width="2.5" height="17" rx="1" />
      <rect x="2" y="8" width="20" height="2.2" rx="1" />
      <rect x="2" y="15" width="20" height="2.2" rx="1" />
    </>
  ),
  gardenPath: (
    <>
      <ellipse cx="7" cy="18" rx="4.5" ry="3" transform="rotate(-10 7 18)" />
      <ellipse cx="14.5" cy="11.5" rx="4.5" ry="3" transform="rotate(8 14.5 11.5)" />
      <ellipse cx="19" cy="5" rx="4" ry="2.6" transform="rotate(-6 19 5)" />
    </>
  ),
  knightHelmet: (
    <>
      <path d="M4 20V11C4 5 8 2 12 2C16 2 20 5 20 11V20H15V14H9V20Z" />
      <rect x="8" y="9" width="8" height="2" />
    </>
  ),
  mageHat: <path d="M12 1L17 15H23V18H1V15H7Z" />,
  bearHat: (
    <>
      <circle cx="5.5" cy="6" r="3" />
      <circle cx="18.5" cy="6" r="3" />
      <path d="M3 20C3 10 7 6 12 6C17 6 21 10 21 20Z" />
    </>
  ),
  rogueMask: (
    <path d="M2 8C6 6 9 8 12 8C15 8 18 6 22 8C22 15 18 19 12 19C6 19 2 15 2 8ZM6 10H10V12H6ZM14 10H18V12H14Z" />
  ),
  travelerTunic: <path d="M8 2H16L22 6L19 11L17 10V22H7V10L5 11L2 6Z" />,
  travelerTrousers: <path d="M6 2H18L19 22H13L12 10L11 22H5Z" />,
  leatherBoots: <path d="M5 2H11V12L19 15C21 16 21 20 19 20H4C3 20 3 19 4 18Z" />,
  leatherGloves: (
    <path d="M6 22V12L4 8L6 7L8 10V3H10V9V2H12V9V3H14V10V5H16V14L18 12L20 14L16 20V22Z" />
  ),
  ironSword: (
    <g transform="rotate(35 12 12)">
      <rect x="10.8" y="1" width="2.4" height="14" rx="0.8" />
      <rect x="7" y="15" width="10" height="2" />
      <rect x="11" y="17" width="2" height="5" />
    </g>
  ),
  huntingKnife: (
    <g transform="rotate(35 12 12)">
      <path d="M12 3L14.5 12H9.5Z" />
      <rect x="9" y="12" width="6" height="1.6" />
      <rect x="10.8" y="13.6" width="2.4" height="7" rx="1" />
    </g>
  ),
  woodenShield: (
    <>
      <path d="M12 2L20 5V12C20 17 16 20 12 22C8 20 4 17 4 12V5Z" />
    </>
  ),
  stone: <path d="M3 18L6 9L11 5L17 6L21 12L20 18L12 21Z" />,
  ironOre: (
    <>
      <path d="M3 18L6 10L11 6L16 8L19 14L17 20L8 21Z" />
      <path d="M17 3L18 5L20 6L18 7L17 9L16 7L14 6L16 5Z" />
    </>
  ),
  shovel: (
    <g transform="rotate(25 12 12)">
      <rect x="11" y="1" width="2" height="13" rx="1" />
      <rect x="9" y="1" width="6" height="2" rx="1" />
      <path d="M7 13H17L16 20Q12 24 8 20Z" />
    </g>
  ),
  torch: (
    <g transform="rotate(15 12 12)">
      <rect x="10.5" y="10" width="3" height="12" rx="1.2" />
      <circle cx="12" cy="7" r="4.2" />
    </g>
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

/** A cooked fish keeps the same silhouette, with two simple grill marks. */
function roastedFish(): React.JSX.Element {
  return (
    <>
      {fish()}
      <rect x="7" y="8" width="1.4" height="8" rx="0.7" transform="rotate(25 7.7 12)" />
      <rect x="11" y="8" width="1.4" height="8" rx="0.7" transform="rotate(25 11.7 12)" />
    </>
  );
}

function meat(): React.JSX.Element {
  return (
    <>
      <ellipse cx="9" cy="9" rx="7.5" ry="6.5" />
      <rect x="14" y="13" width="3.2" height="9" rx="1.6" transform="rotate(15 15.6 17.5)" />
      <circle cx="18.5" cy="21" r="2.6" />
    </>
  );
}

function roastedMeat(): React.JSX.Element {
  return (
    <>
      {meat()}
      <rect x="5" y="5" width="1.4" height="9" rx="0.7" transform="rotate(35 5.7 9.5)" />
      <rect x="9" y="4" width="1.4" height="10" rx="0.7" transform="rotate(35 9.7 9)" />
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

function blueprint(): React.JSX.Element {
  return (
    <g>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path
        d="M6 12 L12 7 L18 12 M8 12 V18 H16 V12"
        fill="none"
        stroke="#f5edda"
        strokeWidth="1.3"
      />
    </g>
  );
}
