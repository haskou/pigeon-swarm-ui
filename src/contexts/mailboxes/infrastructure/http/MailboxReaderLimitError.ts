/**
 * The node refused to enrol another reader because the inbox already holds
 * `maxReaders` readers (the root plus one per device). Only the device that
 * is past the cap can recover, by removing a device it no longer uses.
 */
export class MailboxReaderLimitError extends Error {
  public constructor() {
    super('Mailbox reader set is full');
    this.name = MailboxReaderLimitError.name;
  }
}
