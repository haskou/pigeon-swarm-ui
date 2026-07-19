export class InvalidNetworkInviteCodeError extends Error {
  public constructor() {
    super('Invalid network code.');
    this.name = InvalidNetworkInviteCodeError.name;
  }
}
