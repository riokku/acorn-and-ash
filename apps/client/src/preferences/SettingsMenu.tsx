import { useEffect, useState } from 'react';
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
}

/**
 * A gear button that opens a small panel of sliders: music, sound effects and
 * mouse sensitivity. Purely presentational, the same way `Home` is about
 * identity - so both the Home screen and the in-game curtain can drop it in
 * with just the two props above.
 */
export function SettingsMenu({ initial, onChange }: SettingsMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<'general' | 'keybindings'>('general');
  const [preferences, setPreferences] = useState<Preferences>(initial);

  const change = (changes: Partial<Preferences>): void => {
    const next = { ...preferences, ...changes };
    setPreferences(next);
    onChange(next);
  };

  // A window listener rather than an onKeyDown on the panel itself: right
  // after opening, focus is still on the gear button that opened it, which
  // sits outside the panel, so a handler on the panel alone would miss it.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="settings-button"
        aria-label="Settings"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
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
            setOpen(false);
          }}
        >
          <div
            className="settings-card"
            role="dialog"
            aria-label="Settings"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="settings-header">
              <h2>Settings</h2>
              <button
                type="button"
                className="settings-close"
                aria-label="Close settings"
                onClick={() => setOpen(false)}
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
            )}
          </div>
        </div>
      ) : null}
    </>
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
