import type { ItemId } from './items';
import type { WornGear } from './gear';

/** Fixed item identities, separate from the admin-editable base stat bonuses. */
export const EQUIPMENT_SPECIALTIES: Partial<Record<ItemId, string>> = {
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

/** Keep mechanical rules visible even when an admin supplies custom flavor text. */
export function withEquipmentSpecialty(item: ItemId, description: string): string {
  const specialty = EQUIPMENT_SPECIALTIES[item];
  return specialty && !description.includes(specialty)
    ? `${description} ${specialty}`
    : description;
}
