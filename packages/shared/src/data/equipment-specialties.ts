import type { ItemId } from './items';
import { GEAR_SLOTS, canWearIn, isWeapon, type WornGear } from './gear';

/** Fixed item identities, separate from the admin-editable base stat bonuses. */
export interface EquipmentTrait {
  readonly name: string;
  readonly benefit: string;
  readonly detail: string;
}
export const EQUIPMENT_TRAITS: Readonly<Partial<Record<ItemId, EquipmentTrait>>> = {
  cedarstalkerCoat: {
    name: 'Quiet step',
    benefit: 'Prey notices your approach from 15% less distance while worn.',
    detail:
      'Sprinting still startles wildlife; hostile creatures are unaffected. Track the Old Cedar Stag northwest beyond the elk grove, then stitch his hide with reeds and rope.',
  },
  leatherBoots: {
    name: 'Sure footing',
    benefit: 'Dodge cooldown is 15% shorter while worn.',
    detail:
      'Stacks with a trail ration; roll distance and invulnerability stay the same. Earn a pair from The Sunreach Survey or A supper by the lake.',
  },
  ironSword: {
    name: 'Duelist',
    benefit:
      'Deal 20% more damage when striking a hostile creature during its recovery after an attack.',
    detail: 'Must be the active weapon. Find one in buried treasure.',
  },
  travelerTunic: {
    name: 'Trail comfort',
    benefit: 'Hunger drains 15% more slowly while worn.',
    detail: 'Find it at the forgotten camp.',
  },
  winterJacket: {
    name: 'Heat keeper',
    benefit: 'Recover warmth 25% faster beside a lit campfire or fueled home fire while worn.',
    detail: 'Craft with reeds and rope.',
  },
  huntingKnife: {
    name: 'Careful harvest',
    benefit:
      'Finishing a meat-bearing animal with this knife yields one extra meat, if your pack has room.',
    detail: 'Find it in buried treasure with a shovel. Must be the active weapon.',
  },
};
export const EQUIPMENT_SPECIALTIES: Readonly<Partial<Record<ItemId, string>>> = Object.fromEntries(
  Object.entries(EQUIPMENT_TRAITS).map(([item, trait]) => [
    item,
    `${trait.name}: ${trait.benefit[0]!.toLowerCase()}${trait.benefit.slice(1)} ${trait.detail}`,
  ]),
);

/** Show only worn clothing in valid slots and the actual active hand, never stowed weapons. */
export function activeEquipmentTraits(
  worn: Readonly<WornGear>,
  held: ItemId | null = worn.mainHand ?? null,
): readonly { item: ItemId; trait: EquipmentTrait }[] {
  const items = new Set<ItemId>();
  for (const slot of GEAR_SLOTS) {
    const item = worn[slot];
    if (
      slot !== 'mainHand' &&
      slot !== 'offHand' &&
      item &&
      canWearIn(item, slot) &&
      EQUIPMENT_TRAITS[item]
    )
      items.add(item);
  }
  if (held && isWeapon(held) && EQUIPMENT_TRAITS[held]) items.add(held);
  return [...items].map((item) => ({ item, trait: EQUIPMENT_TRAITS[item]! }));
}
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
