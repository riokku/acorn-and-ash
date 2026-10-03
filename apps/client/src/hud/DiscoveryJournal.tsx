import { DISCOVERIES, ITEM_KINDS, discoveryKnown, type DiscoveryKind } from '@acorn/shared';
import type { HudState } from './store';

export function JournalTabs({
  selected,
  onChange,
}: {
  selected: 'craft' | 'discoveries';
  onChange?: (tab: 'craft' | 'discoveries') => void;
}) {
  return (
    <nav className="hud-journal-tabs" aria-label="Field journal pages">
      {(['craft', 'discoveries'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          aria-pressed={selected === tab}
          onClick={() => onChange?.(tab)}
        >
          {tab === 'craft' ? 'Crafting' : 'Discoveries'}
        </button>
      ))}
    </nav>
  );
}
export function DiscoveryJournal({
  state,
  onChange,
}: {
  state: HudState;
  onChange?: (tab: 'craft' | 'discoveries') => void;
}) {
  const found = DISCOVERIES.filter((d) => discoveryKnown(state.discoveriesFound, d.id)).length;
  return (
    <section className="hud-journal hud-discoveries" aria-label="Discovery journal">
      <div className="hud-journal-header">
        <span className="hud-journal-title">Notes from the woods</span>
        <span className="hud-journal-closehint">
          {found} / {DISCOVERIES.length} found · C to close
        </span>
      </div>
      <JournalTabs selected="discoveries" onChange={onChange} />
      <p className="discovery-intro">
        Follow a lead, bring back a useful find, and make yourself at home.
      </p>
      {DISCOVERIES.map((discovery) => {
        const known = discoveryKnown(state.discoveriesFound, discovery.id);
        const claimed = discoveryKnown(state.discoveriesClaimed, discovery.id);
        return (
          <article
            key={discovery.id}
            className={`discovery-entry${known ? ' discovery-entry-found' : ''}`}
          >
            <Sketch kind={discovery.kind} />
            <div>
              <h3>{discovery.name}</h3>
              <p>{known ? discovery.note : discovery.clue}</p>
              <span className="discovery-status">
                {claimed
                  ? discovery.recipe === null
                    ? 'Supplies collected'
                    : `Learned: ${ITEM_KINDS[discovery.recipe].displayName}`
                  : known
                    ? 'Marked on your map · inspect with E for your reward'
                    : 'A lead to follow'}
              </span>
            </div>
          </article>
        );
      })}
    </section>
  );
}
function Sketch({ kind }: { kind: DiscoveryKind }) {
  return (
    <svg
      className="discovery-sketch"
      viewBox="0 0 80 64"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 54Q40 49 75 54M11 58L26 57M52 58L69 59" />
      {kind === 'camp' ? (
        <>
          <path d="M16 50L37 16L61 50Z M37 16L43 50M23 48L31 32L37 48M57 33L64 24L71 33" />
          <path d="M52 49L68 45M56 42L65 51" />
        </>
      ) : kind === 'grove' ? (
        <>
          <path d="M13 37C14 15 47 15 48 37Z M27 37L27 52L35 52L35 37M48 43C48 25 71 25 72 43Z M57 43V53H64V43" />
          <path d="M24 26L27 27M37 29L40 28M57 34L59 35" />
        </>
      ) : kind === 'logging' ? (
        <>
          <path d="M12 44L54 29L66 35L23 51ZM15 34L48 22L59 28L25 40ZM27 27L52 18L61 22L38 31" />
          <ellipse cx="61" cy="35" rx="5" ry="6" />
          <path d="M12 20V38M8 18L14 8L20 18M9 25L14 15L20 25" />
        </>
      ) : (
        <>
          <path d="M14 51V28H22V51M58 51V23H66V51M12 25H24M56 20H68M25 49H55L52 36H29Z M33 36V31H46V36" />
          <path d="M37 30L40 22L43 30M14 39L18 37M60 31L65 28M28 45L32 42" />
        </>
      )}
    </svg>
  );
}
