import { useLayoutEffect, useRef } from 'react';
import { cancelGearDrag } from './gear-drag';

/** Keep ordinary panels responsive without trapping world movement or menu hotkeys. */
export function usePanelLifecycle(
  selector: string,
  open: boolean,
  focusKey: string,
  viewKey = focusKey,
): void {
  const scroll = useRef(new Map<string, number[]>());
  useLayoutEffect(() => {
    if (!open) return;
    const panel = document.querySelector<HTMLElement>(selector);
    if (panel === null) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.tabIndex = -1;
    if (!panel.hasAttribute('role') && panel.tagName !== 'SECTION')
      panel.setAttribute('role', 'region');
    if (!panel.hasAttribute('aria-label'))
      panel.setAttribute(
        'aria-label',
        focusKey === 'pack'
          ? 'Your pack'
          : focusKey === 'character'
            ? 'Your character'
            : focusKey === 'decorations'
              ? 'Home decoration'
              : 'Field journal',
      );
    if (!panel.contains(previous)) panel.focus({ preventScroll: true });
    return () => {
      cancelGearDrag();
      if (
        previous?.isConnected &&
        (panel.contains(document.activeElement) || document.activeElement === document.body)
      )
        previous.focus({ preventScroll: true });
    };
  }, [selector, open, focusKey]);
  useLayoutEffect(() => {
    if (!open) return;
    const panel = document.querySelector<HTMLElement>(selector);
    if (panel === null) return;
    const nodes = [panel, ...panel.querySelectorAll<HTMLElement>('.craft-list')];
    const saved = scroll.current.get(viewKey);
    nodes.forEach((node, index) => {
      node.scrollTop = saved?.[index] ?? 0;
    });
    const save = () =>
      scroll.current.set(
        viewKey,
        nodes.map((node) => node.scrollTop),
      );
    save();
    panel.addEventListener('scroll', save, true);
    return () => {
      panel.removeEventListener('scroll', save, true);
    };
  }, [selector, open, viewKey]);
}
