export class MailboxUnavailableError extends Error {
  public constructor() {
    super('Mailbox is unavailable');
    this.name = MailboxUnavailableError.name;
  }
}
