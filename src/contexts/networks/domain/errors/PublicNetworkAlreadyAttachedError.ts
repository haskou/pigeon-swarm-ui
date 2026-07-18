export class PublicNetworkAlreadyAttachedError extends Error {
  public constructor() {
    super('Public network is already attached to this node.');
    this.name = PublicNetworkAlreadyAttachedError.name;
  }
}
