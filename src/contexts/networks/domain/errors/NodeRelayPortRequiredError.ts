export class NodeRelayPortRequiredError extends Error {
  public constructor() {
    super('An enabled private relay requires a complete port range.');
    this.name = NodeRelayPortRequiredError.name;
  }
}
