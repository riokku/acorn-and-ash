import { useId } from 'react';

import type { SeasonId } from '@acorn/shared';

import type { SeasonBannerView } from '../hud/season-banner';

/** The colours of the little lake scene inside the hexagon, one set per season. */
interface SceneColours {
  readonly skyTop: string;
  readonly skyBottom: string;
  readonly sun: string;
  readonly sunX: number;
  readonly sunY: number;
  readonly cloud: string;
  readonly cloudLit: string;
  readonly farMountains: string;
  readonly mountain: string;
  readonly mountainShadow: string;
  readonly peakSnow: string;
  readonly haze: string;
  readonly farForest: string;
  readonly lakeTop: string;
  readonly lakeBottom: string;
  readonly reflection: string;
  readonly pine: string;
  readonly pineShadow: string;
  readonly rock: string;
  readonly moss: string;
  /** 1 lays snow on the pines, 0 leaves them bare. */
  readonly snowOnPines: number;
}

interface SeasonLook {
  /** The season's colour: past days' edges and the "Day 3 of 6" chip. */
  readonly accent: string;
  /** The soft halo behind today's edge. */
  readonly glow: string;
  readonly scene: SceneColours;
}

/** Colours from Chris's "Acorn & Ash Seasons" art board. */
const SEASON_LOOKS: Record<SeasonId, SeasonLook> = {
  spring: {
    accent: '#f6b3c8',
    glow: 'rgba(246, 179, 200, 0.28)',
    scene: {
      skyTop: '#f2bfc0',
      skyBottom: '#fce6c8',
      sun: '#fff1c9',
      sunX: -14,
      sunY: -6,
      cloud: '#f7d2cb',
      cloudLit: '#fff0e6',
      farMountains: '#c4b6cf',
      mountain: '#a9a6c9',
      mountainShadow: '#8e8bb3',
      peakSnow: '#f7f1f6',
      haze: '#f8d9cf',
      farForest: '#6e8f7c',
      lakeTop: '#9cc6cc',
      lakeBottom: '#5b8c99',
      reflection: '#fff1d6',
      pine: '#3f6b4c',
      pineShadow: '#2e5239',
      rock: '#5e6e52',
      moss: '#8fa866',
      snowOnPines: 0,
    },
  },
  summer: {
    accent: '#ffd45a',
    glow: 'rgba(255, 212, 90, 0.28)',
    scene: {
      skyTop: '#86c6e4',
      skyBottom: '#fbe4a6',
      sun: '#fff4c2',
      sunX: -12,
      sunY: -22,
      cloud: '#f2e8da',
      cloudLit: '#ffffff',
      farMountains: '#a5b3d2',
      mountain: '#8c9bc4',
      mountainShadow: '#7383b0',
      peakSnow: '#f4f2f8',
      haze: '#e9edd8',
      farForest: '#5e8c6a',
      lakeTop: '#5daabd',
      lakeBottom: '#2f6f80',
      reflection: '#fff3c4',
      pine: '#2f6b43',
      pineShadow: '#22532f',
      rock: '#58694b',
      moss: '#8cb45a',
      snowOnPines: 0,
    },
  },
  autumn: {
    accent: '#f5a05e',
    glow: 'rgba(245, 160, 94, 0.28)',
    scene: {
      skyTop: '#e58450',
      skyBottom: '#f9d07a',
      sun: '#ffe9a8',
      sunX: -14,
      sunY: -4,
      cloud: '#ef9a62',
      cloudLit: '#ffc88a',
      farMountains: '#a98aa6',
      mountain: '#8b7aa8',
      mountainShadow: '#6e5f8e',
      peakSnow: '#f8dccb',
      haze: '#f0b98a',
      farForest: '#5a6e5e',
      lakeTop: '#4a7078',
      lakeBottom: '#22414a',
      reflection: '#ffd78a',
      pine: '#2e4e3e',
      pineShadow: '#203a2e',
      rock: '#4e5a44',
      moss: '#7e8e4a',
      snowOnPines: 0,
    },
  },
  winter: {
    accent: '#8ec3ec',
    glow: 'rgba(142, 195, 236, 0.28)',
    scene: {
      skyTop: '#7d8fc0',
      skyBottom: '#f2c9b4',
      sun: '#ffe6cc',
      sunX: -14,
      sunY: -4,
      cloud: '#c3b2cc',
      cloudLit: '#ead6dc',
      farMountains: '#c9cce2',
      mountain: '#b6c0dc',
      mountainShadow: '#8e9ac2',
      peakSnow: '#ffffff',
      haze: '#ddd0e2',
      farForest: '#5d7384',
      lakeTop: '#d3e1ee',
      lakeBottom: '#a9bfd6',
      reflection: '#fff3e6',
      pine: '#2f4f55',
      pineShadow: '#233d42',
      rock: '#5a6470',
      moss: '#eef3f8',
      snowOnPines: 1,
    },
  },
};

/** The hexagon's six edges, clockwise from the top right: one per day of the season. */
const DAY_EDGES: readonly (readonly [number, number, number, number])[] = [
  [4.7, -47.3, 38.6, -27.7],
  [43.3, -19.6, 43.3, 19.6],
  [38.6, 27.7, 4.7, 47.3],
  [-4.7, 47.3, -38.6, 27.7],
  [-43.3, 19.6, -43.3, -19.6],
  [-38.6, -27.7, -4.7, -47.3],
];

const PINE =
  'M0,-30 L3,-22 L1.5,-22 L5,-14 L2.5,-14 L7,-5 L3.5,-5 L9,4 L-9,4 L-3.5,-5 L-7,-5 L-2.5,-14 L-5,-14 L-1.5,-22 L-3,-22 Z';
const PINE_SHADE = 'M0,-30 L3,-22 L1.5,-22 L5,-14 L2.5,-14 L7,-5 L3.5,-5 L9,4 L0,4 Z';
const FAR_FOREST =
  'M-40,16 L-40,11 L-38.5,8 L-37,11 L-35.5,9 L-34,11 L-32,7 L-30,11 L-28.5,9.5 L-27,11 L-25,8 L-23,11 L-21.5,9 L-20,11 L-18,7.5 L-16,11 L-14,9 L-12,11 L-10,8 L-8,11 L-6.5,9.5 L-5,11 L-3,8.5 L-1,11 L1,9 L3,11 L5,7.5 L7,11 L8.5,9.5 L10,11 L12,8 L14,11 L16,9 L18,11 L20,7 L22,11 L24,9.5 L26,11 L28,8 L30,11 L32,9 L34,11 L36,7.5 L38,11 L40,9 L40,16 Z';

/**
 * The season on the front page under Play: its name on a small dark plate, over
 * a hexagon window onto the valley in that season's colours. The hexagon's six
 * edges are the six days of the season. Days gone by are lit in the season's
 * colour, and today's edge glows white; the day itself is only read aloud.
 */
export function SeasonHexBadge({
  view,
  className = '',
}: {
  readonly view: SeasonBannerView;
  readonly className?: string;
}): React.JSX.Element {
  const look = SEASON_LOOKS[view.season];
  return (
    <div
      className={`season-hex-badge ${className}`.trim()}
      role="status"
      aria-label={`${view.title}, day ${view.day} of ${view.daysInSeason}`}
      data-testid="season-badge"
      data-season={view.season}
    >
      <span className="season-hex-name" aria-hidden="true">
        {view.seasonName}
      </span>
      <SeasonHexagon season={view.season} day={view.day} look={look} />
    </div>
  );
}

function SeasonHexagon({
  season,
  day,
  look,
}: {
  season: SeasonId;
  day: number;
  look: SeasonLook;
}): React.JSX.Element {
  const id = useId();
  const clip = `${id}-clip`;
  const sky = `${id}-sky`;
  const lake = `${id}-lake`;
  const c = look.scene;
  return (
    <svg className="season-hex-picture" viewBox="-50 -50 100 100" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <polygon points="0,-38 32.9,-19 32.9,19 0,38 -32.9,19 -32.9,-19" />
        </clipPath>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.skyTop} />
          <stop offset="1" stopColor={c.skyBottom} />
        </linearGradient>
        <linearGradient id={lake} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.lakeTop} />
          <stop offset="1" stopColor={c.lakeBottom} />
        </linearGradient>
      </defs>
      <polygon points="0,-50 43.3,-25 43.3,25 0,50 -43.3,25 -43.3,-25" fill="#1c1611" />
      {DAY_EDGES.map(([x1, y1, x2, y2], index) => {
        const edgeDay = index + 1;
        const colour =
          edgeDay === day ? '#ffffff' : edgeDay < day ? look.accent : 'rgba(255, 255, 255, 0.13)';
        return (
          <g key={edgeDay} className={edgeDay === day ? 'season-hex-today' : undefined}>
            {edgeDay === day ? (
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={look.glow}
                strokeWidth={11}
                strokeLinecap="round"
              />
            ) : null}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={colour}
              strokeWidth={5.5}
              strokeLinecap="round"
            />
          </g>
        );
      })}
      <g clipPath={`url(#${clip})`}>
        <rect x={-40} y={-40} width={80} height={80} fill={`url(#${sky})`} />
        <circle cx={c.sunX} cy={c.sunY} r={15} fill={c.sun} opacity={0.18} />
        <circle cx={c.sunX} cy={c.sunY} r={9.5} fill={c.sun} opacity={0.35} />
        <circle cx={c.sunX} cy={c.sunY} r={5.5} fill={c.sun} />
        <g transform="translate(6,-27)">
          <ellipse cx={6} cy={2} rx={11} ry={3.5} fill={c.cloud} />
          <circle cx={1} cy={0} r={4} fill={c.cloud} />
          <circle cx={7} cy={-2} r={5.5} fill={c.cloud} />
          <circle cx={12.5} cy={0.5} r={3.5} fill={c.cloud} />
          <circle cx={6} cy={-3.5} r={3.5} fill={c.cloudLit} />
          <circle cx={0.5} cy={-1} r={2.2} fill={c.cloudLit} />
        </g>
        <g transform="translate(-30,-18) scale(0.6)">
          <ellipse cx={6} cy={2} rx={11} ry={3.5} fill={c.cloud} />
          <circle cx={2} cy={0} r={4} fill={c.cloud} />
          <circle cx={8} cy={-1.5} r={5} fill={c.cloud} />
          <circle cx={7} cy={-3} r={3.2} fill={c.cloudLit} />
        </g>
        <path d="M-40,6 L-31,-3 L-25,1 L-18,-6 L-10,2 L-10,10 L-40,10 Z" fill={c.farMountains} />
        <path d="M8,4 L20,-6 L28,-1 L34,-5 L40,-1 L40,10 L8,10 Z" fill={c.farMountains} />
        <path d="M-20,8 L-6,-10 L-2,-7 L6,-22 L14,-12 L18,-14 L32,8 Z" fill={c.mountain} />
        <path d="M6,-22 L14,-12 L18,-14 L32,8 L12,8 L9,-6 Z" fill={c.mountainShadow} />
        <path
          d="M6,-22 L1.8,-14.5 L4.5,-15.5 L6.5,-12.5 L9,-16 L11.5,-14 L14,-12 Z"
          fill={c.peakSnow}
        />
        <path d="M-6,-10 L-8.5,-6.5 L-6,-7.2 L-4,-5.5 L-2,-7 Z" fill={c.peakSnow} />
        <rect x={-40} y={1} width={80} height={12} fill={c.haze} opacity={0.55} />
        <path d={FAR_FOREST} fill={c.farForest} />
        <rect x={-40} y={14} width={80} height={26} fill={`url(#${lake})`} />
        <rect
          x={c.sunX - 6}
          y={17}
          width={12}
          height={1.1}
          rx={0.55}
          fill={c.reflection}
          opacity={0.75}
        />
        <rect
          x={c.sunX - 4}
          y={20.5}
          width={8}
          height={1}
          rx={0.5}
          fill={c.reflection}
          opacity={0.6}
        />
        <rect
          x={c.sunX - 2.5}
          y={24}
          width={5}
          height={0.9}
          rx={0.45}
          fill={c.reflection}
          opacity={0.45}
        />
        <SeasonDetails season={season} />
        <path d="M-40,40 L-40,22 C-34,18 -26,19 -21,24 C-17,25 -14,30 -14,40 Z" fill={c.rock} />
        <path d="M-40,22 C-34,18 -26,19 -21,24 C-26,22.5 -34,21.5 -40,24.5 Z" fill={c.moss} />
        <Pine x={-24} y={15} scale={1.05} colours={c} snow="full" />
        <Pine x={26} y={17} scale={0.85} colours={c} snow="partial" />
        <Pine x={34} y={20} scale={0.6} colours={c} snow="none" />
        {season === 'winter' ? <Snowfall /> : null}
      </g>
    </svg>
  );
}

/** What makes each season its own: blossom, a leafy tree and birds, orange leaves, ice cracks. */
function SeasonDetails({ season }: { season: SeasonId }): React.JSX.Element {
  switch (season) {
    case 'spring':
      return (
        <>
          <Bush x={15} y={14} colours={['#ec93ae', '#f4a9bf', '#fbd0dc']} />
          <circle cx={-4} cy={-14} r={0.9} fill="#fbd0dc" />
          <circle cx={24} cy={-2} r={0.8} fill="#fbd0dc" />
          <circle cx={4} cy={-4} r={0.7} fill="#f4a9bf" />
        </>
      );
    case 'summer':
      return (
        <>
          <Bush x={15} y={14} colours={['#4e9140', '#64a84c', '#8cc765']} />
          <g stroke="#3b4a55" strokeWidth={0.8} strokeLinecap="round" fill="none">
            <path d="M-12,-20 Q-10.5,-21.5 -9,-20 Q-7.5,-21.5 -6,-20" />
            <path d="M-4,-25 Q-3,-26 -2,-25 Q-1,-26 0,-25" />
          </g>
        </>
      );
    case 'autumn':
      return (
        <>
          <Bush x={15} y={14} colours={['#d96a30', '#ec8a3c', '#f6b25a']} />
          <Bush x={-6} y={15} scale={0.7} colours={['#b5432f', '#cc5838']} />
          <ellipse cx={4} cy={-6} rx={1.4} ry={0.7} fill="#ec8a3c" transform="rotate(30 4 -6)" />
          <ellipse
            cx={-12}
            cy={-12}
            rx={1.3}
            ry={0.65}
            fill="#cc5838"
            transform="rotate(-25 -12 -12)"
          />
          <ellipse
            cx={22}
            cy={-18}
            rx={1.2}
            ry={0.6}
            fill="#f6b25a"
            transform="rotate(50 22 -18)"
          />
        </>
      );
    case 'winter':
      return (
        <g stroke="#eef4fa" strokeWidth={0.7} strokeLinecap="round" fill="none" opacity={0.9}>
          <path d="M-4,22 L2,25 L0,29 L6,32" />
          <path d="M2,25 L9,24" />
          <path d="M12,30 L18,27 L24,29" />
        </g>
      );
  }
}

function Bush({
  x,
  y,
  scale = 1,
  colours,
}: {
  x: number;
  y: number;
  scale?: number;
  colours: readonly string[];
}): React.JSX.Element {
  const [side, top, highlight] = colours;
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <rect x={-0.7} y={-3} width={1.4} height={4} fill="#5a4030" />
      <circle cx={-3.4} cy={-4} r={3.4} fill={side} />
      <circle cx={3.4} cy={-4} r={3.4} fill={side} />
      <circle cx={0} cy={-7} r={4.2} fill={top} />
      {highlight === undefined ? null : <circle cx={-1.2} cy={-8.4} r={2.2} fill={highlight} />}
    </g>
  );
}

function Pine({
  x,
  y,
  scale,
  colours,
  snow,
}: {
  x: number;
  y: number;
  scale: number;
  colours: SceneColours;
  snow: 'full' | 'partial' | 'none';
}): React.JSX.Element {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {snow === 'none' ? null : <rect x={-1.2} y={3} width={2.4} height={5} fill="#3e2c21" />}
      <path d={PINE} fill={colours.pine} />
      <path d={PINE_SHADE} fill={colours.pineShadow} />
      {snow === 'none' ? null : (
        <g fill="#f4f7fb" opacity={colours.snowOnPines}>
          <path d="M0,-30 L1.6,-25.5 L-1.6,-25.5 Z" />
          <ellipse cx={-4.4} cy={-14.2} rx={1.8} ry={0.8} />
          <ellipse cx={-6.3} cy={-5.2} rx={2.2} ry={0.9} />
          <ellipse cx={-8.2} cy={3.8} rx={2.3} ry={0.9} />
          {snow === 'full' ? (
            <>
              <ellipse cx={4.2} cy={-14.2} rx={1.4} ry={0.6} />
              <ellipse cx={6.2} cy={-5.2} rx={1.8} ry={0.7} />
            </>
          ) : null}
        </g>
      )}
    </g>
  );
}

function Snowfall(): React.JSX.Element {
  return (
    <g fill="#ffffff">
      <circle cx={-6} cy={-26} r={0.9} />
      <circle cx={20} cy={-20} r={0.8} />
      <circle cx={-16} cy={-8} r={0.8} />
      <circle cx={2} cy={-2} r={0.7} />
      <circle cx={28} cy={-8} r={0.9} />
      <circle cx={-2} cy={20} r={0.7} />
      <circle cx={12} cy={-28} r={0.7} />
    </g>
  );
}
