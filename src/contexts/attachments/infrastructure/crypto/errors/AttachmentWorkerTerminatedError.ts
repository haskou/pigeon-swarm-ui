export class AttachmentWorkerTerminatedError extends Error {
  public constructor() {
    super('Attachment worker was terminated');
    this.name = 'AttachmentWorkerTerminatedError';
  }
}
