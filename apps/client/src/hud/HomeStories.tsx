import { RUMORS, rememberedRumors, TRAIL_PENNANT_SKILL } from '@acorn/shared';

/** A permanent record beside the home projects, with an earned object to bring into the world. */
export function HomeStories({
  cosmetics,
  onKeepsakes,
}: {
  cosmetics: number;
  onKeepsakes?: () => void;
}) {
  const remembered = rememberedRumors(cosmetics),
    unlocked = (cosmetics & TRAIL_PENNANT_SKILL) !== 0;
  return (
    <section className="homestead-stories" aria-label="Stories brought home">
      <span className="homestead-eyebrow">A home with a history</span>
      <h4>Stories brought home</h4>
      <p>
        {remembered.length === 0
          ? 'Your next woodland rumor can become the first story remembered here.'
          : remembered.length === RUMORS.length
            ? 'A keeper of woodland stories. Every recovered promise has a place here.'
            : `${remembered.length} of ${RUMORS.length} woodland stories remembered.`}
      </p>
      <ul>
        {RUMORS.map((rumor) => (
          <li key={rumor.id} data-remembered={remembered.some((r) => r.id === rumor.id)}>
            <span aria-hidden="true">{remembered.some((r) => r.id === rumor.id) ? '✓' : '◇'}</span>{' '}
            {rumor.name}
            {remembered.some((r) => r.id === rumor.id) ? ' · brought home' : ' · a trail ahead'}
          </li>
        ))}
      </ul>
      <p>
        {unlocked
          ? 'Your trail pennant recipe is learned. Build it beside your door so visitors see a home between adventures.'
          : 'Recover a rumor bundle to learn the trail pennant recipe; three ordinary outings also unlock it.'}
      </p>
      {onKeepsakes ? (
        <button type="button" onClick={onKeepsakes}>
          See your earned keepsakes
        </button>
      ) : null}
    </section>
  );
}
