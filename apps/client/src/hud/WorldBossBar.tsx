import type { HudState } from './store';

export function WorldBossBar({
  boss,
}: {
  boss: NonNullable<HudState['worldBoss']>;
}): React.JSX.Element {
  const fraction = Math.max(0, Math.min(1, boss.health / boss.maxHealth));
  return (
    <aside className="world-boss" data-testid="world-boss" aria-label="The Hollow King encounter">
      <small>WORLD BOSS · 3–5 PREPARED PLAYERS</small>
      <strong>The Hollow King</strong>
      <div
        className="world-boss-health"
        role="progressbar"
        aria-label="The Hollow King's health"
        aria-valuemin={0}
        aria-valuemax={boss.maxHealth}
        aria-valuenow={boss.health}
      >
        <span style={{ width: `${fraction * 100}%` }} />
      </div>
      <span>
        {boss.awakening
          ? 'The king awakens…'
          : fraction <= 0.5
            ? 'Enraged · beware the whirlwind'
            : 'Ancient armor · counter after his attacks'}
      </span>
    </aside>
  );
}
