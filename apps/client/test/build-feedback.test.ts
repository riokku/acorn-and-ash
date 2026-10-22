import { expect, it } from 'vitest';
import { BuildFeedback, buildReplyText } from '../src/hud/build-feedback';
import { encodeBuildReply, decodeServerMessage } from '@acorn/shared';
const request = { kind: 'tent' as const, x: 0.004, z: -4.204, yaw: -Math.PI / 2 };
it('matches the packed command through centimetre rounding and angle wrapping', () => {
  const f = new BuildFeedback();
  f.begin(request, 0);
  const reply = decodeServerMessage(encodeBuildReply({ request, reason: null }));
  expect(reply?.type).toBe('buildReply');
  if (reply?.type !== 'buildReply') throw new Error('Missing reply');
  expect(f.settle(reply)).toEqual({ request, reason: null });
});
it('rejects duplicates, unrelated outcomes and timeout-based retries', () => {
  const f = new BuildFeedback();
  f.begin(request, 0);
  expect(f.begin(request, 2)).toBe(false);
  expect(f.text(9000)).toContain('Still waiting');
  expect(f.settle({ request: { ...request, x: 1 }, reason: null })).toBeNull();
  expect(f.request).toEqual(request);
  expect(f.settle({ request, reason: 'materials' })?.reason).toBe('materials');
  expect(f.begin(request, 10000)).toBe(true);
  expect(f.clear()).toBe(true);
  expect(f.request).toBeNull();
});

it('explains indoor upgrade conflicts separately from outdoor clearance and round-trips the reason', () => {
  expect(buildReplyText('furnishings')).toContain('inside your home');
  expect(buildReplyText('onPlayer')).toContain('where you are standing');
  expect(decodeServerMessage(encodeBuildReply({ request, reason: 'furnishings' }))).toMatchObject({
    reason: 'furnishings',
  });
});
