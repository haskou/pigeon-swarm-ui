import { DomainError } from '@haskou/value-objects';

/**
 * A hand-over names a revision at or below the one of another root this
 * device already trusts. The genuine hand-over is the first entry at its
 * revision, so a later one there was re-signed by the retired key.
 */
export class SupersededDeviceSealedRootHandOverError extends DomainError {
  public constructor() {
    super(
      'Device sealed root hand-over is superseded by a root this device trusts.',
    );
  }
}
