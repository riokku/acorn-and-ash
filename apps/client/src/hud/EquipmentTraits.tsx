import { activeEquipmentTraits, type ItemId, type WornGear } from '@acorn/shared';
import { ITEM_KINDS } from '../item-catalog';

export function EquipmentTraits({ worn, held }: { worn: Readonly<WornGear>; held: ItemId | null }) {
  const active = activeEquipmentTraits(worn, held);
  return (
    <details className="equipment-traits" data-testid="equipment-traits">
      <summary>
        Your kit · {active.length} active {active.length === 1 ? 'specialty' : 'specialties'}
      </summary>
      <div className="equipment-traits-content">
        {active.length === 0 ? (
          <p>
            Some gear changes how you adventure. Look for specialties on found clothing and weapons.
          </p>
        ) : (
          <ul>
            {active.map(({ item, trait }) => (
              <li key={item}>
                <strong>
                  {trait.name} <span>· {ITEM_KINDS[item].displayName}</span>
                </strong>
                <p>{trait.benefit}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="equipment-traits-note">
          Clothing must be worn and weapons must be in your active hand. Pack contents and stowed
          weapons add no specialties.
        </p>
      </div>
    </details>
  );
}
