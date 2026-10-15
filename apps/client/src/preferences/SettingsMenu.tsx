import { useEffect, useRef, useState } from 'react';
import { DeleteCharacterPanel, type DeleteCharacter } from '../home/DeleteCharacterPanel';
import { KEYBINDINGS } from './keybindings';

import { MAX_SENSITIVITY, MIN_SENSITIVITY, type Preferences } from './preferences';

interface SettingsMenuProps {
  /** Whatever was chosen last time, read by whoever mounts this - see `main.ts`. */
  readonly initial: Preferences;
  /**
   * Called with the full, updated set of preferences on every slider move.
   * This component never touches storage or audio itself - see `main.ts`,
   * which is the one place that both are wired up. Keeping this component
   * free of that keeps it safe to import from anywhere, including from a
   * plain unit test of an unrelated pure function that happens to live in
   * the same file as whatever renders it.
   */
  readonly onChange: (preferences: Preferences) => void;
  readonly onOpenChange?: (open: boolean) => void;
  /** Where the Account section's Sign out lives. Left out, there is no such section. */
  readonly account?: SettingsAccount;
}

/**
 * What the Account section needs (decision 0104). It is told what is going on
 * and reports what was pressed; the countdown itself lives with the game.
 */
export interface SettingsAccount {
  /** How long signing out takes: 0 signs out at once, as on the character screen. */
  readonly waitSeconds: number;
  /** Seconds left while a sign-out is counting down, or null when none is. */
  readonly secondsLeft: number | null;
  readonly onSignOut: () => void;
  readonly onCancelSignOut: () => void;
  /**
   * Where Delete character lives (decision 0108). Left out, there is no such button:
   * somebody with no character in this world has nothing to delete.
   */
  readonly deleteCharacter?: DeleteCharacter;
}

/**
 * A gear button that opens a small panel of sliders: music, sound effects and
 * mouse sensitivity. Purely presentational, the same way `Home` is about
 * identity - so both the Home screen and the in-game curtain can drop it in
 * with just the two props above.
 */
export function SettingsMenu({
  initial,
  onChange,
  onOpenChange,
  account,
}: SettingsMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const gear = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const changeOpen = (next: boolean): void => {
    onOpenChange?.(next);
    setOpen(next);
    if (!next) gear.current?.focus();
  };
  const [section, setSection] = useState<'general' | 'keybindings'>('general');
  const [preferences, setPreferences] = useState<Preferences>(initial);

  const change = (changes: Partial<Preferences>): void => {
    const next = { ...preferences, ...changes };
    setPreferences(next);
    onChange(next);
  };

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const closeWithEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onOpenChange?.(false);
      setOpen(false);
      gear.current?.focus();
    };
    window.addEventListener('keydown', closeWithEscape, true);
    return () => window.removeEventListener('keydown', closeWithEscape, true);
  }, [open, onOpenChange]);

  return (
    <>
      <button
        type="button"
        className="settings-button"
        ref={gear}
        aria-label="Settings"
        onClick={(event) => {
          event.stopPropagation();
          changeOpen(true);
        }}
      >
        <GearIcon />
      </button>

      {open ? (
        <div
          className="settings-backdrop"
          role="presentation"
          onClick={(event) => {
            event.stopPropagation();
            changeOpen(false);
          }}
        >
          <div
            className={`settings-card${section === 'keybindings' ? ' settings-card-keybindings' : ''}`}
            aria-modal="true"
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Escape') {
                event.preventDefault();
                changeOpen(false);
              } else if (event.key === 'Tab') {
                const buttons = event.currentTarget.querySelectorAll<HTMLElement>('button, input');
                const first = buttons[0];
                const last = buttons[buttons.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }
            }}
            onKeyUp={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="Settings"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="settings-header">
              <h2>Settings</h2>
              <button
                type="button"
                className="settings-close"
                ref={closeButton}
                aria-label="Close settings"
                onClick={() => changeOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="settings-tabs" role="tablist" aria-label="Settings sections">
              <button
                id="settings-general-tab"
                type="button"
                role="tab"
                aria-selected={section === 'general'}
                aria-controls="settings-general"
                onClick={() => setSection('general')}
              >
                General
              </button>
              <button
                id="settings-keybindings-tab"
                type="button"
                role="tab"
                aria-selected={section === 'keybindings'}
                aria-controls="settings-keybindings"
                onClick={() => setSection('keybindings')}
              >
                Keybindings
              </button>
            </div>
            {section === 'general' ? (
              <div id="settings-general" role="tabpanel" aria-labelledby="settings-general-tab">
                <SliderRow
                  label="Music volume"
                  value={preferences.musicVolume}
                  min={0}
                  max={1}
                  onChange={(value) => change({ musicVolume: value })}
                />
                <SliderRow
                  label="Sound effects volume"
                  value={preferences.sfxVolume}
                  min={0}
                  max={1}
                  onChange={(value) => change({ sfxVolume: value })}
                />
                <SliderRow
                  label="Grass density"
                  value={preferences.grassDensity}
                  min={0}
                  max={1}
                  onChange={(value) => change({ grassDensity: value })}
                />
                <SliderRow
                  label="Mouse sensitivity"
                  value={preferences.lookSensitivity}
                  min={MIN_SENSITIVITY}
                  max={MAX_SENSITIVITY}
                  onChange={(value) => change({ lookSensitivity: value })}
                />
                {account !== undefined ? (
                  <AccountSection
                    account={account}
                    // With a wait, the panel gets out of the way so the player can see the
                    // count and stand still; without one they are about to leave anyway.
                    onSignedOut={() => changeOpen(false)}
                  />
                ) : null}
              </div>
            ) : (
              <div
                id="settings-keybindings"
                className="keybindings-reference"
                role="tabpanel"
                aria-labelledby="settings-keybindings-tab"
              >
                <p className="keybindings-intro">
                  Your guide to the woods. These are the current controls.
                </p>
                <div className="keybindings-groups">
                  {KEYBINDINGS.map((group) => (
                    <section key={group.title}>
                      <h3>{group.title}</h3>
                      <dl>
                        {group.bindings.map(([key, action]) => (
                          <div key={key}>
                            <dt>{key}</dt>
                            <dd>{action}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function AccountSection({
  account,
  onSignedOut,
}: {
  account: SettingsAccount;
  onSignedOut: () => void;
}): React.JSX.Element {
  const counting = account.secondsLeft !== null;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { deleteCharacter } = account;
  return (
    <section className="settings-account" aria-labelledby="settings-account-heading">
      <h3 id="settings-account-heading">Account</h3>
      <p className="settings-account-note" role="status">
        {counting
          ? `Signing out in ${account.secondsLeft}…`
          : account.waitSeconds > 0
            ? `Takes ${account.waitSeconds} seconds. Stand still and stay safe: moving or getting hurt cancels it.`
            : 'Takes you back to the front page. Your character is kept for next time.'}
      </p>
      <button
        type="button"
        className="settings-signout"
        onClick={() => {
          if (counting) {
            account.onCancelSignOut();
            return;
          }
          account.onSignOut();
          if (account.waitSeconds > 0) onSignedOut();
        }}
      >
        {counting ? 'Cancel sign out' : 'Sign out'}
      </button>
      {deleteCharacter === undefined ? null : confirmingDelete ? (
        <DeleteCharacterPanel
          characterName={deleteCharacter.characterName}
          onDelete={deleteCharacter.onDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      ) : (
        <button
          type="button"
          className="settings-delete-character"
          onClick={() => setConfirmingDelete(true)}
        >
          Delete character…
        </button>
      )}
    </section>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}): React.JSX.Element {
  return (
    <label className="settings-row">
      <span className="settings-row-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="settings-row-value">{Math.round(value * 100)}%</span>
    </label>
  );
}

/**
 * A simple cog: a ring with eight teeth spaced evenly around it. Built from
 * plain shapes rather than a hand-drawn path, so its correctness does not
 * depend on getting a long string of curve coordinates right by eye.
 */
function GearIcon(): React.JSX.Element {
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {teeth.map((angle) => (
        <rect
          key={angle}
          x="10.5"
          y="1"
          width="3"
          height="5"
          rx="1"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="12" cy="12" r="2.1" />
    </svg>
  );
}
