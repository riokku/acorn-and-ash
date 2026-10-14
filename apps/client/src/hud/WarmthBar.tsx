import type { WarmthView } from '@acorn/shared';
export function warmthExplanation(warmth: WarmthView): string {
  if (warmth.heat === 'fire') return 'Warming by the campfire';
  if (warmth.heat === 'indoors') return 'Sheltered indoors';
  if (warmth.status === 'freezing')
    return `Freezing — health loss in ${warmth.secondsToDamage ?? 0}s. Find a lit campfire, shelter or warmer gear.`;
  if (warmth.status === 'cold')
    return 'Getting cold — find a lit campfire, shelter or warmer gear.';
  if (warmth.status === 'cooling')
    return 'Cooling — warm clothing helps. Winter needs 60 Warmth; blizzards need 80.';
  if (warmth.status === 'warming') return 'Warming up';
  return 'Comfortably warm';
}
export function WarmthBar({ warmth }: { warmth: WarmthView }): React.JSX.Element {
  const explanation = warmthExplanation(warmth);
  const warning = warmth.status === 'cold' || warmth.status === 'freezing';
  return (
    <section
      className={warning ? 'warmth-meter warmth-meter-warning' : 'warmth-meter'}
      data-testid="warmth-meter"
      data-status={warmth.status}
    >
      <div
        role="meter"
        aria-label="Body warmth"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={warmth.value}
        aria-valuetext={explanation}
        title={explanation}
      >
        <span>Body warmth</span>
        <strong>{warmth.value}</strong>
        <div className="warmth-meter-track">
          <div style={{ width: `${warmth.value}%` }} />
        </div>
      </div>
      <p role="status" aria-live="polite">
        {explanation}
      </p>
    </section>
  );
}
