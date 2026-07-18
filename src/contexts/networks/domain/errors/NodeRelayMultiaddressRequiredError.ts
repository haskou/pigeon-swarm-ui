export class NodeRelayMultiaddressRequiredError extends Error {
  public constructor() {
    super('Node relay multiaddress is required.');
    this.name = NodeRelayMultiaddressRequiredError.name;
  }
}
