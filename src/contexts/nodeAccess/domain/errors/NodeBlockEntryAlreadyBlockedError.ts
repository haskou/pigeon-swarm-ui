export class NodeBlockEntryAlreadyBlockedError extends Error {
  public constructor() {
    super('This entry is already blocked.');
    this.name = NodeBlockEntryAlreadyBlockedError.name;
  }
}
