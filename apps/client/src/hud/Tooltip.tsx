import { useState } from 'react';

/**
 * A small hover label anchored above whatever it wraps, styled to match the
 * hotbar's own parchment look. Positioning is pure CSS (`.hud-tooltip` is
 * anchored to `.hud-tooltip-anchor`, its nearest positioned ancestor) rather
 * than anything computed from the mouse, so it never has to hear where the
 * cursor actually is.
 */
export function Tooltip({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="hud-tooltip-anchor"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      {hovered ? <div className="hud-tooltip">{label}</div> : null}
    </div>
  );
}
