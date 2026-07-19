export class NetworkNotAttachedError extends Error {
  public constructor() {
    super('Network is not attached to this node.');
    this.name = NetworkNotAttachedError.name;
  }
}
