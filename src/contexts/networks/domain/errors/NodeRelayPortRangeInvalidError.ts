export class NodeRelayPortRangeInvalidError extends Error {
  public constructor() {
    super('Node relay port range must end at or after its starting port.');
    this.name = NodeRelayPortRangeInvalidError.name;
  }
}
