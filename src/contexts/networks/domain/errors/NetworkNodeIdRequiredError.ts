export class NetworkNodeIdRequiredError extends Error {
  public constructor() {
    super('Network node id is required.');
    this.name = NetworkNodeIdRequiredError.name;
  }
}
