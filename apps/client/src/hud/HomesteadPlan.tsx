import {
  HOMESTEAD_PROJECTS,
  BUILDABLE_KINDS,
  countOf,
  inventoryFromEntries,
  type HomesteadProject,
} from '@acorn/shared';
import { ITEM_KINDS } from '../item-catalog';
import type { HudState } from './store';
import { BuildableIcon } from './item-icons';

export function HomesteadPlan({
  state,
  onBuild,
}: {
  state: Pick<HudState, 'homeKind' | 'carrying' | 'homesteadProjects' | 'home'>;
  onBuild?: (kind: HomesteadProject) => void;
}) {
  const built = new Set(state.homesteadProjects ?? []),
    pack = inventoryFromEntries(state.carrying);
  const complete = HOMESTEAD_PROJECTS.filter((project) => built.has(project.kind)).length;
  return (
    <section
      className="homestead-plan"
      aria-label="Make This Place Home"
      data-testid="homestead-plan"
    >
      <header>
        <span className="homestead-eyebrow">Your corner of the wild</span>
        <h3>Make This Place Home</h3>
        <p>
          {complete === 3
            ? 'A thriving trailstead. Your next adventure begins at your own front door.'
            : 'From a bed beneath canvas to a place worth coming back to. Every project adds something you can use.'}
        </p>
        <div
          className="homestead-progress"
          role="progressbar"
          aria-label="Homestead projects"
          aria-valuemin={0}
          aria-valuemax={3}
          aria-valuenow={complete}
        >
          <span style={{ width: `${(complete / 3) * 100}%` }} />
        </div>
        <strong className="homestead-rank">
          {complete === 0
            ? 'Roots in the wilderness'
            : complete === 1
              ? 'Taking root'
              : complete === 2
                ? 'A welcoming retreat'
                : 'Trailstead established'}{' '}
          · {complete}/3 projects
        </strong>
      </header>
      {state.homeKind === null ? (
        <p className="homestead-callout">
          First, place a tent from Home. Your projects fit inside your home’s building boundary and
          stay with this world.
        </p>
      ) : (
        <p className="homestead-callout">
          Build in any order, anywhere clear inside your yard. Gather over several trips, stash
          supplies in your home chest, then take out what you need to build.
        </p>
      )}
      <div className="homestead-chapters">
        {HOMESTEAD_PROJECTS.map((project, index) => {
          const definition = BUILDABLE_KINDS[project.kind],
            done = built.has(project.kind);
          const ready = definition.costs.every((cost) => countOf(pack, cost.item) >= cost.amount);
          const indoors = state.home !== null;
          return (
            <article key={project.kind} data-project={project.kind} data-complete={done}>
              <div className="homestead-project-heading">
                <BuildableIcon kind={project.kind} color={done ? '#bdcd93' : '#dfbf82'} />
                <div>
                  <small>
                    Chapter {index + 1} · {project.chapter}
                  </small>
                  <h4>{definition.displayName}</h4>
                </div>
                <span className="homestead-check" aria-label={done ? 'Built' : 'Not built'}>
                  {done ? '✓' : String(index + 1)}
                </span>
              </div>
              <p className="homestead-benefit">{project.benefit}</p>
              <p>{project.route}</p>
              {!done && (
                <div className="homestead-costs">
                  {definition.costs.map((cost) => (
                    <span key={cost.item} data-ready={countOf(pack, cost.item) >= cost.amount}>
                      {Math.min(countOf(pack, cost.item), cost.amount)}/{cost.amount}{' '}
                      {ITEM_KINDS[cost.item].pluralName.toLowerCase()}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                disabled={done || state.homeKind === null || !ready || indoors}
                onClick={() => onBuild?.(project.kind)}
              >
                {done
                  ? 'Built · part of your homestead'
                  : state.homeKind === null
                    ? 'Place a home first'
                    : indoors
                      ? 'Step outside to build'
                      : ready
                        ? 'Choose a spot'
                        : 'Gather materials'}
              </button>
            </article>
          );
        })}
      </div>
      <footer>
        No daily resets or upkeep. Your pantry stays private; neighbors can use your bench. Empty
        storage and harvest growing plants before reclaiming a project.
      </footer>
    </section>
  );
}
