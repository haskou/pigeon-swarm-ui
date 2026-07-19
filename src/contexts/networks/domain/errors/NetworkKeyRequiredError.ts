export class NetworkKeyRequiredError extends Error {
  public constructor() {
    super('Network key is required.');
    this.name = NetworkKeyRequiredError.name;
  }
}
