/**
 * This device's due leaf update could not be committed or queued, so the
 * write that needed it queued nothing. The update stays due: sending the
 * write again tries it once more.
 */
export class GroupMailboxUpdateFailedError extends Error {
  public constructor() {
    super('The group leaf update failed, so nothing was sent');
    this.name = 'GroupMailboxUpdateFailedError';
  }
}
