import {
  BUILDABLE_KINDS,
  type DecorationRequest,
  type DecorationState,
  type DecorationReplyMessage,
} from '@acorn/shared';

export interface DecorationResult {
  readonly request: Readonly<DecorationRequest>;
  readonly reason: DecorationState['reason'];
}

/** Only a matching private reply settles the submitted decoration request. */
export class DecorationFeedback {
  private pending: { request: DecorationRequest; sentAt: number } | null = null;
  get request(): Readonly<DecorationRequest> | null {
    return this.pending?.request ?? null;
  }
  begin(request: DecorationRequest, now: number): boolean {
    if (this.pending !== null) return false;
    this.pending = { request: { ...request }, sentAt: now };
    return true;
  }
  settle(reply: DecorationReplyMessage): DecorationResult | null {
    const request = this.pending?.request;
    if (
      request === undefined ||
      request.action !== reply.action ||
      request.kind !== reply.kind ||
      request.id !== reply.id
    )
      return null;
    this.pending = null;
    return { request, reason: reply.reason };
  }
  clear(): boolean {
    const hadRequest = this.pending !== null;
    this.pending = null;
    return hadRequest;
  }
  text(now: number): string | null {
    if (this.pending === null) return null;
    const name = BUILDABLE_KINDS[this.pending.request.kind].displayName.toLowerCase();
    return now - this.pending.sentAt >= 8000
      ? `Still waiting for the ${name}. Check your connection.`
      : this.pending.request.action === 'reclaim' ||
          this.pending.request.action === 'reclaimOutdoor'
        ? `Waiting for the ${name} to be packed up.`
        : `Waiting for the ${name} placement to be confirmed.`;
  }
}
