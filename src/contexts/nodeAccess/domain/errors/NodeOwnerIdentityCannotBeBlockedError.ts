export class NodeOwnerIdentityCannotBeBlockedError extends Error {
  public constructor() {
    super('The node owner identity cannot be blocked.');
    this.name = NodeOwnerIdentityCannotBeBlockedError.name;
  }
}
