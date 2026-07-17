export class AttachmentPublishedResourceNotFoundError extends Error {
  public constructor() {
    super('Published attachment resource was not found.');
  }
}
