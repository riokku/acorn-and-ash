import { useState } from 'react';

import {
  CHARACTER_KINDS,
  CHARACTER_ORDER,
  MAX_PLAYER_NAME_LENGTH,
  TINT_COLORS,
  TINT_COLOR_ORDER,
  isValidPlayerName,
  sanitizePlayerName,
  type CharacterId,
  type TintColorId,
} from '@acorn/shared';

import type { PlayerIdentity } from './identity';

interface HomeProps {
  readonly initial: PlayerIdentity;
  readonly onPlay: (identity: PlayerIdentity) => void;
}

/**
 * Shown before the game connects: pick a name, a character and a tint.
 *
 * Knight is the only character with real art today (see decision 0036); the
 * rest of the pack's roster is shown locked, so the picker already has the
 * shape it will need once they are converted.
 */
export function Home({ initial, onPlay }: HomeProps): React.JSX.Element {
  const [name, setName] = useState(initial.name);
  const [character, setCharacter] = useState<CharacterId>(initial.character);
  const [color, setColor] = useState<TintColorId>(initial.color);

  const trimmed = sanitizePlayerName(name);
  const canPlay = isValidPlayerName(trimmed);

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!canPlay) return;
    onPlay({ name: trimmed, character, color });
  };

  return (
    <form className="home-screen" onSubmit={handleSubmit}>
      <ForestBackdrop />
      <div className="home-card">
        <p className="home-kicker">Cozy wilderness survival</p>
        <h1 className="home-title">Acorn &amp; Ash</h1>
        <p className="home-subtitle">Pick who you&rsquo;ll be in the clearing.</p>

        <label className="home-field" htmlFor="home-name">
          <span className="home-label">What should we call you?</span>
          <input
            id="home-name"
            type="text"
            value={name}
            maxLength={MAX_PLAYER_NAME_LENGTH}
            placeholder="e.g. Acorn"
            autoComplete="off"
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
          <span className="home-hint">2&ndash;{MAX_PLAYER_NAME_LENGTH} characters</span>
        </label>

        <div className="home-section">
          <span className="home-label">Your character</span>
          <div className="home-characters">
            {CHARACTER_ORDER.map((id) => {
              const kind = CHARACTER_KINDS[id];
              const selected = id === character;
              const highlighted = selected && kind.available;
              return (
                <button
                  key={id}
                  type="button"
                  className={'home-character' + (highlighted ? ' home-character-selected' : '')}
                  style={
                    highlighted ? { borderColor: hexString(TINT_COLORS[color].hex) } : undefined
                  }
                  disabled={!kind.available}
                  onClick={() => setCharacter(id)}
                  aria-label={
                    kind.available
                      ? `${kind.displayName} — select`
                      : `${kind.displayName} — coming soon`
                  }
                >
                  {!kind.available ? (
                    <span className="home-character-lock" aria-hidden="true">
                      <LockIcon />
                    </span>
                  ) : null}
                  {highlighted ? (
                    <span className="home-character-check" aria-hidden="true">
                      <CheckIcon />
                    </span>
                  ) : null}
                  <PersonIcon
                    color={kind.available ? hexString(TINT_COLORS[color].hex) : undefined}
                  />
                  <span className="home-character-name">{kind.displayName}</span>
                  {!kind.available ? (
                    <span className="home-character-soon">Coming soon</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="home-section">
          <span className="home-label">Your tint</span>
          <div className="home-colors">
            {TINT_COLOR_ORDER.map((id) => {
              const hex = hexString(TINT_COLORS[id].hex);
              const selected = id === color;
              return (
                <button
                  key={id}
                  type="button"
                  className={'home-color' + (selected ? ' home-color-selected' : '')}
                  style={{
                    background: hex,
                    boxShadow: selected ? `0 0 0 3px #f3e6c6, 0 0 0 5px ${hex}` : undefined,
                  }}
                  onClick={() => setColor(id)}
                  aria-label={`Tint: ${TINT_COLORS[id].displayName}`}
                />
              );
            })}
          </div>
        </div>

        <button type="submit" className="home-play" disabled={!canPlay}>
          {canPlay ? `Enter the clearing as ${trimmed}` : 'Enter the clearing'}
        </button>
        <p className="home-footnote">Others in the clearing will see this name.</p>
      </div>
    </form>
  );
}

function hexString(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function PersonIcon({ color }: { color?: string }): React.JSX.Element {
  return (
    <svg
      width="42"
      height="54"
      viewBox="0 0 56 72"
      className="home-character-icon"
      style={color !== undefined ? { color } : undefined}
      aria-hidden="true"
    >
      <circle cx="28" cy="18" r="14" fill="currentColor" />
      <path d="M10 72 C10 48 16 40 28 40 C40 40 46 48 46 72 Z" fill="currentColor" />
    </svg>
  );
}

function LockIcon(): React.JSX.Element {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function CheckIcon(): React.JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fffaf0"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * Pine trees at the edges of the clearing, anchored to the bottom of the
 * screen. Purely decorative - the same silhouettes from the sunlit-grove
 * mockup Chris signed off on.
 */
function ForestBackdrop(): React.JSX.Element {
  return (
    <svg
      className="home-backdrop"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <path d="M0 900 L0 850 Q 360 810 720 845 Q 1080 815 1440 850 L1440 900 Z" fill="#b6cf94" />
      <g fill="#9dbf7c">
        <path d="M170 900 L170 844 L301 855 L221 631 L251 665 L140 340 L29 665 L59 631 L-21 855 L110 844 L110 900 Z" />
        <path d="M1333 900 L1333 842 L1476 854 L1388 622 L1421 656 L1300 320 L1179 656 L1212 622 L1124 854 L1267 842 L1267 900 Z" />
        <path d="M540 900 L540 858 L628 866 L574 698 L594 724 L520 480 L446 724 L466 698 L412 866 L500 858 L500 900 Z" />
        <path d="M942 900 L942 856 L1040 865 L980 689 L1002 715 L920 460 L838 715 L860 689 L800 865 L898 856 L898 900 Z" />
      </g>
      <g fill="#5f8a4a">
        <path d="M-4 900 L-4 815 L239 832 L90 492 L146 543 L-60 50 L-266 543 L-210 492 L-359 832 L-116 815 L-116 900 Z" />
        <path d="M1557 900 L1557 813 L1806 830 L1653 482 L1711 535 L1500 30 L1289 535 L1347 482 L1194 830 L1443 813 L1443 900 Z" />
      </g>
    </svg>
  );
}
