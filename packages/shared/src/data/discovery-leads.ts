import type { Terrain } from '../world/terrain';
import { colliderFootprintRadius, type Collider } from '../world/colliders';
import { overlapsWater, type WaterCircle } from '../world/water';
import { nearStream, STREAM } from '../world/stream';
import type { EncounterSite } from '../world/encounters';
import { discoveryKnown, type DiscoverySite } from './discoveries';

export interface DiscoveryLead extends EncounterSite {
  readonly discoveryId: number;
  readonly markerX: number;
  readonly markerZ: number;
  readonly hint: string;
}
const PROMISES: Record<string, string> = {
  camp: 'An old camp may hold traveling clothes and a trail-food recipe',
  logging: 'Abandoned timber lies beyond the trees · watch for skeleton guards',
  grove: 'A sheltered mushroom grove may hold a cooking recipe · daylight is safer',
  shrine: 'An offering stone may hold a forgotten tea recipe · the ruins are guarded',
};
const DIRECTIONS = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
];

/** Sparse environmental leads; no new encounters, reward IDs or saved-world placement changes. */
export function buildDiscoveryLeads(
  sites: readonly DiscoverySite[],
  terrain: Terrain,
  colliders: readonly Collider[],
  water: readonly WaterCircle[],
): DiscoveryLead[] {
  const leads: DiscoveryLead[] = [];
  for (const site of sites) {
    if (!(site.kind in PROMISES)) continue;
    const inward = Math.atan2(-site.z, -site.x);
    for (const [step, distance] of [14, 25, 36].entries()) {
      for (const turn of [0, 0.18, -0.18, 0.36, -0.36, 0.54, -0.54]) {
        const x = site.x + Math.cos(inward + turn) * distance;
        const z = site.z + Math.sin(inward + turn) * distance;
        if (Math.hypot(x, z) < 34 || overlapsWater(water, x, z, 1.3) || nearStream(STREAM, x, z, 2))
          continue;
        if (colliders.some((c) => Math.hypot(c.x - x, c.z - z) < colliderFootprintRadius(c) + 1.1))
          continue;
        if (leads.some((c) => Math.hypot(c.markerX - x, c.markerZ - z) < 7)) continue;
        const y = terrain.heightAt(x, z);
        if (
          !Number.isFinite(y) ||
          [0, 1, 2, 3].some(
            (i) =>
              Math.abs(
                terrain.heightAt(
                  x + Math.cos((i * Math.PI) / 2) * 0.6,
                  z + Math.sin((i * Math.PI) / 2) * 0.6,
                ) - y,
              ) > 0.25,
          )
        )
          continue;
        const bearing = Math.atan2(site.x - x, -(site.z - z));
        const direction = DIRECTIONS[(Math.round(bearing / (Math.PI / 4)) + 8) % 8]!;
        leads.push({
          id: 2000 + site.id * 3 + step,
          kind: 'wanderer',
          x: x + 2.8,
          z: z - 2.7,
          yaw: 0,
          markerX: x,
          markerZ: z,
          discoveryId: site.id,
          hint: `Weathered trail cairn · ${PROMISES[site.kind]} to the ${direction}`,
        });
        break;
      }
    }
  }
  return leads;
}

export function discoveryLeadHint(
  leads: readonly DiscoveryLead[],
  x: number,
  z: number,
  found: number,
): string | null {
  let nearest: DiscoveryLead | undefined;
  let distance = 3.5;
  for (const lead of leads) {
    if (discoveryKnown(found, lead.discoveryId)) continue;
    const d = Math.hypot(lead.markerX - x, lead.markerZ - z);
    if (d < distance) {
      nearest = lead;
      distance = d;
    }
  }
  return nearest?.hint ?? null;
}
