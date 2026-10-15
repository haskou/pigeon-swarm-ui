export class InvalidNodePeerIdError extends Error {
  public constructor() {
    super('Node peer ids must be base58btc libp2p peer ids.');
    this.name = InvalidNodePeerIdError.name;
  }
}
