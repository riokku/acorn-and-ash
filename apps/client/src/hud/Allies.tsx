import { RESCUE, TICK_HZ } from '@acorn/shared';
import type { HudState } from './store';

export function Allies({ allies }: { allies: NonNullable<HudState['allies']> }) {
  const down = allies.find((ally) => ally.self && ally.downTicks > 0);
  const nearby = allies.filter((ally) => !ally.self).slice(0, 8);
  if (!down && nearby.length === 0) return null;
  return (
    <aside className="allies" aria-label="Nearby adventurers" data-testid="allies">
      {down ? (
        <div className="rescue-self" role="status">
          <strong>Hold on — help can reach you</strong>
          <span>
            {Math.ceil(down.downTicks / TICK_HZ)}s until you return home · belongings remain where
            you fell
          </span>
          {down.rescueTicks > 0 ? <span>An ally is helping you up…</span> : null}
        </div>
      ) : null}
      {nearby.map((ally) => (
        <div className="ally" key={ally.netId} data-down={ally.downTicks > 0}>
          <strong>{ally.name}</strong>
          <progress aria-label={`${ally.name}'s health`} max={ally.maxHealth} value={ally.health} />
          {ally.downTicks > 0 ? (
            <>
              <span>
                {ally.inReach ? 'Hold E · help them up (3s)' : 'Needs help · move closer'} ·{' '}
                {Math.ceil(ally.downTicks / TICK_HZ)}s
              </span>
              <progress
                aria-label={`Helping ${ally.name}`}
                max={RESCUE.holdTicks}
                value={ally.rescueTicks}
              />
            </>
          ) : ally.health / ally.maxHealth <= 0.3 ? (
            <span>Low health</span>
          ) : null}
        </div>
      ))}
    </aside>
  );
}
