export class DeviceRemovedError extends Error {
  public constructor() {
    super('The node no longer authorizes this device for the identity.');
    this.name = 'DeviceRemovedError';
  }
}
