export class AttachmentPublicationContextNotFoundError extends Error {
  public constructor() {
    super('Attachment publication context was not found.');
  }
}
