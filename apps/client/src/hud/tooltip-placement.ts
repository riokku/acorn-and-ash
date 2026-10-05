/** A box on the screen, in pixels from the top left of the window. */
export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface TooltipPlacement {
  /** Where the tooltip's top left corner goes. */
  left: number;
  top: number;
  side: 'above' | 'below';
}

/** Space kept between a tooltip and the edge of the window. */
export const TOOLTIP_EDGE_MARGIN = 8;
/** Space between a tooltip and the thing it is about. */
export const TOOLTIP_GAP = 8;

/**
 * Where a hover label goes so it can be read in full: centred over the thing
 * it is about, above it when there is room and below it when there is not,
 * and always kept inside the window. It is positioned from the window and not
 * from the panel it belongs to, so a panel that scrolls or clips can never
 * cut it off or grow a scroll bar because of it.
 */
export function placeTooltip(
  anchor: ScreenRect,
  tip: { width: number; height: number },
  viewport: { width: number; height: number },
): TooltipPlacement {
  const margin = TOOLTIP_EDGE_MARGIN;
  const centre = (anchor.left + anchor.right) / 2;
  const left = clamp(centre - tip.width / 2, margin, viewport.width - margin - tip.width);

  const roomAbove = anchor.top - TOOLTIP_GAP - margin;
  const roomBelow = viewport.height - margin - (anchor.bottom + TOOLTIP_GAP);
  const side = tip.height <= roomAbove || roomAbove >= roomBelow ? 'above' : 'below';
  const wanted =
    side === 'above' ? anchor.top - TOOLTIP_GAP - tip.height : anchor.bottom + TOOLTIP_GAP;
  const top = clamp(wanted, margin, viewport.height - margin - tip.height);
  return { left, top, side };
}

/** Like Math.min/Math.max together, but a window too small for the box wins by the top left. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
