import { DISCOVERIES, ITEM_KINDS, discoveryKnown, type DiscoveryKind } from '@acorn/shared';
import type { HudState } from './store';

export function JournalTabs({
  selected,
  onChange,
  hasGarden = false,
}: {
  selected: 'craft' | 'discoveries' | 'garden' | 'expeditions';
  onChange?: (tab: 'craft' | 'discoveries' | 'garden' | 'expeditions') => void;
  hasGarden?: boolean;
}) {
  return (
    <nav className="hud-journal-tabs" aria-label="Field journal pages">
      {(
        ['craft', 'discoveries', 'expeditions', ...(hasGarden ? ['garden' as const] : [])] as const
      ).map((tab) => (
        <button
          key={tab}
          type="button"
          aria-pressed={selected === tab}
          onClick={() => onChange?.(tab)}
        >
          {tab === 'craft'
            ? 'Crafting'
            : tab === 'garden'
              ? 'Garden'
              : tab === 'expeditions'
                ? 'Expeditions'
                : 'Discoveries'}
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
  onChange?: (tab: 'craft' | 'discoveries' | 'garden' | 'expeditions') => void;
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
      <JournalTabs
        selected="discoveries"
        onChange={onChange}
        hasGarden={state.garden.homeId !== 0}
      />
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
                  ? discovery.kind === 'elkGrove'
                    ? 'Sketch recorded'
                    : discovery.kind === 'guardianHollow'
                      ? 'Trophy collected'
                      : discovery.recipe === null
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
      {kind === 'elkGrove' ? (
        <>
          <path d="M25 52L25 41L33 34L49 34L56 41L56 52M33 34L28 21L20 15L17 5M28 21L33 10L30 4M49 34L55 21L65 15L69 5M55 21L49 10L52 4M34 40L47 40L43 47L39 47Z" />
        </>
      ) : kind === 'raccoonHollow' ? (
        <>
          <path d="M15 30L18 14L30 22L50 22L62 14L66 30L60 48L40 55L20 48Z M23 33L34 37L28 43L20 39ZM57 33L46 37L52 43L60 39ZM35 47H45L40 51Z" />
        </>
      ) : kind === 'guardianHollow' ? (
        <>
          <path d="M24 48V31L31 24H49L56 31V48L40 55ZM28 31L35 35M52 31L45 35M35 44H45M31 24L24 14L15 11L12 3M49 24L56 14L65 11L69 3M24 14L29 5M56 14L51 5" />
        </>
      ) : kind === 'camp' ? (
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
