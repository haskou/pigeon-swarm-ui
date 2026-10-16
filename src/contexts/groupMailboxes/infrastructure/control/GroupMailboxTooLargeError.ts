import { MlsRejectedError } from '../../../communities/infrastructure/mls/MlsRejectedError';

/**
 * A group that would hold more than one welcome to every member fits: its
 * roster is full (`GroupMailboxRoster.MAX_PARTICIPANTS`), or an add's
 * welcome exceeds what a control record carries
 * (`GroupMailboxControlRecord.MAX_BINARY_BYTES`). Nothing was committed.
 */
export class GroupMailboxTooLargeError extends MlsRejectedError {
  public constructor() {
    super('The group is too large to welcome another member');
    this.name = 'GroupMailboxTooLargeError';
  }
}
