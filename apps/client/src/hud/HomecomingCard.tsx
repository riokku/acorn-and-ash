import { useEffect, useState } from 'react';
import type { HomecomingSummary } from './homecoming';
import { gainedLabel } from './item-words';
import { ItemIcon } from './item-icons';

/** A quiet receipt; no modal, reward claim or interruption to movement. */
export function HomecomingCard({ summary }: { summary: HomecomingSummary }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setDismissed(true), 14000);
    return () => window.clearTimeout(timer);
  }, []);
  if (dismissed) return null;
  return (
    <section className="homecoming-card" aria-label="Outing recap" role="status">
      <button type="button" aria-label="Dismiss outing recap" onClick={() => setDismissed(true)}>
        ×
      </button>
      <span className="homecoming-eyebrow">A trail worth taking</span>
      <h2>Home again</h2>
      {summary.gathered.length > 0 ? (
        <>
          <p>Gathered on this outing</p>
          <ul>
            {summary.gathered.slice(0, 4).map(({ item, count }) => (
              <li key={item}>
                <ItemIcon item={item} color="currentColor" />
                <span>{gainedLabel(item, count)}</span>
              </li>
            ))}
          </ul>
          {summary.gathered.length > 4 ? (
            <p>And {summary.gathered.length - 4} more kinds of finds.</p>
          ) : null}
        </>
      ) : null}
      {summary.discoveries > 0 ? (
        <p>
          {summary.discoveries} new {summary.discoveries === 1 ? 'place' : 'places'} discovered.
        </p>
      ) : null}
      <small>Store your finds, cook a meal and settle in.</small>
    </section>
  );
}
