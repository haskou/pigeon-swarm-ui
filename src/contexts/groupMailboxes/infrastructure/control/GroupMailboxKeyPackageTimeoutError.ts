/** A key package the peer did not send in time. */
export class GroupMailboxKeyPackageTimeoutError extends Error {
  public constructor() {
    super('The peer did not answer the key package request in time');
    this.name = 'GroupMailboxKeyPackageTimeoutError';
  }
}
