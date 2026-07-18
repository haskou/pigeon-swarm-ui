export class NetworkNotFoundError extends Error {
  public constructor() {
    super('Network was not found on this node.');
    this.name = NetworkNotFoundError.name;
  }
}
