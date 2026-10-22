import {
  BUILDABLE_KINDS,
  encodeBuild,
  type BuildReply,
  type BuildReplyReason,
} from '@acorn/shared';

/** Match the actual wire command, including centimetre positions and wrapped angles. */
export class BuildFeedback {
  private pending: { request: BuildReply['request']; key: Uint8Array; sentAt: number } | null =
    null;
  get request(): BuildReply['request'] | null {
    return this.pending?.request ?? null;
  }
  begin(request: BuildReply['request'], now: number): boolean {
    if (this.pending !== null) return false;
    this.pending = {
      request: { ...request },
      key: new Uint8Array(encodeBuild(request)),
      sentAt: now,
    };
    return true;
  }
  settle(reply: BuildReply): BuildReply | null {
    const pending = this.pending;
    if (pending === null) return null;
    const key = new Uint8Array(encodeBuild(reply.request));
    if (!pending.key.every((byte, index) => byte === key[index])) return null;
    this.pending = null;
    return { request: pending.request, reason: reply.reason };
  }
  clear(): boolean {
    const pending = this.pending !== null;
    this.pending = null;
    return pending;
  }
  text(now: number): string | null {
    if (this.pending === null) return null;
    const name = BUILDABLE_KINDS[this.pending.request.kind].displayName.toLowerCase();
    return now - this.pending.sentAt >= 8000
      ? `Still waiting for the ${name}. Check your connection.`
      : `Waiting for the ${name} placement to be confirmed.`;
  }
}
export function buildReplyText(reason: BuildReplyReason): string {
  const text: Record<BuildReplyReason, string> = {
    materials: 'Gather the listed building materials first.',
    identity: 'Reconnect to build a home.',
    blueprint: 'Learn this home blueprint first.',
    tier: 'Upgrade your home one tier at a time.',
    moved: 'Upgrade your existing home in place.',
    occupied: 'Everyone must leave the home before upgrading.',
    blocked: 'Choose a spot with more clear space.',
    furnishings:
      'Move or pack up furniture inside your home before upgrading; it overlaps the new room layout.',
    player: 'Someone is standing where this will go.',
    busy: 'Finish your current action before building.',
    area: 'Choose a spot inside your building area and away from protected sites.',
    ground: 'Choose more level ground.',
    indoors: 'Go outside to build this piece.',
    recipe: 'Learn this building recipe first.',
    alreadyOwned: 'You already built one of these.',
    tooFar: 'Move closer to this spot.',
    onPlayer: 'Choose a spot away from where you are standing.',
    pastTreeLine: 'Choose a spot inside the clearing.',
    worldEdge: 'Choose a spot inside the world boundary.',
    water: 'Choose a spot clear of the water.',
    needsWater: 'Place the boat in shallow water.',
    tooFarOut: 'Place the boat closer to the bank.',
    frozen: 'Wait for the ice to thaw before building a boat.',
    tooClose: 'Choose a spot away from nearby objects.',
  };
  return text[reason];
}
