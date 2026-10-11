export class MailboxEnvelopeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = MailboxEnvelopeError.name;
  }
}
