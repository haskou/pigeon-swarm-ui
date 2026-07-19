export class NetworkPeerIdRequiredError extends Error {
  public constructor() {
    super('Network peer id is required.');
    this.name = NetworkPeerIdRequiredError.name;
  }
}
