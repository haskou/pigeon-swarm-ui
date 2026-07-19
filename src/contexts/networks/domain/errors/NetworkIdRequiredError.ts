export class NetworkIdRequiredError extends Error {
  public constructor() {
    super('Network id is required.');
    this.name = NetworkIdRequiredError.name;
  }
}
