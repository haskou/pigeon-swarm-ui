export class LocalDeviceIdentityNotFoundError extends Error {
  public constructor() {
    super('Local device identity not found.');
    this.name = 'LocalDeviceIdentityNotFoundError';
  }
}
