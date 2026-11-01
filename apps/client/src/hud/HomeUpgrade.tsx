import {
  BUILDABLE_KINDS,
  HOME_TIERS,
  blueprintForHome,
  combineHomeSupplies,
  countOf,
  inventoryFromEntries,
  knowsHome,
  nextHome,
  type HomeKind,
} from '@acorn/shared';
import { ITEM_KINDS } from '../item-catalog';
import type { HudState } from './store';
import { BuildableIcon, ItemIcon } from './item-icons';

const BENEFITS: Record<HomeKind, string> = {
  tent: 'Your first bed and private storage. A place to return after every outing.',
  teepee: 'A sheltered cooking fire for warm meals, and more room to settle in.',
  cabin: 'A proper woodland cabin with a workbench and a shelf for 20 firewood logs.',
  largeCabin: 'Your roomiest retreat, an indoor garden and storage for 50 firewood logs.',
};

type UpgradeState = Pick<
  HudState,
  'homeKind' | 'home' | 'homeSkills' | 'carrying' | 'homeStoredSupplies'
>;

/** Existing home progression, using the same pack + private chest totals as building. */
export function HomeUpgrade({
  state,
  onUpgrade,
}: {
  state: UpgradeState;
  onUpgrade?: () => void;
}): React.JSX.Element {
  const target = nextHome(state.homeKind);
  const reached = state.homeKind === null ? -1 : HOME_TIERS.indexOf(state.homeKind);
  const pack = inventoryFromEntries(state.carrying);
  const supplies =
    state.homeKind === null ? pack : combineHomeSupplies(pack, state.homeStoredSupplies);
  const costs = target === null ? [] : BUILDABLE_KINDS[target].costs;
  const needed = costs.reduce((sum, cost) => sum + cost.amount, 0);
  const gathered = costs.reduce(
    (sum, cost) => sum + Math.min(cost.amount, countOf(supplies, cost.item)),
    0,
  );
  const progress = needed === 0 ? 100 : Math.round((gathered / needed) * 100);
  const known = target === null || knowsHome(state.homeSkills, target);
  const blueprint = target === null ? null : blueprintForHome(target);
  return (
    <section className="home-upgrade" aria-label="Your next shelter" data-testid="home-upgrade">
      <ol className="home-upgrade-tiers" aria-label="Shelter journey">
        {HOME_TIERS.map((kind, index) => (
          <li
            key={kind}
            data-reached={index <= reached}
            aria-current={kind === state.homeKind ? 'step' : undefined}
          >
            <span aria-hidden="true">{index <= reached ? '✓' : index + 1}</span>
            {BUILDABLE_KINDS[kind].displayName}
          </li>
        ))}
      </ol>
      <div className="homestead-project-heading">
        <BuildableIcon kind={target ?? 'largeCabin'} color="#76533a" />
        <div>
          <small>{target === null ? 'Look how far you have come' : 'Your next shelter'}</small>
          <h4>
            {target === null ? 'A home in the wilderness' : BUILDABLE_KINDS[target].displayName}
          </h4>
        </div>
      </div>
      <p className="homestead-benefit">{BENEFITS[target ?? 'largeCabin']}</p>
      {target !== null ? (
        <>
          <div
            className="homestead-progress"
            role="progressbar"
            aria-label="Shelter materials"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <strong className="homestead-rank">{progress}% of materials gathered</strong>
          <div className="home-upgrade-materials">
            {costs.map((cost) => {
              const have = countOf(supplies, cost.item);
              const stored = Math.max(0, have - countOf(pack, cost.item));
              return (
                <div key={cost.item} data-ready={have >= cost.amount}>
                  <strong>
                    <ItemIcon item={cost.item} color="#76533a" />
                    {Math.min(have, cost.amount)}/{cost.amount}{' '}
                    {ITEM_KINDS[cost.item].pluralName.toLowerCase()}
                  </strong>
                  <small>
                    {countOf(pack, cost.item)} in pack · {stored} stored
                    {have < cost.amount ? ` · find ${cost.amount - have} more` : ' · ready'}
                  </small>
                </div>
              );
            })}
          </div>
          <p>
            {state.homeKind === null
              ? 'Gather the materials in your pack, then choose a clear spot for your first home.'
              : 'Supplies in your pack and private home chest count together. Stored supplies stay safe between outings; upgrades use your existing home site.'}
          </p>
          <p className="home-upgrade-blueprint" data-known={known}>
            {known
              ? '✓ Blueprint learned'
              : `Learn the ${blueprint === null ? 'home blueprint' : ITEM_KINDS[blueprint].displayName.toLowerCase()} before building.`}
          </p>
          <button
            type="button"
            disabled={!known || gathered < needed || state.home !== null || !onUpgrade}
            onClick={onUpgrade}
          >
            {!known
              ? 'Blueprint needed'
              : gathered < needed
                ? 'Keep bringing supplies home'
                : state.home !== null
                  ? 'Step outside to upgrade'
                  : state.homeKind === null
                    ? 'Choose your first home site'
                    : 'Preview your home upgrade'}
          </button>
        </>
      ) : (
        <p>
          Your shelter journey is complete. Make it yours with a garden, useful projects and
          keepsakes from your adventures.
        </p>
      )}
    </section>
  );
}
