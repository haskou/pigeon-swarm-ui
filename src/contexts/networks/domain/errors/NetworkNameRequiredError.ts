export class NetworkNameRequiredError extends Error {
  public constructor() {
    super('Network name is required.');
    this.name = NetworkNameRequiredError.name;
  }
}
