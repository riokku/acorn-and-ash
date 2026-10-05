import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { placeTooltip, type TooltipPlacement } from './tooltip-placement';

/**
 * A small hover label over whatever it wraps, styled to match the hotbar's
 * own parchment look.
 *
 * The label is drawn on the page itself, not inside the panel it belongs to,
 * and placed from where its anchor sits on the screen (see
 * `placeTooltip`). Panels such as the pack scroll and clip what is inside
 * them, so a label drawn inside one used to push the panel into scrolling
 * sideways and got cut off near its edges.
 */
export function Tooltip({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  const [hovered, setHovered] = useState(false);
  const [placement, setPlacement] = useState<TooltipPlacement | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const reposition = (): void => {
    const anchor = anchorRef.current;
    const tip = tipRef.current;
    if (anchor === null || tip === null) return;
    const box = anchor.getBoundingClientRect();
    const size = tip.getBoundingClientRect();
    setPlacement(
      placeTooltip(
        box,
        { width: size.width, height: size.height },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  };

  // Measured before the browser paints, so the label never flashes in the wrong place.
  useLayoutEffect(() => {
    if (hovered) reposition();
    else setPlacement(null);
  }, [hovered, label]);

  // A panel that scrolls, or a window that resizes, moves the thing the label is about.
  useEffect(() => {
    if (!hovered) return;
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [hovered]);

  return (
    <div
      ref={anchorRef}
      className="hud-tooltip-anchor"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {children}
      {hovered
        ? createPortal(
            <div
              ref={tipRef}
              className="hud-tooltip"
              role="tooltip"
              style={
                placement === null
                  ? { visibility: 'hidden' }
                  : { left: placement.left, top: placement.top }
              }
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
