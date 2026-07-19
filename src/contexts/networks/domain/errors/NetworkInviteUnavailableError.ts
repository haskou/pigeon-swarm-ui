export class NetworkInviteUnavailableError extends Error {
  public constructor() {
    super('An attached private network is required to issue an invite.');
    this.name = NetworkInviteUnavailableError.name;
  }
}
