import { MlsRejectedError } from '../../../communities/infrastructure/mls/MlsRejectedError';

/** This device holds the group but no confirming member has spoken yet. */
export class GroupMailboxUnconfirmedError extends MlsRejectedError {
  public constructor() {
    super('This device has not confirmed the group yet');
  }
}
