/**
 * Signed, verified transitions prove that this device was removed from the
 * identity above its local checkpoint, by the named operation.
 */
export class DeviceRemovedError extends Error {
  public constructor(
    public readonly identityId: string,
    public readonly operationId: string,
  ) {
    super('A signed transition removed this device from the identity.');
    this.name = 'DeviceRemovedError';
  }
}
