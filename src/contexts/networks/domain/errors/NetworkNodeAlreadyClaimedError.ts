export class NetworkNodeAlreadyClaimedError extends Error {
  public constructor() {
    super('Network node is already claimed.');
    this.name = NetworkNodeAlreadyClaimedError.name;
  }
}
