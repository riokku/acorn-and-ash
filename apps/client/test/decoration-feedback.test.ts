import { expect, it } from 'vitest';
import { DecorationFeedback } from '../src/hud/decoration-feedback';
import type { DecorationRequest, DecorationReplyMessage } from '@acorn/shared';
const request: DecorationRequest = {
  action: 'place',
  kind: 'cedarBench',
  id: 0,
  x: -0.5,
  z: -0.125,
  yaw: 0,
};
const reply: DecorationReplyMessage = {
  type: 'decorationReply',
  action: 'place',
  kind: 'cedarBench',
  id: 0,
  reason: null,
};
it('waits through slow replies and rejects duplicate submissions and unrelated results', () => {
  const f = new DecorationFeedback();
  expect(f.begin(request, 0)).toBe(true);
  expect(f.begin({ ...request, kind: 'wovenRug' }, 1)).toBe(false);
  expect(f.text(8000)).toContain('Still waiting');
  expect(f.settle({ ...reply, kind: 'wovenRug' })).toBeNull();
  expect(f.settle({ ...reply, action: 'move' })).toBeNull();
  expect(f.settle({ ...reply, id: 9 })).toBeNull();
  expect(f.request).toEqual(request);
  expect(f.settle(reply)).toEqual({ request, reason: null });
  expect(f.request).toBeNull();
});
it('settles refusal while preserving the submitted request for retry feedback', () => {
  const f = new DecorationFeedback();
  f.begin(request, 0);
  expect(f.settle({ ...reply, reason: 'materials' })).toEqual({ request, reason: 'materials' });
  expect(f.begin(request, 200)).toBe(true);
});
it.each(['move', 'reclaim'] as const)(
  'matches a %s result to the existing decoration ID',
  (action) => {
    const f = new DecorationFeedback();
    f.begin({ ...request, action, id: 42 }, 0);
    expect(f.settle({ ...reply, action, id: 41 })).toBeNull();
    expect(f.settle({ ...reply, action, id: 42 })?.reason).toBeNull();
  },
);
it('clears an interrupted request without queuing a retry', () => {
  const f = new DecorationFeedback();
  f.begin(request, 0);
  expect(f.clear()).toBe(true);
  expect(f.request).toBeNull();
  expect(f.clear()).toBe(false);
});
