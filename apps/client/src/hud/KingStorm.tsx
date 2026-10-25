import type { Compass } from './cache-compass';
import { SOUL_STORM, TICK_HZ, type KingStormView } from '@acorn/shared';
export function KingStorm({ storm, ward }: { storm: KingStormView; ward?: Compass | null }) {
  const duration =
    storm.phase === 'warning'
      ? SOUL_STORM.warningTicks
      : storm.phase === 'storm'
        ? SOUL_STORM.activeTicks
        : SOUL_STORM.recoveryTicks;
  return (
    <aside
      className="king-storm"
      data-testid="king-storm"
      data-phase={storm.phase}
      data-sheltered={storm.sheltered || storm.outside}
      aria-label="Soul storm"
    >
      <strong role="status">
        {storm.phase === 'warning'
          ? 'SOUL STORM APPROACHING'
          : storm.phase === 'storm'
            ? 'SOUL STORM'
            : 'THE KING IS EXPOSED'}
      </strong>
      <span>
        {storm.phase === 'recovery'
          ? 'The wards held. Counterattack now!'
          : storm.outside
            ? 'Outside the storm · safe'
            : storm.sheltered
              ? 'Ward shelter · protected'
              : 'Exposed · stand inside a glowing ward circle'}
      </span>
      <div>
        <progress
          aria-label={
            storm.phase === 'warning'
              ? 'Time before the soul storm'
              : 'Time remaining in this phase'
          }
          max={duration}
          value={storm.remainingTicks}
        />
        <b>{Math.ceil(storm.remainingTicks / TICK_HZ)}s</b>
      </div>
      {ward && !storm.sheltered && !storm.outside && storm.phase !== 'recovery' ? (
        <span className="king-ward-direction">
          <i aria-hidden="true" style={{ transform: `rotate(${ward.bearingDegrees}deg)` }}>
            ↑
          </i>{' '}
          Nearest ward · {Math.ceil(ward.distanceMeters)}m
        </span>
      ) : null}
      {storm.phase === 'warning' ? (
        <small>Help fallen allies before the storm arrives.</small>
      ) : null}
    </aside>
  );
}
