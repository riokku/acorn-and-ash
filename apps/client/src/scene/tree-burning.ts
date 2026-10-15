import { treeBurnProgress, type WildfireView } from '@acorn/shared';
import type { PropPart } from './props';

/** Server fire time drives the char front, including joining halfway through a burn. */
export function createTreeBurning(
  slotFor: (id: number) => { parts: PropPart[]; index: number } | undefined,
) {
  let state: WildfireView = { fires: [], lightning: null, now: 0 };
  let receivedAt = 0;
  const touched = new Set<number>();
  const burned = new Set<number>();
  return {
    setState(next: WildfireView) {
      if (next === state) return;
      state = next;
      receivedAt = performance.now();
      for (const fire of next.fires) if (fire.kind === 'tree') touched.add(fire.id);
    },
    setBurned(id: number, value: boolean) {
      if (value) burned.add(id);
      else burned.delete(id);
      touched.add(id);
    },
    update() {
      const now = state.now + Math.max(0, performance.now() - receivedAt);
      const fires = new Map(
        state.fires.filter((fire) => fire.kind === 'tree').map((fire) => [fire.id, fire]),
      );
      for (const id of touched) {
        const fire = fires.get(id);
        const amount = burned.has(id) ? 1 : fire ? treeBurnProgress(fire, now) : 0;
        const slot = slotFor(id);
        if (slot) for (const part of slot.parts) part.burn?.(slot.index, amount);
        if (!fire && !burned.has(id)) touched.delete(id);
      }
    },
  };
}
