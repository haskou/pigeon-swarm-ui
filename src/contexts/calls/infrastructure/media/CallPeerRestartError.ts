import type { CallPeerRestartStage } from './CallPeerRestartStage';

/**
 * Names the recovery step that failed, so a credential outage, an offer that
 * could not be delivered and a rejected ICE restart are diagnosed apart.
 */
export class CallPeerRestartError extends Error {
  public constructor(public readonly stage: CallPeerRestartStage) {
    super(`Call peer recovery failed at ${stage}.`);
    this.name = 'CallPeerRestartError';
  }
}
