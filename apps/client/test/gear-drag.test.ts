import { getEventListeners } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import { cancelGearDrag, getDraggedGear, startGearDrag } from '../src/hud/gear-drag';
afterEach(() => {
  cancelGearDrag();
  vi.unstubAllGlobals();
});
function windowEvents() {
  const events = new EventTarget();
  vi.stubGlobal('window', events);
  return events;
}
it('clears a removed gear slot drag on blur and drop', () => {
  const events = windowEvents();
  startGearDrag('leatherBoots');
  expect(getDraggedGear()).toBe('leatherBoots');
  events.dispatchEvent(new Event('blur'));
  expect(getDraggedGear()).toBeNull();
  startGearDrag('leatherGloves');
  events.dispatchEvent(new Event('drop'));
  expect(getDraggedGear()).toBeNull();
});
it('clears Escape for an active drag without cancelling the browser default', () => {
  const events = windowEvents();
  startGearDrag('leatherBoots');
  const event = new Event('keydown', { cancelable: true });
  Object.defineProperty(event, 'key', { value: 'Escape' });
  events.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(getDraggedGear()).toBeNull();
  expect(getEventListeners(events, 'keydown')).toHaveLength(0);
  const fresh = new Event('keydown', { cancelable: true });
  Object.defineProperty(fresh, 'key', { value: 'Escape' });
  events.dispatchEvent(fresh);
  expect(fresh.defaultPrevented).toBe(false);
});
it('replaces a drag without leaving an earlier cancellation listener active', () => {
  const events = windowEvents();
  startGearDrag('leatherBoots');
  startGearDrag('leatherGloves');
  expect(getDraggedGear()).toBe('leatherGloves');
  cancelGearDrag();
  expect(getDraggedGear()).toBeNull();
  startGearDrag('leatherBoots');
  events.dispatchEvent(new Event('dragend'));
  expect(getDraggedGear()).toBeNull();
});
