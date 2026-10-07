import type { Vec3 } from '@acorn/shared';

/** Selection reaches beyond melee, but never beyond nearby encounters. */
export const TARGET_RANGE = 30;
const FORWARD_COSINE = Math.cos(Math.PI / 3);

export interface HostileTarget extends Readonly<Vec3> {
  readonly id: number;
  readonly name: string;
}

/** Client selection only; damage and attack reach still belong to the shared simulation. */
export class TabTargeting {
  private order: number[] = [];
  private selectedId: number | null = null;

  get id(): number | null {
    return this.selectedId;
  }

  clear(): void {
    this.selectedId = null;
    this.order = [];
  }

  /** Call every frame, including while menus are open, with living hostiles only. */
  update(player: Readonly<Vec3>, candidates: readonly HostileTarget[]): HostileTarget | null {
    const valid = candidates.filter((target) => inRange(player, target));
    const ids = new Set(valid.map((target) => target.id));
    this.order = this.order.filter((id) => ids.has(id));
    if (this.selectedId !== null && !ids.has(this.selectedId)) this.clear();
    return valid.find((target) => target.id === this.selectedId) ?? null;
  }

  cycle(
    player: Readonly<Vec3>,
    facingYaw: number,
    candidates: readonly HostileTarget[],
    direction: 1 | -1,
  ): HostileTarget | null {
    this.update(player, candidates);
    const ranked = candidates
      .filter((target) => inRange(player, target))
      .map((target) => {
        const dx = target.x - player.x;
        const dz = target.z - player.z;
        const distance = Math.hypot(dx, dz);
        const cosine =
          distance < 1e-6 ? 1 : (-Math.sin(facingYaw) * dx - Math.cos(facingYaw) * dz) / distance;
        const angle = Math.acos(Math.max(-1, Math.min(1, cosine)));
        return { target, front: cosine >= FORWARD_COSINE, score: distance + angle * 5 };
      })
      .sort(
        (a, b) =>
          Number(b.front) - Number(a.front) || a.score - b.score || a.target.id - b.target.id,
      );
    // Keep the current cycle stable as enemies move or the player turns. New
    // arrivals join at the end; removed targets are pruned by update().
    const known = new Set(this.order);
    for (const { target } of ranked) if (!known.has(target.id)) this.order.push(target.id);
    if (this.order.length === 0) return null;
    const current = this.selectedId === null ? -1 : this.order.indexOf(this.selectedId);
    const next = current < 0 ? 0 : (current + direction + this.order.length) % this.order.length;
    this.selectedId = this.order[next] ?? null;
    return ranked.find(({ target }) => target.id === this.selectedId)?.target ?? null;
  }
}

function inRange(player: Readonly<Vec3>, target: HostileTarget): boolean {
  return Math.hypot(target.x - player.x, target.y - player.y, target.z - player.z) <= TARGET_RANGE;
}
