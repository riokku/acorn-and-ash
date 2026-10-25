import { useState, type CSSProperties } from 'react';
import { ITEM_KINDS } from '../item-catalog';
import { ItemIcon } from './item-icons';

export interface KingVictoryView {
  readonly key: number;
  readonly startedAt: number;
}
/** The world remains controllable throughout. This overlay never takes focus or pointer input. */
export function KingVictory({ victory }: { victory: KingVictoryView }) {
  const [offset] = useState(() => -(performance.now() - victory.startedAt) / 1000);
  return (
    <aside
      className="king-victory"
      data-testid="king-victory"
      data-victory-key={victory.key}
      role="status"
      aria-label="The Hollow King defeated"
      style={{ '--victory-offset': `${offset}s` } as CSSProperties}
    >
      <div className="king-victory-aura" aria-hidden="true" />
      <div className="king-victory-heading">
        <svg className="king-victory-crown" viewBox="0 0 120 80" aria-hidden="true">
          <path d="M18 22L36 42L60 10L84 42L102 22L91 64H29Z" />
          <path d="M30 72H90M45 55H75" />
          <circle cx="60" cy="10" r="4" />
          <circle cx="18" cy="22" r="3" />
          <circle cx="102" cy="22" r="3" />
        </svg>
        <small>THE LAST BELL HAS TOLLED</small>
        <h1>The Hollow King</h1>
        <div className="king-victory-fallen">
          <span />
          HAS FALLEN
          <span />
        </div>
        <p>The crown is broken. The watch is free.</p>
      </div>
      <div className="king-victory-reward">
        <div className="king-victory-sigil" aria-hidden="true">
          <i />
          <ItemIcon item="kingsRequiem" color="#d9b8ff" />
        </div>
        <div>
          <small>EPIC WEAPON REVEALED</small>
          <h2>{ITEM_KINDS.kingsRequiem.displayName}</h2>
          <p>Contributors: collect your personal spoils.</p>
          <span>Crown · enchanted blade · stew · First Bell relic</span>
        </div>
      </div>
    </aside>
  );
}
