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
              return (
                <button
                  key={id}
                  type="button"
                  className={
                    'home-character' +
                    (selected && kind.available ? ' home-character-selected' : '')
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
                  {selected && kind.available ? (
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
            {TINT_COLOR_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className={'home-color' + (id === color ? ' home-color-selected' : '')}
                style={{ background: hexString(TINT_COLORS[id].hex) }}
                onClick={() => setColor(id)}
                aria-label={`Tint: ${TINT_COLORS[id].displayName}`}
              />
            ))}
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
      stroke="#171310"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
