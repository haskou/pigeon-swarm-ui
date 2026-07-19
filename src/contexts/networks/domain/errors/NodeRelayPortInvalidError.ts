export class NodeRelayPortInvalidError extends Error {
  public constructor() {
    super('Node relay ports must be integers between 1 and 65535.');
    this.name = NodeRelayPortInvalidError.name;
  }
}
