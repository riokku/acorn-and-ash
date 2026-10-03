import { ITEM_KINDS } from '@acorn/shared';

import { ItemIcon } from './item-icons';
import type { PickupNotice as Notice } from './pickup-notice';

export function PickupNotice({
  notice,
  onOpenPack,
}: {
  notice: Notice;
  onOpenPack: () => void;
}): React.JSX.Element {
  const kind = ITEM_KINDS[notice.item];
  return (
    <div
      className="pickup-notice"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="pickup-notice"
    >
      <span className="pickup-notice-mark" aria-hidden="true">
        <ItemIcon item="bag" color="#e9c898" className="pickup-notice-icon" />
        <span>!</span>
      </span>
      <span className="pickup-notice-copy" key={notice.id}>
        <strong>{notice.reason === 'full' ? 'Inventory full' : 'Already carrying one'}</strong>
        <span>
          {notice.reason === 'full'
            ? `No room for ${kind.pluralName.toLowerCase()}.`
            : `You can only carry one ${kind.displayName.toLowerCase()}.`}{' '}
          Left on the ground.
        </span>
      </span>
      <button type="button" onClick={onOpenPack}>
        <kbd>I</kbd> Open pack
      </button>
    </div>
  );
}
