export class DeviceRemovedError extends Error {
  public constructor(public readonly identityId: string) {
    super('The node no longer authorizes this device for the identity.');
    this.name = 'DeviceRemovedError';
  }
}
