export class NetworkNodeOwnerRequiredError extends Error {
  public constructor() {
    super('Network node owner is required.');
    this.name = NetworkNodeOwnerRequiredError.name;
  }
}
