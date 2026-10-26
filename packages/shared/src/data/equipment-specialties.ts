import type { ItemId } from './items';
import type { WornGear } from './gear';

/** Fixed item identities, separate from the admin-editable base stat bonuses. */
export const EQUIPMENT_SPECIALTIES: Partial<Record<ItemId, string>> = {
  cedarstalkerCoat:
    'Quiet step: prey notices your approach from 15% less distance while worn. Sprinting still startles wildlife; hostile creatures are unaffected. Track the Old Cedar Stag northwest beyond the elk grove, then stitch his hide with reeds and rope.',
  leatherBoots:
    'Sure footing: dodge cooldown is 15% shorter while worn. Stacks with a trail ration; roll distance and invulnerability stay the same. Earn a pair from The Sunreach Survey or A supper by the lake.',
  ironSword:
    'Duelist: deal 20% more damage when striking a hostile creature during its recovery after an attack. Must be the active weapon. Find one in buried treasure.',

  travelerTunic:
    'Trail comfort: hunger drains 15% more slowly while worn. Find it at the forgotten camp.',
  winterJacket:
    'Heat keeper: recover warmth 25% faster beside a lit campfire or fueled home fire while worn. Craft with reeds and rope.',
  huntingKnife:
    'Careful harvest: finishing a meat-bearing animal with this knife yields one extra meat, if your pack has room. Find it in buried treasure with a shovel. Must be the active weapon.',
};
export function equipmentHungerRate(worn: Readonly<WornGear>): number {
  return worn.upperBody === 'travelerTunic' ? 0.85 : 1;
}
export function equipmentHeatRecovery(worn: Readonly<WornGear>): number {
  return worn.upperBody === 'winterJacket' ? 1.25 : 1;
}
export function huntingYield(held: ItemId | null, catchItem: ItemId | undefined): number {
  return catchItem === 'meat' && held === 'huntingKnife' ? 2 : 1;
}

/** Apply after food so both browser prediction and the server use the same rounded ticks. */
export function equipmentDodgeCooldown(worn: Readonly<WornGear>, normal: number): number {
  return worn.feet === 'leatherBoots' ? Math.max(1, Math.round(normal * 0.85)) : normal;
}
/** The opening belongs to the attack recovery, never to a player-created flinch. */
export function equipmentOpeningPower(held: ItemId | null, recovering: boolean): number {
  return held === 'ironSword' && recovering ? 1.2 : 1;
}

/** Keep mechanical rules visible even when an admin supplies custom flavor text. */
export function withEquipmentSpecialty(item: ItemId, description: string): string {
  const specialty = EQUIPMENT_SPECIALTIES[item];
  return specialty && !description.includes(specialty)
    ? `${description} ${specialty}`
    : description;
}

/** Reduces prey notice distance only; point-blank surprise and predators stay dangerous. */
export function equipmentPreyNotice(worn: Readonly<WornGear>): number {
  return worn.upperBody === 'cedarstalkerCoat' ? 0.85 : 1;
}
