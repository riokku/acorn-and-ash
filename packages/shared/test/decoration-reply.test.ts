import { expect, it } from 'vitest';
import { encodeDecorationReply, decodeServerMessage } from '../src/net/protocol';
import { DECORATION_REASONS, type DecorationRequest } from '../src/sim/decorations';
const request: DecorationRequest = {
  action: 'move',
  kind: 'cedarBench',
  id: 80000,
  x: 0,
  z: 0,
  yaw: 0,
};
it.each([null, ...DECORATION_REASONS])(
  'round-trips a private %s result and its command identity',
  (reason) => {
    expect(decodeServerMessage(encodeDecorationReply(request, reason))).toEqual({
      type: 'decorationReply',
      action: 'move',
      kind: 'cedarBench',
      id: 80000,
      reason,
    });
  },
);
it('rejects truncated packets and unknown actions, kinds and reasons', () => {
  const good = encodeDecorationReply(request, null);
  expect(decodeServerMessage(good.slice(0, 7))).toBeNull();
  for (const offset of [1, 2, 3]) {
    const bad = good.slice(0);
    new DataView(bad).setUint8(offset, 255);
    expect(decodeServerMessage(bad)).toBeNull();
  }
});
