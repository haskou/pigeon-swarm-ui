export type CallSignalRefusalReason =
  | 'bad-signature'
  | 'chain-unverified'
  | 'expired'
  | 'malformed'
  | 'not-for-this-device'
  | 'party-mismatch'
  | 'replayed'
  | 'scope-unsupported'
  | 'sender-unauthorised'
  | 'stale-head'
  | 'undecryptable';

/** A signal the verdict refused; the reason never carries signal content. */
export class CallSignalRefusedError extends Error {
  public constructor(public readonly reason: CallSignalRefusalReason) {
    super(`Call signal refused: ${reason}`);
    this.name = 'CallSignalRefusedError';
  }
}
